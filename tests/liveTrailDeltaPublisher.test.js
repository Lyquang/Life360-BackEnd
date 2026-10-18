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
    logger: { error() {} },
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
});
