const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createSosUseCases } = require('../src/application/sos/sosUseCases');
const { createUnitOfWork } = require('../src/infrastructure/database/unitOfWork');
const Group = require('../src/infrastructure/database/models/Group');
const Conversation = require('../src/infrastructure/database/models/Conversation');
const ConversationMember = require('../src/infrastructure/database/models/ConversationMember');
const ChatMessage = require('../src/infrastructure/database/models/ChatMessage');
const SosIncident = require('../src/infrastructure/database/models/SosIncident');
const SosResponse = require('../src/infrastructure/database/models/SosResponse');
const SosOutbox = require('../src/infrastructure/database/models/SosOutbox');
const sosRepo = require('../src/infrastructure/repositories/sosRepository');
const groupRepo = require('../src/infrastructure/repositories/groupRepository');
const conversationRepo = require('../src/infrastructure/repositories/conversationRepository');
const conversationMemberRepo = require('../src/infrastructure/repositories/conversationMemberRepository');
const messageRepo = require('../src/infrastructure/repositories/messageRepository');
const outboxRepo = require('../src/infrastructure/repositories/sosOutboxRepository');

const id = () => new mongoose.Types.ObjectId();
const unitOfWork = createUnitOfWork({ supportsTransactions: true });
const deps = {
  sosRepo, groupRepo, conversationRepo, conversationMemberRepo, messageRepo, outboxRepo, unitOfWork,
  policy: { maxGroups: 10, maxRecipients: 100, maxOutboxEvents: 300 },
  userRepo: { findManyByIds: async (ids) => ids.map((_id) => ({ _id, name: `Member ${_id}`, avatar: null })) },
};
const useCases = createSosUseCases(deps);

async function fixture() {
  const a = id(), b = id(), c = id(), d = id(), outsider = id();
  const circles = [];
  for (const others of [[b, c], [b, d]]) {
    circles.push(await unitOfWork.run(async (session) => {
      const group = await groupRepo.create({ name: 'Assistance Circle', adminId: a }, { session });
      for (const userId of others) await groupRepo.addMember(group._id, userId, { session });
      const conversation = await conversationRepo.createGroupConversation({ groupId: group._id, name: group.name, createdBy: a }, { session });
      await conversationMemberRepo.addMany(conversation._id, [a, ...others], { session });
      return { group, conversation };
    }));
  }
  const { incident } = await useCases.create({ userId: a });
  return { a, b, c, d, outsider, circles, sosId: incident.id };
}

async function membership(circle, userId, add = false) {
  await unitOfWork.run(async (session) => {
    if (add) {
      await groupRepo.addMember(circle.group._id, userId, { session });
      await conversationMemberRepo.add(circle.conversation._id, userId, { session });
    } else {
      await groupRepo.removeMember(circle.group._id, userId, { session });
      await conversationMemberRepo.remove(circle.conversation._id, userId, { session });
    }
  });
}

describe('SOS assistance, access and closure', { timeout: 120000 }, () => {
  let replSet;
  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri('sos-assistance-test'));
    await Promise.all([Group, Conversation, ConversationMember, ChatMessage, SosIncident, SosResponse, SosOutbox].map((model) => model.init()));
  });
  after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('deduplicates concurrent assistance while writing a message to each eligible Circle', async () => {
    const f = await fixture();
    const results = await Promise.all([
      useCases.respond({ userId: f.b, sosId: f.sosId }),
      useCases.respond({ userId: f.b, sosId: f.sosId }),
    ]);
    assert.equal(results.filter((result) => result.created).length, 1);
    assert.equal(results[0].response.id, results[1].response.id);
    assert.equal((await sosRepo.findIncidentById(f.sosId)).revision, 2);
    assert.equal(await SosResponse.countDocuments({ sosId: f.sosId }), 1);
    assert.equal(await ChatMessage.countDocuments({ 'sos.id': f.sosId, 'sos.kind': 'assistance' }), 2);
    const updates = await SosOutbox.find({ sosId: f.sosId, kind: 'sos_updated' }).lean();
    assert.equal(updates.length, 4);
    assert.equal(updates.filter((event) => String(event.recipientId) === String(f.a)).length, 1);
    for (const { conversation } of f.circles) {
      const membership = await conversationMemberRepo.find(conversation._id, f.b);
      assert.equal(await messageRepo.countAfter(conversation._id, membership.lastReadMessageId), 0);
    }
  });

  it('keeps responses from different Circles private and filters before pagination', async () => {
    const f = await fixture();
    await useCases.respond({ userId: f.d, sosId: f.sosId });
    await useCases.respond({ userId: f.b, sosId: f.sosId });
    const owner = await useCases.get({ userId: f.a, sosId: f.sosId });
    assert.deepEqual(owner.responders.map((row) => row.responderId).sort(), [f.b, f.d].map(String).sort());
    const viewer = await useCases.get({ userId: f.c, sosId: f.sosId, limit: 1 });
    assert.deepEqual(viewer.responders.map((row) => row.responderId), [String(f.b)]);
    assert.equal(viewer.hasMore, false);
    assert.equal(viewer.nextAfterId, null);
    assert.deepEqual(viewer.incident.groupIds, [String(f.circles[0].group._id)]);
    assert.equal(Object.hasOwn(viewer.incident, 'recipientIds'), false);
    assert.equal(JSON.stringify(viewer).includes(String(f.d)), false);
    await useCases.respond({ userId: f.c, sosId: f.sosId });
    const first = await useCases.get({ userId: f.a, sosId: f.sosId, limit: 1 });
    const second = await useCases.get({ userId: f.a, sosId: f.sosId, limit: 2, afterId: first.nextAfterId });
    assert.equal(first.hasMore, true);
    assert.equal(second.responders.length, 2);
    assert.ok(second.responders.every((row) => row.id !== first.responders[0].id));
    assert.equal(await ChatMessage.countDocuments({ conversationId: f.circles[0].conversation._id, senderId: f.d }), 0);
    const dUpdates = await SosOutbox.find({ sosId: f.sosId, kind: 'sos_updated', revision: 2 }).lean();
    assert.ok(dUpdates.every((event) => String(event.recipientId) !== String(f.c)));
  });

  it('does not grant original SOS access to later joiners, even across other original Circles', async () => {
    const f = await fixture();
    await membership(f.circles[0], f.outsider, true);
    await assert.rejects(useCases.get({ userId: f.outsider, sosId: f.sosId }), { status: 403 });
    await assert.rejects(useCases.respond({ userId: f.outsider, sosId: f.sosId }), { status: 403 });
    await membership(f.circles[0], f.d, true);
    await useCases.respond({ userId: f.c, sosId: f.sosId });
    const dView = await useCases.get({ userId: f.d, sosId: f.sosId });
    assert.deepEqual(dView.incident.groupIds, [String(f.circles[1].group._id)]);
    assert.deepEqual(dView.responders, []);
  });

  it('revokes departed-member access while keeping committed response history for the owner', async () => {
    const f = await fixture();
    await useCases.respond({ userId: f.b, sosId: f.sosId });
    await membership(f.circles[0], f.b);
    assert.equal((await useCases.get({ userId: f.b, sosId: f.sosId })).incident.groupIds.length, 1);
    await membership(f.circles[1], f.b);
    await assert.rejects(useCases.get({ userId: f.b, sosId: f.sosId }), { status: 403 });
    await assert.rejects(useCases.respond({ userId: f.b, sosId: f.sosId }), { status: 403 });
    assert.equal((await useCases.get({ userId: f.a, sosId: f.sosId })).responders.length, 1);
    assert.equal((await useCases.get({ userId: f.c, sosId: f.sosId })).responders.length, 0);
  });

  it('allows owner-only idempotent closure and response replay after closure without reopening', async () => {
    const f = await fixture();
    await assert.rejects(useCases.respond({ userId: f.a, sosId: f.sosId }), { status: 400 });
    await assert.rejects(useCases.close({ userId: f.b, sosId: f.sosId, status: 'resolved' }), { status: 403 });
    await assert.rejects(useCases.close({ userId: f.a, sosId: f.sosId, status: 'expired' }), { status: 400 });
    const response = await useCases.respond({ userId: f.b, sosId: f.sosId });
    const closed = await useCases.close({ userId: f.a, sosId: f.sosId, status: 'resolved' });
    assert.equal(closed.changed, true);
    assert.equal(closed.incident.revision, 3);
    const before = await SosOutbox.countDocuments({ sosId: f.sosId });
    const replay = await useCases.close({ userId: f.a, sosId: f.sosId, status: 'resolved' });
    assert.equal(replay.changed, false);
    assert.equal(await SosOutbox.countDocuments({ sosId: f.sosId }), before);
    const responseReplay = await useCases.respond({ userId: f.b, sosId: f.sosId });
    assert.equal(responseReplay.created, false);
    assert.equal(responseReplay.response.id, response.response.id);
    await assert.rejects(useCases.respond({ userId: f.c, sosId: f.sosId }), { status: 409 });
    await assert.rejects(useCases.close({ userId: f.a, sosId: f.sosId, status: 'cancelled' }), { status: 409 });
    await assert.rejects(useCases.get({ userId: f.a, sosId: id() }), { status: 404 });
  });

  it('serializes concurrent responders and a competing owner closure', async () => {
    const f = await fixture();
    await Promise.all([f.b, f.c].map((userId) => useCases.respond({ userId, sosId: f.sosId })));
    assert.equal((await sosRepo.findIncidentById(f.sosId)).revision, 3);
    const [response, closure] = await Promise.allSettled([
      useCases.respond({ userId: f.d, sosId: f.sosId }),
      useCases.close({ userId: f.a, sosId: f.sosId, status: 'cancelled' }),
    ]);
    assert.equal(closure.status, 'fulfilled');
    if (response.status === 'rejected') assert.equal(response.reason.status, 409);
    const saved = await sosRepo.findIncidentById(f.sosId);
    assert.equal(saved.status, 'cancelled');
    assert.equal(await SosResponse.countDocuments({ sosId: f.sosId }), response.status === 'fulfilled' ? 3 : 2);
  });

  it('rolls back response/chat/revision and closure if outbox insertion fails', async () => {
    const f = await fixture();
    const broken = createSosUseCases({ ...deps, outboxRepo: { enqueue: (event, options) => {
      if (event.kind === 'sos_updated') throw new Error('synthetic update failure');
      return outboxRepo.enqueue(event, options);
    } } });
    const before = await SosOutbox.countDocuments({ sosId: f.sosId });
    await assert.rejects(broken.respond({ userId: f.b, sosId: f.sosId }), /synthetic update failure/);
    assert.equal(await SosResponse.countDocuments({ sosId: f.sosId }), 0);
    assert.equal(await ChatMessage.countDocuments({ 'sos.id': f.sosId, 'sos.kind': 'assistance' }), 0);
    for (const { conversation } of f.circles) {
      const last = await conversationRepo.findById(conversation._id);
      assert.equal((await messageRepo.findInConversation(last.lastMessageId, conversation._id)).sos.kind, 'alert');
      assert.equal((await conversationMemberRepo.find(conversation._id, f.b)).lastReadMessageId, null);
    }
    await assert.rejects(broken.close({ userId: f.a, sosId: f.sosId, status: 'resolved' }), /synthetic update failure/);
    const saved = await sosRepo.findIncidentById(f.sosId);
    assert.equal(saved.status, 'active');
    assert.equal(saved.revision, 1);
    assert.equal(await SosOutbox.countDocuments({ sosId: f.sosId }), before);
  });

  it('rechecks responder membership when removal commits before the membership guard', async () => {
    const f = await fixture();
    let removed = false;
    const racing = createSosUseCases({ ...deps, groupRepo: { ...groupRepo,
      findSosAudienceGroups: async (...args) => {
        const groups = await groupRepo.findSosAudienceGroups(...args);
        if (!removed) {
          removed = true;
          await membership(f.circles[0], f.b);
          await membership(f.circles[1], f.b);
        }
        return groups;
      },
    } });
    await assert.rejects(racing.respond({ userId: f.b, sosId: f.sosId }), { status: 403 });
    assert.equal(await SosResponse.countDocuments({ sosId: f.sosId }), 0);
    assert.equal((await sosRepo.findIncidentById(f.sosId)).revision, 1);
  });

  it('lets an owner close after leaving all original Circles, notifying only the owner', async () => {
    const f = await fixture();
    for (const group of f.circles) await membership(group, f.a);
    await assert.rejects(useCases.get({ userId: f.b, sosId: f.sosId }), { status: 403 });
    const closed = await useCases.close({ userId: f.a, sosId: f.sosId, status: 'resolved' });
    assert.equal(closed.changed, true);
    const updates = await SosOutbox.find({ sosId: f.sosId, kind: 'sos_updated' }).lean();
    assert.deepEqual(updates.map((event) => String(event.recipientId)), [String(f.a)]);
  });
});
