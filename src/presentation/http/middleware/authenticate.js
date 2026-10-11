const { Errors } = require('../../../domain/errors');

function createAuthenticate(authUseCases) {
  return async function authenticate(req, res, next) {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        throw Errors.unauthorized('Access denied. No token provided.');
      }
      const authenticated = await authUseCases.authenticateToken(header.slice('Bearer '.length));
      req.user = authenticated.user;
      req.auth = authenticated.auth;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { createAuthenticate };
