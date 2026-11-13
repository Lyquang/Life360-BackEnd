# Tasks: Purpose và Circle place presence

[Current spec](spec.md) · [Extension plan](plan.md). **Implementation pending approval**.

- [x] PLACE-T01 Đối chiếu create/list/category hiện hữu, ghi purpose/geofence/ownership proposal.
- [ ] PLACE-T02 Duyệt Q-MOB-03/04/05, purpose vocabulary, creator/admin policy, per-member label và provenance/storage.
- [ ] PLACE-T03 Additive FavoritePlace fields + CRUD/DTO/routes/controller/repo, test AC-PLACE-01/02/06 và old-client compatibility.
- [ ] PLACE-T04 MemberPlaceLabel/PlacePresence models/indexes/repositories, guard transaction và invalidation semantics.
- [ ] PLACE-T05 Pure geofence engine, recordedAt ordering/dwell/hysteresis/overlap/expiry; AC-PLACE-03/05 bằng fake clock/synthetic GPS.
- [ ] PLACE-T06 GPS/privacy/leave/place edit hooks + authorized snapshot API; race/revoke tests AC-PLACE-02/04, regression Circle/privacy/chat.
- [ ] PLACE-T07 Mobile Circle picker/purpose/shortcut/geofence UI và background updates; device test fresh/approximate/denied/offline.
- [ ] PLACE-T08 Migration/index review, rollout flags/retention/rollback, cập nhật current contracts/model khi thật sự triển khai và ghi evidence/progress.


## Phase A: Active saved-place function (plan revision A)

Legacy PLACE-T IDs above retain their history; only this independently verifiable
function is active. GPS/native roadmap items stay pending for subsequent functions.

- [x] T001 [US1] Add revision/CAS and transactional membership guard in src/infrastructure/database/models/FavoritePlace.js, Group.js and repositories/groupRepository.js (AC-P1/P2/P5).
- [x] T002 [US2] Add pure label enum and MemberPlaceLabel schema/registration in src/domain/placeLabels.js and src/infrastructure/database (AC-P3).
- [x] T003 [US1] Implement scoped CRUD/cascade, label operations and use cases in src/infrastructure/repositories/placeRepository.js and src/application/places/placeUseCases.js (AC-P2/P3/P4/P5).
- [x] T004 [US1] Wire validated HTTP handlers/Swagger in src/presentation/dto/group.schemas.js and http/controllers/groupController.js, http/routes/groupRoutes.js (AC-P1..P4).
- [x] T005 [US2] Verify REST compatibility/auth/validation/CAS/concurrency/rollback with tests/placeManagement.test.js and regressions (AC-P1..P5).
- [ ] T006 Update api-docs/PLACES_API_DOC.md, Study/PLACE_PURPOSES.md, owner docs/verification/progress, run convergence, then commit/push verified function (AC-P6).

Dependencies: T001/T002 → T003 → T004 → T005 → T006; one agent runs sequentially.
