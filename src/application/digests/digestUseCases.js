const { requireGroupMember } = require('../shared/policies');
const { formatDuration, formatLastSeen } = require('../../domain/geo');
const { isLocationSharingEnabled } = require('../../domain/locationSharing');
const { createSafeMetrics } = require('../ports/metrics');

function buildMemberStatus(member, now) {
  const sharingEnabled = isLocationSharingEnabled(member.locationSharing, now);
  const lastLoc = member.lastKnownLocation;
  const lastSeenText = formatLastSeen(member, now);
  const durationMin = lastLoc?.durationMinutes || 0;
  const durationText = durationMin > 0 ? `ở đây ${formatDuration(durationMin)}` : null;

  return {
    userId: member._id,
    name: member.name,
    isOnline: member.isOnline,
    lastSeenText,
    batteryLevel: member.batteryLevel,
    latitude: sharingEnabled ? lastLoc?.coordinates?.[1] ?? null : null,
    longitude: sharingEnabled ? lastLoc?.coordinates?.[0] ?? null : null,
    locationUpdatedAt: sharingEnabled ? lastLoc?.updatedAt || null : null,
    durationMinutes: sharingEnabled ? durationMin : 0,
    durationFormatted: sharingEnabled && durationMin > 0 ? formatDuration(durationMin) : null,
    summary: !sharingEnabled
      ? `${member.name} đã tạm dừng chia sẻ vị trí`
      : durationText
      ? `${member.name} ${durationText} và ${lastSeenText.toLowerCase()}`
      : `${member.name} ${lastSeenText.toLowerCase()}`,
  };
}

function groupSettings(group) {
  return {
    notificationIntervalMinutes: group.notificationIntervalMinutes,
    lastDigestSentAt: group.lastDigestSentAt,
  };
}

function createDigestUseCases({ groupRepo, digestRepo, realtime, logger = console, metrics }) {
  const telemetry = createSafeMetrics(metrics);
  async function listDigests({ userId, groupId, page, limit, from, to }) {
    const group = await requireGroupMember(groupRepo, groupId, userId);
    const { items, total } = await digestRepo.list({ groupId, from, to, skip: (page - 1) * limit, limit });
    const totalPages = Math.ceil(total / limit);
    return {
      items,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      groupSettings: groupSettings(group),
    };
  }

  async function getLatestDigest({ userId, groupId }) {
    const group = await requireGroupMember(groupRepo, groupId, userId);
    return { digest: await digestRepo.findLatest(groupId), groupSettings: groupSettings(group) };
  }

  /** Called every minute by the scheduler. Only groups with someone connected get a digest. */
  async function sendDueDigests(now = new Date(), { scheduledAt } = {}) {
    const startedAt = metrics?.enabled === true ? process.hrtime.bigint() : null;
    if (scheduledAt instanceof Date && Number.isFinite(scheduledAt.getTime())) {
      telemetry.observe('job_schedule_delay_seconds', { job: 'digest' }, Math.max(0, (Date.now() - scheduledAt.getTime()) / 1000));
    }

    try {
      const groups = await groupRepo.listWithDigestEnabled();
      let sent = 0;

      for (const group of groups) {
        const intervalMs = group.notificationIntervalMinutes * 60 * 1000;
        if (group.lastDigestSentAt && now - group.lastDigestSentAt < intervalMs) continue;
        if ((await realtime.countGroupSockets(group._id)) === 0) continue;

        const members = group.members.map((member) => buildMemberStatus(member, now));
        realtime.emitToGroup(group._id, 'group_digest', {
          type: 'GROUP_DIGEST',
          groupId: group._id,
          groupName: group.name,
          intervalMinutes: group.notificationIntervalMinutes,
          members,
          timestamp: now.toISOString(),
        });

        await digestRepo.create({
          groupId: group._id,
          groupName: group.name,
          intervalMinutes: group.notificationIntervalMinutes,
          members,
          sentAt: now,
        });
        await groupRepo.setLastDigestSentAt(group._id, now);
        sent += 1;

        logger.log('GROUP_DIGEST_SENT');
      }
      telemetry.increment('job_runs_total', { job: 'digest', outcome: 'success' });
      return sent;
    } catch (error) {
      telemetry.increment('job_runs_total', { job: 'digest', outcome: 'error' });
      throw error;
    } finally {
      if (startedAt !== null) {
        telemetry.observe('job_duration_seconds', { job: 'digest' }, Number(process.hrtime.bigint() - startedAt) / 1e9);
      }
    }
  }

  return { listDigests, getLatestDigest, sendDueDigests };
}

module.exports = { createDigestUseCases };
