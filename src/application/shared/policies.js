const { Errors } = require('../../domain/errors');

const sameId = (a, b) => a.toString() === b.toString();

async function requireGroupMember(groupRepo, groupId, userId) {
  const group = await groupRepo.findById(groupId);
  if (!group) throw Errors.notFound('Group not found.');
  if (!group.members.some((m) => sameId(m, userId))) {
    throw Errors.forbidden('You are not a member of this group.');
  }
  return group;
}

module.exports = { requireGroupMember, sameId };
