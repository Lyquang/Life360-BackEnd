const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildMatchWindows,
  segmentIdFor,
  sourceRevision,
} = require('../src/domain/liveTrailMatching');
const { createFakeMapMatcher, encodePolyline6 } = require('../src/infrastructure/matching/FakeMapMatcher');
const { createNoopMapMatcher } = require('../src/infrastructure/matching/NoopMapMatcher');
const { createLiveTrailMatchingService } = require('../src/application/location/liveTrailMatchingService');
const { sleep } = require('./helpers/testServer');

const basePolicy = {
  enabled: true,
  windowSize: 5,
  overlapPoints: 2,
  futureContextPoints: 2,
  minPoints: 3,
  maxAccuracyMeters: 50,
  gapThresholdSeconds: 180,
  stayRadiusMeters: 80,
};

function point(seq, overrides = {}) {
  return {
    seq,
    latitude: 10.7,
    longitude: 106.6 + seq * 0.0001,
    recordedAt: new Date(Date.UTC(2026, 9, 18, 5, 0, seq)),
    accuracy: 5,
    motionState: 'walking',
    ...overrides,
  };
}

describe('live trail matching domain', () => {
  it('builds overlapping final/provisional windows in chronological order', () => {
    const windows = buildMatchWindows([7, 2, 5, 1, 3, 6, 4].map(point), basePolicy);
    assert.deepEqual(
      windows.map((window) => [window.fromSeq, window.toSeq, window.lifecycle]),
      [[1, 5, 'final'], [4, 7, 'provisional']]
    );
  });

  it('never crosses route gaps or poor-accuracy fixes', () => {
    const secondRun = [4, 5, 6, 7].map((seq) => point(seq, {
      latitude: 11.2,
      recordedAt: new Date(`2026-10-18T06:00:0${seq - 4}.000Z`),
    }));
    const points = [point(1), point(2), point(3), ...secondRun];
    assert.deepEqual(
      buildMatchWindows(points, { ...basePolicy, windowSize: 3, overlapPoints: 1, futureContextPoints: 1 })
        .map((window) => [window.fromSeq, window.toSeq]),
      [[1, 3], [4, 6]]
    );

    points[4].accuracy = 80;
    assert.deepEqual(
      buildMatchWindows(points, { ...basePolicy, windowSize: 3, overlapPoints: 1, futureContextPoints: 1 })
        .map((window) => [window.fromSeq, window.toSeq]),
      [[1, 3]]
    );
  });

  it('creates deterministic source revisions, segment IDs and fake polyline6 geometry', async () => {
    const window = { points: [point(1), point(2), point(3)], fromSeq: 1, toSeq: 3 };
    const input = { trailId: 'trail', revision: 2, window, matcher: { provider: 'fake', version: 'fake-v1' } };
    assert.equal(sourceRevision(input), sourceRevision(input));
    assert.equal(segmentIdFor('trail', 2, 1), segmentIdFor('trail', 2, 1));
    assert.notEqual(segmentIdFor('trail', 2, 1), segmentIdFor('trail', 3, 1));

    const fake = createFakeMapMatcher();
    const matched = await fake.matchWindow({ points: window.points });
    assert.equal(matched.geometry, encodePolyline6(window.points));
    assert.equal(matched.encoding, 'polyline6');
    assert.deepEqual(await createNoopMapMatcher().matchWindow({ points: window.points }), {
      matched: false,
      provider: 'none',
      version: 'noop-v1',
    });
  });
});

describe('live trail matching service resilience', () => {
  function policy(overrides = {}) {
    return {
      ...basePolicy,
      windowSize: 3,
      overlapPoints: 0,
      futureContextPoints: 0,
      windowWaitMs: 10,
      queueMaxTrails: 10,
      concurrency: 1,
      timeoutMs: 20,
      circuitFailureThreshold: 2,
      circuitCooldownMs: 1000,
      ...overrides,
    };
  }

  it('opens the circuit after bounded matcher failures without publishing geometry', async () => {
    let calls = 0;
    const points = Array.from({ length: 9 }, (_, index) => point(index + 1));
    const service = createLiveTrailMatchingService({
      liveTrailRepo: {
        loadMatchingSnapshot: async () => ({
          trail: { revision: 1, expiresAt: new Date(Date.now() + 60000) },
          points,
        }),
        deleteMatchesOutsideRevision: async () => {},
        findMatchBySourceRevision: async () => null,
        saveMatch: async () => { throw new Error('must not save'); },
      },
      matcher: {
        provider: 'failure',
        version: 'v1',
        async matchWindow() { calls += 1; throw new Error('provider down'); },
      },
      liveTrailDeltaPublisher: { publishMatchedUpdates() { throw new Error('must not publish'); } },
      policy: policy(),
      logger: { warn() {}, error() {} },
    });
    service.schedule({
      userId: 'user',
      projection: { results: [{ trailId: 'trail', revision: 1, lastSeq: 9, inserted: points }] },
    });
    await sleep(50);
    assert.equal(calls, 2);
    assert.equal(service.stats().circuitOpen, true);
    await service.close();
  });

  it('enforces timeout even when an adapter ignores AbortSignal', async () => {
    const service = createLiveTrailMatchingService({
      liveTrailRepo: {
        loadMatchingSnapshot: async () => ({
          trail: { revision: 1, expiresAt: new Date(Date.now() + 60000) },
          points: [point(1), point(2), point(3)],
        }),
        deleteMatchesOutsideRevision: async () => {},
        findMatchBySourceRevision: async () => null,
        saveMatch: async () => { throw new Error('must not save'); },
      },
      matcher: {
        provider: 'hanging',
        version: 'v1',
        matchWindow: async () => new Promise(() => {}),
      },
      liveTrailDeltaPublisher: { publishMatchedUpdates() {} },
      policy: policy({ circuitFailureThreshold: 3 }),
      logger: { warn() {}, error() {} },
    });
    service.schedule({
      userId: 'user',
      projection: { results: [{ trailId: 'trail', revision: 1, lastSeq: 3, inserted: [point(1), point(2), point(3)] }] },
    });
    await sleep(50);
    assert.deepEqual(service.stats(), {
      active: 0,
      queued: 0,
      pendingTriggers: 0,
      circuitOpen: false,
    });
    await service.close();
  });

  it('bounds queued trails and keeps the newest coalesced job', async () => {
    let releaseFirst;
    const firstBlocked = new Promise((resolve) => { releaseFirst = resolve; });
    const loaded = [];
    const service = createLiveTrailMatchingService({
      liveTrailRepo: {
        loadMatchingSnapshot: async (trailId) => {
          loaded.push(trailId);
          if (trailId === 'trail-1') await firstBlocked;
          return {
            trail: { revision: 1, expiresAt: new Date(Date.now() + 60000) },
            points: [point(1), point(2), point(3)],
          };
        },
        deleteMatchesOutsideRevision: async () => {},
        findMatchBySourceRevision: async () => ({
          segmentId: 'cached', fromSeq: 1, toSeq: 3, status: 'final',
          matcher: { provider: 'fake', version: 'fake-v1' }, sourceRevision: 'cached',
        }),
        saveMatch: async (match) => match,
      },
      matcher: createFakeMapMatcher(),
      liveTrailDeltaPublisher: { publishMatchedUpdates() {} },
      policy: policy({ queueMaxTrails: 1 }),
      logger: { warn() {}, error() {} },
    });
    const projection = (trailId) => ({
      results: [{ trailId, revision: 1, lastSeq: 3, inserted: [point(1), point(2), point(3)] }],
    });
    service.schedule({ userId: 'user', projection: projection('trail-1') });
    await sleep(5);
    service.schedule({ userId: 'user', projection: projection('trail-2') });
    service.schedule({ userId: 'user', projection: projection('trail-3') });
    assert.equal(service.stats().queued, 1);
    releaseFirst();
    await sleep(40);
    assert.deepEqual(loaded, ['trail-1', 'trail-3']);
    await service.close();
  });

  it('uses a durable source-revision hit instead of calling the matcher twice', async () => {
    let calls = 0;
    let cached = null;
    const points = [point(1), point(2), point(3)];
    const service = createLiveTrailMatchingService({
      liveTrailRepo: {
        loadMatchingSnapshot: async () => ({
          trail: { revision: 1, expiresAt: new Date(Date.now() + 60000) },
          points,
        }),
        deleteMatchesOutsideRevision: async () => {},
        findMatchBySourceRevision: async (revision) =>
          cached?.sourceRevision === revision ? cached : null,
        saveMatch: async (match) => {
          cached = { ...match, createdAt: new Date(), updatedAt: new Date() };
          return cached;
        },
      },
      matcher: {
        provider: 'fake',
        version: 'fake-v1',
        async matchWindow({ points: input }) {
          calls += 1;
          return createFakeMapMatcher().matchWindow({ points: input });
        },
      },
      liveTrailDeltaPublisher: { publishMatchedUpdates() {} },
      policy: policy(),
      logger: { warn() {}, error() {} },
    });
    const projection = {
      results: [{ trailId: 'trail', revision: 1, lastSeq: 3, inserted: points }],
    };
    service.schedule({ userId: 'user', projection });
    await sleep(30);
    service.schedule({ userId: 'user', projection });
    await sleep(30);
    assert.equal(calls, 1);
    await service.close();
  });
});
