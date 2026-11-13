const FavoritePlace = require('../database/models/FavoritePlace');
const MemberPlaceLabel = require('../database/models/MemberPlaceLabel');
const PlacePresence = require('../database/models/PlacePresence');

const ADDED_BY_FIELDS = 'name email avatar';

module.exports = {
  labelGroupIds(userId) {
    return MemberPlaceLabel.distinct('groupId', { userId });
  },
  findPresence(groupId, userId, { session }) {
    return PlacePresence.findOne({ groupId, userId }).session(session).lean();
  },
  savePresence(groupId, userId, state, { session }) {
    return PlacePresence.updateOne({ groupId, userId }, { $set: state }, { upsert: true, session });
  },
  listPresence(groupId, userIds) {
    return PlacePresence.find({ groupId, userId: { $in: userIds } }).lean();
  },
  listSubjectLabels(groupId, userIds) {
    return MemberPlaceLabel.find({ groupId, userId: { $in: userIds } })
      .populate({ path: 'placeId', match: { groupId } }).lean();
  },
  findInGroup(groupId, placeId, { session } = {}) {
    return FavoritePlace.findOne({ _id: placeId, groupId })
      .session(session || null).populate('addedBy', ADDED_BY_FIELDS);
  },

  updateInGroup(groupId, placeId, revision, patch, { session }) {
    const version = revision === 0
      ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
      : { revision };
    return FavoritePlace.findOneAndUpdate(
      { _id: placeId, groupId, ...version },
      { $set: patch, $inc: { revision: 1 } },
      { new: true, runValidators: true, session }
    ).populate('addedBy', ADDED_BY_FIELDS);
  },

  deleteInGroup(groupId, placeId, revision, { session }) {
    const version = revision === 0
      ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
      : { revision };
    return FavoritePlace.deleteOne({ _id: placeId, groupId, ...version }, { session });
  },

  deletePlaceLabels(groupId, placeId, { session }) {
    return MemberPlaceLabel.deleteMany({ groupId, placeId }, { session });
  },

  async listLabels(groupId, userId, { session } = {}) {
    const labels = await MemberPlaceLabel.find({ groupId, userId })
      .session(session || null)
      .sort({ label: 1 }).populate({ path: 'placeId', match: { groupId },
        populate: { path: 'addedBy', select: ADDED_BY_FIELDS } });
    return labels.filter((entry) => entry.placeId);
  },

  setLabel(groupId, userId, label, placeId, customLabel, { session }) {
    return MemberPlaceLabel.findOneAndUpdate(
      { groupId, userId, label },
      { $set: { placeId, customLabel: customLabel || null } },
      { new: true, upsert: true, runValidators: true, session }
    ).populate({ path: 'placeId', populate: { path: 'addedBy', select: ADDED_BY_FIELDS } });
  },

  deleteLabel(groupId, userId, label, { session }) {
    return MemberPlaceLabel.deleteOne({ groupId, userId, label }, { session });
  },
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
