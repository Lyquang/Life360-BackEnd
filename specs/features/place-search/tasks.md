# Tasks: Place search

[Spec](spec.md) · [Plan](plan.md) · [Accepted decisions](decisions.md).
Native MapKit search/history đã triển khai theo DEC-SEARCH-03, thay thế quyết
định chỉ thiết kế trước đó. Evidence/tests và QA còn lại trong plan và Mobile .spec/013.

- [x] SEARCH-T01 Ghi hiện trạng, UX, ownership và acceptance; DEC-SEARCH-03 đã cho phép implementation.
- [ ] SEARCH-T02 Chốt search coverage/region/POI/iOS16 availability và lưu dữ liệu Apple; map đã biết là MapKit, không hỏi chọn lại Google Maps.
- SEARCH-T03 — Superseded cho iOS slice đầu: backend port/use cases/adapter chỉ xem lại nếu sau này cần server-side search.
- SEARCH-T04 — Superseded cho iOS slice đầu: không tạo backend /map-search routes/DTO/Swagger hoặc Mongo history; đây không phải phần cần làm cho native search.
- [x] SEARCH-T05 Mobile search bar/debounce/cancellation/detail/actions, maps attribution; AC-SEARCH-01/05/06 trong mobile repo được chỉ định.
- [ ] SEARCH-T06 Thử coverage bằng dữ liệu tổng hợp được phép; ghi kết quả/cost, cập nhật docs/progress và trạng thái thực tế.
- [x] SEARCH-T07 Ghi yêu cầu history cache-only, loại trừ Mongo/fallback DB và phân biệt saved Circle places.
- [x] SEARCH-T08 Triển khai policy cache đã duyệt DEC-SEARCH-01 trong mobile repo: TTL/limit/dedup/clear/account isolation, AC-SEARCH-07/08; không tự thêm Redis sync.
- [x] SEARCH-T09 Test cache loss/corruption/expiry/logout/offline và fetch lại POI; không cache detail provider ngoài quyền cho phép.
- [x] SEARCH-T10 Ghi confirmation DEC-SEARCH-01; Q-MOB-07 resolved về mobile cache/20 mục/30 ngày; map sau đó xác minh là Apple, country coverage vẫn mở.
- [x] SEARCH-T11 Đối chiếu Mobile chỉ đọc, MapKit/SwiftUI/iOS16 và entry/DI/coordinator/cache; sửa plan native thay backend proxy. T10 là trạng thái trước khi nhận platform evidence mới.
- [x] SEARCH-T12 Đã nhận quyết định phạm vi: user chỉ muốn thiết kế, chưa sửa Mobile (DEC-SEARCH-02). Sau đó user yêu cầu implementation: DEC-SEARCH-03 supersedes design-only cho feature này.
- [x] SEARCH-T13 Native Domain protocols/use cases, Core MapKit/Data adapters và search VM/UI/coordinator theo plan; không import MapKit vào Domain.
- [x] SEARCH-T14 Test fake-provider search/cancel/stale/selection, local history và localization vi/en; device coverage riêng. DEC-SEARCH-03 đã cho phép local build/test; 21 tests và Simulator build đạt. Device QA riêng.

T05/T08/T09/T13/T14 đã thực hiện và verified bằng executable tests/build. SEARCH-T02
và T06 còn phần target-country/live device coverage/Apple storage review cho các
luồng lưu POI sau này; không phải backend proxy đang chờ viết. Không suy đoán quốc
gia hoặc claim physical-device UI QA đã chạy. SEARCH-T03/04 là not applicable cho
slice native, không được tạo code vô ích để đánh dấu checkbox.
