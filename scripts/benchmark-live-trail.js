const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createLiveTrailDeltaPublisher } = require('../src/application/location/liveTrailDeltaPublisher');
const { createLiveTrailMatchingService } = require('../src/application/location/liveTrailMatchingService');
const { createFakeMapMatcher } = require('../src/infrastructure/matching/FakeMapMatcher');

const TRAILS = 100;
const POINTS_PER_TRAIL = 20;

function pointsFor(trailIndex) {
  const base = Date.UTC(2026, 9, 19, 3, 0, 0);
  return Array.from({ length: POINTS_PER_TRAIL }, (_, index) => ({
    seq: index + 1,
    latitude: 10.762 + trailIndex * 0.000001 + index * 0.00001,
    longitude: 106.66 + index * 0.00001,
    recordedAt: new Date(base + index * 1000),
    accuracy: 8,
    motionState: 'walking',
  }));
}

function projectionFor(trailIndex, points) {
  return {
    results: [{
      trailId: `trail-${trailIndex}`,
      revision: 1,
      afterSeq: 0,
      lastSeq: points.at(-1).seq,
      lateArrival: false,
      inserted: points,
    }],
  };
}

function benchmarkDeltas(fixtures) {
  const events = [];
  const publisher = createLiveTrailDeltaPublisher({
    realtime: {
      emitToLiveTrail: (trailId, event, payload) => events.push({ trailId, event, payload }),
    },
    policy: { deltaMaxPoints: 50, deltaMaxBytes: 64 * 1024, deltaFlushMs: 2000 },
    logger: { warn() {}, error() {} },
  });
  const startedAt = performance.now();
  for (const fixture of fixtures) {
    publisher.publishRealtime({ userId: fixture.userId, projection: fixture.projection });
    publisher.flush(fixture.trailId);
  }
  const elapsedMs = performance.now() - startedAt;
  publisher.close();
  const payloadBytes = events.map(({ payload }) => Buffer.byteLength(JSON.stringify(payload)));
  const emittedPoints = events.reduce((sum, event) => sum + event.payload.points.length, 0);
  assert.equal(emittedPoints, fixtures.length * POINTS_PER_TRAIL, 'delta publisher lost points');
  assert.ok(payloadBytes.every((bytes) => bytes <= 64 * 1024), 'delta payload exceeded byte cap');
  return {
    trails: fixtures.length,
    inputPoints: fixtures.length * POINTS_PER_TRAIL,
    emittedEvents: events.length,
    maxPayloadBytes: Math.max(...payloadBytes),
    elapsedMs: Number(elapsedMs.toFixed(2)),
    pointsPerSecond: Math.round((fixtures.length * POINTS_PER_TRAIL * 1000) / elapsedMs),
  };
}

async function benchmarkMatcher(fixtures) {
  const snapshots = new Map(fixtures.map((fixture) => [fixture.trailId, {
    trail: { revision: 1, expiresAt: new Date('2026-10-26T03:00:00.000Z') },
    points: fixture.projection.results[0].inserted,
  }]));
  const matches = new Map();
  let publishedUpdates = 0;
  const liveTrailRepo = {
    loadMatchingSnapshot: async (trailId) => snapshots.get(trailId),
    deleteMatchesOutsideRevision: async () => {},
    findMatchBySourceRevision: async (sourceRevision) => matches.get(sourceRevision) || null,
    saveMatch: async (match) => {
      const stored = { ...match, createdAt: new Date(), updatedAt: new Date() };
      matches.set(match.sourceRevision, stored);
      return stored;
    },
  };
  const service = createLiveTrailMatchingService({
    liveTrailRepo,
    matcher: createFakeMapMatcher(),
    liveTrailDeltaPublisher: {
      publishMatchedUpdates: ({ updates }) => { publishedUpdates += updates.length; },
    },
    policy: {
      enabled: true,
      windowSize: 5,
      windowWaitMs: 30_000,
      overlapPoints: 2,
      futureContextPoints: 2,
      minPoints: 3,
      maxAccuracyMeters: 50,
      gapThresholdSeconds: 180,
      stayRadiusMeters: 100,
      queueMaxTrails: 100,
      concurrency: 4,
      timeoutMs: 1000,
      circuitFailureThreshold: 3,
      circuitCooldownMs: 30_000,
    },
    logger: { warn() {}, error() {} },
  });

  const startedAt = performance.now();
  for (const fixture of fixtures) {
    service.schedule({ userId: fixture.userId, projection: fixture.projection });
  }
  while (true) {
    const stats = service.stats();
    if (stats.active === 0 && stats.queued === 0 && stats.pendingTriggers === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  const elapsedMs = performance.now() - startedAt;
  await service.close();
  assert.equal(matches.size, fixtures.length * 6, 'matcher queue dropped or duplicated windows');
  assert.equal(publishedUpdates, matches.size, 'published updates differ from persisted windows');
  return {
    trails: fixtures.length,
    inputPoints: fixtures.length * POINTS_PER_TRAIL,
    persistedWindows: matches.size,
    publishedUpdates,
    concurrency: 4,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    windowsPerSecond: Math.round((matches.size * 1000) / elapsedMs),
  };
}

async function main() {
  const fixtures = Array.from({ length: TRAILS }, (_, index) => {
    const points = pointsFor(index);
    return { trailId: `trail-${index}`, userId: `user-${index}`, projection: projectionFor(index, points) };
  });
  const result = {
    kind: 'synthetic-local-smoke',
    node: process.version,
    generatedAt: new Date().toISOString(),
    note: 'No MongoDB, Socket.IO transport, provider network, or production concurrency is measured.',
    deltaPublisher: benchmarkDeltas(fixtures),
    matcherQueue: await benchmarkMatcher(fixtures),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
