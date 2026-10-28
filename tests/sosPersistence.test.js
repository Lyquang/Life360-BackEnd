const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { assertCanOfferAssistance, assertSosActive } = require('../src/domain/sos');
const SosIncident = require('../src/infrastructure/database/models/SosIncident');
const SosResponse = require('../src/infrastructure/database/models/SosResponse');
const repo = require('../src/infrastructure/repositories/sosRepository');

const id = () => new mongoose.Types.ObjectId();
const transaction = (work) => mongoose.connection.transaction(work);
const incidentInput = (overrides = {}) => ({
  ownerId: id(), groupIds: [id()], recipientIds: [id()], ...overrides,
});
const create = (input = incidentInput()) => transaction((session) => repo.createIncident(input, { session }));

describe('SOS domain rules', () => {
  it('rejects missing/closed incidents and self-assistance', () => {
    assert.throws(() => assertSosActive(null), { status: 404 });
    for (const status of ['resolved', 'cancelled', 'expired']) {
      assert.throws(() => assertCanOfferAssistance({ status, ownerId: 'A' }, 'B'), { status: 409 });
    }
    assert.throws(() => assertCanOfferAssistance({ status: 'active', ownerId: 'A' }, 'A'), { status: 400 });
    assert.doesNotThrow(() => assertCanOfferAssistance({ status: 'active', ownerId: 'A' }, 'B'));
  });

  it('validates a complete optional location and nonempty group audience', () => {
    assert.equal(new SosIncident(incidentInput()).validateSync(), undefined);
    assert.ok(new SosIncident(incidentInput({ groupIds: [] })).validateSync());
    assert.ok(new SosIncident(incidentInput({ location: { latitude: 10 } })).validateSync());
    assert.ok(new SosIncident(incidentInput({ location: { latitude: 91, longitude: 106 } })).validateSync());
    assert.ok(new SosIncident(incidentInput({ clientRequestId: 'invalid' })).validateSync());
  });
});

describe('SOS persistence on MongoDB replica set', { timeout: 120000 }, () => {
  let replSet;
  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri('sos-persistence-test'));
    await Promise.all([SosIncident.init(), SosResponse.init()]);
  });
  after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('requires a transaction rather than silently performing partial writes', async () => {
    await assert.rejects(repo.createIncident(incidentInput()), /active MongoDB transaction/);
    await assert.rejects(repo.createResponse({ sosId: id(), responderId: id() }), /active MongoDB transaction/);
    assert.throws(() => repo.touchActive(id(), 1), /active MongoDB transaction/);
    assert.throws(() => repo.closeActive({ id: id() }), /active MongoDB transaction/);
    await assert.rejects(transaction((session) => repo.touchActive(id(), undefined, { session })), RangeError);
    await assert.rejects(transaction((session) => repo.closeActive({
      id: id(), expectedRevision: 1, status: 'resolved', closedAt: null,
    }, { session })), TypeError);
  });

  it('allows only one active incident per owner under concurrent requests', async () => {
    const input = incidentInput();
    const results = await Promise.allSettled([create(input), create(input)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.find((result) => result.status === 'rejected').reason.code, 11000);
    assert.equal(await SosIncident.countDocuments({ ownerId: input.ownerId }), 1);
  });

  it('keeps request-id deduplication after closure, with a partial index for legacy requests', async () => {
    const input = incidentInput({ clientRequestId: randomUUID() });
    const incident = await create(input);
    await transaction((session) => repo.closeActive({
      id: incident._id, expectedRevision: 1, status: 'resolved', closedAt: new Date(),
    }, { session }));
    await assert.rejects(create(input), { code: 11000 });
    assert.equal(String((await repo.findByRequestId(input.ownerId, input.clientRequestId.toUpperCase()))._id), String(incident._id));
    assert.equal(await repo.findByRequestId(input.ownerId, undefined), null);
    const legacy = await create(incidentInput({ ownerId: input.ownerId }));
    await transaction((session) => repo.closeActive({
      id: legacy._id, expectedRevision: 1, status: 'cancelled', closedAt: new Date(),
    }, { session }));
    const next = await create(incidentInput({ ownerId: input.ownerId }));
    assert.equal(String((await repo.findActiveByOwner(input.ownerId))._id), String(next._id));
    // These records are referenced by chat, so they must not have automatic deletion indexes.
    for (const model of [SosIncident, SosResponse]) {
      assert.ok((await model.collection.indexes()).every((index) => index.expireAfterSeconds === undefined));
    }
  });

  it('enforces one response per person while allowing multiple responders', async () => {
    const incident = await create();
    const responderId = id();
    const write = () => transaction((session) => repo.createResponse({ sosId: incident._id, responderId }, { session }));
    const results = await Promise.allSettled([write(), write()]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.find((result) => result.status === 'rejected').reason.code, 11000);
    await transaction((session) => repo.createResponse({ sosId: incident._id, responderId: id() }, { session }));
    assert.equal(await SosResponse.countDocuments({ sosId: incident._id }), 2);
    const saved = await repo.findResponse(incident._id, responderId);
    assert.equal(saved.status, 'coming');
    assert.ok(saved.respondedAt instanceof Date);
  });

  it('rolls back response and incident revision together on failure', async () => {
    const incident = await create();
    await assert.rejects(transaction(async (session) => {
      await repo.touchActive(incident._id, 1, { session });
      await repo.createResponse({ sosId: incident._id, responderId: id() }, { session });
      throw new Error('synthetic failure');
    }), /synthetic failure/);
    assert.equal((await repo.findIncidentById(incident._id)).revision, 1);
    assert.equal(await SosResponse.countDocuments({ sosId: incident._id }), 0);
  });

  it('serializes assistance and closure through the incident revision', async () => {
    const incident = await create();
    const results = await Promise.all([
      transaction(async (session) => {
        const touched = await repo.touchActive(incident._id, 1, { session });
        if (touched) await repo.createResponse({ sosId: incident._id, responderId: id() }, { session });
        return touched;
      }),
      transaction((session) => repo.closeActive({
        id: incident._id, expectedRevision: 1, status: 'resolved', closedAt: new Date(),
      }, { session })),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal((await repo.findIncidentById(incident._id)).revision, 2);
    assert.equal(await SosResponse.countDocuments({ sosId: incident._id }), results[0] ? 1 : 0);
    if (results[0]) {
      await transaction((session) => repo.closeActive({
        id: incident._id, expectedRevision: 2, status: 'resolved', closedAt: new Date(),
      }, { session }));
    }
    assert.equal(await transaction((session) => repo.touchActive(incident._id, 2, { session })), null);
    await assert.rejects(transaction((session) => repo.closeActive({
      id: incident._id, expectedRevision: 2, status: 'active', closedAt: new Date(),
    }, { session })), { status: 400 });
  });

  it('paginates responders within one incident with bounded page sizes', async () => {
    const first = await create();
    const other = await create();
    for (const incident of [first, first, first, other]) {
      await transaction((session) => repo.createResponse({ sosId: incident._id, responderId: id() }, { session }));
    }
    const page = await repo.listResponses(first._id, { limit: 2 });
    assert.equal(page.length, 3); // Extra row signals hasMore to the future use case.
    const next = await repo.listResponses(first._id, { limit: 2, afterId: page[1]._id });
    assert.deepEqual(next.map((row) => String(row._id)), [String(page[2]._id)]);
    assert.throws(() => repo.listResponses(first._id, { limit: 101 }), RangeError);
  });
});
