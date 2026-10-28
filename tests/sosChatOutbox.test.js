const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const ChatMessage = require('../src/infrastructure/database/models/ChatMessage');
const Conversation = require('../src/infrastructure/database/models/Conversation');
const ConversationMember = require('../src/infrastructure/database/models/ConversationMember');
const SosIncident = require('../src/infrastructure/database/models/SosIncident');
const SosOutbox = require('../src/infrastructure/database/models/SosOutbox');
const messages = require('../src/infrastructure/repositories/messageRepository');
const conversations = require('../src/infrastructure/repositories/conversationRepository');
const members = require('../src/infrastructure/repositories/conversationMemberRepository');
const incidents = require('../src/infrastructure/repositories/sosRepository');
const outbox = require('../src/infrastructure/repositories/sosOutboxRepository');
const { toMessageView } = require('../src/application/chat/chatMappers');

const id = () => new mongoose.Types.ObjectId();
const transaction = (fn) => mongoose.connection.transaction(fn);
const at = new Date('2030-01-01T00:00:00.000Z');
const later = (ms) => new Date(at.getTime() + ms);
const claim = (now = at, maxAttempts = 2) => outbox.claimNext({ now, leaseMs: 1000, maxAttempts });
const enqueue = (overrides = {}) => transaction((session) => outbox.enqueue({
  eventKey: randomUUID(), kind: 'sos_alert', sosId: id(), recipientId: id(),
  revision: 1, nextAttemptAt: at, ...overrides,
}, { session }));

describe('SOS chat and durable outbox', { timeout: 120000 }, () => {
  let replSet;
  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri('sos-chat-outbox-test'));
    await Promise.all([ChatMessage, Conversation, ConversationMember, SosIncident, SosOutbox].map((model) => model.init()));
  });
  beforeEach(() => SosOutbox.deleteMany({}));
  after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('keeps ordinary message DTOs unchanged and rejects SOS metadata through the ordinary write path', async () => {
    const data = { conversationId: id(), senderId: id(), type: 'text', content: 'hello', sos: { id: id(), kind: 'alert' } };
    const first = await messages.create(data);
    const second = await messages.create(data);
    assert.equal(first.sos, undefined);
    assert.equal(Object.hasOwn(toMessageView(first), 'sos'), false);
    assert.notEqual(String(first._id), String(second._id));
    assert.ok(new ChatMessage({ ...data, type: 'voice' }).validateSync());
    await assert.rejects(messages.createSosMessage(data), /active MongoDB transaction/);
    await assert.rejects(transaction((session) => messages.createSosMessage({ ...data, sos: undefined }, { session })), TypeError);
  });

  it('enforces one alert per conversation/incident and one assistance message per responder', async () => {
    const data = { conversationId: id(), senderId: id(), content: 'Need help', sos: { id: id(), kind: 'alert' } };
    const send = (value) => transaction((session) => messages.createSosMessage(value, { session }));
    const first = await send(data);
    await assert.rejects(send({ ...data, senderId: id() }), { code: 11000 });
    await send({ ...data, conversationId: id() });
    assert.deepEqual(toMessageView(first).sos, { id: String(data.sos.id), kind: 'alert' });
    const response = { ...data, senderId: id(), sos: { ...data.sos, kind: 'assistance' } };
    const confirmation = await send(response);
    await assert.rejects(send(response), { code: 11000 });
    await send({ ...response, senderId: id() });
    const page = await messages.listPage(data.conversationId, { limit: 20 });
    assert.equal(page.length, 3);
    assert.deepEqual(toMessageView(confirmation).sos, {
      id: String(data.sos.id), kind: 'assistance', responderId: String(response.senderId),
    });
  });

  it('commits or rolls back incident, chat, lastMessage, read pointer and outbox together', async () => {
    const ownerId = id();
    const groupId = id();
    const recipientId = id();
    const conversation = await conversations.createGroupConversation({ groupId, name: 'Test SOS', createdBy: ownerId });
    await members.addMany(conversation._id, [ownerId, recipientId]);
    const save = (fail) => transaction(async (session) => {
      const incident = await incidents.createIncident({ ownerId, groupIds: [groupId], recipientIds: [recipientId] }, { session });
      const message = await messages.createSosMessage({
        conversationId: conversation._id, senderId: ownerId, content: 'Need help', sos: { id: incident._id, kind: 'alert' },
      }, { session });
      await conversations.recordLastMessage(conversation._id, message._id, message.createdAt, { session });
      await members.advanceLastRead(conversation._id, ownerId, message._id, message.createdAt, { session });
      const event = await outbox.enqueue({
        eventKey: `chat:${message._id}:${recipientId}`, kind: 'chat_message', sosId: incident._id,
        recipientId, messageId: message._id, revision: 1, nextAttemptAt: at,
      }, { session });
      if (fail) throw new Error('synthetic rollback');
      return { message, event };
    });
    await assert.rejects(save(true), /synthetic rollback/);
    assert.equal(await incidents.findActiveByOwner(ownerId), null);
    assert.equal(await ChatMessage.countDocuments({ conversationId: conversation._id }), 0);
    assert.equal((await conversations.findById(conversation._id)).lastMessageId, null);
    assert.equal((await members.find(conversation._id, ownerId)).lastReadMessageId, null);
    assert.equal(await SosOutbox.countDocuments(), 0);
    const saved = await save(false);
    assert.equal(String((await conversations.findById(conversation._id)).lastMessageId), String(saved.message._id));
    assert.equal(await messages.countAfter(conversation._id, (await members.find(conversation._id, ownerId)).lastReadMessageId), 0);
    assert.equal(await messages.countAfter(conversation._id, (await members.find(conversation._id, recipientId)).lastReadMessageId), 1);
    assert.equal(String((await claim())._id), String(saved.event._id));
  });

  it('requires a transaction and deduplicates enqueue without retaining arbitrary payload', async () => {
    await assert.rejects(outbox.enqueue({}), /active MongoDB transaction/);
    const eventKey = randomUUID();
    const event = await enqueue({ eventKey, payload: { token: 'synthetic-secret' } });
    await assert.rejects(enqueue({ eventKey }), { code: 11000 });
    assert.equal(await SosOutbox.countDocuments(), 1);
    assert.equal(Object.hasOwn(event, 'payload'), false);
    await assert.rejects(enqueue({ kind: 'chat_message' }), /messageId/);
  });

  it('lets only one worker claim a job and rejects stale leases after recovery', async () => {
    await enqueue();
    const claims = await Promise.all([claim(), claim()]);
    assert.equal(claims.filter(Boolean).length, 1);
    const first = claims.find(Boolean);
    assert.equal(first.attempts, 1);
    assert.equal(await claim(later(999)), null);
    const recovered = await claim(later(1000));
    assert.equal(String(recovered._id), String(first._id));
    assert.notEqual(recovered.leaseToken, first.leaseToken);
    assert.equal(recovered.attempts, 2);
    assert.equal(await outbox.markDelivered({ id: first._id, leaseToken: first.leaseToken, now: later(1100) }), null);
    assert.equal(await outbox.reschedule({ id: first._id, leaseToken: first.leaseToken, now: later(1100), retryAt: later(1200), maxAttempts: 2 }), null);
    const done = await outbox.markDelivered({ id: recovered._id, leaseToken: recovered.leaseToken, now: later(1100) });
    assert.equal(done.status, 'delivered');
    assert.equal(done.deliveredAt.getTime(), later(1100).getTime());
    assert.equal(await claim(later(5000)), null);
  });

  it('waits until retryAt, then marks failed after the configured attempt budget', async () => {
    await enqueue();
    const first = await claim();
    const pending = await outbox.reschedule({ id: first._id, leaseToken: first.leaseToken, now: later(100), retryAt: later(500), maxAttempts: 2 });
    assert.equal(pending.status, 'pending');
    assert.equal(await claim(later(499)), null);
    const second = await claim(later(500));
    const failed = await outbox.reschedule({ id: second._id, leaseToken: second.leaseToken, now: later(600), retryAt: later(900), maxAttempts: 2 });
    assert.equal(failed.status, 'failed');
    assert.equal(await claim(later(1000)), null);
  });

  it('fails a job when the worker crashes on its final attempt and cannot finish an expired lease', async () => {
    await enqueue();
    const job = await claim(at, 1);
    assert.equal(await outbox.markDelivered({ id: job._id, leaseToken: job.leaseToken, now: later(1000) }), null);
    assert.equal(await claim(later(1000), 1), null);
    assert.equal((await SosOutbox.findById(job._id).lean()).status, 'failed');
  });
});
