# Plan: Routing và active trip

Status: **Proposed**. [Spec](spec.md) · [Roadmap](../../system/mobility-roadmap.md).

**Cần review lại — 2026-11-13:** user đã chốt Việt Nam, free-only/chưa billing,
in-app turn-by-turn có giọng nói và self-only location khi bật riêng lúc pause.
[Spec](spec.md) và [interview](../../system/mobility-interview.md) ghi authority.
Thiết kế preview/active-trip bên dưới chưa đủ yêu cầu navigation mới; chưa được
duyệt triển khai và chưa chọn SDK/provider. Không dùng bản plan cũ làm approval.
Chờ giải quyết blockers và human requirements confirmation trước lập plan mới.

## Cập nhật nền bản đồ đã xác minh

Mobile dùng native Swift/SwiftUI + Apple MapKit, iOS 16; không phải Google Maps.
MapKit native có directions/alternate routes cho mode được hỗ trợ nhưng transport
enum công bố không có motorcycle riêng. Không dùng automobile thay xe máy. Search
native Apple không giải quyết luôn routing xe máy hoặc traffic worker ở backend.
Luồng server-side dưới đây vẫn là proposal cho active-trip/traffic, chưa chọn
provider. Google mapping/API trong plan là candidate, **không** đã duyệt để vẽ lên
Apple Maps; phải xác minh điều khoản/capability trước chọn. Không đổi maps nền
hoặc bỏ yêu cầu xe máy vì phát hiện này. Việt Nam đã xác nhận; coverage thực còn mở.

## Flow và file dự kiến

HTTP auth/DTO → routing controller → routing use cases → `routingProvider` port;
trip commands → `tripRepository`/unit-of-work → proposed `ActiveTrip` model.
Worker traffic gọi routing service với cap và context version, không gọi từ từng
`update_location` và không làm chậm ingestion. Recompute qua queue/coalescing bounded.

Files đề xuất: `src/application/routing/routingUseCases.js`,
`src/application/ports/routingProvider.js`, `src/infrastructure/maps/<adapter>.js`,
`src/infrastructure/repositories/tripRepository.js`,
`src/infrastructure/database/models/ActiveTrip.js`, routing DTO/controller/routes;
wiring `src/container.js`, `src/presentation/http/app.js`, config và Swagger.
Không dùng `mapMatcher` port làm routing provider vì input/output khác.

## Phương tiện và tuyến thay thế

REQ-MOB-11 mở rộng bản draft xe máy trước: UI có xe máy/ô tô/đi bộ; mode bắt buộc
qua DTO → port → provider, không để provider mặc định. Candidate Google mapping:
motorcycle→TWO_WHEELER, car→DRIVE, walking→WALK. Đây là mapping dự kiến khi chọn
Google, không enum contract đã hiện thực. Bike/transit chỉ thêm sau xác nhận scope.

Đề xuất Google Routes computeRoutes với `computeAlternativeRoutes=true`, kèm
geometry/ETA/attribution cần thiết trong field mask. Số tuyến có thể chỉ một, phụ
thuộc mode/vùng/điểm đến; bản đầu origin→destination không intermediate waypoints.
Candidate UI giới hạn tối đa 3 tuyến tổng cộng để dễ so sánh, không hứa service
luôn trả đủ 3. Nếu provider trả nhiều hơn thì chọn/rank deterministic và giữ
route identity tương ứng, không tự tạo đoạn nối khác.

Thẻ tuyến hiển thị distance/ETA, traffic khi available, thu phí/tránh cao tốc khi
mode/provider hỗ trợ. Chỉ gắn “nhanh nhất/ngắn nhất” trong tập kết quả nhận được;
không khẳng định tối ưu toàn cục. P0 kiểm tra legality/coverage và các cảnh báo
beta theo yêu cầu provider. Walking không request traffic-aware options không
được hỗ trợ; traffic unavailable không có nghĩa không kẹt xe.

Đổi mode trong preview loại response cũ bằng request ID. Nếu trip đang active,
đề xuất xác nhận đổi phương tiện, recompute và đổi trip revision nguyên tử để
invalidate pending alert cũ; không đổi mode trip âm thầm chỉ vì đổi tab xem trước.
Cache route nếu được phép phải phân biệt origin/destination/mode/departureTime/
options/provider/freshness; không nhầm với cache lịch sử search.

## Proposed API, chưa hiện thực

| Method/path dưới `/api/v1` | Ý nghĩa |
|---|---|
| POST `/routes/preview` | origin/destination, travelMode, departureTime; trả bounded alternatives, geometry/encoding, ETA/baseline nếu có, traffic availability/intervals, provider attribution, fetchedAt/expiresAt, opaque route reference |
| POST `/trips` | selected route reference hoặc waypoints hợp lệ, clientRequestId; xác minh/recompute route nếu reference cũ; 201 mới, 200 replay, 409 active khác |
| GET `/trips/active` | Owner-only; active context hoặc null, freshness/degradation |
| POST `/trips/:tripId/end` | End/cancel idempotent, optimistic revision, terminal state không sống lại |

Chưa chốt DTO exact field list; không cho client gửi provider URL hoặc route
polyline tùy ý làm nguồn traffic. Query/get trip của người khác phải bị từ chối.
Validation/auth/429/errors theo shared conventions; provider outage trả 503 hoặc
partial response chỉ khi có route thực với traffic unavailable, không fabricate geometry.

## Proposed data model và lifecycle

`ActiveTrip`: ownerId, clientRequestId/requestHash, state active/ended/cancelled/expired,
mode, origin/destination reference hợp lệ, selectedRouteRef/provider,
revision, startedAt/endedAt/expiresAt, latestFixRecordedAt, lastEvaluatedAt.
Geometry/ETA snapshot chỉ transient hoặc retention được provider cho phép; không
persist raw route response vô hạn. User-entered waypoint và provider-derived fields
phải có provenance riêng theo [research](../../system/mobility-research.md).

Indexes dự kiến: unique `(ownerId,clientRequestId)`, partial unique ownerId khi
state=active, index `(state,nextEvaluationAt)` nếu worker cần và cleanup expiry.
Expiry kiểm tra ở authorization/evaluation trước khi chờ TTL; TTL không chính xác
đến từng phút. Concurrent starts chỉ một thắng; replay ID khác payload → conflict.

Start → active → end/cancel/expire; revision CAS chống GPS/job muộn hồi sinh trip.
Đề xuất expire sau 6 giờ và renew có chủ ý; arrival cần dwell/gần đích xác nhận,
không kết thúc chỉ vì một điểm GPS nhảy. Values chờ Q-MOB-05. Reroute đổi revision,
hủy pending traffic alerts của revision cũ; worker chụp version và recheck trước persist/send.

## Traffic và nền

Đề xuất evaluate tối đa mỗi 3 phút mỗi active trip khi GPS đủ mới, có bounded
concurrency/global budget. Route preview có traffic hiển thị ngay nếu available.
Traffic alert policy thuộc context-alerts, không lặp threshold tại đây.
Không polling toàn bộ Circle hoặc lưu trữ traffic crowdsource của người dùng.

Nếu lệch tuyến, đề xuất yêu cầu xác nhận reroute trong app; khi app đóng chỉ gửi
thông báo generic mở lại bản đồ, không tự chuyển tuyến. Unknown/degraded không
tạo traffic warning chắc chắn. Exact off-route threshold chốt sau spike.

## Verification và rollout

New tests đề xuất: routing adapter/use cases/HTTP và trip concurrency với local
replica set. Map AC-ROUTE-01/02/03 sang provider fixture (no route/unsupported/missing
traffic/malformed polyline); 04/05/06 sang start races/replay/expiry/privacy/auth;
07 sang end-to-end worker + mobile push. Test job cũ sau reroute/end và monotonic
GPS. Pilot mode-specific thực địa chỉ sau user authorization; không claim coverage
từ fake fetch. Provider keys/feature flags default off cho tới đủ P0–P4.
AC-ROUTE-08/09: mode matrix, stale response sau switch, một/nhiều/no routes,
walking không có jam warning, selected-route identity và change-mode revision race.
