const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createAuthUseCases } = require('../src/application/auth/authUseCases');

function createFakeUserRepo() {
  const users = [];
  let nextId = 1;

  return {
    users,
    create({ name, email, avatar }) {
      const id = String(nextId++);
      const user = {
        _id: { toString: () => id },
        name,
        email,
        avatar: avatar || '',
        isOnline: false,
      };
      users.push(user);
      return Promise.resolve(user);
    },
    findByEmail(email) {
      return Promise.resolve(users.find((user) => user.email === email) || null);
    },
    findById(id) {
      return Promise.resolve(users.find((user) => user._id.toString() === String(id)) || null);
    },
    updateSocialProfile(id, { name, avatarUrl }) {
      const user = users.find((item) => item._id.toString() === String(id));
      if (!user) return Promise.resolve(null);
      user.name = name;
      user.avatar = avatarUrl;
      user.isOnline = true;
      return Promise.resolve(user);
    },
  };
}

function createFakeSocialAccountRepo() {
  const accounts = [];

  return {
    accounts,
    findByProvider(provider, providerId) {
      return Promise.resolve(accounts.find((account) => account.provider === provider && account.providerId === providerId) || null);
    },
    create(account) {
      accounts.push(account);
      return Promise.resolve(account);
    },
  };
}

function createMemoryCache() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.get(key) ?? null;
    },
    async setWithTTL(key, value) {
      store.set(key, value);
      return true;
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
    async delByPattern(pattern) {
      const prefix = pattern.replace(/\*$/, '');
      let count = 0;
      for (const key of [...store.keys()]) {
        if (key.startsWith(prefix)) {
          store.delete(key);
          count += 1;
        }
      }
      return count;
    },
  };
}

function createUseCases(profile) {
  const userRepo = createFakeUserRepo();
  const userSocialAccountRepo = createFakeSocialAccountRepo();
  const cacheManager = createMemoryCache();
  const auth = createAuthUseCases({
    userRepo,
    userSocialAccountRepo,
    passwordHasher: {},
    tokenService: {
      issueTokenPair(user) {
        return {
          accessToken: `access-${user._id}`,
          accessTokenHash: `access-hash-${user._id}`,
          accessTokenExpiresAt: new Date(Date.now() + 60000),
          refreshToken: `refresh-${user._id}`,
          refreshTokenHash: `refresh-hash-${user._id}`,
          refreshTokenExpiresAt: new Date(Date.now() + 60000),
          familyId: `family-${user._id}`,
          expiresIn: 60,
        };
      },
      hashToken: (token) => `hash-${token}`,
    },
    cacheManager,
    unitOfWork: { run: (work) => work(null) },
    refreshSessionRepo: {
      create: async () => ({}),
      enforceActiveFamilyLimit: async () => ({ sessions: [], familyIds: [] }),
    },
    realtime: { disconnectSession: async () => {}, disconnectUser: async () => {} },
    oauthProviderFactory: {
      get(provider) {
        assert.equal(provider, profile.provider);
        return { verifyToken: async () => profile };
      },
    },
  });

  return { auth, userRepo, userSocialAccountRepo, cacheManager };
}

describe('SocialLoginUseCase', () => {
  it('auto-registers a new user and links the social account', async () => {
    const { auth, userRepo, userSocialAccountRepo } = createUseCases({
      provider: 'google',
      providerId: 'google-user-1',
      email: 'ALICE@Example.COM',
      name: 'Alice OAuth',
      avatarUrl: 'https://lh3.googleusercontent.com/a/avatar',
    });

    const result = await auth.socialLogin({ provider: 'google', token: 'id-token' });

    assert.equal(result.user.email, 'alice@example.com');
    assert.equal(result.user.name, 'Alice OAuth');
    assert.equal(result.user.avatar, 'https://lh3.googleusercontent.com/a/avatar');
    assert.equal(result.user.isOnline, true);
    assert.equal(result.token, result.accessToken);
    assert.ok(result.refreshToken);
    assert.equal(userRepo.users.length, 1);
    assert.equal(userSocialAccountRepo.accounts.length, 1);
    assert.equal(userSocialAccountRepo.accounts[0].providerId, 'google-user-1');
  });

  it('reuses an existing social account instead of creating another user', async () => {
    const { auth, userRepo, userSocialAccountRepo } = createUseCases({
      provider: 'google',
      providerId: 'google-user-2',
      email: 'bob@example.com',
      name: 'Bob Updated',
      avatarUrl: 'https://lh3.googleusercontent.com/a/bob',
    });
    const user = await userRepo.create({ name: 'Old Bob', email: 'bob@example.com' });
    await userSocialAccountRepo.create({ userId: user._id, provider: 'google', providerId: 'google-user-2' });

    const result = await auth.socialLogin({ provider: 'google', token: 'id-token' });

    assert.equal(result.user._id.toString(), user._id.toString());
    assert.equal(result.user.name, 'Bob Updated');
    assert.equal(userRepo.users.length, 1);
    assert.equal(userSocialAccountRepo.accounts.length, 1);
  });

  it('blacklists the current access token on logout', async () => {
    const userRepo = createFakeUserRepo();
    const user = await userRepo.create({ name: 'Alice', email: 'alice@example.com' });
    const cacheManager = createMemoryCache();
    const auth = createAuthUseCases({
      userRepo,
      userSocialAccountRepo: createFakeSocialAccountRepo(),
      passwordHasher: {},
      oauthProviderFactory: {},
      cacheManager,
      tokenService: {
        verify(token) {
          assert.equal(token, 'access-token');
          return { id: user._id.toString(), exp: Math.floor(Date.now() / 1000) + 60 };
        },
        decode(token) {
          assert.equal(token, 'access-token');
          return { id: user._id.toString(), exp: Math.floor(Date.now() / 1000) + 60 };
        },
        issueTokenPair() {
          throw new Error('not used');
        },
        hashToken(token) {
          return `hash-${token}`;
        },
      },
      unitOfWork: { run: (work) => work(null) },
      refreshSessionRepo: {},
      realtime: { disconnectSession: async () => {}, disconnectUser: async () => {} },
    });

    await auth.logout({ userId: user._id, accessToken: 'access-token' });

    await assert.rejects(() => auth.authenticateToken('access-token'), /Token has been revoked/);
  });
});
