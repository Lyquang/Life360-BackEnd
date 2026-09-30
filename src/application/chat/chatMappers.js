const idOrNull = (id) => (id ? id.toString() : null);

function toMessageView(message, senderName = null) {
  const a = message.attachment;
  return {
    id: message._id.toString(),
    conversationId: message.conversationId.toString(),
    senderId: message.senderId.toString(),
    senderName,
    type: message.type,
    content: message.content ?? '',
    attachment: a
      ? {
          url: a.url,
          mimeType: a.mimeType ?? null,
          size: a.size ?? null,
          width: a.width,
          height: a.height,
          blurhash: a.blurhash,
        }
      : null,
    createdAt: message.createdAt,
  };
}

function toMemberView(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    avatar: user.avatar || null,
    isOnline: Boolean(user.isOnline),
    lastSeenAt: user.lastSeenAt ?? null,
  };
}

module.exports = { toMessageView, toMemberView, idOrNull };
