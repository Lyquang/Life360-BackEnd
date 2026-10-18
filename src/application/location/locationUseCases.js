const { haversineDistance, formatDuration } = require('../../domain/geo');
const { lastLocationKey } = require('../../domain/cacheKeys');
const { shouldPersistHistoryPoint } = require('../../domain/historyPersistence');

const THROTTLE_DISTANCE_METERS = 50;
const THROTTLE_TIME_MS = 30 * 1000;
const MAX_RECORDED_AT_FUTURE_MS = 60 * 1000;
const MAX_RECORDED_AT_AGE_MS = 24 * 60 * 60 * 1000;
const STAY_ALERT_MILESTONES_MINUTES = [30, 60, 120, 240, 480, 1440];

/**
 * Location sharing, SOS and presence. Keeps per-user in-memory state
 * (history throttling + "how long at this spot"), valid for a single instance.
 */
function createLocationUseCases({
  userRepo,
  groupRepo,
  locationHistoryRepo,
  realtime,
  cacheManager,
  locationCacheTtlSeconds = 300,
  historyPersistencePolicy = { denseEnabled: false },
  liveTrailProjection,
  liveTrailDeltaPublisher,
  logger = console,
}) {
  const lastSavedLocation = new Map();
  const durationTracker = new Map();
  let ignoredRecordedAtCount = 0;

  function resolveRecordedAt(recordedAt, serverNow) {
    if (!recordedAt) return new Date(serverNow);

    const measuredAt = new Date(recordedAt);
    let reason = null;
    if (measuredAt.getTime() > serverNow + MAX_RECORDED_AT_FUTURE_MS) reason = 'too_far_in_future';
    if (measuredAt.getTime() < serverNow - MAX_RECORDED_AT_AGE_MS) reason = 'too_old';
    if (!reason) return measuredAt;

    ignoredRecordedAtCount += 1;
    logger.warn('Ignored out-of-range location recordedAt; using server time.', {
      reason,
      ignoredRecordedAtCount,
    });
    return new Date(serverNow);
  }

  function shouldSaveLegacyHistory(userId, latitude, longitude, now) {
    const last = lastSavedLocation.get(userId);
    if (!last) return true;
    if (now - last.timestamp >= THROTTLE_TIME_MS) return true;
    return haversineDistance(last.latitude, last.longitude, latitude, longitude) >= THROTTLE_DISTANCE_METERS;
  }

  async function getLatestSavedLocation(userId) {
    if (lastSavedLocation.has(userId)) return lastSavedLocation.get(userId);
    const latest = await locationHistoryRepo.findLatestForUser(userId);
    if (!latest) return null;
    const loaded = {
      latitude: latest.location.coordinates[1],
      longitude: latest.location.coordinates[0],
      recordedAt: latest.timestamp,
      motionState: latest.motionState,
    };
    lastSavedLocation.set(userId, loaded);
    return loaded;
  }

  async function historyDecision({ userId, latitude, longitude, at, motionState, now }) {
    if (!historyPersistencePolicy.denseEnabled) {
      return { persist: shouldSaveLegacyHistory(userId, latitude, longitude, now), reason: 'legacy' };
    }
    const previous = await getLatestSavedLocation(userId);
    return shouldPersistHistoryPoint(
      previous,
      { latitude, longitude, recordedAt: at, motionState },
      historyPersistencePolicy
    );
  }

  function trackDuration(userId, latitude, longitude, now) {
    const tracker = durationTracker.get(userId);
    const moved =
      !tracker ||
      haversineDistance(tracker.latitude, tracker.longitude, latitude, longitude) >= THROTTLE_DISTANCE_METERS;

    if (moved) {
      durationTracker.set(userId, { latitude, longitude, sinceTimestamp: now, alertedMilestones: new Set() });
      return { durationMinutes: 0, durationSince: new Date(now).toISOString(), newMilestones: [] };
    }

    const durationMinutes = Math.floor((now - tracker.sinceTimestamp) / 60000);
    const newMilestones = STAY_ALERT_MILESTONES_MINUTES.filter(
      (m) => durationMinutes >= m && !tracker.alertedMilestones.has(m)
    );
    newMilestones.forEach((m) => tracker.alertedMilestones.add(m));

    return {
      durationMinutes,
      durationSince: new Date(tracker.sinceTimestamp).toISOString(),
      newMilestones,
    };
  }

  async function updateLocation({
    userId,
    userName,
    socketId,
    latitude,
    longitude,
    batteryLevel,
    fallbackBatteryLevel,
    recordedAt,
    accuracy,
    pointId,
    motionState,
  }) {
    const now = Date.now();
    const serverAt = new Date(now);
    const at = resolveRecordedAt(recordedAt, now);
    const { durationMinutes, durationSince, newMilestones } = trackDuration(userId, latitude, longitude, now);

    const cachedLocation = {
      userId,
      name: userName,
      latitude,
      longitude,
      batteryLevel: batteryLevel ?? fallbackBatteryLevel,
      durationMinutes,
      recordedAt: at.toISOString(),
    };
    if (accuracy !== undefined) cachedLocation.accuracy = accuracy;
    if (motionState !== undefined) cachedLocation.motionState = motionState;
    await cacheManager.setIfNewerTimestamp(
      lastLocationKey(userId),
      cachedLocation,
      'recordedAt',
      locationCacheTtlSeconds
    );

    const persistence = await historyDecision({ userId, latitude, longitude, at, motionState, now });
    if (persistence.persist) {
      if (persistence.reason !== 'lateArrival') {
        await userRepo.updateLastKnownLocation(userId, { latitude, longitude, batteryLevel, durationMinutes, at });
      }
      await locationHistoryRepo.create({ userId, latitude, longitude, at, accuracy, pointId, motionState });
      if (persistence.reason !== 'lateArrival') {
        lastSavedLocation.set(userId, {
          latitude,
          longitude,
          recordedAt: at,
          motionState,
          ...(historyPersistencePolicy.denseEnabled ? {} : { timestamp: now }),
        });
      }
    }

    const trailProjection = await liveTrailProjection.project({
      userId,
      points: [{ latitude, longitude, recordedAt: at, accuracy, pointId, motionState }],
    });
    liveTrailDeltaPublisher.publishRealtime({ userId, projection: trailProjection });
    const isLateTrailUpdate = trailProjection.results.some((result) => result.lateArrival);
    if (isLateTrailUpdate) return;

    const groups = await groupRepo.listSummariesByMember(userId);
    const payload = {
      userId,
      name: userName,
      latitude,
      longitude,
      batteryLevel: batteryLevel ?? fallbackBatteryLevel,
      timestamp: at.toISOString(),
      recordedAt: at.toISOString(),
      durationAtLocation: durationMinutes,
      durationSince,
      durationFormatted: formatDuration(durationMinutes),
    };
    if (accuracy !== undefined) payload.accuracy = accuracy;
    if (motionState !== undefined) payload.motionState = motionState;

    for (const group of groups) {
      realtime.emitToGroup(group._id, 'location_update', payload, { exceptSocketId: socketId });

      for (const milestone of newMilestones) {
        realtime.emitToGroup(group._id, 'location_stay_alert', {
          type: 'STAY_ALERT',
          userId,
          name: userName,
          latitude,
          longitude,
          durationMinutes: milestone,
          durationFormatted: formatDuration(milestone),
          durationSince,
          groupId: group._id,
          groupName: group.name,
          message: `${userName} đang ở một nơi được ${formatDuration(milestone)} rồi!`,
          timestamp: serverAt.toISOString(),
        });
        logger.log(`⏱  Stay alert: ${userName} stayed ${formatDuration(milestone)} in group ${group.name}`);
      }
    }
  }

  async function sendSos({ userId, userName, message, latitude, longitude, batteryLevel }) {
    const groups = await groupRepo.listSummariesByMember(userId);
    const payload = {
      type: 'SOS',
      userId,
      name: userName,
      message: message || 'Emergency! I need help!',
      latitude,
      longitude,
      batteryLevel,
      timestamp: new Date().toISOString(),
    };
    for (const group of groups) {
      realtime.emitToGroup(group._id, 'sos_alert', { ...payload, groupId: group._id, groupName: group.name });
    }
    return { groupCount: groups.length };
  }

  /** @returns {Promise<{ groupIds: string[] }>} groups whose rooms the new socket must join */
  async function connect({ userId, userName, socketId }) {
    await userRepo.markOnline(userId);
    const groups = await groupRepo.listSummariesByMember(userId);
    const timestamp = new Date().toISOString();
    for (const group of groups) {
      realtime.emitToGroup(
        group._id,
        'member_online',
        { userId, name: userName, isOnline: true, timestamp },
        { exceptSocketId: socketId }
      );
    }
    return { groupIds: groups.map((g) => g._id.toString()) };
  }

  async function disconnect({ userId, userName }) {
    // Another device of the same user is still connected → still online.
    if ((await realtime.countUserSockets(userId)) > 0) return;

    const at = new Date();
    await userRepo.markOffline(userId, at);
    lastSavedLocation.delete(userId);
    durationTracker.delete(userId);

    const groups = await groupRepo.listSummariesByMember(userId);
    for (const group of groups) {
      realtime.emitToGroup(group._id, 'member_offline', {
        userId,
        name: userName,
        isOnline: false,
        lastSeenAt: at.toISOString(),
        timestamp: at.toISOString(),
      });
    }
  }

  return { updateLocation, sendSos, connect, disconnect };
}

module.exports = { createLocationUseCases };
