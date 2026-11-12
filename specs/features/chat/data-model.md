# Chat nhóm và trò chuyện riêng — data model

Status: **Current behavior**, source survey 2026-11-11. [Spec](spec.md) · [Schema conventions and ownership index](../../system/data-model.md). Model indexes are declared schema, not production-index validation.

Group-to-conversation is at most one in schema and established/backfilled by application logic, not an unconditional database existence guarantee. Direct conversations have no groupId, use a sorted `userA:userB` key, and retain their ConversationMember records after Circle exit (accepted [REQ-CHAT-01](decisions.md)).

| Model | Typed fields, validation/defaults and ownership |
|---|---|
| Conversation | Required type group/direct and createdBy ref; optional groupId/directKey with partial unique indexes. name String<=100 null, avatarUrl String<=2048 null; lastMessageId ref null, lastMessageAt Date null. timestamps. API uses explicit conversation mapper. |
| ConversationMember | Required conversationId/userId; lastReadMessageId ref null, lastReadAt Date null, joinedAt Date now. Read cursor uses max, not per-message receipts. Removing Circle membership removes group conversation membership only. |
| ChatMessage | Required conversation/sender refs and type text/image/voice. content String<=2000 default empty. attachment null or required URL/key/width/height/blurhash plus nullable mimeType/size. Voice mediaUrl/duration/fileSize/mimeType fields nullable (numbers>=0 at model). Optional sos id/kind alert/assistance valid only on text; ordinary repository ignores client SOS metadata. createdAt only. Request DTO imposes stronger type-specific validation than schema. |

## Conversation — `conversations`

**Schema paths:** `type`, `groupId`, `directKey`, `name`, `avatarUrl`, `lastMessageId`, `lastMessageAt`, `createdBy`, `createdAt`, `updatedAt`.

**Indexes được khai báo:**

- `{"groupId":1}` — `{"unique":true,"partialFilterExpression":{"groupId":{"$type":"objectId"}}}`
- `{"directKey":1}` — `{"unique":true,"partialFilterExpression":{"directKey":{"$type":"string"}}}`

## ConversationMember — `conversation_members`

**Schema paths:** `conversationId`, `userId`, `lastReadMessageId`, `lastReadAt`, `joinedAt`.

**Indexes được khai báo:**

- `{"conversationId":1,"userId":1}` — `{"unique":true}`
- `{"userId":1}`

## ChatMessage — `chat_messages`

**Schema paths:** `conversationId`, `senderId`, `type`, `content`, `sos`, `attachment`, `mediaUrl`, `duration`, `fileSize`, `mimeType`, `createdAt`.

**Indexes được khai báo:**

- `{"conversationId":1,"_id":1}`
- `{"conversationId":1,"sos.id":1}` — `{"unique":true,"partialFilterExpression":{"sos.kind":"alert"}}`
- `{"conversationId":1,"sos.id":1,"senderId":1}` — `{"unique":true,"partialFilterExpression":{"sos.kind":"assistance"}}`
