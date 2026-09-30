/** Served by GET /api/v1/socket-info. */
const socketEventDocs = {
  client_to_server: {
    update_location: {
      payload: '{ latitude: Number(-90..90), longitude: Number(-180..180), batteryLevel?: Number }',
      behavior: 'Saves last location (+ throttled history), broadcasts location_update / location_stay_alert to your circles',
    },
    sos_alert: {
      payload: '{ message?: String, latitude?: Number, longitude?: Number, batteryLevel?: Number }',
      behavior: 'Broadcasts sos_alert to all your circles, replies sos_confirmed',
    },
    'chat:send_message': {
      payload: [
        '{ conversationId, type: "text", content: String(1..2000) }',
        '{ conversationId, type: "image", attachmentUrl: fileUrl from upload ticket, content?: caption, metadata: { width, height, blurhash, mimeType?, size? } }',
      ],
      ack: '{ success: true, data: Message } | { success: false, status, code, message, errors? }',
      behavior: 'Persists, broadcasts chat:new_message to the conversation room (except the sending socket). Rate limit 20 msg / 10 s per connection.',
    },
    'chat:mark_read': {
      payload: '{ conversationId, messageId?: String }  (omit messageId = mark all read)',
      ack: '{ success: true, data: { conversationId, lastReadMessageId, unreadCount, advanced } }',
      behavior: 'lastReadMessageId = GREATEST(current, messageId); broadcasts chat:read_receipt when it moves forward',
    },
    'chat:typing': {
      payload: '{ conversationId, isTyping: Boolean }',
      behavior: 'Broadcasts chat:typing to other members (no ack)',
    },
  },
  server_to_client: {
    'session:ready': '{ groupIds: String[], conversationIds: String[] } — rooms joined, safe to rely on broadcasts',
    location_update: '{ userId, name, latitude, longitude, batteryLevel, timestamp, durationAtLocation, durationSince, durationFormatted }',
    location_stay_alert: '{ type: "STAY_ALERT", userId, name, latitude, longitude, durationMinutes, durationFormatted, durationSince, groupId, groupName, message, timestamp }',
    sos_alert: '{ type: "SOS", userId, name, message, latitude, longitude, batteryLevel, groupId, groupName, timestamp }',
    sos_confirmed: '{ message, groupCount }',
    member_online: '{ userId, name, isOnline: true, timestamp }',
    member_offline: '{ userId, name, isOnline: false, lastSeenAt, timestamp }',
    group_digest: '{ type: "GROUP_DIGEST", groupId, groupName, intervalMinutes, members: [...], timestamp }',
    'chat:new_message': '{ id, conversationId, senderId, senderName, type, content, attachment: { url, width, height, blurhash, mimeType, size } | null, createdAt }',
    'chat:read_receipt': '{ conversationId, userId, lastReadMessageId, readAt }',
    'chat:typing': '{ conversationId, userId, name, isTyping }',
    'chat:conversation_updated': '{ conversationId, name, avatarUrl, updatedBy, updatedAt }',
    'chat:error': '{ event, success: false, status, code, message, errors? } — only when the client emitted without an ack',
    error: '{ message, errors? } — invalid location / SOS payloads',
  },
};

module.exports = { socketEventDocs };
