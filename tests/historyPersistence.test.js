const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_HISTORY_PERSISTENCE_CONFIG,
  shouldPersistHistoryPoint,
} = require('../src/domain/historyPersistence');

const BASE_TIME = Date.UTC(2026, 0, 1);

function point(eastMeters, seconds, overrides = {}) {
  const metersPerDegree = (Math.PI * 6371000) / 180;
  return {
    latitude: 0,
    longitude: eastMeters / metersPerDegree,
    recordedAt: new Date(BASE_TIME + seconds * 1000),
    ...overrides,
  };
}

describe('history persistence policy', () => {
  it('persists the first valid point and rejects invalid points', () => {
    assert.deepEqual(shouldPersistHistoryPoint(null, point(0, 0)), { persist: true, reason: 'first' });
    assert.deepEqual(shouldPersistHistoryPoint(null, { ...point(0, 0), latitude: NaN }), {
      persist: false,
      reason: 'invalid',
    });
  });

  it('requires both moving interval and distance thresholds', () => {
    const previous = point(0, 0);
    assert.equal(shouldPersistHistoryPoint(previous, point(30, 14)).reason, 'tooSoon');
    assert.equal(shouldPersistHistoryPoint(previous, point(20, 15)).reason, 'stationaryNoise');

    const boundary = shouldPersistHistoryPoint(previous, point(25, 15));
    assert.equal(boundary.persist, true);
    assert.equal(boundary.reason, 'movingThreshold');
  });

  it('persists an idle heartbeat without requiring movement', () => {
    const result = shouldPersistHistoryPoint(point(0, 0), point(0, 300));
    assert.equal(result.persist, true);
    assert.equal(result.reason, 'idleHeartbeat');
  });

  it('persists a motion-state transition', () => {
    const previous = point(0, 0, { motionState: 'stationary' });
    const result = shouldPersistHistoryPoint(previous, point(0, 1, { motionState: 'walking' }));
    assert.equal(result.persist, true);
    assert.equal(result.reason, 'motionChanged');
  });

  it('persists late arrivals without treating them as the latest point', () => {
    const result = shouldPersistHistoryPoint(point(30, 30), point(10, 10));
    assert.equal(result.persist, true);
    assert.equal(result.reason, 'lateArrival');
  });

  it('rejects the exact same fix as a duplicate', () => {
    const previous = point(0, 0);
    assert.deepEqual(shouldPersistHistoryPoint(previous, { ...previous }), {
      persist: false,
      reason: 'duplicate',
    });
  });

  it('accepts injected thresholds without changing the default config', () => {
    const custom = {
      minIntervalMovingSeconds: 10,
      minDistanceMovingMeters: 20,
      maxIdleIntervalSeconds: 120,
    };
    assert.equal(shouldPersistHistoryPoint(point(0, 0), point(20, 10), custom).reason, 'movingThreshold');
    assert.deepEqual(DEFAULT_HISTORY_PERSISTENCE_CONFIG, {
      minIntervalMovingSeconds: 15,
      minDistanceMovingMeters: 25,
      maxIdleIntervalSeconds: 300,
    });
  });
});
