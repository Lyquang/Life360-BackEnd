# Interview — bản đồ và cảnh báo theo ngữ cảnh

Updated: **2026-11-13**. Stage của từng feature nằm tại progress của owner, không
phải ở tài liệu điều phối này. [Roadmap và Q-IDs gốc](mobility-roadmap.md).

## Context và authority

User yêu cầu lại ngày 2026-11-13: báo khả năng sắp mưa tại nơi đang ở, kẹt xe trên
tuyến định đi, search địa điểm/tìm đường và lưu mục đích Nhà/Công ty/Đi chơi.
Đây là tiếp tục REQ-MOB-01…12, không phải feature mới cần một folder tổng hợp hoặc
approval để triển khai toàn bộ. Không ghi đè spec/plan/tasks cũ bằng template.

Các owner vẫn độc lập:

- [place-search](../features/place-search/spec.md): search/history được hồ sơ ghi
  nhận đã triển khai native iOS. Không khảo sát/build lại Mobile trong lượt này.
- [routing](../features/routing/spec.md) / [progress](../features/routing/progress.md):
  tuyến, phương tiện, alternatives và active trip; còn thiết kế.
- [context-alerts](../features/context-alerts/spec.md) / [progress](../features/context-alerts/progress.md):
  weather/traffic, rule, inbox, delivery/push; còn thiết kế.
- [favorite-places](../features/favorite-places/spec.md) / [progress](../features/favorite-places/progress.md):
  mở rộng địa điểm Circle theo mục đích và nhận diện nơi ở; còn thiết kế.

Giữ quyết định đã xác nhận tại đúng owner: REQ-MOB-05 (push khi app đóng),
REQ-MOB-06 (Circle và tự hiển thị nơi ở), REQ-MOB-08/11 (xe máy ưu tiên, chọn
phương tiện và tuyến thay thế), [DEC-SEARCH-01/03](../features/place-search/decisions.md)
(history cache 20 mục/30 ngày, scope search implementation),
[DEC-ALERT-01](../features/context-alerts/decisions.md) (chỉ alert đáng chú ý và
delivery state tối thiểu lưu DB 7 ngày). Không hỏi duyệt lại các quyết định đó.

## Vòng 1 — 3 câu đã trả lời, 2026-11-13

Authority cho mỗi câu: user trả lời trực tiếp trong phiên, cùng ngày. Đây là xác
nhận requirement/constraint; không phải duyệt plan, vendor hay implementation.

### Q-MOB-01

- Category: scope/coverage. Question: Bản đầu sẽ phục vụ khu vực nào?
- Options đã đưa: Việt Nam trước; một số tỉnh/thành; nhiều quốc gia.
- Answer: **“Việt Nam trước”**.
- Status: **Answered về thị trường**; độ phủ thực từng mode chưa được kiểm chứng.
- Impact/propagation: REQ-MOB-14, routing/alerts specs và roadmap; không hỏi chọn lại MapKit.

### Q-MOB-02

- Category: providers/cost. Question: Ngân sách mỗi tháng cho API thời tiết, tìm tuyến và giao thông là bao nhiêu?
- Options đã đưa: gói miễn phí, chưa bật tính phí; tối đa 1 triệu; tối đa 3 triệu/tháng.
- Answer: **“Thử nghiệm với gói miễn phí; chưa bật tính phí”**.
- Status: **Answered về ràng buộc chi phí**; provider, entitlement và requests/day cap chưa chốt.
- Impact/propagation: REQ-MOB-15, routing/alerts specs, roadmap/research. Không tự bật billing kể cả khi một SKU có free allowance.

### Q-MOB-06

- Category: UX/scope. Question: Chức năng chỉ đường bản đầu cần đến mức nào?
- Options đã đưa: preview/ETA/trip alerts; in-app turn-by-turn/voice; mở app bản đồ khác.
- Answer: **“Dẫn đường từng ngã rẽ và giọng nói ngay trong app”**.
- Status: **Answered về scope**; chưa chọn SDK/giải pháp đáp ứng ràng buộc chi phí và xe máy.
- Impact/propagation: REQ-MOB-13, routing spec. Plan/tasks cũ chỉ có preview chưa đủ; đánh dấu cần sửa sau requirements review, không âm thầm coi voice ngoài scope.

## Vòng 2 — 5 câu đã trả lời, 2026-11-13

Áp dụng native clarify với owner routing được chọn rõ bằng helper paths-only;
các đáp án cross-feature được đưa về owner liên quan. Q-MOB-04a/04b và 05a là
sub-IDs của vấn đề gốc, không thay Q-MOB-04/05. Không coi năm câu là giới hạn cho
mọi vòng của feature. Authority: câu trả lời trực tiếp của user cùng ngày.

### Q-MOB-03

- Category: privacy/consent. Question: Khi pause chia sẻ, có tiếp tục vị trí cho dẫn đường/cảnh báo riêng không?
- Options đã đưa: tiếp tục nếu bật riêng, ẩn Circle; dừng mọi dịch vụ vị trí.
- Answer: **“Tiếp tục dịch vụ riêng nếu tôi bật riêng; ẩn với Circle”**.
- Status: **Answered về policy**; lifecycle cấp/rút consent và quyền OS cần thiết kế.
- Impact/propagation: REQ-MOB-16, routing/alerts/places specs. Không dùng consent riêng để phát GPS/nhãn nơi ở cho Circle hoặc lách pause hiện có. Đây là extension chưa hiện thực.

### Q-MOB-04a

- Category: domain/ownership. Question: Nhãn Nhà/Công ty do từng người gán riêng hay dùng chung cả Circle?
- Options đã đưa: địa điểm chung, nhãn cá nhân; nhãn chung cả Circle.
- Answer: **“Địa điểm chung; mỗi người gán nhãn riêng”**.
- Status: **Answered**.
- Impact/propagation: REQ-MOB-17, favorite-places spec; các thành viên có thể có Công ty khác nhau. Nhãn nơi ở chia sẻ theo quyền Circle hiện hành khi không pause.

### Q-MOB-04b

- Category: permissions. Question: Ai được sửa/xóa địa điểm chung trong Circle?
- Options đã đưa: người tạo và admin; mọi thành viên; chỉ admin. Question nói rõ từng người chỉ tự thay nhãn của mình.
- Answer: **“Người tạo và admin Circle”**.
- Status: **Answered về quyền cơ bản**; người tạo rời Circle không tự còn quyền, edge cases cần chốt.
- Impact/propagation: REQ-MOB-18, favorite-places spec. Chưa duyệt DTO/route/model chi tiết.

### Q-MOB-08

- Category: weather scope. Question: Bản đầu cảnh báo những hiện tượng nào?
- Options đã đưa: sắp mưa/mưa lớn; chỉ sắp mưa; thêm dông/gió mạnh/nắng nóng bất thường.
- Answer: **“Thêm dông, gió mạnh và nắng nóng bất thường”**.
- Status: **Answered về loại hiện tượng**; nguồn, xác suất/mức độ và ngưỡng còn mở.
- Impact/propagation: REQ-MOB-19, alerts spec. “Thêm” mở rộng phạm vi mưa đã có; không tự cho phép mọi loại cảnh báo provider cung cấp.

### Q-MOB-05a

- Category: forecast window. Question: Muốn nhận cảnh báo sắp mưa trong khoảng nào trước khi mưa tới?
- Options đã đưa: 30 phút; 60 phút; 15 phút, kèm điều kiện nguồn đủ chi tiết/đạt rule.
- Answer: **“Trong 30 phút tới”**.
- Status: **Answered**.
- Impact/propagation: REQ-MOB-20, alerts spec. Đây là cửa sổ evaluation, không cam kết dự báo đúng thời điểm hoặc cho phép dùng hourly data giả thành nowcast.

## Vòng 3 — 5 câu đã trả lời, 2026-11-13

### Q-MOB-06a

- Category: UX/offline lifecycle. Question: Nếu đang dẫn đường mà mất mạng, tiếp tục tuyến đã tải hay tạm dừng?
- Options đã đưa: tiếp tục tuyến đã tải và báo giới hạn dữ liệu mới; tạm dừng đến khi có mạng.
- Recommendation đã nói: tiếp tục khi dữ liệu còn hợp lệ; không giả traffic mới hoặc reroute khi nguồn không hỗ trợ.
- Answer: **“Tiếp tục tuyến đã tải; báo rõ giới hạn dữ liệu mới”**.
- Status: **Answered**, user trả lời trực tiếp 2026-11-13; không suy thành đã duyệt offline rerouting đầy đủ.
- Impact: routing acceptance/lifecycle và giới hạn dữ liệu traffic; không phải lựa chọn SDK.

### Q-MOB-05b

- Category: traffic threshold. Question: Tuyến dự kiến chậm thêm ít nhất bao nhiêu phút thì cảnh báo?
- Options đã đưa: 5, 10 hoặc 15 phút; chỉ khi có traffic hợp lệ cho đúng phương tiện, missing data là unknown.
- Answer: **“Chậm thêm từ 5 phút”**.
- Status: **Answered**, user trả lời trực tiếp 2026-11-13.
- Impact: REQ-MOB-22, rule traffic chỉ với dữ liệu hợp lệ cùng route/mode/context; không áp delay ô tô cho xe máy/đi bộ.

### Q-MOB-05c

- Category: notification lifecycle. Question: Xử lý weather/traffic alerts trong 22:00–07:00 thế nào?
- Options đã đưa: im lặng trừ cảnh báo nguy hiểm được nguồn/rule xác định; luôn báo khi đạt rule; im lặng toàn bộ.
- Answer: **“Im lặng 22:00–07:00, trừ cảnh báo nguy hiểm”**.
- Status: **Answered**, user trả lời trực tiếp 2026-11-13.
- Impact: REQ-MOB-23, dispatch/expiry theo giờ địa phương; severity nguy hiểm phải xác định từ nguồn/rule, không tự coi mọi cơn mưa là khẩn cấp.

### Q-MOB-05d

- Category: place-recognition UX. Question: Xác nhận ở Nhà/Công ty sau 2 phút hay ngay khi vào vùng?
- Options đã đưa: chờ khoảng 2 phút; hiển thị ngay nếu GPS tin cậy. Recommendation nêu rõ dùng GPS đủ tin cậy để tránh nhận diện khi đi ngang.
- Answer: **“Chờ ở trong vùng khoảng 2 phút”**.
- Status: **Answered**, user trả lời trực tiếp 2026-11-13.
- Impact: REQ-MOB-24; không đồng nghĩa duyệt radius/fix-count/hysteresis/overlap trong draft plan.

### Q-MOB-02a

- Category: provider usage scope. Question: Giai đoạn API miễn phí là thử nghiệm cá nhân/nội bộ hay phát hành công khai/thương mại?
- Options đã đưa: cá nhân/nội bộ chưa thương mại; công khai có quảng cáo/thu phí; công khai miễn phí không quảng cáo/thu phí.
- Answer: **“Thử nghiệm cá nhân/nội bộ, chưa thương mại”**.
- Status: **Answered**, user trả lời trực tiếp 2026-11-13.
- Impact: REQ-MOB-25; không phải duyệt public/commercial rollout hoặc chấp thuận provider nào. Quyền sử dụng/hạn mức vẫn phải đối chiếu nguồn chính thức.

## Coverage và requirements review

**13 câu hỏi đã trả lời qua 3 vòng (3 + 5 + 5), không còn câu đang chờ đáp án.**
Trạng thái của các extension chuyển REQUIREMENTS_REVIEW: review bộ yêu cầu hoàn
chỉnh với user, không suy approval từ các câu hỏi riêng lẻ. Xem spec/progress
của từng owner và [requirements REQ-MOB-13…25](mobility-roadmap.md#clarifications--2026-11-13).

| Phạm vi | Trạng thái sau 13 câu |
|---|---|
| Việt Nam, in-app voice, offline continuation, trial/no billing | Resolved về intent và ràng buộc; chưa chứng minh feasible |
| Self-only opt-in khi pause, nơi chung/nhãn cá nhân, creator/admin | Resolved về policy; chưa hiện thực |
| Loại thời tiết, mưa 30 phút, delay 5 phút, quiet hours và dwell 2 phút | Resolved về hành vi đã hỏi; thresholds chi tiết còn ở thiết kế |
| Provider miễn phí cho đúng mode/region, dữ liệu forecast, quota/licence | Deferred cho research kỹ thuật, không phải vendor đã được chọn |
| Probability/severity definition, radius/freshness/overlap, retry/dedup, reroute/audio/background | Thiết kế phải đề xuất rõ trong plan sau requirements confirmation; không tự coi draft values đã duyệt |

Giữ một owner cho đáp án tại đây; spec chứa clarification bullets và yêu cầu tương
ứng, không tạo API/model tổng hợp. Tiếp theo cần user xác nhận bộ requirements để
bắt đầu native plan/research. Nếu nghiên cứu cho thấy constraints không tương thích,
trình bằng chứng và hỏi trade-off liên quan; không giảm scope hay bật billing âm thầm.
Chưa có implementation approval, chưa chạy native plan/tasks/analyze cho revision mới.

## Evidence của lượt này

Chỉ đọc hướng dẫn/specs/decisions/plan liên quan và graph report. Graph commit
`ddf5c58d` khác HEAD `14406aea6cfdd18873850e308067fa244b065fc2`, nhưng cả 136
`src/**/*.js` khớp hash inventory, không thêm/xóa JS trong phạm vi graph.
Không lặp full source survey, không đọc/sửa Mobile, không gọi provider hay chọn
vendor theo tài liệu cũ. Không chạy model workflow, tạo branch hoặc cấp approval.
