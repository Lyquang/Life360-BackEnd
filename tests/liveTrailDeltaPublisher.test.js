const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createLiveTrailDeltaPublisher } = require('../src/application/location/liveTrailDeltaPublisher');
const { sleep } = require('./helpers/testServer');

function result(overrides = {}) {
  return {
    trailId: 'trail-1',
    revision: 1,
    afterSeq: 10,
    lastSeq: 13,
    lateArrival: false,
    inserted: [11, 12, 13].map((seq) => ({
      seq,
      latitude: 10.7 + seq / 1000,
      longitude: 106.6,
      recordedAt: new Date(`2026-10-18T05:00:${seq}.000Z`),
    })),
    duplicateCount: 0,
    ...overrides,
  };
}

function setup(policy = {}) {
  const emitted = [];
  const publisher = createLiveTrailDeltaPublisher({
    realtime: {
      emitToLiveTrail: (trailId, event, payload) => emitted.push({ trailId, event, payload }),
    },
    policy: { deltaMaxPoints: 2, deltaMaxBytes: 64 * 1024, deltaFlushMs: 20, ...policy },
    logger: { warn() {}, error() {} },
  });
  return { publisher, emitted };
}

describe('live trail delta publisher', () => {
  it('splits bounded deltas and chains afterSeq without assuming adjacent cursors', async () => {
    const { publisher, emitted } = setup();
    publisher.publishRealtime({ userId: 'user-1', projection: { results: [result()] } });
    await sleep(50);

    assert.equal(emitted.length, 2);
    assert.deepEqual(emitted.map((item) => item.event), ['journey:trail_delta', 'journey:trail_delta']);
    assert.deepEqual(emitted[0].payload.points.map((point) => point.seq), [11, 12]);
    assert.equal(emitted[0].payload.afterSeq, 10);
    assert.deepEqual(emitted[1].payload.points.map((point) => point.seq), [13]);
    assert.equal(emitted[1].payload.afterSeq, 12);
    publisher.close();
  });

  it('drops queued deltas and emits reset for late realtime and offline batch inserts', async () => {
    const { publisher, emitted } = setup({ deltaMaxPoints: 50, deltaFlushMs: 40 });
    publisher.publishRealtime({ userId: 'user-1', projection: { results: [result()] } });
    publisher.publishRealtime({
      userId: 'user-1',
      projection: { results: [result({ revision: 2, afterSeq: 13, lateArrival: true })] },
    });
    await sleep(70);

    assert.deepEqual(emitted.map((item) => item.event), ['journey:trail_reset']);
    assert.equal(emitted[0].payload.revision, 2);

    publisher.publishBatchReset({
      userId: 'user-1',
      projection: { results: [result({ revision: 3, afterSeq: 16 })] },
    });
    assert.deepEqual(emitted.map((item) => item.event), [
      'journey:trail_reset',
      'journey:trail_reset',
    ]);
    publisher.close();
  });

  it('merges bounded match updates and resets instead of emitting an oversized geometry', async () => {
    const { publisher, emitted } = setup({ deltaMaxPoints: 50, deltaMaxBytes: 700, deltaFlushMs: 30 });
    publisher.publishRealtime({ userId: 'user-1', projection: { results: [result()] } });
    publisher.publishMatchedUpdates({
      userId: 'user-1', trailId: 'trail-1', revision: 1, lastSeq: 13,
      updates: [{
        segmentId: 'small', fromSeq: 11, toSeq: 13, status: 'provisional',
        matcher: { provider: 'fake', version: 'fake-v1' }, sourceRevision: 'source-small',
      }],
    });
    await sleep(50);
    assert.equal(emitted[0].event, 'journey:trail_delta');
    assert.equal(emitted[0].payload.matchedUpdates.length, 1);

    publisher.publishMatchedUpdates({
      userId: 'user-1', trailId: 'trail-1', revision: 1, lastSeq: 13,
      updates: [{
        segmentId: 'large', fromSeq: 11, toSeq: 13, status: 'provisional',
        geometry: { encoding: 'polyline6', data: 'x'.repeat(1000) },
        matcher: { provider: 'fake', version: 'fake-v1' }, sourceRevision: 'source-large',
      }],
    });
    assert.equal(emitted.at(-1).event, 'journey:trail_reset');
    publisher.close();
  });
});
