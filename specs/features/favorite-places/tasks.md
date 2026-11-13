# Tasks: Purpose và Circle place presence

[Current spec](spec.md) · [Extension plan](plan.md). **Sequential backend implementation authorized 2026-11-13.** Legacy PLACE items below are superseded/mapped by active native-format phases A/B where applicable; Mobile/production work remains pending.

- [x] PLACE-T01 Đối chiếu create/list/category hiện hữu, ghi purpose/geofence/ownership proposal.
- [x] PLACE-T02 Duyệt Q-MOB-03/04/05, purpose vocabulary, creator/admin policy, per-member label và provenance/storage.
- [x] PLACE-T03 Backend additive revision + CRUD/DTO/routes/controller/repo and legacy REST compatibility covered by T001..T005; Mobile AC-PLACE-06 remains PLACE-T07.
- [x] PLACE-T04 MemberPlaceLabel/PlacePresence models/indexes/repositories, guard transaction và invalidation semantics.
- [x] PLACE-T05 Pure geofence engine, recordedAt ordering/dwell/hysteresis/overlap/expiry; AC-PLACE-03/05 bằng fake clock/synthetic GPS.
- [x] PLACE-T06 Shared GPS projection + current privacy/membership/place/label revalidation and authorized snapshot; race/revoke/regression verified by T007..T010. Personal GPS during pause remains separate.
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
- [x] T006 Update api-docs/PLACES_API_DOC.md, Study/PLACE_PURPOSES.md, owner docs/verification/progress, run convergence, then commit/push verified function (AC-P6).

Dependencies: T001/T002 → T003 → T004 → T005 → T006; one agent runs sequentially.


## Phase B: Active backend Circle place presence

- [x] T007 [US3] Implement pure dwell/quality/freshness/hysteresis/overlap transition in src/domain/placePresence.js (B-AC1).
- [x] T008 [US3] Add durable context epochs/projection models and atomic repository methods in src/infrastructure/database and repositories (B-AC2/B-AC3).
- [x] T009 [US3] Add context-validated projection/snapshot use cases, container wiring and isolated realtime hook in src/application/places/placePresenceUseCases.js, src/application/location/locationUseCases.js, src/container.js (B-AC2/B-AC3).
- [x] T010 [US3] Add bounded authorized snapshot DTO/controller/route/OpenAPI and tests/placePresence.test.js covering transitions, privacy/restart/invalidation/races (B-AC1..B-AC4).
- [x] T011 Synchronize api-docs/PLACES_API_DOC.md, Study/PLACE_PURPOSES.md and owner spec/contracts/model/verification/progress; regress, converge and deliver separate verified commit/push (B-AC4).

Dependencies: T007/T008 → T009 → T010 → T011. Mobile/personal GPS services and weather remain outside this backend function.
