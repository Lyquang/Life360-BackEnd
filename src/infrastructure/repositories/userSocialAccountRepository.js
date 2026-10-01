const UserSocialAccount = require('../database/models/UserSocialAccount');

module.exports = {
  findByProvider(provider, providerId) {
    return UserSocialAccount.findOne({ provider, providerId }).lean();
  },

  create({ userId, provider, providerId }, { session } = {}) {
    return UserSocialAccount.create([{ userId, provider, providerId }], { session }).then(([doc]) => doc);
  },
};
