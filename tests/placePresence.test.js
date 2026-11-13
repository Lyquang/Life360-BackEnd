const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { advancePlacePresence } = require('../src/domain/placePresence');
const { createPlacePresenceUseCases } = require('../src/application/places/placePresenceUseCases');
const { createUnitOfWork } = require('../src/infrastructure/database/unitOfWork');
const { startTestServer } = require('./helpers/testServer');
const groupRepo = require('../src/infrastructure/repositories/groupRepository');
const userRepo = require('../src/infrastructure/repositories/userRepository');
const placeRepo = require('../src/infrastructure/repositories/placeRepository');
const PlacePresence = require('../src/infrastructure/database/models/PlacePresence');
const MemberPlaceLabel = require('../src/infrastructure/database/models/MemberPlaceLabel');
const FavoritePlace = require('../src/infrastructure/database/models/FavoritePlace');
const User = require('../src/infrastructure/database/models/User');
const Group = require('../src/infrastructure/database/models/Group');

const origin = new Date('2026-01-01T00:00:00Z').getTime();
const context = { privacyVersion: 0, membershipVersion: 0, privacyUpdatedAt: null, membershipUpdatedAt: null };
const label = { id: 'label', placeId: 'place', placeRevision: 0, updatedAt: null,
  placeUpdatedAt: null, latitude: 0, longitude: 0 };
function step(previous, seconds, extra = {}, labels = [label], ctx = context) {
  const now = new Date(origin + seconds * 1000);
  return advancePlacePresence({ previous, now, point: { latitude: 0, longitude: 0,
    recordedAt: now, accuracy: 5, ...extra }, labels, context: ctx });
}
function confirmed() { return step(step(step(null, 0), 60), 120); }

describe('pure saved-place presence policy', () => {
  it('requires distinct reliable fixes spanning two minutes', () => {
    assert.equal(step(null, 0).confirmed, false);
    assert.equal(step(step(null, 0), 60).confirmed, false);
    assert.equal(confirmed().confirmed, true);
  });
  it('ignores missing/stale/future/replayed source times, not server fallback', () => {
    const prev = confirmed();
    assert.equal(step(prev, 120), null);
    assert.equal(step(prev, 100), null);
    assert.equal(step(null, 0, { recordedAt: undefined }), null);
    assert.equal(step(null, 0, { recordedAt: new Date(origin - 301000) }), null);
    assert.equal(step(null, 0, { recordedAt: new Date(origin + 6000) }), null);
  });
  it('resets uncertain fixes, continuity gaps, outside and overlaps', () => {
    assert.equal(step(confirmed(), 130, { accuracy: 100 }).confirmed, false);
    assert.equal(step(confirmed(), 130, { accuracy: undefined }).confirmed, false);
    assert.equal(step(confirmed(), 211).confirmed, false);
    assert.equal(step(confirmed(), 130, { longitude: 0.01 }).placeId, null);
    assert.equal(step(null, 0, {}, [label, { ...label, id: 'other' }]).placeId, null);
  });
  it('keeps confirmed presence within exit hysteresis, but not beyond it', () => {
    assert.equal(step(confirmed(), 130, { longitude: 0.00108 }).confirmed, true);
    assert.equal(step(confirmed(), 130, { longitude: 0.0015 }).confirmed, false);
  });
  it('resets changed privacy, membership, label, place and reassignment contexts', () => {
    const prev = confirmed();
    assert.equal(step(prev, 130, {}, [label], { ...context, privacyVersion: 1 }).confirmed, false);
    assert.equal(step(prev, 130, {}, [label], { ...context, membershipVersion: 1 }).confirmed, false);
    assert.equal(step(prev, 130, {}, [{ ...label, placeRevision: 1 }]).confirmed, false);
    assert.equal(step(prev, 130, {}, [{ ...label, placeId: 'replacement' }]).confirmed, false);
    assert.equal(step(prev, 130, {}, [{ ...label, updatedAt: new Date(origin + 1000) }]).confirmed, false);
  });
});

describe('durable Circle presence HTTP/privacy integration', { timeout: 120000 }, () => {
  let t, alice, bob, outsider, circle, place, projector, base;
  const url = () => `/api/v1/groups/${circle.id}`;
  const api = (method, path, owner = bob, body) => t.api(method, url() + path, { token: owner.token, body });
  function makeProjector() {
    return createPlacePresenceUseCases({ groupRepo, userRepo, placeRepo,
      unitOfWork: createUnitOfWork({ supportsTransactions: true }) });
  }
  async function backdate(groupId) {
    const at = new Date(base - 5000);
    await Group.updateOne({ _id: groupId }, { $set: { placeMembershipUpdatedAt: at } });
    await MemberPlaceLabel.updateMany({ groupId }, { $set: { updatedAt: at } }, { timestamps: false });
    await FavoritePlace.updateMany({ groupId }, { $set: { updatedAt: at } }, { timestamps: false });
  }
  async function project(seconds, extra = {}) {
    await projector.project({ userId: bob.id, latitude: 10.77, longitude: 106.7,
      recordedAt: new Date(base + seconds * 1000).toISOString(), accuracy: 5, ...extra });
  }
  async function establish() { for (const seconds of [0, 60, 120]) await project(seconds); }
  async function row() {
    const res = await api('GET', '/place-presence', alice);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data.find((entry) => entry.userId === bob.id);
  }
  before(async () => {
    t = await startTestServer();
    [alice, bob, outsider] = await Promise.all(['Alice', 'Bob', 'Outsider'].map(t.registerUser));
    circle = await t.createGroup(alice, 'Family');
    await t.joinGroup(bob, circle);
    projector = makeProjector();
  });
  beforeEach(async () => {
    base = Date.now() - 130000;
    await PlacePresence.deleteMany({});
    await MemberPlaceLabel.deleteMany({ userId: bob.id });
    await User.updateOne({ _id: bob.id }, { $set: { locationSharing: {
      enabled: true, pausedUntil: null, updatedAt: new Date(base - 5000),
    } }, $inc: { placePrivacyVersion: 1 } });
    const created = await api('POST', '/places', bob, { name: 'Office', category: 'other', latitude: 10.77, longitude: 106.7 });
    assert.equal(created.status, 201);
    place = created.body.data;
    assert.equal((await api('PUT', '/me/place-labels/work', bob, { placeId: place.id })).status, 200);
    await backdate(circle.id);
  });
  after(() => t?.stop());

  it('recognizes dwell from shared evidence, exposes no GPS and survives new use-case instance', async () => {
    await project(0);
    assert.equal((await row()).status, 'unknown');
    await project(60); await project(120);
    const current = await row();
    assert.equal(current.status, 'at_place');
    assert.equal(current.place.id, place.id);
    assert.equal(current.place.label, 'work');
    assert.equal(current.latitude, undefined);
    assert.equal(current.place.longitude, undefined);
    projector = makeProjector();
    const restored = await projector.snapshot({ userId: alice.id, groupId: circle.id });
    assert.equal(restored.data.find((entry) => entry.userId === bob.id).status, 'at_place');
  });
  it('ignores old/replayed timestamps and expires stale or uncertain presence', async () => {
    await establish();
    await project(30, { longitude: 0 });
    assert.equal((await row()).status, 'at_place');
    await project(125, { accuracy: 100 });
    assert.equal((await row()).status, 'unknown');
    await establish(); // Replayed points cannot restore after the newer uncertain fix.
    assert.equal((await row()).status, 'unknown');
    await PlacePresence.updateOne({ groupId: circle.id, userId: bob.id }, { $set: { confirmed: true, expiresAt: new Date(0) } });
    assert.equal((await row()).status, 'unknown');
  });
  it('suppresses old evidence through pause/resume even with identical timestamp epochs', async () => {
    await establish();
    const before = await User.findById(bob.id).select('+placePrivacyVersion');
    const at = before.locationSharing.updatedAt;
    await userRepo.setLocationSharing(bob.id, { enabled: false, pausedUntil: null, updatedAt: at });
    assert.equal((await row()).status, 'unknown');
    await userRepo.setLocationSharing(bob.id, { enabled: true, pausedUntil: null, updatedAt: at });
    assert.equal((await row()).status, 'unknown');
    const after = await User.findById(bob.id).select('+placePrivacyVersion');
    assert.equal(after.placePrivacyVersion, before.placePrivacyVersion + 2);
  });
  it('invalidates label reassignment/removal and edited place revision immediately on read', async () => {
    await establish();
    assert.equal((await row()).status, 'at_place');
    const edited = await api('PATCH', `/places/${place.id}`, bob, { revision: 0, name: 'Updated' });
    assert.equal(edited.status, 200);
    assert.equal((await row()).status, 'unknown');
    await api('DELETE', '/me/place-labels/work');
    assert.equal((await row()).status, 'unknown');
  });
  it('does not restore old labels when a member leaves and rejoins', async () => {
    await establish();
    assert.equal((await api('DELETE', '/members/me')).status, 200);
    assert.equal((await api('GET', '/place-presence')).status, 403);
    assert.equal(await row(), undefined);
    await t.joinGroup(bob, circle);
    assert.equal((await row()).status, 'unknown');
  });
  it('paginates member IDs, enforces auth/limits and serves OpenAPI', async () => {
    const first = await api('GET', '/place-presence?limit=1', alice);
    assert.equal(first.status, 200);
    assert.equal(first.body.data.length, 1);
    assert.equal(first.body.pagination.hasMore, true);
    const next = await api('GET', `/place-presence?limit=1&cursor=${first.body.pagination.nextCursor}`, alice);
    assert.equal(next.body.data.length, 1);
    assert.notEqual(first.body.data[0].userId, next.body.data[0].userId);
    assert.equal((await api('GET', '/place-presence', outsider)).status, 403);
    assert.equal((await api('GET', '/place-presence?limit=101')).status, 400);
    assert.equal((await api('GET', '/place-presence?cursor=bad')).status, 400);
    assert.equal((await t.api('GET', url() + '/place-presence')).status, 401);
    const spec = await t.api('GET', '/api-docs.json');
    assert.ok(spec.body.paths['/api/v1/groups/{groupId}/place-presence'].get);
  });
  it('serializes concurrent projection writes, preserving the latest source fix', async () => {
    await Promise.all([project(60), project(120), project(0)]);
    const state = await PlacePresence.findOne({ groupId: circle.id, userId: bob.id });
    assert.equal(state.sourceFixAt.getTime(), base + 120000);
  });
  it('isolates labels across Circles and invalidates a deleted shared place', async () => {
    const second = await t.createGroup(alice, 'Second');
    await t.joinGroup(bob, second);
    const path = `/api/v1/groups/${second.id}`;
    const added = await t.api('POST', path + '/places', { token: bob.token,
      body: { name: 'Other home', category: 'other', latitude: 10.77, longitude: 106.7 } });
    await t.api('PUT', path + '/me/place-labels/home', { token: bob.token, body: { placeId: added.body.data.id } });
    await backdate(second.id);
    await establish();
    assert.equal((await row()).place.name, 'Office');
    const otherSnapshot = await t.api('GET', path + '/place-presence', { token: alice.token });
    assert.equal(otherSnapshot.body.data.find((entry) => entry.userId === bob.id).place.name, 'Other home');
    assert.equal((await api('DELETE', `/places/${place.id}?revision=0`)).status, 200);
    assert.equal((await row()).status, 'unknown');
  });
  it('wires original-time realtime projection and isolates projection failures from GPS', async () => {
    const cases = t.instance.container.useCases;
    const input = { userId: bob.id, userName: bob.name, latitude: 10.77, longitude: 106.7,
      recordedAt: new Date().toISOString(), accuracy: 5 };
    await cases.location.updateLocation(input);
    const state = await PlacePresence.findOne({ groupId: circle.id, userId: bob.id });
    assert.ok(state);
    assert.equal(state.sourceFixAt.toISOString(), input.recordedAt);
    const original = cases.placePresence.project;
    cases.placePresence.project = async () => { throw new Error('synthetic projection failure'); };
    try {
      await assert.doesNotReject(cases.location.updateLocation({ ...input,
        latitude: 10.8, recordedAt: new Date().toISOString() }));
    } finally { cases.placePresence.project = original; }
  });
  it('does not promote timestamp-fallback or offline batch points into live evidence', async () => {
    const cases = t.instance.container.useCases;
    await cases.location.updateLocation({ userId: bob.id, userName: bob.name,
      latitude: 11, longitude: 107, accuracy: 5,
      recordedAt: new Date(Date.now() - 2 * 86400000).toISOString() });
    assert.equal(await PlacePresence.countDocuments({ userId: bob.id }), 0);
    await cases.location.syncBatch({ userId: bob.id, userName: bob.name, points: [{
      index: 0, pointId: require('node:crypto').randomUUID(), latitude: 10.77, longitude: 106.7,
      recordedAt: new Date(), accuracy: 5,
    }] });
    assert.equal(await PlacePresence.countDocuments({ userId: bob.id }), 0);
  });
});
