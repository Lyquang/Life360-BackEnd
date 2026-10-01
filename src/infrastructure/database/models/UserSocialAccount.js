const mongoose = require('mongoose');
const { SUPPORTED_SOCIAL_PROVIDERS } = require('../../../domain/oauth');

const userSocialAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: SUPPORTED_SOCIAL_PROVIDERS,
      required: true,
    },
    providerId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    collection: 'user_social_accounts',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

userSocialAccountSchema.index({ provider: 1, providerId: 1 }, { unique: true });
userSocialAccountSchema.index({ userId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('UserSocialAccount', userSocialAccountSchema);
