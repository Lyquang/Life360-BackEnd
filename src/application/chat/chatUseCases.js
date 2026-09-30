const { randomUUID } = require('crypto');
const { Errors } = require('../../domain/errors');
const { buildChatUploadKey, isChatUploadKeyOwnedBy } = require('../../domain/media');
const { sameId } = require('../shared/policies');
const { toMessageView, toMemberView, idOrNull } = require('./chatMappers');

const isAfter = (a, b) => !b || a.toString() > b.toString(); // ObjectId hex order == creation order

function createChatUseCases({
  conversationRepo,
  conversationMemberRepo,
  messageRepo,
  groupRepo,
  userRepo,
  storage,
  realtime,
}) {
  async function requireMembership(conversationId, userId) {
    const membership = await conversationMemberRepo.find(conversationId, userId);
    if (!membership) throw Errors.forbidden('You are not a member of this conversation.');
    return membership;
  }

  function requireStorage() {
    if (!storage) throw Errors.serviceUnavailable('Media storage is not configured on this server.');
    return storage;
  }

  async function buildConversationViews(userId, memberships) {
    if (memberships.length === 0) return [];
    const conversationIds = memberships.map((m) => m.conversationId);

    const [conversations, unreadByConversation, allMembers] = await Promise.all([
      conversationRepo.findByIds(conversationIds),
      messageRepo.countUnreadByConversation(memberships),
      conversationMemberRepo.listByConversationIds(conversationIds),
    ]);

    const userIds = [...new Set(allMembers.map((m) => m.userId.toString()))];
    const [lastMessages, users] = await Promise.all([
      messageRepo.findByIds(conversations.map((c) => c.lastMessageId).filter(Boolean)),
      userRepo.findManyByIds(userIds),
    ]);

    const usersById = new Map(users.map((u) => [u._id.toString(), u]));
    const messagesById = new Map(lastMessages.map((m) => [m._id.toString(), m]));
    const membershipByConversation = new Map(memberships.map((m) => [m.conversationId.toString(), m]));
    const memberIdsByConversation = new Map();
    for (const m of allMembers) {
      const key = m.conversationId.toString();
      if (!memberIdsByConversation.has(key)) memberIdsByConversation.set(key, []);
      memberIdsByConversation.get(key).push(m.userId.toString());
    }

    return conversations
      .map((c) => {
        const id = c._id.toString();
        const members = (memberIdsByConversation.get(id) || [])
          .map((uid) => usersById.get(uid))
          .filter(Boolean)
          .map(toMemberView);
        const partner = c.type === 'direct' ? members.find((m) => m.id !== userId.toString()) : null;
        const last = c.lastMessageId ? messagesById.get(c.lastMessageId.toString()) : null;

        return {
          id,
          type: c.type,
          groupId: idOrNull(c.groupId),
          name: c.type === 'direct' ? partner?.name ?? null : c.name,
          avatarUrl: c.type === 'direct' ? partner?.avatar ?? null : c.avatarUrl,
          members,
          lastMessage: last ? toMessageView(last, usersById.get(last.senderId.toString())?.name ?? null) : null,
          lastMessageAt: c.lastMessageAt,
          unreadCount: unreadByConversation.get(id) || 0,
          lastReadMessageId: idOrNull(membershipByConversation.get(id).lastReadMessageId),
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      })
      .sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));
  }

  async function listConversations(userId) {
    return buildConversationViews(userId, await conversationMemberRepo.listByUser(userId));
  }

  async function getConversation({ userId, conversationId }) {
    const membership = await requireMembership(conversationId, userId);
    const [view] = await buildConversationViews(userId, [membership]);
    return view;
  }

  async function getConversationIdsForUser(userId) {
    const memberships = await conversationMemberRepo.listByUser(userId);
    return memberships.map((m) => m.conversationId.toString());
  }

  /** Get-or-create the 1-1 conversation between two members of a shared circle. */
  async function openDirectConversation({ userId, otherUserId }) {
    if (sameId(userId, otherUserId)) throw Errors.badRequest('You cannot start a conversation with yourself.');
    if (!(await groupRepo.usersShareGroup(userId, otherUserId))) {
      throw Errors.forbidden('You can only message members of your circles.');
    }

    const conversation = await conversationRepo.findOrCreateDirect({ userA: userId, userB: otherUserId });
    await conversationMemberRepo.addMany(conversation._id, [userId, otherUserId]);
    realtime.subscribeUserToConversation(userId, conversation._id);
    realtime.subscribeUserToConversation(otherUserId, conversation._id);

    return getConversation({ userId, conversationId: conversation._id });
  }

  /** Rename / change avatar of a circle's group chat. Only members of that circle may do it. */
  async function updateConversationMetadata({ userId, conversationId, patch }) {
    const conversation = await conversationRepo.findById(conversationId);
    if (!conversation) throw Errors.notFound('Conversation not found.');
    if (conversation.type !== 'group') {
      throw Errors.badRequest('Only group conversations have editable name and avatar.');
    }
    const group = await groupRepo.findById(conversation.groupId);
    if (!group || !group.members.some((m) => sameId(m, userId))) {
      throw Errors.forbidden('Only members of this circle can update its group chat.');
    }

    await conversationRepo.updateMetadata(conversationId, patch);
    const view = await getConversation({ userId, conversationId });

    realtime.emitToConversation(conversationId, 'chat:conversation_updated', {
      conversationId: view.id,
      name: view.name,
      avatarUrl: view.avatarUrl,
      updatedBy: userId.toString(),
      updatedAt: view.updatedAt,
    });
    return view;
  }

  async function listMessages({ userId, conversationId, before, limit }) {
    await requireMembership(conversationId, userId);
    const docs = await messageRepo.listPage(conversationId, { before, limit });
    const hasMore = docs.length > limit;
    const page = docs.slice(0, limit).reverse();

    const senders = await userRepo.findManyByIds([...new Set(page.map((m) => m.senderId.toString()))]);
    const nameById = new Map(senders.map((u) => [u._id.toString(), u.name]));
    const messages = page.map((m) => toMessageView(m, nameById.get(m.senderId.toString()) ?? null));

    return { messages, hasMore, nextBefore: hasMore ? messages[0].id : null };
  }

  /**
   * @param message validated DTO: { type: 'text', content } | { type: 'image', attachmentUrl, metadata, content? }
   */
  async function sendMessage({ userId, userName, conversationId, message, exceptSocketId }) {
    await requireMembership(conversationId, userId);

    const data = { conversationId, senderId: userId, type: message.type, content: message.content ?? '' };
    if (message.type === 'image') {
      const key = requireStorage().keyFromPublicUrl(message.attachmentUrl);
      if (!isChatUploadKeyOwnedBy(key, { conversationId, userId })) {
        throw Errors.badRequest('attachmentUrl must be the fileUrl of an upload ticket issued to you for this conversation.');
      }
      data.attachment = { url: message.attachmentUrl, key, ...message.metadata };
    }

    const created = await messageRepo.create(data);
    // No transaction needed: both writes are monotonic ($max), so order and retries are safe.
    await Promise.all([
      conversationRepo.recordLastMessage(conversationId, created._id, created.createdAt),
      // Your own message is never unread for you.
      conversationMemberRepo.advanceLastRead(conversationId, userId, created._id, created.createdAt),
    ]);

    const view = toMessageView(created, userName);
    realtime.emitToConversation(conversationId, 'chat:new_message', view, { exceptSocketId });
    return view;
  }

  /** lastReadMessageId = GREATEST(lastReadMessageId, messageId); defaults to the latest message. */
  async function markRead({ userId, conversationId, messageId }) {
    const membership = await requireMembership(conversationId, userId);

    let targetId;
    if (messageId) {
      const message = await messageRepo.findInConversation(messageId, conversationId);
      if (!message) throw Errors.notFound('Message not found in this conversation.');
      targetId = message._id;
    } else {
      targetId = (await conversationRepo.findById(conversationId))?.lastMessageId ?? null;
    }

    let lastReadMessageId = membership.lastReadMessageId;
    let advanced = false;
    if (targetId) {
      const readAt = new Date();
      const previous = await conversationMemberRepo.advanceLastRead(conversationId, userId, targetId, readAt);
      advanced = isAfter(targetId, previous?.lastReadMessageId);
      lastReadMessageId = advanced ? targetId : previous.lastReadMessageId;

      if (advanced) {
        realtime.emitToConversation(conversationId, 'chat:read_receipt', {
          conversationId: conversationId.toString(),
          userId: userId.toString(),
          lastReadMessageId: lastReadMessageId.toString(),
          readAt: readAt.toISOString(),
        });
      }
    }

    const unreadCount = await messageRepo.countAfter(conversationId, lastReadMessageId);
    return {
      conversationId: conversationId.toString(),
      lastReadMessageId: idOrNull(lastReadMessageId),
      unreadCount,
      advanced,
    };
  }

  async function getUnreadCount({ userId, conversationId }) {
    const membership = await requireMembership(conversationId, userId);
    return {
      conversationId: conversationId.toString(),
      unreadCount: await messageRepo.countAfter(conversationId, membership.lastReadMessageId),
      lastReadMessageId: idOrNull(membership.lastReadMessageId),
    };
  }

  async function getUnreadSummary(userId) {
    const memberships = await conversationMemberRepo.listByUser(userId);
    const counts = await messageRepo.countUnreadByConversation(memberships);
    const conversations = memberships.map((m) => ({
      conversationId: m.conversationId.toString(),
      unreadCount: counts.get(m.conversationId.toString()) || 0,
      lastReadMessageId: idOrNull(m.lastReadMessageId),
    }));
    return {
      totalUnread: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
      conversations,
    };
  }

  /** Pre-signed PUT so the client uploads straight to object storage. */
  async function createUploadTicket({ userId, conversationId, contentType, contentLength }) {
    const store = requireStorage();
    if (contentLength > store.maxUploadBytes) {
      throw Errors.badRequest(`File is too large. Maximum size is ${store.maxUploadBytes} bytes.`);
    }
    await requireMembership(conversationId, userId);

    const key = buildChatUploadKey({ conversationId, userId, uuid: randomUUID(), contentType });
    const upload = await store.createPresignedUpload({ key, contentType, contentLength });
    return {
      uploadUrl: upload.url,
      method: 'PUT',
      headers: upload.headers,
      key,
      fileUrl: store.publicUrlFor(key),
      expiresIn: store.urlTtlSeconds,
      expiresAt: new Date(Date.now() + store.urlTtlSeconds * 1000).toISOString(),
    };
  }

  async function notifyTyping({ userId, userName, conversationId, isTyping, exceptSocketId }) {
    await requireMembership(conversationId, userId);
    realtime.emitToConversation(
      conversationId,
      'chat:typing',
      { conversationId: conversationId.toString(), userId: userId.toString(), name: userName, isTyping },
      { exceptSocketId }
    );
  }

  /** Idempotent backfill: every circle has a group chat containing all its members. */
  async function syncGroupConversations() {
    const groups = await groupRepo.listAllForSync();
    for (const group of groups) {
      const conversation = await conversationRepo.ensureGroupConversation({
        groupId: group._id,
        name: group.name,
        createdBy: group.admin,
      });
      await conversationMemberRepo.addMany(conversation._id, group.members);
    }
    return groups.length;
  }

  return {
    listConversations,
    getConversation,
    getConversationIdsForUser,
    openDirectConversation,
    updateConversationMetadata,
    listMessages,
    sendMessage,
    markRead,
    getUnreadCount,
    getUnreadSummary,
    createUploadTicket,
    notifyTyping,
    syncGroupConversations,
  };
}

module.exports = { createChatUseCases };
