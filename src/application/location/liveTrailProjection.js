const { prepareLiveTrailPoints } = require('../../domain/liveTrail');
const { createSafeMetrics } = require('../ports/metrics');

function createLiveTrailProjection({ liveTrailRepo, unitOfWork, policy, logger = console, metrics }) {
  const telemetry = createSafeMetrics(metrics);
  async function project({ userId, points }) {
    if (!policy.enabled || points.length === 0) {
      telemetry.increment('trail_projection_total', { outcome: 'disabled' });
      return { enabled: false, results: [] };
    }
    const groups = prepareLiveTrailPoints(points, policy);
    const results = [];

    for (const group of groups) {
      try {
        const result = await unitOfWork.run((session) =>
          liveTrailRepo.appendPoints({
            userId,
            localDate: group.localDate,
            timeZone: policy.timeZone,
            points: group.points,
            session,
          })
        );
        if (result) results.push(result);
        telemetry.increment('trail_projection_total', { outcome: 'success' });
      } catch (error) {
        telemetry.increment('trail_projection_total', { outcome: 'error' });
        logger.error('LIVE_TRAIL_PROJECTION_FAILED');
      }
    }

    return { enabled: true, results };
  }

  return { project };
}

module.exports = { createLiveTrailProjection };
