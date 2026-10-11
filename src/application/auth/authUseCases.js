const { Errors } = require('../../domain/errors');
const { normalizeSocialProfile } = require('../../domain/oauth');
const {
  tokenHash,
  tokenBlacklistKey,
  userSessionKey,
  userSessionsPattern,
} = require('../../domain/cacheKeys');

function ttlFromPayload(payload, nowSeconds = Math.floor(Date.now() / 1000)) {
  return payload && payload.exp ? Math.max(0, payload.exp - nowSeconds) : 0;
}

async function authPayload(user, { tokenService, cacheManager }) {
  const tokens = tokenService.signAuthTokens(user);
  const refreshPayload = tokenService.decode(tokens.refreshToken);
  const refreshTtl = ttlFromPayload(refreshPayload);
  if (refreshTtl > 0) {
    await cacheManager.setWithTTL(
      userSessionKey(user._id.toString(), tokenHash(tokens.refreshToken)),
      {
        userId: user._id.toString(),
        email: user.email,
        createdAt: new Date().toISOString(),
      },
      refreshTtl
    );
  }
  return { user, ...tokens };
}

function createAuthUseCases({
  userRepo,
  userSocialAccountRepo,
  passwordHasher,
  tokenService,
  oauthProviderFactory,
  cacheManager,
}) {
  async function register({ name, email, password }) {
    if (await userRepo.existsByEmail(email)) throw Errors.conflict('Email already registered.');

    const passwordHash = await passwordHasher.hash(password);
    let user;
    try {
      user = await userRepo.create({ name, email, passwordHash });
    } catch (error) {
      if (error.code === 11000) throw Errors.conflict('Email already registered.');
      throw error;
    }
    return authPayload(user, { tokenService, cacheManager });
  }

  async function login({ email, password }) {
    const user = await userRepo.findByEmailWithPassword(email);
    if (!user || !user.password || !(await passwordHasher.compare(password, user.password))) {
      throw Errors.unauthorized('Invalid email or password.');
    }
    await userRepo.markOnline(user._id);
    user.isOnline = true;
    return authPayload(user, { tokenService, cacheManager });
  }

  async function socialLogin({ provider, token }) {
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
          user = await userRepo.create({
            name: profile.name,
            email: profile.email,
            avatar: profile.avatarUrl,
          });
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
    return authPayload(user, { tokenService, cacheManager });
  }

  async function getProfile(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw Errors.notFound('User not found.');
    return user;
  }

  /** Resolves a JWT to the current user or throws 401. */
  async function authenticateToken(token) {
    let payload;
    try {
      payload = tokenService.verify(token);
    } catch (error) {
      throw Errors.unauthorized(
        error.name === 'TokenExpiredError' ? 'Token has expired. Please login again.' : 'Invalid token.'
      );
    }
    if (await cacheManager.get(tokenBlacklistKey(tokenHash(token)))) {
      throw Errors.unauthorized('Token has been revoked. Please login again.');
    }
    const user = await userRepo.findById(payload.id);
    if (!user) throw Errors.unauthorized('Token is valid but user no longer exists.');
    return user;
  }

  async function logout({ userId, accessToken, refreshToken, allDevices = false }) {
    const payload = tokenService.decode(accessToken);
    const accessTtl = ttlFromPayload(payload);
    if (accessTtl > 0) {
      await cacheManager.setWithTTL(tokenBlacklistKey(tokenHash(accessToken)), { userId: userId.toString() }, accessTtl);
    }

    if (allDevices) {
      await cacheManager.delByPattern(userSessionsPattern(userId.toString()));
    } else if (refreshToken) {
      await cacheManager.del(userSessionKey(userId.toString(), tokenHash(refreshToken)));
    }

    return { loggedOut: true };
  }

  return { register, login, socialLogin, getProfile, authenticateToken, logout };
}

module.exports = { createAuthUseCases };
