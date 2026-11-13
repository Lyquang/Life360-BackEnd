# Cảnh báo mưa và kẹt xe, có push khi app đóng

Status: **Draft design — not implemented** | Date: 2026-11-12.
Authority: [REQ-MOB-01/02/05/09](../../system/mobility-roadmap.md).
User đã yêu cầu push khi app đóng; các rules/thresholds/contracts là Proposed.
[Plan](plan.md) · [Tasks](tasks.md) · [Accepted decisions](decisions.md).

## Phạm vi

Weather forecast tại vị trí đủ mới → rule mưa gần hạn → cảnh báo riêng người dùng.
Traffic của [chuyến đi đã bắt đầu](../routing/spec.md) → rule chậm/ùn tắc → cảnh báo
riêng chủ trip. Có inbox phục hồi, foreground update và push nền độc lập Socket.IO.
Không gửi weather/traffic của người này cho Circle; sharing nơi ở là favorite-places.

**Đã yêu cầu:** chỉ thông báo khi có hiện tượng/điều kiện đáng chú ý; trời bình
thường/nắng đẹp không tạo notification. “Hiện tượng lạ” chưa chốt danh sách hoặc
ngưỡng; mưa sắp tới thuộc intent ban đầu, dông/gió mạnh/nóng bất thường là đề xuất
mở rộng cần duyệt riêng. Không tự mở rộng thành bản tin thời tiết hằng ngày.

**Đã chấp thuận DEC-ALERT-01, chưa triển khai:** DB giữ alert thực sự được tạo và trạng thái
gửi tối thiểu để chống trùng/phục hồi/xem lại; không lưu mọi weather poll, raw
forecast hoặc notification “trời đẹp”. Dữ liệu upstream dùng cache có TTL khi được
phép. Retention alert/delivery 7 ngày đã được duyệt bằng câu “Tôi đồng ý với đề xuất
của bạn” sau đề xuất cụ thể, không phải suy từ câu hỏi DB ban đầu.

Không coi dự báo là sự thật chắc chắn, không dùng LLM tự phán mưa/kẹt xe. Route-wide
weather theo thời gian đến từng đoạn là phase mở rộng, chưa thuộc bản đầu chỉ cảnh
báo mưa tại vị trí hiện tại. Không bỏ push khỏi scope để gọi bản foreground là hoàn tất.

## Current behavior

Backend không có weather service, push adapter/device registry hoặc inbox cảnh báo
loại này. SOS có transactional outbox riêng với authorization/lifecycle riêng;
không tái sử dụng collection/job SOS làm kho cảnh báo weather/traffic.

## Acceptance dự thảo

- AC-ALERT-01: Forecast còn hiệu lực và vị trí đủ mới, rule đạt ngưỡng → lưu một logical alert có source, forecast window, generatedAt/expiresAt và nội dung có điều kiện. Thiếu forecast không suy thành trời không mưa.
- AC-ALERT-02: Traffic alert cần active trip đúng owner/revision và dữ liệu cho phương tiện đã chọn có hỗ trợ. Không có trip hoặc traffic unknown → không suy ra sắp kẹt xe. Không áp delay ô tô cho đi bộ.
- AC-ALERT-03: Cùng alert không nhân bản trong inbox khi retry/multiple workers. Có cooldown, expiry và quiet hours; không phát lại forecast đã cũ sau reconnect.
- AC-ALERT-04: Đã cấp quyền notification và có context hợp lệ, app background/khóa màn hình có thể nhận visible push từ worker dù không có socket. Cần device E2E; provider accepted không đồng nghĩa đã hiển thị/đọc.
- AC-ALERT-05: GPS quá cũ/quyền bị rút/paused theo policy → dừng location-dependent evaluation; UI ghi unknown. Inbox chỉ owner; push generic không có tọa độ hay địa chỉ Nhà/Công ty trên màn hình khóa mặc định.
- AC-ALERT-06: Device registration/rotation/logout xử lý đúng owner và installation; token invalid loại bỏ. Không gửi alert tài khoản cũ khi đổi account trên máy.
- AC-ALERT-07: End trip, reroute, disable preference, hết hạn hoặc mất quyền trước dispatch → bỏ pending event cũ. Retry bounded, lease an toàn, worker restart không bỏ mất durable work.
- AC-ALERT-08: Weather/traffic outage không làm fail GPS/chat/SOS; có timeout/quota/circuit-breaker, hiển thị unavailable, metrics không lộ GPS/tokens. Luồng GPS không chờ provider hoàn thành.
- AC-ALERT-09: Bình thường/nắng đẹp/không đạt rule → không ContextAlert/PushDelivery/notification mới. Poll lại cùng đợt hiện tượng không tạo một thông báo mỗi lần; chỉ mới/escalation hợp lệ theo rule được duyệt mới tạo alert. Quiet hours không làm sinh bản tin bình thường.
- AC-ALERT-10: Cải thiện/hết mưa/hết kẹt không tự gửi push “trở lại bình thường”. Có thể đóng/expire cảnh báo hiện có trong inbox; missing data/outage không được coi là hiện tượng đã kết thúc.

## Proposed copy

Ví dụ dữ liệu minh họa: “Khu vực bạn đang ở có khả năng mưa trong 30 phút tới”;
“Tuyến đã chọn đang có dấu hiệu đông xe, dự kiến chậm thêm khoảng 8 phút”. Chỉ dùng
con số khi provider/rule hỗ trợ. Lock-screen default: “Có cập nhật cho hành trình
của bạn”; mở app mới đọc chi tiết sau xác thực/freshness check.

## Quyết định còn mở

Q-MOB-02/03/05: provider/budget, self-only location khi pause, ngưỡng/quiet hours/
retention và monitoring cadence; Q-MOB-08 về DB alert tối thiểu và loại hiện tượng. Native permissions/push certificates và deployment
worker là dependency bắt buộc. Không cam kết lấy GPS mới khi user force-stop app.
