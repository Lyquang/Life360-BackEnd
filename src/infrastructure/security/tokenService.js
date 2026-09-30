const jwt = require('jsonwebtoken');

function createTokenService({ secret, expiresIn }) {
  return {
    sign(user) {
      return jwt.sign({ id: user._id.toString(), email: user.email }, secret, { expiresIn });
    },
    /** @throws jsonwebtoken errors (TokenExpiredError, JsonWebTokenError) */
    verify(token) {
      return jwt.verify(token, secret, { algorithms: ['HS256'] });
    },
  };
}

module.exports = { createTokenService };
