const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { localDateFor } = require('../src/domain/liveTrail');
const { createGroupUseCases } = require('../src/application/groups/groupUseCases');
const { startTestServer, waitForEvent, expectNoEvent, emitWithAck } = require('./helpers/testServer');

const Group = () => mongoose.model('Group');
const ConversationMember = () => mongoose.model('ConversationMember');

describe('Circle leave/remove privacy hooks', { timeout: 120000 }, () => {
  let t, owner, member, other;

  before(async () => {
    t = await startTestServer({ env: { LIVE_TRAIL_ENABLED: 'true' } });
    [owner, member, other] = await Promise.all(
      ['ExitOwner', 'ExitMember', 'ExitOther'].map((name) => t.registerUser(name))
    );
  });

  after(() => t.stop());

  it('keeps a watch while another shared Circle exists, then closes it immediately after the last leave', async () => {
    const first = await t.createGroup(owner, 'Shared One');
    const second = await t.createGroup(owner, 'Shared Two');
    await t.joinGroup(member, first);
    await t.joinGroup(member, second);
    const at = new Date();
    await t.instance.container.services.liveTrailProjection.project({
      userId: owner.id,
      points: [{ latitude: 10.762, longitude: 106.66, recordedAt: at, accuracy: 8 }],
    });
    const date = localDateFor(at, 'Asia/Ho_Chi_Minh');
    const ownerSocket = await t.connect(owner.token);
    const memberSocket = await t.connect(member.token);
    const watch = await emitWithAck(memberSocket, 'journey:watch', { userId: owner.id, date });
    assert.equal(watch.ok, true);

    const firstEnded = waitForEvent(memberSocket, 'group:membership_ended');
    const firstLeft = waitForEvent(ownerSocket, 'group:member_left');
    const firstResponse = await t.api('DELETE', `/api/v1/groups/${first.id}/members/me`, {
      token: member.token,
    });
    assert.equal(firstResponse.status, 200, JSON.stringify(firstResponse.body));
    assert.equal((await firstEnded).groupId, first.id);
    assert.equal((await firstLeft).userId, member.id);
    await expectNoEvent(memberSocket, 'journey:trail_closed', 200);
    assert.equal(
      await ConversationMember().countDocuments({ conversationId: first.conversationId, userId: member.id }),
      0
    );

    const closedPromise = waitForEvent(memberSocket, 'journey:trail_closed');
    const secondResponse = await t.api('DELETE', `/api/v1/groups/${second.id}/members/me`, {
      token: member.token,
    });
    assert.equal(secondResponse.status, 200);
    assert.deepEqual(await closedPromise, {
      userId: owner.id,
      trailId: watch.trailId,
      reason: 'permission_revoked',
    });

    const noMessage = expectNoEvent(memberSocket, 'chat:new_message', 250);
    const sent = await emitWithAck(ownerSocket, 'chat:send_message', {
      conversationId: second.conversationId,
      type: 'text',
      content: 'members only',
    });
    assert.equal(sent.success, true);
    await noMessage;
    await t.disconnect(ownerSocket, memberSocket);
  });

  it('allows only the admin to remove another member and never removes the admin', async () => {
    const group = await t.createGroup(owner, 'Admin Circle');
    await t.joinGroup(member, group);
    await t.joinGroup(other, group);

    const forbidden = await t.api('DELETE', `/api/v1/groups/${group.id}/members/${other.id}`, {
      token: member.token,
    });
    assert.equal(forbidden.status, 403);

    const removed = await t.api('DELETE', `/api/v1/groups/${group.id}/members/${other.id}`, {
      token: owner.token,
    });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.data.userId, other.id);
    assert.equal(
      await ConversationMember().countDocuments({ conversationId: group.conversationId, userId: other.id }),
      0
    );

    const adminLeave = await t.api('DELETE', `/api/v1/groups/${group.id}/members/me`, {
      token: owner.token,
    });
    assert.equal(adminLeave.status, 409);
    const removeAdmin = await t.api('DELETE', `/api/v1/groups/${group.id}/members/${owner.id}`, {
      token: owner.token,
    });
    assert.equal(removeAdmin.status, 409);
  });

  it('rolls back Circle membership when group-chat membership removal fails', async () => {
    const group = await t.createGroup(owner, 'Exit Rollback');
    await t.joinGroup(member, group);
    const failing = createGroupUseCases({
      ...t.instance.container.deps,
      conversationMemberRepo: {
        ...t.instance.container.deps.conversationMemberRepo,
        remove: async () => { throw new Error('conversation membership delete failed'); },
      },
    });

    await assert.rejects(
      failing.leaveGroup({ userId: member.id, groupId: group.id }),
      /conversation membership delete failed/
    );
    const stored = await Group().findById(group.id).lean();
    assert.ok(stored.members.some((id) => id.toString() === member.id));
    assert.equal(
      await ConversationMember().countDocuments({ conversationId: group.conversationId, userId: member.id }),
      1
    );
  });
});
