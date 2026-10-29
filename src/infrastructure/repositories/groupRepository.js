const Group = require('../database/models/Group');

const MEMBER_FIELDS = 'name email avatar isOnline batteryLevel locationSharing';
const ADMIN_FIELDS = 'name email avatar';

module.exports = {
  async create({ name, adminId }, { session } = {}) {
    const [group] = await Group.create([{ name, admin: adminId, members: [adminId] }], { session });
    return group;
  },

  findById(id, { session } = {}) {
    const query = Group.findById(id);
    if (session) query.session(session);
    return query;
  },

  findByIdWithAdmin(id) {
    return Group.findById(id).populate('admin', ADMIN_FIELDS);
  },

  findByIdWithMembers(id) {
    return Group.findById(id).populate('members', MEMBER_FIELDS);
  },

  findByInviteCode(inviteCode) {
    return Group.findOne({ inviteCode });
  },

  addMember(groupId, userId, { session } = {}) {
    return Group.updateOne({ _id: groupId }, { $addToSet: { members: userId } }, { session });
  },

  removeMember(groupId, userId, { session } = {}) {
    return Group.updateOne(
      { _id: groupId, members: userId },
      { $pull: { members: userId } },
      { session }
    );
  },

  listByMember(userId) {
    return Group.find({ members: userId })
      .populate('admin', ADMIN_FIELDS)
      .populate('members', MEMBER_FIELDS);
  },

  listSummariesByMember(userId) {
    return Group.find({ members: userId }).select('_id name').lean();
  },

  listForSos(userId, { session, limit } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('SOS group query requires a positive limit.');
    return Group.find({ members: userId }).select('_id name members')
      .sort({ _id: 1 }).limit(limit).session(session || null).lean();
  },

  lockForSos(groupId, userId, { session } = {}) {
    if (!session?.inTransaction()) throw new Error('SOS membership guard requires an active MongoDB transaction.');
    return Group.updateOne({ _id: groupId, members: userId },
      { $inc: { sosGuardVersion: 1 } }, { session });
  },

  findSosAudienceGroups(groupIds, { session } = {}) {
    return Group.find({ _id: { $in: groupIds } }).select('_id name members')
      .sort({ _id: 1 }).session(session || null).lean();
  },

  async usersShareGroup(userA, userB) {
    return Boolean(await Group.exists({ members: { $all: [userA, userB] } }));
  },

  setNotificationInterval(groupId, minutes) {
    return Group.findByIdAndUpdate(
      groupId,
      { notificationIntervalMinutes: minutes },
      { new: true, runValidators: true }
    );
  },

  listWithDigestEnabled() {
    return Group.find({ notificationIntervalMinutes: { $gt: 0 } }).populate(
      'members',
      'name isOnline lastSeenAt lastKnownLocation batteryLevel locationSharing'
    );
  },

  setLastDigestSentAt(groupId, at) {
    return Group.updateOne({ _id: groupId }, { lastDigestSentAt: at });
  },

  listAllForSync() {
    return Group.find({}).select('_id name admin members').lean();
  },
};
