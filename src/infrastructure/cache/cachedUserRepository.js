const { userProfileKey } = require('../../domain/cacheKeys');

function createCachedUserRepository({ userRepo, cacheManager }) {
  async function invalidateUser(id) {
    await cacheManager.del(userProfileKey(id.toString()));
  }

  return {
    ...userRepo,
    async create(input) {
      const user = await userRepo.create(input);
      await invalidateUser(user._id);
      return user;
    },
    async findById(id) {
      const key = userProfileKey(id.toString());
      const cached = await cacheManager.get(key);
      if (cached) return cached;

      const user = await userRepo.findById(id);
      if (!user) {
        await cacheManager.setWithTTL(key, null, 30);
        return null;
      }
      await cacheManager.setWithTTL(key, user, 600, { jitterSeconds: 120 });
      return user;
    },
    async markOnline(id) {
      const result = await userRepo.markOnline(id);
      await invalidateUser(id);
      return result;
    },
    async updateSocialProfile(id, profile) {
      const user = await userRepo.updateSocialProfile(id, profile);
      await invalidateUser(id);
      return user;
    },
    async markOffline(id, at) {
      const result = await userRepo.markOffline(id, at);
      await invalidateUser(id);
      return result;
    },
    async updateLastKnownLocation(id, location) {
      const result = await userRepo.updateLastKnownLocation(id, location);
      await invalidateUser(id);
      return result;
    },
  };
}

module.exports = { createCachedUserRepository };
