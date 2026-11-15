# Tìm tuyến đường và đánh giá giao thông

Status: **Approved Revision 2; implemented locally, verification pending** | Updated: 2026-11-14.
Authority: [REQ-MOB-02/03/05/08/11](../../system/mobility-roadmap.md). Xe máy ưu tiên kiểm chứng;
yêu cầu mới mở rộng **chọn xe máy/ô tô/đi bộ và các tuyến thay thế**. Intent được yêu cầu;
Contract preview của Revision 2 đã được duyệt và hiện thực cục bộ; kiểm chứng thiết bị/provider còn mở.
[Plan](plan.md) · [Tasks](tasks.md).

## Phạm vi và giới hạn

Từ origin/destination và phương tiện, trả tuyến/alternatives nếu có, distance/ETA,
traffic summary và đoạn chậm được provider hỗ trợ. Giám sát traffic nền qua
[context alerts](../context-alerts/spec.md) là scope riêng, chưa thuộc bản
preview + dẫn đường trong app này. Không đoán tương lai
từ Live Trail; không dùng dữ liệu user khác để tự tính traffic.
UI cho chọn phương tiện trước preview; chỉ hiển thị các tuyến provider thật sự trả.
Những mode khác như xe đạp/bus chưa được chốt chỉ từ dấu “...” của yêu cầu.

**Đã xác nhận 2026-11-13, REQ-MOB-13/14/15:** Việt Nam trước; dẫn đường từng
ngã rẽ có giọng nói ngay trong app; thử nghiệm gói miễn phí, chưa bật tính phí.
Preview + trip monitoring trong plan cũ chưa đủ phạm vi mới. TomTom v1 đã được
chọn có điều kiện cho thử nghiệm và key đã trả tuyến mẫu; coverage xe máy/traffic
thực tế, quyền sử dụng và device QA chưa được xác minh đủ. Khi mất mạng tiếp tục tuyến đã tải còn hợp lệ và báo giới hạn dữ liệu mới
(REQ-MOB-21); chưa yêu cầu offline reroute hoặc dự đoán lộ trình thường đi.
Không tự thay yêu cầu in-app bằng mở app bản đồ khác.

REQ-MOB-16: pause Circle vẫn cho dịch vụ riêng dùng vị trí nếu user bật riêng;
không lộ GPS, destination hoặc nhãn nơi ở cho Circle qua luồng này. Mobile đã có
lease vị trí riêng cho navigation; kiểm chứng end-to-end pause còn mở.

**Đã xác nhận 2026-11-14, Q-MOB-28/29/30:** khi lệch tuyến, tự tính lại tuyến
online với giới hạn lượt; đến đích thì tự kết thúc sau khi vị trí ổn định; khi app
ở nền vẫn tiếp tục giọng nói dẫn đường. Đây là yêu cầu sản phẩm, chưa phải bằng
chứng iOS/OS/provider đáp ứng. Ngưỡng lệch tuyến, giới hạn gọi API, độ ổn định
ở đích và lifecycle audio/vị trí nền cần được thiết kế và kiểm chứng trên thiết bị.

**Decision (Q-MOB-31, 2026-11-14):** thử TomTom Maps Routing API **v1** cho bản
nội bộ, sau khi có tài khoản/key và xác minh quyền sử dụng, mode/traffic/tuyến
thực tế ở Việt Nam. Không bật billing hoặc coi xe máy BETA là đã đạt QA. Giữ
MapKit làm nền hiện có nếu quyền provider cho phép; thay nền bản đồ là thay đổi
thiết kế riêng cần review.

**Decision (Q-MOB-32/33, 2026-11-14):** tài khoản được user báo là Free và gán
Routing API; key trả HTTP 200 cho các mode trong thử nghiệm công khai. Nếu tuyến
xe máy có segment `TRAVEL_MODE=other`, vẫn hiển thị tuyến và cảnh báo rõ đoạn
chưa được xác nhận cho xe máy; không tự gọi đó là đoạn đi bộ hoặc xóa cảnh báo
khi bắt đầu dẫn đường. Điều này không xác minh luật đường/beta coverage.

## Clarifications

### Session 2026-11-13

- Q: Q-MOB-01, vùng phục vụ? → A: Việt Nam trước; [record](../../system/mobility-interview.md#q-mob-01).
- Q: Q-MOB-02, ngân sách upstream? → A: Gói miễn phí, chưa bật tính phí; [record](../../system/mobility-interview.md#q-mob-02).
- Q: Q-MOB-06, mức chỉ đường? → A: Từng ngã rẽ và giọng nói trong app; [record](../../system/mobility-interview.md#q-mob-06).
- Q: Q-MOB-03, dịch vụ riêng khi pause? → A: Tiếp tục nếu bật riêng, ẩn với Circle; [record](../../system/mobility-interview.md#q-mob-03).
- Q: Q-MOB-06a, mất mạng? → A: Tiếp tục tuyến đã tải, báo giới hạn dữ liệu mới; [record](../../system/mobility-interview.md#q-mob-06a).
- Q: Q-MOB-02a, trial hay thương mại? → A: Cá nhân/nội bộ, chưa thương mại (REQ-MOB-25); [record](../../system/mobility-interview.md#q-mob-02a).
- Q: Q-MOB-27, đã có provider account? → A: Chưa có; [record](../../system/mobility-interview.md#provider-feasibility-follow-up--2026-11-13).
- Q: Q-MOB-28/29/30, lệch tuyến/đến đích/giọng nói nền? → A: Tự reroute có giới hạn; tự kết thúc khi ổn định; tiếp tục giọng nói nền; [record](../../system/mobility-interview.md#routing-follow-up--2026-11-14).
- Q: Q-MOB-31, provider thử nghiệm? → A: TomTom Maps Routing API v1 có điều kiện; [record](../../system/mobility-interview.md#routing-follow-up--2026-11-14).
- Q: Q-MOB-32/33, mode `other` và gói/key? → A: Vẫn hiện tuyến kèm cảnh báo; user báo Free + Routing API; [record](../../system/mobility-interview.md#routing-follow-up--2026-11-14).

## Current behavior

Backend hiện có `POST /api/v1/routes/preview` qua TomTom v1 khi được cấu hình key;
trả tối đa ba tuyến thật, geometry, maneuver và traffic availability. Mobile có
MapKit preview và session dẫn đường trong bộ nhớ. Chưa có Backend active trip,
background traffic worker hoặc xác minh tuyến/giọng nói trên thiết bị. Matcher
hiện hữu vẫn chỉ tái dựng đường đã đi, không dùng làm route planner.

## Acceptance cho bản preview + dẫn đường đang thiết kế

AC-ROUTE-04/05/06/07 bên dưới là **đề xuất lịch sử cho active-trip/traffic
worker**, chưa được duyệt và không thuộc bản này. Bản hiện tại dùng session
riêng trong Mobile, không có Backend `/trips` hay persisted ActiveTrip.

- AC-ROUTE-01: User chọn điểm xuất phát/đích và mode; có tuyến thì map hiển thị geometry đúng encoding, distance mét, duration giây, nguồn và thời điểm dữ liệu. Không có tuyến phải phân biệt với provider lỗi.
- AC-ROUTE-02: ETA traffic và baseline chỉ so sánh cùng route/mode/departure context. Thiếu traffic → `unavailable`, không hiển thị đường xanh hoặc delay=0 như đã biết.
- AC-ROUTE-03: Tuyến xe máy không dùng tuyến ô tô âm thầm. Unsupported mode/region trả lý do và lựa chọn thay thế rõ; mobile không tự đổi phương tiện.
- AC-ROUTE-04: Preview không tạo background tracking. Start có request ID idempotent; một user chỉ một active trip đề xuất; route revision dùng để loại cập nhật/alert cũ.
- AC-ROUTE-05: End/cancel/expiry và privacy-disable dừng theo dõi theo policy đã duyệt. GPS stale/off-route không tiếp tục mô tả người dùng đang trên tuyến cũ.
- AC-ROUTE-06: Chỉ chủ user được đọc/sửa trip; Circle không tự thấy destination/trip. Không dùng route biết trước của thành viên để gửi cảnh báo cho người khác.
- AC-ROUTE-07: App đóng vẫn có thể nhận traffic push cho active trip nếu server có context hợp lệ; không phụ thuộc socket. Dừng cảnh báo khi context/notification hết hạn.
- AC-ROUTE-08: Mode xe máy/ô tô/đi bộ có lựa chọn rõ; đổi mode invalidate tuyến/ETA/traffic cũ và recompute. Backend nhận mode bắt buộc, không để provider tự mặc định ô tô.
- AC-ROUTE-09: Cho so sánh/chọn route alternatives thật theo ETA/khoảng cách/traffic có dữ liệu. Một tuyến vẫn là kết quả hợp lệ; không sinh tuyến giả cho đủ số option. Chỉ mode hỗ trợ traffic mới có cảnh báo kẹt xe, không áp dụng delay ô tô cho đi bộ.

- AC-ROUTE-10 (REQ-MOB-13): Với mode/tuyến được hỗ trợ và context hợp lệ, bắt đầu chuyến cho chỉ dẫn từng ngã rẽ và giọng nói ngay trong app. Chỉ vẽ tuyến/ETA hoặc chuyển sang app khác chưa đáp ứng. Offline continuation theo AC-ROUTE-12; reroute/audio/background lifecycle theo plan Revision 2.
- AC-ROUTE-11 (REQ-MOB-15): Không bật tính phí hoặc tự chuyển dịch vụ trả tiền khi hết quota. Thiếu khả năng cung cấp dữ liệu hợp lệ phải hiển thị unavailable/lý do; không giả tuyến xe máy hoặc traffic.
- AC-ROUTE-12 (REQ-MOB-21): Mất mạng khi chuyến đang active không tự xóa tuyến đã tải còn hợp lệ; tiếp tục chỉ dẫn từ dữ liệu sẵn có và hiển thị giới hạn dữ liệu mới. Không giả có traffic mới hoặc offline reroute khi chưa được hỗ trợ.
- AC-ROUTE-13 (Q-MOB-28): Khi người dùng lệch tuyến với vị trí tin cậy và có mạng, app tự xin tuyến mới trong giới hạn tần suất/ngân sách đã thiết kế; một GPS nhiễu hoặc hết quota không gây vòng lặp gọi API hay tự chuyển sang tuyến sai mode.
- AC-ROUTE-14 (Q-MOB-29): Khi người dùng thực sự tới đích và vị trí ổn định theo rule được kiểm chứng, chuyến tự kết thúc một lần; một fix nhảy gần đích hoặc fix cũ không kết thúc chuyến.
- AC-ROUTE-15 (Q-MOB-30): Khi iOS cho phép vị trí nền và audio phù hợp, chỉ dẫn giọng nói tiếp tục khi app ở nền; thiếu quyền, app bị treo hoặc OS dừng phải báo trạng thái thực, không cam kết chạy liên tục ngoài khả năng OS.

## Open decisions

Intent Việt Nam/free-only/in-app voice và self-only khi pause đã được trả lời.
Coverage thực, quota, expiry/arrival thresholds, traffic severity/freshness (delay 5 phút đã có REQ-MOB-22),
reroute limits/voice/background implementation và provider retention/terms còn cần kiểm chứng; account Free + Routing đã được user báo. Offline continuation đã có REQ-MOB-21. Xem
[interview](../../system/mobility-interview.md) và [progress](progress.md).
Tìm tuyến và cảnh báo không được mô tả là cam kết thời gian đến chính xác.
