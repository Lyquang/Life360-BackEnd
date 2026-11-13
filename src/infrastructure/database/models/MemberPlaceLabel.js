const mongoose = require('mongoose');
const { PLACE_LABELS } = require('../../../domain/placeLabels');

const schema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  label: { type: String, enum: PLACE_LABELS, required: true },
  placeId: { type: mongoose.Schema.Types.ObjectId, ref: 'FavoritePlace', required: true },
  customLabel: { type: String, trim: true, maxlength: 50, default: null },
}, { timestamps: true });

schema.index({ groupId: 1, userId: 1, label: 1 }, { unique: true });
schema.index({ groupId: 1, placeId: 1 });
schema.set('toJSON', { transform(doc, ret) {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
} });

module.exports = mongoose.model('MemberPlaceLabel', schema);
