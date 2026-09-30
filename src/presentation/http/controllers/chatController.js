const { asyncHandler } = require('../middleware/asyncHandler');

function createChatController({ chat }) {
  return {
    listConversations: asyncHandler(async (req, res) => {
      const data = await chat.listConversations(req.user._id);
      res.json({ success: true, count: data.length, data });
    }),

    getConversation: asyncHandler(async (req, res) => {
      const data = await chat.getConversation({ userId: req.user._id, conversationId: req.dto.params.conversationId });
      res.json({ success: true, data });
    }),

    openDirect: asyncHandler(async (req, res) => {
      const data = await chat.openDirectConversation({ userId: req.user._id, otherUserId: req.dto.body.userId });
      res.json({ success: true, data });
    }),

    updateConversation: asyncHandler(async (req, res) => {
      const data = await chat.updateConversationMetadata({
        userId: req.user._id,
        conversationId: req.dto.params.conversationId,
        patch: req.dto.body,
      });
      res.json({ success: true, message: 'Conversation updated.', data });
    }),

    listMessages: asyncHandler(async (req, res) => {
      const { messages, hasMore, nextBefore } = await chat.listMessages({
        userId: req.user._id,
        conversationId: req.dto.params.conversationId,
        ...req.dto.query,
      });
      res.json({ success: true, count: messages.length, hasMore, nextBefore, data: messages });
    }),

    markRead: asyncHandler(async (req, res) => {
      const data = await chat.markRead({
        userId: req.user._id,
        conversationId: req.dto.params.conversationId,
        messageId: req.dto.body.messageId,
      });
      res.json({ success: true, data });
    }),

    unread: asyncHandler(async (req, res) => {
      const data = await chat.getUnreadCount({ userId: req.user._id, conversationId: req.dto.params.conversationId });
      res.json({ success: true, data });
    }),

    unreadSummary: asyncHandler(async (req, res) => {
      res.json({ success: true, data: await chat.getUnreadSummary(req.user._id) });
    }),

    sendMessage: asyncHandler(async (req, res) => {
      const data = await chat.sendMessage({
        userId: req.user._id,
        userName: req.user.name,
        conversationId: req.dto.params.conversationId,
        message: req.dto.body,
        exceptSocketId: null, // REST: broadcast to ALL sockets (including caller)
      });
      res.status(201).json({ success: true, data });
    }),

    uploadTicket: asyncHandler(async (req, res) => {
      const data = await chat.createUploadTicket({ userId: req.user._id, ...req.dto.body });
      res.status(201).json({ success: true, data });
    }),
  };
}

module.exports = { createChatController };
