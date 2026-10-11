const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { hashToken, safeTokenHashEquals } = require('../../domain/refreshTokens');

function createTokenService({ secret, accessExpiresIn, refreshTtlDays }) {
  function signAccessToken(user, { familyId } = {}) {
    const claims = { id: user._id.toString(), email: user.email, type: 'access' };
    if (familyId) claims.familyId = familyId;
    const token = jwt.sign(claims, secret, { expiresIn: accessExpiresIn });
    const payload = jwt.decode(token);
    return {
      token,
      expiresIn: Math.max(0, payload.exp - Math.floor(Date.now() / 1000)),
      expiresAt: new Date(payload.exp * 1000),
    };
  }

  return {
    sign(user, options) {
      return signAccessToken(user, options).token;
    },
    issueTokenPair(user, { familyId = crypto.randomUUID() } = {}) {
      const access = signAccessToken(user, { familyId });
      const refreshToken = crypto.randomBytes(48).toString('base64url');
      const refreshTokenHash = hashToken(refreshToken);
      return {
        familyId,
        token: access.token,
        accessToken: access.token,
        accessTokenHash: hashToken(access.token),
        accessTokenExpiresAt: access.expiresAt,
        refreshToken,
        refreshTokenHash,
        refreshTokenExpiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
        expiresIn: access.expiresIn,
      };
    },
    /** @throws jsonwebtoken errors (TokenExpiredError, JsonWebTokenError) */
    verify(token) {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
      if (payload.type && payload.type !== 'access') throw new jwt.JsonWebTokenError('Invalid access token type.');
      return payload;
    },
    decode(token) {
      return jwt.decode(token);
    },
    hashToken,
    safeTokenHashEquals,
  };
}

module.exports = { createTokenService };
