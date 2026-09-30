const { Errors } = require('../../domain/errors');
const { requireGroupMember, sameId } = require('../shared/policies');

function createGroupUseCases({ groupRepo, conversationRepo, conversationMemberRepo, unitOfWork, realtime }) {
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

  return { createGroup, joinGroup, listMyGroups, getGroupMembers, updateNotificationInterval };
}

module.exports = { createGroupUseCases };
