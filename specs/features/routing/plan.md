# Plan: Routing và active trip

## Revision 2 — route finding + in-app navigation (2026-11-14)

**Status: DESIGNING, not implementation-approved.** Authority: user requested
implementation, selected TomTom Maps Routing API v1 for a conditional internal trial
(Q-MOB-31), and authorized routing-scoped Mobile work/local iOS checks. [Progress](progress.md)
holds the decision record; [research](research.md) holds public provider evidence.
Requirements/acceptance: [spec](spec.md), AC-ROUTE-01/02/03/08/09/10/11/12 and
AC-ROUTE-13/14/15. AC-ROUTE-07 traffic push is owned by context-alerts and is
**outside this delivery**. No weather or paid account/deployment change.

### Gate 0: provider and account

User has a private key in Backend `.env`, and six bounded public-route calls
proved v1 endpoint access to all three requested modes (see research). Account
owner still checks the key's assigned Routing v1 product and billing type in the
dashboard and reads applicable account terms for route display on MapKit,
short-lived route storage and active navigation. Keep the restricted server-side
key private; never place it in chat, Mobile bundle, Git or docs. Test real Vietnam origin/destination pairs
for motorcycle, car, pedestrian, alternatives, guidance language/geometry, traffic
availability and quota behavior. Motorcycle is BETA; if unsupported or invalid,
report unavailable instead of substituting car. This gate controls **activation
and completion claims**; fixture tests cannot establish Vietnam coverage or rights.

### Architecture and data flow

Mobile MapKit search selection/current location → authenticated Backend preview
→ strict Zod DTO → routing use case → injected TomTom Maps v1 REST adapter → bounded
normalized route options. Backend owns provider key and request budget. Mobile
owns selected route, in-memory active navigation session, maneuver progression,
voice synthesis and loaded-route continuation. **This route/navigation slice is
stateless on Backend**: no ActiveTrip/route document, worker or location upload.
Background traffic alerts, which need durable trip context, belong to the later
context-alerts slice. The current requirement only asks offline continuation
during an active app session, not restart from a killed app without network.
Existing historical journey renderer is not a navigation engine. No Circle
endpoint or shared destination. Details of the **proposed** endpoint are in
[contracts](contracts.md); it is not implemented yet.

Backend files expected: new `src/application/routing/routingUseCases.js`,
`src/infrastructure/maps/tomtomRoutingV1.js`,
`src/presentation/dto/routing.schemas.js`,
`src/presentation/http/controllers/routingController.js`,
`src/presentation/http/routes/routingRoutes.js`; update `src/container.js`,
`src/presentation/http/app.js`, `src/config/env.js`/`.env.example`, Swagger and
targeted tests. No database model/migration for this slice. The older ActiveTrip
proposal below is historical and **not** part of Revision 2.

Mobile files expected within routing scope: new `.spec/<next>-route-navigation/`
feature artifacts first; then route models/repository/DTOs/UseCases, MapKit map
presentation, ViewModel and Coordinator integration adjacent to
`FamilyTracker/Presentation/Scenes/Places/Search/`,
`FamilyTracker/Presentation/Scenes/LiveMap/Map/` and
`FamilyTracker/Presentation/Coordinators/MapCoordinator.swift`. Reuse existing
`APIClient`, `CLLocationService`, account/session and design-system patterns.
Localize every app-owned label and spoken message in vi/en. Do not alter the
historical journey renderer or Circle-sharing policy to implement navigation.

### Route and navigation lifecycle

Preview takes explicit origin/destination/mode (`motorcycle|car|walking`), accepts
one or more real provider alternatives, and marks traffic as provider-reported or
unavailable per mode/response. Walking traffic is unavailable even if TomTom
returns `trafficDelayInSeconds:0`. A route may contain `TRAVEL_MODE=other`;
normalize its spans for a persistent warning, without calling that span walking.
Changing mode invalidates prior alternatives. The Mobile Coordinator selects a
route and starts one account-scoped local navigation session; revision/generation
guards exclude late preview/reroute/GPS callbacks. End/arrival/logout clear it.
No server start/end or route reference API in this slice. Pause of Circle sharing
does not imply private navigation consent: location for navigation needs its own
explicit opt-in as established by REQ-MOB-16.

On device, advance through provider maneuvers using reliable fresh location and
route offsets. Coded maneuvers become vi/en speech templates; the live provider
probe accepted `language=vi-VN` but returned English turn verbs. Street names
remain proper nouns; unknown codes fail to a neutral visual state without spoken
wrong-direction advice. Audio uses platform speech APIs, with a background
location/audio lifecycle that respects permission denial and battery policy.
Proposed engineering limits for review: require two credible off-route fixes at
least 10 seconds apart and >40 m from route, minimum 60 seconds between online
reroutes, max 10 reroutes per trip; re-evaluate after device/provider QA. No
reroute from stale/inaccurate fixes or while offline. For arrival, propose two
credible fixes within 50 m of destination spanning at least 30 seconds; do not
auto-end from one jumped fix. Offline continues the loaded route/instructions
in the active process and clearly marks traffic/reroute stale/unavailable; no
promise of offline map tiles or new routes.

### Failure, privacy and rollout

Provider no-route, unsupported mode, quota/entitlement error, malformed geometry,
timeout and network loss need distinct typed outcomes; never fabricate a route or
reuse car instructions for motorcycle. Auth applies to preview; route state is
account-local on the device. No coordinates, destination, route body, upstream
URL or key in logs. Propose authenticated 10 previews/minute/user, an 8-second
provider timeout and no automatic 429 retry. The Free account stops at provider
quota; no billing mode switch. Default disabled when key absent. Preview can
degrade traffic to unavailable only when actual route geometry/guidance exist.
Do not claim full navigation from backend fixture tests, simulator-only audio or
map screenshot; real device and Vietnam route checks remain required.

### Verification and handoff

Backend tests: DTO/auth, mode mapping, no-route/429/entitlement/failure,
alternative identity, geometry/maneuver validation, `other` spans and per-mode
traffic reporting. Mobile tests: mode change, route/step progression, off-route cooldown,
stable arrival, offline continuation, pause/privacy, vi/en spoken copy, background
permission/degradation and accessibility. Run local iOS build/test only within
authorized Mobile scope; device/background/real provider checks require account
and device. On implementation, write `api-docs/ROUTING_API_DOC.md`, synchronize
Swagger, and create a Vietnamese `Study/ROUTING_NAVIGATION.md`; Mobile feature
study/verification remain in its own `.spec/` owner. Update both progress logs.

### Alternatives and unresolved gates

TomTom Orbis v2/v3 is not a motorcycle substitute; VietMap Trial Traffic is off
by default; Apple MapKit has no motorcycle route mode. TomTom v1 endpoint access
and user-reported Free/Routing assignment are established. Public API docs allow
plotting routes on other maps, but full account terms and device background audio
remain unverified. Mobile design/plan approval and exact contract review remain
before code; free quota/mixed-mode pilot remain before claiming completion.

---

## Historical draft (2026-11-12; superseded where Revision 2 differs)

Status: **Proposed**. [Spec](spec.md) · [Roadmap](../../system/mobility-roadmap.md).

## Cập nhật nền bản đồ đã xác minh

Mobile dùng native Swift/SwiftUI + Apple MapKit, iOS 16; không phải Google Maps.
MapKit native có directions/alternate routes cho mode được hỗ trợ nhưng transport
enum công bố không có motorcycle riêng. Không dùng automobile thay xe máy. Search
native Apple không giải quyết luôn routing xe máy hoặc traffic worker ở backend.
Luồng server-side dưới đây vẫn là proposal cho active-trip/traffic, chưa chọn
provider. Google mapping/API trong plan là candidate, **không** đã duyệt để vẽ lên
Apple Maps; phải xác minh điều khoản/capability trước chọn. Không đổi maps nền
hoặc bỏ yêu cầu xe máy vì phát hiện này. Country/coverage còn mở.

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
