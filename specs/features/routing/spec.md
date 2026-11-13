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

**Đã xác nhận 2026-11-13, REQ-MOB-13/14/15:** Việt Nam trước; dẫn đường từng
ngã rẽ có giọng nói ngay trong app; thử nghiệm gói miễn phí, chưa bật tính phí.
Preview + trip monitoring trong plan cũ chưa đủ phạm vi mới. Provider, coverage
xe máy/traffic và quota chưa chọn; chưa chứng minh một giải pháp đáp ứng mọi ràng
buộc. Khi mất mạng tiếp tục tuyến đã tải còn hợp lệ và báo giới hạn dữ liệu mới
(REQ-MOB-21); chưa yêu cầu offline reroute hoặc dự đoán lộ trình thường đi.
Không tự thay yêu cầu in-app bằng mở app bản đồ khác.

REQ-MOB-16: pause Circle vẫn cho dịch vụ riêng dùng vị trí nếu user bật riêng;
không lộ GPS, destination hoặc nhãn nơi ở cho Circle qua luồng này. Đây là yêu cầu
mở rộng chưa hiện thực, không khẳng định pause hiện tại đã có self-only context.

## Clarifications

### Session 2026-11-13

- Q: Q-MOB-01, vùng phục vụ? → A: Việt Nam trước; [record](../../system/mobility-interview.md#q-mob-01).
- Q: Q-MOB-02, ngân sách upstream? → A: Gói miễn phí, chưa bật tính phí; [record](../../system/mobility-interview.md#q-mob-02).
- Q: Q-MOB-06, mức chỉ đường? → A: Từng ngã rẽ và giọng nói trong app; [record](../../system/mobility-interview.md#q-mob-06).
- Q: Q-MOB-03, dịch vụ riêng khi pause? → A: Tiếp tục nếu bật riêng, ẩn với Circle; [record](../../system/mobility-interview.md#q-mob-03).
- Q: Q-MOB-06a, mất mạng? → A: Tiếp tục tuyến đã tải, báo giới hạn dữ liệu mới; [record](../../system/mobility-interview.md#q-mob-06a).
- Q: Q-MOB-02a, trial hay thương mại? → A: Cá nhân/nội bộ, chưa thương mại (REQ-MOB-25); [record](../../system/mobility-interview.md#q-mob-02a).

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

- AC-ROUTE-10 (REQ-MOB-13): Với mode/tuyến được hỗ trợ và context hợp lệ, bắt đầu chuyến cho chỉ dẫn từng ngã rẽ và giọng nói ngay trong app. Chỉ vẽ tuyến/ETA hoặc chuyển sang app khác chưa đáp ứng. Offline continuation theo AC-ROUTE-12; reroute/audio/background lifecycle còn cần chốt.
- AC-ROUTE-11 (REQ-MOB-15): Không bật tính phí hoặc tự chuyển dịch vụ trả tiền khi hết quota. Thiếu khả năng cung cấp dữ liệu hợp lệ phải hiển thị unavailable/lý do; không giả tuyến xe máy hoặc traffic.
- AC-ROUTE-12 (REQ-MOB-21): Mất mạng khi chuyến đang active không tự xóa tuyến đã tải còn hợp lệ; tiếp tục chỉ dẫn từ dữ liệu sẵn có và hiển thị giới hạn dữ liệu mới. Không giả có traffic mới hoặc offline reroute khi chưa được hỗ trợ.

## Open decisions

Intent Việt Nam/free-only/in-app voice và self-only khi pause đã được trả lời.
Mode/coverage thực, provider/quota, expiry/arrival, traffic severity/freshness (delay 5 phút đã có REQ-MOB-22),
reroute/voice/background lifecycle và retention còn cần chốt; offline continuation đã có REQ-MOB-21. Xem
[interview](../../system/mobility-interview.md) và [progress](progress.md).
Tìm tuyến và cảnh báo không được mô tả là cam kết thời gian đến chính xác.
