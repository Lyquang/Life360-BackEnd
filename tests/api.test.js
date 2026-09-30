const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForEvent, sleep } = require('./helpers/testServer');

describe('REST API v1 (auth, circles, places, digests, history, location)', { timeout: 120000 }, () => {
  let t, alice, bob, carol, circle;

  before(async () => {
    t = await startTestServer();
    [alice, bob, carol] = await Promise.all(['Alice', 'Bob', 'Carol'].map(t.registerUser));
    circle = await t.createGroup(alice, 'Family');
    await t.joinGroup(bob, circle);
  });
  after(() => t.stop());

  describe('system', () => {
    it('serves health on /api/v1/health and /api/health', async () => {
      for (const path of ['/api/v1/health', '/api/health']) {
        const res = await t.api('GET', path);
        assert.equal(res.status, 200);
        assert.equal(res.body.mongodb, 'connected');
      }
    });

    it('documents socket events', async () => {
      const res = await t.api('GET', '/api/v1/socket-info');
      assert.ok(res.body.events.client_to_server['chat:send_message']);
      assert.ok(res.body.events.server_to_client['chat:read_receipt']);
    });

    it('no longer serves the unversioned routes', async () => {
      for (const [method, path] of [
        ['POST', '/api/auth/login'],
        ['GET', '/api/groups'],
        ['GET', `/api/history/${alice.id}`],
        ['GET', '/api/socket-info'],
        ['GET', '/api/messages/conversations'],
      ]) {
        const res = await t.api(method, path, { token: alice.token, body: method === 'POST' ? {} : undefined });
        assert.equal(res.status, 404, path);
      }
    });

    it('returns 400 for malformed JSON bodies', async () => {
      const res = await t.api('POST', '/api/v1/auth/login', { rawBody: '{"email":' });
      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Malformed JSON body.');
    });
  });

  describe('auth', () => {
    it('validates register input and normalizes email', async () => {
      const bad = await t.api('POST', '/api/v1/auth/register', { body: { name: 'A', email: 'nope', password: '1' } });
      assert.equal(bad.status, 400);
      assert.deepEqual(bad.body.errors.map((e) => e.field).sort(), ['body.email', 'body.name', 'body.password']);

      const ok = await t.api('POST', '/api/v1/auth/register', {
        body: { name: ' Zed ', email: '  ZED@Example.COM ', password: 'secret123' },
      });
      assert.equal(ok.status, 201);
      assert.equal(ok.body.data.user.email, 'zed@example.com');
      assert.equal(ok.body.data.user.name, 'Zed');
      assert.equal(ok.body.data.user.password, undefined);

      const dup = await t.api('POST', '/api/v1/auth/register', {
        body: { name: 'Zed', email: 'zed@example.com', password: 'secret123' },
      });
      assert.equal(dup.status, 409);
    });

    it('logs in, and rejects wrong credentials', async () => {
      const ok = await t.api('POST', '/api/v1/auth/login', { body: { email: 'ZED@example.com', password: 'secret123' } });
      assert.equal(ok.status, 200);
      assert.ok(ok.body.data.token);
      assert.equal(ok.body.data.user.isOnline, true);

      const wrong = await t.api('POST', '/api/v1/auth/login', { body: { email: 'zed@example.com', password: 'nope!!' } });
      assert.equal(wrong.status, 401);
      const unknown = await t.api('POST', '/api/v1/auth/login', { body: { email: 'who@example.com', password: 'x' } });
      assert.equal(unknown.status, 401);
    });

    it('protects /me', async () => {
      assert.equal((await t.api('GET', '/api/v1/auth/me', { token: alice.token })).body.data.name, 'Alice');
      assert.equal((await t.api('GET', '/api/v1/auth/me')).status, 401);
      assert.equal((await t.api('GET', '/api/v1/auth/me', { token: 'garbage' })).status, 401);
    });
  });

  describe('circles', () => {
    it('lists my circles with their conversationId', async () => {
      const res = await t.api('GET', '/api/v1/groups', { token: bob.token });
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].conversationId, circle.conversationId);
      assert.equal(res.body.data[0].members.length, 2);
    });

    it('returns members to members only', async () => {
      const ok = await t.api('GET', `/api/v1/groups/${circle.id}/members`, { token: bob.token });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.data.memberCount, 2);
      assert.equal(ok.body.data.conversationId, circle.conversationId);
      assert.equal((await t.api('GET', `/api/v1/groups/${circle.id}/members`, { token: carol.token })).status, 403);
      assert.equal((await t.api('GET', '/api/v1/groups/0123456789abcdef01234567/members', { token: carol.token })).status, 404);
      assert.equal((await t.api('GET', '/api/v1/groups/xyz/members', { token: carol.token })).status, 400);
    });

    it('validates the notification interval', async () => {
      const path = `/api/v1/groups/${circle.id}/notification-interval`;
      for (const intervalMinutes of [-1, 1441, 1.5, '60', null]) {
        const res = await t.api('PATCH', path, { token: bob.token, body: { intervalMinutes } });
        assert.equal(res.status, 400, String(intervalMinutes));
      }
      const ok = await t.api('PATCH', path, { token: bob.token, body: { intervalMinutes: 0 } });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.data.notificationIntervalMinutes, 0);
      assert.equal((await t.api('PATCH', path, { token: carol.token, body: { intervalMinutes: 5 } })).status, 403);
    });
  });

  describe('places', () => {
    it('adds and lists favorite places with validation', async () => {
      const path = `/api/v1/groups/${circle.id}/places`;
      const good = { name: 'Phở 24', category: 'restaurant', latitude: 10.7769, longitude: 106.7009 };
      for (const body of [{ ...good, category: 'bar' }, { ...good, latitude: 91 }, { ...good, longitude: '106' }, { ...good, name: '' }]) {
        assert.equal((await t.api('POST', path, { token: bob.token, body })).status, 400, JSON.stringify(body));
      }
      const created = await t.api('POST', path, { token: bob.token, body: good });
      assert.equal(created.status, 201);
      assert.equal(created.body.data.latitude, 10.7769);
      assert.equal(created.body.data.addedBy.name, 'Bob');

      const list = await t.api('GET', path, { token: alice.token });
      assert.equal(list.body.count, 1);
      assert.equal((await t.api('GET', path, { token: carol.token })).status, 403);
    });
  });

  describe('location over socket + history', () => {
    it('broadcasts location_update to the circle and records history', async () => {
      const a = await t.connect(alice.token);
      const b = await t.connect(bob.token);
      const update = waitForEvent(a, 'location_update');
      b.emit('update_location', { latitude: 10.776, longitude: 106.7, batteryLevel: 150 });
      const payload = await update;
      assert.equal(payload.userId, bob.id);
      assert.equal(payload.batteryLevel, 100, 'battery is clamped');
      assert.equal(payload.durationFormatted, '0 phút');

      const invalid = waitForEvent(b, 'error');
      b.emit('update_location', { latitude: 200, longitude: 0 });
      assert.equal((await invalid).message, 'Invalid location payload.');

      await sleep(100);
      const history = await t.api('GET', `/api/v1/history/${bob.id}`, { token: alice.token });
      assert.equal(history.status, 200);
      assert.equal(history.body.count, 1);
      assert.match(history.body.date, /^\d{4}-\d{2}-\d{2}$/);

      await t.disconnect(a, b);
    });

    it('enforces history access and validates params', async () => {
      assert.equal((await t.api('GET', `/api/v1/history/${bob.id}`, { token: carol.token })).status, 403);
      assert.equal((await t.api('GET', `/api/v1/history/${carol.id}`, { token: carol.token })).status, 200);
      assert.equal((await t.api('GET', '/api/v1/history/abc', { token: carol.token })).status, 400);

      const journey = await t.api('GET', `/api/v1/history/${bob.id}/journey`, { token: alice.token });
      assert.equal(journey.status, 200);
      assert.equal(journey.body.userId, bob.id);
      assert.equal(journey.body.summary.totalPoints, 1);

      for (const date of ['2026-13-01', '2026-02-30', '30-09-2026']) {
        assert.equal((await t.api('GET', `/api/v1/history/${bob.id}/journey?date=${date}`, { token: alice.token })).status, 400, date);
      }
      const past = await t.api('GET', `/api/v1/history/${bob.id}/journey?date=2020-01-01`, { token: alice.token });
      assert.equal(past.body.date, '2020-01-01');
      assert.deepEqual(past.body.journey, []);
    });

    it('sos_alert reaches the circle and confirms to the sender', async () => {
      const a = await t.connect(alice.token);
      const b = await t.connect(bob.token);
      const alert = waitForEvent(a, 'sos_alert');
      const confirmed = waitForEvent(b, 'sos_confirmed');
      b.emit('sos_alert', { message: 'Help' });
      assert.equal((await alert).message, 'Help');
      assert.equal((await confirmed).groupCount, 1);
      await t.disconnect(a, b);
    });
  });

  describe('digests', () => {
    it('sends due digests to connected circles and exposes them over REST', async () => {
      await t.api('PATCH', `/api/v1/groups/${circle.id}/notification-interval`, {
        token: alice.token,
        body: { intervalMinutes: 60 },
      });
      const a = await t.connect(alice.token);
      const digest = waitForEvent(a, 'group_digest');

      const sent = await t.instance.container.useCases.digests.sendDueDigests();
      assert.equal(sent, 1);
      const payload = await digest;
      assert.equal(payload.groupId, circle.id);
      assert.equal(payload.members.length, 2);

      // Not due again within the interval.
      assert.equal(await t.instance.container.useCases.digests.sendDueDigests(), 0);

      const list = await t.api('GET', `/api/v1/groups/${circle.id}/digests?limit=10`, { token: bob.token });
      assert.equal(list.status, 200);
      assert.equal(list.body.pagination.totalItems, 1);
      const latest = await t.api('GET', `/api/v1/groups/${circle.id}/digests/latest`, { token: bob.token });
      assert.equal(latest.body.data.groupName, 'Family');

      for (const q of ['limit=101', 'page=0', 'from=notadate']) {
        assert.equal((await t.api('GET', `/api/v1/groups/${circle.id}/digests?${q}`, { token: bob.token })).status, 400, q);
      }
      assert.equal((await t.api('GET', `/api/v1/groups/${circle.id}/digests`, { token: carol.token })).status, 403);
      await t.disconnect(a);
    });
  });
});
