# Plan: Context alerts và nền tảng push

Status: **Proposed**. [Spec](spec.md) · [Roadmap](../../system/mobility-roadmap.md).
Giữ layering và [API conventions](../../system/api-conventions.md) hiện tại.
Lưu alert/delivery tối thiểu và retention 7 ngày đã được [DEC-ALERT-01](decisions.md)
chấp thuận; những ngưỡng/provider chi tiết còn là Proposed.

**Requirements update — 2026-11-13:** Việt Nam/free-only/chưa billing; bổ sung
dông/gió mạnh/nóng bất thường, cửa sổ mưa 30 phút và personal-location opt-in riêng
khi pause Circle theo [spec](spec.md). Rules/providers/push context bên dưới cần
review lại theo các ràng buộc này; không được coi proposal cũ là approved plan.
Đã chốt thêm traffic delay từ 5 phút và quiet hours 22–07 trừ nguy hiểm; severity/
probability, provider và các tham số còn lại chưa chọn; xem [progress](progress.md).

## Flow

```text
GPS mới được chấp nhận / active-trip tick
  -> đánh dấu context có version + nextEvaluationAt trong durable state
  -> worker claim lease -> weather/routing provider qua injected port
  -> pure rule + freshness/privacy recheck
  -> normal/unknown: không tạo notification, chỉ cập nhật scheduling/rule context cần thiết
  -> đáng chú ý và là episode mới/escalation: transaction ContextAlert + per-device PushDelivery
  -> dispatcher claim -> recheck user/device/context/expiry -> push provider
  -> inbox recovery / optional socket hint / mobile visible notification
```

Không gọi weather ở mỗi GPS fix, không dùng setInterval process-local làm nguồn
công việc duy nhất. Proposed evaluation cadence: weather 10 phút/vùng có user đủ
điều kiện, traffic theo routing plan; coalesce đúng quyền cache của provider.
Worker chạy độc lập request/socket và có runtime always-on hoặc scheduler được duyệt.
Một GPS mới đến sau job phải invalidate job cũ; context revision kiểm tra trước commit.

## DB thông báo và cache dữ liệu nguồn

REQ-MOB-09 chỉ tạo thông báo cho điều kiện đáng chú ý. Đề xuất **có lưu DB cho
alert thực sự được tạo**, gồm loại/rule/evidence tối thiểu được phép lưu, thời điểm/
expiry/read/delivery; lợi ích là inbox, chống trùng và phục hồi push worker. Giữ
7 ngày đã được user chấp thuận trong DEC-ALERT-01; tính năng chưa chạy.
Không lưu từng lần poll, raw timeline, lịch sử nắng đẹp hay POI/traffic payload không
được phép. Scheduling context không đồng nghĩa một thông báo đã được tạo.

Provider weather/traffic response có thể cache ngắn hạn theo licence/freshness;
cache miss không tạo bình thường giả. AlertContext chỉ giữ state tối thiểu để
phân biệt normal/active-episode/unknown; ContextAlert chỉ dành cho warning hợp lệ.
Khi rule trở về normal được xác nhận đủ ổn định thì đóng episode; thiếu dữ liệu
không reset episode gây gửi trùng khi provider hồi phục.

Dedup đề xuất theo `(user,ruleVersion,context,episodeId,severityBand)`, không tạo
alert mới chỉ vì đã sang một cache TTL hoặc time bucket. Cùng episode chỉ gửi lại
khi escalation được duyệt; cooldown là thêm một giới hạn, không lệnh bắt buộc gửi
định kỳ. Recovery bình thường không push mặc định. Test normal phải xác minh không
insert alert/delivery và không gọi push, dù vẫn có provider/cache/scheduling work.

Điều kiện thời tiết mở rộng như mưa lớn/dông/gió mạnh/nóng bất thường cần source,
ngưỡng vào/ra, severity và opt-in cụ thể; hiện chỉ đề xuất, không tự bật toàn bộ.
Không dùng “lạ” như rule tự do do LLM quyết định. Traffic jam/delay chỉ áp đúng
mode/tuyến có capability; đi bộ không nhận cảnh báo kẹt xe kiểu ô tô.

## Ngưỡng đề xuất để duyệt/tune, chưa phải config hiện hữu

| Chính sách | Candidate | Unknown/failure |
|---|---|---|
| GPS freshness | Không quá 5 phút; accuracy tối đa 100m nếu có field đáng tin cậy | Không đủ timestamp/accuracy theo policy → không khẳng định vị trí hiện tại |
| Mưa gần hạn | Window 30 phút; probability >=60% khi provider có probability đúng window; hoặc intensity >=0.2mm/h ở >=2 forecast samples kế tiếp, ghi rõ loại evidence | Không chuyển intensity thành probability; hourly-only không đủ để hứa thời điểm phút |
| Traffic | Đoạn có jam từ provider, hoặc delay >=5 phút và >=25% so với baseline tương thích | Mode không hỗ trợ/baseline thiếu → unknown; không tự set0 |
| Chống spam | Rain cooldown 60 phút/vùng/rule; traffic 15 phút/trip/revision, cho escalation có điều kiện | Durable episode/severity dedup; hết cooldown không tự tạo thêm alert cho cùng hiện tượng |
| Push expiry | <= hiệu lực forecast/route snapshot, candidate tối đa 10 phút sau tạo | Expired suppress; offline không phát backlog cũ |
| Quiet hours | Candidate 22:00–07:00 timezone user cho push thường | Inbox vẫn lưu alert còn hiệu lực; không đánh thức để gửi forecast đã hết hạn |

Các giá trị không phải SLA; P0/P4 phải chốt, thử thực địa rồi điều chỉnh. Existing
GPS DTO thiếu thông tin needed thì mở rộng riêng theo [location-sharing spec](../location-sharing/spec.md),
không bịa accuracy của fix cũ. Offline batch cũ không tạo cảnh báo “hiện tại”.

## Proposed models và indexes

| Model / owner: context-alerts | Nội dung/constraint dự kiến |
|---|---|
| DeviceRegistration | userId, installationId, platform, encrypted push token/provider, tokenHash, session association, enabled, updatedAt. Unique installation/tokenHash; owner được gán từ auth, không body. Token không xuất lại qua API. |
| AlertPreference | Unique userId; rain/traffic enabled, timezone, quiet hours, optional lock-screen detail; version để invalidate pending jobs. |
| AlertContext | Unique userId; latestFix metadata/reference/expiry, activeTripId/revision reference, context/policy version, nextEvaluationAt/lease, minimal active-episode/rule state. Không copy full LocationHistory hoặc forecast history. |
| ContextAlert | userId, type, dedupKey, ruleVersion, source/freshness, valid window, owner-only detail payload, trip context ref nếu có, createdAt/readAt/expiresAt. Unique `(userId,dedupKey)`. |
| PushDelivery | alertId, registrationId, contextVersion, status pending/leased/accepted/failed/discarded, attempts, nextAttemptAt, leaseToken/leaseUntil, expiresAt. Unique `(alertId,registrationId)`; index pending/nextAttemptAt. |

Detail payload không lưu raw provider response. Retention đã chấp thuận: inbox 7 ngày,
delivery 7 ngày, ended trip context xóa sớm theo routing policy; active context khi
hết freshness bị vô hiệu ngay, cleanup async chỉ phục vụ dung lượng. TTL không dùng
để quyết định quyền đọc. Áp dụng retention đã duyệt và chốt provenance/retention
của các loại context khác trước tạo index/cleanup job.

Transaction ghi alert/deliveries, unique keys backstop chống race; dispatcher dùng
atomic claim/lease, retry transient với jitter/maxAttempts, lỗi token invalid disable
registration. FCM idempotency không bảo đảm exactly-once: crash sau send trước ack
có thể lặp push; dùng alertId để app/inbox dedup và collapse/tag khi platform hỗ trợ.
Không hứa không bao giờ thấy duplicate notification ở OS.

## Proposed API, chưa được hiện thực

| Method/path dưới `/api/v1` | Dự kiến |
|---|---|
| PUT `/devices/:installationId` | Auth register/rotate own provider token + platform; token write-only. Chống chiếm token máy khác, rebind khi đổi tài khoản phải revoke binding cũ. |
| DELETE `/devices/:installationId` | Revoke installation hiện tại; retry idempotent; không xóa token account khác theo ID đoán được. |
| GET/PATCH `/me/alert-preferences` | Owner-only toggles, timezone/quiet hours; version/CAS để tránh lost updates. |
| GET `/me/context-alerts` | Cursor pagination; chỉ owner; includeExpired nếu cần history được duyệt, không trả stale như live warning. |
| POST `/me/context-alerts/:alertId/read` | Owner-only, idempotent read; không coi push accepted là read. |

Foreground lấy inbox và optional socket `context:alert_available {alertId}` chỉ user
room. Socket event mới là proposal; không gửi raw provider payload. Tap push cũng
qua auth; user logout/token expired không đọc được nội dung chỉ nhờ notification ID.

## Mobile và account lifecycle

Đã xác minh mobile hiện là native Swift/SwiftUI với MapKit, iOS16; không đặt câu
hỏi Expo/bare hoặc mặc định thêm React Native package. Lượt đọc DI thấy có
PushNotificationService hiện hữu; chưa audit transport/capabilities, không thay
thế hay coi đã có server push bằng tên service. Candidate FCM iOS/Android, iOS đi qua APNs,
permissions và certificates cần setup được duyệt. Dùng visible notification cho
cảnh báo, không kỳ vọng silent push thực thi lịch nền liên tục.

Mobile cần location foreground/background phù hợp OS, disclosure và setting rõ.
Phân biệt background/OS-terminated/force-stop, battery saver và quyền approximate;
backend chỉ dùng fix mới nhất hợp lệ, không tự tạo vị trí từ nơi Nhà đã lưu.
Logout hiện tại cần hook revoke device association, không chỉ hủy token JS; đổi
account kiểm tra binding epoch, pending jobs revalidate. User có thể nhiều thiết bị;
gửi mỗi installation hợp lệ và app xử lý alertId ổn định.

Pause/disable được đọc lại lúc evaluate và dispatch; late GPS không tăng context
version như fix mới, job stale không hồi sinh. Không thể thu hồi push đã được OS
hiển thị; payload generic giảm rò rỉ. Self-only alerts khi pause là Q-MOB-03, chưa tự
nới chính sách hiện có. Endpoint mới không cung cấp GPS cho người khác.

## Files dự kiến và verification

New application modules `src/application/alerts/` (rules orchestration/context,
preferences/device/inbox/dispatcher), ports weatherProvider/pushProvider;
pure rules trong `src/domain/contextAlerts.js`; weather/push adapters dưới
`src/infrastructure/`; 5 models/repositories theo bảng trên. DTO/controller/routes
và job entry trong presentation; wire container/bootstrap/config/Swagger. Tên file
chi tiết chốt ở implementation; không dùng SosOutbox hoặc thay SOS dispatcher.

Targeted touches: `src/application/location/locationUseCases.js` ở điểm chấp nhận
fix mới, `src/application/privacy/privacyUseCases.js`, auth logout lifecycle,
routing lifecycle; giữ GPS/SOS/chat behavior cũ và tránh làm request phụ thuộc provider.
Durable enqueue failure phải observable và được reconciliation có watermark bù;
không bỏ alert work âm thầm hoặc đổi GPS response sau khi đã commit fix.

Tests đề xuất: pure `contextAlertRules`, fake weather/routing adapters, HTTP owner
APIs, Mongo replica-set concurrent dedup/claim/lease/restart, pause/logout/reroute
race và stale worker result. Map AC-ALERT-01/02/03/05/07/08 ở backend; 04/06 cần
native E2E thêm foreground/background/lock/offline/token rotation/force-stop. Đo
battery/network và push latency pilot, không gán SLA trước evidence. Feature flags
default off; rollout theo P3/P4/P5, không test gửi push người thật khi chưa được phép.
AC-ALERT-09/10: normal→abnormal→same-episode→escalation→recovery; vượt cache TTL/
cooldown không nhân bản, provider outage không giả recovery, walking/mode change
không tái dùng jam alert cũ. Test DB/push no-op khi normal và retention/owner-only history.
