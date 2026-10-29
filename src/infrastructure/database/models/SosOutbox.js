const mongoose = require('mongoose');

// References only. The dispatcher loads data and rechecks access before sending.
const outboxSchema = new mongoose.Schema({
  eventKey: { type: String, required: true, maxlength: 200 },
  kind: { type: String, enum: ['chat_message', 'sos_alert', 'sos_updated'], required: true },
  sosId: { type: mongoose.Schema.Types.ObjectId, ref: 'SosIncident', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messageId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage',
    required: function () { return this.kind === 'chat_message'; },
  },
  revision: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  status: { type: String, enum: ['pending', 'processing', 'delivered', 'failed', 'discarded'], default: 'pending', required: true },
  attempts: { type: Number, default: 0, min: 0 },
  nextAttemptAt: { type: Date, required: true, default: Date.now },
  leaseUntil: { type: Date, default: null },
  leaseToken: { type: String, default: null },
  deliveredAt: { type: Date, default: null },
}, { timestamps: true, collection: 'sos_outbox' });

outboxSchema.index({ eventKey: 1 }, { unique: true });
outboxSchema.index({ status: 1, nextAttemptAt: 1, _id: 1 });
outboxSchema.index({ status: 1, leaseUntil: 1 });

module.exports = mongoose.model('SosOutbox', outboxSchema);
