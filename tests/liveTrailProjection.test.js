const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { prepareLiveTrailPoints } = require('../src/domain/liveTrail');
const { createLiveTrailProjection } = require('../src/application/location/liveTrailProjection');
const { LiveTrail, LiveTrailPoint } = require('../src/infrastructure/database/models/LiveTrail');
const { startTestServer, waitForEvent, expectNoEvent } = require('./helpers/testServer');

const DAY_MS = 24 * 60 * 60 * 1000;

function fix(recordedAt, overrides = {}) {
  return {
    pointId: randomUUID(),
    latitude: 10.762622,
    longitude: 106.660172,
    recordedAt,
    accuracy: 8,
    motionState: 'walking',
    ...overrides,
  };
}

describe('live trail domain policy', () => {
  it('groups by configured local day, filters poor accuracy and deduplicates measured fixes', () => {
    const first = fix(new Date('2026-10-17T16:59:59.000Z'));
    const duplicateFix = { ...first, pointId: randomUUID() };
    const nextDay = fix(new Date('2026-10-17T17:00:01.000Z'));
    const poorAccuracy = fix(new Date('2026-10-17T17:01:00.000Z'), { accuracy: 101 });
    const groups = prepareLiveTrailPoints(
      [first, duplicateFix, nextDay, poorAccuracy],
      { timeZone: 'Asia/Ho_Chi_Minh', retentionMs: 7 * DAY_MS, maxAccuracyMeters: 100 }
    );

    assert.deepEqual(groups.map((group) => group.localDate), ['2026-10-17', '2026-10-18']);
    assert.deepEqual(groups.map((group) => group.points.length), [1, 1]);
    assert.equal(groups[0].points[0].expiresAt.getTime(), first.recordedAt.getTime() + 7 * DAY_MS);
  });

  it('swallows repository failures without logging coordinates or user identifiers', async () => {
    const errors = [];
    const projection = createLiveTrailProjection({
      liveTrailRepo: { appendPoints: async () => {
        const error = new Error('private-repository-message');
        error.name = 'private-error-name';
        throw error;
      } },
      unitOfWork: { run: (work) => work({}) },
      policy: {
        enabled: true,
        timeZone: 'Asia/Ho_Chi_Minh',
        retentionMs: 7 * DAY_MS,
        maxAccuracyMeters: 100,
      },
      logger: { error: (...args) => errors.push(args) },
    });

    const result = await projection.project({
      userId: 'private-user-id',
      points: [fix(new Date())],
    });
    assert.deepEqual(result, { enabled: true, results: [] });
    assert.deepEqual(errors, [['LIVE_TRAIL_PROJECTION_FAILED']]);
    const serializedLog = JSON.stringify(errors);
    assert.equal(serializedLog.includes('private-user-id'), false);
    assert.equal(serializedLog.includes('10.762622'), false);
    assert.equal(serializedLog.includes('106.660172'), false);
  });
});

describe('live trail T1a transaction projection', { timeout: 120000 }, () => {
  let t;

  before(async () => {
    t = await startTestServer({
      env: {
        LIVE_TRAIL_ENABLED: 'true',
        LIVE_TRAIL_RETENTION_DAYS: '7',
        LIVE_TRAIL_MAX_ACCURACY_METERS: '100',
      },
    });
  });

  after(() => t.stop());

  it('uses a replica set and atomically handles append, duplicate and late insertion', async () => {
    assert.equal(t.instance.db.supportsTransactions, true);
    const sender = await t.registerUser('TrailRealtimeSender');
    const receiver = await t.registerUser('TrailRealtimeReceiver');
    const group = await t.createGroup(sender, 'Trail Realtime Group');
    await t.joinGroup(receiver, group);
    const senderSocket = await t.connect(sender.token);
    const receiverSocket = await t.connect(receiver.token);
    const measuredAt = new Date();
    const first = fix(measuredAt);

    let received = waitForEvent(receiverSocket, 'location_update');
    senderSocket.emit('update_location', first);
    await received;

    let trail = await LiveTrail.findOne({ userId: sender.id }).lean();
    assert.equal(trail.revision, 1);
    assert.equal(trail.lastSeq, 1);
    assert.equal(trail.maxRecordedAt.toISOString(), measuredAt.toISOString());

    received = waitForEvent(receiverSocket, 'location_update');
    senderSocket.emit('update_location', first);
    await received;
    trail = await LiveTrail.findById(trail._id).lean();
    assert.equal(trail.revision, 1);
    assert.equal(trail.lastSeq, 1);

    const late = fix(new Date(measuredAt.getTime() - 60000), {
      latitude: first.latitude + 0.0001,
    });
    const noStaleLocation = expectNoEvent(receiverSocket, 'location_update', 250);
    senderSocket.emit('update_location', late);
    await noStaleLocation;
    trail = await LiveTrail.findById(trail._id).lean();
    const points = await LiveTrailPoint.find({ trailId: trail._id }).sort({ seq: 1 }).lean();
    assert.equal(trail.revision, 2);
    assert.equal(trail.lastSeq, 2);
    assert.deepEqual(points.map((point) => point.seq), [1, 2]);
    assert.ok(points[1].recordedAt < points[0].recordedAt);

    await t.disconnect(senderSocket, receiverSocket);
  });

  it('projects accepted offline batches idempotently and does not retain poor-accuracy fixes', async () => {
    const user = await t.registerUser('TrailBatchUser');
    const now = Date.now();
    const points = [
      fix(new Date(now - 30000)),
      fix(new Date(now - 15000), { latitude: 10.763 }),
      fix(new Date(now - 5000), { latitude: 10.764, accuracy: 101 }),
    ];
    const body = {
      points: points.map((point) => ({ ...point, recordedAt: point.recordedAt.toISOString() })),
    };

    const first = await t.api('POST', '/api/v1/locations/batch', { token: user.token, body });
    const retry = await t.api('POST', '/api/v1/locations/batch', { token: user.token, body });
    assert.equal(first.status, 200);
    assert.equal(retry.status, 200);
    const trail = await LiveTrail.findOne({ userId: user.id }).lean();
    const stored = await LiveTrailPoint.find({ trailId: trail._id }).sort({ seq: 1 }).lean();
    assert.equal(trail.lastSeq, 2);
    assert.equal(trail.revision, 1);
    assert.equal(stored.length, 2);
  });

  it('creates separate trails across the configured local-date boundary', async () => {
    const user = await t.registerUser('TrailDateBoundaryUser');
    const projection = t.instance.container.services.liveTrailProjection;
    const result = await projection.project({
      userId: user.id,
      points: [
        fix(new Date('2026-10-17T16:59:59.000Z')),
        fix(new Date('2026-10-17T17:00:01.000Z')),
      ],
    });
    const trails = await LiveTrail.find({ userId: user.id }).sort({ localDate: 1 }).lean();

    assert.equal(result.results.length, 2);
    assert.deepEqual(trails.map((trail) => trail.localDate), ['2026-10-17', '2026-10-18']);
    assert.deepEqual(trails.map((trail) => trail.lastSeq), [1, 1]);
  });

  it('keeps insertion cursors unique under concurrent appends', async () => {
    const user = await t.registerUser('TrailConcurrentUser');
    const projection = t.instance.container.services.liveTrailProjection;
    const now = Date.now();
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        projection.project({
          userId: user.id,
          points: [fix(new Date(now + index * 1000), { latitude: 10.71 + index * 0.0001 })],
        })
      )
    );
    const trail = await LiveTrail.findOne({ userId: user.id }).lean();
    const points = await LiveTrailPoint.find({ trailId: trail._id }).sort({ seq: 1 }).lean();

    assert.equal(trail.lastSeq, 10);
    assert.deepEqual(points.map((point) => point.seq), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('keeps the existing realtime broadcast alive when trail persistence fails', async () => {
    const sender = await t.registerUser('TrailFailureSender');
    const receiver = await t.registerUser('TrailFailureReceiver');
    const group = await t.createGroup(sender, 'Trail Failure Group');
    await t.joinGroup(receiver, group);
    const senderSocket = await t.connect(sender.token);
    const receiverSocket = await t.connect(receiver.token);
    const repo = t.instance.container.repos.liveTrailRepo;
    const originalAppend = repo.appendPoints;
    repo.appendPoints = async () => { throw new Error('forced trail failure'); };

    try {
      const received = waitForEvent(receiverSocket, 'location_update');
      senderSocket.emit('update_location', fix(new Date()));
      const payload = await received;
      assert.equal(payload.userId, sender.id);
    } finally {
      repo.appendPoints = originalAppend;
      await t.disconnect(senderSocket, receiverSocket);
    }
  });

  it('records a local single-point transaction latency baseline without claiming capacity', async (context) => {
    const user = await t.registerUser('TrailLatencyUser');
    const projection = t.instance.container.services.liveTrailProjection;
    const samples = [];
    const now = Date.now();
    for (let index = 0; index < 20; index++) {
      const startedAt = performance.now();
      await projection.project({
        userId: user.id,
        points: [fix(new Date(now + index * 1000), { latitude: 10.7 + index * 0.0001 })],
      });
      samples.push(performance.now() - startedAt);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length * 0.5)];
    const p95 = samples[Math.floor(samples.length * 0.95)];
    assert.ok(p50 < 2000);
    assert.ok(p95 < 2000);
    context.diagnostic(
      `local replica-set transaction baseline: n=${samples.length}, p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms`
    );
  });
});
