# SOS temporary location sharing — plan-first

Ngày: 2026-10-30. **Đề xuất, chưa approved, chưa triển khai/deploy API này.**
Tài liệu đầu vào: yêu cầu Mobile đính kèm về lease vị trí SOS.
Không dùng các đường dẫn/event dưới đây như API đang tồn tại.

## 1. Hiện trạng đã đối chiếu mã Backend

| File | Thực tế |
| --- | --- |
| `src/application/privacy/privacyUseCases.js` | Thay đổi `User.locationSharing` toàn tài khoản; pause xóa cache last-location, RAM tracking và revalidate watch hiện tại |
| `src/application/privacy/locationAccessPolicy.js` | Publish dựa trên sharing toàn tài khoản; view dựa trên nhóm chung hiện tại và sharing của target |
| `src/application/location/locationUseCases.js` | updateLocation kiểm tra privacy, ghi Redis thường/history/User.lastKnownLocation, chiếu Live Trail và broadcast Circle; sendSos riêng cho snapshot một lần |
| `src/application/location/syncLocationBatchUseCase.js` | Batch thường kiểm tra global privacy; không có scope SOS |
| `src/presentation/dto/location.schemas.js` | Zod update_location chưa có sosId/leaseId; field lạ bị strip |
| `src/application/sos/sosAccessPolicy.js` | Audience snapshot lúc tạo giao với membership hiện tại trong cùng Circle; owner phải còn trong Circle đó; còn Circle hợp lệ khác vẫn được truy cập |
| `src/application/sos/sosUseCases.js` | Create/respond/close có transaction, revision và outbox; không có consent/lease vị trí |
| `src/application/history/liveTrailWatchUseCases.js` | Watch/history hiện dùng policy vị trí thường, không phải quyền SOS |
| `src/infrastructure/realtime/liveTrailAccessInvalidator.js` | Watch registrations là Map trong RAM một process |
| `src/infrastructure/realtime/socketRealtime.js`, `src/bootstrap.js` | Socket rooms/emit hiện không cấu hình adapter liên instance |
| `src/application/groups/groupUseCases.js` | Leave/remove ghi Group trong transaction rồi dọn rooms/revalidate sau commit |
| `src/application/auth/authUseCases.js` | Logout có thể chỉ blacklist access token; revoke family phụ thuộc refreshToken. Logout-all/password change revoke session trong transaction. Chưa liên kết lease consent |
| `api-docs/SOS_ASSISTANCE_API_DOC.md` | SOS one-shot, REST recovery và Socket, chưa có location lease hoặc OS push |

Đã đọc source Backend liên quan, chưa kiểm tra Mobile source hoặc cấu hình Render/Atlas thực.
Không dùng PATCH privacy bật rồi tắt lại để giả lập quyền tạm.

## 2. Bất biến bảo mật

1. Consent gắn với SOS active + owner + leaseId; tạo SOS không mặc nhiên cấp consent.
2. Không ghi hay khôi phục global privacy khi create/revoke/expire/close lease.
3. Không ghi điểm SOS vào `User.lastKnownLocation`, `location:last:<userId>`, LocationHistory
   hoặc LiveTrail thường; không chạy durationTracker/stay alerts/matcher thường.
4. Quyền nhận = audience gốc của incident ∩ membership hiện tại **trong cùng Circle**,
   với owner còn là thành viên. Không ghép snapshot nhóm X với membership nhóm Y.
5. Bất kỳ GET/watch/point/dispatch nào cũng kiểm tra lease effective + SOS active + quyền
   hiện hành; cache và room membership không phải nguồn cấp quyền.
6. Scope phải được phân loại trước Zod strip và trước normal use case. Có sosId hoặc leaseId
   nhưng thiếu/sai trường còn lại thì từ chối, **không fallback sang normal location**.
7. TTL chỉ dọn dữ liệu. Quyền hết ở expiresAt theo server kể cả document vẫn tồn tại.
8. Không gửi lại điểm thu trước consent. Không tự gia hạn khi heartbeat/reconnect/retry.

Không thể thu hồi packet đã giao hoặc xóa triệt để dữ liệu đã được người nhận lưu/chụp lại.
“Thu hồi ngay” nghĩa là không authorize thao tác mới sau điểm commit thu hồi/hết hạn;
packet đã được authorize/đưa vào network trước đó có thể đến muộn. Mobile phải bỏ packet
không khớp lease/revision/expiry hiện tại. Không hứa atomic transaction giữa Mongo và network.

## 3. Thiết kế lease và idempotency đề xuất

### Persistence riêng

- `SosLocationLease`: `_id`, sosId, ownerId, grantingFamilyId, consentAt, expiresAt,
  status active/revoked/expired/closed, revision (lease lifecycle), nextSeq, revokedAt/reason.
- `SosLocationConsentRequest`: unique (ownerId,sosId,clientRequestId), canonical payload hash,
  leaseId, consentAt/expiresAt đã quyết định. Giữ ledger đủ lâu để UUID cũ không cấp quyền mới.
  Chưa tự đặt TTL ledger. Không lưu raw token hoặc UUID vào log.
- `SosLocationPoint`: leaseId, pointId UUID, seq, recordedAt, receivedAt, GeoJSON,
  accuracy?, batteryLevel?, deleteAt. Unique (leaseId,pointId), unique (leaseId,seq).
  Index cho (leaseId,seq), (leaseId,recordedAt,seq), TTL riêng deleteAt.
- Một active lease/SOS, transition hết hạn cũ trong transaction trước grant mới;
  không dựa unique partial index tự hiểu rằng expiresAt đã trôi qua.

POST lease là thao tác **sau** POST SOS. Lease thất bại không rollback incident/chat đã tạo;
UI phải phân biệt SOS đã gửi và realtime chưa bật.

Transaction POST: authenticate owner/family → khóa incident active bằng revision/write guard
→ lookup idempotency → cùng UUID/hash thì trả binding lease cũ, không đổi expiresAt
→ khác hash thì 409 → active lease khác request thì 409 → tạo lease/ledger/lifecycle outbox.
Replay đọc binding ban đầu nhưng trả **effective status hiện tại** và serverTime mới;
replay sau close/revoke/expiry không cấp lease lại, không trả active giả.
Hai thiết bị cùng UUID dùng cùng lease; UUID khác khi đang active trả conflict.

DELETE nên có leaseId và expectedRevision (ví dụ If-Match) để DELETE trễ từ thiết bị cũ
không thu hồi nhầm lease mới. Replay revoke cùng lease trả trạng thái terminal hiện tại;
revision cũ với lease đang thay đổi -> 409. Đề xuất GET luôn trả lease hiện tại hoặc state none.
Đây là bổ sung so với request DELETE minh họa; chờ duyệt tên/header chính thức.

SOS close/cancel phải đóng lease + ghi lifecycle outbox **trong transaction hiện có**.
Append point cũng write guard cùng lease/incident; close/revoke/append race phải retry và
đánh giá lại giờ/quyền, không chỉ đọc một snapshot cũ rồi ghi độc lập.
Membership-sensitive writes dùng guard Group theo thứ tự ổn định như SOS hiện tại.

Giờ authority đề xuất lấy từ Mongo (`$$NOW`/DB-clock port), không tin đồng hồ Mobile hoặc
cache. Thời điểm kiểm tra phải được lấy lại khi transaction retry. Network/DB delay vẫn cần
kiểm tra hạn tại dispatch. DB outage: SOS scope fail closed 503, không fallback normal.

### Logout, app kill và đa thiết bị

App kill/mất mạng không được coi như logout vì server không biết chắc; lease còn đến deadline,
không có điểm mới nếu không có thiết bị gửi, Mobile hiển thị stale. Deadline vẫn giữ sau restart.
Đề xuất gắn consent với grantingFamilyId; logout family đã cấp consent hoặc revoke family do
reuse/password change/logout-all kết thúc lease. Logout một family khác không tự thay đổi
consent nếu chọn chính sách này. Cần sửa logout để biết family từ auth context ngay cả khi
không có refreshToken trong body. Chờ duyệt chính sách cụ thể tại mục 8.
Nếu client chỉ xóa Keychain mà không gọi server, server chỉ bảo đảm expiry theo deadline.

## 4. Contract dự kiến, CHƯA tồn tại

| Operation | Đề xuất |
| --- | --- |
| POST `/api/v1/sos/:id/location-sharing` | UUID + durationSeconds; owner xác nhận riêng |
| GET `/api/v1/sos/:id/location-sharing` | owner hoặc audience hợp lệ; state none hoặc lease effective |
| DELETE `/api/v1/sos/:id/location-sharing` | owner, leaseId + expectedRevision để chống thao tác trễ |
| GET `/api/v1/sos/:id/location-trail` | leaseId, afterSeq?, limit; chỉ scope lease hiện còn hiệu lực |
| `sos:location-sharing-updated` | eventId, sosId, leaseId, lifecycle revision, status, expiresAt, serverTime |
| `sos:location-update` | eventId, sosId, leaseId, ownerId, pointId, seq, recordedAt, receivedAt, coordinates, accuracy?, batteryLevel? |
| `sos:location-trail-watch/unwatch` | watch có giới hạn, auth phía server; tên/schema sẽ chốt ở contract |
| `sos:location-trail-delta/closed` | leaseId, revision, afterSeq, fromSeq/toSeq hoặc reason khi đóng |

GET state cho owner/audience vẫn được xem metadata terminal nhưng **không tọa độ/vệt** sau hết hạn.
Viewer mất audience thì 403, không trả metadata chỉ vì biết ID. Cần chốt ngoại lệ owner đọc vệt
sau đóng; đề xuất vòng đầu không cho cả owner đọc vệt đã hết lease để giữ phạm vi consent hẹp.
Vị trí one-shot đã chủ động đính kèm incident trước đó giữ hợp đồng cũ, không bị diễn giải là
quyền truy cập toàn bộ vệt; cần nêu rõ khác biệt này trong UI/tài liệu.

### Phân loại update_location

Mở rộng DTO thành 2 nhánh (đề xuất):

```json
{
  "sosId": "<ObjectId>",
  "leaseId": "<ObjectId>",
  "pointId": "<UUID>",
  "latitude": 10.77,
  "longitude": 106.69,
  "recordedAt": "2026-10-30T08:01:00.000Z",
  "accuracy": 8,
  "batteryLevel": 80
}
```

Không scope -> normal behavior giữ nguyên. Scope SOS -> use case riêng, owner/family/lease
được xác định/kiểm tra từ JWT + DB; không nhận audience từ client. Có scope sai -> error có code.
Vòng đầu đề xuất không thêm ack để không đổi global socket contract; pointId bắt buộc cho
idempotency, emit không là receipt. REST catch-up là nguồn đối soát điểm đã commit.

Timestamp SOS không dùng fallback timestamp của đường thường: điểm trước consent, ngoài
deadline hoặc quá cũ/tương lai bị từ chối với code riêng. Điều kiện đề xuất:
consentAt <= recordedAt < expiresAt, lease vẫn active tại receivedAt, tuổi <= 60s,
tương lai <= 5s (chờ duyệt). Không biến điểm bị từ chối thành điểm đo “bây giờ”.
accuracy số hữu hạn >=0; lat/lon ranges như hiện tại; battery 0..100 theo contract sẽ chốt.
Giới hạn đề xuất 30 điểm/phút/lease, 1800 điểm/lease, dedupe trước tăng quota;
không silently thinning trong lượt đầu. Rate limit phải chia sẻ giữa instances.

Nếu privacy thường bật: cùng GPS collector được dùng, nhưng client gửi message scope normal
và scope SOS riêng khi từng policy cho phép. Point SOS không tự fanout vào normal room.
Có thể hai event khác mục đích chứa cùng fix; Mobile tách state theo scope hoặc dedupe UI theo
(ownerId,pointId), không bỏ mất lifecycle SOS. Không tự mở chia sẻ normal khi grant lease.

### Trail và offline

Vòng đầu raw GPS, không map matching. Path order (recordedAt,seq), cursor là seq chèn;
lease lifecycle revision tách khỏi seq điểm. afterSeq là cursor trước delta, không giả định
seq liên tiếp. Gaps dùng fromSeq/toSeq nếu triển khai, reuse thuật toán pure đã có nhưng
không reuse storage/quyền của normal Live Trail. Snapshot phân trang cố định watermark,
catch-up sau watermark để không mất điểm khi đăng ký watch. Revision/lease mismatch ->409.

Đề xuất **không batch SOS vòng đầu**. Gateway và normal batch phải nhận biết field scope SOS
để từ chối hoặc reject từng điểm có scope, không strip rồi ghi nhầm vào lịch sử thường.
Điểm SOS không được đưa vào P7 queue normal. Nếu sau này thêm batch: endpoint/schema riêng,
kiểm tra thời gian đo lẫn receipt/grant validity, không broadcast điểm cũ như realtime mới.

## 5. Realtime nhiều instance và cache

Mongo là nguồn quyền/seq/idempotency, không RAM. Không positive-cache lease permission dài hạn.
Redis optional chỉ cache dữ liệu scope `{sosId,leaseId}` với TTL <= remaining lease và luôn
check quyền qua authoritative gate trước khi trả. Vòng đầu đề xuất không cache points.

Current Socket adapter và invalidator là local. Trước khi bật nhiều instance cần chọn:
Redis Socket.IO adapter + lifecycle pub/sub, hoặc Mongo-backed distributed event delivery.
Đề xuất adapter Redis cho transport, Mongo/outbox cho lifecycle durable; khi adapter mất kết
nối không coi cross-instance notification đã bảo đảm. Catch-up REST phục hồi, fail closed
cho SOS publish khi không thể thỏa policy đã chọn. Không đổi semantics normal Redis fallback.

Mỗi instance phải đóng watch theo local deadline và lifecycle event; revalidate membership
tại publish/read, không chỉ lúc join. Không broadcast raw vào room cũ rồi trông chờ leave hook.
Before-send authorization đối chiếu DB, session, membership, lease revision và expiry.
Redis mất thông điệp invalidation không cho phép đọc/gửi trái quyền; sweeper phục hồi trạng
thái terminal/outbox sau restart. Timers/sweeper phục vụ event/UI, không phải nguồn enforcement.

Lifecycle outbox chỉ chứa references; không lưu raw coordinates. Khi viewer mất quyền,
chỉ phát control “closed” tối thiểu tới watch đã tồn tại nếu cần, không kèm dữ liệu incident.
Packet đã authorize trước revoke có thể đến trễ như mục 2; phải nêu điều này trong contract.

## 6. Sequence chính

```mermaid
sequenceDiagram
    participant M as Owner Mobile
    participant API as SOS Lease API
    participant DB as MongoDB
    participant S as Scoped Location UseCase
    participant W as Outbox / Delivery
    participant B as Authorized Viewer
    M->>API: Explicit consent + UUID + duration
    API->>DB: Transaction owner/active/idempotency + lease + outbox
    DB-->>API: Lease + deadline + revision
    API-->>M: 201 or 200 replay + serverTime
    Note over M: Start SOS scope only after confirmed grant
    M->>S: update_location with sosId/leaseId/pointId
    S->>DB: Validate clock, consent, owner, active, membership; append atomically
    DB-->>S: Committed seq
    S->>W: Scoped publication reference
    W->>DB: Revalidate scope and deadline before delivery
    W-->>B: SOS location / delta only
    M->>API: Revoke matching lease/revision
    API->>DB: Transaction terminal status + revision + outbox
    API-->>M: 200 terminal state
    W-->>B: Sharing updated / watch closed
    B->>API: Trail read after revoke/expiry
    API-->>B: 403 scoped access ended
    Note over DB: TTL cleanup may happen later; privacy setting unchanged
```

## 7. Execution Plan theo phần reviewable — chờ approved

| Phần | File tạo/sửa dự kiến | Kiểm thử / đầu ra |
| --- | --- | --- |
| L0 Chốt contract | Study này; sau duyệt mới cập nhật API doc như planned, không claimed deployed | Chốt mục 8, threat model, state machine |
| L1 Domain + persistence | mới `src/domain/sosLocationSharing.js`, models `SosLocationLease.js`, `SosLocationConsentRequest.js`, `SosLocationPoint.js`, repository và DB clock port/adapter | Replica set tests: unique UUID/hash, concurrent grants, no resurrection, effective expiry không TTL |
| L2 Lease lifecycle | mới `src/application/sos/sosLocationSharingUseCases.js`, scoped access policy; sửa sosUseCases close, auth logout/session revocation và outbox | Create/revoke/close/logout races; multi-device; privacy không thay đổi; replay terminal |
| L3 REST/DTO/config | mới lease/trail controller/routes/schemas, sửa app/container/env/swagger | JWT/owner/403/409/429/503, explicit consent, disabled feature không ảnh hưởng SOS one-shot |
| L4 Scoped ingestion | sửa location.schemas/gateway để dispatch scope; mới scoped update use case, repository append | Không ghi normal cache/User/history/trail/stay; reject malformed scope/pre-consent/late; dedupe/quota |
| L5 Trail + delivery | mới scoped trail read/watch/delta, lifecycle invalidation; sửa bootstrap/Socket adapter/outbox hooks/group/auth | Snapshot+catch-up, cursor/revision, no leak after leave, restart, two processes, adapter outage |
| L6 Contract + acceptance | `api-docs/SOS_LOCATION_SHARING_API_DOC.md` mới; link từ SOS doc; README/PROGRESS/Study/graph | JSON examples/contract tests; full npm test + lint; staging benchmark; record deployed SHA/flags only after actual verification |

Feature flag riêng đề xuất `SOS_LOCATION_SHARING_ENABLED=false`; yêu cầu SOS persistence và
transaction. Không tự bật trên Render. Chưa chọn tên/env limits cuối cùng trước khi duyệt.
Mỗi phần chạy test liên quan rồi full regression/lint khi hoàn thiện; commit/push theo quyền
user đã cấp, không đưa code giai đoạn sau vào commit trước. Không sửa iOS trong task Backend.

## 8. Cần tôi quyết định — đề xuất, chưa chọn thay user

| # | Quyết định | Đề xuất |
| --- | --- | --- |
| 1 | Duration và gia hạn | 60..3600 giây, mặc định UI đề xuất 3600; không auto-renew/extend. Hết/thu hồi phải consent mới UUID mới |
| 2 | Logout và nhiều thiết bị | Lease gắn family cấp consent; family đó logout/revoke thì lease đóng; logout-all/password change đóng mọi lease. Chốt có cho family khác publish bằng cùng lease không (đề xuất không, phải chuyển consent rõ ràng) |
| 3 | Đọc sau expiry/revoke | Không ai đọc vệt tạm sau khi hết lease; metadata terminal vẫn cho audience còn quyền. One-shot incident giữ hợp đồng cũ |
| 4 | Retention điểm | Đề xuất xóa vật lý qua TTL tối đa expiresAt ban đầu +24h; revoke có thể rút ngắn cleanup nhưng quyền đóng ngay. Ledger idempotency giữ cùng incident, không TTL ngắn |
| 5 | Scope/batch/ack | Có sosId+leaseId+pointId trên update_location; không ACK/batch SOS vòng đầu; chặn scoped points vào normal batch |
| 6 | Point time/quota | Max age60s, future5s, bắt buộc nằm trong khoảng consent; 30 điểm/phút/lease, 1800 điểm/lease; không thinning vòng đầu |
| 7 | Multi-instance | Redis adapter + lifecycle pub/sub, Mongo authoritative + durable outbox; cần xác nhận Redis tier/connection budget và deployment topology trước rollout |
| 8 | CAS revoke | DELETE kèm leaseId + expectedRevision; chưa mặc định cho phép DELETE không điều kiện từ client |

Cần làm rõ “logout/app kill”: kill/offline không thể server phát hiện chắc chắn ngay lập tức.
Nếu yêu cầu auto-stop sớm hơn hard TTL khi mất kết nối, cần thêm heartbeat deadline riêng,
đánh đổi lease bị ngắt khi iOS background; không tự thêm cơ chế này.

## 9. Acceptance, rủi ro và rollback

- Hai server cùng Mongo replica set/Redis thật trong test integration: revoke ở node1,
  publish/read/watch ở node2; không chỉ mock local invalidator.
- Fake DB clock qua boundary consent/expiry; test TTL job không chạy mà access vẫn đóng.
- Race append/close/revoke/grant khác UUID; cùng UUID khác payload ->409; no duplicated point/event.
- Pause → grant SOS → đổi global privacy ở thiết bị khác → revoke không ghi đè privacy.
- Owner/viewer leave/remove, còn nhóm chung khác, join sau consent, overlap snapshot groups.
- App kill/offline/restart; replay terminal; granting-session logout không refreshToken;
  logout-all/password change/reuse revoke; session expired/revoked trên connected socket.
- Mất network sau commit; outbox duplicate; lease revision cũ; late packet; REST catch-up nhất quán.
- Không coordinates/token/SOS message trong log/metric labels; no APNs/FCM claim.
- Performance: DB guard/write per point và per-recipient authorization tốn I/O; cần đo p95,
  transaction conflicts, pool load, fanout, Redis connections, RSS với tải dự kiến trước production.
- Rollback: tắt riêng flag; ngừng grant/publish/watch SOS tạm và đóng watch; fail closed khi GET
  scope bị tắt. Không tự chuyển sang normal publish. Giữ lease/ledger cho retry và cleanup;
  bật lại không làm lease terminal active. One-shot SOS/chat/global privacy tiếp tục như cũ.

**Điểm dừng:** chỉ tạo Study/ghi tiến độ; chưa sửa source, API contract hiện hành hoặc env.
Chờ user duyệt mục 8 và execution plan trước L1.
