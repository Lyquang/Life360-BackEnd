const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startTestServer, expectNoEvent } = require('./helpers/testServer');
const LocationHistory = require('../src/infrastructure/database/models/LocationHistory');
const User = require('../src/infrastructure/database/models/User');

function point(overrides = {}) {
  return {
    pointId: randomUUID(),
    latitude: 10.7769,
    longitude: 106.7009,
    recordedAt: new Date(Date.now() - 60_000).toISOString(),
    accuracy: 8.5,
    batteryLevel: 80,
    ...overrides,
  };
}

describe('POST /api/v1/locations/batch', { timeout: 120000 }, () => {
  let t;
  let user;

  before(async () => {
    t = await startTestServer();
    user = await t.registerUser('BatchLocation');
  });

  after(() => t.stop());

  it('persists valid points in recordedAt order and returns accepted IDs', async () => {
    const older = point({ recordedAt: new Date(Date.now() - 120_000).toISOString() });
    const newer = point({ recordedAt: new Date(Date.now() - 60_000).toISOString(), accuracy: 4.2 });
    const response = await t.api('POST', '/api/v1/locations/batch', {
      token: user.token,
      body: { points: [newer, older] },
    });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.data.accepted, [older.pointId, newer.pointId]);
    assert.deepEqual(response.body.data.duplicates, []);
    assert.deepEqual(response.body.data.rejected, []);

    const history = await LocationHistory.find({ userId: user.id }).sort({ timestamp: 1 }).lean();
    assert.deepEqual(history.map((entry) => entry.pointId), [older.pointId, newer.pointId]);
    assert.equal(history[1].accuracy, 4.2);
  });

  it('is idempotent across retries and within the same request', async () => {
    const existing = point();
    let response = await t.api('POST', '/api/v1/locations/batch', {
      token: user.token,
      body: { points: [existing] },
    });
    assert.deepEqual(response.body.data.accepted, [existing.pointId]);

    response = await t.api('POST', '/api/v1/locations/batch', {
      token: user.token,
      body: { points: [existing, existing] },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.accepted, []);
    assert.deepEqual(response.body.data.duplicates, [existing.pointId, existing.pointId]);
    assert.equal(await LocationHistory.countDocuments({ userId: user.id, pointId: existing.pointId }), 1);
  });

  it('deduplicates the same measured fix even when pointId changes', async () => {
    const first = point({ motionState: 'walking' });
    const sameFix = { ...first, pointId: randomUUID() };
    const response = await t.api('POST', '/api/v1/locations/batch', {
      token: user.token,
      body: { points: [first, sameFix] },
    });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.accepted.length, 1);
    assert.equal(response.body.data.duplicates.length, 1);
    assert.equal(
      await LocationHistory.countDocuments({
        userId: user.id,
        timestamp: new Date(first.recordedAt),
      }),
      1
    );
    const stored = await LocationHistory.findOne({
      userId: user.id,
      timestamp: new Date(first.recordedAt),
    }).lean();
    assert.equal(stored.motionState, 'walking');
  });

  it('keeps one history row when two retries arrive concurrently', async () => {
    const retried = point();
    const [first, second] = await Promise.all([
      t.api('POST', '/api/v1/locations/batch', { token: user.token, body: { points: [retried] } }),
      t.api('POST', '/api/v1/locations/batch', { token: user.token, body: { points: [retried] } }),
    ]);

    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(await LocationHistory.countDocuments({ userId: user.id, pointId: retried.pointId }), 1);
    assert.deepEqual(
      [first.body.data.accepted.length, second.body.data.accepted.length].sort(),
      [0, 1]
    );
  });

  it('accepts good points while reporting invalid and out-of-range points', async () => {
    const valid = point();
    const invalidAccuracy = point({ accuracy: -1 });
    const invalidMotion = point({ motionState: 'flying' });
    const tooOld = point({ recordedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() });
    const future = point({ recordedAt: new Date(Date.now() + 2 * 60 * 1000).toISOString() });
    const response = await t.api('POST', '/api/v1/locations/batch', {
      token: user.token,
      body: { points: [invalidAccuracy, valid, tooOld, future, invalidMotion] },
    });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.data.accepted, [valid.pointId]);
    assert.deepEqual(
      response.body.data.rejected.map(({ index, pointId, code }) => ({ index, pointId, code })),
      [
        { index: 0, pointId: invalidAccuracy.pointId, code: 'INVALID_ACCURACY' },
        { index: 2, pointId: tooOld.pointId, code: 'RECORDED_AT_TOO_OLD' },
        { index: 3, pointId: future.pointId, code: 'RECORDED_AT_IN_FUTURE' },
        { index: 4, pointId: invalidMotion.pointId, code: 'INVALID_MOTION_STATE' },
      ]
    );
  });

  it('does not overwrite a newer lastKnownLocation and never broadcasts batch points', async () => {
    const owner = await t.registerUser('BatchViewer');
    const group = await t.createGroup(owner, 'Batch No Broadcast');
    await t.joinGroup(user, group);
    const viewer = await t.connect(owner.token);

    const noLocation = expectNoEvent(viewer, 'location_update');
    const noStayAlert = expectNoEvent(viewer, 'location_stay_alert');
    const currentAt = new Date(Date.now() - 1_000);
    const fresh = point({ latitude: 10.8, longitude: 106.8, recordedAt: currentAt.toISOString() });
    let response = await t.api('POST', '/api/v1/locations/batch', {
      token: user.token,
      body: { points: [fresh] },
    });

    assert.equal(response.status, 200);
    await Promise.all([noLocation, noStayAlert]);
    let storedUser = await User.findById(user.id).lean();
    assert.deepEqual(storedUser.lastKnownLocation.coordinates, [106.8, 10.8]);
    assert.equal(storedUser.lastKnownLocation.updatedAt.toISOString(), currentAt.toISOString());

    const older = point({ latitude: 11, longitude: 107, recordedAt: new Date(currentAt - 60_000).toISOString() });
    response = await t.api('POST', '/api/v1/locations/batch', {
      token: user.token,
      body: { points: [older] },
    });
    assert.equal(response.status, 200);
    storedUser = await User.findById(user.id).lean();
    assert.deepEqual(storedUser.lastKnownLocation.coordinates, [106.8, 10.8]);
    assert.equal(storedUser.lastKnownLocation.updatedAt.toISOString(), currentAt.toISOString());
    await t.disconnect(viewer);
  });

  it('uses only the authenticated user ID and requires authentication', async () => {
    const other = await t.registerUser('BatchOther');
    const injected = point({ userId: other.id });
    const response = await t.api('POST', '/api/v1/locations/batch', {
      token: user.token,
      body: { points: [injected] },
    });
    assert.equal(response.status, 200);
    assert.equal(await LocationHistory.countDocuments({ userId: user.id, pointId: injected.pointId }), 1);
    assert.equal(await LocationHistory.countDocuments({ userId: other.id, pointId: injected.pointId }), 0);

    const unauthorized = await t.api('POST', '/api/v1/locations/batch', { body: { points: [point()] } });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.body.code, 'UNAUTHORIZED');
  });

  it('rejects batches over 100 points and bodies over 100 KB', async () => {
    const overLimit = await t.api('POST', '/api/v1/locations/batch', {
      token: user.token,
      body: { points: Array.from({ length: 101 }, () => point()) },
    });
    assert.equal(overLimit.status, 400);
    assert.equal(overLimit.body.code, 'BATCH_LIMIT_EXCEEDED');

    const oversized = await t.api('POST', '/api/v1/locations/batch', {
      token: user.token,
      rawBody: JSON.stringify({ points: [], padding: 'x'.repeat(101 * 1024) }),
    });
    assert.equal(oversized.status, 413);
    assert.equal(oversized.body.code, 'PAYLOAD_TOO_LARGE');
  });
});

describe('location batch rate limit', { timeout: 120000 }, () => {
  let t;

  before(async () => {
    t = await startTestServer({ env: { LOCATION_BATCH_RATE_LIMIT: '1' } });
  });

  after(() => t.stop());

  it('limits requests per authenticated user and sends Retry-After', async () => {
    const user = await t.registerUser('BatchRateLimit');
    const first = await fetch(`${t.baseUrl}/api/v1/locations/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      body: JSON.stringify({ points: [point()] }),
    });
    assert.equal(first.status, 200);

    const second = await fetch(`${t.baseUrl}/api/v1/locations/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      body: JSON.stringify({ points: [point()] }),
    });
    assert.equal(second.status, 429);
    assert.ok(Number(second.headers.get('retry-after')) >= 1);
    assert.equal((await second.json()).code, 'RATE_LIMITED');
  });
});
