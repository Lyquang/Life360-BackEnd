const { Errors } = require('../../../domain/errors');

function createAuthenticate(authUseCases) {
  return async function authenticate(req, res, next) {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        throw Errors.unauthorized('Access denied. No token provided.');
      }
      req.user = await authUseCases.authenticateToken(header.slice('Bearer '.length));
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { createAuthenticate };
