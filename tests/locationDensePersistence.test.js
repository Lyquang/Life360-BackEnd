const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startTestServer, waitForEvent } = require('./helpers/testServer');
const LocationHistory = require('../src/infrastructure/database/models/LocationHistory');
const User = require('../src/infrastructure/database/models/User');

const metersPerDegree = (Math.PI * 6371000) / 180;

function fix(recordedAt, eastMeters = 0, extra = {}) {
  return {
    latitude: 0,
    longitude: eastMeters / metersPerDegree,
    recordedAt: recordedAt.toISOString(),
    accuracy: 5,
    pointId: randomUUID(),
    ...extra,
  };
}

describe('dense realtime location persistence', { timeout: 120000 }, () => {
  let t;
  let owner;
  let circle;

  before(async () => {
    t = await startTestServer({ env: { LOCATION_HISTORY_DENSE_ENABLED: 'true' } });
    owner = await t.registerUser('DenseOwner');
    circle = await t.createGroup(owner, 'Dense History');
  });

  after(() => t.stop());

  async function setupMember(name) {
    const member = await t.registerUser(name);
    await t.joinGroup(member, circle);
    return { member, viewer: await t.connect(owner.token), sender: await t.connect(member.token) };
  }

  async function send(viewer, sender, payload) {
    const update = waitForEvent(viewer, 'location_update');
    sender.emit('update_location', payload);
    return update;
  }

  it('requires both 15 seconds and 25 meters while moving', async () => {
    for (const [name, secondFix, expectedCount] of [
      ['DenseBoth', { seconds: 15, meters: 25 }, 2],
      ['DenseTimeOnly', { seconds: 15, meters: 10 }, 1],
      ['DenseDistanceOnly', { seconds: 14, meters: 30 }, 1],
    ]) {
      const { member, viewer, sender } = await setupMember(name);
      const start = new Date(Date.now() - 10 * 60 * 1000);
      await send(viewer, sender, fix(start));
      await send(viewer, sender, fix(new Date(start.getTime() + secondFix.seconds * 1000), secondFix.meters));
      assert.equal(await LocationHistory.countDocuments({ userId: member.id }), expectedCount);
      await t.disconnect(viewer, sender);
    }
  });

  it('persists idle heartbeats and motion-state transitions', async () => {
    for (const [name, secondFix] of [
      ['DenseIdle', { seconds: 300, meters: 0 }],
      ['DenseMotion', { seconds: 1, meters: 0, motionState: 'walking' }],
    ]) {
      const { member, viewer, sender } = await setupMember(name);
      const start = new Date(Date.now() - 10 * 60 * 1000);
      await send(viewer, sender, fix(start, 0, { motionState: 'stationary' }));
      await send(
        viewer,
        sender,
        fix(new Date(start.getTime() + secondFix.seconds * 1000), secondFix.meters, {
          motionState: secondFix.motionState || 'stationary',
        })
      );
      assert.equal(await LocationHistory.countDocuments({ userId: member.id }), 2);
      await t.disconnect(viewer, sender);
    }
  });

  it('stores a late point without replacing last-known state', async () => {
    const { member, viewer, sender } = await setupMember('DenseLate');
    const newerAt = new Date(Date.now() - 60 * 1000);
    const olderAt = new Date(newerAt.getTime() - 60 * 1000);
    await send(viewer, sender, fix(newerAt, 50));
    await send(viewer, sender, fix(olderAt, 0));

    const history = await LocationHistory.find({ userId: member.id }).sort({ timestamp: 1 }).lean();
    assert.deepEqual(history.map((entry) => entry.timestamp.toISOString()), [olderAt, newerAt].map((date) => date.toISOString()));
    const user = await User.findById(member.id).lean();
    assert.equal(user.lastKnownLocation.updatedAt.toISOString(), newerAt.toISOString());
    await t.disconnect(viewer, sender);
  });

  it('reloads the latest MongoDB point after in-memory state is cleared', async () => {
    const { member, viewer, sender } = await setupMember('DenseReload');
    const measuredAt = new Date(Date.now() - 60 * 1000);
    const payload = fix(measuredAt, 10);
    await send(viewer, sender, payload);
    await t.disconnect(viewer, sender);

    const nextViewer = await t.connect(owner.token);
    const nextSender = await t.connect(member.token);
    await send(nextViewer, nextSender, payload);
    assert.equal(await LocationHistory.countDocuments({ userId: member.id }), 1);
    await t.disconnect(nextViewer, nextSender);
  });

  it('deduplicates one GPS fix received through realtime and batch', async () => {
    const { member, viewer, sender } = await setupMember('DenseCrossChannel');
    const measuredAt = new Date(Date.now() - 60 * 1000);
    const payload = fix(measuredAt, 20, { motionState: 'walking' });
    await send(viewer, sender, payload);

    const batch = await t.api('POST', '/api/v1/locations/batch', {
      token: member.token,
      body: { points: [payload] },
    });
    assert.equal(batch.status, 200, JSON.stringify(batch.body));
    assert.deepEqual(batch.body.data.accepted, []);
    assert.deepEqual(batch.body.data.duplicates, [payload.pointId]);
    assert.equal(await LocationHistory.countDocuments({ userId: member.id }), 1);
    await t.disconnect(viewer, sender);
  });
});

describe('legacy realtime history feature flag', { timeout: 120000 }, () => {
  let t;

  before(async () => {
    t = await startTestServer({ env: { LOCATION_HISTORY_DENSE_ENABLED: 'false' } });
  });

  after(() => t.stop());

  it('keeps the old distance-OR-time rule while dense persistence is disabled', async () => {
    const owner = await t.registerUser('LegacyDenseOwner');
    const member = await t.registerUser('LegacyDenseMember');
    const circle = await t.createGroup(owner, 'Legacy Dense Flag');
    await t.joinGroup(member, circle);
    const viewer = await t.connect(owner.token);
    const sender = await t.connect(member.token);
    const start = new Date(Date.now() - 60 * 1000);

    let update = waitForEvent(viewer, 'location_update');
    sender.emit('update_location', fix(start));
    await update;
    update = waitForEvent(viewer, 'location_update');
    sender.emit('update_location', fix(new Date(start.getTime() + 1000), 60));
    await update;

    assert.equal(await LocationHistory.countDocuments({ userId: member.id }), 2);
    await t.disconnect(viewer, sender);
  });
});
