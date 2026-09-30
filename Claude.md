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
- [x] `PATCH /api/groups/:groupId/notification-interval` — Cài interval (0 = tắt, max 1440)
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
- `server.js`:
  - Bắt buộc có `JWT_SECRET` (và `MONGODB_URI` khi `NODE_ENV=production`), thiếu → exit 1
  - Production **không** fallback sang in-memory MongoDB (tránh mất dữ liệu âm thầm)
  - `helmet`, `trust proxy`, CORS lấy từ `CORS_ORIGIN`, giới hạn body 100kb
  - URL public lấy từ `PUBLIC_URL` hoặc `RENDER_EXTERNAL_URL` (Render tự set)
  - Ẩn chi tiết lỗi 5xx khi production
  - Graceful shutdown khi nhận `SIGTERM`
- `config/swagger.js` — thêm server Production (URL Render), path theo `__dirname`
- `mongodb-memory-server` chuyển sang `devDependencies`

### Bảo mật
- `GET /api/history/:userId` và `/journey`: chỉ xem được **bản thân** hoặc **người cùng nhóm** (403 nếu không), `userId` sai định dạng → 400
- Rate limit `POST /api/auth/register` + `/login`: 20 request / 15 phút / IP (→ 429), chỉnh bằng `AUTH_RATE_LIMIT`
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
- REST base URL: `https://<app>.onrender.com/api`
- Socket.io: `https://<app>.onrender.com` (tự nâng lên `wss://`), `auth: { token }`

### Giới hạn Render Free
- Service ngủ sau 15 phút không có request → lần gọi đầu mất ~50s (cold start)
- Khi ngủ, **digest scheduler dừng** → không gửi `group_digest`. Có thể dùng UptimeRobot / cron-job.org ping `/api/health` mỗi 10 phút
- Chỉ 1 instance → không bị gửi digest trùng
- Nếu Atlas đã có index cũ `sentAt_1` (không TTL) trên collection `groupdigests`, cần drop thủ công để TTL index được tạo
