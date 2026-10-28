const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  sosId: { type: mongoose.Schema.Types.ObjectId, ref: 'SosIncident', required: true },
  responderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['coming'], required: true, default: 'coming' },
}, {
  timestamps: { createdAt: 'respondedAt', updatedAt: false },
  collection: 'sos_responses',
});

responseSchema.index({ sosId: 1, responderId: 1 }, { unique: true });
responseSchema.index({ sosId: 1, _id: 1 });

module.exports = mongoose.model('SosResponse', responseSchema);
