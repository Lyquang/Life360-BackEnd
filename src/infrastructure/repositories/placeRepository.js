const FavoritePlace = require('../database/models/FavoritePlace');

const ADDED_BY_FIELDS = 'name email avatar';

module.exports = {
  async create({ groupId, name, category, latitude, longitude, addedBy }) {
    const place = await FavoritePlace.create({
      groupId,
      name,
      category,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      addedBy,
    });
    return place.populate('addedBy', ADDED_BY_FIELDS);
  },

  listByGroup(groupId) {
    return FavoritePlace.find({ groupId }).populate('addedBy', ADDED_BY_FIELDS).sort({ createdAt: -1 });
  },
};
