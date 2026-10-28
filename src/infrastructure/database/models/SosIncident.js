const mongoose = require('mongoose');
const { SOS_STATUSES } = require('../../../domain/sos');

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  recordedAt: { type: Date },
}, { _id: false });

const incidentSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientRequestId: {
    type: String,
    lowercase: true,
    match: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  },
  status: { type: String, enum: SOS_STATUSES, required: true, default: 'active' },
  groupIds: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    required: true,
    validate: { validator: (ids) => ids.length > 0, message: 'SOS requires at least one group.' },
  },
  recipientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  message: { type: String, default: '', maxlength: 500 },
  location: { type: locationSchema, default: null },
  revision: { type: Number, required: true, default: 1, min: 1, validate: Number.isSafeInteger },
  closedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'sos_incidents' });

incidentSchema.index({ ownerId: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'active' },
});
incidentSchema.index({ ownerId: 1, clientRequestId: 1 }, {
  unique: true,
  partialFilterExpression: { clientRequestId: { $type: 'string' } },
});
incidentSchema.index({ ownerId: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model('SosIncident', incidentSchema);
