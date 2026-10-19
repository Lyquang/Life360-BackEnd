const { Errors } = require('../../domain/errors');
const { requireGroupMember, sameId } = require('../shared/policies');

function createGroupUseCases({
  groupRepo,
  conversationRepo,
  conversationMemberRepo,
  unitOfWork,
  realtime,
  liveTrailAccessInvalidator,
  logger = console,
}) {
  /** Circle + its group chat are created atomically (single transaction). */
  async function createGroup({ userId, name }) {
    const { group, conversation } = await unitOfWork.run(async (session) => {
      const created = await groupRepo.create({ name, adminId: userId }, { session });
      const conv = await conversationRepo.createGroupConversation(
        { groupId: created._id, name: created.name, createdBy: userId },
        { session }
      );
      await conversationMemberRepo.add(conv._id, userId, { session });
      return { group: created, conversation: conv };
    });

    realtime.subscribeUserToGroup(userId, group._id);
    realtime.subscribeUserToConversation(userId, conversation._id);

    const populated = await groupRepo.findByIdWithAdmin(group._id);
    return { group: populated, conversationId: conversation._id.toString() };
  }

  async function joinGroup({ userId, inviteCode }) {
    const group = await groupRepo.findByInviteCode(inviteCode);
    if (!group) throw Errors.notFound('Invalid invite code. Group not found.');
    if (group.members.some((m) => sameId(m, userId))) {
      throw Errors.badRequest('You are already a member of this group.');
    }

    const conversation = await unitOfWork.run(async (session) => {
      await groupRepo.addMember(group._id, userId, { session });
      const conv = await conversationRepo.ensureGroupConversation(
        { groupId: group._id, name: group.name, createdBy: group.admin },
        { session }
      );
      await conversationMemberRepo.add(conv._id, userId, { session });
      return conv;
    });

    realtime.subscribeUserToGroup(userId, group._id);
    realtime.subscribeUserToConversation(userId, conversation._id);

    const populated = await groupRepo.findByIdWithMembers(group._id);
    return { group: populated, conversationId: conversation._id.toString() };
  }

  async function listMyGroups(userId) {
    const groups = await groupRepo.listByMember(userId);
    const conversations = await conversationRepo.findByGroupIds(groups.map((g) => g._id));
    const conversationByGroup = new Map(conversations.map((c) => [c.groupId.toString(), c._id.toString()]));
    return groups.map((group) => ({
      group,
      conversationId: conversationByGroup.get(group._id.toString()) ?? null,
    }));
  }

  async function getGroupMembers({ userId, groupId }) {
    await requireGroupMember(groupRepo, groupId, userId);
    const group = await groupRepo.findByIdWithMembers(groupId);
    const [conversation] = await conversationRepo.findByGroupIds([group._id]);
    return {
      groupId: group._id,
      groupName: group.name,
      inviteCode: group.inviteCode,
      conversationId: conversation ? conversation._id.toString() : null,
      memberCount: group.members.length,
      members: group.members,
    };
  }

  async function updateNotificationInterval({ userId, groupId, intervalMinutes }) {
    await requireGroupMember(groupRepo, groupId, userId);
    const group = await groupRepo.setNotificationInterval(groupId, intervalMinutes);
    return {
      groupId: group._id,
      notificationIntervalMinutes: group.notificationIntervalMinutes,
    };
  }

  async function applyMembershipRealtimeEffects({ groupId, conversationId, userId, actorId }) {
    try {
      realtime.emitToUser(userId, 'group:membership_ended', {
        groupId: String(groupId),
        userId: String(userId),
        removedBy: String(actorId),
      });
      realtime.unsubscribeUserFromGroup(userId, groupId);
      if (conversationId) realtime.unsubscribeUserFromConversation(userId, conversationId);
      realtime.emitToGroup(groupId, 'group:member_left', {
        groupId: String(groupId),
        userId: String(userId),
        removedBy: String(actorId),
      });
      await liveTrailAccessInvalidator.revalidateForMembershipChange(userId);
    } catch (error) {
      logger.warn('Circle membership committed but realtime cleanup failed; watch lease remains active.', {
        errorName: error?.name || 'Error',
      });
    }
  }

  async function endMembership({ actorId, groupId, targetUserId, selfLeave }) {
    const result = await unitOfWork.run(async (session) => {
      const group = await groupRepo.findById(groupId, { session });
      if (!group) throw Errors.notFound('Group not found.');
      if (!group.members.some((memberId) => sameId(memberId, actorId))) {
        throw Errors.forbidden('You are not a member of this group.');
      }
      if (selfLeave) {
        if (sameId(group.admin, actorId)) {
          throw Errors.conflict('The Circle admin must transfer ownership or delete the Circle before leaving.');
        }
      } else {
        if (!sameId(group.admin, actorId)) throw Errors.forbidden('Only the Circle admin can remove members.');
        if (sameId(targetUserId, group.admin)) {
          throw Errors.conflict('The Circle admin cannot be removed.');
        }
      }
      if (!group.members.some((memberId) => sameId(memberId, targetUserId))) {
        throw Errors.notFound('User is not a member of this group.');
      }

      const conversation = await conversationRepo.findByGroupId(group._id, { session });
      await groupRepo.removeMember(group._id, targetUserId, { session });
      if (conversation) {
        await conversationMemberRepo.remove(conversation._id, targetUserId, { session });
      }
      return {
        groupId: group._id,
        conversationId: conversation?._id || null,
        userId: targetUserId,
      };
    });

    await applyMembershipRealtimeEffects({ ...result, actorId });
    return {
      groupId: String(result.groupId),
      conversationId: result.conversationId ? String(result.conversationId) : null,
      userId: String(result.userId),
      left: true,
    };
  }

  function leaveGroup({ userId, groupId }) {
    return endMembership({ actorId: userId, groupId, targetUserId: userId, selfLeave: true });
  }

  function removeMember({ userId, groupId, memberUserId }) {
    return endMembership({ actorId: userId, groupId, targetUserId: memberUserId, selfLeave: false });
  }

  return {
    createGroup,
    joinGroup,
    listMyGroups,
    getGroupMembers,
    updateNotificationInterval,
    leaveGroup,
    removeMember,
  };
}

module.exports = { createGroupUseCases };
