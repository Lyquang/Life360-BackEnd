const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startTestServer, waitForEvent } = require('./helpers/testServer');
const RefreshSession = require('../src/infrastructure/database/models/RefreshSession');
const { hashToken } = require('../src/domain/refreshTokens');
const { loadConfig, ConfigError } = require('../src/config/env');

describe('refresh token rotation', { timeout: 120000 }, () => {
  let t;

  before(async () => {
    t = await startTestServer();
  });

  after(() => t.stop());

  it('returns an access token, opaque refresh token, compatibility alias, and expiry', async () => {
    const res = await t.api('POST', '/api/v1/auth/register', {
      body: {
        name: 'Token Pair',
        email: 'token-pair@test.local',
        password: 'secret123',
        deviceName: 'iPhone 16',
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.token, res.body.data.accessToken);
    assert.match(res.body.data.refreshToken, /^[A-Za-z0-9_-]{64}$/);
    assert.ok(res.body.data.expiresIn > 0);
    assert.equal(res.body.data.refreshToken.split('.').length, 1);
  });

  it('rotates once, detects reuse, and revokes the replacement token', async () => {
    const user = await t.registerUser('Rotate');
    const first = await t.api('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.notEqual(first.body.data.refreshToken, user.refreshToken);

    const reuse = await t.api('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });
    assert.equal(reuse.status, 401);
    assert.equal(reuse.body.code, 'REFRESH_TOKEN_REUSED');

    const replacement = await t.api('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: first.body.data.refreshToken },
    });
    assert.equal(replacement.status, 401);
    assert.equal(replacement.body.code, 'REFRESH_TOKEN_REUSED');
  });

  it('rejects unknown and expired refresh tokens without revealing details', async () => {
    const unknown = await t.api('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: 'A'.repeat(64) },
    });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.code, 'INVALID_REFRESH_TOKEN');

    const user = await t.registerUser('Expired');
    await RefreshSession.updateOne(
      { tokenHash: hashToken(user.refreshToken) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
    const expired = await t.api('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });
    assert.equal(expired.status, 401);
    assert.equal(expired.body.code, 'INVALID_REFRESH_TOKEN');
  });

  it('allows only one concurrent rotation and revokes the family on the duplicate request', async () => {
    const user = await t.registerUser('Concurrent');
    const [left, right] = await Promise.all([
      t.api('POST', '/api/v1/auth/refresh', { body: { refreshToken: user.refreshToken } }),
      t.api('POST', '/api/v1/auth/refresh', { body: { refreshToken: user.refreshToken } }),
    ]);
    const statuses = [left.status, right.status].sort();
    assert.deepEqual(statuses, [200, 401]);
    const failed = left.status === 401 ? left : right;
    const succeeded = left.status === 200 ? left : right;
    assert.equal(failed.body.code, 'REFRESH_TOKEN_REUSED');

    const afterRace = await t.api('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: succeeded.body.data.refreshToken },
    });
    assert.equal(afterRace.status, 401);
  });

  it('revokes the family on logout while remaining functional without Redis', async () => {
    assert.equal(t.instance.container.services.cacheManager.isHealthy(), false);
    const user = await t.registerUser('LogoutFamily');
    const logout = await t.api('POST', '/api/v1/auth/logout', {
      token: user.accessToken,
      body: { refreshToken: user.refreshToken },
    });
    assert.equal(logout.status, 200);

    const refresh = await t.api('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });
    assert.equal(refresh.status, 401);
  });

  it('logout-all revokes every family for the user', async () => {
    const email = 'logout-all@test.local';
    const registered = await t.api('POST', '/api/v1/auth/register', {
      body: { name: 'Logout All', email, password: 'secret123', deviceName: 'Phone' },
    });
    const second = await t.api('POST', '/api/v1/auth/login', {
      body: { email, password: 'secret123', deviceName: 'Tablet' },
    });
    const logout = await t.api('POST', '/api/v1/auth/logout-all', {
      token: registered.body.data.accessToken,
    });
    assert.equal(logout.status, 200);

    for (const refreshToken of [registered.body.data.refreshToken, second.body.data.refreshToken]) {
      const result = await t.api('POST', '/api/v1/auth/refresh', { body: { refreshToken } });
      assert.equal(result.status, 401);
    }
  });

  it('changing password revokes all sessions and accepts the new password', async () => {
    const email = 'password-change@test.local';
    const registered = await t.api('POST', '/api/v1/auth/register', {
      body: { name: 'Password Change', email, password: 'secret123' },
    });
    const changed = await t.api('POST', '/api/v1/auth/change-password', {
      token: registered.body.data.accessToken,
      body: { currentPassword: 'secret123', newPassword: 'newSecret456' },
    });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));

    const refresh = await t.api('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: registered.body.data.refreshToken },
    });
    assert.equal(refresh.status, 401);
    assert.equal((await t.api('POST', '/api/v1/auth/login', { body: { email, password: 'secret123' } })).status, 401);
    assert.equal((await t.api('POST', '/api/v1/auth/login', { body: { email, password: 'newSecret456' } })).status, 200);
  });

  it('disconnects the socket belonging to a logged-out family', async () => {
    const user = await t.registerUser('SocketRevoke');
    const socket = await t.connect(user.accessToken);
    const disconnected = waitForEvent(socket, 'disconnect');
    const logout = await t.api('POST', '/api/v1/auth/logout', {
      token: user.accessToken,
      body: { refreshToken: user.refreshToken },
    });
    assert.equal(logout.status, 200);
    await disconnected;
  });

  it('keeps at most ten active device families per user', async () => {
    const email = 'session-limit@test.local';
    const first = await t.api('POST', '/api/v1/auth/register', {
      body: { name: 'Session Limit', email, password: 'secret123', deviceName: 'Device 1' },
    });
    const tokens = [first.body.data.refreshToken];
    for (let index = 2; index <= 11; index += 1) {
      const login = await t.api('POST', '/api/v1/auth/login', {
        body: { email, password: 'secret123', deviceName: `Device ${index}` },
      });
      assert.equal(login.status, 200);
      tokens.push(login.body.data.refreshToken);
    }

    const oldest = await t.api('POST', '/api/v1/auth/refresh', { body: { refreshToken: tokens[0] } });
    assert.equal(oldest.status, 401);
    const newest = await t.api('POST', '/api/v1/auth/refresh', { body: { refreshToken: tokens.at(-1) } });
    assert.equal(newest.status, 200);
  });

  it('rejects the default JWT secret in production', () => {
    assert.throws(
      () =>
        loadConfig({
          NODE_ENV: 'production',
          MONGODB_URI: 'mongodb://localhost:27017/test',
          JWT_SECRET: 'change_me',
        }),
      ConfigError
    );
  });

  it('accepts legacy access JWTs without type or familyId until expiry', async () => {
    const user = await t.registerUser('LegacyAccess');
    const legacy = jwt.sign(
      { id: user.id, email: 'legacy@test.local' },
      t.config.jwt.secret,
      { expiresIn: '1h' }
    );
    const profile = await t.api('GET', '/api/v1/auth/me', { token: legacy });
    assert.equal(profile.status, 200);
    assert.equal(String(profile.body.data.id), user.id);
  });
});
