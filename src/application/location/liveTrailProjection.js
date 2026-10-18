const { prepareLiveTrailPoints } = require('../../domain/liveTrail');

function createLiveTrailProjection({ liveTrailRepo, unitOfWork, policy, logger = console }) {
  async function project({ userId, points }) {
    if (!policy.enabled || points.length === 0) return { enabled: false, results: [] };
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
      } catch (error) {
        logger.error('Live trail projection failed; existing location flow continues.', {
          errorName: error?.name || 'Error',
        });
      }
    }

    return { enabled: true, results };
  }

  return { project };
}

module.exports = { createLiveTrailProjection };
