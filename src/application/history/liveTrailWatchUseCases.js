const { Errors } = require('../../domain/errors');
const { localDateFor } = require('../../domain/liveTrail');
const { sameId } = require('../shared/policies');

function createLiveTrailWatchUseCases({ groupRepo, liveTrailRepo, liveTrailPolicy }) {
  async function assertCanView(requesterId, targetUserId) {
    if (sameId(requesterId, targetUserId)) return;
    if (!(await groupRepo.usersShareGroup(requesterId, targetUserId))) {
      throw Errors.forbidden('You can only watch live trails of yourself or members of your groups.');
    }
  }

  function normalizeDate(date) {
    return date || localDateFor(new Date(), liveTrailPolicy.timeZone);
  }

  async function watch({ requesterId, userId, date }) {
    if (!liveTrailPolicy.enabled) {
      throw Errors.serviceUnavailable('Live trail is not enabled on this server.');
    }
    await assertCanView(requesterId, userId);
    const localDate = normalizeDate(date);
    const trail = await liveTrailRepo.findForUserDate(userId, localDate);
    if (!trail) throw Errors.notFound('Live trail was not found for this user and date.');

    return {
      trailId: String(trail._id),
      userId: String(userId),
      date: localDate,
      revision: trail.revision,
      lastSeq: trail.lastSeq,
    };
  }

  async function revalidate({ requesterId, userId, date, trailId }) {
    await assertCanView(requesterId, userId);
    const trail = await liveTrailRepo.findForUserDate(userId, date);
    if (!trail || String(trail._id) !== String(trailId)) {
      throw Errors.notFound('Live trail is no longer available.');
    }
    return {
      trailId: String(trail._id),
      revision: trail.revision,
      lastSeq: trail.lastSeq,
    };
  }

  return { watch, revalidate, normalizeDate };
}

module.exports = { createLiveTrailWatchUseCases };
