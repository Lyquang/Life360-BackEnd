const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startTestServer } = require('./helpers/testServer');
const Group = require('../src/infrastructure/database/models/Group');

describe('SOS recovery list visibility and pagination', { timeout: 120000 }, () => {
  let t, a, b, viewer, outsider, ga, gb, hiddenGroup, first, second, hidden;
  async function create(owner) {
    const response = await t.api('POST', '/api/v1/sos', { token: owner.token, body: { clientRequestId: randomUUID() } });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.data.incident.id;
  }
  const list = (user, query = '') => t.api('GET', `/api/v1/sos${query}`, { token: user.token });
  before(async () => {
    t = await startTestServer({ env: { SOS_API_ENABLED: 'true', SOS_OUTBOX_ENABLED: 'true' } });
    a = await t.registerUser('ListOwnerA'); b = await t.registerUser('ListOwnerB');
    viewer = await t.registerUser('ListViewer'); outsider = await t.registerUser('ListOutsider');
    ga = await t.createGroup(a, 'Circle A'); gb = await t.createGroup(b, 'Circle B');
    hiddenGroup = await t.createGroup(outsider, 'Hidden');
    await t.joinGroup(viewer, ga); await t.joinGroup(viewer, gb);
    first = await create(a); second = await create(b); hidden = await create(outsider);
  });
  after(async () => { if (t) await t.stop(); });

  it('filters hidden newer incidents before limit and emits only authorized cursor IDs', async () => {
    const response = await list(viewer, '?limit=1');
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.data.items.map((item) => item.id), [second]);
    assert.equal(response.body.data.hasMore, true);
    assert.equal(response.body.data.nextCursor, second);
    const next = await list(viewer, `?limit=1&cursor=${second}`);
    assert.deepEqual(next.body.data.items.map((item) => item.id), [first]);
    assert.equal(next.body.data.hasMore, false);
    assert.equal(next.body.data.nextCursor, null);
    for (const item of [...response.body.data.items, ...next.body.data.items]) {
      const detail = await t.api('GET', `/api/v1/sos/${item.id}`, { token: viewer.token });
      assert.deepEqual(item, detail.body.data.incident);
      assert.equal(Object.hasOwn(item, 'recipientIds'), false);
      assert.equal(Object.hasOwn(item, 'audience'), false);
    }
  });

  it('does not grant access on later join and revokes list access on leave', async () => {
    await t.joinGroup(viewer, hiddenGroup);
    assert.ok(!(await list(viewer)).body.data.items.some((item) => item.id === hidden));
    await Group.updateOne({ _id: gb.id }, { $pull: { members: viewer.id } });
    const response = await list(viewer, '?limit=1');
    assert.deepEqual(response.body.data.items.map((item) => item.id), [first]);
    assert.equal(response.body.data.hasMore, false);
    assert.equal(response.body.data.nextCursor, null);
    assert.equal((await t.api('GET', `/api/v1/sos/${second}`, { token: viewer.token })).status, 403);
  });

  it('requires owner still in a shared Circle, while owner keeps historical access', async () => {
    await Group.updateOne({ _id: ga.id }, { $pull: { members: a.id } });
    assert.deepEqual((await list(viewer)).body.data, { items: [], hasMore: false, nextCursor: null });
    const ownerList = await list(a);
    assert.equal(ownerList.body.data.items[0].id, first);
    assert.deepEqual(ownerList.body.data.items[0].groupIds, []);
  });

  it('supports closed-state recovery and defaults to active without mutating incidents', async () => {
    const closed = await t.api('PATCH', `/api/v1/sos/${first}`, { token: a.token, body: { status: 'resolved' } });
    assert.equal(closed.status, 200);
    assert.deepEqual((await list(a)).body.data.items, []);
    assert.equal((await list(a, '?status=resolved')).body.data.items[0].id, first);
    assert.equal((await list(a, '?status=all')).body.data.items[0].status, 'resolved');
    assert.deepEqual((await list(a, '?status=expired')).body.data.items, []);
  });

  it('rejects missing auth, malformed cursors/status and spoofed identity', async () => {
    assert.equal((await t.api('GET', '/api/v1/sos')).status, 401);
    for (const query of ['?cursor=bad', '?status=unknown', '?limit=101', '?limit=0', `?userId=${b.id}`]) {
      assert.equal((await list(viewer, query)).status, 400);
    }
  });

  it('does not combine old audience in one Circle with new membership in another', async () => {
    const owner = await t.registerUser('CrossCircleOwner');
    const original = await t.createGroup(owner, 'Original Circle');
    const other = await t.createGroup(owner, 'Other Circle');
    await t.joinGroup(viewer, original);
    const incidentId = await create(owner);
    assert.ok((await list(viewer)).body.data.items.some((item) => item.id === incidentId));
    await Group.updateOne({ _id: original.id }, { $pull: { members: viewer.id } });
    await t.joinGroup(viewer, other);
    assert.ok(!(await list(viewer)).body.data.items.some((item) => item.id === incidentId));
    assert.equal((await t.api('GET', `/api/v1/sos/${incidentId}`, { token: viewer.token })).status, 403);
  });
});
