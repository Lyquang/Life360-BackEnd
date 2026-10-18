const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { localDateFor } = require('../src/domain/liveTrail');
const {
  startTestServer,
  waitForEvent,
  expectNoEvent,
  emitWithAck,
} = require('./helpers/testServer');

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

function fix(recordedAt, offset = 0) {
  return {
    pointId: randomUUID(),
    latitude: 10.762622 + offset,
    longitude: 106.660172 + offset,
    recordedAt,
    accuracy: 8,
    motionState: 'walking',
  };
}

describe('live trail Socket.IO watch and delta', { timeout: 120000 }, () => {
  let t;
  let target;
  let viewer;
  let outsider;
  let date;

  before(async () => {
    t = await startTestServer({
      env: {
        LIVE_TRAIL_ENABLED: 'true',
        LIVE_TRAIL_DELTA_FLUSH_MS: '30',
        LIVE_TRAIL_WATCH_LEASE_SECONDS: '1',
        LIVE_TRAIL_WATCH_ACTIONS_PER_MINUTE: '100',
      },
    });
    target = await t.registerUser('TrailSocketTarget');
    viewer = await t.registerUser('TrailSocketViewer');
    outsider = await t.registerUser('TrailSocketOutsider');
    const group = await t.createGroup(target, 'Trail Socket Group');
    await t.joinGroup(viewer, group);
    const initialAt = new Date(Date.now() - 60 * 1000);
    date = localDateFor(initialAt, TIME_ZONE);
    await t.instance.container.services.liveTrailProjection.project({
      userId: target.id,
      points: [fix(initialAt)],
    });
  });

  after(() => t.stop());

  it('authorizes a watch, emits cursor-based deltas, and resets on late inserts', async () => {
    const viewerSocket = await t.connect(viewer.token);
    const targetSocket = await t.connect(target.token);
    const watch = await emitWithAck(viewerSocket, 'journey:watch', { userId: target.id, date });
    assert.equal(watch.ok, true);
    assert.equal(watch.userId, target.id);
    assert.equal(watch.lastSeq, 1);

    const deltaPromise = waitForEvent(viewerSocket, 'journey:trail_delta');
    targetSocket.emit('update_location', fix(new Date(), 0.001));
    const delta = await deltaPromise;
    assert.equal(delta.afterSeq, 1);
    assert.equal(delta.fromSeq, 2);
    assert.equal(delta.toSeq, 2);
    assert.equal(delta.points[0].seq, 2);
    assert.equal(delta.matchedUpdates.length, 0);

    const resetPromise = waitForEvent(viewerSocket, 'journey:trail_reset');
    const noStaleLocation = expectNoEvent(viewerSocket, 'location_update', 100);
    targetSocket.emit('update_location', fix(new Date(Date.now() - 30 * 1000), 0.0005));
    const reset = await resetPromise;
    assert.equal(reset.trailId, watch.trailId);
    assert.equal(reset.revision, 2);
    await noStaleLocation;
    await expectNoEvent(viewerSocket, 'journey:trail_delta', 100);
    await t.disconnect(viewerSocket, targetSocket);
  });

  it('rejects unauthorized watches and stops events after unwatch', async () => {
    const outsiderSocket = await t.connect(outsider.token);
    const denied = await emitWithAck(outsiderSocket, 'journey:watch', { userId: target.id, date });
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 403);
    assert.equal(denied.code, 'FORBIDDEN');
    await t.disconnect(outsiderSocket);

    const viewerSocket = await t.connect(viewer.token);
    const watched = await emitWithAck(viewerSocket, 'journey:watch', { userId: target.id, date });
    assert.equal(watched.ok, true);
    const unwatched = await emitWithAck(viewerSocket, 'journey:unwatch', { userId: target.id, date });
    assert.deepEqual(unwatched, { ok: true, removed: true });

    const projection = await t.instance.container.services.liveTrailProjection.project({
      userId: target.id,
      points: [fix(new Date(Date.now() + 1000), 0.002)],
    });
    t.instance.container.services.liveTrailDeltaPublisher.publishRealtime({
      userId: target.id,
      projection,
    });
    await expectNoEvent(viewerSocket, 'journey:trail_delta', 100);
    await t.disconnect(viewerSocket);
  });

  it('uses reset rather than delta for offline batch projection', async () => {
    const viewerSocket = await t.connect(viewer.token);
    const watched = await emitWithAck(viewerSocket, 'journey:watch', { userId: target.id, date });
    assert.equal(watched.ok, true);
    const resetPromise = waitForEvent(viewerSocket, 'journey:trail_reset');
    const recordedAt = new Date(Date.now() - 10 * 60 * 1000);
    const response = await t.api('POST', '/api/v1/locations/batch', {
      token: target.token,
      body: {
        points: [{ ...fix(recordedAt, 0.003), recordedAt: recordedAt.toISOString() }],
      },
    });
    assert.equal(response.status, 200);
    const reset = await resetPromise;
    assert.equal(reset.trailId, watched.trailId);
    await expectNoEvent(viewerSocket, 'journey:trail_delta', 100);
    await t.disconnect(viewerSocket);
  });

  it('caps each socket at five distinct watched trails', async () => {
    const projection = t.instance.container.services.liveTrailProjection;
    const dates = [];
    for (let daysAgo = 1; daysAgo <= 5; daysAgo++) {
      const at = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      dates.push(localDateFor(at, TIME_ZONE));
      await projection.project({ userId: target.id, points: [fix(at, daysAgo / 1000)] });
    }
    const socket = await t.connect(viewer.token);
    const allDates = [date, ...dates];
    for (const watchDate of allDates.slice(0, 5)) {
      const ack = await emitWithAck(socket, 'journey:watch', { userId: target.id, date: watchDate });
      assert.equal(ack.ok, true, JSON.stringify(ack));
    }
    const rejected = await emitWithAck(socket, 'journey:watch', {
      userId: target.id,
      date: allDates[5],
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.status, 429);
    assert.equal(rejected.code, 'RATE_LIMITED');
    await t.disconnect(socket);
  });

  it('rate-limits watch actions per socket', async () => {
    const policy = t.instance.container.services.liveTrailPolicy;
    const originalLimit = policy.watchActionsPerMinute;
    policy.watchActionsPerMinute = 2;
    const socket = await t.connect(viewer.token);
    try {
      assert.equal((await emitWithAck(socket, 'journey:watch', { userId: target.id, date })).ok, true);
      assert.equal((await emitWithAck(socket, 'journey:unwatch', { userId: target.id, date })).ok, true);
      const limited = await emitWithAck(socket, 'journey:watch', { userId: target.id, date });
      assert.equal(limited.ok, false);
      assert.equal(limited.status, 429);
    } finally {
      policy.watchActionsPerMinute = originalLimit;
      await t.disconnect(socket);
    }
  });

  it('closes a watch when lease revalidation detects revoked permission', async () => {
    const socket = await t.connect(viewer.token);
    const watch = await emitWithAck(socket, 'journey:watch', { userId: target.id, date });
    assert.equal(watch.ok, true);
    const groupRepo = t.instance.container.repos.groupRepo;
    const original = groupRepo.usersShareGroup;
    groupRepo.usersShareGroup = async () => false;
    try {
      const closed = await waitForEvent(socket, 'journey:trail_closed', 2500);
      assert.deepEqual(closed, {
        userId: target.id,
        trailId: watch.trailId,
        reason: 'permission_revoked',
      });
    } finally {
      groupRepo.usersShareGroup = original;
      await t.disconnect(socket);
    }
  });
});
