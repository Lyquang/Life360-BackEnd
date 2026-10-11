const mongoose = require('mongoose');
const { REFRESH_SESSION_STATUS } = require('../../../domain/refreshTokens');

const refreshSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: Object.values(REFRESH_SESSION_STATUS),
      default: REFRESH_SESSION_STATUS.ACTIVE,
      required: true,
    },
    expiresAt: { type: Date, required: true },
    rotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    deviceInfo: {
      userAgent: { type: String, default: null },
      ip: { type: String, default: null },
      name: { type: String, default: null },
    },
    lastUsedAt: { type: Date, default: null },
    accessTokenHash: { type: String, default: null },
    accessTokenExpiresAt: { type: Date, default: null },
    revokeReason: { type: String, default: null },
  },
  { timestamps: true, collection: 'refresh_sessions' }
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ userId: 1, familyId: 1 });
refreshSessionSchema.index({ familyId: 1, status: 1 });

module.exports = mongoose.model('RefreshSession', refreshSessionSchema);
