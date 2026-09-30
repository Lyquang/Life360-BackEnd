const Group = require('../database/models/Group');

const MEMBER_FIELDS = 'name email avatar isOnline batteryLevel';
const ADMIN_FIELDS = 'name email avatar';

module.exports = {
  async create({ name, adminId }, { session } = {}) {
    const [group] = await Group.create([{ name, admin: adminId, members: [adminId] }], { session });
    return group;
  },

  findById(id) {
    return Group.findById(id);
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

  listByMember(userId) {
    return Group.find({ members: userId })
      .populate('admin', ADMIN_FIELDS)
      .populate('members', MEMBER_FIELDS);
  },

  listSummariesByMember(userId) {
    return Group.find({ members: userId }).select('_id name').lean();
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
      'name isOnline lastSeenAt lastKnownLocation batteryLevel'
    );
  },

  setLastDigestSentAt(groupId, at) {
    return Group.updateOne({ _id: groupId }, { lastDigestSentAt: at });
  },

  listAllForSync() {
    return Group.find({}).select('_id name admin members').lean();
  },
};
