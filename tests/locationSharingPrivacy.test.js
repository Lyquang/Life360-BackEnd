const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const { localDateFor } = require('../src/domain/liveTrail');
const { startTestServer, waitForEvent, expectNoEvent } = require('./helpers/testServer');

const LocationHistory = () => mongoose.model('LocationHistory');

function fix(offset = 0) {
  return {
    latitude: 10.762 + offset,
    longitude: 106.66 + offset,
    recordedAt: new Date().toISOString(),
    accuracy: 8,
    pointId: randomUUID(),
    motionState: 'walking',
  };
}

describe('account-wide location sharing privacy', { timeout: 120000 }, () => {
  let t, target, viewer, group, targetSocket, viewerSocket, date;

  before(async () => {
    t = await startTestServer({ env: { LIVE_TRAIL_ENABLED: 'true', LIVE_TRAIL_DELTA_FLUSH_MS: '20' } });
    target = await t.registerUser('PrivacyTarget');
    viewer = await t.registerUser('PrivacyViewer');
    group = await t.createGroup(target, 'Privacy Circle');
    await t.joinGroup(viewer, group);
    targetSocket = await t.connect(target.token);
    viewerSocket = await t.connect(viewer.token);

    const received = waitForEvent(viewerSocket, 'location_update');
    targetSocket.emit('update_location', fix());
    await received;
    date = localDateFor(new Date(), 'Asia/Ho_Chi_Minh');
  });

  after(() => t.stop());

  it('closes existing watches immediately and blocks realtime, batch and shared history reads', async () => {
    const watch = await viewerSocket.timeout(5000).emitWithAck('journey:watch', { userId: target.id, date });
    assert.equal(watch.ok, true);
    const closedPromise = waitForEvent(viewerSocket, 'journey:trail_closed');
    const runtimeState = t.instance.container.services.locationRuntimeState;
    runtimeState.lastSavedLocation.set(target.id, { recordedAt: new Date() });
    runtimeState.durationTracker.set(target.id, { sinceTimestamp: Date.now() - 60_000 });

    const paused = await t.api('PATCH', '/api/v1/privacy/location-sharing', {
      token: target.token,
      body: { enabled: false },
    });
    assert.equal(paused.status, 200, JSON.stringify(paused.body));
    assert.deepEqual(
      { enabled: paused.body.data.enabled, pausedUntil: paused.body.data.pausedUntil },
      { enabled: false, pausedUntil: null }
    );
    assert.deepEqual(await closedPromise, {
      userId: target.id,
      trailId: watch.trailId,
      reason: 'sharing_paused',
    });
    assert.equal(runtimeState.lastSavedLocation.has(target.id), false);
    assert.equal(runtimeState.durationTracker.has(target.id), false);

    const countBefore = await LocationHistory().countDocuments({ userId: target.id });
    const locationError = waitForEvent(targetSocket, 'error');
    const noLocation = expectNoEvent(viewerSocket, 'location_update', 250);
    targetSocket.emit('update_location', fix(0.001));
    assert.deepEqual(await locationError, {
      code: 'LOCATION_SHARING_PAUSED',
      message: 'Location sharing is currently paused.',
    });
    await noLocation;
    assert.equal(await LocationHistory().countDocuments({ userId: target.id }), countBefore);

    const batch = await t.api('POST', '/api/v1/locations/batch', {
      token: target.token,
      body: { points: [{ ...fix(0.002), recordedAt: new Date().toISOString() }] },
    });
    assert.equal(batch.status, 403);
    assert.equal(batch.body.code, 'LOCATION_SHARING_PAUSED');

    const denied = await t.api('GET', `/api/v1/history/${target.id}`, { token: viewer.token });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'LOCATION_SHARING_PAUSED');
    assert.equal((await t.api('GET', `/api/v1/history/${target.id}`, { token: target.token })).status, 200);

    const digestPromise = waitForEvent(viewerSocket, 'group_digest');
    await t.instance.container.useCases.digests.sendDueDigests(new Date(Date.now() + 2 * 60 * 60 * 1000));
    const digest = await digestPromise;
    const targetStatus = digest.members.find((member) => String(member.userId) === target.id);
    assert.equal(targetStatus.latitude, null);
    assert.equal(targetStatus.longitude, null);
    assert.equal(targetStatus.durationMinutes, 0);
    assert.match(targetStatus.summary, /tạm dừng chia sẻ vị trí/);
  });

  it('still delivers explicit SOS while sharing is paused and supports re-enable', async () => {
    const sos = waitForEvent(viewerSocket, 'sos_alert');
    const confirmed = waitForEvent(targetSocket, 'sos_confirmed');
    targetSocket.emit('sos_alert', { message: 'Need help', latitude: 10.7, longitude: 106.6 });
    assert.equal((await sos).message, 'Need help');
    assert.equal((await confirmed).groupCount, 1);

    const enabled = await t.api('PATCH', '/api/v1/privacy/location-sharing', {
      token: target.token,
      body: { enabled: true },
    });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.data.enabled, true);
    assert.equal((await t.api('GET', `/api/v1/history/${target.id}`, { token: viewer.token })).status, 200);
  });

  it('validates pause duration and exposes the effective state', async () => {
    const tooFar = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const rejected = await t.api('PATCH', '/api/v1/privacy/location-sharing', {
      token: target.token,
      body: { enabled: false, pausedUntil: tooFar },
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.code, 'BAD_REQUEST');

    const contradictory = await t.api('PATCH', '/api/v1/privacy/location-sharing', {
      token: target.token,
      body: { enabled: true, pausedUntil: new Date(Date.now() + 60 * 1000).toISOString() },
    });
    assert.equal(contradictory.status, 400);
    assert.equal(contradictory.body.code, 'VALIDATION_ERROR');

    const until = new Date(Date.now() + 60 * 60 * 1000);
    const accepted = await t.api('PATCH', '/api/v1/privacy/location-sharing', {
      token: target.token,
      body: { enabled: false, pausedUntil: until.toISOString() },
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.data.enabled, false);
    assert.equal(new Date(accepted.body.data.pausedUntil).getTime(), until.getTime());

    const current = await t.api('GET', '/api/v1/privacy/location-sharing', { token: target.token });
    assert.equal(current.status, 200);
    assert.equal(current.body.data.enabled, false);
  });
});
