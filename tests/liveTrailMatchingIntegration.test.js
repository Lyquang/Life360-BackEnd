const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { LiveTrailMatch } = require('../src/infrastructure/database/models/LiveTrail');
const { localDateFor } = require('../src/domain/liveTrail');
const { startTestServer, waitForEvent, emitWithAck } = require('./helpers/testServer');

function fix(recordedAt, offset) {
  return {
    pointId: randomUUID(),
    latitude: 10.762 + offset,
    longitude: 106.66 + offset,
    recordedAt,
    accuracy: 8,
    motionState: 'walking',
  };
}

describe('live trail fake matcher integration', { timeout: 120000 }, () => {
  let t;

  before(async () => {
    t = await startTestServer({
      env: {
        LIVE_TRAIL_ENABLED: 'true',
        LIVE_TRAIL_MATCHER_ENABLED: 'true',
        LIVE_TRAIL_MATCHER_PROVIDER: 'fake',
        LIVE_TRAIL_MATCH_WINDOW_SIZE: '5',
        LIVE_TRAIL_MATCH_WINDOW_WAIT_SECONDS: '1',
        LIVE_TRAIL_DELTA_FLUSH_MS: '30',
      },
    });
  });

  after(() => t.stop());

  it('persists revision-scoped matches, returns them over REST, and emits matchedUpdates', async () => {
    const target = await t.registerUser('TrailMatchTarget');
    const viewer = await t.registerUser('TrailMatchViewer');
    const group = await t.createGroup(target, 'Trail Match Group');
    await t.joinGroup(viewer, group);
    const base = Date.now() - 20 * 1000;
    const seedAt = new Date(base);
    await t.instance.container.services.liveTrailProjection.project({
      userId: target.id,
      points: [fix(seedAt, 0)],
    });
    const date = localDateFor(seedAt, 'Asia/Ho_Chi_Minh');
    const socket = await t.connect(viewer.token);
    const watch = await emitWithAck(socket, 'journey:watch', { userId: target.id, date });
    assert.equal(watch.ok, true);

    const resetPromise = waitForEvent(socket, 'journey:trail_reset');
    const matchDeltaPromise = waitForEvent(socket, 'journey:trail_delta', 3000);
    const points = Array.from({ length: 5 }, (_, index) => {
      const recordedAt = new Date(base + (index + 1) * 1000);
      return { ...fix(recordedAt, (index + 1) * 0.0001), recordedAt: recordedAt.toISOString() };
    });
    const response = await t.api('POST', '/api/v1/locations/batch', {
      token: target.token,
      body: { points },
    });
    assert.equal(response.status, 200);
    await resetPromise;
    const delta = await matchDeltaPromise;
    assert.equal(delta.points.length, 0);
    assert.equal(delta.afterSeq, 6);
    assert.ok(delta.matchedUpdates.length >= 1);
    assert.equal(delta.matchedUpdates[0].matcher.provider, 'fake');
    assert.equal(delta.matchedUpdates[0].geometry.encoding, 'polyline6');

    const stored = await LiveTrailMatch.find({ trailId: watch.trailId, revision: watch.revision }).lean();
    assert.ok(stored.length >= 1);
    assert.ok(stored.every((match) => match.sourceRevision && match.expiresAt));

    const snapshot = await t.api(
      'GET',
      `/api/v1/history/${target.id}/journey/trail?date=${date}&limit=100`,
      { token: viewer.token }
    );
    assert.equal(snapshot.status, 200);
    assert.equal(snapshot.body.matched.length, stored.length);
    assert.ok(snapshot.body.matched.every((match) => match.matcher.provider === 'fake'));

    const lateResetPromise = waitForEvent(socket, 'journey:trail_reset');
    const rematchPromise = waitForEvent(socket, 'journey:trail_delta', 3000);
    const lateAt = new Date(base - 1000);
    const lateResponse = await t.api('POST', '/api/v1/locations/batch', {
      token: target.token,
      body: {
        points: [{ ...fix(lateAt, -0.0001), recordedAt: lateAt.toISOString() }],
      },
    });
    assert.equal(lateResponse.status, 200);
    const lateReset = await lateResetPromise;
    assert.equal(lateReset.revision, 2);
    const rematch = await rematchPromise;
    assert.equal(rematch.revision, 2);
    const remainingOld = await LiveTrailMatch.countDocuments({ trailId: watch.trailId, revision: 1 });
    const current = await LiveTrailMatch.countDocuments({ trailId: watch.trailId, revision: 2 });
    assert.equal(remainingOld, 0);
    assert.ok(current >= 1);
    await t.disconnect(socket);
  });

  it('rejects FakeMatcher configuration in production', () => {
    const { loadConfig, ConfigError } = require('../src/config/env');
    assert.throws(
      () => loadConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'production-secret',
        MONGODB_URI: 'mongodb://example.invalid/db',
        LIVE_TRAIL_MATCHER_PROVIDER: 'fake',
      }),
      ConfigError
    );
  });
});
