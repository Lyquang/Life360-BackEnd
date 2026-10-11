const { circleMembersKey } = require('../../domain/cacheKeys');

function createCachedGroupRepository({ groupRepo, cacheManager }) {
  async function invalidateGroup(groupId) {
    await cacheManager.del(circleMembersKey(groupId.toString()));
  }

  return {
    ...groupRepo,
    async create(input, options) {
      const group = await groupRepo.create(input, options);
      await invalidateGroup(group._id);
      return group;
    },
    async addMember(groupId, userId, options) {
      const result = await groupRepo.addMember(groupId, userId, options);
      await invalidateGroup(groupId);
      return result;
    },
    async findByIdWithMembers(id) {
      const key = circleMembersKey(id.toString());
      const cached = await cacheManager.get(key);
      if (cached) return cached;

      const group = await groupRepo.findByIdWithMembers(id);
      if (!group) {
        await cacheManager.setWithTTL(key, null, 30);
        return null;
      }
      await cacheManager.setWithTTL(key, group, 90, { jitterSeconds: 30 });
      return group;
    },
    async setNotificationInterval(groupId, minutes) {
      const group = await groupRepo.setNotificationInterval(groupId, minutes);
      await invalidateGroup(groupId);
      return group;
    },
  };
}

module.exports = { createCachedGroupRepository };
