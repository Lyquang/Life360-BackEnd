# Tìm tuyến — Backend API cho Mobile

Status: **Implemented locally; not deployed or device-verified** (2026-11-14).
Owner: [routing spec](../specs/features/routing/spec.md) · [contract](../specs/features/routing/contracts.md).

## Dùng API

`POST /api/v1/routes/preview` với Bearer access JWT và JSON:

```json
{
  "origin": {"latitude": 21.0285, "longitude": 105.8542},
  "destination": {"latitude": 21.0368, "longitude": 105.8342},
  "travelMode": "motorcycle"
}
```

`travelMode` bắt buộc: `motorcycle`, `car`, `walking`. Tọa độ là số hữu hạn
latitude -90…90, longitude -180…180; hai điểm phải khác nhau; body strict không
nhận field thừa. Không cần Circle ID và không chia sẻ đích/tuyến với Circle.
Backend giữ TomTom key; Mobile không gọi TomTom trực tiếp. Nếu Backend chưa đặt
`TOMTOM_ROUTING_API_KEY`, API trả 503.

Success `200`:

```json
{
  "success": true,
  "data": {
    "provider": "tomtom-v1",
    "travelMode": "motorcycle",
    "fetchedAt": "2026-11-14T00:00:00.000Z",
    "routes": [{
      "id": "0",
      "distanceMeters": 1234,
      "durationSeconds": 200,
      "geometry": [
        {"latitude": 21.0285, "longitude": 105.8542},
        {"latitude": 21.0368, "longitude": 105.8342}
      ],
      "maneuvers": [
        {"code": "DEPART", "pointIndex": 0, "routeOffsetMeters": 0, "streetName": null}
      ],
      "modeSections": [
        {"startPointIndex": 0, "endPointIndex": 1, "travelMode": "other"}
      ],
      "traffic": {"status": "provider_reported", "delaySeconds": 40}
    }]
  }
}
```

Ví dụ là DTO tổng hợp, không phải một tuyến đi thực tế. `routes` có 0–3 phần tử
thật; nếu không có tuyến: `routes: []` và `reason: "no_route"`. `id` chỉ có
giá trị trong một response, không dùng để gọi trip server. Geometry/maneuvers/
modeSections theo thứ tự tuyến; index là zero-based vào `geometry`.
`modeSections.travelMode=other` là đoạn provider chưa xác nhận theo mode yêu
cầu; xe máy vẫn được chọn tuyến nhưng app phải luôn hiện cảnh báo. Không tự
diễn giải `other` thành đi bộ. Với walking, `traffic.status` luôn
`unavailable` và `delaySeconds:null`. `fetchedAt` là giờ Backend nhận
response, không chứng minh giờ traffic upstream cập nhật.

| HTTP | `code` | Xử lý |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Sửa body |
| 401 | `UNAUTHORIZED` | Refresh/login theo luồng auth hiện có |
| 429 | `RATE_LIMITED` | Quá 10 request/người/phút mặc định; theo header `RateLimit`/retry |
| 429 | `ROUTE_QUOTA_EXCEEDED` | Upstream quota; dừng tự reroute |
| 503 | `ROUTE_UNAVAILABLE` | Chưa có key, upstream lỗi/timeout hoặc response không hợp lệ |

Không retry vòng lặp 429. Nếu đang dẫn đường, Mobile giữ tuyến đã tải khi API
503/offline và báo traffic/reroute không còn mới. Backend không lưu route/GPS/trip.
API không có socket event hoặc cursor. Không có bảo đảm tuyến xe máy hợp pháp tại
mọi đoạn: TomTom v1 motorcycle là BETA; kiểm tra tuyến thực tế trước rollout.

## Validation và thay đổi

`node --test tests/routingPreview.test.js` (5 pass) và một lệnh adapter thực
với hai tọa độ công khai Hà Nội (3 tuyến, có `motorcycle` + `other`) ngày
2026-11-14. Chưa kiểm thử thiết bị, điều khoản tài khoản hoặc deployment. API
được thêm mới; client cũ không cần gọi nó.
