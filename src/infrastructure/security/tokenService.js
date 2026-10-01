const jwt = require('jsonwebtoken');

function createTokenService({ secret, expiresIn, refreshExpiresIn }) {
  function signAccessToken(user) {
    return jwt.sign({ id: user._id.toString(), email: user.email }, secret, { expiresIn });
  }

  function signRefreshToken(user) {
    return jwt.sign({ id: user._id.toString(), email: user.email, type: 'refresh' }, secret, {
      expiresIn: refreshExpiresIn,
    });
  }

  return {
    sign(user) {
      return signAccessToken(user);
    },
    signAuthTokens(user) {
      const accessToken = signAccessToken(user);
      return {
        token: accessToken,
        accessToken,
        refreshToken: signRefreshToken(user),
      };
    },
    /** @throws jsonwebtoken errors (TokenExpiredError, JsonWebTokenError) */
    verify(token) {
      return jwt.verify(token, secret, { algorithms: ['HS256'] });
    },
  };
}

module.exports = { createTokenService };
