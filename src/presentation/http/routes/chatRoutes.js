const express = require('express');
const { validate } = require('../middleware/validate');
const {
  conversationIdParams,
  listMessagesQuery,
  markReadBody,
  updateConversationBody,
  openDirectBody,
  uploadTicketBody,
} = require('../../dto/chat.schemas');

function createConversationRoutes({ controller, authenticate }) {
  const router = express.Router();
  router.use(authenticate);

  /**
   * @swagger
   * /api/v1/conversations:
   *   get:
   *     summary: My conversations (group chats + direct), newest activity first
   *     tags: [Chat]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Conversations
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 count: { type: integer }
   *                 data: { type: array, items: { $ref: '#/components/schemas/Conversation' } }
   */
  router.get('/', controller.listConversations);

  /**
   * @swagger
   * /api/v1/conversations/unread-summary:
   *   get:
   *     summary: Unread counts of all my conversations (single indexed aggregation)
   *     tags: [Chat]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: "{ totalUnread, conversations: [{ conversationId, unreadCount, lastReadMessageId }] }"
   */
  router.get('/unread-summary', controller.unreadSummary);

  /**
   * @swagger
   * /api/v1/conversations/direct:
   *   post:
   *     summary: Get or create the 1-1 conversation with a member of one of your circles
   *     tags: [Chat]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [userId]
   *             properties:
   *               userId: { type: string }
   *     responses:
   *       200: { description: Conversation, content: { application/json: { schema: { $ref: '#/components/schemas/Conversation' } } } }
   *       400: { description: Validation error / yourself }
   *       403: { description: No shared circle }
   */
  router.post('/direct', validate({ body: openDirectBody }), controller.openDirect);

  /**
   * @swagger
   * /api/v1/conversations/{conversationId}:
   *   get:
   *     summary: Conversation detail
   *     tags: [Chat]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/ConversationId'
   *     responses:
   *       200: { description: Conversation }
   *       403: { description: Not a member }
   *   patch:
   *     summary: Update group chat metadata (name, avatarUrl) — circle members only
   *     description: Broadcasts `chat:conversation_updated` to the conversation room.
   *     tags: [Chat]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/ConversationId'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             additionalProperties: false
   *             minProperties: 1
   *             properties:
   *               name: { type: string, minLength: 1, maxLength: 100 }
   *               avatarUrl: { type: string, format: uri, nullable: true, description: https only; null removes it }
   *     responses:
   *       200: { description: Updated conversation }
   *       400: { description: Validation error or not a group conversation }
   *       403: { description: Not a member of the circle }
   *       404: { description: Conversation not found }
   */
  router.get('/:conversationId', validate({ params: conversationIdParams }), controller.getConversation);
  router.patch(
    '/:conversationId',
    validate({ params: conversationIdParams, body: updateConversationBody }),
    controller.updateConversation
  );

  /**
   * @swagger
   * /api/v1/conversations/{conversationId}/messages:
   *   get:
   *     summary: Message history (page is oldest → newest; use before=nextBefore for older pages)
   *     tags: [Chat]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/ConversationId'
   *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 30 } }
   *       - { in: query, name: before, schema: { type: string }, description: Message ID cursor }
   *     responses:
   *       200:
   *         description: Page
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count: { type: integer }
   *                 hasMore: { type: boolean }
   *                 nextBefore: { type: string, nullable: true }
   *                 data: { type: array, items: { $ref: '#/components/schemas/Message' } }
   *       403: { description: Not a member }
   */
  router.get(
    '/:conversationId/messages',
    validate({ params: conversationIdParams, query: listMessagesQuery }),
    controller.listMessages
  );

  /**
   * @swagger
   * /api/v1/conversations/{conversationId}/read:
   *   post:
   *     summary: Mark as read — lastReadMessageId = GREATEST(lastReadMessageId, messageId)
   *     description: Same as socket `chat:mark_read`. Omit messageId to mark everything read. Broadcasts `chat:read_receipt`.
   *     tags: [Chat]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/ConversationId'
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               messageId: { type: string }
   *     responses:
   *       200: { description: "{ conversationId, lastReadMessageId, unreadCount, advanced }" }
   *       403: { description: Not a member }
   *       404: { description: Message not in this conversation }
   */
  router.post(
    '/:conversationId/read',
    validate({ params: conversationIdParams, body: markReadBody }),
    controller.markRead
  );

  /**
   * @swagger
   * /api/v1/conversations/{conversationId}/unread:
   *   get:
   *     summary: Unread count of one conversation (index range on { conversationId, _id })
   *     tags: [Chat]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - $ref: '#/components/parameters/ConversationId'
   *     responses:
   *       200: { description: "{ conversationId, unreadCount, lastReadMessageId }" }
   *       403: { description: Not a member }
   */
  router.get('/:conversationId/unread', validate({ params: conversationIdParams }), controller.unread);

  return router;
}

function createChatRoutes({ controller, authenticate }) {
  const router = express.Router();
  router.use(authenticate);

  /**
   * @swagger
   * /api/v1/chat/upload-ticket:
   *   post:
   *     summary: Pre-signed URL to upload an image directly to object storage (S3 / R2)
   *     description: |
   *       1. Call this endpoint. 2. `PUT` the file bytes to `uploadUrl` with exactly the returned `headers`.
   *       3. Emit `chat:send_message` with `type: "image"`, `attachmentUrl: fileUrl` and `metadata`.
   *     tags: [Chat]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [conversationId, contentType, contentLength]
   *             properties:
   *               conversationId: { type: string }
   *               contentType: { type: string, enum: [image/jpeg, image/png, image/webp, image/heic, image/heif, image/gif] }
   *               contentLength: { type: integer, description: Bytes, must be <= UPLOAD_MAX_BYTES }
   *     responses:
   *       201: { description: Ticket, content: { application/json: { schema: { $ref: '#/components/schemas/UploadTicket' } } } }
   *       400: { description: Validation error / too large }
   *       403: { description: Not a member of the conversation }
   *       503: { description: Storage not configured }
   */
  router.post('/upload-ticket', validate({ body: uploadTicketBody }), controller.uploadTicket);

  return router;
}

module.exports = { createConversationRoutes, createChatRoutes };
