const crypto = require('node:crypto');

const REFRESH_SESSION_STATUS = Object.freeze({
  ACTIVE: 'active',
  ROTATED: 'rotated',
  REVOKED: 'revoked',
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeTokenHashEquals(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function classifyRefreshSession(session, now = new Date()) {
  if (!session) return 'invalid';
  if (session.status === REFRESH_SESSION_STATUS.ROTATED) return 'reused';
  if (session.status === REFRESH_SESSION_STATUS.REVOKED) return 'revoked';
  if (session.status !== REFRESH_SESSION_STATUS.ACTIVE) return 'invalid';
  return new Date(session.expiresAt) <= now ? 'expired' : 'active';
}

module.exports = { REFRESH_SESSION_STATUS, hashToken, safeTokenHashEquals, classifyRefreshSession };
