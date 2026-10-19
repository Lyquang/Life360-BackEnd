const { Errors } = require('../../domain/errors');
const { isLocationSharingEnabled } = require('../../domain/locationSharing');
const { sameId } = require('../shared/policies');

function createLocationAccessPolicy({ userRepo, groupRepo }) {
  async function sharingEnabled(userId, at = new Date()) {
    const user = await userRepo.findById(userId);
    if (!user) throw Errors.notFound('User not found.');
    return isLocationSharingEnabled(user.locationSharing, at);
  }

  async function assertCanPublishLocation(userId, at = new Date()) {
    if (!(await sharingEnabled(userId, at))) throw Errors.locationSharingPaused();
  }

  async function assertCanViewLocation(requesterId, targetUserId, at = new Date()) {
    if (sameId(requesterId, targetUserId)) return;
    if (!(await groupRepo.usersShareGroup(requesterId, targetUserId))) {
      throw Errors.forbidden('You can only view location of yourself or members of your groups.');
    }
    if (!(await sharingEnabled(targetUserId, at))) throw Errors.locationSharingPaused();
  }

  return { sharingEnabled, assertCanPublishLocation, assertCanViewLocation };
}

module.exports = { createLocationAccessPolicy };
