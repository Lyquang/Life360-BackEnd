# Live Trail REST API - Mobile Contract

Trạng thái hiện tại: T1a persistence và T1b REST read đã có. Socket watch/delta thuộc T2 và **chưa khả dụng**. Production giữ `LIVE_TRAIL_ENABLED=false` cho đến khi hoàn tất privacy/member-removal hooks và load gates.

## 1. Endpoint

```http
GET /api/v1/history/{userId}/journey/trail
Authorization: Bearer <accessToken>
```

Requester chỉ được đọc chính mình hoặc một user có chung Circle.

| Query | Bắt buộc | Quy tắc |
| --- | --- | --- |
| `date` | Không | `YYYY-MM-DD` theo timezone server; mặc định ngày hiện tại |
| `afterSeq` | Không | Integer >= 0; lấy insertion events có `seq` lớn hơn cursor |
| `revision` | Có khi dùng `afterSeq` | Integer >= 1; phải khớp revision hiện tại |
| `limit` | Không | Mặc định 200, tối đa 500 |

Snapshot đầu tiên:

```http
GET /api/v1/history/USER_ID/journey/trail?date=2026-10-18&limit=200
```

Trang tiếp theo/catch-up:

```http
GET /api/v1/history/USER_ID/journey/trail?date=2026-10-18&afterSeq=200&revision=4&limit=200
```

## 2. Response thành công

```json
{
  "success": true,
  "trailId": "671234567890abcdef012345",
  "userId": "661234567890abcdef012345",
  "date": "2026-10-18",
  "timeZone": "Asia/Ho_Chi_Minh",
  "revision": 4,
  "lastSeq": 203,
  "points": [
    {
      "seq": 201,
      "latitude": 10.762622,
      "longitude": 106.660172,
      "recordedAt": "2026-10-18T05:03:20.000Z",
      "accuracy": 8,
      "motionState": "walking",
      "pointId": "ca05768a-9774-4e29-832e-70048a95901e"
    }
  ],
  "gaps": [
    {
      "fromSeq": 201,
      "toSeq": 199,
      "seconds": 240,
      "meters": 530.4
    }
  ],
  "matched": [],
  "hasMore": false,
  "nextAfterSeq": null
}
```

## 3. Ordering và cursor

- `seq` là insertion cursor tăng đơn điệu, không phải thứ tự đường đi.
- Mỗi REST page trả `points` theo `seq` tăng dần.
- Sau khi tải đủ pages, mobile dựng path bằng cách sort `(recordedAt, seq)`.
- Late point có thể có `seq` lớn nhưng `recordedAt` nằm giữa các point cũ.
- Không kiểm tra mất event bằng `seq == previousSeq + 1`; future migration/transaction retry có thể tạo lỗ. Dùng `afterSeq` và `revision`.
- `nextAfterSeq` chỉ có giá trị khi `hasMore=true`. Khi `hasMore=false`, cursor local mới nhất là `points.last?.seq ?? afterSeq`.

## 4. Gap semantics

- Gap dùng boundary ổn định `fromSeq/toSeq`, không dùng array index.
- Gap được tính theo path order `(recordedAt, seq)`, nên `fromSeq` có thể lớn hơn `toSeq` sau late insertion.
- Interval vượt `gapThresholdSeconds` chỉ là route gap khi hai đầu xa hơn stay radius.
- Khoảng im lặng tại cùng khu vực không được trả như gap để mobile không vẽ stay thành đường đứt.
- T1b trả gap set của toàn trail trên mỗi page. Mobile nên merge/dedupe bằng `(fromSeq,toSeq)`.

## 5. Revision conflict

Nếu server nhận late point, revision tăng. Request dùng revision cũ trả:

```http
HTTP/1.1 409 Conflict
```

```json
{
  "success": false,
  "code": "TRAIL_REVISION_CHANGED",
  "message": "Trail revision changed. Reload the snapshot before applying more points.",
  "data": {
    "trailId": "671234567890abcdef012345",
    "currentRevision": 5,
    "lastSeq": 206
  }
}
```

Mobile phải xóa geometry/cache của revision cũ và tải lại từ trang đầu. Không tiếp tục áp response catch-up cũ.

## 6. HTTP errors

| HTTP | Code | Xử lý mobile |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Sửa query; `afterSeq` bắt buộc có `revision` |
| 401 | `UNAUTHORIZED` | Dùng refresh flow single-flight rồi retry một lần |
| 403 | `FORBIDDEN` | Dừng xem trail; user không còn quyền Circle |
| 404 | `NOT_FOUND` | Ngày đó chưa có trail; hiển thị trạng thái rỗng |
| 409 | `TRAIL_REVISION_CHANGED` | Xóa snapshot local và tải lại từ đầu |
| 429 | `RATE_LIMITED` | Tôn trọng `Retry-After`, backoff có jitter |
| 503 | `SERVICE_UNAVAILABLE` | Feature đang tắt; fallback sang journey/history hiện có |

## 7. Swift models

```swift
struct LiveTrailResponse: Decodable, Sendable {
    let success: Bool
    let trailId: String
    let userId: String
    let date: String
    let timeZone: String
    let revision: Int
    let lastSeq: Int
    let points: [LiveTrailPoint]
    let gaps: [LiveTrailGap]
    let matched: [LiveTrailMatch]
    let hasMore: Bool
    let nextAfterSeq: Int?
}

struct LiveTrailPoint: Decodable, Identifiable, Sendable {
    var id: Int { seq }
    let seq: Int
    let latitude: Double
    let longitude: Double
    let recordedAt: Date
    let accuracy: Double?
    let motionState: String?
    let pointId: UUID?
}

struct LiveTrailGap: Decodable, Hashable, Sendable {
    let fromSeq: Int
    let toSeq: Int
    let seconds: Double
    let meters: Double
}

struct LiveTrailMatch: Decodable, Sendable {
    // Reserved for T3. T1b always returns an empty array.
}
```

## 8. Mobile loading algorithm

1. Gọi trang đầu không có `afterSeq`; lưu `trailId` và `revision`.
2. Trong khi `hasMore=true`, gọi tiếp với `afterSeq=nextAfterSeq` và cùng revision.
3. Nếu nhận 409, hủy vòng tải hiện tại, xóa snapshot revision cũ và quay lại bước 1.
4. Merge point theo `seq`, merge gap theo `(fromSeq,toSeq)`.
5. Sort point `(recordedAt,seq)` trước khi dựng polyline.
6. Không nối đường liền qua cặp seq có trong `gaps`.
7. Socket realtime vẫn dùng `location_update`; watch/delta live trail sẽ được bổ sung ở T2.
