const { OAuth2Client } = require('google-auth-library');
const { Errors } = require('../../domain/errors');
const { SOCIAL_PROVIDERS, normalizeSocialProfile } = require('../../domain/oauth');

function createGoogleOAuthProvider({ clientId }) {
  if (!clientId) {
    return {
      async verifyToken() {
        throw Errors.serviceUnavailable('Google OAuth is not configured.');
      },
    };
  }

  const client = new OAuth2Client(clientId);

  return {
    async verifyToken(token) {
      let ticket;
      try {
        ticket = await client.verifyIdToken({ idToken: token, audience: clientId });
      } catch (error) {
        throw Errors.unauthorized('Invalid Google ID token.');
      }

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email || payload.email_verified === false) {
        throw Errors.unauthorized('Google account email is not verified.');
      }

      return normalizeSocialProfile({
        provider: SOCIAL_PROVIDERS.GOOGLE,
        providerId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        avatarUrl: payload.picture,
      });
    },
  };
}

module.exports = { createGoogleOAuthProvider };
