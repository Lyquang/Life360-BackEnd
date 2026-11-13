# Progress — routing

Stage: **PLANNING** (queued after saved-place management) | Updated: **2026-11-13**.
Owner: [spec](spec.md) · [draft plan](plan.md) · [draft tasks](tasks.md).

## Requirements confirmation

Intent/policy có authority: REQ-MOB-02/03/05/08/11 và bổ sung REQ-MOB-13/14/15/16 trong [roadmap](../../system/mobility-roadmap.md).
Việt Nam trước; chỉ gói miễn phí, chưa bật billing; dẫn đường từng ngã rẽ và giọng nói trong app; pause vẫn cho dịch vụ riêng nếu bật riêng, không lộ Circle; mất mạng tiếp tục tuyến đã tải, báo giới hạn dữ liệu mới. Trial cá nhân/nội bộ chưa thương mại.

Các đáp án thật thuộc [interview](../../system/mobility-interview.md): **13/13 câu
đã trả lời qua 3 vòng**, không còn câu đang chờ đáp án. Các spec chỉ giữ kết luận
và Q-ID links. Đây là xác nhận từng intent/policy, chưa là approval của toàn bộ
requirements revision hoặc thiết kế/API.

**Review candidate spec SHA-256 (chưa được duyệt):** `179103aa26f8c12039684c3df50daba4bfa379932ef7063657087aab4e8caf9c`.
**Full requirements confirmation:** Accepted by later explicit implementation instruction, 2026-11-13; see authorization update below. Provider choices are still unresolved.

**Thiết kế/research còn lại:** provider/coverage/quota miễn phí, severity/probability,
limits/freshness/cooldown/overlap/reroute/audio/background và compatibility theo
phạm vi của owner. Các giá trị đã chốt (mưa 30 phút, delay 5 phút, quiet hours
22–07 trừ nguy hiểm, dwell khoảng 2 phút) không cần hỏi lại. Nếu khả năng provider
không đáp ứng constraints, trình evidence và xin trade-off thay vì giảm scope.

## Implementation approval

**Pending** cho feature/extension này. Chưa có full requirements confirmation hoặc implementation review
packet/revision/hashes được duyệt, nên chưa ghi hash phê duyệt giả. Plan/tasks
ngày 2026-11-12 vẫn Proposed; chưa chạy native plan/tasks/analyze cho revision mới.
DEC-SEARCH-03 chỉ duyệt search/history, không bao gồm extension này.
Chưa chuyển AWAITING_APPROVAL: hiện đang REQUIREMENTS_REVIEW, chưa có plan/tasks/analyze cho revision mới.

## Work và next action

Đã cập nhật owner spec từ 13 đáp án và ghi các chỗ thiết kế cũ cần review.
Trình bộ requirements để human confirmation; sau đó dùng native plan/research,
đề xuất các lựa chọn kỹ thuật còn lại và cập nhật tasks và chạy analyze trước implementation
approval. Không bắt feature chờ quyết định không liên quan. Chưa sửa runtime,
DTO/database, Mobile, không bật billing hoặc gọi provider API. API handoff/Study
mới thực hiện theo behavior sau implementation; không tạo output giả ở giai đoạn này.


## User authorization — 2026-11-13

User confirmed implementation and sequential commit/push: “Tôi đồng ý hiện thực,
bạn hãy hiện thực từng chức năng một rồi mới commit và push code lên Github”.
Requirements are confirmed; do not request the same start approval again. Queued
after saved-place function. Detailed plan/research, tasks/analysis and actual
provider feasibility still required before dependent code; no paid billing or
Mobile/deployment authorization inferred. Prior Pending requirements notes are
historical, not an outstanding approval question.
