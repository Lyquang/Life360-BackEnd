const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, waitForEvent } = require('./helpers/testServer');
const User = require('../src/infrastructure/database/models/User');
const LocationHistory = require('../src/infrastructure/database/models/LocationHistory');
const { lastLocationKey } = require('../src/domain/cacheKeys');

describe('update_location recordedAt and accuracy', { timeout: 120000 }, () => {
  let t;
  let owner;
  let circle;
  const cacheWrites = [];

  before(async () => {
    t = await startTestServer();
    owner = await t.registerUser('LocationOwner');
    circle = await t.createGroup(owner, 'Location Contract');
    t.instance.container.services.cacheManager.setWithTTL = async (key, value, ttlSeconds) => {
      cacheWrites.push({ key, value, ttlSeconds });
      return true;
    };
  });

  after(() => t.stop());

  async function connectedMember(name) {
    const member = await t.registerUser(name);
    await t.joinGroup(member, circle);
    return { member, viewer: await t.connect(owner.token), sender: await t.connect(member.token) };
  }

  it('preserves legacy behavior when optional fields are absent', async () => {
    const { member, viewer, sender } = await connectedMember('LegacyLocation');
    const before = Date.now();
    const update = waitForEvent(viewer, 'location_update');
    sender.emit('update_location', { latitude: 10.776, longitude: 106.7, batteryLevel: 70 });
    const payload = await update;

    assert.equal(payload.accuracy, undefined);
    assert.equal(payload.timestamp, payload.recordedAt);
    assert.ok(Date.parse(payload.recordedAt) >= before);

    const history = await LocationHistory.findOne({ userId: member.id }).lean();
    assert.ok(history.timestamp.getTime() >= before);
    await t.disconnect(viewer, sender);
  });

  it('uses valid recordedAt and accuracy in broadcast, cache and history', async () => {
    const { member, viewer, sender } = await connectedMember('MeasuredLocation');
    const measuredAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const update = waitForEvent(viewer, 'location_update');
    sender.emit('update_location', {
      latitude: 10.78,
      longitude: 106.71,
      batteryLevel: 65,
      recordedAt: measuredAt,
      accuracy: 8.5,
    });
    const payload = await update;

    assert.equal(payload.recordedAt, measuredAt);
    assert.equal(payload.timestamp, measuredAt);
    assert.equal(payload.accuracy, 8.5);

    const cacheWrite = cacheWrites.find((write) => write.key === lastLocationKey(member.id));
    assert.equal(cacheWrite.value.recordedAt, measuredAt);
    assert.equal(cacheWrite.value.accuracy, 8.5);

    const history = await LocationHistory.findOne({ userId: member.id }).lean();
    assert.equal(history.timestamp.toISOString(), measuredAt);
    await t.disconnect(viewer, sender);
  });

  it('falls back to server time for timestamps too far in the future or past', async () => {
    for (const [name, recordedAt] of [
      ['FutureLocation', new Date(Date.now() + 2 * 60 * 1000).toISOString()],
      ['OldLocation', new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()],
    ]) {
      const { member, viewer, sender } = await connectedMember(name);
      const before = Date.now();
      const update = waitForEvent(viewer, 'location_update');
      sender.emit('update_location', { latitude: 10.79, longitude: 106.72, recordedAt });
      const payload = await update;
      const effectiveTime = Date.parse(payload.recordedAt);

      assert.ok(effectiveTime >= before, `${name} should use server time`);
      assert.ok(effectiveTime <= Date.now());
      assert.notEqual(payload.recordedAt, recordedAt);

      const history = await LocationHistory.findOne({ userId: member.id }).lean();
      assert.equal(history.timestamp.toISOString(), payload.recordedAt);
      await t.disconnect(viewer, sender);
    }
  });

  it('does not overwrite lastKnownLocation with a late older point', async () => {
    const { member, viewer, sender } = await connectedMember('LateLocation');
    const newerAt = new Date(Date.now() - 60 * 1000).toISOString();
    const olderAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    let update = waitForEvent(viewer, 'location_update');
    sender.emit('update_location', { latitude: 10.8, longitude: 106.8, recordedAt: newerAt });
    await update;

    update = waitForEvent(viewer, 'location_update');
    sender.emit('update_location', { latitude: 11.0, longitude: 107.0, recordedAt: olderAt });
    await update;

    const user = await User.findById(member.id).lean();
    assert.deepEqual(user.lastKnownLocation.coordinates, [106.8, 10.8]);
    assert.equal(user.lastKnownLocation.updatedAt.toISOString(), newerAt);

    const history = await LocationHistory.find({ userId: member.id }).sort({ timestamp: 1 }).lean();
    assert.equal(history.length, 2);
    assert.deepEqual(history.map((point) => point.timestamp.toISOString()), [olderAt, newerAt]);
    await t.disconnect(viewer, sender);
  });

  it('rejects invalid accuracy and malformed recordedAt values', async () => {
    const { viewer, sender } = await connectedMember('InvalidAccuracy');
    for (const invalidFields of [{ accuracy: -1 }, { accuracy: '8.5' }, { recordedAt: 'not-a-date' }]) {
      const error = waitForEvent(sender, 'error');
      sender.emit('update_location', { latitude: 10.8, longitude: 106.8, ...invalidFields });
      const payload = await error;
      assert.equal(payload.message, 'Invalid location payload.');
      assert.ok(payload.errors.some((issue) => issue.field === Object.keys(invalidFields)[0]));
    }
    await t.disconnect(viewer, sender);
  });
});
