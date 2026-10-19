const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isLocationSharingEnabled,
  publicLocationSharing,
  locationSharingUpdate,
} = require('../src/domain/locationSharing');

describe('location sharing domain policy', () => {
  const now = new Date('2026-10-19T03:00:00.000Z');

  it('keeps legacy users enabled and supports indefinite pause', () => {
    assert.equal(isLocationSharingEnabled(undefined, now), true);
    assert.equal(isLocationSharingEnabled({ enabled: false, pausedUntil: null }, now), false);
  });

  it('automatically treats an expired temporary pause as enabled', () => {
    const state = { enabled: false, pausedUntil: new Date('2026-10-19T02:59:59.000Z'), updatedAt: now };
    assert.equal(isLocationSharingEnabled(state, now), true);
    assert.deepEqual(publicLocationSharing(state, now), {
      enabled: true,
      pausedUntil: null,
      updatedAt: now,
    });
  });

  it('bounds temporary pauses to seven days', () => {
    const accepted = locationSharingUpdate({
      enabled: false,
      pausedUntil: new Date('2026-10-26T03:00:00.000Z'),
    }, now);
    assert.equal(accepted.enabled, false);
    assert.throws(
      () => locationSharingUpdate({
        enabled: false,
        pausedUntil: new Date('2026-10-26T03:00:00.001Z'),
      }, now),
      /more than 7 days/
    );
  });
});
