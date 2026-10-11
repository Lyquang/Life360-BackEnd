const RefreshSession = require('../database/models/RefreshSession');
const { REFRESH_SESSION_STATUS } = require('../../domain/refreshTokens');

function withSession(query, session) {
  return session ? query.session(session) : query;
}

module.exports = {
  create(input, { session } = {}) {
    return RefreshSession.create([input], { session }).then(([created]) => created);
  },

  findByTokenHash(tokenHash, { session } = {}) {
    return withSession(RefreshSession.findOne({ tokenHash }), session);
  },

  markRotated(id, { replacedByTokenHash, at }, { session } = {}) {
    return withSession(
      RefreshSession.updateOne(
        { _id: id, status: REFRESH_SESSION_STATUS.ACTIVE },
        {
          $set: {
            status: REFRESH_SESSION_STATUS.ROTATED,
            rotatedAt: at,
            lastUsedAt: at,
            replacedByTokenHash,
          },
        }
      ),
      session
    );
  },

  async revokeFamily(userId, familyId, { reason, at }, { session } = {}) {
    const filter = { userId, familyId };
    const sessions = await withSession(RefreshSession.find(filter).lean(), session);
    await withSession(
      RefreshSession.updateMany(filter, {
        $set: { status: REFRESH_SESSION_STATUS.REVOKED, revokedAt: at, revokeReason: reason },
      }),
      session
    );
    return sessions;
  },

  async revokeAllForUser(userId, { reason, at }, { session } = {}) {
    const filter = { userId };
    const sessions = await withSession(RefreshSession.find(filter).lean(), session);
    await withSession(
      RefreshSession.updateMany(filter, {
        $set: { status: REFRESH_SESSION_STATUS.REVOKED, revokedAt: at, revokeReason: reason },
      }),
      session
    );
    return sessions;
  },

  async enforceActiveFamilyLimit(userId, maxFamilies, { at }, { session } = {}) {
    const excess = await withSession(
      RefreshSession.find({ userId, status: REFRESH_SESSION_STATUS.ACTIVE })
        .sort({ createdAt: -1 })
        .skip(maxFamilies)
        .lean(),
      session
    );
    const familyIds = [...new Set(excess.map((item) => item.familyId))];
    const revokedSessions = [];
    for (const familyId of familyIds) {
      const revoked = await this.revokeFamily(
        userId,
        familyId,
        { reason: 'session_limit_exceeded', at },
        { session }
      );
      revokedSessions.push(...revoked);
    }
    return { familyIds, sessions: revokedSessions };
  },
};
