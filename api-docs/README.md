# API integration — điểm bắt đầu cho frontend/mobile

`api-docs/` mô tả **cách nối các interface backend đã hiện thực**. Yêu cầu/thiết kế
đã chấp thuận nằm ở [specs](../specs/README.md), contract thuộc feature sở hữu;
code/tests là bằng chứng implementation. Tài liệu client không tự phê duyệt behavior
mới hoặc chứng minh API đã được deploy. Nếu các nguồn khác nhau, ghi discrepancy.

## Tài liệu đang có

| Nhu cầu | Hướng dẫn |
|---|---|
| Toàn chuỗi Location | [Mobile location index](MOBILE_LOCATION_INTEGRATION_INDEX.md) |
| Gửi GPS realtime và batch offline | [Location update](LOCATION_UPDATE_API_DOC.md) |
| History/journey/geometry | [Journey routes](JOURNEY_ROUTE_API_DOC.md) |
| Snapshot/watch/delta/reset của Live Trail | [Live Trail](LIVE_TRAIL_API_DOC.md) |
| Pause/chia sẻ vị trí và Circle membership | [Privacy and membership](PRIVACY_AND_CIRCLE_MEMBERSHIP_API_DOC.md) |
| SOS incident/assistance/recovery | [SOS assistance](SOS_ASSISTANCE_API_DOC.md) |

Đây là mục lục các tài liệu hiện có, không phải lần kiểm chứng lại mọi nội dung hay
deployment. Auth/media và các feature khác được định tuyến tại specs/README.md;
khi chạm chúng, giữ một tài liệu integration sở hữu chính và cập nhật link ở đây,
không sao chép toàn bộ hướng dẫn cũ sang folder mới một cách máy móc.

## Khi agent hoàn thành feature

1. Với API/event client-facing mới hoặc đổi behavior, tạo/cập nhật file đã nêu trong plan ở folder này, theo [template](../specs/_templates/api-doc.md).
2. Ghi spec/contract/source revision, trạng thái implemented/verified/deployed thật; nêu config/flag ảnh hưởng khả năng sử dụng.
3. Mô tả auth/quyền, request/response/error, field required/optional/null/units, luồng gọi, pagination/retry/idempotency và realtime recovery **khi có liên quan**.
4. Dùng ví dụ tổng hợp đã đối chiếu code/tests; không dùng token, GPS hoặc hồ sơ thật. Không trình bày API Proposed như đã chạy.
5. Đồng bộ owner contract/Swagger/socket docs, index này và tasks/progress trong cùng thay đổi. Client đọc được một flow hoàn chỉnh thay vì phải đoán từ danh sách endpoint.

Feature nội bộ/native-only có thể không có interface backend. Khi đó ghi **API
handoff: N/A** và lý do tại owner plan/kết quả bàn giao; không tạo API giả cho đủ
checklist. Các tài liệu cũ chỉ cập nhật đúng phạm vi feature được yêu cầu.
