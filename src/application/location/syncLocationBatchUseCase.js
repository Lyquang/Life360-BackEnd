const { lastLocationKey } = require('../../domain/cacheKeys');
const { stableSortByRecordedAt, recordedAtRejection } = require('../../domain/locationBatch');

function createSyncLocationBatchUseCase({
  userRepo,
  locationHistoryRepo,
  cacheManager,
  locationCacheTtlSeconds = 300,
  liveTrailProjection,
  liveTrailDeltaPublisher,
  policy,
}) {
  return async function syncLocationBatch({ userId, userName, fallbackBatteryLevel, points, rejected = [] }) {
    const now = Date.now();
    const eligible = [];
    const outcomeRejected = [...rejected];

    for (const point of points) {
      const rejection = recordedAtRejection(point.recordedAt, now, policy);
      if (rejection) {
        outcomeRejected.push({
          index: point.index,
          pointId: point.pointId,
          ...rejection,
        });
      } else {
        eligible.push(point);
      }
    }

    const sorted = stableSortByRecordedAt(eligible);
    const unique = [];
    const repeatedInRequest = [];
    const seen = new Set();
    for (const point of sorted) {
      if (seen.has(point.pointId)) repeatedInRequest.push(point.pointId);
      else {
        seen.add(point.pointId);
        unique.push(point);
      }
    }

    const persisted = await locationHistoryRepo.insertBatchIdempotent({ userId, points: unique });
    const latest = unique.at(-1);
    if (latest) {
      const update = await userRepo.updateLastKnownLocation(userId, {
        latitude: latest.latitude,
        longitude: latest.longitude,
        batteryLevel: latest.batteryLevel,
        durationMinutes: 0,
        at: latest.recordedAt,
        updateLastSeen: false,
      });

      if (update.modifiedCount > 0) {
        const cachedLocation = {
          userId: userId.toString(),
          name: userName,
          latitude: latest.latitude,
          longitude: latest.longitude,
          batteryLevel: latest.batteryLevel ?? fallbackBatteryLevel,
          durationMinutes: 0,
          recordedAt: latest.recordedAt.toISOString(),
        };
        if (latest.accuracy !== undefined) cachedLocation.accuracy = latest.accuracy;
        await cacheManager.setIfNewerTimestamp(
          lastLocationKey(userId),
          cachedLocation,
          'recordedAt',
          locationCacheTtlSeconds
        );
      }
    }

    const trailProjection = await liveTrailProjection.project({ userId, points: unique });
    liveTrailDeltaPublisher.publishBatchReset({ userId, projection: trailProjection });

    return {
      accepted: persisted.accepted,
      duplicates: [...persisted.duplicates, ...repeatedInRequest],
      rejected: outcomeRejected.sort((a, b) => a.index - b.index),
    };
  };
}

module.exports = { createSyncLocationBatchUseCase };
