# FamilyTracker Backend

Backend for a family safety and location-sharing application. It provides live member locations, offline location recovery, emergency SOS, family circles, realtime chat, image and voice messages, journey history, and multi-device authentication for the iOS application.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)](https://mongoosejs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io)](https://socket.io/)
[![Redis](https://img.shields.io/badge/Redis-ioredis-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Cloudflare R2](https://img.shields.io/badge/Media-Cloudflare_R2-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/r2/)

## Contents

- [Implemented Features](#implemented-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Google OAuth Login](#google-oauth-login)
- [Authentication and Session Security](#authentication-and-session-security)
- [REST API](#rest-api)
- [Socket.IO Contract](#socketio-contract)
- [Media Upload Flow](#media-upload-flow)
- [Offline Location Sync](#offline-location-sync)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [CI/CD and Deployment](#cicd-and-deployment)
- [Documentation](#documentation)

## Implemented Features

| Area                      | Current implementation                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication            | Email/password registration and login, Google ID Token login, JWT access tokens, opaque refresh tokens, device metadata, logout and password change              |
| Refresh security          | Strict single-use refresh-token rotation, reuse detection, session-family revocation, maximum 10 active device families per user                                 |
| Family circles            | Create circles, join with a six-digit invite code, list members, online status, notification intervals and favorite places                                       |
| Realtime location         | Socket.IO fixes with `recordedAt`, accuracy, motion state, feature-flagged dense history and monotonic last-known writes                                        |
| Offline location recovery | Idempotent `POST /locations/batch`, partial validation and cross-channel fix deduplication without realtime rebroadcast                                         |
| Safety                    | Emergency SOS broadcasts and stay alerts at configured duration milestones                                                                                       |
| Journey history           | Opt-in timestamped geometry, hybrid gap/stay quality, stable IDs, compact payload negotiation and cursor-paginated raw ranges                                   |
| Realtime chat             | Group and direct conversations, text/image/voice messages, unread counts, read receipts and typing indicators                                                    |
| Media storage             | Direct image and voice upload to Cloudflare R2 with short-lived pre-signed PUT URLs; the Node.js server does not proxy binary files                              |
| Redis                     | Optional Upstash-compatible cache, token blacklist, session metadata, profile/member cache, media metadata and last-known location; no-op fallback when disabled |
| API documentation         | Swagger UI, detailed mobile contracts and Swift integration models                                                                                               |
| Delivery                  | Docker image, GitHub Actions lint/audit/tests, GHCR publishing and Render deploy-hook support                                                                    |

## Architecture

The project follows a Clean Architecture-style dependency flow:

```text
presentation -> application -> domain ports/rules <- infrastructure
```

```text
src/
├── domain/                  # Pure policies, errors, geo, OAuth, media and token rules
├── application/             # Framework-independent use cases
│   ├── auth/
│   ├── chat/
│   ├── digests/
│   ├── groups/
│   ├── history/
│   ├── location/
│   └── places/
├── infrastructure/
│   ├── cache/               # RedisCacheManager and NoopCacheManager
│   ├── database/            # Mongoose models, connection and transactions
│   ├── oauth/               # Google OAuth provider adapter and provider factory
│   ├── realtime/            # Socket.IO room adapter
│   ├── repositories/        # MongoDB repository adapters
│   ├── security/            # JWT and bcrypt adapters
│   └── storage/             # Cloudflare R2 / S3-compatible storage adapters
├── presentation/
│   ├── dto/                 # Zod request and event schemas
│   ├── http/                # Express routes, controllers and middleware
│   ├── jobs/                # Digest scheduler
│   └── socket/              # Authenticated Socket.IO gateways
├── config/                  # Environment validation and OpenAPI configuration
└── container.js             # Composition root and dependency wiring
```

Controllers and gateways validate input, pass authenticated context to use cases, and format responses. Business rules remain in application/domain code; Mongoose, Redis, JWT, Google Auth and R2 details stay in infrastructure adapters.

## Technology Stack

| Technology            | Purpose                                                             |
| --------------------- | ------------------------------------------------------------------- |
| Node.js 20+           | Runtime; native watch mode for development                          |
| Express 4             | REST API and middleware pipeline                                    |
| Socket.IO 4           | Authenticated realtime rooms and events                             |
| MongoDB + Mongoose 8  | Primary persistence, GeoJSON data, indexes and transactions         |
| Redis + ioredis 6     | Optional cache, blacklist and ephemeral location/session state      |
| Zod 4                 | Environment, HTTP payload and socket event validation               |
| `jsonwebtoken`        | HS256 access JWT creation and verification                          |
| `bcryptjs`            | Password hashing and verification                                   |
| `google-auth-library` | Google ID Token signature, issuer, expiry and audience verification |
| AWS SDK v3            | S3-compatible pre-signed uploads to Cloudflare R2                   |
| Swagger/OpenAPI       | Interactive API reference at `/api-docs`                            |
| Node test runner      | Sequential integration tests with MongoDB Memory Server             |
| Docker + GHCR         | Reproducible production image and registry publishing               |

## Quick Start

### Requirements

- Node.js 20 or newer
- npm
- MongoDB local instance or MongoDB Atlas
- Optional: Redis/Upstash for caching and immediate access-token blacklist behavior
- Optional: Cloudflare R2 for image and voice uploads
- Optional: Google OAuth Web Client ID for Google login

### Install and run

```bash
git clone https://github.com/Lyquang/Life360-BackEnd.git
cd Life360-BackEnd
npm install
cp .env.example .env
npm run dev
```

Local endpoints:

```text
API base URL:  http://localhost:3000/api/v1
Socket URL:    http://localhost:3000
Swagger UI:    http://localhost:3000/api-docs
OpenAPI JSON:  http://localhost:3000/api-docs.json
Health check:  http://localhost:3000/api/health
```

In local development, an unreachable MongoDB can fall back to an in-memory replica set. Production does not use this fallback and requires a real MongoDB replica set such as Atlas.

## Google OAuth Login

Google login is implemented with a provider port/factory so Apple or Facebook adapters can be added without changing the core social-login use case. **Only Google currently has a working infrastructure adapter.** Although validation reserves `apple` and `facebook`, those providers return an unsupported-provider error until adapters are implemented.

### Google Cloud setup

1. Open Google Cloud Console and configure the OAuth consent screen.
2. Create a **Web application** OAuth Client ID. This is the backend audience/server client ID.
3. Create an **iOS** OAuth Client ID using the app's Bundle ID.
4. Configure Google Sign-In on iOS with the iOS Client ID and set the Web Client ID as `serverClientID`, so the resulting ID Token uses the backend audience.
5. On Render, set `GOOGLE_CLIENT_ID` to the Web Client ID and redeploy.

```env
GOOGLE_CLIENT_ID=1234567890-example.apps.googleusercontent.com
```

The backend verifies a Google **ID Token**, not a Google access token or authorization code. The token's `aud` claim must equal the Web Client ID in `GOOGLE_CLIENT_ID`. The iOS Client ID identifies the native app; it is not the backend audience. A Google client secret is not required by this endpoint because the backend is validating an ID Token rather than exchanging an authorization code.

### Mobile-to-backend request

```http
POST /api/v1/auth/social-login
Content-Type: application/json
```

```json
{
  "provider": "google",
  "token": "GOOGLE_ID_TOKEN_FROM_MOBILE",
  "deviceName": "Quang's iPhone"
}
```

Backend flow:

```text
iOS Google Sign-In
  -> Google ID Token
  -> POST /auth/social-login
  -> GoogleOAuthProvider.verifyToken(token, audience)
  -> find linked social account or match verified email
  -> create/link/update user profile
  -> create device session
  -> return FamilyTracker access and refresh tokens
```

Successful response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "USER_OBJECT_ID",
      "name": "Example User",
      "email": "user@example.com",
      "avatar": "https://lh3.googleusercontent.com/..."
    },
    "token": "ACCESS_JWT_COMPATIBILITY_ALIAS",
    "accessToken": "ACCESS_JWT",
    "refreshToken": "OPAQUE_SINGLE_USE_REFRESH_TOKEN",
    "expiresIn": 900
  }
}
```

`token` is retained as a deprecated alias of `accessToken` for older clients. New mobile code should use `accessToken`.

Common OAuth errors:

| Status                                     | Meaning                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `401 Invalid Google ID token`              | Expired token, wrong token type, invalid signature or `aud` does not match `GOOGLE_CLIENT_ID` |
| `401 Google account email is not verified` | Google profile has no verified email                                                          |
| `503 Google OAuth is not configured`       | `GOOGLE_CLIENT_ID` is missing on the running server                                           |

## Authentication and Session Security

- Access tokens are short-lived HS256 JWTs; default lifetime is 15 minutes.
- Refresh tokens are opaque 48-byte random values. Only SHA-256 hashes are stored in MongoDB.
- Every successful refresh returns a new access token and a new refresh token.
- A refresh token is single-use. Reusing a rotated/revoked token revokes its entire device family.
- Login/register/social-login accept optional `deviceName` up to 100 characters; the server also records IP and user agent.
- A user may have at most 10 active device families. Creating the 11th evicts the oldest family.
- `POST /auth/logout` revokes the current family; `POST /auth/logout-all` revokes all device families.
- Password changes revoke all sessions and disconnect their active sockets.
- Redis provides immediate access-token blacklist checks when enabled. MongoDB remains the source of truth for refresh sessions.
- iOS should store access and refresh tokens in Keychain and serialize refresh calls with a single-flight coordinator.

## REST API

All application routes use the `/api/v1` prefix. Protected routes require:

```http
Authorization: Bearer <accessToken>
```

Standard success and error shapes:

```json
{ "success": true, "data": {} }
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed.",
  "errors": [{ "field": "body.email", "message": "Invalid email" }]
}
```

### Authentication

| Method | Endpoint                | Auth | Description                                                                      |
| ------ | ----------------------- | ---- | -------------------------------------------------------------------------------- |
| `POST` | `/auth/register`        | No   | Register and create a device session                                             |
| `POST` | `/auth/login`           | No   | Email/password login                                                             |
| `POST` | `/auth/social-login`    | No   | Google ID Token login or registration                                            |
| `POST` | `/auth/refresh`         | No   | Strictly rotate a single-use refresh token                                       |
| `POST` | `/auth/logout`          | Yes  | Revoke current family and blacklist current access token when Redis is available |
| `POST` | `/auth/logout-all`      | Yes  | Revoke all device families                                                       |
| `POST` | `/auth/change-password` | Yes  | Change password and revoke all sessions                                          |
| `GET`  | `/auth/me`              | Yes  | Return the current profile                                                       |

### Circles, places and digests

| Method  | Endpoint                                 | Description                                                |
| ------- | ---------------------------------------- | ---------------------------------------------------------- |
| `POST`  | `/groups`                                | Create a circle and its group conversation transactionally |
| `GET`   | `/groups`                                | List the current user's circles                            |
| `POST`  | `/groups/join`                           | Join using a six-digit invite code                         |
| `GET`   | `/groups/:groupId/members`               | List members and status information                        |
| `PATCH` | `/groups/:groupId/notification-interval` | Set digest interval; `0` disables it                       |
| `GET`   | `/groups/:groupId/digests`               | Paginated digest history                                   |
| `GET`   | `/groups/:groupId/digests/latest`        | Latest digest                                              |
| `POST`  | `/groups/:groupId/places`                | Add a named safe/favorite place                            |
| `GET`   | `/groups/:groupId/places`                | List circle places                                         |

### Conversations and chat

| Method  | Endpoint                                  | Description                                                 |
| ------- | ----------------------------------------- | ----------------------------------------------------------- |
| `GET`   | `/conversations`                          | Conversations with latest message and unread count          |
| `GET`   | `/conversations/unread-summary`           | Total and per-conversation unread counts                    |
| `POST`  | `/conversations/direct`                   | Idempotently open a direct chat with a shared-circle member |
| `GET`   | `/conversations/:conversationId`          | Conversation details                                        |
| `PATCH` | `/conversations/:conversationId`          | Update group chat name/avatar                               |
| `GET`   | `/conversations/:conversationId/messages` | Cursor pagination with `before`                             |
| `POST`  | `/conversations/:conversationId/messages` | REST alternative for text/image/voice sending               |
| `POST`  | `/conversations/:conversationId/read`     | Advance the read cursor                                     |
| `GET`   | `/conversations/:conversationId/unread`   | Unread count                                                |
| `POST`  | `/chat/upload-ticket`                     | Legacy image upload ticket                                  |
| `POST`  | `/chat/media/presigned-url`               | Cloudflare R2 image or voice upload ticket                  |

### Location and history

| Method | Endpoint                   | Description                                                                 |
| ------ | -------------------------- | --------------------------------------------------------------------------- |
| `POST` | `/locations/batch`         | Idempotently sync multiple offline points; never broadcasts realtime events |
| `GET`  | `/history/:userId`         | Today's points, or `from/to/limit/cursor` range pagination                  |
| `GET`  | `/history/:userId/journey` | Daily timeline; `detail=geometry&includePath=false` returns compact route and gap metadata |

### System

| Method | Endpoint              | Description                          |
| ------ | --------------------- | ------------------------------------ |
| `GET`  | `/api/v1/health`      | Versioned health endpoint            |
| `GET`  | `/api/health`         | Render/load-balancer health endpoint |
| `GET`  | `/api/v1/socket-info` | Runtime Socket.IO event reference    |
| `GET`  | `/api-docs`           | Swagger UI                           |
| `GET`  | `/api-docs.json`      | OpenAPI JSON                         |

## Socket.IO Contract

Connect to the server root and provide the FamilyTracker access JWT in the handshake:

```js
const socket = io("http://localhost:3000", {
  auth: { token: accessToken },
  transports: ["websocket"],
});

socket.on("session:ready", ({ groupIds, conversationIds }) => {
  // All user, group and conversation rooms are joined.
});
```

### Client to server

| Event               | Payload summary                                                  |
| ------------------- | ---------------------------------------------------------------- |
| `update_location`   | `{ latitude, longitude, batteryLevel?, recordedAt?, accuracy?, pointId?, motionState? }` |
| `sos_alert`         | `{ message?, latitude?, longitude?, batteryLevel? }`             |
| `chat:send_message` | Text, image or voice payload                                     |
| `chat:mark_read`    | `{ conversationId, messageId? }`                                 |
| `chat:typing`       | `{ conversationId, isTyping }`                                   |

`chat:send_message` is limited to 20 messages per 10 seconds per connection.

### Server to client

| Event                              | Purpose                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `session:ready`                    | Connection authenticated and all rooms joined              |
| `location_update`                  | Live member location                                       |
| `location_stay_alert`              | Member reached a stay-duration milestone                   |
| `sos_alert` / `sos_confirmed`      | Emergency delivery and sender confirmation                 |
| `member_online` / `member_offline` | Presence changes                                           |
| `group_digest`                     | Periodic circle summary                                    |
| `chat:new_message`                 | New text/image/voice message                               |
| `chat:read_receipt`                | Read cursor update                                         |
| `chat:typing`                      | Typing state                                               |
| `chat:conversation_updated`        | Group chat metadata changed                                |
| `chat:error`                       | Event failure when no acknowledgement callback is supplied |

## Media Upload Flow

Images and voice notes use direct-to-R2 upload. The backend signs the request and validates namespace ownership, but file bytes never pass through Express.

```text
1. POST /api/v1/chat/media/presigned-url
2. PUT raw bytes directly to uploadUrl with the exact returned headers
3. Send chat:send_message with publicUrl and media metadata
4. Backend validates the issued key, persists the message and broadcasts it
```

Ticket request:

```json
{
  "conversationId": "CONVERSATION_OBJECT_ID",
  "mediaType": "voice",
  "extension": "m4a",
  "mimeType": "audio/m4a",
  "fileSize": 245760
}
```

Default limits are 10 MB for images, 25 MB for voice and 15 minutes for a voice message. Storage namespace:

```text
chats/{conversationId}/{userId}/{uuid}.{extension}
```

The upload URL is temporary; `publicUrl` is the value used in the chat message. The upload PUT request does not use the FamilyTracker bearer token.

## Offline Location Sync

Realtime GPS fixes use Socket.IO. Points buffered while offline use REST:

```http
POST /api/v1/locations/batch
Authorization: Bearer <accessToken>
```

```json
{
  "points": [
    {
      "pointId": "08f68d38-6665-4f0f-8f48-bfa7cc449dc8",
      "latitude": 10.7769,
      "longitude": 106.7009,
      "recordedAt": "2026-10-15T08:30:15.123Z",
      "accuracy": 8.5,
      "batteryLevel": 80
    }
  ]
}
```

- Maximum 100 points per request by default.
- Points are stably ordered by original `recordedAt`.
- UUID and measured-fix fingerprints prevent duplicate history across retries and realtime/batch races.
- Valid points are accepted even if other points in the same batch are rejected.
- Points older than 24 hours or more than 60 seconds in the future are rejected individually.
- Last-known MongoDB and Redis state is updated only by a newer point.
- Batch sync never calls the stay-duration tracker and never broadcasts `location_update`.
- After reconnect, mobile sends buffered history through REST and a newly measured current fix through Socket.IO.

Mobile removes only IDs returned in `accepted` or `duplicates`.

## Environment Variables

### Core and authentication

| Variable                   | Required     | Default          | Description                                                     |
| -------------------------- | ------------ | ---------------- | --------------------------------------------------------------- |
| `NODE_ENV`                 | No           | `development`    | Runtime environment                                             |
| `PORT`                     | No           | `3000`           | HTTP port                                                       |
| `MONGODB_URI`              | Production   | Local URI        | MongoDB connection; production must support transactions        |
| `JWT_SECRET`               | Yes          | None             | Generate a strong secret; `change_me` is rejected in production |
| `JWT_ACCESS_EXPIRES_IN`    | No           | `15m`            | Access JWT lifetime                                             |
| `REFRESH_TOKEN_TTL_DAYS`   | No           | `30`             | Opaque refresh-token lifetime                                   |
| `AUTH_MAX_ACTIVE_SESSIONS` | No           | `10`             | Active device-family limit per user                             |
| `AUTH_RATE_LIMIT`          | No           | `20`             | Register/login/social-login requests per IP per 15 minutes      |
| `REFRESH_RATE_LIMIT`       | No           | `60`             | Refresh requests per IP per 15 minutes                          |
| `GOOGLE_CLIENT_ID`         | Google login | None             | Google Web OAuth Client ID used as ID Token audience            |
| `CORS_ORIGIN`              | No           | `*`              | `*` or comma-separated origins                                  |
| `PUBLIC_URL`               | No           | Render/local URL | URL shown in Swagger and socket-info                            |
| `TZ`                       | No           | Host timezone    | Configure `Asia/Ho_Chi_Minh` for project history semantics      |

### Offline location batch

| Variable                       | Default | Description                                |
| ------------------------------ | ------- | ------------------------------------------ |
| `LOCATION_BATCH_RATE_LIMIT`    | `30`    | Requests per authenticated user per minute |
| `LOCATION_BATCH_MAX_POINTS`    | `100`   | Maximum points per request                 |
| `LOCATION_BATCH_MAX_AGE_HOURS` | `24`    | Oldest accepted `recordedAt`               |

### Dense history, journey and range reads

| Variable                                   | Default | Description                                      |
| ------------------------------------------ | ------- | ------------------------------------------------ |
| `LOCATION_HISTORY_DENSE_ENABLED`           | `false` | Enables the new persistence policy               |
| `LOCATION_HISTORY_MOVING_INTERVAL_SECONDS` | `15`    | Minimum moving interval                          |
| `LOCATION_HISTORY_MOVING_DISTANCE_METERS`  | `25`    | Minimum moving distance; combined with interval  |
| `LOCATION_HISTORY_IDLE_INTERVAL_SECONDS`   | `300`   | Stationary history heartbeat                     |
| `JOURNEY_GAP_THRESHOLD_SECONDS`            | `180`   | Marks missing-data links in geometry mode        |
| `JOURNEY_MAX_POINTS_PER_SEGMENT`           | `1000`  | Maximum returned points after thinning           |
| `JOURNEY_SIMPLIFY_TOLERANCE_METERS`        | `8`     | Initial Douglas-Peucker tolerance                 |
| `HISTORY_RANGE_DEFAULT_LIMIT`              | `500`   | Default raw history page size                    |
| `HISTORY_RANGE_MAX_LIMIT`                  | `1000`  | Maximum raw history page size                    |
| `HISTORY_RANGE_MAX_DAYS`                   | `7`     | Maximum requested range width                    |

### Live trail foundation (gated)

| Variable                         | Default | Description                                                        |
| -------------------------------- | ------- | ------------------------------------------------------------------ |
| `LIVE_TRAIL_ENABLED`             | `false` | Enables transaction-backed trail projection; keep off before rollout gates pass |
| `LIVE_TRAIL_RETENTION_DAYS`      | `7`     | TTL retention for trail metadata and points                        |
| `LIVE_TRAIL_MAX_ACCURACY_METERS` | `100`   | Drops lower-quality fixes from the live-trail projection           |

The T1a persistence foundation is implemented, but there is no public live-trail REST/watch contract yet. Production enablement remains blocked on privacy/member-removal hooks, MongoDB plan/quota verification and load measurement. Existing location updates continue when projection storage fails.

### Redis (optional)

| Variable                        | Default          | Description                                     |
| ------------------------------- | ---------------- | ----------------------------------------------- |
| `REDIS_ENABLED`                 | `false`          | Enables Redis adapters                          |
| `REDIS_URL`                     | None             | `rediss://` connection URL, for example Upstash |
| `REDIS_KEY_PREFIX`              | `familytracker:` | Namespace prefix                                |
| `REDIS_DEFAULT_TTL_SECONDS`     | `300`            | General cache TTL                               |
| `REDIS_CONNECT_TIMEOUT_MS`      | `5000`           | Connection timeout                              |
| `REDIS_MAX_RETRIES_PER_REQUEST` | `2`              | ioredis request retries                         |
| `REDIS_LOCATION_TTL_SECONDS`    | `300`            | Last-known location cache TTL                   |

When Redis is disabled or unavailable, the server continues through MongoDB and `NoopCacheManager`; cache-dependent acceleration and immediate access-token blacklist checks are unavailable.

### Cloudflare R2 (preferred media provider)

| Variable                    | Required for media | Default    |
| --------------------------- | ------------------ | ---------- |
| `R2_ACCOUNT_ID`             | Yes                | None       |
| `R2_ACCESS_KEY_ID`          | Yes                | None       |
| `R2_SECRET_ACCESS_KEY`      | Yes                | None       |
| `R2_BUCKET_NAME`            | Yes                | None       |
| `R2_PUBLIC_DOMAIN`          | Yes                | None       |
| `R2_REGION`                 | No                 | `auto`     |
| `R2_UPLOAD_URL_TTL_SECONDS` | No                 | `300`      |
| `R2_IMAGE_MAX_BYTES`        | No                 | `10485760` |
| `R2_VOICE_MAX_BYTES`        | No                 | `26214400` |

If R2 is not configured, normal API/chat features remain available and media ticket endpoints return `503 SERVICE_UNAVAILABLE`. Legacy `S3_*` variables remain supported for another S3-compatible provider; see `.env.example`.

Never commit `.env`, Google client secrets, R2 secret keys, Redis passwords, JWT secrets, refresh tokens or ID tokens.

## Data Models

| Model                | Important fields                                                                   |
| -------------------- | ---------------------------------------------------------------------------------- |
| `User`               | Email profile, presence, battery and GeoJSON last-known location                   |
| `UserSocialAccount`  | Unique provider/providerId link and unique user/provider link                      |
| `RefreshSession`     | Token hash, family, rotation/revocation chain, device/IP/user-agent and TTL expiry |
| `Group`              | Admin, members, invite code and notification interval                              |
| `FavoritePlace`      | Circle-owned named GeoJSON place                                                   |
| `Conversation`       | Group/direct metadata and last-message cursor                                      |
| `ConversationMember` | Membership and last-read message cursor                                            |
| `ChatMessage`        | Text/image/voice content, attachment/media metadata and indexes                    |
| `LocationHistory`    | GeoJSON fix, measured timestamp, accuracy, motion state, UUID and dedupe fingerprint |
| `GroupDigest`        | Periodic member status snapshot                                                    |

## Testing

```bash
npm run lint
npm test
```

The suite runs sequentially with Node's built-in test runner and MongoDB Memory Server replica sets. It covers REST, Socket.IO, transactions, Google social-login, refresh rotation/reuse, media authorization, dense/cross-channel location persistence, journey geometry, and cursor pagination.

Useful repository-context commands:

```bash
npm run context:skeleton
npm run context:trace -- --term socialLogin
npm run context:graph
```

The generated interactive code graph is written to `codex/context/graph.html`.

## CI/CD and Deployment

GitHub Actions runs on pushes and pull requests for `main` and `develop`:

1. Install with `npm ci`.
2. Run syntax lint.
3. Run `npm audit --audit-level=high`.
4. Run the complete test suite.
5. On push, build a Linux AMD64 Docker image and publish branch/SHA tags to GHCR.
6. On a successful `main` build, call `RENDER_DEPLOY_HOOK_URL`.

Required GitHub Actions secret for automatic Render deployment:

```text
RENDER_DEPLOY_HOOK_URL
```

Render production requires at least `MONGODB_URI` and a secure `JWT_SECRET`. Add `GOOGLE_CLIENT_ID`, Redis and R2 variables only for the corresponding capabilities. `render.yaml` contains the expected variable names and non-secret defaults.

For route-history rollout, deploy with `LOCATION_HISTORY_DENSE_ENABLED=false`, verify MongoDB indexes (especially `{ userId: 1, timestamp: 1, _id: 1 }`), smoke test legacy endpoints, then enable the flag and monitor storage/latency. Setting it back to `false` restores legacy write throttling without changing read contracts.

Docker runtime:

```bash
docker build -t familytracker-backend .
docker run --rm -p 3000:3000 --env-file .env familytracker-backend
```

The production image uses Node 20 Alpine, installs production dependencies only, runs as a non-root user and exposes `/api/health` as its health check.

## Documentation

| Document                                                                                   | Purpose                                                  |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| [`API_INTEGRATION_IOS.md`](API_INTEGRATION_IOS.md)                                         | Complete REST, Socket.IO and Swift integration reference |
| [`Study/GOOGLE_OAUTH2_MOBILE_API_DOC.md`](Study/GOOGLE_OAUTH2_MOBILE_API_DOC.md)           | Google OAuth mobile setup and testing                    |
| [`docs/REFRESH_TOKEN_MOBILE_API_DOC.md`](docs/REFRESH_TOKEN_MOBILE_API_DOC.md)             | Rotation, Keychain and single-flight refresh contract    |
| [`docs/CLOUDFLARE_R2_MEDIA_UPLOAD_API_DOC.md`](docs/CLOUDFLARE_R2_MEDIA_UPLOAD_API_DOC.md) | Image/voice direct-upload contract                       |
| [`api-docs/LOCATION_UPDATE_API_DOC.md`](api-docs/LOCATION_UPDATE_API_DOC.md)               | Realtime and offline-batch location contract             |
| [`api-docs/JOURNEY_ROUTE_API_DOC.md`](api-docs/JOURNEY_ROUTE_API_DOC.md)                   | iOS journey geometry and raw-history pagination contract |
| [`Study/route-geometry-backend-interview-notes.md`](Study/route-geometry-backend-interview-notes.md) | Design trade-offs and interview preparation |
| [`Study/CORE_FLOWS_BACKEND.md`](Study/CORE_FLOWS_BACKEND.md)                               | Backend sequence diagrams and architectural flows        |
| [`Study/CORE_FLOWS_MOBILE.md`](Study/CORE_FLOWS_MOBILE.md)                                 | iOS Swift/SwiftUI integration flows                      |
| [`PROGRESS.md`](PROGRESS.md)                                                               | Implemented tasks, decisions and important files         |

For the live contract of a running server, use `/api-docs` and `/api/v1/socket-info` from that deployment.
