const ChatMessage = require('../database/models/ChatMessage');

function afterCursor(conversationId, afterId) {
  const filter = { conversationId };
  if (afterId) filter._id = { $gt: afterId };
  return filter;
}

module.exports = {
  create({ conversationId, senderId, type, content, attachment }) {
    return ChatMessage.create({ conversationId, senderId, type, content, attachment });
  },

  findInConversation(messageId, conversationId) {
    return ChatMessage.findOne({ _id: messageId, conversationId }).lean();
  },

  findByIds(ids) {
    return ChatMessage.find({ _id: { $in: ids } }).lean();
  },

  /** Newest-first page of `limit + 1` docs (the extra one tells whether more exist). */
  listPage(conversationId, { before, limit }) {
    const filter = { conversationId };
    if (before) filter._id = { $lt: before };
    return ChatMessage.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  },

  /** Index-only range count on { conversationId, _id }. */
  countAfter(conversationId, afterId) {
    return ChatMessage.countDocuments(afterCursor(conversationId, afterId));
  },

  /**
   * One aggregation for many conversations; each $or branch is an index range on { conversationId, _id }.
   * @param {Array<{conversationId, lastReadMessageId}>} cursors
   * @returns {Promise<Map<string, number>>}
   */
  async countUnreadByConversation(cursors) {
    if (cursors.length === 0) return new Map();
    const rows = await ChatMessage.aggregate([
      { $match: { $or: cursors.map((c) => afterCursor(c.conversationId, c.lastReadMessageId)) } },
      { $group: { _id: '$conversationId', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id.toString(), r.count]));
  },
};
