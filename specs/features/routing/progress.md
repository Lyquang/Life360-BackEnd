# Progress — routing

Stage: **CLARIFYING** (provider/entitlement only; requirements already accepted) | Updated: **2026-11-13**.
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


## Current provider gate

Backend places/presence have been delivered. Q-MOB-27 is now answered in the
2026-11-14 follow-up below. Before routing-dependent code, verify
navigation/MapKit display/retention entitlement and actual mode/traffic contract.
See research.md for current TomTom/VietMap evidence and unresolved documentation
conflicts. No provider chosen, no billing/accounts/API calls performed. Original
requirements/start authorization remain valid; do not ask to approve them again.

## Routing implementation request — 2026-11-14

User directly requested “HIện thực chức năng Tìm tuyến và dẫn đường”. Q-MOB-27 is
answered: no provider account exists. User additionally authorized routing-scoped
edits to the Mobile repository and local iOS build/tests. Q-MOB-28/29/30 confirmed
bounded automatic online reroute, stable-arrival auto-end and continued background
voice guidance. The canonical answers and scope are in the
[interview](../../system/mobility-interview.md#routing-follow-up--2026-11-14).

**Stage remains CLARIFYING/provider gate.** Existing draft plan/tasks still lack
an entitled provider, exact v1/other API contract and native navigation design;
they are not a reviewed implementation packet. TomTom Orbis v2/v3 do not document
motorcycle support, VietMap Trial disables Traffic by default. See
[research](research.md#recheck--2026-11-14). No backend/mobile runtime change,
provider call, key, billing or deployment has occurred in this follow-up.

Q-MOB-31 is answered: user chose **TomTom Maps Routing API v1 as a conditional
internal-trial candidate**. This resolves provider preference, but no account or
key exists, and beta motorcycle/traffic/navigation rights have not been validated
on an entitled account. Next: finish a revised reviewable Backend + Mobile plan,
then obtain the account/private key and run mode-specific trial validation before
claiming end-to-end implementation or enabling the feature.

## Key availability and first provider check — 2026-11-14

User reported key configured in ignored Backend `.env`. Local presence check
confirmed one nonempty entry; no value was printed or copied into docs. Six
limited authenticated public-Hanoi-point v1 calls returned HTTP 200 and route
geometry/guidance for motorcycle, car and pedestrian, with two alternatives each.
The `sectionType=travelMode` probe found `other` sections in motorcycle/car, and
motorcycle/car output was identical on this one sample. See [research](research.md#keyed-public-route-feasibility--2026-11-14).
This proves key access to this endpoint, **not** free billing status, account
terms, Vietnam motorcycle legality or iOS guidance. Native plan/contract/tasks
review and Mobile approval gate still precede runtime edits.

User subsequently confirmed Free + Routing API assignment (Q-MOB-33) and the
mixed-mode warning policy (Q-MOB-32). A seventh public route call showed that
`language=vi-VN` can still return English maneuver messages. Vietnamese speech
needs local coded-maneuver templates and device QA; do not claim provider-localized
voice. No additional secret was exposed.

## Revision 2 review packet — 2026-11-14

Stage: **AWAITING_APPROVAL** for the current Backend preview and linked Mobile
navigation design. The initial implementation request established intent, while
this stateless Backend/local Mobile session architecture and exact proposed DTO
were written afterward; they require review under AGENTS.md. No runtime code
has changed for routing. [Spec](spec.md) · [Plan](plan.md#revision-2--route-finding--in-app-navigation-2026-11-14)
· [Tasks](tasks.md#revision-2-execution-queue-2026-11-14) · [Proposed contract](contracts.md)
· [Mobile plan](../../../../Mobile/.spec/016-route-navigation/plan.md).

Read-only Spec Kit consistency analysis after task generation: selected native
feature path with `check-prerequisites.sh --require-spec --require-tasks`;
reviewed requirements/ACs against Revision 2 flow and R2-01…09, and checked
constitution/owner boundaries. **No critical internal contradiction remains**:
historical ActiveTrip AC-ROUTE-04…07 and plan/tasks are explicitly superseded
for this slice. External gates remain TomTom account terms/route rights, actual
Vietnam motorcycle/device pilot, and verified Backend API handoff; do not
construe these as passed. No implementation approval recorded.

Review snapshot SHA-256: spec `d6ff36ada2f1606c4192e3327024c72d492f201b1bca2ade66bb05ebe99ed55c`,
plan `f93844cdea806c11e528a66f1ed22a3123a2bf2ef9b3766176d0473bf8b83e9a`,
tasks/scope digest `b83d8d40cff24d60cbb098c9b04caa7334a99e6a62603cd61d078a4a81013c6c`.
Approval, if given, is limited to Revision 2 and the linked Mobile plan;
it does not authorize billing, deployment, weather, traffic push or historical
Backend ActiveTrip.

## Implementation approval — 2026-11-14

User explicitly replied “Tôi duyệt plan trên, hiện thực đầy đủ cho tôi” after
reviewing the Vietnamese summary of Revision 2. This approves the exact Backend
spec/plan/task hashes and linked Mobile review packet above. Stage: **IMPLEMENTING**.
TomTom account terms, Vietnam road pilot and device background voice remain
verification/activation gates; approval does not certify those outcomes or enable
paid billing/deployment. Backend route preview is the first implementation slice.

## Local implementation checkpoint — 2026-11-14

Backend `POST /api/v1/routes/preview` is implemented behind optional `TOMTOM_ROUTING_API_KEY`, with JWT, strict DTO, per-user budget, normalized real route alternatives, `other` sections, traffic availability and Swagger. It stores no trip. [Client handoff](../../../api-docs/ROUTING_API_DOC.md) and [Study](../../../Study/ROUTING_NAVIGATION.md) describe the implemented interface and limits. Focused Backend checks: 5 pass; full suite: 309/309 pass across 63 suites after the fifth focused case was added. Mobile simulator build and standalone navigation harness pass; see [Mobile verification](../../../../Mobile/.spec/016-route-navigation/verification.md). Stage remains **IMPLEMENTING**, since account terms and device/road pilot are pending. No deployment or paid billing performed.

## Device screenshot and Render discrepancy — 2026-11-15

User installed the app on the paired iPhone and showed `route.state.unavailable` on the route panel. Mobile production configuration targets `https://life360-backend-version2-0.onrender.com/api/v1`. A public, credential-free probe returned `GET /api/v1/health` 200 and `POST /api/v1/routes/preview` with an empty body **404**. The locally mounted route applies authentication before validation, so an unauthenticated request should be 401 when this code is deployed. This is evidence that the live service does not serve the local routing implementation; it does not prove which Git branch Render tracks. No user GPS/token was sent in the probe.

`render.yaml` now declares `TOMTOM_ROUTING_API_KEY` as a secret and the preview rate limit, and quotes the pre-existing `REDIS_KEY_PREFIX` value so YAML parses. The live service branch and whether its Environment has the TomTom key remain unverified. Keep stage **IMPLEMENTING** until the correct service receives the reviewed code, the route responds correctly, and the iPhone flow is tested. No push/deployment occurred in this investigation.
