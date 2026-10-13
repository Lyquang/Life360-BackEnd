# Realtime Location Update API - Mobile Contract

Tài liệu này là hợp đồng tích hợp sự kiện vị trí realtime giữa FamilyTracker Mobile và Backend.

## 1. Tổng quan

Mobile gửi GPS fix qua Socket.IO event `update_location`. Backend kiểm tra dữ liệu, cập nhật cache/vị trí gần nhất, lưu lịch sử theo throttle và phát `location_update` cho các thành viên. Đây không phải REST endpoint và hiện không có acknowledgement callback.

## 2. Client gửi `update_location`

```json
{
  "latitude": 10.7769,
  "longitude": 106.7009,
  "batteryLevel": 80,
  "recordedAt": "2026-10-13T08:30:15.123Z",
  "accuracy": 8.5
}
```

| Field | Kiểu | Bắt buộc | Quy tắc |
| --- | --- | --- | --- |
| `latitude` | Number | Có | `-90...90` |
| `longitude` | Number | Có | `-180...180` |
| `batteryLevel` | Number | Không | Backend clamp về `0...100` |
| `recordedAt` | String | Không | ISO-8601 có timezone, là thời điểm thiết bị đo GPS fix |
| `accuracy` | Number | Không | Mét, phải `>= 0` |

Client cũ có thể tiếp tục chỉ gửi `latitude`, `longitude` và `batteryLevel`. Khi thiếu `recordedAt`, Backend dùng giờ nhận của server như trước đây.

### Quy tắc `recordedAt`

Backend chấp nhận:

```text
serverNow - 24 giờ <= recordedAt <= serverNow + 60 giây
```

- ISO-8601 sai định dạng: payload bị từ chối.
- Đúng ISO-8601 nhưng quá 24 giờ hoặc ở tương lai quá 60 giây: Backend không từ chối điểm; thời gian bị thay bằng giờ server.
- Backend ghi log/counter cho timestamp ngoài khoảng nhưng không log tọa độ.

### Quy tắc `accuracy` trên iOS

Sử dụng `CLLocation.horizontalAccuracy` khi giá trị không âm:

```swift
let accuracy: Double? = location.horizontalAccuracy >= 0
    ? location.horizontalAccuracy
    : nil
```

Không gửi `accuracy` nếu Core Location trả số âm. Số âm hoặc sai kiểu làm toàn bộ payload bị từ chối.

## 3. Server phát `location_update`

```json
{
  "userId": "66f123456789abcdef012345",
  "name": "Alice",
  "latitude": 10.7769,
  "longitude": 106.7009,
  "batteryLevel": 80,
  "timestamp": "2026-10-13T08:30:15.123Z",
  "recordedAt": "2026-10-13T08:30:15.123Z",
  "accuracy": 8.5,
  "durationAtLocation": 12,
  "durationSince": "2026-10-13T08:18:00.000Z",
  "durationFormatted": "12 phút"
}
```

| Field | Kiểu | Bắt buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `userId` | String | Có | ID người gửi |
| `name` | String | Có | Tên hiển thị |
| `latitude` | Number | Có | Vĩ độ |
| `longitude` | Number | Có | Kinh độ |
| `batteryLevel` | Number/null | Có | Pin thiết bị hoặc giá trị gần nhất |
| `timestamp` | String | Có | Alias tương thích của `recordedAt` |
| `recordedAt` | String | Có | Thời điểm GPS fix có hiệu lực |
| `accuracy` | Number | Không | Độ chính xác ngang, mét |
| `durationAtLocation` | Integer | Có | Số phút tại khu vực hiện tại |
| `durationSince` | String | Có | Mốc duration tracker của server |
| `durationFormatted` | String | Có | Chuỗi thời lượng hiển thị |

Mobile mới nên dùng `recordedAt`. `timestamp` được giữ lại để không làm vỡ client cũ và hiện có cùng giá trị.

## 4. Lưu trữ và thứ tự dữ liệu

- Redis `location:last:<userId>` lưu `recordedAt` và `accuracy` nếu có.
- `LocationHistory.timestamp` dùng thời gian GPS hợp lệ, giúp lịch sử sắp xếp theo thời điểm đo thay vì thời điểm đồng bộ.
- `User.lastKnownLocation` chỉ cập nhật nếu `recordedAt` mới hơn `updatedAt` đang lưu. Điểm offline đến muộn vẫn có thể vào history nhưng không ghi đè marker mới nhất.
- `durationTracker`, stay-alert và throttle runtime vẫn dùng giờ server. `accuracy` chưa ảnh hưởng duration hoặc ngưỡng lưu history.
- History tiếp tục dùng ngưỡng hiện tại: di chuyển ít nhất 50 mét hoặc đủ 30 giây từ lần lưu trước.

## 5. Payload lỗi

Backend phát event `error` về socket gửi:

```json
{
  "message": "Invalid location payload.",
  "errors": [
    {
      "field": "accuracy",
      "message": "Too small: expected number to be >=0"
    }
  ]
}
```

Các lỗi thường gặp: latitude/longitude ngoài phạm vi, `recordedAt` không phải ISO-8601 có timezone, hoặc `accuracy` âm/sai kiểu.

## 6. Swift DTO tham khảo

```swift
struct LocationUpdatePayload: Encodable, Sendable {
    let latitude: Double
    let longitude: Double
    let batteryLevel: Double?
    let recordedAt: String?
    let accuracy: Double?
}

struct RealtimeLocationUpdate: Decodable, Sendable {
    let userId: String
    let name: String
    let latitude: Double
    let longitude: Double
    let batteryLevel: Double?
    let timestamp: String
    let recordedAt: String
    let accuracy: Double?
    let durationAtLocation: Int
    let durationSince: String
    let durationFormatted: String
}
```

Khi đệm offline, phải giữ nguyên `recordedAt` của `CLLocation.timestamp`; không tạo timestamp mới tại thời điểm retry.
