# Tìm kiếm địa điểm trên bản đồ

Status: **Implemented native iOS search/history; backend API unchanged** | Date: 2026-11-12.
Authority: [REQ-MOB-03/10/12](../../system/mobility-roadmap.md). Search và lịch sử cache-only đã được yêu cầu;
DEC-SEARCH-03 cho phép implementation sau giai đoạn design-only. Các ngưỡng/provider
của routing/weather khác không nằm trong approval này.
[Plan](plan.md) · [Tasks](tasks.md) · [Accepted decisions](decisions.md) · [Provider research](../../system/mobility-research.md).

## Phạm vi

Autocomplete theo chuỗi nhập, chọn detail, tìm POI mới bằng từ khóa/nearby, hỗ trợ
tiếng Việt; kết quả có attribution và định vị trên bản đồ theo chính sách provider.
Không tạo POI database riêng. **Có lịch sử tìm kiếm bằng cache, không lưu DB**
theo ràng buộc user 2026-11-12. DEC-SEARCH-01 đã chấp thuận cache mobile theo tài khoản,
20 mục/30 ngày, xóa và không sync nhiều máy bản đầu; đã triển khai trong Mobile.
Chuyển kết quả cho [routing](../routing/spec.md) hoặc [favorite places](../favorite-places/plan.md).

## Hiện trạng

Chưa có search/geocoding adapter hoặc API trong backend. Existing Circle places
là dữ liệu đã lưu của nhóm, không phải danh mục địa điểm toàn cầu. User đã xác nhận
và lượt đọc có mục tiêu đã kiểm chứng mobile dùng **Swift/SwiftUI + Apple MapKit**,
iOS 16; không phải React Native hoặc Google Maps. [Plan cập nhật](plan.md) đề xuất
search native Apple và history local; không cần backend proxy cho slice đầu.
Search native hiện đã được triển khai và build/test; xem [implementation evidence](plan.md).
Không claim đã đọc toàn bộ Mobile hoặc đã kiểm thử thiết bị thật.

## Luồng UI đề xuất

Search bar → gợi ý theo query và vị trí bias tùy quyền → chọn → detail sheet có
tên/địa chỉ/vị trí/nguồn → Chỉ đường hoặc Lưu vào Circle. Query mới hủy/loại response
cũ. Khi không có GPS, vẫn search được và có thể đặt vùng tìm bằng tay. Focus search
hiện mục gần đây từ cache, xóa từng mục/xóa hết; cache mất thì danh sách rỗng vẫn hợp lệ.

## Acceptance cho native search slice

- AC-SEARCH-01: Query đủ điều kiện chỉ gửi sau debounce đề xuất 300ms; query rỗng xóa suggestions; response cũ không ghi đè query mới. Giới hạn đề xuất 2–200 ký tự, tối đa 10 items.
- AC-SEARCH-02: Native Apple path resolve selected completion qua MKLocalSearch và map sang model thuần Swift; không dùng Google session/placeId semantics. Kết quả có source/attribution phù hợp; không mở provider URL tùy ý hoặc dùng completion cũ sau query mới.
- AC-SEARCH-03: Có thể tìm “cafe gần…” hoặc nearby từ vùng chọn; không có kết quả khác với lỗi/429/timeout. Search không phụ thuộc membership Circle.
- AC-SEARCH-04: Native request bounded/cancel được, throttling/error có trạng thái rõ; history cách ly account. Không cần backend auth/search endpoint cho gọi MapKit native; không lộ query/GPS/raw error. Saved Circle place vẫn qua API auth hiện có.
- AC-SEARCH-05: Không auto-broadcast query/nơi vừa tìm hoặc tự tạo Circle place. Slice đầu chỉ chọn/focus pin; action Lưu/purpose đi theo feature favorite-places, không đặt nút giả.
- AC-SEARCH-06: UI có trạng thái loading/no-results/offline/error, attribution và ngôn ngữ phù hợp; search không yêu cầu quyền background.
- AC-SEARCH-07: Lịch sử chỉ ghi cache khi submit tìm kiếm/chọn kết quả, không mỗi keystroke; bounded/TTL/dedup, tài khoản cách ly, có xóa. Không có collection, DB write hay fallback DB khi cache unavailable.
- AC-SEARCH-08: History replay lấy lại dữ liệu POI/tuyến mới khi cần; không dùng detail/ETA cũ như dữ liệu hiện tại. Không dùng chung history với địa điểm Circle đã lưu.

## Câu hỏi

Maps nền đã xác minh là Apple MapKit; đề xuất dùng MKLocalSearchCompleter/MKLocalSearch
ngay mobile cho search. Cập nhật 2026-11-13: user chọn Việt Nam trước và thử
nghiệm miễn phí/chưa billing theo REQ-MOB-14/15. Coverage thực và provider/quota
của routing/weather vẫn cần P0; không thay native search chỉ từ yêu cầu mới. Nearby/text search có sẵn trong scope; cần kiểm tra
region/POI availability iOS 16. DEC-SEARCH-03 đã cho phép sửa Mobile cho search/history; phạm vi khác vẫn theo plan
riêng. Country/device coverage là QA tiếp theo, không khẳng định từ build hoặc smoke.
Q-MOB-07 về vị trí cache/retention đã được DEC-SEARCH-01 giải quyết; còn kiểm tra
thư viện/lifecycle mobile. Thiết kế DB search history bị loại.
