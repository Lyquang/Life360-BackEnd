# Chat nhóm và trò chuyện riêng — contracts

Status: **Current behavior**, surveyed 2026-11-11. [Spec](spec.md) · [Models](data-model.md). HTTP base `/api/v1`; authentication/errors/DTO conventions: [shared API conventions](../../system/api-conventions.md). Socket handshake/rooms: [shared realtime contract](../../system/realtime.md).

## HTTP

| Method/path | Input | Success response / authorization / errors |
|---|---|---|
| GET `/conversations` | none | 200 `{success,count,data:ConversationView[]}`, sorted last activity/creation descending; membership scoped. |
| GET `/conversations/:conversationId` | ID | 200 data ConversationView; conversation membership required. |
| POST `/conversations/direct` | userId ID | 200 data ConversationView; get-or-create pair, forbid self400/no shared Circle403. Existing conversation use after Circle exit is accepted REQ-CHAT-01; opening through this endpoint still checks shared Circle. |
| PATCH `/conversations/:conversationId` | strict object name? trimmed1…100; avatarUrl? HTTPS max2048/null; at least one | 200 data ConversationView; group conversation only400, current Circle member403, absent404. |
| GET `/conversations/:conversationId/messages` | before? message ID; limit1…100 default30 | 200 `{success,count,hasMore,nextBefore,data:MessageView[]}`; membership. Page oldest→newest, cursor retrieves older page. |
| POST `/conversations/:conversationId/messages` | SendMessage body below (conversationId from URL) | 201 data MessageView; membership, persists and broadcasts; ordinary retry not idempotent. |
| POST `/conversations/:conversationId/read` | object messageId? ID | 200 data `{conversationId,lastReadMessageId,unreadCount,advanced}`; membership, message404 if outside conversation. Omit target to mark latest. |
| GET `/conversations/:conversationId/unread` | ID | 200 data `{conversationId,unreadCount,lastReadMessageId}`; membership. |
| GET `/conversations/unread-summary` | none | 200 data `{totalUnread,conversations:[{conversationId,unreadCount,lastReadMessageId}]}`. |

`ConversationView={id,type,groupId,name,avatarUrl,members,lastMessage,lastMessageAt,unreadCount,lastReadMessageId,createdAt,updatedAt}`. Each member is `{id,name,avatar,isOnline,lastSeenAt}`. Direct name/avatar derive from the partner. `MessageView={id,conversationId,senderId,senderName,type,content,attachment,createdAt}`; attachment is null or `{url,mimeType,size,width,height,blurhash}`; voice adds mediaUrl/duration/fileSize/mimeType; server SOS messages add `sos:{id,kind,responderId?}`. SenderName may be null in history; SOS assistance responderId is senderId.

SendMessage is a discriminated union: text `{type:"text",content}` trimmed1…2000; image `{type:"image",attachmentUrl,content?,metadata:{width,height,blurhash,mimeType?,size?}}`; voice `{type:"voice",mediaUrl,duration,fileSize,mimeType}`. URLs HTTPS<=2048; dimensions integers1…20000; blurhash base83 length6…100; image size optional positive integer. Voice duration >0…900 seconds and fileSize positive <=100MiB. Socket variant additionally requires conversationId.

MIME mappings and effective upload limits: [media-upload contracts](../media-upload/contracts.md).

## Client → server socket events

| Event | Payload / validation | Response and scope |
|---|---|---|
| `chat:send_message` | conversationId ID plus text/image/voice union in HTTP contract | Ack `{success:true,data:MessageView}` if callback supplied; else only broadcast to other sockets. Error ack `{success:false,status,code,message,errors?}` or `chat:error:{event,...error}`. 20 sends/10s per connection. Membership required, including continued direct-chat access after Circle exit (REQ-CHAT-01). |
| `chat:mark_read` | conversationId ID; messageId? ID | Same success/error ack envelope; data `{conversationId,lastReadMessageId,unreadCount,advanced}`. Missing target marks latest; no backwards movement. |
| `chat:typing` | conversationId ID, isTyping boolean | Fire-and-forget. Invalid or unauthorized events dropped; emits to conversation excluding sending socket. |

## Server → client socket events

| Event | Payload |
|---|---|
| `chat:new_message` | MessageView from HTTP contract; outbox messages may add eventId and server SOS metadata. |
| `chat:read_receipt` | `{conversationId,userId,lastReadMessageId,readAt}` only when cursor advances. |
| `chat:typing` | `{conversationId,userId,name,isTyping}`. |
| `chat:conversation_updated` | `{conversationId,name,avatarUrl,updatedBy,updatedAt}`. |

Chat uses `success` ack envelopes. Without a callback, errors use `chat:error`; typing errors are silently dropped. REQ-CHAT-01 is owned by [chat decisions](decisions.md).
