const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startTestServer, waitForEvent, expectNoEvent } = require('./helpers/testServer');
const SosIncident = require('../src/infrastructure/database/models/SosIncident');
const SosResponse = require('../src/infrastructure/database/models/SosResponse');
const SosOutbox = require('../src/infrastructure/database/models/SosOutbox');
const ChatMessage = require('../src/infrastructure/database/models/ChatMessage');

describe('SOS REST and outbox Socket delivery', { timeout: 120000 }, () => {
  let t, owner, helper, stranger, group, sosId, request;
  before(async () => {
    t = await startTestServer({ env: { SOS_API_ENABLED: 'true', SOS_OUTBOX_ENABLED: 'true', SOS_OUTBOX_POLL_MS: '100', SOS_RATE_LIMIT: '30' } });
    await Promise.all([SosIncident.init(), SosResponse.init(), SosOutbox.init(), ChatMessage.init()]);
    owner = await t.registerUser('SosOwner'); helper = await t.registerUser('SosHelper'); stranger = await t.registerUser('SosStranger');
    group = await t.createGroup(owner, 'SOS Circle'); await t.joinGroup(helper, group);
    request = { clientRequestId: randomUUID(), message: 'Please help', latitude: 10, longitude: 106 };
  });
  after(async () => { if (t) await t.stop(); });

  it('authenticates and validates IDs, fields and paired coordinates before writes', async () => {
    const spec = await t.api('GET', '/api-docs.json');
    assert.ok(spec.body.paths['/api/v1/sos'].post);
    assert.ok(spec.body.paths['/api/v1/sos/{id}'].get);
    assert.ok(spec.body.paths['/api/v1/sos/{id}'].patch);
    assert.ok(spec.body.paths['/api/v1/sos/{id}/responses'].post);
    assert.equal((await t.api('POST', '/api/v1/sos', { body: request })).status, 401);
    for (const body of [{}, { ...request, clientRequestId: 'bad' }, { ...request, longitude: undefined },
      { ...request, userId: stranger.id }, { ...request, message: 'x'.repeat(501) }, { ...request, recordedAt: 'bad' }]) {
      assert.equal((await t.api('POST', '/api/v1/sos', { token: owner.token, body })).status, 400);
    }
    assert.equal(await SosIncident.countDocuments(), 0);
    assert.equal((await t.api('GET', '/api/v1/sos/invalid', { token: owner.token })).status, 400);
  });

  it('creates persisted SOS/chat, delivers via worker, and replays HTTP requests without duplicates', async () => {
    const socket = await t.connect(helper.token);
    const outsiderSocket = await t.connect(stranger.token);
    const alert = waitForEvent(socket, 'sos_alert', 5000);
    const chat = waitForEvent(socket, 'chat:new_message', 5000);
    const noLeak = expectNoEvent(outsiderSocket, 'sos_alert', 500);
    const result = await t.api('POST', '/api/v1/sos', { token: owner.token, body: request });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    sosId = result.body.data.incident.id;
    assert.equal((await alert).sosId, sosId);
    assert.equal((await chat).sos.id, sosId);
    await noLeak;
    const replay = await t.api('POST', '/api/v1/sos', { token: owner.token, body: request });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.data.created, false);
    assert.equal(await ChatMessage.countDocuments({ 'sos.id': sosId }), 1);
    assert.equal((await t.api('POST', '/api/v1/sos', { token: owner.token, body: { ...request, clientRequestId: randomUUID() } })).status, 409);
    await t.disconnect(socket, outsiderSocket);
  });

  it('enforces audience, commits assistance once, and only owner closes', async () => {
    const path = `/api/v1/sos/${sosId}`;
    assert.equal((await t.api('GET', path, { token: stranger.token })).status, 403);
    assert.equal((await t.api('GET', `${path}?limit=101`, { token: owner.token })).status, 400);
    assert.equal((await t.api('POST', `${path}/responses`, { token: helper.token, body: { status: 'going' } })).status, 400);
    const ownerSocket = await t.connect(owner.token);
    const update = waitForEvent(ownerSocket, 'sos:updated', 5000);
    const accepted = await t.api('POST', `${path}/responses`, { token: helper.token, body: { status: 'coming' } });
    assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
    assert.equal((await update).sosId, sosId);
    assert.equal((await t.api('POST', `${path}/responses`, { token: helper.token, body: { status: 'coming' } })).status, 200);
    const snapshot = await t.api('GET', `${path}?limit=1`, { token: owner.token });
    assert.equal(snapshot.body.data.responders[0].responderId, helper.id);
    assert.equal((await t.api('PATCH', path, { token: helper.token, body: { status: 'resolved' } })).status, 403);
    assert.equal((await t.api('PATCH', path, { token: owner.token, body: { status: 'resolved' } })).body.data.changed, true);
    assert.equal((await t.api('PATCH', path, { token: owner.token, body: { status: 'resolved' } })).body.data.changed, false);
    assert.equal((await t.api('POST', '/api/v1/sos', { token: owner.token, body: request })).status, 200);
    assert.equal((await t.api('GET', '/api/v1/sos/000000000000000000000001', { token: owner.token })).status, 404);
    await t.disconnect(ownerSocket);
  });

  it('rate limits per account and supplies Retry-After', async () => {
    const limited = await t.registerUser('SosLimited');
    let response;
    for (let i = 0; i < 31; i++) {
      response = await fetch(`${t.baseUrl}/api/v1/sos/000000000000000000000001`, { headers: { Authorization: `Bearer ${limited.token}` } });
      await response.json();
    }
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers.get('Retry-After')) > 0);
  });
});

describe('SOS feature disabled', () => {
  let t;
  before(async () => { t = await startTestServer(); });
  after(async () => { if (t) await t.stop(); });
  it('returns controlled 503 for valid authenticated requests', async () => {
    const owner = await t.registerUser('DisabledSos');
    const result = await t.api('POST', '/api/v1/sos', { token: owner.token, body: { clientRequestId: randomUUID() } });
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'SERVICE_UNAVAILABLE');
  });
});
