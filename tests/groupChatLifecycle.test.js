const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startTestServer, waitForEvent, expectNoEvent, emitWithAck } = require('./helpers/testServer');
const { createGroupUseCases } = require('../src/application/groups/groupUseCases');

const Group = () => mongoose.model('Group');
const Conversation = () => mongoose.model('Conversation');
const ConversationMember = () => mongoose.model('ConversationMember');

describe('Circle ↔ group chat lifecycle', { timeout: 120000 }, () => {
  let t, alice, bob, carol;

  before(async () => {
    t = await startTestServer();
    [alice, bob, carol] = await Promise.all(['Alice', 'Bob', 'Carol'].map(t.registerUser));
  });
  after(() => t.stop());

  it('runs on a replica set, so transactions are real', () => {
    assert.equal(t.instance.db.supportsTransactions, true);
  });

  describe('create circle (transaction)', () => {
    it('creates the circle, its group conversation and the creator membership together', async () => {
      const { status, body } = await t.api('POST', '/api/v1/groups', { token: alice.token, body: { name: '  Family  ' } });
      assert.equal(status, 201);
      assert.equal(body.data.name, 'Family');
      assert.match(body.data.inviteCode, /^\d{6}$/);
      assert.match(body.data.conversationId, /^[a-f0-9]{24}$/);

      const conversation = await Conversation().findById(body.data.conversationId).lean();
      assert.equal(conversation.type, 'group');
      assert.equal(conversation.groupId.toString(), body.data.id);
      assert.equal(conversation.name, 'Family');

      const members = await ConversationMember().find({ conversationId: conversation._id }).lean();
      assert.deepEqual(members.map((m) => m.userId.toString()), [alice.id]);
      assert.equal(members[0].lastReadMessageId, null);
    });

    it('rolls back the circle when creating the conversation fails', async () => {
      const { deps } = t.instance.container;
      const failing = createGroupUseCases({
        ...deps,
        conversationRepo: {
          ...deps.conversationRepo,
          createGroupConversation: async () => {
            throw new Error('boom: conversation insert failed');
          },
        },
      });
      const groupsBefore = await Group().countDocuments();

      await assert.rejects(failing.createGroup({ userId: alice.id, name: 'Doomed' }), /boom/);
      assert.equal(await Group().countDocuments(), groupsBefore);
      assert.equal(await Group().countDocuments({ name: 'Doomed' }), 0);
    });

    it('rolls back circle AND conversation when adding the member fails', async () => {
      const { deps } = t.instance.container;
      const failing = createGroupUseCases({
        ...deps,
        conversationMemberRepo: {
          ...deps.conversationMemberRepo,
          add: async () => {
            throw new Error('boom: member insert failed');
          },
        },
      });
      const [groupsBefore, conversationsBefore] = await Promise.all([
        Group().countDocuments(),
        Conversation().countDocuments(),
      ]);

      await assert.rejects(failing.createGroup({ userId: alice.id, name: 'Doomed Two' }), /boom/);
      assert.equal(await Group().countDocuments(), groupsBefore);
      assert.equal(await Conversation().countDocuments(), conversationsBefore);
    });

    it('rejects invalid names with a Zod validation error', async () => {
      for (const body of [{}, { name: 'A' }, { name: 'x'.repeat(51) }, { name: 42 }]) {
        const res = await t.api('POST', '/api/v1/groups', { token: alice.token, body });
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.code, 'VALIDATION_ERROR');
        assert.equal(res.body.errors[0].field, 'body.name');
      }
    });
  });

  describe('join circle (transaction)', () => {
    let circle;
    before(async () => {
      circle = await t.createGroup(alice, 'Join Test');
    });

    it('adds the user to the circle and its conversation atomically', async () => {
      const data = await t.joinGroup(bob, circle);
      assert.equal(data.conversationId, circle.conversationId);
      assert.ok(data.members.some((m) => String(m.id) === bob.id));

      const member = await ConversationMember().findOne({ conversationId: circle.conversationId, userId: bob.id }).lean();
      assert.ok(member);
    });

    it('rolls back the circle membership if joining the conversation fails', async () => {
      const other = await t.createGroup(alice, 'Join Rollback');
      const { deps } = t.instance.container;
      const failing = createGroupUseCases({
        ...deps,
        conversationMemberRepo: {
          ...deps.conversationMemberRepo,
          add: async () => {
            throw new Error('boom');
          },
        },
      });

      await assert.rejects(failing.joinGroup({ userId: carol.id, inviteCode: other.inviteCode }), /boom/);
      const group = await Group().findById(other.id).lean();
      assert.ok(!group.members.some((m) => m.toString() === carol.id));
    });

    it('subscribes already-connected sockets of the new member to the chat room', async () => {
      const room = await t.createGroup(alice, 'Live Join');
      const carolSocket = await t.connect(carol.token);
      const aliceSocket = await t.connect(alice.token);

      await t.joinGroup(carol, room);
      const received = waitForEvent(carolSocket, 'chat:new_message');
      const ack = await emitWithAck(aliceSocket, 'chat:send_message', {
        conversationId: room.conversationId,
        type: 'text',
        content: 'welcome Carol',
      });
      assert.equal(ack.success, true);
      assert.equal((await received).content, 'welcome Carol');

      await t.disconnect(carolSocket, aliceSocket);
    });

    it('validates invite codes and rejects duplicates', async () => {
      const bad = await t.api('POST', '/api/v1/groups/join', { token: carol.token, body: { inviteCode: '12ab' } });
      assert.equal(bad.status, 400);
      const unknown = await t.api('POST', '/api/v1/groups/join', { token: carol.token, body: { inviteCode: '000000' } });
      assert.equal(unknown.status, 404);
      const again = await t.api('POST', '/api/v1/groups/join', { token: bob.token, body: { inviteCode: circle.inviteCode } });
      assert.equal(again.status, 400);
      assert.equal(again.body.message, 'You are already a member of this group.');
    });
  });

  describe('legacy circles backfill', () => {
    it('creates missing group conversations and memberships, idempotently', async () => {
      const legacy = await Group().create({ name: 'Legacy', admin: alice.id, members: [alice.id, bob.id] });
      const { chat } = t.instance.container.useCases;

      await chat.syncGroupConversations();
      await chat.syncGroupConversations();

      const conversations = await Conversation().find({ groupId: legacy._id }).lean();
      assert.equal(conversations.length, 1);
      const members = await ConversationMember().find({ conversationId: conversations[0]._id }).lean();
      assert.deepEqual(members.map((m) => m.userId.toString()).sort(), [alice.id, bob.id].sort());
    });
  });

  describe('PATCH /api/v1/conversations/:id (group chat metadata)', () => {
    let circle;
    before(async () => {
      circle = await t.createGroup(alice, 'Meta Circle');
      await t.joinGroup(bob, circle);
    });

    it('lets a circle member rename the chat and set an avatar, broadcasting the change', async () => {
      const bobSocket = await t.connect(bob.token);
      const updated = waitForEvent(bobSocket, 'chat:conversation_updated');

      const res = await t.api('PATCH', `/api/v1/conversations/${circle.conversationId}`, {
        token: alice.token,
        body: { name: '  Nhà mình 🏠 ', avatarUrl: 'https://cdn.test.local/avatars/family.png' },
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.data.name, 'Nhà mình 🏠');
      assert.equal(res.body.data.avatarUrl, 'https://cdn.test.local/avatars/family.png');

      const event = await updated;
      assert.deepEqual(
        { conversationId: event.conversationId, name: event.name, avatarUrl: event.avatarUrl, updatedBy: event.updatedBy },
        { conversationId: circle.conversationId, name: 'Nhà mình 🏠', avatarUrl: 'https://cdn.test.local/avatars/family.png', updatedBy: alice.id }
      );

      // The circle itself keeps its own name.
      assert.equal((await Group().findById(circle.id).lean()).name, 'Meta Circle');
      await t.disconnect(bobSocket);
    });

    it('supports partial updates and clearing the avatar with null', async () => {
      const res = await t.api('PATCH', `/api/v1/conversations/${circle.conversationId}`, {
        token: bob.token,
        body: { avatarUrl: null },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.avatarUrl, null);
      assert.equal(res.body.data.name, 'Nhà mình 🏠');
    });

    it('forbids users outside the circle', async () => {
      const res = await t.api('PATCH', `/api/v1/conversations/${circle.conversationId}`, {
        token: carol.token,
        body: { name: 'hacked' },
      });
      assert.equal(res.status, 403);
      assert.equal((await Conversation().findById(circle.conversationId).lean()).name, 'Nhà mình 🏠');
    });

    it('rejects invalid bodies', async () => {
      const cases = [
        {},
        { name: '' },
        { name: 'x'.repeat(101) },
        { avatarUrl: 'http://insecure.test/a.png' },
        { avatarUrl: 'javascript:alert(1)' },
        { name: 'ok', groupId: 'x' },
      ];
      for (const body of cases) {
        const res = await t.api('PATCH', `/api/v1/conversations/${circle.conversationId}`, { token: alice.token, body });
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.code, 'VALIDATION_ERROR');
      }
    });

    it('returns 404 for unknown conversations and 400 for malformed ids', async () => {
      const missing = await t.api('PATCH', '/api/v1/conversations/0123456789abcdef01234567', {
        token: alice.token,
        body: { name: 'x' },
      });
      assert.equal(missing.status, 404);
      const malformed = await t.api('PATCH', '/api/v1/conversations/nope', { token: alice.token, body: { name: 'x' } });
      assert.equal(malformed.status, 400);
    });

    it('refuses to edit metadata of direct conversations', async () => {
      const direct = await t.api('POST', '/api/v1/conversations/direct', { token: alice.token, body: { userId: bob.id } });
      assert.equal(direct.status, 200);
      const res = await t.api('PATCH', `/api/v1/conversations/${direct.body.data.id}`, {
        token: alice.token,
        body: { name: 'our chat' },
      });
      assert.equal(res.status, 400);
    });

    it('does not broadcast to sockets outside the conversation', async () => {
      const carolSocket = await t.connect(carol.token);
      const none = expectNoEvent(carolSocket, 'chat:conversation_updated');
      await t.api('PATCH', `/api/v1/conversations/${circle.conversationId}`, { token: alice.token, body: { name: 'Quiet' } });
      await none;
      await t.disconnect(carolSocket);
    });
  });
});
