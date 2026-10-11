const crypto = require('crypto');

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function userProfileKey(userId) {
  return `user:profile:${userId}`;
}

function circleMembersKey(circleId) {
  return `circle:members:${circleId}`;
}

function tokenBlacklistKey(hash) {
  return `auth:blacklist:${hash}`;
}

function userSessionKey(userId, sessionId) {
  return `user:session:${userId}:${sessionId}`;
}

function userSessionsPattern(userId) {
  return `user:session:${userId}:*`;
}

function lastLocationKey(userId) {
  return `location:last:${userId}`;
}

function mediaMetadataKey(mediaKey) {
  return `media:metadata:${mediaKey}`;
}

module.exports = {
  tokenHash,
  userProfileKey,
  circleMembersKey,
  tokenBlacklistKey,
  userSessionKey,
  userSessionsPattern,
  lastLocationKey,
  mediaMetadataKey,
};
