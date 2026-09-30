# CLAUDE.md — AI Agent Guide for Family Tracker Backend

> This file is for AI coding assistants (Claude, Gemini, etc.) to understand the codebase quickly and follow the established patterns.

---

## 🏛 Architecture Overview

This project follows **Clean Architecture** with strict layer separation:

```
server.js → bootstrap.js → container.js → use cases → repositories → models
```

### Layer Rules

| Layer | Location | Rule |
|-------|----------|------|
| **Domain** | `src/domain/` | Pure JS, zero I/O, no imports from other layers |
| **Application** | `src/application/` | Use cases; receives deps via factory function; NO Express/Socket/Mongoose |
| **Infrastructure** | `src/infrastructure/` | Only layer that touches Mongoose, JWT, bcrypt, S3 |
| **Presentation** | `src/presentation/` | Controllers only validate (Zod) → call use case → format response. No DB queries. |

### Dependency Injection

All dependencies are wired in [`container.js`](src/container.js) — the composition root.  
Use cases are created via factory functions: `createXxxUseCases({ repo, service, ... })`.  
Never import a use case directly; always inject via container.

---

## 📁 Directory Structure

```
src/
├── application/
│   ├── auth/           authUseCases.js
│   ├── chat/           chatUseCases.js, chatMappers.js
│   ├── digests/        digestUseCases.js
│   ├── groups/         groupUseCases.js
│   ├── history/        historyUseCases.js
│   ├── location/       locationUseCases.js
│   ├── places/         placeUseCases.js
│   └── shared/         policies.js (requireGroupMember, sameId)
├── domain/
│   ├── errors.js       AppError + Errors factory
│   ├── geo.js          haversineDistance, formatDuration, formatLastSeen
│   ├── journey.js      detectStayPoints, buildDayJourney (stay-point algo)
│   ├── dates.js        localDayRange, formatLocalDate
│   └── media.js        buildChatUploadKey, isChatUploadKeyOwnedBy, IMAGE_MIME_TYPES
├── infrastructure/
│   ├── database/
│   │   ├── connection.js       mongoose.connect + in-memory fallback
│   │   ├── unitOfWork.js       mongoose.connection.transaction() wrapper
│   │   └── models/
│   │       ├── User.js
│   │       ├── Group.js
│   │       ├── Conversation.js
│   │       ├── ConversationMember.js
│   │       ├── ChatMessage.js
│   │       ├── LocationHistory.js
│   │       ├── GroupDigest.js       (TTL 30 days on sentAt)
│   │       └── FavoritePlace.js
│   ├── repositories/           1 file per aggregate, only place that imports models
│   ├── realtime/               socketRealtime.js — port for use cases to emit/subscribe
│   ├── security/               tokenService.js (JWT), passwordHasher.js (bcrypt)
│   └── storage/                s3Storage.js (presigned PUT, S3/R2)
└── presentation/
    ├── dto/                    Zod schemas for ALL requests (HTTP + socket)
    ├── http/
    │   ├── app.js              Express setup (helmet, cors, swagger, rate-limit)
    │   ├── controllers/        1 file per domain
    │   ├── middleware/         validate.js, authenticate.js, errorHandler.js
    │   └── routes/             authRoutes, groupRoutes, chatRoutes, historyRoutes, systemRoutes
    ├── socket/
    │   ├── socketServer.js     io.on('connection') — auth middleware + gateway registration
    │   └── gateways/
    │       ├── chatGateway.js        chat:send_message, chat:mark_read, chat:typing
    │       └── locationGateway.js    update_location, sos_alert
    └── jobs/
        └── digestScheduler.js  setInterval wrapper, calls digests.sendDueDigests every minute
```

---

## 🔑 Key Patterns

### Error Handling
Always use the factory in `domain/errors.js`:
```js
const { Errors } = require('../../domain/errors');

throw Errors.notFound('User not found.');      // 404
throw Errors.forbidden('Not a member.');       // 403
throw Errors.badRequest('Invalid input.');     // 400
throw Errors.unauthorized('Token expired.');   // 401
throw Errors.conflict('Email taken.');         // 409
throw Errors.tooManyRequests('Slow down.');    // 429
throw Errors.serviceUnavailable('S3 off.');   // 503
```

Standard error response: `{ success: false, code, message, errors?: [{ field, message }] }`

### Validation
All request validation uses **Zod** schemas in `src/presentation/dto/`.  
Controllers use the `validate()` middleware — never validate in use cases.

### Transactions
```js
// infrastructure/database/unitOfWork.js
await unitOfWork.run(async (session) => {
  await groupRepo.create({ ... }, { session });
  await conversationRepo.createGroupConversation({ ... }, { session });
});
```
Only available when MongoDB supports replica set (Atlas in production, MongoMemoryReplSet in tests).

### Socket Auth
Handled in `socketServer.js` before any gateway. User object is attached to `socket.data.user`.
Gateways receive `{ chat, location, logger }` and register events with `socket.on(...)`.

### Adding a New Feature
1. Add Zod schema to `src/presentation/dto/`
2. Add use case to `src/application/<domain>/`
3. Add repository methods to `src/infrastructure/repositories/`
4. Wire in `src/container.js`
5. Add controller method → route → test

---

## 🗄 Data Model Summary

### Group (Circle)
```js
{
  name, admin, members: [ObjectId],
  inviteCode: String (6 digits, unique),
  notificationIntervalMinutes: Number (0 = off, default 60, max 1440),
  lastDigestSentAt: Date
}
```

### Conversation
```js
{
  type: 'group' | 'direct',
  groupId: ObjectId,          // only for group type
  directKey: String,          // sorted "userA_userB", unique — prevents duplicate DMs
  name, avatarUrl,
  lastMessageId, lastMessageAt
}
```

### ConversationMember
```js
{
  conversationId, userId,
  lastReadMessageId,          // unread = count(_id > lastReadMessageId)
  lastReadAt
  // unique index: (conversationId, userId)
}
```

### ChatMessage
```js
{
  conversationId, senderId,
  type: 'text' | 'image',
  content: String,
  attachment: { url, key, width, height, blurhash, mimeType, size }
  // index: { conversationId: 1, _id: 1 }
}
```

### User
```js
{
  name, email, passwordHash,
  isOnline, lastSeenAt,
  lastKnownLocation: { coordinates: [lng, lat], updatedAt, durationMinutes },
  batteryLevel
}
```

### GroupDigest
```js
{
  groupId, groupName, intervalMinutes,
  members: [{ userId, name, isOnline, lastSeenText, latitude, longitude, durationMinutes, summary }],
  sentAt   // TTL index: auto-delete after 30 days
}
```

---

## 🔌 All Socket Events Reference

### Client → Server

| Event | Required Payload | Notes |
|-------|-----------------|-------|
| `update_location` | `{ latitude, longitude, batteryLevel? }` | Saves to DB, throttled (50m or 30s) |
| `sos_alert` | `{ message?, latitude?, longitude?, batteryLevel? }` | Broadcasts to all circles |
| `chat:send_message` | `{ conversationId, type, content }` or `{ ..., type: 'image', attachmentUrl, metadata }` | Rate limit 20/10s |
| `chat:mark_read` | `{ conversationId, messageId? }` | Omit messageId = mark all read |
| `chat:typing` | `{ conversationId, isTyping }` | Fire-and-forget, no ack |

### Server → Client

| Event | When |
|-------|------|
| `session:ready` | After join all group+conversation rooms — safe to rely on broadcasts |
| `location_update` | Member sent new location |
| `location_stay_alert` | Member at same spot for 30m/1h/2h/4h/8h/24h |
| `sos_alert` | SOS from a circle member |
| `sos_confirmed` | Your SOS sent to N groups |
| `member_online` | Member connected |
| `member_offline` | Member disconnected (includes `lastSeenAt`) |
| `group_digest` | Scheduled status summary to circle |
| `chat:new_message` | New message in conversation |
| `chat:read_receipt` | Someone advanced their read pointer |
| `chat:typing` | Typing indicator |
| `chat:conversation_updated` | Group chat name/avatar changed |
| `chat:error` | Emit error (only when no ack provided) |

---

## 🌐 REST API Summary

Base: `/api/v1` | Auth: `Authorization: Bearer <token>`

```
POST   /auth/register
POST   /auth/login
GET    /auth/me

POST   /groups                              create circle (atomic: group + conversation)
GET    /groups                              my circles
POST   /groups/join                         join by 6-digit invite code
GET    /groups/:id/members
PATCH  /groups/:id/notification-interval   { intervalMinutes: 0..1440 }
GET    /groups/:id/digests                 ?page&limit&from&to
GET    /groups/:id/digests/latest
POST   /groups/:id/places                  { name, category, latitude, longitude }
GET    /groups/:id/places

GET    /conversations                      with unreadCount, lastMessage
GET    /conversations/unread-summary
POST   /conversations/direct               { userId } get-or-create DM (requires shared circle)
GET    /conversations/:id
PATCH  /conversations/:id                  { name?, avatarUrl? } — group only, member of circle
GET    /conversations/:id/messages         ?limit&before (cursor pagination, oldest→newest)
POST   /conversations/:id/read             { messageId? }
GET    /conversations/:id/unread

POST   /chat/upload-ticket                 { conversationId, contentType, contentLength }

GET    /history/:userId                    today's points
GET    /history/:userId/journey            ?date=YYYY-MM-DD stay points + moving segments

GET    /api/health
GET    /api/v1/socket-info
GET    /api/docs                           Swagger UI
```

---

## 🏗 Chat — Circle Group Chat + Direct 1-1

- Every Circle has exactly one group Conversation (created in same transaction as the Group).
- Joining a Circle also joins its Conversation (atomic transaction).
- DM: `POST /conversations/direct` — get-or-create, requires users share ≥1 circle.
- Server startup: `syncGroupConversations()` backfills any existing circles without conversations (idempotent).
- Unread count: `count(_id > lastReadMessageId)` on `{conversationId, _id}` index — no full scan.
- Read pointer: `$max` update pipeline — never moves backwards, atomic, safe to retry.

### Image Upload Flow
```
1. POST /chat/upload-ticket → { uploadUrl, headers, fileUrl, expiresAt }
2. PUT <uploadUrl> (exact headers, raw bytes)  — S3/R2 validates content-type & content-length
3. socket.emit('chat:send_message', { type: 'image', attachmentUrl: fileUrl, metadata: {...} })
   Server validates attachmentUrl belongs to this user+conversation (prevents URL hijacking)
```

---

## 🔐 Security Notes

- History/journey: requester must be self OR share ≥1 circle with target user (403 otherwise)
- Auth endpoints: 20 req/15min/IP (configurable via `AUTH_RATE_LIMIT`)
- Socket auth error is generic: "Authentication error" (no token leak)
- Image upload keys are scoped to `chat/<conversationId>/<userId>/` — server rejects foreign keys
- GroupDigest TTL: auto-deleted after 30 days (`sentAt` TTL index)

---

## 🧪 Tests

```bash
npm test        # node:test runner, concurrency=1
npm run seed    # seed fake user to MongoDB
```

Test infrastructure:
- `MongoMemoryReplSet` — real transactions, no Atlas needed
- `socket.io-client` — real WebSocket testing
- Shared test server via `createServer()` (same as production)

Test files: `tests/api.test.js`, `tests/chat.test.js`, `tests/upload.test.js`, `tests/groupChatLifecycle.test.js`

---

## ⚙️ Environment Variables

| Key | Default | Description |
|-----|---------|-------------|
| `NODE_ENV` | `development` | `development` enables in-memory MongoDB fallback |
| `PORT` | `3000` | HTTP port |
| `MONGODB_URI` | `mongodb://localhost:27017/...` | Required in production |
| `JWT_SECRET` | `change_me` | **Must change in production** |
| `JWT_EXPIRES_IN` | `7d` | |
| `CORS_ORIGIN` | `*` | Comma-separated list or `*` |
| `TZ` | `Asia/Ho_Chi_Minh` | Timezone for day boundary in history |
| `AUTH_RATE_LIMIT` | `20` | Requests per IP per 15 min for auth |
| `S3_BUCKET` | — | Enables image messages when set |
| `S3_REGION` | `auto` | `auto` for Cloudflare R2 |
| `S3_ENDPOINT` | — | Cloudflare R2 endpoint URL |
| `S3_ACCESS_KEY_ID` | — | |
| `S3_SECRET_ACCESS_KEY` | — | |
| `S3_PUBLIC_BASE_URL` | — | CDN base URL for uploaded files |
| `UPLOAD_MAX_BYTES` | `10485760` | 10 MB |
| `UPLOAD_URL_TTL_SECONDS` | `300` | 5 minutes |

---

## 🚢 Deploy on Render

`render.yaml` is included. Connect repo on Render → Blueprint → set `MONGODB_URI` (MongoDB Atlas).

**Important for Render Free:**
- Service sleeps after 15 min idle → ~50s cold start
- Digest scheduler pauses during sleep → ping `/api/health` every 10 min via UptimeRobot
- Atlas: set Network Access to `0.0.0.0/0` (Render Free has no static IP)

**Health check:** `GET /api/health` → `{ status: "ok", mongodb: "connected" }`

---

## 🔢 Location Throttling & Stay Alert Logic

**History throttle** (in `locationUseCases.js`):
- Save to DB only if moved ≥50m OR ≥30s since last save

**Stay duration tracking** (in-memory, per server instance):
- Reset when moved ≥50m from tracked position
- Alert milestones: 30min, 1h, 2h, 4h, 8h, 24h

**Journey analysis** (in `domain/journey.js`):
- Stay point: run of GPS points within 80m radius lasting ≥5 minutes
- Moving segment: points between stay points
- Algorithm: sliding window, O(n)
