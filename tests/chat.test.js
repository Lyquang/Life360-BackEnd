const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startTestServer, waitForEvent, expectNoEvent, emitWithAck } = require('./helpers/testServer');

const ID_RE = /^[a-f0-9]{24}$/;

describe('Chat over Socket.IO + REST', { timeout: 180000 }, () => {
  // Family: alice, bob, dave. Other: carol only.
  let t, alice, bob, carol, dave, family, other;

  const send = (socket, conversationId, content) =>
    emitWithAck(socket, 'chat:send_message', { conversationId, type: 'text', content });
  const unread = async (user, conversationId) =>
    (await t.api('GET', `/api/v1/conversations/${conversationId}/unread`, { token: user.token })).body.data.unreadCount;

  before(async () => {
    t = await startTestServer();
    [alice, bob, carol, dave] = await Promise.all(['Alice', 'Bob', 'Carol', 'Dave'].map(t.registerUser));
    family = await t.createGroup(alice, 'Family');
    await t.joinGroup(bob, family);
    await t.joinGroup(dave, family);
    other = await t.createGroup(carol, 'Other');
  });
  after(() => t.stop());

  describe('connection', () => {
    it('rejects missing or invalid tokens', async () => {
      await assert.rejects(t.connect(undefined), { message: 'Authentication error' });
      await assert.rejects(t.connect('not.a.jwt'), { message: 'Authentication error' });
    });

    it('joins the user to all their conversation rooms and reports them in session:ready', async () => {
      const socket = await t.connect(alice.token);
      assert.deepEqual(socket.session.conversationIds, [family.conversationId]);
      assert.deepEqual(socket.session.groupIds, [family.id]);
      await t.disconnect(socket);
    });
  });

  describe('chat:send_message (text)', () => {
    it('persists and broadcasts to every other member, acking the sender', async () => {
      const [a, b, d, c] = await Promise.all([alice, bob, dave, carol].map((u) => t.connect(u.token)));
      const onBob = waitForEvent(b, 'chat:new_message');
      const onDave = waitForEvent(d, 'chat:new_message');
      const notOnSender = expectNoEvent(a, 'chat:new_message');
      const notOnCarol = expectNoEvent(c, 'chat:new_message');

      const ack = await send(a, family.conversationId, '  Chào cả nhà 👋  ');
      assert.equal(ack.success, true);
      assert.match(ack.data.id, ID_RE);
      assert.deepEqual(
        { ...ack.data, id: undefined, createdAt: undefined },
        {
          id: undefined,
          conversationId: family.conversationId,
          senderId: alice.id,
          senderName: 'Alice',
          type: 'text',
          content: 'Chào cả nhà 👋',
          attachment: null,
          createdAt: undefined,
        }
      );
      assert.deepEqual(await onBob, ack.data);
      assert.deepEqual(await onDave, ack.data);
      await notOnSender;
      await notOnCarol;

      await t.disconnect(a, b, d, c);
    });

    it("syncs to the sender's other devices", async () => {
      const phone = await t.connect(alice.token);
      const tablet = await t.connect(alice.token);
      const onTablet = waitForEvent(tablet, 'chat:new_message');
      const ack = await send(phone, family.conversationId, 'from phone');
      assert.equal((await onTablet).id, ack.data.id);
      await t.disconnect(phone, tablet);
    });

    it('validates the payload with Zod', async () => {
      const a = await t.connect(alice.token);
      const cases = [
        [{ conversationId: family.conversationId, content: 'no type' }, 'type'],
        [{ conversationId: family.conversationId, type: 'video', content: 'x' }, 'type'],
        [{ conversationId: family.conversationId, type: 'text', content: '   ' }, 'content'],
        [{ conversationId: family.conversationId, type: 'text', content: 'x'.repeat(2001) }, 'content'],
        [{ conversationId: family.conversationId, type: 'text', content: 5 }, 'content'],
        [{ conversationId: 'abc', type: 'text', content: 'x' }, 'conversationId'],
        [{ conversationId: { $ne: null }, type: 'text', content: 'x' }, 'conversationId'],
        [null, null],
      ];
      for (const [payload, field] of cases) {
        const ack = await emitWithAck(a, 'chat:send_message', payload);
        assert.equal(ack.success, false, JSON.stringify(payload));
        assert.equal(ack.status, 400);
        assert.equal(ack.code, 'VALIDATION_ERROR');
        assert.ok(ack.errors.some((e) => e.field === field), `${JSON.stringify(ack.errors)} should include ${field}`);
      }
      const max = await send(a, family.conversationId, 'y'.repeat(2000));
      assert.equal(max.success, true);
      await t.disconnect(a);
    });

    it('forbids sending to a conversation you are not a member of', async () => {
      const c = await t.connect(carol.token);
      const b = await t.connect(bob.token);
      const nothing = expectNoEvent(b, 'chat:new_message');
      const ack = await send(c, family.conversationId, 'let me in');
      assert.equal(ack.status, 403);
      assert.equal(ack.code, 'FORBIDDEN');
      const ghost = await send(c, '0123456789abcdef01234567', 'ghost');
      assert.equal(ghost.status, 403);
      await nothing;
      await t.disconnect(c, b);
    });

    it('reports errors on chat:error when no ack callback is given', async () => {
      const c = await t.connect(carol.token);
      const error = waitForEvent(c, 'chat:error');
      c.emit('chat:send_message', { conversationId: family.conversationId, type: 'text', content: 'no ack' });
      const payload = await error;
      assert.equal(payload.event, 'chat:send_message');
      assert.equal(payload.status, 403);
      await t.disconnect(c);
    });

    it('rate limits bursts to 20 messages / 10 s per connection', async () => {
      const d = await t.connect(dave.token);
      const acks = await Promise.all(Array.from({ length: 25 }, (_, i) => send(d, family.conversationId, `burst ${i}`)));
      assert.equal(acks.filter((a) => a.success).length, 20);
      const limited = acks.filter((a) => !a.success);
      assert.equal(limited.length, 5);
      limited.forEach((a) => assert.equal(a.status, 429));
      await t.disconnect(d);
    });
  });

  describe('read receipts & unread counts', () => {
    let room, ids;

    before(async () => {
      room = await t.createGroup(alice, 'Receipts');
      await t.joinGroup(bob, room);
      const a = await t.connect(alice.token);
      ids = [];
      for (let i = 1; i <= 5; i += 1) ids.push((await send(a, room.conversationId, `m${i}`)).data.id);
      await t.disconnect(a);
    });

    it("counts unread for the receiver but never the sender's own messages", async () => {
      assert.equal(await unread(bob, room.conversationId), 5);
      assert.equal(await unread(alice, room.conversationId), 0);
    });

    it('chat:mark_read advances the cursor and broadcasts chat:read_receipt', async () => {
      const a = await t.connect(alice.token);
      const b = await t.connect(bob.token);
      const bobTablet = await t.connect(bob.token);
      const receipt = waitForEvent(a, 'chat:read_receipt');
      const receiptOnOtherDevice = waitForEvent(bobTablet, 'chat:read_receipt');

      const ack = await emitWithAck(b, 'chat:mark_read', { conversationId: room.conversationId, messageId: ids[2] });
      assert.deepEqual(ack.data, {
        conversationId: room.conversationId,
        lastReadMessageId: ids[2],
        unreadCount: 2,
        advanced: true,
      });
      const event = await receipt;
      assert.equal(event.userId, bob.id);
      assert.equal(event.lastReadMessageId, ids[2]);
      assert.equal((await receiptOnOtherDevice).lastReadMessageId, ids[2]);

      await t.disconnect(a, b, bobTablet);
    });

    it('never moves the cursor backwards (GREATEST semantics) and stays silent', async () => {
      const a = await t.connect(alice.token);
      const b = await t.connect(bob.token);
      const noReceipt = expectNoEvent(a, 'chat:read_receipt');

      const ack = await emitWithAck(b, 'chat:mark_read', { conversationId: room.conversationId, messageId: ids[0] });
      assert.equal(ack.data.advanced, false);
      assert.equal(ack.data.lastReadMessageId, ids[2]);
      assert.equal(ack.data.unreadCount, 2);
      await noReceipt;

      const member = await mongoose.model('ConversationMember').findOne({ conversationId: room.conversationId, userId: bob.id }).lean();
      assert.equal(member.lastReadMessageId.toString(), ids[2]);
      await t.disconnect(a, b);
    });

    it('keeps the maximum under concurrent mark_read calls', async () => {
      const b = await t.connect(bob.token);
      const shuffled = [ids[3], ids[1], ids[4], ids[0], ids[2]];
      await Promise.all(shuffled.map((messageId) => emitWithAck(b, 'chat:mark_read', { conversationId: room.conversationId, messageId })));
      const summary = await t.api('GET', `/api/v1/conversations/${room.conversationId}/unread`, { token: bob.token });
      assert.deepEqual(summary.body.data, { conversationId: room.conversationId, unreadCount: 0, lastReadMessageId: ids[4] });
      await t.disconnect(b);
    });

    it('marks everything read when messageId is omitted (REST variant)', async () => {
      const a = await t.connect(alice.token);
      await send(a, room.conversationId, 'm6');
      await send(a, room.conversationId, 'm7');
      await t.disconnect(a);
      assert.equal(await unread(bob, room.conversationId), 2);

      const res = await t.api('POST', `/api/v1/conversations/${room.conversationId}/read`, { token: bob.token, body: {} });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.unreadCount, 0);
      assert.equal(res.body.data.advanced, true);
    });

    it('rejects messages from other conversations, strangers and bad ids', async () => {
      const foreign = (await send(await t.connect(alice.token), family.conversationId, 'elsewhere')).data.id;
      const b = await t.connect(bob.token);
      const c = await t.connect(carol.token);

      const wrongConv = await emitWithAck(b, 'chat:mark_read', { conversationId: room.conversationId, messageId: foreign });
      assert.equal(wrongConv.status, 404);
      const stranger = await emitWithAck(c, 'chat:mark_read', { conversationId: room.conversationId });
      assert.equal(stranger.status, 403);
      const badId = await emitWithAck(b, 'chat:mark_read', { conversationId: room.conversationId, messageId: 'zzz' });
      assert.equal(badId.status, 400);

      const restStranger = await t.api('GET', `/api/v1/conversations/${room.conversationId}/unread`, { token: carol.token });
      assert.equal(restStranger.status, 403);
      await t.disconnect(b, c);
    });

    it('GET /conversations/unread-summary returns per-conversation and total counts', async () => {
      const a = await t.connect(alice.token);
      await send(a, room.conversationId, 'summary-1');
      await t.disconnect(a);

      const res = await t.api('GET', '/api/v1/conversations/unread-summary', { token: bob.token });
      assert.equal(res.status, 200);
      const byId = Object.fromEntries(res.body.data.conversations.map((c) => [c.conversationId, c.unreadCount]));
      assert.equal(byId[room.conversationId], 1);
      assert.equal(byId[family.conversationId], await unread(bob, family.conversationId));
      assert.equal(res.body.data.totalUnread, Object.values(byId).reduce((s, n) => s + n, 0));
      assert.ok(res.body.data.totalUnread > 1);

      const carolSummary = await t.api('GET', '/api/v1/conversations/unread-summary', { token: carol.token });
      assert.deepEqual(carolSummary.body.data, {
        totalUnread: 0,
        conversations: [{ conversationId: other.conversationId, unreadCount: 0, lastReadMessageId: null }],
      });
    });

    it('unread counting is an index range scan on { conversationId, _id }', async () => {
      const ChatMessage = mongoose.model('ChatMessage');
      const explain = await ChatMessage.find({
        conversationId: room.conversationId,
        _id: { $gt: new mongoose.Types.ObjectId(ids[0]) },
      }).explain('queryPlanner');
      const plan = JSON.stringify(explain.queryPlanner.winningPlan);
      assert.match(plan, /"indexName":"conversationId_1__id_1"/);
      assert.doesNotMatch(plan, /COLLSCAN/);
    });
  });

  describe('conversations & history (REST)', () => {
    it('lists conversations with members, last message and unread count, newest first', async () => {
      const res = await t.api('GET', '/api/v1/conversations', { token: bob.token });
      assert.equal(res.status, 200);
      const [latest] = res.body.data;
      assert.equal(latest.type, 'group');
      assert.equal(latest.name, 'Receipts');
      assert.equal(latest.lastMessage.content, 'summary-1');
      assert.equal(latest.lastMessage.senderName, 'Alice');
      assert.equal(latest.unreadCount, 1);
      assert.deepEqual(latest.members.map((m) => m.name).sort(), ['Alice', 'Bob']);
      const times = res.body.data.map((c) => Date.parse(c.lastMessageAt || c.createdAt));
      assert.deepEqual(times, [...times].sort((x, y) => y - x));
    });

    it('paginates messages newest page first with a before cursor', async () => {
      const room = await t.createGroup(dave, 'Paging');
      const d = await t.connect(dave.token);
      for (let i = 1; i <= 5; i += 1) await send(d, room.conversationId, `p${i}`);
      await t.disconnect(d);

      const base = `/api/v1/conversations/${room.conversationId}/messages`;
      const p1 = await t.api('GET', `${base}?limit=2`, { token: dave.token });
      assert.deepEqual(p1.body.data.map((m) => m.content), ['p4', 'p5']);
      assert.equal(p1.body.hasMore, true);
      const p2 = await t.api('GET', `${base}?limit=2&before=${p1.body.nextBefore}`, { token: dave.token });
      assert.deepEqual(p2.body.data.map((m) => m.content), ['p2', 'p3']);
      const p3 = await t.api('GET', `${base}?limit=2&before=${p2.body.nextBefore}`, { token: dave.token });
      assert.deepEqual(p3.body.data.map((m) => m.content), ['p1']);
      assert.equal(p3.body.hasMore, false);
      assert.equal(p3.body.nextBefore, null);

      for (const q of ['limit=0', 'limit=101', 'limit=abc', 'before=nope']) {
        assert.equal((await t.api('GET', `${base}?${q}`, { token: dave.token })).status, 400, q);
      }
      assert.equal((await t.api('GET', base, { token: carol.token })).status, 403);
      assert.equal((await t.api('GET', base)).status, 401);
    });

    it('GET /conversations/:id returns detail for members only', async () => {
      const ok = await t.api('GET', `/api/v1/conversations/${family.conversationId}`, { token: dave.token });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.data.id, family.conversationId);
      const no = await t.api('GET', `/api/v1/conversations/${family.conversationId}`, { token: carol.token });
      assert.equal(no.status, 403);
    });
  });

  describe('direct (1-1) conversations', () => {
    it('opens a DM with a circle member, idempotently, and delivers in realtime', async () => {
      const b = await t.connect(bob.token);
      const first = await t.api('POST', '/api/v1/conversations/direct', { token: alice.token, body: { userId: bob.id } });
      assert.equal(first.status, 200);
      assert.equal(first.body.data.type, 'direct');
      assert.equal(first.body.data.name, 'Bob');
      assert.equal(first.body.data.groupId, null);
      assert.deepEqual(first.body.data.members.map((m) => m.id).sort(), [alice.id, bob.id].sort());

      const again = await t.api('POST', '/api/v1/conversations/direct', { token: bob.token, body: { userId: alice.id } });
      assert.equal(again.body.data.id, first.body.data.id);
      assert.equal(again.body.data.name, 'Alice');

      // Bob's socket was connected before the DM existed; it must still receive.
      const a = await t.connect(alice.token);
      const received = waitForEvent(b, 'chat:new_message');
      const ack = await send(a, first.body.data.id, 'psst, Bob');
      assert.equal((await received).id, ack.data.id);

      const dave1 = await t.connect(dave.token);
      const notDave = expectNoEvent(dave1, 'chat:new_message');
      await send(a, first.body.data.id, 'only for Bob');
      await notDave;
      await t.disconnect(a, b, dave1);
    });

    it('rejects yourself, users without a shared circle, and bad ids', async () => {
      const self = await t.api('POST', '/api/v1/conversations/direct', { token: alice.token, body: { userId: alice.id } });
      assert.equal(self.status, 400);
      const stranger = await t.api('POST', '/api/v1/conversations/direct', { token: alice.token, body: { userId: carol.id } });
      assert.equal(stranger.status, 403);
      const bad = await t.api('POST', '/api/v1/conversations/direct', { token: alice.token, body: { userId: 'x' } });
      assert.equal(bad.status, 400);
    });
  });

  describe('chat:typing', () => {
    it('reaches other members only, and drops invalid / unauthorized events', async () => {
      const a = await t.connect(alice.token);
      const b = await t.connect(bob.token);
      const c = await t.connect(carol.token);

      const typing = waitForEvent(b, 'chat:typing');
      const notSelf = expectNoEvent(a, 'chat:typing');
      a.emit('chat:typing', { conversationId: family.conversationId, isTyping: true });
      assert.deepEqual(await typing, { conversationId: family.conversationId, userId: alice.id, name: 'Alice', isTyping: true });
      await notSelf;

      const nothing = expectNoEvent(b, 'chat:typing', 500);
      c.emit('chat:typing', { conversationId: family.conversationId, isTyping: true });
      a.emit('chat:typing', { conversationId: family.conversationId, isTyping: 'yes' });
      a.emit('chat:typing', null);
      await nothing;

      await t.disconnect(a, b, c);
    });
  });
});
