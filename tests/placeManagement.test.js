const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers/testServer');
const FavoritePlace = require('../src/infrastructure/database/models/FavoritePlace');
const MemberPlaceLabel = require('../src/infrastructure/database/models/MemberPlaceLabel');
const placeRepo = require('../src/infrastructure/repositories/placeRepository');
const groupRepo = require('../src/infrastructure/repositories/groupRepository');
const { createPlaceUseCases } = require('../src/application/places/placeUseCases');
const { createUnitOfWork } = require('../src/infrastructure/database/unitOfWork');

describe('Circle saved-place management and personal labels', { timeout: 120000 }, () => {
  let t, alice, bob, carol, outsider, circle, other;
  const base = () => `/api/v1/groups/${circle.id}`;
  const body = { name: 'Cafe', category: 'cafe', latitude: 10.77, longitude: 106.7 };
  async function create(owner = bob) {
    const res = await t.api('POST', `${base()}/places`, { token: owner.token, body });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  }
  const api = (method, path, owner, payload) => t.api(method, base() + path, { token: owner.token, body: payload });
  before(async () => {
    t = await startTestServer();
    [alice, bob, carol, outsider] = await Promise.all(['Alice', 'Bob', 'Carol', 'Outsider'].map(t.registerUser));
    circle = await t.createGroup(alice, 'Family');
    other = await t.createGroup(outsider, 'Other');
    await t.joinGroup(bob, circle);
    await t.joinGroup(carol, circle);
  });
  after(() => t?.stop());

  it('serves all new operations and DTOs in the generated OpenAPI document', async () => {
    const { status, body: spec } = await t.api('GET', '/api-docs.json');
    assert.equal(status, 200);
    for (const [path, methods] of [
      ['/places/{placeId}', ['get', 'patch', 'delete']],
      ['/me/place-labels', ['get']],
      ['/me/place-labels/{label}', ['put', 'delete']],
    ]) {
      for (const method of methods) assert.ok(spec.paths[`/api/v1/groups/{groupId}${path}`]?.[method]);
    }
    assert.ok(spec.components.schemas.SavedPlace.properties.revision);
    assert.ok(spec.components.schemas.PersonalPlaceLabel.properties.placeId);
  });

  it('keeps legacy create/list serialization and adds revision zero', async () => {
    const p = await create();
    assert.equal(p.revision, 0);
    assert.equal(p.category, 'cafe');
    assert.equal(p.latitude, body.latitude);
    assert.equal(p.addedBy.id, bob.id);
    const list = await api('GET', '/places', carol);
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((v) => v.id === p.id));
    assert.equal((await api('GET', `/places/${p.id}`, carol)).body.data.longitude, body.longitude);
  });

  it('allows only current creator or admin to edit, with scoped lookup', async () => {
    const p = await create();
    assert.equal((await api('PATCH', `/places/${p.id}`, carol, { revision: 0, name: 'No' })).status, 403);
    assert.equal((await api('PATCH', `/places/${p.id}`, outsider, { revision: 0, name: 'No' })).status, 403);
    const first = await api('PATCH', `/places/${p.id}`, bob, { revision: 0, name: 'Office' });
    assert.equal(first.status, 200);
    assert.equal(first.body.data.revision, 1);
    const second = await api('PATCH', `/places/${p.id}`, alice, { revision: 1, latitude: 21, longitude: 105 });
    assert.equal(second.status, 200);
    assert.deepEqual(second.body.data.location.coordinates, [105, 21]);
    assert.equal((await t.api('GET', `/api/v1/groups/${other.id}/places/${p.id}`, { token: outsider.token })).status, 404);
  });

  it('rejects invalid coordinates, no-op/unknown fields and missing revisions', async () => {
    const p = await create();
    for (const patch of [{ name: 'No revision' }, { revision: 0 }, { revision: 0, latitude: 0 },
      { revision: 0, latitude: 91, longitude: 0 }, { revision: -1, name: 'No' },
      { revision: 0, addedBy: alice.id }, { revision: 0, name: ' ' }]) {
      assert.equal((await api('PATCH', `/places/${p.id}`, bob, patch)).status, 400, JSON.stringify(patch));
    }
    assert.equal((await api('DELETE', `/places/${p.id}`, bob)).status, 400);
    assert.equal((await api('GET', '/places/not-an-id', bob)).status, 400);
    assert.equal((await t.api('GET', `${base()}/places/${p.id}`)).status, 401);
  });

  it('CAS admits one of two concurrent updates and preserves legacy missing revision', async () => {
    const p = await create();
    const results = await Promise.all(['A', 'B'].map((name) => api('PATCH', `/places/${p.id}`, bob, { revision: 0, name })));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await api('GET', `/places/${p.id}`, bob)).body.data.revision, 1);
    const legacy = await create();
    await FavoritePlace.updateOne({ _id: legacy.id }, { $unset: { revision: 1 } });
    assert.equal((await api('GET', `/places/${legacy.id}`, bob)).body.data.revision, 0);
    const updated = await api('PATCH', `/places/${legacy.id}`, bob, { revision: 0, name: 'Legacy' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.revision, 1);
  });

  it('keeps each member shortcut private, replaceable and retry-safe', async () => {
    const one = await create(), two = await create();
    for (let i = 0; i < 2; i++) assert.equal((await api('PUT', '/me/place-labels/home', bob, { placeId: one.id })).status, 200);
    await api('PUT', '/me/place-labels/home', carol, { placeId: two.id });
    let labels = await api('GET', '/me/place-labels', bob);
    assert.equal(labels.body.data.length, 1);
    assert.equal(labels.body.data[0].placeId.id, one.id);
    assert.equal(labels.body.data[0].userId, bob.id);
    assert.equal((await api('GET', '/me/place-labels', carol)).body.data[0].placeId.id, two.id);
    await api('PUT', '/me/place-labels/home', bob, { placeId: two.id });
    labels = await api('GET', '/me/place-labels', bob);
    assert.equal(labels.body.data.length, 1);
    assert.equal(labels.body.data[0].placeId.id, two.id);
    assert.equal((await api('DELETE', '/me/place-labels/home', bob)).body.data.removed, true);
    assert.equal((await api('DELETE', '/me/place-labels/home', bob)).body.data.removed, false);
  });

  it('validates custom labels and rejects owner spoofing or foreign places', async () => {
    const p = await create();
    assert.equal((await api('PUT', '/me/place-labels/custom', bob, { placeId: p.id })).status, 400);
    const custom = await api('PUT', '/me/place-labels/custom', bob, { placeId: p.id, customLabel: ' Gym ' });
    assert.equal(custom.status, 200);
    assert.equal(custom.body.data.customLabel, 'Gym');
    assert.equal((await api('PUT', '/me/place-labels/work', bob, { placeId: p.id, customLabel: 'No' })).status, 400);
    assert.equal((await api('PUT', '/me/place-labels/work', bob, { placeId: p.id, userId: carol.id })).status, 400);
    assert.equal((await api('PUT', '/me/place-labels/school', bob, { placeId: p.id })).status, 400);
    assert.equal((await api('GET', '/me/place-labels', outsider)).status, 403);
    const foreign = await t.api('POST', `/api/v1/groups/${other.id}/places`, { token: outsider.token, body });
    assert.equal((await api('PUT', '/me/place-labels/work', bob, { placeId: foreign.body.data.id })).status, 404);
  });

  it('delete rejects stale revision, then atomically removes all referring labels', async () => {
    const p = await create();
    await api('PUT', '/me/place-labels/work', bob, { placeId: p.id });
    await api('PUT', '/me/place-labels/work', carol, { placeId: p.id });
    assert.equal((await api('DELETE', `/places/${p.id}?revision=0`, carol)).status, 403);
    assert.equal((await api('DELETE', `/places/${p.id}?revision=1`, bob)).status, 409);
    assert.equal(await MemberPlaceLabel.countDocuments({ placeId: p.id }), 2);
    assert.equal((await api('DELETE', `/places/${p.id}?revision=0`, alice)).status, 200);
    assert.equal(await MemberPlaceLabel.countDocuments({ placeId: p.id }), 0);
    assert.equal((await api('GET', `/places/${p.id}`, bob)).status, 404);
  });

  it('serializes label assignment versus deletion without orphan labels', async () => {
    for (let i = 0; i < 3; i++) {
      const p = await create();
      const [set, del] = await Promise.all([
        api('PUT', '/me/place-labels/leisure', carol, { placeId: p.id }),
        api('DELETE', `/places/${p.id}?revision=0`, bob),
      ]);
      assert.ok([200, 404].includes(set.status), JSON.stringify(set));
      assert.equal(del.status, 200);
      assert.equal(await MemberPlaceLabel.countDocuments({ placeId: p.id }), 0);
    }
  });

  it('revokes creator writes and label access after leave, retaining private labels for rejoin', async () => {
    const p = await create();
    await api('PUT', '/me/place-labels/work', bob, { placeId: p.id });
    const [write, leave] = await Promise.all([
      api('PATCH', `/places/${p.id}`, bob, { revision: 0, name: 'Race' }),
      api('DELETE', '/members/me', bob),
    ]);
    assert.ok([200, 403].includes(write.status));
    assert.equal(leave.status, 200);
    assert.equal((await api('PATCH', `/places/${p.id}`, bob, { revision: 0, name: 'Denied' })).status, 403);
    assert.equal((await api('GET', '/me/place-labels', bob)).status, 403);
    await t.joinGroup(bob, circle);
    const labels = await api('GET', '/me/place-labels', bob);
    assert.ok(labels.body.data.some((v) => v.label === 'work' && v.placeId.id === p.id));
  });

  it('rolls place deletion back if cascade cleanup fails', async () => {
    const p = await create();
    await api('PUT', '/me/place-labels/home', bob, { placeId: p.id });
    const places = createPlaceUseCases({ groupRepo,
      placeRepo: { ...placeRepo, async deletePlaceLabels() { throw new Error('injected cascade failure'); } },
      unitOfWork: createUnitOfWork({ supportsTransactions: true }),
    });
    await assert.rejects(places.deletePlace({ userId: bob.id, groupId: circle.id, placeId: p.id, revision: 0 }), /injected cascade failure/);
    assert.ok(await FavoritePlace.exists({ _id: p.id }));
    assert.equal(await MemberPlaceLabel.countDocuments({ placeId: p.id }), 1);
  });

  it('fails new mutations closed when transaction support is unavailable', async () => {
    const places = createPlaceUseCases({ groupRepo: {}, placeRepo: {}, unitOfWork: { run: (work) => work(null) } });
    await assert.rejects(places.deletePlace({ userId: bob.id, groupId: circle.id, placeId: 'unused', revision: 0 }),
      (error) => error.status === 503 && error.code === 'SERVICE_UNAVAILABLE');
  });
});
