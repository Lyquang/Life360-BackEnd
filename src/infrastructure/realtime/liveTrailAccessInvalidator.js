function createLiveTrailAccessInvalidator({ logger = console } = {}) {
  const registrations = new Map();

  function register(socketId, revalidate) {
    registrations.set(socketId, revalidate);
    return () => registrations.delete(socketId);
  }

  async function run(filter) {
    const outcomes = await Promise.allSettled(
      [...registrations.values()].map((revalidate) => revalidate(filter))
    );
    if (outcomes.some((outcome) => outcome.status === 'rejected')) {
      logger.warn('Immediate live trail watch invalidation failed; lease remains active.');
    }
  }

  function revalidateForTarget(targetUserId) {
    return run({ targetUserId: String(targetUserId) });
  }

  function revalidateForMembershipChange(userId) {
    return run({ memberUserId: String(userId) });
  }

  return { register, revalidateForTarget, revalidateForMembershipChange };
}

module.exports = { createLiveTrailAccessInvalidator };
