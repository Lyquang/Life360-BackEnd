const { requireGroupMember, sameId } = require('../shared/policies');
const { Errors } = require('../../domain/errors');

function createPlaceUseCases({ groupRepo, placeRepo, unitOfWork }) {
  async function writeAsMember(userId, groupId, work) {
    return unitOfWork.run(async (session) => {
      if (!session) throw Errors.serviceUnavailable('Place management requires database transactions.');
      const group = await groupRepo.lockForPlaceWrite(groupId, userId, { session });
      if (!group) {
        if (!await groupRepo.findById(groupId, { session })) throw Errors.notFound('Group not found.');
        throw Errors.forbidden('You are not a member of this group.');
      }
      return work(group, session);
    });
  }

  async function requirePlace(groupId, placeId, session) {
    const place = await placeRepo.findInGroup(groupId, placeId, { session });
    if (!place) throw Errors.notFound('Place not found.');
    return place;
  }

  function requireEditor(group, place, userId) {
    const isCreator = place.addedBy && sameId(place.addedBy._id || place.addedBy, userId);
    if (!sameId(group.admin, userId) && !isCreator) {
      throw Errors.forbidden('Only the place creator or Circle admin can edit or delete this place.');
    }
  }

  async function getPlace({ userId, groupId, placeId }) {
    await requireGroupMember(groupRepo, groupId, userId);
    return requirePlace(groupId, placeId);
  }

  async function updatePlace({ userId, groupId, placeId, revision, name, category, latitude, longitude }) {
    return writeAsMember(userId, groupId, async (group, session) => {
      const place = await requirePlace(groupId, placeId, session);
      requireEditor(group, place, userId);
      const patch = {};
      if (name !== undefined) patch.name = name;
      if (category !== undefined) patch.category = category;
      if (latitude !== undefined && longitude !== undefined) {
        patch.location = { type: 'Point', coordinates: [longitude, latitude] };
      }
      const updated = await placeRepo.updateInGroup(groupId, placeId, revision, patch, { session });
      if (!updated) throw Errors.conflict('Place revision changed. Reload the place and retry.');
      return updated;
    });
  }

  async function deletePlace({ userId, groupId, placeId, revision }) {
    return writeAsMember(userId, groupId, async (group, session) => {
      const place = await requirePlace(groupId, placeId, session);
      requireEditor(group, place, userId);
      const result = await placeRepo.deleteInGroup(groupId, placeId, revision, { session });
      if (!result.deletedCount) throw Errors.conflict('Place revision changed. Reload the place and retry.');
      await placeRepo.deletePlaceLabels(groupId, placeId, { session });
      return { id: String(placeId), deleted: true };
    });
  }

  async function listMyLabels({ userId, groupId }) {
    await requireGroupMember(groupRepo, groupId, userId);
    return placeRepo.listLabels(groupId, userId);
  }

  async function setMyLabel({ userId, groupId, label, placeId, customLabel }) {
    if (label === 'custom' && !customLabel) throw Errors.badRequest('customLabel is required for a custom label.');
    if (label !== 'custom' && customLabel !== undefined) throw Errors.badRequest('customLabel is only allowed for custom.');
    return writeAsMember(userId, groupId, async (group, session) => {
      await requirePlace(groupId, placeId, session);
      return placeRepo.setLabel(groupId, userId, label, placeId, customLabel, { session });
    });
  }

  async function deleteMyLabel({ userId, groupId, label }) {
    return writeAsMember(userId, groupId, async (group, session) => {
      const result = await placeRepo.deleteLabel(groupId, userId, label, { session });
      return { label, removed: result.deletedCount > 0 };
    });
  }
  async function addPlace({ userId, groupId, name, category, latitude, longitude }) {
    await requireGroupMember(groupRepo, groupId, userId);
    return placeRepo.create({ groupId, name, category, latitude, longitude, addedBy: userId });
  }

  async function listPlaces({ userId, groupId }) {
    await requireGroupMember(groupRepo, groupId, userId);
    return placeRepo.listByGroup(groupId);
  }

  return { addPlace, listPlaces, getPlace, updatePlace, deletePlace, listMyLabels, setMyLabel, deleteMyLabel };
}

module.exports = { createPlaceUseCases };
