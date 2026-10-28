const { Errors } = require('../../domain/errors');
const { normalizeSocialProfile } = require('../../domain/oauth');
const { classifyRefreshSession } = require('../../domain/refreshTokens');
const { tokenBlacklistKey, userSessionKey, userSessionsPattern } = require('../../domain/cacheKeys');

function ttlFromDate(date, nowMs = Date.now()) {
  return date ? Math.max(0, Math.ceil((new Date(date).getTime() - nowMs) / 1000)) : 0;
}

function ttlFromPayload(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
  return payload && payload.exp ? Math.max(0, payload.exp - nowSeconds) : 0;
}

function publicTokenPair(pair) {
  return {
    token: pair.accessToken,
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    expiresIn: pair.expiresIn,
  };
}

function createAuthUseCases({
  userRepo,
  userSocialAccountRepo,
  refreshSessionRepo,
  passwordHasher,
  tokenService,
  oauthProviderFactory,
  cacheManager,
  unitOfWork,
  realtime,
  authMaxActiveSessions = 10,
  logger = console,
}) {
  async function cacheRefreshSession(user, pair, deviceInfo) {
    await cacheManager.setWithTTL(
      userSessionKey(user._id.toString(), pair.refreshTokenHash),
      {
        userId: user._id.toString(),
        familyId: pair.familyId,
        deviceName: deviceInfo?.name || null,
        createdAt: new Date().toISOString(),
      },
      ttlFromDate(pair.refreshTokenExpiresAt)
    );
  }

  async function blacklistAccessTokenHash(hash, expiresAt, context) {
    const ttl = ttlFromDate(expiresAt);
    if (!hash || ttl <= 0) return;
    const stored = await cacheManager.setWithTTL(tokenBlacklistKey(hash), context, ttl);
    if (!stored) logger.warn('AUTH_BLACKLIST_UNAVAILABLE');
  }

  async function applyRevocationEffects(sessions, familyIds, userId) {
    const uniqueSessions = [...new Map(sessions.map((item) => [String(item._id), item])).values()];
    await Promise.all(
      uniqueSessions.map((item) =>
        blacklistAccessTokenHash(item.accessTokenHash, item.accessTokenExpiresAt, {
          userId: String(item.userId || userId),
          familyId: item.familyId,
        })
      )
    );
    await Promise.all([...new Set(familyIds.filter(Boolean))].map((familyId) => realtime.disconnectSession(familyId)));
  }

  async function issueSession(user, deviceInfo = {}) {
    const now = new Date();
    const outcome = await unitOfWork.run(async (session) => {
      const pair = tokenService.issueTokenPair(user);
      await refreshSessionRepo.create(
        {
          userId: user._id,
          familyId: pair.familyId,
          tokenHash: pair.refreshTokenHash,
          expiresAt: pair.refreshTokenExpiresAt,
          deviceInfo,
          accessTokenHash: pair.accessTokenHash,
          accessTokenExpiresAt: pair.accessTokenExpiresAt,
        },
        { session }
      );
      const evicted = await refreshSessionRepo.enforceActiveFamilyLimit(
        user._id,
        authMaxActiveSessions,
        { at: now },
        { session }
      );
      return { pair, evicted };
    });

    await cacheRefreshSession(user, outcome.pair, deviceInfo);
    await applyRevocationEffects(outcome.evicted.sessions, outcome.evicted.familyIds, user._id);
    return { user, ...publicTokenPair(outcome.pair) };
  }

  async function register({ name, email, password, deviceName }, requestContext = {}) {
    if (await userRepo.existsByEmail(email)) throw Errors.conflict('Email already registered.');
    const passwordHash = await passwordHasher.hash(password);
    let user;
    try {
      user = await userRepo.create({ name, email, passwordHash });
    } catch (error) {
      if (error.code === 11000) throw Errors.conflict('Email already registered.');
      throw error;
    }
    return issueSession(user, { ...requestContext, name: deviceName || null });
  }

  async function login({ email, password, deviceName }, requestContext = {}) {
    const user = await userRepo.findByEmailWithPassword(email);
    if (!user || !user.password || !(await passwordHasher.compare(password, user.password))) {
      throw Errors.unauthorized('Invalid email or password.');
    }
    await userRepo.markOnline(user._id);
    user.isOnline = true;
    return issueSession(user, { ...requestContext, name: deviceName || null });
  }

  async function socialLogin({ provider, token, deviceName }, requestContext = {}) {
    const oauthProvider = oauthProviderFactory.get(provider);
    const profile = normalizeSocialProfile(await oauthProvider.verifyToken(token));
    let user;
    const socialAccount = await userSocialAccountRepo.findByProvider(profile.provider, profile.providerId);
    if (socialAccount) {
      user = await userRepo.findById(socialAccount.userId);
      if (!user) throw Errors.unauthorized('Linked social account no longer has a user.');
    } else {
      user = await userRepo.findByEmail(profile.email);
      if (!user) {
        try {
          user = await userRepo.create({ name: profile.name, email: profile.email, avatar: profile.avatarUrl });
        } catch (error) {
          if (error.code !== 11000) throw error;
          user = await userRepo.findByEmail(profile.email);
        }
      }
      try {
        await userSocialAccountRepo.create({
          userId: user._id,
          provider: profile.provider,
          providerId: profile.providerId,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }

    user = await userRepo.updateSocialProfile(user._id, { name: profile.name, avatarUrl: profile.avatarUrl });
    return issueSession(user, { ...requestContext, name: deviceName || null });
  }

  async function refresh({ refreshToken }, requestContext = {}) {
    const submittedHash = tokenService.hashToken(refreshToken);
    const now = new Date();
    const outcome = await unitOfWork.run(async (session) => {
      const current = await refreshSessionRepo.findByTokenHash(submittedHash, { session });
      if (!current || !tokenService.safeTokenHashEquals(submittedHash, current.tokenHash)) return { kind: 'invalid' };

      const state = classifyRefreshSession(current, now);
      if (state === 'reused' || state === 'revoked') {
        const revoked = await refreshSessionRepo.revokeFamily(
          current.userId,
          current.familyId,
          { reason: 'refresh_token_reused', at: now },
          { session }
        );
        return { kind: 'reused', current, revoked };
      }
      if (state !== 'active') return { kind: 'invalid' };

      const user = await userRepo.findById(current.userId);
      if (!user) return { kind: 'invalid' };
      const pair = tokenService.issueTokenPair(user, { familyId: current.familyId });
      const rotated = await refreshSessionRepo.markRotated(
        current._id,
        { replacedByTokenHash: pair.refreshTokenHash, at: now },
        { session }
      );
      if (rotated.modifiedCount !== 1) return { kind: 'retry' };
      const rotatedDeviceInfo = {
        userAgent: requestContext.userAgent || current.deviceInfo?.userAgent || null,
        ip: requestContext.ip || current.deviceInfo?.ip || null,
        name: current.deviceInfo?.name || null,
      };
      await refreshSessionRepo.create(
        {
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: pair.refreshTokenHash,
          expiresAt: pair.refreshTokenExpiresAt,
          deviceInfo: rotatedDeviceInfo,
          accessTokenHash: pair.accessTokenHash,
          accessTokenExpiresAt: pair.accessTokenExpiresAt,
        },
        { session }
      );
      return { kind: 'success', user, pair, deviceInfo: rotatedDeviceInfo, oldTokenHash: current.tokenHash };
    });

    if (outcome.kind === 'reused') {
      await applyRevocationEffects(outcome.revoked, [outcome.current.familyId], outcome.current.userId);
      logger.warn('AUTH_REFRESH_TOKEN_REUSED');
      throw Errors.refreshTokenReused();
    }
    if (outcome.kind !== 'success') throw Errors.invalidRefreshToken();

    await cacheManager.del(userSessionKey(outcome.user._id.toString(), outcome.oldTokenHash));
    await cacheRefreshSession(outcome.user, outcome.pair, outcome.deviceInfo);
    return publicTokenPair(outcome.pair);
  }

  async function getProfile(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw Errors.notFound('User not found.');
    return user;
  }

  async function authenticateToken(token) {
    let payload;
    try {
      payload = tokenService.verify(token);
    } catch (error) {
      throw Errors.unauthorized(
        error.name === 'TokenExpiredError' ? 'Token has expired. Please refresh your session.' : 'Invalid token.'
      );
    }
    if (await cacheManager.get(tokenBlacklistKey(tokenService.hashToken(token)))) {
      throw Errors.unauthorized('Token has been revoked. Please login again.');
    }
    const user = await userRepo.findById(payload.id);
    if (!user) throw Errors.unauthorized('Token is valid but user no longer exists.');
    return { user, auth: { familyId: payload.familyId || null, payload } };
  }

  async function blacklistCurrentAccessToken(userId, accessToken) {
    const payload = tokenService.decode(accessToken);
    const ttl = ttlFromPayload(payload);
    if (ttl <= 0) return;
    const stored = await cacheManager.setWithTTL(
      tokenBlacklistKey(tokenService.hashToken(accessToken)),
      { userId: userId.toString(), familyId: payload?.familyId || null },
      ttl
    );
    if (!stored) logger.warn('AUTH_BLACKLIST_UNAVAILABLE');
  }

  async function logout({ userId, accessToken, refreshToken, allDevices = false }) {
    await blacklistCurrentAccessToken(userId, accessToken);
    if (allDevices) return logoutAll({ userId });

    let revoked = [];
    let familyId = null;
    if (refreshToken) {
      const submittedHash = tokenService.hashToken(refreshToken);
      const now = new Date();
      const outcome = await unitOfWork.run(async (session) => {
        const current = await refreshSessionRepo.findByTokenHash(submittedHash, { session });
        if (!current || String(current.userId) !== String(userId)) return { sessions: [], familyId: null };
        const sessions = await refreshSessionRepo.revokeFamily(
          userId,
          current.familyId,
          { reason: 'logout', at: now },
          { session }
        );
        return { sessions, familyId: current.familyId };
      });
      revoked = outcome.sessions;
      familyId = outcome.familyId;
      await cacheManager.del(userSessionKey(userId.toString(), submittedHash));
    }
    await applyRevocationEffects(revoked, [familyId], userId);
    return { loggedOut: true };
  }

  async function logoutAll({ userId }) {
    const now = new Date();
    const revoked = await unitOfWork.run((session) =>
      refreshSessionRepo.revokeAllForUser(userId, { reason: 'logout_all', at: now }, { session })
    );
    await cacheManager.delByPattern(userSessionsPattern(userId.toString()));
    await applyRevocationEffects(revoked, revoked.map((item) => item.familyId), userId);
    await realtime.disconnectUser(userId.toString());
    return { loggedOut: true, allDevices: true };
  }

  async function changePassword({ userId, currentPassword, newPassword, accessToken }) {
    const user = await userRepo.findByIdWithPassword(userId);
    if (!user || !user.password || !(await passwordHasher.compare(currentPassword, user.password))) {
      throw Errors.unauthorized('Current password is incorrect.');
    }
    const passwordHash = await passwordHasher.hash(newPassword);
    const now = new Date();
    const revoked = await unitOfWork.run(async (session) => {
      await userRepo.updatePassword(userId, passwordHash, { session });
      return refreshSessionRepo.revokeAllForUser(
        userId,
        { reason: 'password_changed', at: now },
        { session }
      );
    });
    await blacklistCurrentAccessToken(userId, accessToken);
    await cacheManager.delByPattern(userSessionsPattern(userId.toString()));
    await applyRevocationEffects(revoked, revoked.map((item) => item.familyId), userId);
    await realtime.disconnectUser(userId.toString());
    return { passwordChanged: true, requiresLogin: true };
  }

  return { register, login, socialLogin, refresh, getProfile, authenticateToken, logout, logoutAll, changePassword };
}

module.exports = { createAuthUseCases };
