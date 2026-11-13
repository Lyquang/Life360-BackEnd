# Tìm tuyến đường và đánh giá giao thông

Status: **Draft design — not implemented** | Date: 2026-11-12.
Authority: [REQ-MOB-02/03/05/08/11](../../system/mobility-roadmap.md). Xe máy ưu tiên kiểm chứng;
yêu cầu mới mở rộng **chọn xe máy/ô tô/đi bộ và các tuyến thay thế**. Intent được yêu cầu;
contract, lifecycle và acceptance sau là Proposed.
[Plan](plan.md) · [Tasks](tasks.md).

## Phạm vi và giới hạn

Từ origin/destination và phương tiện, trả tuyến/alternatives nếu có, distance/ETA,
traffic summary và đoạn chậm được provider hỗ trợ. Chọn Bắt đầu chuyến mới giám sát
traffic nền qua [context alerts](../context-alerts/spec.md). Không đoán tương lai
từ Live Trail; không dùng dữ liệu user khác để tự tính traffic.
UI cho chọn phương tiện trước preview; chỉ hiển thị các tuyến provider thật sự trả.
Những mode khác như xe đạp/bus chưa được chốt chỉ từ dấu “...” của yêu cầu.

Preview + trip monitoring là đề xuất bản đầu. Full voice turn-by-turn/navigation SDK,
offline navigation và dự đoán lộ trình thường đi chưa nằm trong bản thiết kế này;
cần người dùng duyệt ranh giới Q-MOB-06.

## Current behavior

Existing matcher tái dựng đường đã đi, không phải route planner. Không có active trip
hoặc traffic provider. Không sửa lịch sử/LiveTrail thành route plan.

## Acceptance dự thảo

- AC-ROUTE-01: User chọn điểm xuất phát/đích và mode; có tuyến thì map hiển thị geometry đúng encoding, distance mét, duration giây, nguồn và thời điểm dữ liệu. Không có tuyến phải phân biệt với provider lỗi.
- AC-ROUTE-02: ETA traffic và baseline chỉ so sánh cùng route/mode/departure context. Thiếu traffic → `unavailable`, không hiển thị đường xanh hoặc delay=0 như đã biết.
- AC-ROUTE-03: Tuyến xe máy không dùng tuyến ô tô âm thầm. Unsupported mode/region trả lý do và lựa chọn thay thế rõ; mobile không tự đổi phương tiện.
- AC-ROUTE-04: Preview không tạo background tracking. Start có request ID idempotent; một user chỉ một active trip đề xuất; route revision dùng để loại cập nhật/alert cũ.
- AC-ROUTE-05: End/cancel/expiry và privacy-disable dừng theo dõi theo policy đã duyệt. GPS stale/off-route không tiếp tục mô tả người dùng đang trên tuyến cũ.
- AC-ROUTE-06: Chỉ chủ user được đọc/sửa trip; Circle không tự thấy destination/trip. Không dùng route biết trước của thành viên để gửi cảnh báo cho người khác.
- AC-ROUTE-07: App đóng vẫn có thể nhận traffic push cho active trip nếu server có context hợp lệ; không phụ thuộc socket. Dừng cảnh báo khi context/notification hết hạn.
- AC-ROUTE-08: Mode xe máy/ô tô/đi bộ có lựa chọn rõ; đổi mode invalidate tuyến/ETA/traffic cũ và recompute. Backend nhận mode bắt buộc, không để provider tự mặc định ô tô.
- AC-ROUTE-09: Cho so sánh/chọn route alternatives thật theo ETA/khoảng cách/traffic có dữ liệu. Một tuyến vẫn là kết quả hợp lệ; không sinh tuyến giả cho đủ số option. Chỉ mode hỗ trợ traffic mới có cảnh báo kẹt xe, không áp dụng delay ô tô cho đi bộ.

## Open decisions

Mode/vùng hỗ trợ, mức chỉ dẫn trong app, trip expiry/arrival rule, traffic thresholds,
reroute UX và retention: [Q-MOB-01/02/03/05/06](../../system/mobility-roadmap.md).
Tìm tuyến và cảnh báo không được mô tả là cam kết thời gian đến chính xác.
