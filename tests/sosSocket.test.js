const { describe, it, before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startTestServer, waitForEvent, expectNoEvent } = require('./helpers/testServer');
const { createSosSocketLimiter } = require('../src/infrastructure/security/sosSocketLimiter');
const SosIncident = require('../src/infrastructure/database/models/SosIncident');
const ChatMessage = require('../src/infrastructure/database/models/ChatMessage');

test('SOS socket limiter shares account quota and expires bounded state without active-key eviction', () => {
  let at = 0;
  const limiter = createSosSocketLimiter({ limit: 2, maxKeys: 1, now: () => at });
  limiter.consume('user'); limiter.consume('user');
  assert.throws(() => limiter.consume('user'), { status: 429 });
  assert.throws(() => limiter.consume('other'), { status: 429 });
  at = 60000;
  limiter.consume('other');
});

describe('Persisted SOS Socket backward compatibility', { timeout: 120000 }, () => {
  let t, owner, helper, socket, receiver, group;
  before(async () => {
    t = await startTestServer({ env: { SOS_API_ENABLED: 'true', SOS_OUTBOX_ENABLED: 'true', SOS_OUTBOX_POLL_MS: '100', SOS_RATE_LIMIT: '3' } });
    owner = await t.registerUser('SocketSosOwner'); helper = await t.registerUser('SocketSosHelper');
    group = await t.createGroup(owner, 'Socket SOS Circle'); await t.joinGroup(helper, group);
    const second = await t.createGroup(owner, 'Another Circle'); await t.joinGroup(helper, second);
    socket = await t.connect(owner.token); receiver = await t.connect(helper.token);
  });
  after(async () => { if (t) await t.stop(); });

  it('persists while sharing paused; keeps legacy alert fields and adds stable SOS identity', async () => {
    await t.api('PATCH', '/api/v1/privacy/location-sharing', { token: owner.token, body: { enabled: false } });
    const clientRequestId = randomUUID();
    const confirmed = waitForEvent(socket, 'sos_confirmed');
    const urgent = waitForEvent(receiver, 'sos_alert', 5000);
    const noSelfAlert = expectNoEvent(socket, 'sos_alert', 500);
    socket.emit('sos_alert', { clientRequestId, message: 'Help', latitude: 10, longitude: 106, batteryLevel: 75 });
    const confirmation = await confirmed;
    assert.equal(confirmation.groupCount, 2);
    assert.equal(confirmation.created, true);
    assert.equal(confirmation.status, 'active');
    const alert = await urgent;
    assert.equal(alert.type, 'SOS'); assert.equal(alert.userId, owner.id);
    assert.equal(alert.name, owner.name); assert.ok(alert.groupId); assert.ok(alert.groupName);
    assert.equal(alert.latitude, 10); assert.equal(alert.longitude, 106); assert.equal(alert.batteryLevel, 75);
    assert.ok(Number.isFinite(Date.parse(alert.timestamp)));
    assert.equal(alert.sosId, confirmation.sosId); assert.ok(alert.eventId);
    await noSelfAlert;
    assert.equal(await ChatMessage.countDocuments({ 'sos.id': confirmation.sosId }), 2);
    const replay = await t.api('POST', '/api/v1/sos', { token: owner.token, body: { clientRequestId } });
    assert.equal(replay.status, 200); assert.equal(replay.body.data.incident.id, confirmation.sosId);
    const noDuplicate = expectNoEvent(receiver, 'sos_alert', 400);
    const legacyReplay = waitForEvent(socket, 'sos_confirmed');
    socket.emit('sos_alert');
    assert.equal((await legacyReplay).created, false);
    await noDuplicate;
  });

  it('shares rate quota across reconnect and returns structured errors', async () => {
    await t.disconnect(socket);
    socket = await t.connect(owner.token);
    const third = waitForEvent(socket, 'sos_confirmed'); socket.emit('sos_alert', {}); await third;
    const limited = waitForEvent(socket, 'error'); socket.emit('sos_alert', {});
    assert.equal((await limited).code, 'RATE_LIMITED');
    const invalid = waitForEvent(socket, 'error'); socket.emit('sos_alert', { clientRequestId: 'invalid' });
    assert.ok((await invalid).errors);
  });

  it('accepts legacy incomplete location without persisting an invalid GPS pair', async () => {
    const legacy = await t.registerUser('LegacySosOwner');
    const circle = await t.createGroup(legacy, 'Legacy Circle'); await t.joinGroup(helper, circle);
    const client = await t.connect(legacy.token);
    const confirmation = waitForEvent(client, 'sos_confirmed');
    client.emit('sos_alert', { latitude: 10, batteryLevel: -1 });
    const result = await confirmation;
    const saved = await SosIncident.findById(result.sosId).lean();
    assert.equal(saved.location, null); assert.equal(saved.batteryLevel, 0);
    const conflict = waitForEvent(client, 'error'); client.emit('sos_alert', { clientRequestId: randomUUID() });
    assert.equal((await conflict).code, 'CONFLICT');
  });
});
