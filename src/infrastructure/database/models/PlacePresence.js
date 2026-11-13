const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sourceFixAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  privacyUpdatedAt: { type: Date, default: null },
  privacyVersion: { type: Number, required: true },
  membershipVersion: { type: Number, required: true },
  placeId: { type: mongoose.Schema.Types.ObjectId, ref: 'FavoritePlace', default: null },
  placeRevision: { type: Number, default: null },
  labelId: { type: mongoose.Schema.Types.ObjectId, ref: 'MemberPlaceLabel', default: null },
  labelUpdatedAt: { type: Date, default: null },
  candidateSince: { type: Date, default: null },
  confirmed: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ groupId: 1, userId: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('PlacePresence', schema);
