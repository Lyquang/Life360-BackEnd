const mongoose = require('mongoose');
const ConversationMember = require('../database/models/ConversationMember');

const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id));

function upsertMemberOp(conversationId, userId) {
  return {
    updateOne: {
      filter: { conversationId, userId },
      update: { $setOnInsert: { conversationId, userId, lastReadMessageId: null, lastReadAt: null, joinedAt: new Date() } },
      upsert: true,
    },
  };
}

module.exports = {
  add(conversationId, userId, { session } = {}) {
    return ConversationMember.bulkWrite([upsertMemberOp(conversationId, userId)], { session });
  },

  addMany(conversationId, userIds, { session } = {}) {
    if (userIds.length === 0) return null;
    return ConversationMember.bulkWrite(
      userIds.map((userId) => upsertMemberOp(conversationId, userId)),
      { session, ordered: false }
    );
  },

  find(conversationId, userId) {
    return ConversationMember.findOne({ conversationId, userId }).lean();
  },

  listByUser(userId) {
    return ConversationMember.find({ userId }).lean();
  },

  listByConversationIds(conversationIds) {
    return ConversationMember.find({ conversationId: { $in: conversationIds } }).lean();
  },

  /**
   * lastReadMessageId = GREATEST(lastReadMessageId, messageId), atomically.
   * Returns the document as it was BEFORE the update (null if not a member).
   */
  advanceLastRead(conversationId, userId, messageId, at) {
    const target = toObjectId(messageId);
    return ConversationMember.findOneAndUpdate(
      { conversationId, userId },
      [
        {
          $set: {
            lastReadAt: {
              $cond: [{ $gt: [target, '$lastReadMessageId'] }, at, '$lastReadAt'],
            },
            lastReadMessageId: { $max: ['$lastReadMessageId', target] },
          },
        },
      ],
      { new: false }
    ).lean();
  },
};
