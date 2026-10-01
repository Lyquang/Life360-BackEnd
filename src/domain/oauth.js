const { Errors } = require('./errors');

const SOCIAL_PROVIDERS = Object.freeze({
  GOOGLE: 'google',
  APPLE: 'apple',
  FACEBOOK: 'facebook',
});

const SUPPORTED_SOCIAL_PROVIDERS = Object.freeze(Object.values(SOCIAL_PROVIDERS));

/**
 * @typedef {'google' | 'apple' | 'facebook'} SocialProvider
 *
 * @typedef {Object} SocialUserProfile
 * @property {SocialProvider} provider
 * @property {string} providerId
 * @property {string} email
 * @property {string} name
 * @property {string=} avatarUrl
 *
 * @typedef {Object} IOAuthProvider
 * @property {(token: string) => Promise<SocialUserProfile>} verifyToken
 */

function normalizeSocialProfile(profile) {
  if (!profile || !SUPPORTED_SOCIAL_PROVIDERS.includes(profile.provider)) {
    throw Errors.unauthorized('Invalid social profile provider.');
  }
  if (!profile.providerId || !profile.email || !profile.name) {
    throw Errors.unauthorized('Incomplete social profile.');
  }

  return {
    provider: profile.provider,
    providerId: String(profile.providerId),
    email: String(profile.email).trim().toLowerCase(),
    name: String(profile.name).trim(),
    avatarUrl: profile.avatarUrl ? String(profile.avatarUrl).trim() : undefined,
  };
}

module.exports = { SOCIAL_PROVIDERS, SUPPORTED_SOCIAL_PROVIDERS, normalizeSocialProfile };
