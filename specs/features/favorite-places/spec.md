# Địa điểm yêu thích

Status: **Backend saved-place management and GPS presence snapshot implemented; Mobile integration pending** | Updated: 2026-11-13. Legacy survey CB-02 retained below where relevant.

Circle place create/list/get/update/delete và nhãn mục đích cá nhân đã hiện thực ở backend. Backend GPS presence snapshot đã triển khai; Mobile UI/device QA chưa thực hiện.

[Contracts](contracts.md) · [Data model](data-model.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

Places require current Circle membership; create converts lat/lng to GeoJSON and populates adding user; list sorts newest first. Creator/admin who remain members may update/delete with revision CAS; personal labels are owner-scoped. See current contracts and revision A verification.

Evidence: places/digests use cases and repositories, `tests/api.test.js`, `tests/observabilityWorkflows.test.js`. Operational limits and quality gates are in [configuration](../../system/configuration.md) and [validation](../../system/validation.md).

## Source and existing verification

- [src/application/places/placeUseCases.js](../../../src/application/places/placeUseCases.js)
- [src/infrastructure/repositories/placeRepository.js](../../../src/infrastructure/repositories/placeRepository.js)
- [src/presentation/http/routes/groupRoutes.js](../../../src/presentation/http/routes/groupRoutes.js)
- [src/presentation/dto/group.schemas.js](../../../src/presentation/dto/group.schemas.js)

Existing tests (survey evidence; not a new test run):

- [tests/api.test.js](../../../tests/api.test.js)

## Cross-feature changes

[Circle và thành viên](../circles/spec.md).

No additional product approval is inferred from this split. When behavior changes, record the confirming instruction and observable acceptance criteria here; add a concrete plan/tasks only for actual work.

## Extension history — requested 2026-11-12, backend A/B implemented 2026-11-13

Người dùng yêu cầu lưu mục đích Nhà/Công ty/Đi chơi, chia sẻ trong Circle và tự
hiển thị nơi đang ở (REQ-MOB-04/06). Xem [extension plan](plan.md), [tasks](tasks.md)
và [roadmap/authority](../../system/mobility-roadmap.md). Saved-place CRUD và nhãn cá nhân theo revision A đã hiện thực; backend presence snapshot đã hiện thực ở revision B, Mobile chưa nối. Các contracts/model ở trên vẫn
mô tả API hiện tại; chỉ implementation được user cho phép mới thay đổi runtime.

## Clarifications

### Session 2026-11-13

- Q: Q-MOB-04a, nhãn riêng hay chung? → A: Địa điểm chung trong Circle; từng người gán nhãn riêng (REQ-MOB-17); [record](../../system/mobility-interview.md#q-mob-04a).
- Q: Q-MOB-04b, ai sửa/xóa nơi chung? → A: Người tạo và admin Circle; từng người chỉ tự thay nhãn của mình (REQ-MOB-18); [record](../../system/mobility-interview.md#q-mob-04b).
- Q: Q-MOB-03, khi pause? → A: Có thể tiếp tục dịch vụ riêng nếu bật riêng, nhưng Circle không được thấy GPS/nhãn nơi ở qua dịch vụ đó (REQ-MOB-16); [record](../../system/mobility-interview.md#q-mob-03).
- Q: Q-MOB-05d, nhận diện khi vừa vào vùng? → A: Chờ khoảng 2 phút trong vùng với GPS đủ tin cậy (REQ-MOB-24); [record](../../system/mobility-interview.md#q-mob-05d).

Nhãn mô tả nơi đang ở, không chứng minh hoạt động thực. Ngoài nơi đã lưu không tự
suy thành Đi chơi. Dwell khoảng 2 phút đã được xác nhận; radius/freshness/overlap dùng policy thử nghiệm đã ghi trong revision B; quyền luôn theo membership hiện tại, kể cả creator. Các extension Mobile/personal GPS còn riêng biệt.
[Progress](progress.md) giữ stage và approval cho extension.


## Authorized incremental implementation — 2026-11-13

User: “Tôi đồng ý hiện thực, bạn hãy hiện thực từng chức năng một rồi mới commit
và push code lên Github”. This confirms the requirements and authorizes sequential
implementation/commit/push. First function: saved-place CRUD and personal shortcuts;
see plan revision A, AC-P1…P6 and active tasks. GPS presence/dwell and Mobile work
remain separate following functions; do not claim the whole extension implemented.


## Active saved-place acceptance (revision A)

US1/P1: Member lưu/xem nơi chung; creator hoặc admin hiện tại quản lý sửa/xóa.
US2/P1: Member gán nhãn cá nhân vào nơi chung, không sửa nhãn tài khoản khác.

- AC-P1: Legacy create/list/category/GeoJSON/populated creator remain compatible; revision is additive.
- AC-P2: Scoped get/update/delete enforce membership; expected-revision update/delete reject stale revisions; legacy missing revision is zero.
- AC-P3: One home/work/leisure/custom key per Circle/user, custom text required only for custom; retry-safe label state, last-write-wins replacement.
- AC-P4: Outsider/departed/foreign-scope/owner-spoof requests rejected; creator still needs membership; delete cascades referring labels atomically.
- AC-P5: Concurrent updates preserve CAS; assignment/delete and membership writes serialize through Group; new mutations fail closed without transactions.
- AC-P6: Verified API handoff, Swagger, human Study and owner progress ship with saved-place function; no GPS presence completion claim.

Evidence: tests/placeManagement.test.js; [verification](verification.md),
[API guide](../../../api-docs/PLACES_API_DOC.md), [Study](../../../Study/PLACE_PURPOSES.md).


## Active backend presence acceptance (revision B)

User story US3/P1: Circle sees a member's current saved-place label from reliable
shared GPS after approximately two minutes, without access to private services or
stale data. B-AC1..B-AC4 in plan revision B define the independently verifiable
backend function: dwell/quality/freshness/overlap, privacy and context invalidation,
original-time realtime-only evidence and failure isolation, bounded authorized API
and documentation. No auto-presence claim for a Mobile screen until client wiring
and device QA. Personal GPS during pause is a separate future service; never feed
that into this shared projection. Default radii/quality limits are implementation
policy documented in the plan, not provider accuracy promises.
