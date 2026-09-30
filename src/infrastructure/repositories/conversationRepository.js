const Conversation = require('../database/models/Conversation');

function directKeyFor(userA, userB) {
  return [userA.toString(), userB.toString()].sort().join(':');
}

module.exports = {
  async createGroupConversation({ groupId, name, createdBy }, { session } = {}) {
    const [conversation] = await Conversation.create(
      [{ type: 'group', groupId, name, createdBy }],
      { session }
    );
    return conversation;
  },

  /** Idempotent: returns the group's conversation, creating it if missing. */
  ensureGroupConversation({ groupId, name, createdBy }, { session } = {}) {
    return Conversation.findOneAndUpdate(
      { groupId },
      { $setOnInsert: { type: 'group', groupId, name, createdBy } },
      { upsert: true, new: true, session }
    );
  },

  async findOrCreateDirect({ userA, userB }) {
    const directKey = directKeyFor(userA, userB);
    try {
      return await Conversation.findOneAndUpdate(
        { directKey },
        { $setOnInsert: { type: 'direct', directKey, createdBy: userA } },
        { upsert: true, new: true }
      );
    } catch (error) {
      // Concurrent upserts on the unique directKey: the other request won.
      if (error.code === 11000) return Conversation.findOne({ directKey });
      throw error;
    }
  },

  findById(id) {
    return Conversation.findById(id).lean();
  },

  findByIds(ids) {
    return Conversation.find({ _id: { $in: ids } }).lean();
  },

  findByGroupIds(groupIds) {
    return Conversation.find({ groupId: { $in: groupIds } }).select('_id groupId').lean();
  },

  updateMetadata(id, patch) {
    return Conversation.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).lean();
  },

  /** GREATEST semantics: concurrent sends can never move lastMessage backwards. */
  recordLastMessage(id, messageId, at) {
    return Conversation.updateOne({ _id: id }, { $max: { lastMessageId: messageId, lastMessageAt: at } });
  },
};
