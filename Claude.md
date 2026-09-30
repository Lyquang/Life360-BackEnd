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