# Cloudflare R2 Media Upload For Chat

Tài liệu này phân tích giải pháp lưu trữ media cho module Chat của FamilyTracker, bao gồm Images và Voice Notes, theo mô hình Pre-signed Upload URL. Nội dung được chia thành hai phần:

1. Study & Architecture Analysis.
2. Execution Plan theo Clean Architecture.

> Phạm vi hiện tại: tài liệu và kế hoạch triển khai. Chưa thay đổi mã nguồn backend.

---

## Phần 1: Study & Architecture Analysis

## 1. Tổng Quan Giải Pháp

FamilyTracker chọn Cloudflare R2 làm hạ tầng lưu trữ media cho Chat nhằm tránh để backend Node.js phải nhận, parse, stream, resize hoặc proxy file nhị phân lớn. Backend chỉ giữ vai trò:

- Xác thực user.
- Kiểm tra user có quyền trong conversation.
- Sinh object key an toàn.
- Ký Pre-signed PUT URL.
- Xác thực public URL/key khi client gửi message.
- Persist message metadata trong MongoDB.
- Broadcast message realtime qua Socket.io.

Client sẽ upload file trực tiếp lên Cloudflare R2 bằng HTTP PUT. Điều này giảm tải CPU/RAM/network bandwidth cho backend và tránh nghẽn event loop khi nhiều người gửi ảnh/voice cùng lúc.

## 2. Data Flow

### 2.1 Upload Image / Voice Note Flow

```txt
1. Client -> Backend
   POST /api/chat/media/presigned-url
   Authorization: Bearer <token>
   Body: { conversationId, mediaType, extension, mimeType, fileSize? }

2. Backend
   - Verify JWT.
   - Validate request bằng Zod.
   - Check user là member của conversation.
   - Validate mediaType, extension, mimeType, size limit.
   - Generate key:
     chats/{conversationId}/{uniqueId}.{ext}
     hoặc chats/{conversationId}/{userId}/{uniqueId}.{ext}
   - Call Cloudflare R2 qua S3 SDK v3:
     PutObjectCommand + getSignedUrl()
   - Return:
     { uploadUrl, publicUrl, key, expiresIn, headers }

3. Client -> Cloudflare R2
   HTTP PUT uploadUrl
   Headers phải khớp chữ ký:
   Content-Type: <mimeType>
   Content-Length: <fileSize> nếu được ký
   Body: binary bytes

4. Client -> Backend realtime
   Socket event chat:send_message
   Image payload:
   {
     conversationId,
     type: "image",
     attachmentUrl/publicUrl,
     metadata: { width, height, blurhash, mimeType, size }
   }

   Voice payload:
   {
     conversationId,
     type: "voice",
     mediaUrl/publicUrl,
     metadata: { duration, mimeType, fileSize }
   }

5. Backend
   - Verify user vẫn là member của conversation.
   - Verify publicUrl belongs to issued namespace/key.
   - Persist ChatMessage in MongoDB.
   - Update conversation lastMessage.
   - Mark sender read pointer.
   - Broadcast chat:new_message to conversation room.
```

### 2.2 Sequence Diagram

```txt
Mobile Client        Backend API          Cloudflare R2        Socket Room
     |                   |                      |                  |
     | POST presigned    |                      |                  |
     |------------------>|                      |                  |
     |                   | check auth/member    |                  |
     |                   | sign PutObject URL   |                  |
     |<------------------| uploadUrl/publicUrl  |                  |
     |                   |                      |                  |
     | PUT binary bytes  |                      |                  |
     |----------------------------------------->|                  |
     |                   |                      | 200 OK           |
     |<-----------------------------------------|                  |
     |                   |                      |                  |
     | socket send msg   |                      |                  |
     |------------------>| verify url/key       |                  |
     |                   | persist message      |                  |
     |                   |----------------------------------------->|
     |                   |        chat:new_message broadcast        |
```

## 3. Cloudflare R2 Configuration

### 3.1 Required Libraries

Backend sử dụng AWS SDK v3 vì Cloudflare R2 tương thích S3 API:

```txt
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
```

Các primitive chính:

```js
S3Client
PutObjectCommand
getSignedUrl()
```

### 3.2 R2 Endpoint

Cloudflare R2 S3-compatible endpoint:

```txt
https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
```

Ví dụ:

```txt
https://abc123def456.r2.cloudflarestorage.com
```

### 3.3 Environment Variables

Đề xuất chuẩn hóa env riêng cho R2:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_DOMAIN=
R2_REGION=auto
R2_UPLOAD_URL_TTL_SECONDS=300
R2_IMAGE_MAX_BYTES=10485760
R2_VOICE_MAX_BYTES=26214400
```

Ý nghĩa:

| Env | Required | Description |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID, dùng để build endpoint |
| `R2_ACCESS_KEY_ID` | Yes | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 API token secret |
| `R2_BUCKET_NAME` | Yes | Bucket lưu media |
| `R2_PUBLIC_DOMAIN` | Yes | Custom domain hoặc R2 Dev URL public để client đọc file |
| `R2_REGION` | No | R2 thường dùng `auto` |
| `R2_UPLOAD_URL_TTL_SECONDS` | No | TTL cho upload URL, đề xuất 300s |
| `R2_IMAGE_MAX_BYTES` | No | Max image size |
| `R2_VOICE_MAX_BYTES` | No | Max voice note size |

Mapping sang AWS SDK:

```txt
endpoint = https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
region = auto
bucket = R2_BUCKET_NAME
credentials.accessKeyId = R2_ACCESS_KEY_ID
credentials.secretAccessKey = R2_SECRET_ACCESS_KEY
publicBaseUrl = R2_PUBLIC_DOMAIN
```

## 4. Architectural Highlights

## 4.1 Tại Sao Chọn Cloudflare R2 Thay Vì AWS S3?

Cloudflare R2 phù hợp với Chat media vì:

- Miễn phí 100% egress fee: người dùng xem/tải ảnh và voice nhiều sẽ không phát sinh phí băng thông tải xuống như AWS S3.
- Có hạn mức miễn phí lưu trữ 10 GB/tháng, phù hợp giai đoạn MVP/student project.
- Tương thích S3 API, nên backend vẫn dùng AWS SDK chuẩn.
- Có thể gắn custom domain/CDN dễ dàng.
- Giảm lock-in ở tầng code vì adapter vẫn nói chuyện qua S3-compatible interface.

## 4.2 Pre-signed URL vs Multipart Form-Data Qua Backend

### Multipart Form-Data / Multer

Client upload file vào backend:

```txt
Client -> Node.js server -> R2/S3
```

Nhược điểm:

- Backend phải nhận toàn bộ network traffic upload.
- Tăng RAM/CPU khi parse multipart hoặc stream.
- Có nguy cơ nghẽn event loop khi nhiều request lớn.
- Backend bandwidth trở thành bottleneck.
- Timeout dễ xảy ra trên hosting free/low-resource.

### Pre-signed Upload URL

Client upload trực tiếp vào storage:

```txt
Client -> Backend xin chữ ký
Client -> R2 upload binary trực tiếp
```

Ưu điểm:

- Backend không đi qua file bytes.
- Giảm RAM/CPU/network usage cho Node.js.
- Scale tốt hơn khi nhiều người gửi ảnh/voice cùng lúc.
- Tách rõ trách nhiệm: backend kiểm soát quyền và metadata, R2 xử lý file storage.
- Có thể ký strict Content-Type/Content-Length để hạn chế misuse.

## 4.3 Security & Integrity

Các lớp bảo vệ cần có:

### Auth & Authorization

- API xin upload URL bắt buộc JWT.
- Backend kiểm tra user là member của conversation.
- Backend không ký URL nếu user không có quyền.

### Strict MIME Type

Image MIME allowlist:

```txt
image/jpeg
image/png
image/webp
image/heic
image/heif
image/gif
```

Voice MIME allowlist đề xuất:

```txt
audio/m4a
audio/mp4
audio/aac
audio/mpeg
audio/ogg
audio/webm
audio/wav
```

### File Size Limit

Đề xuất:

```txt
Images: <= 10 MB
Voice Notes: <= 25 MB
```

Backend nên validate `fileSize/contentLength` trước khi ký URL. Nếu ký `Content-Length`, client phải upload đúng size đã khai báo.

### Namespace Isolation

Đề xuất key:

```txt
chats/{conversationId}/{userId}/{uuid}.{ext}
```

Ưu điểm:

- Không đoán được key vì có UUID.
- Dễ kiểm tra ownership: key phải match conversationId và userId.
- Dễ cleanup theo conversation hoặc user.
- Giảm nguy cơ user gửi URL/key của conversation khác.

### Public URL Verification

Khi client gửi socket message:

- Backend parse `publicUrl`.
- Convert public URL về key.
- Verify key prefix thuộc `chats/{conversationId}/{userId}/`.
- Verify extension/mime metadata hợp lệ.

Không nên tin mọi URL do client gửi.

### TTL

Pre-signed upload URL nên ngắn hạn:

```txt
300 seconds / 5 minutes
```

Nếu hết hạn, client xin ticket mới.

## 5. Orphan Files Strategy

Orphan files là file đã upload lên R2 nhưng chưa có ChatMessage tương ứng, hoặc client xin URL nhưng không upload.

Các chiến lược:

### MVP

- Không tạo DB record cho pending upload.
- Dựa vào Cloudflare lifecycle rule để xóa object cũ theo prefix/temp nếu có.
- Key vẫn nằm trong namespace conversation/user.

### Production-Ready

Thêm collection `media_upload_tickets`:

```js
{
  key,
  conversationId,
  userId,
  mediaType,
  mimeType,
  fileSize,
  status: 'issued' | 'attached' | 'expired',
  expiresAt,
  createdAt
}
```

Flow:

- Khi issue ticket: create `issued`.
- Khi message được gửi thành công: mark `attached`.
- Cron job: list tickets expired and not attached, delete object from R2 if exists.

### R2 Lifecycle

Nếu dùng prefix tạm:

```txt
tmp/chats/{conversationId}/{userId}/{uuid}.{ext}
```

Sau khi gửi message thành công:

- Có thể copy/move sang `chats/...`.
- Hoặc giữ nguyên key và mark attached.

MVP nên tránh move/copy để đơn giản; cleanup bằng ticket DB hoặc lifecycle.

---

## 6. Interview Preparation

### Câu 1: Tại sao dùng Pre-signed URL cho file upload thay vì streaming qua Backend?

Trả lời gợi ý:

Pre-signed URL giúp client upload trực tiếp lên object storage, còn backend chỉ kiểm soát auth/authorization và ký URL. Cách này tránh để Node.js xử lý file bytes lớn, giảm RAM/CPU/network bandwidth và tránh nghẽn event loop. Khi nhiều người gửi ảnh hoặc voice cùng lúc, backend không trở thành bottleneck. Backend vẫn kiểm soát được quyền upload qua JWT, conversation membership, Content-Type, Content-Length, TTL và namespace key.

### Câu 2: Làm sao đảm bảo tính toàn vẹn và xác thực người dùng khi họ upload thẳng lên Cloudflare R2?

Trả lời gợi ý:

Backend không cấp upload URL đại trà. Mỗi request xin URL phải có JWT hợp lệ và backend kiểm tra user là member của conversation. Object key được sinh bởi backend, chứa namespace `chats/{conversationId}/{userId}/{uuid}.{ext}`. Pre-signed URL được ký kèm `Content-Type`, có thể kèm `Content-Length`, và TTL ngắn. Khi client gửi message sau upload, backend kiểm tra `publicUrl` map về key thuộc đúng conversation/user trước khi persist message và broadcast.

### Câu 3: Xử lý file rác nếu người dùng xin Pre-signed URL nhưng không upload hoặc hủy ngang như thế nào?

Trả lời gợi ý:

Có hai mức. MVP có thể chấp nhận một lượng nhỏ orphan file và dùng lifecycle cleanup trên Cloudflare R2. Production nên lưu `media_upload_tickets` với trạng thái `issued/attached/expired`. Khi client gửi message thành công thì mark ticket `attached`. Một scheduled job định kỳ tìm ticket hết hạn chưa attach, kiểm tra object có tồn tại và xóa khỏi R2. Có thể kết hợp prefix `tmp/` hoặc lifecycle rule để cleanup tự động.

---

# Phần 2: Execution Plan Theo Clean Architecture

## 1. Mục Tiêu Triển Khai

Nâng cấp Chat media để hỗ trợ:

- Text message hiện có.
- Image message hiện có, chuẩn hóa thêm theo R2.
- Voice note message mới.
- Pre-signed upload URL cho cả image và voice.
- Client upload trực tiếp lên Cloudflare R2.
- Socket broadcast media message đầy đủ metadata.

Plan này không viết code ngay. Chỉ mô tả thay đổi cần thực hiện theo layer.

## 2. Current State Analysis

Backend hiện đã có một phần nền tảng:

- `src/infrastructure/storage/s3Storage.js`
  - S3-compatible `S3Client`.
  - `PutObjectCommand`.
  - `getSignedUrl`.
  - Ký strict `content-type` và `content-length`.
- `src/domain/media.js`
  - Image MIME allowlist.
  - `buildChatUploadKey`.
  - `isChatUploadKeyOwnedBy`.
- `POST /api/v1/chat/upload-ticket`
  - Đang cấp upload ticket cho image.
- `ChatMessage`
  - `type: ['text', 'image']`.
  - `attachment` subdocument cho image.

Gap cần bổ sung:

- Voice note type.
- MIME allowlist cho audio.
- Storage env naming riêng R2.
- Generalized media ticket endpoint.
- Message schema/view hỗ trợ voice metadata.
- Socket payload validation cho voice.

## 3. Schema & Model Plan

### File dự kiến

```txt
src/infrastructure/database/models/ChatMessage.js
```

### Thay đổi đề xuất

Mở rộng message type:

```js
const MESSAGE_TYPES = ['text', 'image', 'voice'];
```

Theo yêu cầu, bổ sung các field:

```js
type: Enum ['text', 'image', 'voice']
mediaUrl: String
duration: Number
fileSize: Number
```

### Khuyến nghị thiết kế để không phá existing image attachment

Hiện model đã có `attachment`:

```js
attachment: {
  url,
  key,
  mimeType,
  size,
  width,
  height,
  blurhash
}
```

Có 2 lựa chọn:

#### Option A - Theo đúng yêu cầu flat fields

Thêm:

```js
mediaUrl: { type: String, default: null },
duration: { type: Number, default: null },
fileSize: { type: Number, default: null }
```

Giữ `attachment` để backward-compatible image clients.

Pros:

- Sát yêu cầu.
- Ít phá vỡ response cũ.

Cons:

- Metadata image và voice hơi phân tán.

#### Option B - Chuẩn hóa `media` subdocument

Tạo:

```js
media: {
  url,
  key,
  mimeType,
  fileSize,
  width,
  height,
  blurhash,
  duration
}
```

Pros:

- Sạch hơn cho lâu dài.

Cons:

- Cần migration/compat layer cho `attachment`.

Đề xuất MVP:

- Dùng Option A + giữ `attachment`.
- Mapper response có thể trả cả `attachment` cho image và `mediaUrl/duration/fileSize` cho voice.
- Sau này refactor sang `media` nếu cần.

## 4. Domain Layer Plan

### File dự kiến

```txt
src/domain/media.js
```

### Mở rộng constants

```js
const IMAGE_MIME_EXTENSIONS = { ... };
const VOICE_MIME_EXTENSIONS = {
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
};
const MEDIA_TYPES = ['image', 'voice'];
```

### Key builder

```js
buildChatMediaUploadKey({ conversationId, userId, uuid, mediaType, mimeType })
```

Output:

```txt
chats/{conversationId}/{userId}/{uuid}.{ext}
```

### Ownership verifier

```js
isChatMediaUploadKeyOwnedBy(key, { conversationId, userId })
```

Validate:

- Prefix `chats/`.
- `conversationId` match.
- `userId` match.
- UUID format.
- Extension belongs to allowlist.

### Why Domain?

Key naming, MIME allowlist, max dimension/metadata regex và ownership rules là pure business/security rules, không phụ thuộc Express/Mongoose/S3.

## 5. Infrastructure Layer Plan

### File dự kiến

```txt
src/infrastructure/storage/CloudflareR2StorageService.js
```

Hoặc giữ style hiện tại:

```txt
src/infrastructure/storage/r2Storage.js
```

### Interface / Port

Dù JavaScript chưa có interface runtime, use case sẽ phụ thuộc vào port shape:

```js
IStorageService = {
  maxUploadBytesFor(mediaType),
  publicUrlFor(key),
  keyFromPublicUrl(url),
  generatePresignedUploadUrl({ key, mimeType, contentLength, expiresIn })
}
```

### Cloudflare R2 adapter

Trách nhiệm:

- Khởi tạo `S3Client`:

```js
new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId,
    secretAccessKey
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED'
})
```

- Sinh `PutObjectCommand`:

```js
new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  ContentType: mimeType,
  ContentLength: contentLength
})
```

- Ký URL:

```js
getSignedUrl(client, command, {
  expiresIn,
  signableHeaders: new Set(['content-type', 'content-length'])
})
```

- Return:

```js
{
  uploadUrl,
  method: 'PUT',
  headers: {
    'Content-Type': mimeType,
    'Content-Length': String(contentLength)
  },
  key,
  publicUrl,
  expiresIn,
  expiresAt
}
```

### Config layer

File dự kiến:

```txt
src/config/env.js
```

Add env parse:

```js
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_DOMAIN
R2_UPLOAD_URL_TTL_SECONDS
R2_IMAGE_MAX_BYTES
R2_VOICE_MAX_BYTES
```

Return config:

```js
mediaStorage: {
  provider: 'cloudflare-r2',
  accountId,
  endpoint,
  bucket,
  accessKeyId,
  secretAccessKey,
  publicBaseUrl,
  urlTtlSeconds,
  imageMaxBytes,
  voiceMaxBytes
}
```

### Container wiring

File dự kiến:

```txt
src/container.js
```

Wire:

```js
storage: config.mediaStorage ? createCloudflareR2StorageService(config.mediaStorage) : null
```

Giữ nguyên dependency injection: application use cases nhận `storage` port, không import AWS SDK.

## 6. Application / Use Case Plan

### File dự kiến

Có thể đặt trong Chat use cases hiện tại:

```txt
src/application/chat/chatUseCases.js
```

Hoặc tách rõ:

```txt
src/application/chat/GetPresignedUploadUrlUseCase.js
```

Theo style repo hiện tại, nhiều function nằm chung trong `createChatUseCases`, nên MVP nên thêm function:

```js
getPresignedUploadUrl({ userId, conversationId, mediaType, extension, mimeType, fileSize })
```

### Use Case Responsibilities

1. Require storage configured.
2. Check membership:

```js
await requireMembership(conversationId, userId)
```

3. Validate semantic rules:

- `mediaType === 'image'` -> MIME belongs to image allowlist.
- `mediaType === 'voice'` -> MIME belongs to voice allowlist.
- `fileSize` <= media-specific max.
- extension matches MIME.

4. Generate UUID.
5. Generate key:

```txt
chats/{conversationId}/{userId}/{uuid}.{ext}
```

6. Ask storage service for pre-signed URL.
7. Return:

```js
{
  uploadUrl,
  publicUrl,
  key,
  expiresIn,
  expiresAt,
  headers
}
```

### Send Message Use Case Updates

Existing:

- `text`
- `image`

Add:

- `voice`

Voice message validation:

```js
{
  conversationId,
  type: 'voice',
  mediaUrl,
  duration,
  fileSize,
  mimeType
}
```

Use case must:

- Check membership.
- Convert `mediaUrl` to key via storage.
- Verify key belongs to `{ conversationId, userId }`.
- Persist `type='voice'`, `mediaUrl`, `duration`, `fileSize`.
- Broadcast `chat:new_message`.

## 7. Presentation Layer Plan

## 7.1 REST API

### Endpoint

Theo yêu cầu:

```http
POST /api/chat/media/presigned-url
```

Tuy nhiên repo hiện tại versioning chuẩn là:

```txt
/api/v1
```

Vì vậy đề xuất triển khai thực tế:

```http
POST /api/v1/chat/media/presigned-url
```

Nếu cần backward alias, có thể cân nhắc mount thêm `/api/chat/media/presigned-url`, nhưng nên tránh phá convention hiện tại.

### Auth

```http
Authorization: Bearer <token>
```

### Body

Theo yêu cầu:

```json
{
  "conversationId": "66f333333333333333333333",
  "mediaType": "image",
  "extension": "jpg",
  "mimeType": "image/jpeg"
}
```

Đề xuất bổ sung `fileSize` để ký Content-Length và enforce max size:

```json
{
  "conversationId": "66f333333333333333333333",
  "mediaType": "voice",
  "extension": "m4a",
  "mimeType": "audio/mp4",
  "fileSize": 123456
}
```

### Response

```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://...",
    "publicUrl": "https://media.example.com/chats/...",
    "key": "chats/66f333333333333333333333/66f123456789abcdef012345/uuid.m4a",
    "expiresIn": 300,
    "expiresAt": "2026-10-10T10:00:00.000Z",
    "headers": {
      "Content-Type": "audio/mp4",
      "Content-Length": "123456"
    }
  }
}
```

### Zod Schema

File dự kiến:

```txt
src/presentation/dto/chat.schemas.js
```

Add:

```js
const mediaUploadTicketBody = z.object({
  conversationId: objectId,
  mediaType: z.enum(['image', 'voice']),
  extension: z.string().trim().min(1).max(10),
  mimeType: z.string().trim().min(1).max(100),
  fileSize: z.number().int().positive()
});
```

### Routes / Controller

Files:

```txt
src/presentation/http/routes/chatRoutes.js
src/presentation/http/controllers/chatController.js
```

Add:

```js
router.post('/media/presigned-url', validate({ body: mediaUploadTicketBody }), controller.mediaPresignedUrl)
```

Controller:

```js
mediaPresignedUrl: asyncHandler(async (req, res) => {
  const data = await chat.getPresignedUploadUrl({ userId: req.user._id, ...req.dto.body });
  res.status(201).json({ success: true, data });
})
```

## 7.2 Socket Gateway

Files:

```txt
src/presentation/socket/gateways/chatGateway.js
src/presentation/dto/chat.schemas.js
```

### Client -> Server Voice Message Payload

```json
{
  "conversationId": "66f333333333333333333333",
  "type": "voice",
  "mediaUrl": "https://media.example.com/chats/...",
  "duration": 12.4,
  "fileSize": 123456,
  "mimeType": "audio/mp4"
}
```

### Server -> Client `chat:new_message`

```json
{
  "id": "66f888888888888888888888",
  "conversationId": "66f333333333333333333333",
  "senderId": "66f123456789abcdef012345",
  "senderName": "Alice",
  "type": "voice",
  "content": "",
  "mediaUrl": "https://media.example.com/chats/...",
  "duration": 12.4,
  "fileSize": 123456,
  "mimeType": "audio/mp4",
  "createdAt": "2026-10-10T10:00:00.000Z"
}
```

### Image Message Compatibility

Existing image payload:

```json
{
  "conversationId": "...",
  "type": "image",
  "attachmentUrl": "https://...",
  "content": "caption",
  "metadata": {
    "width": 1200,
    "height": 900,
    "blurhash": "...",
    "mimeType": "image/jpeg",
    "size": 204800
  }
}
```

Plan:

- Keep accepting existing `attachmentUrl` for image.
- Optionally alias `mediaUrl` to `attachmentUrl` later if mobile wants one unified naming.

## 8. Testing Plan

### Unit / Use Case Tests

Add tests:

- Reject unauthenticated request.
- Reject non-member conversation.
- Reject unsupported MIME.
- Reject file too large.
- Return uploadUrl/publicUrl/key/expiresIn for image.
- Return uploadUrl/publicUrl/key/expiresIn for voice.
- Reject voice message with publicUrl not owned by user/conversation.
- Persist and broadcast voice message.

### Integration Tests

Use fake storage adapter:

```js
storage.generatePresignedUploadUrl = async () => ({ ... })
storage.publicUrlFor = key => `https://media.test/${key}`
storage.keyFromPublicUrl = url => ...
```

Avoid calling real Cloudflare R2 in automated tests.

## 9. Migration / Backward Compatibility

- Existing text/image messages should continue working.
- Existing `attachment` field for image should remain supported.
- New voice messages add nullable fields, no migration required for old docs.
- Mobile clients should handle unknown `type` defensively.

## 10. Deployment Checklist

Render env:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_DOMAIN=
R2_REGION=auto
R2_UPLOAD_URL_TTL_SECONDS=300
R2_IMAGE_MAX_BYTES=10485760
R2_VOICE_MAX_BYTES=26214400
```

Cloudflare:

- Create R2 bucket.
- Create R2 API token with bucket write permission.
- Configure public access via custom domain or R2 Dev URL.
- Configure CORS for mobile PUT if needed.

Suggested R2 CORS:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Security note:

- For production, replace `AllowedOrigins: ["*"]` with app-specific origins if web clients are used.
- Native mobile apps are not protected by browser CORS in the same way, but signed headers still matter.

## 11. Implementation Decisions

Implemented MVP decisions:

- Use `/api/v1/chat/media/presigned-url`.
- Require `fileSize`.
- Support image MIME list already present.
- Support voice MIME: `audio/mp4`, `audio/m4a`, `audio/aac`, `audio/mpeg`, `audio/ogg`, `audio/webm`, `audio/wav`.
- Keep existing image `attachment` response for compatibility.
- Add voice flat fields: `mediaUrl`, `duration`, `fileSize`, `mimeType`.
- Defer `media_upload_tickets` collection; document orphan cleanup as follow-up.

Deferred follow-ups:

- Add `media_upload_tickets` collection for production-grade orphan cleanup.
- Add a scheduled cleanup job for expired unattached uploads.
- Consider a unified `media` response object after mobile clients stabilize.

