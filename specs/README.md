# Family Tracker Backend — specifications

`specs/` là nguồn chuẩn của **yêu cầu và thiết kế đã chấp thuận**. Code/tests là bằng chứng hành vi hiện tại, không tự trở thành phê duyệt sản phẩm. Khi khác nhau, ghi discrepancy và xin quyết định trước khi đổi hành vi. Tài liệu chia theo chức năng để mỗi bug hoặc enhancement chỉ cần đọc đúng phạm vi.

## Chọn chức năng để đọc và cập nhật

Đọc `spec.md` của chức năng trước, tiếp theo contracts/model và quyết định/câu hỏi liên quan. Mỗi entry spec có đường dẫn source và test hiện có. Không cần đọc toàn bộ inventory hay mọi feature mỗi lần làm việc.

| Chức năng / entry spec | Phạm vi sở hữu | Khi cần đối chiếu thêm |
|---|---|---|
| [authentication](features/authentication/spec.md) | Register/login, Google, JWT, refresh rotation, logout/password, User/RefreshSession/social account | Shared realtime, cache/revocation policy |
| [circles](features/circles/spec.md) | Create/join/list Circle, membership, leave/remove, Group | Chat membership, location/trail/SOS access |
| [chat](features/chat/spec.md) | Group/direct conversation, message, unread/read/typing, Conversation/Member/Message | Circles, upload, server-created SOS messages |
| [media-upload](features/media-upload/spec.md) | Presigned PUT, keys, MIME/extension/size, URL ownership | Chat owns persisted message/attachment DTOs |
| [location-sharing](features/location-sharing/spec.md) | Realtime GPS, offline batch, latest location/presence/stay alerts, pause/resume | History persistence, trail, SOS, digest privacy |
| [location-history](features/location-history/spec.md) | LocationHistory, today/range/cursor, journey/geometry/stay/moving | Location access/ingestion; trail is separate |
| [live-trail](features/live-trail/spec.md) | Projection, seq/revision, snapshot/watch/delta/reset, matching | Privacy, Circle membership, history |
| [sos](features/sos/spec.md) | Create/list/get/respond/close, audience, incident/response/outbox | Auth, Circle access, chat metadata, explicit location |
| [group-digests](features/group-digests/spec.md) | Interval settings, scheduler, snapshots/list/latest/retention | Circle membership, location privacy; Q-02 remains open |
| [favorite-places](features/favorite-places/spec.md) | Create/list, category/GeoJSON, FavoritePlace | Circle membership |

**Đã chấp thuận:** [REQ-CHAT-01](features/chat/decisions.md) giữ cuộc trò chuyện riêng 1–1 đã tạo sau khi hai người rời Circle. Giữ nguyên confirmation, acceptance criteria và phân biệt với điều kiện mở/get-or-create conversation. Các hành vi khác chỉ có nhãn Current behavior chưa được phê duyệt toàn bộ.

## Tính năng mở rộng — trạng thái theo từng phần

[Roadmap bản đồ/cảnh báo](system/mobility-roadmap.md) ghi yêu cầu người dùng ngày
2026-11-12 và các quyết định còn mở; [research](system/mobility-research.md) ghi
nguồn provider/OS. User xác nhận **push khi app đóng**, **Circle chia sẻ và tự nhận
diện nơi ở**, **xe máy ưu tiên kiểm chứng**, sau đó bổ sung **chọn xe máy/ô tô/đi bộ,
các tuyến thay thế**, **lịch sử tìm kiếm cache-only** và **không báo thời tiết bình thường**.
User đã duyệt cache mobile 20 mục/30 ngày và DB alert/delivery 7 ngày trong
[search decisions](features/place-search/decisions.md) và
[alert decisions](features/context-alerts/decisions.md). Lựa chọn provider, coverage và
API/model và các ngưỡng của những feature còn ở thiết kế chưa được chốt tại lượt
2026-11-12; cập nhật xác nhận mới 2026-11-13 được ghi ngay bên dưới.
Không hỏi duyệt lại các policy đã xác nhận. User đã xác nhận
và lượt đọc Mobile có mục tiêu xác minh **Swift/SwiftUI + Apple MapKit/iOS16**;
search/history đã được triển khai native Apple + local cache theo DEC-SEARCH-03
(user yêu cầu “Hãy hiện thực full chức năng đầu tiên đi”). Backend không có search
proxy mới; routing/weather/purpose/geofence vẫn là thiết kế chưa hiện thực.

| Feature / thiết kế | Phạm vi và trạng thái |
|---|---|
| [place-search](features/place-search/spec.md) | Native iOS MapKit search/history đã triển khai; 21 tests + Simulator build; device/coverage QA còn lại ở plan |
| [routing](features/routing/spec.md) | Chọn phương tiện/tuyến thay thế/traffic/active trip — Draft spec/plan/tasks |
| [context-alerts](features/context-alerts/spec.md) | Chỉ cảnh báo đáng chú ý, inbox/device/worker/push nền — alert DB/retention đã duyệt, chi tiết thiết kế còn Draft |
| [favorite-places extension](features/favorite-places/plan.md) | Backend CRUD/nhãn cá nhân + GPS presence snapshot đã hiện thực, 304 tests full-suite PASS; Mobile UI/device QA chưa thực hiện. [API handoff](../api-docs/PLACES_API_DOC.md) |

Không coi endpoint/file/model dự kiến trong plan là đã tồn tại. Chỉ triển khai sau
khi người dùng duyệt thiết kế/phạm vi liên quan.

**Tiếp tục làm rõ — 2026-11-13:** user yêu cầu lại cùng nhóm chức năng. Giữ owner
và các xác nhận cũ; không tạo spec tổng hợp hoặc coi đây là duyệt code toàn bộ.
[Interview nhiều vòng](system/mobility-interview.md) ghi câu hỏi thật,
13 đáp án của 3 vòng và Q-IDs gốc. Đã chốt Việt Nam trước, free-only/chưa bật
billing, dẫn đường từng ngã rẽ có giọng nói trong app, self-only khi bật riêng
lúc pause, nơi chung/nhãn cá nhân, creator/admin sửa/xóa, thêm dông/gió mạnh/nóng
bất thường, mưa 30 phút, delay 5 phút, quiet hours 22–07 trừ nguy hiểm, dwell
khoảng 2 phút, mất mạng tiếp tục tuyến đã tải và trial cá nhân/nội bộ. Provider
phù hợp và các chi tiết kỹ thuật còn cần research/thiết kế.
Stage/approval của các extension nằm ở
[routing progress](features/routing/progress.md),
[alerts progress](features/context-alerts/progress.md) và
[places progress](features/favorite-places/progress.md). User sau đó đã xác nhận hiện thực/commit/push tuần tự; saved-place function đã push, backend GPS presence đã verify và đang bàn giao riêng; routing chờ provider, weather tạm hoãn theo quyết định user;
search/history giữ trạng thái triển khai theo hồ sơ, chưa kiểm chứng Mobile lại.

## Tài liệu hệ thống dùng chung

| Tài liệu | Khi đọc |
|---|---|
| [architecture](system/architecture.md) | Layering, composition root, startup/shutdown, state và transaction boundaries |
| [configuration](system/configuration.md) | Flags, defaults, limits và validation cấu hình; không phải trạng thái deployment |
| [dependencies](system/dependencies.md) | Stack, external adapters và dữ liệu qua biên tích hợp |
| [API conventions](system/api-conventions.md) | Auth, ID/date, envelope, DTO/errors chung |
| [realtime](system/realtime.md) | Handshake, rooms, session:ready và reconnect/revocation |
| [model ownership](system/data-model.md) | Tìm feature sở hữu model; schema/index chi tiết nằm ở feature |
| [observability](system/observability.md) | Health, Swagger/socket-info, metrics/logs/traces, monitoring |
| [decisions](system/decisions.md) | Chính sách tài liệu/kiến trúc đã chấp thuận; product decision nằm ở feature |
| [discrepancy owner index](system/discrepancies.md) | Chọn owner của D/Q, tránh nhân bản record liên chức năng |
| [validation / Graphify workflow](system/validation.md) | Lệnh kiểm tra, giới hạn bằng chứng, graph freshness và cập nhật |
| [source inventory](system/source-inventory.md) / [JSON ledger](system/source-inventory.json) | Lượt khảo sát 218 file, read status và hash; dùng khi cần kiểm tra snapshot |
| [research](system/research.md), [survey history](system/survey-history.md), [reorganization](system/reorganization.md) | Lịch sử khảo sát/chuyển tài liệu; không cần đọc cho mọi bug |

## Trạng thái và nguồn thẩm quyền

| Nhãn | Ý nghĩa |
|---|---|
| Current behavior / CB | Xác minh từ source ở ngày khảo sát; đối chiếu revision khi thay đổi |
| Requirement / REQ | Ý định đã được yêu cầu/chấp thuận, có authority/date và acceptance criteria |
| Decision / DEC | Lựa chọn đã thống nhất; lựa chọn chưa duyệt phải ghi Proposed |
| Open question / Q | Chưa đủ thông tin hoặc chưa có quyết định; không tự suy thành contract |
| Discrepancy / D | Mâu thuẫn có bằng chứng hai phía, ảnh hưởng và trạng thái xử lý |

CB-01…CB-08 là ID phạm vi của lượt khảo sát cũ; một số bao phủ nhiều slice và nay được định tuyến tới feature tương ứng. Giữ nguyên REQ/DEC/D/Q, không đổi status khi chuyển tài liệu. Source survey ngày 2026-11-11 đã đọc 218 file; production/mobile/provider readiness không được suy ra từ kết quả đó.

## Workflow cho bug và tính năng mới

[AGENTS.md](../AGENTS.md#ai-collaboration-workflow--requirements-before-implementation)
là quy trình bắt buộc; mục này chỉ định tuyến tài liệu, không duy trì bộ quy tắc thứ hai.

**Đọc specs → hỏi/làm rõ theo vòng → chốt requirements → viết plan/tasks → user duyệt
→ implement → verify → api-docs + Study → cập nhật specs/progress.**

Repo đã tích hợp **Spec Kit chính thức 1.4.0**. Quy trình chi tiết và lệnh thực tế:
[hướng dẫn Spec Kit](../codex/spec-kit/README.md); bằng chứng setup:
[discovery/validation](system/spec-kit-setup.md). Chốt requirements với user trước
native plan; native tasks/analyze phải có trước khi xin duyệt implementation.
Giữ AWAITING_APPROVAL khi chưa có quyết định thật. Native convergence chạy sau
implementation/verification, chỉ append unmet tasks. Nhãn Current behavior của tài
liệu cũ không tự thay đổi vì cài công cụ.

1. Tìm owner hiện có. Feature mới dùng native `specs/NNN-name/`, đăng ký ở mục Native bên dưới; tạo spec rồi plan/tasks đúng giai đoạn. Owner `features/<tên>/` hiện có giữ nguyên, có thể chọn bằng `SPECIFY_FEATURE_DIRECTORY`. Không tạo folder mới cho mọi bug, không nhân đôi contract hay đọc toàn bộ specs mỗi lần.
2. Ghi câu hỏi/câu trả lời thật, acceptance IDs và nguồn xác nhận. Những lựa chọn chưa có câu trả lời là Open/Proposed; mâu thuẫn đi qua feature discrepancy/system owner index. Không biến code thành yêu cầu đã duyệt.
3. Plan phải cụ thể để user review: revision, phạm vi, file changes, lý do/đánh đổi, data/API/privacy/failure/compatibility, slices và verification. Chốt nơi bàn giao api-docs/Study hoặc N/A có lý do.
4. Chỉ bắt đầu code feature mới/thay đổi hành vi đáng kể sau khi requirements/plan của phạm vi đó được duyệt và blockers sản phẩm được giải quyết. Ghi approval/authority/date ở owner; dùng lại approval hợp lệ, không hỏi bắt đầu lần nữa. Bug nhỏ giữ accepted behavior/doc edits đã được yêu cầu dùng quy trình nhẹ.
5. Sau implementation, cập nhật owner docs, api-docs client-facing, Study giải thích, tasks/indexes/PROGRESS và evidence thật. Không để required docs thành công việc “sẽ viết nếu user muốn”. Không đổi status feature khác hoặc suy ra deployed từ test pass.

Trạng thái cho **thay đổi đang làm** theo [bảng lifecycle](../codex/spec-kit/README.md#lifecycle-và-recovery);
`progress.md` sở hữu stage và approval, `verification.md` sở hữu evidence. Đây không
phải lệnh đổi toàn bộ nhãn Current behavior/legacy task trong các feature đã có.
Giữ approval record một owner; plan/spec link tới record thay vì lặp lại câu trả lời.

## Templates và đầu ra

Feature mới dùng native `.specify/templates/*` được compose với preset
`backend-policy`; không chép template thủ công thay cho native specify/plan/tasks.
Các template spec/plan/tasks trong bảng dưới giữ cho legacy/small changes. Interview,
verification và progress là bổ sung của repo, không phải tên command native.

| Artifact | Template / điểm đọc | Output |
|---|---|---|
| Requirements, câu hỏi, acceptance | [spec](_templates/spec.md) | `features/<feature>/spec.md` |
| Thiết kế để user duyệt | [plan](_templates/plan.md) | `features/<feature>/plan.md` |
| Công việc và evidence | [tasks](_templates/tasks.md) | `features/<feature>/tasks.md` |
| Frontend/mobile integration | [API template](_templates/api-doc.md), [index](../api-docs/README.md) | `api-docs/<file>.md` khi có backend interface |
| Giải thích cho con người | [Study template](_templates/study.md), [index](../Study/README.md) | `Study/<file>.md` cho feature đáng kể |
| Gửi một ý tưởng mới | [prompt tùy chọn](_templates/feature-request.md) | Chat; không bắt user điền form kỹ thuật |
| Câu hỏi qua nhiều vòng | [interview](_templates/interview.md) | Feature `interview.md`, chỉ câu hỏi thực |
| Kết quả kiểm chứng | [verification](_templates/verification.md) | Feature `verification.md`, commands/results/limits |
| Stage và human approvals | [progress](_templates/progress.md) | Feature `progress.md`, một owner |

## Native Spec Kit features

Chưa tạo feature ứng dụng mới trong lượt setup công cụ. Đăng ký từng feature
`NNN-name` tại đây khi có yêu cầu thật; ghi rõ trạng thái, owner và links. Không
chuyển hàng loạt các feature ở `features/` hoặc lấy fixture dry-run làm feature thật.

## Graph và điều hướng source

Đọc `graphify-out/backend/GRAPH_REPORT.md`, query có `--graph graphify-out/backend/graph.json`, rồi xác minh source. Graph này là local AST của 136 file `src`; matching commit chưa đủ nếu working tree đổi. Cách so sánh inventory và tạo lại bằng Graphify chính thức nằm trong [validation](system/validation.md). Không chỉnh tay generated graph, không gửi source/secrets ra dịch vụ ngoài. Chỉ refresh sau code changes khi workflow/yêu cầu đòi hỏi.

`npm run context:skeleton`, `context:trace` và `context:graph` là công cụ local riêng; static imports không mô tả đầy đủ runtime DI hoặc permissions. Không cần tạo lại Graphify khi chỉ chuyển tài liệu.
