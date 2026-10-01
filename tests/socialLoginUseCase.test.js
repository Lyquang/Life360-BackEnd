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

function createUseCases(profile) {
  const userRepo = createFakeUserRepo();
  const userSocialAccountRepo = createFakeSocialAccountRepo();
  const auth = createAuthUseCases({
    userRepo,
    userSocialAccountRepo,
    passwordHasher: {},
    tokenService: {
      signAuthTokens(user) {
        return {
          token: `access-${user._id}`,
          accessToken: `access-${user._id}`,
          refreshToken: `refresh-${user._id}`,
        };
      },
    },
    oauthProviderFactory: {
      get(provider) {
        assert.equal(provider, profile.provider);
        return { verifyToken: async () => profile };
      },
    },
  });

  return { auth, userRepo, userSocialAccountRepo };
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
});
