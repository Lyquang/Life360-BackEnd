const GroupDigest = require('../database/models/GroupDigest');

function buildFilter({ groupId, from, to }) {
  const filter = { groupId };
  if (from || to) {
    filter.sentAt = {};
    if (from) filter.sentAt.$gte = from;
    if (to) filter.sentAt.$lte = to;
  }
  return filter;
}

module.exports = {
  create(digest) {
    return GroupDigest.create(digest);
  },

  async list({ groupId, from, to, skip, limit }) {
    const filter = buildFilter({ groupId, from, to });
    const [items, total] = await Promise.all([
      GroupDigest.find(filter).sort({ sentAt: -1 }).skip(skip).limit(limit).lean(),
      GroupDigest.countDocuments(filter),
    ]);
    return { items, total };
  },

  findLatest(groupId) {
    return GroupDigest.findOne({ groupId }).sort({ sentAt: -1 }).lean();
  },
};
