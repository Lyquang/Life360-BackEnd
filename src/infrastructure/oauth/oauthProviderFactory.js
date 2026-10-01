const { Errors } = require('../../domain/errors');
const { SOCIAL_PROVIDERS } = require('../../domain/oauth');
const { createGoogleOAuthProvider } = require('./googleOAuthProvider');

function createOAuthProviderFactory({ config }) {
  const providers = {
    [SOCIAL_PROVIDERS.GOOGLE]: createGoogleOAuthProvider({ clientId: config.oauth.googleClientId }),
  };

  return {
    get(provider) {
      const adapter = providers[provider];
      if (!adapter) throw Errors.badRequest(`OAuth provider "${provider}" is not supported yet.`);
      return adapter;
    },
  };
}

module.exports = { createOAuthProviderFactory };
