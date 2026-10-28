const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createSosUseCases } = require('../src/application/sos/sosUseCases');
const { createUnitOfWork } = require('../src/infrastructure/database/unitOfWork');
const Group = require('../src/infrastructure/database/models/Group');
const Conversation = require('../src/infrastructure/database/models/Conversation');
const ConversationMember = require('../src/infrastructure/database/models/ConversationMember');
const ChatMessage = require('../src/infrastructure/database/models/ChatMessage');
const SosIncident = require('../src/infrastructure/database/models/SosIncident');
const SosOutbox = require('../src/infrastructure/database/models/SosOutbox');
const sosRepo = require('../src/infrastructure/repositories/sosRepository');
const groupRepo = require('../src/infrastructure/repositories/groupRepository');
const conversationRepo = require('../src/infrastructure/repositories/conversationRepository');
const conversationMemberRepo = require('../src/infrastructure/repositories/conversationMemberRepository');
const messageRepo = require('../src/infrastructure/repositories/messageRepository');
const outboxRepo = require('../src/infrastructure/repositories/sosOutboxRepository');

const id = () => new mongoose.Types.ObjectId();
const unitOfWork = createUnitOfWork({ supportsTransactions: true });
const policy = { maxGroups: 10, maxRecipients: 100, maxOutboxEvents: 300 };
const deps = {
  sosRepo, groupRepo, conversationRepo, conversationMemberRepo, messageRepo, outboxRepo, unitOfWork, policy,
  userRepo: { findManyByIds: async (ids) => ids.map((_id) => ({ _id, name: 'Test Owner' })) },
};
const useCases = createSosUseCases(deps);

async function circle(ownerId, others = []) {
  return unitOfWork.run(async (session) => {
    const group = await groupRepo.create({ name: 'SOS Test Circle', adminId: ownerId }, { session });
    for (const userId of others) await groupRepo.addMember(group._id, userId, { session });
    const conversation = await conversationRepo.createGroupConversation({ groupId: group._id, name: group.name, createdBy: ownerId }, { session });
    await conversationMemberRepo.addMany(conversation._id, [ownerId, ...others], { session });
    return { group, conversation };
  });
}

describe('SOS create use case', { timeout: 120000 }, () => {
  let replSet;
  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri('sos-create-test'));
    await Promise.all([Group, Conversation, ConversationMember, ChatMessage, SosIncident, SosOutbox].map((model) => model.init()));
  });
  after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('writes every Circle chat but only one urgent event per recipient across Circles', async () => {
    const owner = id(), b = id(), c = id(), d = id();
    const first = await circle(owner, [b, c]);
    const second = await circle(owner, [b, d]);
    const unrelated = await circle(id(), [id()]);
    const result = await useCases.create({ userId: owner, clientRequestId: randomUUID(), message: 'Help' });
    assert.equal(result.created, true);
    assert.equal(result.incident.groupCount, 2);
    assert.equal(result.incident.recipientCount, 3);
    assert.equal(Object.hasOwn(result.incident, 'recipientIds'), false);
    const stored = await sosRepo.findIncidentById(result.incident.id);
    assert.equal(stored.audience.length, 2);
    assert.equal(stored.location, null);
    assert.deepEqual(stored.audience.find((entry) => String(entry.groupId) === String(first.group._id)).recipientIds.map(String).sort(), [b, c].map(String).sort());
    for (const { group, conversation } of [first, second]) {
      const [message] = await messageRepo.listPage(conversation._id, { limit: 10 });
      assert.equal(message.type, 'text');
      assert.equal(String(message.sos.id), result.incident.id);
      assert.equal(String((await conversationRepo.findById(conversation._id)).lastMessageId), String(message._id));
      assert.equal(await messageRepo.countAfter(conversation._id, (await conversationMemberRepo.find(conversation._id, owner)).lastReadMessageId), 0);
      assert.equal(await messageRepo.countAfter(conversation._id, (await conversationMemberRepo.find(conversation._id, b)).lastReadMessageId), 1);
      assert.equal((await groupRepo.findById(group._id)).sosGuardVersion, undefined);
    }
    assert.equal(await ChatMessage.countDocuments({ conversationId: unrelated.conversation._id }), 0);
    const events = await SosOutbox.find({ sosId: result.incident.id }).lean();
    assert.equal(events.filter((event) => event.kind === 'chat_message').length, 6);
    assert.equal(events.filter((event) => event.kind === 'sos_alert').length, 3);
    assert.ok(events.every((event) => event.status === 'pending'));
  });

  it('replays concurrent requests and keeps the request identity after closure', async () => {
    const owner = id();
    await circle(owner, [id()]);
    const input = { userId: owner, clientRequestId: randomUUID() };
    const results = await Promise.all([useCases.create(input), useCases.create(input)]);
    assert.equal(results.filter((result) => result.created).length, 1);
    assert.equal(results[0].incident.id, results[1].incident.id);
    const incidentId = results[0].incident.id;
    assert.equal(await ChatMessage.countDocuments({ 'sos.id': incidentId }), 1);
    assert.equal(await SosOutbox.countDocuments({ sosId: incidentId }), 3);
    await assert.rejects(useCases.create({ ...input, clientRequestId: randomUUID() }), { status: 409 });
    const legacyReplay = await useCases.create({ userId: owner });
    assert.equal(legacyReplay.incident.id, incidentId);
    assert.equal(legacyReplay.created, false);
    await unitOfWork.run((session) => sosRepo.closeActive({ id: incidentId, expectedRevision: 1, status: 'resolved', closedAt: new Date() }, { session }));
    const replay = await useCases.create(input);
    assert.equal(replay.created, false);
    assert.equal(replay.incident.status, 'resolved');
    const next = await useCases.create({ ...input, clientRequestId: randomUUID() });
    assert.equal(next.created, true);
    assert.notEqual(next.incident.id, incidentId);
  });

  it('supports legacy requests without inventing a location or setting an expiry', async () => {
    const owner = id();
    await circle(owner);
    const first = await useCases.create({ userId: owner });
    const replay = await useCases.create({ userId: owner });
    assert.equal(first.incident.id, replay.incident.id);
    assert.equal(first.incident.recipientCount, 0);
    const saved = await sosRepo.findIncidentById(first.incident.id);
    assert.equal(saved.location, null);
    assert.equal(saved.expiresAt, undefined);
    await assert.rejects(useCases.create({ userId: owner, latitude: 10 }), { status: 400 });
  });

  it('persists explicit SOS coordinates without putting them in chat or outbox', async () => {
    const owner = id();
    await circle(owner, [id()]);
    const measured = new Date('2026-10-28T01:00:00Z');
    const result = await useCases.create({ userId: owner, latitude: 10.12345, longitude: 106.54321, recordedAt: measured.toISOString() });
    const saved = await sosRepo.findIncidentById(result.incident.id);
    assert.equal(saved.location.recordedAt.getTime(), measured.getTime());
    assert.equal(saved.location.latitude, 10.12345);
    const chat = await ChatMessage.find({ 'sos.id': result.incident.id }).lean();
    const events = await SosOutbox.find({ sosId: result.incident.id }).lean();
    assert.equal(JSON.stringify({ chat, events }).includes('10.12345'), false);
  });

  it('rejects no groups, absent users and oversized audiences before persistence', async () => {
    const owner = id();
    await assert.rejects(useCases.create({ userId: owner }), { status: 400 });
    await assert.rejects(createSosUseCases({ ...deps, userRepo: { findManyByIds: async () => [] } }).create({ userId: owner }), { status: 404 });
    await circle(owner, [id(), id()]);
    await circle(owner, [id()]);
    for (const overrides of [{ maxGroups: 1 }, { maxRecipients: 1 }, { maxOutboxEvents: 1 }]) {
      const limited = createSosUseCases({ ...deps, policy: { ...policy, ...overrides } });
      await assert.rejects(limited.create({ userId: owner }), { status: 503 });
    }
    assert.equal(await SosIncident.countDocuments({ ownerId: owner }), 0);
    assert.throws(() => createSosUseCases({ ...deps, policy: undefined }), RangeError);
  });

  it('rolls back all groups when enqueue fails halfway through fanout', async () => {
    const owner = id();
    const circles = [await circle(owner, [id()]), await circle(owner, [id()])];
    let calls = 0;
    const broken = createSosUseCases({ ...deps, outboxRepo: { enqueue: async (...args) => {
      if (++calls === 3) throw new Error('synthetic outbox failure');
      return outboxRepo.enqueue(...args);
    } } });
    const before = await SosOutbox.countDocuments();
    await assert.rejects(broken.create({ userId: owner }), /synthetic outbox failure/);
    assert.equal(await SosIncident.countDocuments({ ownerId: owner }), 0);
    assert.equal(await SosOutbox.countDocuments(), before);
    for (const { conversation } of circles) {
      assert.equal(await ChatMessage.countDocuments({ conversationId: conversation._id }), 0);
      assert.equal((await conversationRepo.findById(conversation._id)).lastMessageId, null);
      assert.equal((await conversationMemberRepo.find(conversation._id, owner)).lastReadMessageId, null);
    }
  });

  it('rolls back rather than silently omitting a Circle with an unavailable chat', async () => {
    const owner = id();
    await groupRepo.create({ name: 'Unsynchronized Circle', adminId: owner });
    await assert.rejects(useCases.create({ userId: owner }), { status: 503 });
    assert.equal(await SosIncident.countDocuments({ ownerId: owner }), 0);
  });

  it('rechecks membership after a leave commits between snapshot read and guard write', async () => {
    const admin = id(), owner = id();
    const { group, conversation } = await circle(admin, [owner]);
    let removed = false;
    const racing = createSosUseCases({ ...deps, groupRepo: {
      ...groupRepo,
      listForSos: async (...args) => {
        const groups = await groupRepo.listForSos(...args);
        if (!removed) {
          removed = true;
          await unitOfWork.run(async (session) => {
            await groupRepo.removeMember(group._id, owner, { session });
            await conversationMemberRepo.remove(conversation._id, owner, { session });
          });
        }
        return groups;
      },
    } });
    await assert.rejects(racing.create({ userId: owner }), { status: 400 });
    assert.equal(await SosIncident.countDocuments({ ownerId: owner }), 0);
    assert.equal(await ChatMessage.countDocuments({ conversationId: conversation._id }), 0);
  });

  it('refuses standalone fallback before writing membership guards or incidents', async () => {
    const owner = id();
    const { group } = await circle(owner);
    const standalone = createSosUseCases({ ...deps, unitOfWork: { run: (work) => work(null) } });
    await assert.rejects(standalone.create({ userId: owner }), /active MongoDB transaction/);
    assert.equal(await SosIncident.countDocuments({ ownerId: owner }), 0);
    assert.equal((await Group.findById(group._id).select('+sosGuardVersion')).sosGuardVersion, undefined);
  });
});
