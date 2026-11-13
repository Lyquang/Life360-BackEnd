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
thường/nắng đẹp không tạo notification. Vòng hỏi 2026-11-13 xác nhận thêm dông,
gió mạnh và nắng nóng bất thường cùng mưa sắp tới/mưa lớn (REQ-MOB-19). Cửa sổ
cảnh báo sắp mưa là **30 phút tới** (REQ-MOB-20), khi nguồn đủ chi tiết và đạt rule;
không cam kết thời điểm mưa chính xác. Ngưỡng mức độ/xác suất, nguồn từng loại,
cooldown còn cần chốt. Quiet hours là 22:00–07:00, trừ cảnh báo nguy hiểm được nguồn/rule xác định (REQ-MOB-23). Không tự thêm bản tin hằng ngày.

**Đã chấp thuận DEC-ALERT-01, chưa triển khai:** DB giữ alert thực sự được tạo và trạng thái
gửi tối thiểu để chống trùng/phục hồi/xem lại; không lưu mọi weather poll, raw
forecast hoặc notification “trời đẹp”. Dữ liệu upstream dùng cache có TTL khi được
phép. Retention alert/delivery 7 ngày đã được duyệt bằng câu “Tôi đồng ý với đề xuất
của bạn” sau đề xuất cụ thể, không phải suy từ câu hỏi DB ban đầu.

Không coi dự báo là sự thật chắc chắn, không dùng LLM tự phán mưa/kẹt xe. Route-wide
weather theo thời gian đến từng đoạn là phase mở rộng, chưa thuộc bản đầu chỉ cảnh
báo mưa tại vị trí hiện tại. Không bỏ push khỏi scope để gọi bản foreground là hoàn tất.

**Ràng buộc mới 2026-11-13:** Việt Nam trước, chỉ thử nghiệm miễn phí/chưa bật
billing (REQ-MOB-14/15). Khi pause Circle, chỉ đánh giá vị trí cho dịch vụ riêng
nếu user bật riêng (REQ-MOB-16); không phát GPS/nhãn cho Circle qua đường này.
Không có consent riêng, mất quyền OS hoặc context quá cũ thì không tiếp tục lấy
vị trí cũ làm hiện tại. Backend chưa có luồng self-only này.

## Clarifications

### Session 2026-11-13

- Q: Q-MOB-01, vùng phục vụ? → A: Việt Nam trước; [record](../../system/mobility-interview.md#q-mob-01).
- Q: Q-MOB-02, ngân sách? → A: Chỉ gói miễn phí, chưa bật tính phí; [record](../../system/mobility-interview.md#q-mob-02).
- Q: Q-MOB-03, pause và cảnh báo riêng? → A: Tiếp tục nếu bật riêng, vẫn ẩn với Circle; [record](../../system/mobility-interview.md#q-mob-03).
- Q: Q-MOB-08, các hiện tượng? → A: Thêm dông, gió mạnh và nắng nóng bất thường; [record](../../system/mobility-interview.md#q-mob-08).
- Q: Q-MOB-05a, cửa sổ sắp mưa? → A: Trong 30 phút tới; [record](../../system/mobility-interview.md#q-mob-05a).
- Q: Q-MOB-05b, ngưỡng chậm tuyến? → A: Từ 5 phút, với traffic hợp lệ đúng mode/tuyến/context (REQ-MOB-22); [record](../../system/mobility-interview.md#q-mob-05b).
- Q: Q-MOB-05c, ban đêm? → A: Im lặng 22:00–07:00 trừ cảnh báo nguy hiểm (REQ-MOB-23); [record](../../system/mobility-interview.md#q-mob-05c).
- Q: Q-MOB-02a, trial hay thương mại? → A: Cá nhân/nội bộ, chưa thương mại (REQ-MOB-25); [record](../../system/mobility-interview.md#q-mob-02a).

## Current behavior

Backend không có weather service, push adapter/device registry hoặc inbox cảnh báo
loại này. SOS có transactional outbox riêng với authorization/lifecycle riêng;
không tái sử dụng collection/job SOS làm kho cảnh báo weather/traffic.

## Acceptance dự thảo

- AC-ALERT-01: Forecast còn hiệu lực và vị trí đủ mới, rule đạt ngưỡng → lưu một logical alert có source, forecast window, generatedAt/expiresAt và nội dung có điều kiện. Thiếu forecast không suy thành trời không mưa.
- AC-ALERT-02: Traffic alert cần active trip đúng owner/revision, dữ liệu hỗ trợ phương tiện đã chọn và dự kiến chậm thêm ít nhất 5 phút so với baseline cùng route/mode/context (REQ-MOB-22). Không có trip hoặc traffic unknown → không suy ra sắp kẹt xe. Không áp delay ô tô cho đi bộ.
- AC-ALERT-03: Cùng alert không nhân bản trong inbox khi retry/multiple workers. Trong quiet hours 22:00–07:00 không phát cảnh báo thường; chỉ ngoại lệ nguy hiểm với severity được nguồn/rule xác định (REQ-MOB-23). Không phát bù cảnh báo đã stale/expired sau quiet hours. Có cooldown, expiry và quiet hours; không phát lại forecast đã cũ sau reconnect.
- AC-ALERT-04: Đã cấp quyền notification và có context hợp lệ, app background/khóa màn hình có thể nhận visible push từ worker dù không có socket. Cần device E2E; provider accepted không đồng nghĩa đã hiển thị/đọc.
- AC-ALERT-05: GPS quá cũ/quyền OS hoặc personal-location consent bị rút → dừng location-dependent evaluation; UI ghi unknown. Pause Circle không tự tắt dịch vụ riêng nếu user bật riêng, nhưng không được lộ GPS/nhãn cho Circle. Inbox chỉ owner; push generic không có tọa độ hay địa chỉ Nhà/Công ty trên màn hình khóa mặc định.
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

Provider/quota miễn phí và coverage, nguồn/ngưỡng từng hiện tượng và mức nguy hiểm, cooldown,
freshness/monitoring cadence, lifecycle consent riêng còn mở. DB alert/delivery
retention 7 ngày, loại hiện tượng, cửa sổ 30 phút, delay 5 phút và quiet hours đã xác nhận; không hỏi lại.
Xem [interview](../../system/mobility-interview.md) và [progress](progress.md). Native permissions/push certificates và deployment
worker là dependency bắt buộc. Không cam kết lấy GPS mới khi user force-stop app.
