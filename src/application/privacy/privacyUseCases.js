const { Errors } = require('../../domain/errors');
const { locationSharingUpdate, publicLocationSharing } = require('../../domain/locationSharing');
const { lastLocationKey } = require('../../domain/cacheKeys');
const { createSafeMetrics } = require('../ports/metrics');

function createPrivacyUseCases({
  userRepo,
  cacheManager,
  liveTrailAccessInvalidator,
  locationRuntimeState,
  metrics,
}) {
  const telemetry = createSafeMetrics(metrics);
  async function getLocationSharing(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw Errors.notFound('User not found.');
    return publicLocationSharing(user.locationSharing);
  }

  async function setLocationSharing({ userId, enabled, pausedUntil }) {
    let update;
    try {
      update = locationSharingUpdate({ enabled, pausedUntil });
    } catch (error) {
      telemetry.increment('privacy_actions_total', { action: enabled ? 'resume' : 'pause', outcome: 'rejected' });
      throw Errors.badRequest(error.message);
    }

    try {
      const user = await userRepo.setLocationSharing(userId, update);
      if (!user) throw Errors.notFound('User not found.');

      if (!enabled) {
        await cacheManager.del(lastLocationKey(userId));
        locationRuntimeState.clearUser(userId);
        await liveTrailAccessInvalidator.revalidateForTarget(userId);
      }
      telemetry.increment('privacy_actions_total', { action: enabled ? 'resume' : 'pause', outcome: 'success' });
      return publicLocationSharing(user.locationSharing);
    } catch (error) {
      telemetry.increment('privacy_actions_total', {
        action: enabled ? 'resume' : 'pause',
        outcome: Number(error?.status) >= 400 && Number(error?.status) < 500 ? 'rejected' : 'error',
      });
      throw error;
    }
  }

  return { getLocationSharing, setLocationSharing };
}

module.exports = { createPrivacyUseCases };
