# Journey Route and Location History API - iOS Contract

Tài liệu này mô tả hai API đọc lịch sử vị trí dành cho iOS. Cả hai yêu cầu access JWT và chỉ cho phép xem chính mình hoặc thành viên có chung ít nhất một Circle.

## 1. Authentication

```http
Authorization: Bearer <accessToken>
Accept: application/json
```

| HTTP | Code | Ý nghĩa |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` / `BAD_REQUEST` | Query, cursor hoặc khoảng thời gian không hợp lệ |
| `401` | `UNAUTHORIZED` | Access token thiếu, sai hoặc hết hạn |
| `403` | `FORBIDDEN` | Không phải chính mình và không chung Circle |

## 2. Journey theo ngày

### Legacy mode

```http
GET /api/v1/history/{userId}/journey?date=2026-10-17
```

Không truyền `detail` sẽ giữ nguyên response cũ. Moving segment có `path` chỉ gồm tọa độ; không có gap metadata.

### Geometry mode cho mobile mới

```http
GET /api/v1/history/{userId}/journey?date=2026-10-17&detail=geometry
```

`date` là `YYYY-MM-DD`, mặc định hôm nay theo timezone server. `detail` chỉ chấp nhận `geometry`.

```json
{
  "success": true,
  "date": "2026-10-17",
  "userId": "66f123456789abcdef012345",
  "summary": {
    "totalPoints": 4,
    "stayPointCount": 0,
    "totalStayMinutes": 0,
    "totalMovingMinutes": 6,
    "observedMovingSeconds": 90,
    "firstSeenAt": "2026-10-17T01:00:00.000Z",
    "lastSeenAt": "2026-10-17T01:06:00.000Z"
  },
  "journey": [
    {
      "type": "moving",
      "segmentId": "v1_9M3lYQ0nP5x7mZr4F2dA1B",
      "fromLatitude": 10.7,
      "fromLongitude": 106.6,
      "toLatitude": 10.703,
      "toLongitude": 106.603,
      "startTime": "2026-10-17T01:00:00.000Z",
      "endTime": "2026-10-17T01:06:00.000Z",
      "durationMinutes": 6,
      "durationFormatted": "6 phút",
      "path": [
        { "latitude": 10.7, "longitude": 106.6 },
        { "latitude": 10.701, "longitude": 106.601 },
        { "latitude": 10.702, "longitude": 106.602 },
        { "latitude": 10.703, "longitude": 106.603 }
      ],
      "points": [
        { "latitude": 10.7, "longitude": 106.6, "recordedAt": "2026-10-17T01:00:00.000Z", "accuracy": 5 },
        { "latitude": 10.701, "longitude": 106.601, "recordedAt": "2026-10-17T01:00:30.000Z", "accuracy": 5 },
        { "latitude": 10.702, "longitude": 106.602, "recordedAt": "2026-10-17T01:05:30.000Z", "accuracy": 6 },
        { "latitude": 10.703, "longitude": 106.603, "recordedAt": "2026-10-17T01:06:00.000Z", "accuracy": 6 }
      ],
      "pointCount": 4,
      "originalPointCount": 4,
      "distanceMeters": 468.2,
      "maxGapSeconds": 300,
      "gaps": [{ "fromIndex": 1, "toIndex": 2, "seconds": 300, "meters": 156.1 }],
      "thinned": false,
      "observedMovingSeconds": 90
    }
  ]
}
```

### Quy tắc vẽ trên iOS

- Vẽ đường liền giữa các cặp điểm không nằm trong `gaps`.
- Với mỗi gap, dùng `fromIndex` và `toIndex` để vẽ nét đứt hoặc không nối tùy UX.
- `points` đã tăng dần theo `recordedAt`; không nội suy hay tự tạo tọa độ bị thiếu.
- `distanceMeters` được tính trên điểm gốc trước thinning. Không cộng lại từ `points` nếu cần số liệu chính xác.
- `totalMovingMinutes` giữ semantics cũ, có thể chứa khoảng mất dữ liệu. Dùng `observedMovingSeconds` cho thời gian thực sự quan sát được.
- `segmentId` ổn định cho cùng segment và phù hợp làm identity trong SwiftUI.
- `path` và `points` có cùng chuỗi tọa độ trả về trong geometry mode. Mobile mới nên dùng `points`.

### Stay segment

```json
{
  "type": "stay",
  "latitude": 10.7,
  "longitude": 106.6,
  "arrivedAt": "2026-10-17T02:00:00.000Z",
  "leftAt": "2026-10-17T02:20:00.000Z",
  "durationMinutes": 20,
  "durationFormatted": "20 phút",
  "pointCount": 8
}
```

Backend hiện giữ thuật toán stay legacy. Hai điểm gần nhau nhưng cách nhau qua một data gap vẫn có thể được phân loại là stay; mobile nên thể hiện đây là dữ liệu suy luận, không phải bằng chứng GPS liên tục.

## 3. Raw history theo khoảng thời gian

### Legacy today mode

```http
GET /api/v1/history/{userId}
```

Không có query mới thì response giữ nguyên:

```json
{ "success": true, "count": 1, "date": "2026-10-17", "data": [] }
```

### Range mode

```http
GET /api/v1/history/{userId}?from=2026-10-16T17:00:00.000Z&to=2026-10-17T16:59:59.999Z&limit=500
```

| Query | Bắt buộc | Quy tắc |
| --- | --- | --- |
| `from` | Một trong `from`/`to` | ISO-8601 có timezone, inclusive |
| `to` | Một trong `from`/`to` | ISO-8601 có timezone, inclusive |
| `limit` | Không | Mặc định 500, tối đa 1000 |
| `cursor` | Không | Chuỗi opaque từ `nextCursor`; không parse hoặc chỉnh sửa |

Nếu thiếu một đầu, backend suy ra một cửa sổ tối đa 7 ngày. Nếu có cả hai, khoảng phải lớn hơn 0 và không quá 7 ngày.

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "66f123456789abcdef012346",
      "latitude": 10.7,
      "longitude": 106.6,
      "timestamp": "2026-10-17T01:00:00.000Z",
      "accuracy": 5,
      "pointId": "08f68d38-6665-4f0f-8f48-bfa7cc449dc8"
    }
  ],
  "nextCursor": "eyJ2IjoxLCJ0IjoiLi4uIiwiaWQiOiIuLi4ifQ",
  "range": {
    "from": "2026-10-16T17:00:00.000Z",
    "to": "2026-10-17T16:59:59.999Z"
  }
}
```

Gọi trang kế tiếp với cùng `from`, `to`, `limit` và `cursor=nextCursor`. Dừng khi `nextCursor` là `null`. Cursor dùng `(timestamp, _id)`, nên nhiều điểm có cùng timestamp vẫn không bị trùng hoặc bỏ sót.

## 4. Swift models

```swift
struct JourneyResponse: Decodable, Sendable {
    let success: Bool
    let date: String
    let userId: String
    let summary: JourneySummary
    let journey: [JourneyItem]
}

struct JourneySummary: Decodable, Sendable {
    let totalPoints: Int
    let stayPointCount: Int
    let totalStayMinutes: Int
    let totalMovingMinutes: Int
    let observedMovingSeconds: Double?
    let firstSeenAt: Date?
    let lastSeenAt: Date?
}

struct JourneyRoutePoint: Decodable, Sendable {
    let latitude: Double
    let longitude: Double
    let recordedAt: Date
    let accuracy: Double?
}

struct JourneyGap: Decodable, Sendable {
    let fromIndex: Int
    let toIndex: Int
    let seconds: Double
    let meters: Double
}

struct RawHistoryPage: Decodable, Sendable {
    let success: Bool
    let count: Int
    let data: [RawHistoryPoint]
    let nextCursor: String?
    let range: HistoryRange
}

struct RawHistoryPoint: Decodable, Identifiable, Sendable {
    let id: String
    let latitude: Double
    let longitude: Double
    let timestamp: Date
    let accuracy: Double?
    let pointId: UUID?
}

struct HistoryRange: Decodable, Sendable {
    let from: Date
    let to: Date
}
```

Vì `journey` chứa union `stay`/`moving`, triển khai `JourneyItem` bằng custom `Decodable`: decode `type` trước, sau đó decode `StaySegment` hoặc `MovingSegment`. Các field geometry nên optional để cùng model vẫn đọc được legacy response.

## 5. Deployment compatibility

1. Deploy backend và đảm bảo MongoDB có index `{ userId: 1, timestamp: 1, _id: 1 }`.
2. Smoke test endpoint legacy trước.
3. Bật `LOCATION_HISTORY_DENSE_ENABLED=true` khi đã theo dõi storage/error ổn định.
4. Mobile mới chuyển journey sang `detail=geometry`; mobile cũ không cần cập nhật ngay.
5. Nếu cần rollback mật độ ghi, đặt flag về `false`; endpoint đọc vẫn tương thích.
