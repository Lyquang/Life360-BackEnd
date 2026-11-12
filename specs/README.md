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

1. Chọn feature ở bảng trên; đọc spec/contracts/model và record liên quan. Đọc graph report backend, kiểm tra commit/hash trước khi truy vấn sâu. Chỉ theo dependency bị ảnh hưởng.
2. Đối chiếu yêu cầu với source/tests. Ghi discrepancy tại feature sở hữu; quy tắc chung hoặc rollout nhiều feature đi qua system owner index. Không sửa code hay requirement âm thầm để che mâu thuẫn.
3. Với feature hiện có, cập nhật trong folder đó. Feature mới có folder rõ nghĩa dưới `features/`. Dùng [_templates/spec.md](_templates/spec.md) khi cần; không tạo folder rỗng hoặc nhân bản quy tắc/model chung.
4. Ghi intent/acceptance và authority; thay đổi đáng kể mới thêm plan/tasks cụ thể, dùng [_templates/plan.md](_templates/plan.md) và [_templates/tasks.md](_templates/tasks.md). Bug nhỏ chỉ cần note đúng phạm vi.
5. Với thay đổi chạm nhiều chức năng, cập nhật tài liệu từng owner và liên kết dependency. Circle exit liên quan group chat, location/trail và SOS; pause liên quan ingestion/history/trail và digest.
6. Kiểm chứng acceptance bằng test phù hợp, cập nhật kết quả/giới hạn và `PROGRESS.md`. Không biến test pass thành phê duyệt mọi hành vi. Không ghi secrets hoặc dữ liệu production vào docs.

## Graph và điều hướng source

Đọc `graphify-out/backend/GRAPH_REPORT.md`, query có `--graph graphify-out/backend/graph.json`, rồi xác minh source. Graph này là local AST của 136 file `src`; matching commit chưa đủ nếu working tree đổi. Cách so sánh inventory và tạo lại bằng Graphify chính thức nằm trong [validation](system/validation.md). Không chỉnh tay generated graph, không gửi source/secrets ra dịch vụ ngoài. Chỉ refresh sau code changes khi workflow/yêu cầu đòi hỏi.

`npm run context:skeleton`, `context:trace` và `context:graph` là công cụ local riêng; static imports không mô tả đầy đủ runtime DI hoặc permissions. Không cần tạo lại Graphify khi chỉ chuyển tài liệu.
