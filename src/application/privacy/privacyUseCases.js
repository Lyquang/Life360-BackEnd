const { Errors } = require('../../domain/errors');
const { locationSharingUpdate, publicLocationSharing } = require('../../domain/locationSharing');
const { lastLocationKey } = require('../../domain/cacheKeys');

function createPrivacyUseCases({
  userRepo,
  cacheManager,
  liveTrailAccessInvalidator,
  locationRuntimeState,
}) {
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
      throw Errors.badRequest(error.message);
    }
    const user = await userRepo.setLocationSharing(userId, update);
    if (!user) throw Errors.notFound('User not found.');

    if (!enabled) {
      await cacheManager.del(lastLocationKey(userId));
      locationRuntimeState.clearUser(userId);
      await liveTrailAccessInvalidator.revalidateForTarget(userId);
    }
    return publicLocationSharing(user.locationSharing);
  }

  return { getLocationSharing, setLocationSharing };
}

module.exports = { createPrivacyUseCases };
