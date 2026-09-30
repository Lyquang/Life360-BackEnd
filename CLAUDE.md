1. Tôi muốn thêm tính năng là Ví dụ trong một gia đinh là biết người đó đang ở thời điểm đó bao nhiêu lâu rồi, 
Ví dụ trong 30 phút, 1 giờ, 1 ngày,  rồi sẽ có gửi thông báo đến cho mọi người trong gia đình theo một tần suất nào đó
2. Với những người trong một nhóm, tôi muốn biết ngày hôm nay họ đã đi theo lộ trình như thế nào( bắt đầu từ 00:00 - 23h59) tôi muốn biết họ sẽ đi theo con đường nào,ở đâu bao lâu, từ bắt đầu một ngày cho đến cuối ngày
3. 

Yêu cầu mới: 
Người trong nhóm vẫn muốn biết là các thành viên trong nhóm mình ở đâu, online được mấy phút trước rồi, ( kể cả giờ là đang offline)
Ví dụ: tất cả thành viên trong nhóm nhận được thông báo là "Quang đã ở địa điểm Vietcombank Tower 30 phút rồi và đã online 30 phút trước " 
Tức là phải có API : lưu dữ liệu dưới Database , tự động gửi thông báo đến cho mọi người trong nhóm theo cài đặt của nhóm ( Ví dụ nhóm setup là mỗi 1 tiếng là phải gủi thông báo đến cho moị người trong nhóm thì 1 tiêngs gửi 1 lần , ai cũng có thể setup như vậy , theo nhu cầu của mỗi người) 

---

## 📋 Implementation Plan — Yêu cầu mới (Group Digest Notification)

### ✅ Backend — DONE

#### Models
- [x] `User.js` — Thêm `lastSeenAt: Date` + `lastKnownLocation: { coordinates, updatedAt, durationMinutes }`
- [x] `Group.js` — Thêm `notificationIntervalMinutes: Number` (default 60) + `lastDigestSentAt: Date`

#### Socket (`socketHandler.js`)
- [x] Khi nhận `update_location`: persist `lastSeenAt` + `lastKnownLocation` vào DB
- [x] Khi nhận `update_location`: persist `durationMinutes` sau khi tính duration  
- [x] Khi `disconnect`: persist `lastSeenAt` + set `isOnline: false` vào DB
- [x] `member_offline` event: bổ sung trường `lastSeenAt`
- [x] **Digest Scheduler**: `setInterval` chạy mỗi 1 phút, kiểm tra từng group
  - So sánh `now - lastDigestSentAt` với `notificationIntervalMinutes`
  - Chỉ gửi nếu có ít nhất 1 thành viên đang online trong room

  - Emit sự kiện `group_digest` đến toàn bộ room
  - Update `lastDigestSentAt` sau khi gửi

#### API
- [x] `PATCH /api/v1/groups/:groupId/notification-interval` — Cài interval (0 = tắt, max 1440)
  - Ai trong nhóm cũng có thể gọi
  - Validate 0 ≤ intervalMinutes ≤ 1440

### 🔲 Mobile (TODO)
- [ ] Subscribe Socket event `group_digest` trong `SocketService.swift`
- [ ] Hiển thị digest panel / notification trong UI (tab "Ở đây" hoặc tab riêng)
- [ ] API call `updateNotificationInterval` để user tự cài
- [ ] Hiển thị "online X phút trước" trên avatar thành viên

---

## Socket Events

### Mới thêm: `group_digest`
```json
{
  "type": "GROUP_DIGEST",
  "groupId": "...",
  "groupName": "Gia đình",
  "intervalMinutes": 60,
  "members": [
    {
      "userId": "...",
      "name": "Quang",
      "isOnline": false,
      "lastSeenText": "30 phút trước",
      "batteryLevel": 72,
      "latitude": 10.776,
      "longitude": 106.700,
      "durationMinutes": 30,
      "durationFormatted": "30 phút",
      "summary": "Quang ở đây 30 phút và 30 phút trước"
    }
  ],
  "timestamp": "2026-09-17T08:00:00.000Z"
}
```

### Cập nhật: `member_offline`
```json
{
  "userId": "...",
  "name": "Quang",
  "isOnline": false,
  "lastSeenAt": "2026-09-17T07:30:00.000Z",
  "timestamp": "2026-09-17T07:30:00.000Z"
}
```


Hình như app vẫn chưa có API get thông báo trong nhóm theo cài đặt thời gian đó, hãy hiện thực API này và ghi vào file claude.md

---

## 🚀 Deploy lên Render (Free) + MongoDB Atlas

### Thay đổi code để chạy production
- `render.yaml` — Render Blueprint (web service, plan free, region singapore, health check `/api/health`)
- `.env.example` — mẫu biến môi trường
- `src/config/env.js` (Zod) — bắt buộc `JWT_SECRET` (và `MONGODB_URI` khi `NODE_ENV=production`), thiếu → exit 1
- `src/infrastructure/database/connection.js`:
  - Production **không** fallback sang in-memory MongoDB; chỉ `NODE_ENV=development` mới fallback (replica set in-memory)
  - Production **bắt buộc replica set** (Atlas) vì dùng transaction
- `src/presentation/http/app.js` — `helmet`, `trust proxy`, CORS từ `CORS_ORIGIN`, body 100kb, ẩn lỗi 5xx khi production
- URL public lấy từ `PUBLIC_URL` hoặc `RENDER_EXTERNAL_URL` (Render tự set)
- `server.js` — graceful shutdown khi nhận `SIGTERM`
- `mongodb-memory-server`, `socket.io-client` ở `devDependencies` (chỉ dùng cho test/dev)

### Bảo mật
- `GET /api/v1/history/:userId` và `/journey`: chỉ xem được **bản thân** hoặc **người cùng nhóm** (403 nếu không), `userId` sai định dạng → 400
- Rate limit `POST /api/v1/auth/register` + `/login`: 20 request / 15 phút / IP (→ 429), chỉnh bằng `AUTH_RATE_LIMIT`
- `GroupDigest` tự xoá sau 30 ngày (TTL index trên `sentAt`)
- Socket auth trả lỗi chung `Authentication error`

### Biến môi trường

| Key | Giá trị | Ghi chú |
|---|---|---|
| `NODE_ENV` | `production` | |
| `MONGODB_URI` | `mongodb+srv://...` | Nhập tay trên Render |
| `JWT_SECRET` | chuỗi ngẫu nhiên | Blueprint tự sinh |
| `JWT_EXPIRES_IN` | `7d` | |
| `TZ` | `Asia/Ho_Chi_Minh` | Để "hôm nay" trong history/journey tính theo giờ VN |
| `CORS_ORIGIN` | `*` | Hoặc danh sách origin, phân tách bằng dấu phẩy |
| `PORT` | — | Render tự cấp, không cần set |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | — | Upload ảnh chat. Set đủ cả 4 hoặc bỏ trống (tắt) |
| `S3_ENDPOINT` / `S3_REGION` | R2: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` / `auto` | AWS S3: bỏ trống endpoint, region ví dụ `ap-southeast-1` |
| `UPLOAD_MAX_BYTES` / `UPLOAD_URL_TTL_SECONDS` | `10485760` / `300` | Tuỳ chọn |

### Các bước deploy
1. **MongoDB Atlas**
   - Database Access → tạo user/password
   - Network Access → Add IP `0.0.0.0/0` (Render Free không có IP tĩnh)
   - Connect → Drivers → copy URI, thêm tên DB: `.../location-sharing-app?retryWrites=true&w=majority`
2. **GitHub**: push repo `Backend` (kèm `package-lock.json`, `render.yaml`; `.env` đã bị ignore)
3. **Render**: Dashboard → New → **Blueprint** → chọn repo → nhập `MONGODB_URI` → Apply
4. Kiểm tra:
   - `https://<app>.onrender.com/api/health` → `"mongodb": "connected"`
   - `https://<app>.onrender.com/api-docs` → Swagger (chọn server "Production server")

### Mobile (iOS) kết nối
- REST base URL: `https://<app>.onrender.com/api/v1`
- Socket.io: `https://<app>.onrender.com` (tự nâng lên `wss://`), `auth: { token }`

### Giới hạn Render Free
- Service ngủ sau 15 phút không có request → lần gọi đầu mất ~50s (cold start)
- Khi ngủ, **digest scheduler dừng** → không gửi `group_digest`. Có thể dùng UptimeRobot / cron-job.org ping `/api/health` mỗi 10 phút
- Chỉ 1 instance → không bị gửi digest trùng
- Nếu Atlas đã có index cũ `sentAt_1` (không TTL) trên collection `groupdigests`, cần drop thủ công để TTL index được tạo

---

## 🏛 Kiến trúc Backend (Clean Architecture)

```
server.js                      # entrypoint: loadConfig → createServer → listen, SIGTERM
src/
├── config/        env.js (Zod env), swagger.js
├── domain/        errors (AppError), geo, journey (stay-point algo), dates, media (upload key rules)
├── application/   use cases — KHÔNG biết Express/Socket.IO/Mongoose
│   ├── auth/ groups/ places/ history/ digests/ location/ chat/
│   └── shared/policies.js     # requireGroupMember
├── infrastructure/
│   ├── database/  connection.js, unitOfWork.js (transaction), models/*
│   ├── repositories/          # 1 file / aggregate, chỉ chỗ này đụng Mongoose model
│   ├── security/  tokenService (JWT), passwordHasher (bcrypt)
│   ├── storage/   s3Storage.js (S3 / R2 presigned PUT)
│   └── realtime/  socketRealtime.js (port emit/subscribe cho use case)
├── presentation/
│   ├── dto/       Zod schemas cho MỌI request (HTTP body/params/query + socket payload)
│   ├── http/      app.js, middleware (validate, authenticate, errorHandler...), controllers, routes (/api/v1)
│   ├── socket/    socketServer.js, gateways/{location,chat}Gateway.js
│   └── jobs/      digestScheduler.js
├── container.js   # composition root: repo + service → use case
└── bootstrap.js   # createServer(config) (dùng chung cho server.js và test)
```

Quy tắc:
- Controller / Gateway: chỉ validate (Zod) → gọi use case → format response. Không query DB.
- Use case nhận dependency qua factory (`createXxxUseCases(deps)`) → test có thể thay repo lỗi để kiểm tra rollback.
- Lỗi nghiệp vụ: `throw Errors.forbidden(...)` (domain/errors) → HTTP status / socket ack tự map.
- Response lỗi chuẩn: `{ success: false, code, message, errors?: [{ field, message }] }`.
- Tất cả REST ở `/api/v1/*` (route cũ `/api/*` đã bỏ; chỉ giữ `/api/health` cho Render health check).

---

## 💬 Chat (Group chat theo Circle + Direct 1-1)

Circle = Group. MongoDB ánh xạ thiết kế SQL như sau:

| SQL | MongoDB |
|---|---|
| bảng `conversations` | collection `conversations` — `{ type: group\|direct, groupId (unique), directKey (unique), name, avatarUrl, lastMessageId, lastMessageAt }` |
| bảng `conversation_members` | collection `conversation_members` — `{ conversationId, userId, lastReadMessageId, lastReadAt }`, unique `(conversationId, userId)` |
| bảng `messages` | collection `chat_messages` — `{ conversationId, senderId, type: text\|image, content, attachment{url,key,width,height,blurhash,mimeType,size}, createdAt }` |
| index `(conversation_id, id)` | index `{ conversationId: 1, _id: 1 }` (ObjectId tăng dần theo thời gian ⇒ đóng vai `id`) |
| `GREATEST(last_read_message_id, $id)` | update pipeline `$max: ['$lastReadMessageId', id]` (atomic) |
| Transaction | `mongoose.connection.transaction()` (Atlas = replica set) |

### 1. Lifecycle Circle ↔ Conversation
- `POST /api/v1/groups` → **1 transaction**: tạo Group + Conversation(type group) + ConversationMember(creator). Lỗi ở bất kỳ bước nào → rollback toàn bộ.
- `POST /api/v1/groups/join` → **1 transaction**: thêm vào `Group.members` + `conversation_members`. Socket đang mở của user tự join room chat mới.
- Khi server start: `syncGroupConversations()` backfill conversation/member cho circle cũ (idempotent).
- `PATCH /api/v1/conversations/:id` `{ name?, avatarUrl? (https | null) }` — chỉ **thành viên Circle**; chỉ group chat; broadcast `chat:conversation_updated`. Không đổi tên Circle.
- `POST /api/v1/conversations/direct` `{ userId }` → get-or-create DM (phải cùng ít nhất 1 circle).

### 2. Read receipts & unread
- Gửi tin → con trỏ đọc của người gửi tự tiến tới tin đó ⇒ `unread = count(_id > lastReadMessageId)` (range thuần trên index, không cần lọc senderId).
- `chat:mark_read` (socket) / `POST /api/v1/conversations/:id/read` `{ messageId? }` — bỏ `messageId` = đọc hết. Con trỏ **không bao giờ lùi**; chỉ broadcast `chat:read_receipt` khi tiến.
- `GET /api/v1/conversations/:id/unread` → `{ conversationId, unreadCount, lastReadMessageId }`
- `GET /api/v1/conversations/unread-summary` → `{ totalUnread, conversations: [...] }` (1 aggregation, mỗi nhánh `$or` là 1 index range)

### 3. Media / hình ảnh
1. `POST /api/v1/chat/upload-ticket` `{ conversationId, contentType: image/jpeg|png|webp|heic|heif|gif, contentLength }` → `{ uploadUrl, method: PUT, headers, key, fileUrl, expiresIn }`
   - Key: `chat/<conversationId>/<userId>/<uuid>.<ext>`; URL ký cả `content-type` + `content-length` (sai type/size → S3/R2 từ chối); TTL 300s
   - Chưa cấu hình `S3_*` → 503
2. Client `PUT` file lên `uploadUrl` với đúng `headers`
3. `chat:send_message` `{ conversationId, type: 'image', attachmentUrl: fileUrl, content?, metadata: { width, height, blurhash, mimeType?, size? } }`
   - Server chỉ nhận `attachmentUrl` là `fileUrl` do chính user đó xin cho đúng conversation (chống dùng URL lạ / của người khác)

### Socket events (chat)
| Hướng | Event | Payload |
|---|---|---|
| C → S | `chat:send_message` | text: `{ conversationId, type: 'text', content }` / image như trên — ack `{ success, data: Message }` |
| C → S | `chat:mark_read` | `{ conversationId, messageId? }` — ack `{ success, data: { lastReadMessageId, unreadCount, advanced } }` |
| C → S | `chat:typing` | `{ conversationId, isTyping }` |
| S → C | `session:ready` | `{ groupIds, conversationIds }` — đã join xong room |
| S → C | `chat:new_message` | `{ id, conversationId, senderId, senderName, type, content, attachment, createdAt }` |
| S → C | `chat:read_receipt` | `{ conversationId, userId, lastReadMessageId, readAt }` |
| S → C | `chat:typing` | `{ conversationId, userId, name, isTyping }` |
| S → C | `chat:conversation_updated` | `{ conversationId, name, avatarUrl, updatedBy, updatedAt }` |
| S → C | `chat:error` | `{ event, status, code, message, errors? }` — khi emit không kèm ack |

Rate limit `chat:send_message`: 20 tin / 10 giây / connection (→ 429).

### REST khác
- `GET /api/v1/conversations` — danh sách (members, lastMessage, unreadCount), mới nhất trước
- `GET /api/v1/conversations/:id` — chi tiết
- `GET /api/v1/conversations/:id/messages?limit=30&before=<messageId>` — 1 trang cũ → mới, trang trước dùng `nextBefore`

### Test
`npm test` — 63 test (node:test + socket.io-client + MongoMemoryReplSet, transaction thật, không đụng Atlas):
`tests/groupChatLifecycle.test.js`, `tests/chat.test.js`, `tests/upload.test.js`, `tests/api.test.js`
