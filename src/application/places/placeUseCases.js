const { requireGroupMember } = require('../shared/policies');

function createPlaceUseCases({ groupRepo, placeRepo }) {
  async function addPlace({ userId, groupId, name, category, latitude, longitude }) {
    await requireGroupMember(groupRepo, groupId, userId);
    return placeRepo.create({ groupId, name, category, latitude, longitude, addedBy: userId });
  }

  async function listPlaces({ userId, groupId }) {
    await requireGroupMember(groupRepo, groupId, userId);
    return placeRepo.listByGroup(groupId);
  }

  return { addPlace, listPlaces };
}

module.exports = { createPlaceUseCases };
