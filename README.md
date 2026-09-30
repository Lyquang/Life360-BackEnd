# 📍 Family Tracker — Backend API

> Real-time family location sharing backend built with **Node.js**, **Socket.IO**, **MongoDB** and **Express**.  
> Supports live location tracking, SOS alerts, group circles, real-time chat, location history and journey analysis.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-green)](https://mongoosejs.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-black)](https://socket.io)
[![Deploy on Render](https://img.shields.io/badge/Deploy-Render-purple)](https://render.com)

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔐 **Authentication** | JWT-based register/login, bcrypt password hashing, rate limiting |
| 📍 **Real-time Location** | Live location sharing via Socket.IO with throttling (50m / 30s) |
| 👨‍👩‍👧 **Circles (Groups)** | Create family groups, invite via 6-digit code, manage members |
| 💬 **Real-time Chat** | 1-1 and group messaging, unread counts, read receipts, typing indicators |
| 🖼️ **Image Messages** | Direct-to-S3/R2 upload via pre-signed URLs, blurhash previews |
| 🆘 **SOS Alert** | Emergency broadcast to all circles with location |
| ⏱️ **Stay Alerts** | Auto-notify when a member stays at one place for 30m, 1h, 2h… |
| 🗺️ **Journey Analysis** | Day journey with stay-point detection and moving segments |
| 📋 **Group Digests** | Periodic status summaries broadcast to circle members |
| ⭐ **Favorite Places** | Save and share named places per circle |
| 🩺 **Health Check** | `/api/health` endpoint with DB status |
| 📖 **Swagger Docs** | Auto-generated OpenAPI docs at `/api/docs` |
| 🧪 **Tests** | Integration test suite with in-memory MongoDB |

---

## 🏗️ Architecture

```
src/
├── application/          # Use cases (business logic)
│   ├── auth/             # Register, login, token auth
│   ├── chat/             # Messaging, conversations, upload tickets
│   ├── digests/          # Group status digests scheduler
│   ├── groups/           # Circle CRUD, invite codes
│   ├── history/          # Location history & journey analysis
│   ├── location/         # Real-time location, SOS, presence
│   └── places/           # Favorite places
├── domain/               # Pure business logic (no I/O)
│   ├── errors.js         # Typed error factory
│   ├── geo.js            # Haversine distance, duration formatting
│   ├── journey.js        # Stay-point detection algorithm
│   └── media.js          # Upload key builder & validator
├── infrastructure/       # Data access & external services
│   ├── database/
│   │   ├── connection.js # MongoDB connection (with in-memory fallback)
│   │   ├── models/       # Mongoose schemas (User, Group, Message, etc.)
│   │   └── unitOfWork.js # Transaction wrapper
│   ├── realtime/         # Socket.IO room management
│   ├── repositories/     # Data access layer
│   ├── security/         # JWT service, bcrypt hasher
│   └── storage/          # S3/R2 presigned upload
└── presentation/         # HTTP & WebSocket layer
    ├── http/
    │   ├── app.js        # Express app setup (CORS, Helmet, Swagger)
    │   ├── controllers/  # Request handlers
    │   ├── middleware/    # Auth, validation, error handling
    │   └── routes/       # Route definitions
    ├── socket/
    │   ├── socketServer.js       # Socket.IO server setup
    │   └── gateways/
    │       ├── chatGateway.js    # Chat socket events
    │       └── locationGateway.js # Location socket events
    └── jobs/
        └── digestScheduler.js   # Cron-like digest job
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Clone & Install
```bash
git clone https://github.com/your-username/family-tracker-backend.git
cd family-tracker-backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Run
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start

# Seed fake test user
npm run seed
```

Server starts at `http://localhost:3000`  
Swagger UI: `http://localhost:3000/api/docs`

---

## 🌐 REST API Reference

All endpoints are prefixed with `/api/v1`. Authentication uses `Authorization: Bearer <token>`.

### 🔐 Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register new user → `{ user, token }` |
| `POST` | `/auth/login` | Login → `{ user, token }` |
| `GET`  | `/auth/me` | Current user profile |

### 👨‍👩‍👧 Groups (Circles)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/groups` | Create a circle (atomically creates group chat) |
| `GET`  | `/groups` | List my circles |
| `POST` | `/groups/join` | Join circle by 6-digit invite code |
| `GET`  | `/groups/:id/members` | Circle members with online status & battery |
| `PATCH`| `/groups/:id/notification-interval` | Set digest interval (0=off, max 1440 min) |
| `GET`  | `/groups/:id/digests` | Digest history (paginated) |
| `GET`  | `/groups/:id/digests/latest` | Latest digest |
| `POST` | `/groups/:id/places` | Add favorite place to circle |
| `GET`  | `/groups/:id/places` | List circle's favorite places |

### 💬 Conversations & Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/conversations` | My conversations (newest first) |
| `GET`  | `/conversations/unread-summary` | Total unread across all conversations |
| `POST` | `/conversations/direct` | Get or create 1-1 chat with a circle member |
| `GET`  | `/conversations/:id` | Conversation detail |
| `PATCH`| `/conversations/:id` | Update group chat name/avatar |
| `GET`  | `/conversations/:id/messages` | Message history (cursor-based pagination) |
| `POST` | `/conversations/:id/read` | Mark messages as read |
| `GET`  | `/conversations/:id/unread` | Unread count for one conversation |
| `POST` | `/chat/upload-ticket` | Get pre-signed S3/R2 URL to upload image |

### 🗺️ Location History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/history/:userId` | Today's location points |
| `GET`  | `/history/:userId/journey` | Full-day journey (stay points + moving segments) |

### 🩺 System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/health` | Health check with DB status |
| `GET`  | `/api/v1/socket-info` | Socket event documentation |
| `GET`  | `/api/docs` | Swagger UI |

---

## 🔌 Socket.IO Events

Connect with JWT token:
```js
const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});
```

### Client → Server (emit)

| Event | Payload | Description |
|-------|---------|-------------|
| `update_location` | `{ latitude, longitude, batteryLevel? }` | Send current GPS location |
| `sos_alert` | `{ message?, latitude?, longitude?, batteryLevel? }` | Broadcast SOS to all circles |
| `chat:send_message` | `{ conversationId, type: "text", content }` | Send text message |
| `chat:send_message` | `{ conversationId, type: "image", attachmentUrl, metadata }` | Send image message |
| `chat:mark_read` | `{ conversationId, messageId? }` | Mark messages as read |
| `chat:typing` | `{ conversationId, isTyping }` | Typing indicator |

> **Rate limit:** `chat:send_message` — **20 messages / 10 seconds** per connection.

### Server → Client (on)

| Event | Description |
|-------|-------------|
| `session:ready` | Rooms joined, safe to rely on broadcasts |
| `location_update` | Member location updated |
| `location_stay_alert` | Member at same location for 30m / 1h / 2h... |
| `sos_alert` | Emergency alert from a circle member |
| `sos_confirmed` | Your SOS was delivered |
| `member_online` | Member connected |
| `member_offline` | Member disconnected |
| `group_digest` | Periodic group status summary |
| `chat:new_message` | New message in a conversation |
| `chat:read_receipt` | Someone read a message |
| `chat:typing` | Typing indicator |
| `chat:conversation_updated` | Conversation name/avatar changed |
| `chat:error` | Socket error (when no ack provided) |

---

## 💬 Send a Message — Complete Mobile Example

```js
// 1. Login (REST)
const res = await fetch('http://localhost:3000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'me@example.com', password: 'secret123' })
});
const { token } = await res.json();

// 2. Open 1-1 conversation (REST)
const convRes = await fetch('http://localhost:3000/api/v1/conversations/direct', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'OTHER_USER_ID' })
});
const { data: conversation } = await convRes.json();

// 3. Connect Socket.IO
const socket = io('http://localhost:3000', { auth: { token } });

// 4. Wait for session ready, then send
socket.on('session:ready', () => {
  socket.emit('chat:send_message', {
    conversationId: conversation.id,
    type: 'text',
    content: 'Hello!'
  }, (ack) => {
    // ack = { success: true, data: { id, content, createdAt, ... } }
    console.log('Sent:', ack);
  });
});

// 5. Receive incoming messages
socket.on('chat:new_message', (msg) => {
  console.log(`${msg.senderName}: ${msg.content}`);
});
```

---

## 🖼️ Image Upload Flow

```
1. POST /api/v1/chat/upload-ticket
   Body: { conversationId, contentType, contentLength }
   → { uploadUrl, headers, fileUrl, expiresAt }

2. PUT <uploadUrl>
   Headers: (exact headers from step 1)
   Body: (raw image bytes)

3. socket.emit('chat:send_message', {
     conversationId,
     type: 'image',
     attachmentUrl: fileUrl,
     content: 'Optional caption',
     metadata: { width, height, blurhash, mimeType, size }
   })
```

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | `development` or `production` |
| `PORT` | No | `3000` | HTTP port |
| `MONGODB_URI` | Yes* | `mongodb://localhost:27017/...` | MongoDB connection string |
| `JWT_SECRET` | Yes | `change_me` | Secret key for JWT |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiry |
| `CORS_ORIGIN` | No | `*` | Allowed origins (comma-separated or `*`) |
| `TZ` | No | `Asia/Ho_Chi_Minh` | Server timezone for history |
| `AUTH_RATE_LIMIT` | No | `20` | Max auth requests / IP / 15 min |
| `S3_BUCKET` | No | — | S3/R2 bucket (enables image upload) |
| `S3_REGION` | No | `auto` | S3 region (`auto` for Cloudflare R2) |
| `S3_ENDPOINT` | No | — | Custom S3 endpoint (Cloudflare R2) |
| `S3_ACCESS_KEY_ID` | No | — | S3 access key |
| `S3_SECRET_ACCESS_KEY` | No | — | S3 secret key |
| `S3_PUBLIC_BASE_URL` | No | — | Public CDN base URL |
| `UPLOAD_MAX_BYTES` | No | `10485760` | Max image size (10 MB) |
| `UPLOAD_URL_TTL_SECONDS` | No | `300` | Pre-signed URL TTL (5 min) |

> *In development, if `MONGODB_URI` is missing or unreachable, the server auto-falls back to an **in-memory MongoDB** instance.

---

## 🗄️ Data Models

| Model | Key Fields |
|-------|-----------|
| `User` | name, email, passwordHash, isOnline, lastKnownLocation, batteryLevel |
| `Group` | name, admin, members[], inviteCode, notificationIntervalMinutes |
| `Conversation` | type (group/direct), groupId, name, lastMessageId, lastMessageAt |
| `ConversationMember` | conversationId, userId, lastReadMessageId |
| `ChatMessage` | conversationId, senderId, type (text/image), content, attachment |
| `LocationHistory` | userId, location (GeoJSON), timestamp |
| `GroupDigest` | groupId, members[], intervalMinutes, sentAt |
| `FavoritePlace` | groupId, name, category, location (GeoJSON) |

---

## 🧪 Testing

```bash
npm test
```

- Uses **in-memory MongoDB** — no external database required
- Covers full HTTP + Socket.IO integration
- Run with `--test-concurrency=1` for sequential isolation

---

## 🚢 Deployment

### Render (Recommended)

`render.yaml` is included for one-click deployment:

1. Push this repo to GitHub
2. Create a new **Web Service** on [Render](https://render.com) → connect repo
3. Set `MONGODB_URI` secret (MongoDB Atlas)
4. Deploy → your API is live 🚀

**Health check:** `GET /api/health`  
**Region:** Singapore (`ap-southeast-1`)

### Docker / Manual

```bash
NODE_ENV=production \
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/family-tracker \
JWT_SECRET=$(openssl rand -hex 32) \
npm start
```

---

## 📦 Tech Stack

| | Package | Purpose |
|--|---------|---------|
| 🌐 | `express` | HTTP server & routing |
| ⚡ | `socket.io` | Real-time bidirectional events |
| 🍃 | `mongoose` | MongoDB ODM |
| 🔑 | `jsonwebtoken` | JWT auth |
| 🔒 | `bcryptjs` | Password hashing |
| ✅ | `zod` | Schema validation |
| ☁️ | `@aws-sdk/client-s3` | S3/R2 image upload |
| 🛡️ | `helmet` | Security headers |
| 🚦 | `express-rate-limit` | Rate limiting |
| 📖 | `swagger-jsdoc` | API documentation |

---

## 📄 License

MIT — feel free to use, modify and distribute.
