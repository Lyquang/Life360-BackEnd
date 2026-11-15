# Tasks: Routing

## Revision 2 execution queue (2026-11-14; not approved for code)

- [x] ROUTE-R2-01 Record user answers Q-MOB-27…31, conditional TomTom v1 choice and Mobile scope in spec/interview/research/progress.
- [ ] ROUTE-R2-02 Verify free account entitlement, applicable display/retention/navigation terms, v1 mode-specific Vietnam routes/traffic/quota; no credentials in docs or client. Gate before activation.
- [x] ROUTE-R2-03 Review proposed `specs/features/routing/contracts.md`, reconcile spec/plan/tasks with native analysis and resolve critical provider/retention/API blockers before implementation.
- [x] ROUTE-R2-04 Create Mobile `.spec/<next>-route-navigation/` spec/plan/tasks/review packet with design/localization/permission states and approved Backend contract; record explicit review scope in Mobile progress.
- [x] ROUTE-R2-05 Implement/test disabled-by-default Backend TomTom v1 adapter, preview DTO/route/Swagger and mode/alternative/traffic normalization; AC-ROUTE-01/02/03/08/09/11.
- [ ] ROUTE-R2-06 Implement/test account-scoped Mobile navigation session lifecycle and private navigation location opt-in, without backend ActiveTrip persistence; AC-ROUTE-10/12/13/14/15 and REQ-MOB-16. Historical AC-ROUTE-04/05/06 are out of this slice.
- [ ] ROUTE-R2-07 Implement/test Mobile MapKit route preview/selection, step progression, vi/en voice, bounded online reroute, stable arrival and offline continuation; AC-ROUTE-10/12/13/14/15.
- [ ] ROUTE-R2-08 Verify Backend regression plus Mobile simulator build/tests/localization/accessibility; then real account/Vietnam/device background pilot. Record unavailable checks honestly.
- [ ] ROUTE-R2-09 Deliver actual Backend API handoff/Swagger and Vietnamese Study, update Mobile study/verification and both progress files; run native converge, then scoped commit/push if complete.

Dependency: R2-02 gates activation; R2-03/R2-04 preceded implementation review. R2-05 precedes
Mobile API integration; R2-06 precedes recovery/lifecycle UI. R2-08/09 follow
implementation. AC-ROUTE-07 push/worker remains in context-alerts, outside this
queue. The checklist below is a historical draft; its unchecked items do not
authorize implementation or replace this queue.

---

## Historical draft (2026-11-12)

[Spec](spec.md) · [Plan](plan.md). Implementation pending design approval.

- [x] ROUTE-T01 Phân biệt route planner với GPS matcher, ghi lifecycle/acceptance draft.
- [ ] ROUTE-T02 Chốt modes/coverage/navigation scope, provider rights/quotas, expiry và reroute policy; P0, Q-MOB-01/02/05/06.
- [ ] ROUTE-T03 Adapter + port + preview DTO/routes/controller/Swagger, test AC-ROUTE-01/02/03.
- [ ] ROUTE-T04 ActiveTrip/repo/indexes/unit-of-work + start/end/owner API; local replica-set races/idempotency tests, AC-ROUTE-04/05/06.
- [ ] ROUTE-T05 Bounded traffic evaluation và versioned context cho alerts; test stale jobs, pause/end/off-route/restart, AC-ROUTE-05/07.
- [ ] ROUTE-T06 Mobile preview/alternatives/mode/start/end/freshness, phối hợp vị trí nền và push; device E2E.
- [ ] ROUTE-T07 Kiểm thử regression hiện hữu, coverage/cost pilot, docs/progress và rollout gate; chưa đánh dấu hoàn thành chỉ từ route preview.
- [x] ROUTE-T08 Ghi scope mới: chọn xe máy/ô tô/đi bộ và alternatives thật; giữ xe máy ưu tiên kiểm chứng, không hiểu thành motorcycle-only.
- [ ] ROUTE-T09 Chốt provider capability từng mode; thực hiện mode mapping/required DTO, alternative-route selection và invalidation; AC-ROUTE-08/09.
- [ ] ROUTE-T10 Mobile/backend tests cho mode switch, provider trả một tuyến, unsupported traffic/walking và trip revision đổi mode; xác minh chi phí ở P0.

## Phase 5: Convergence — local implementation review 2026-11-14

- [ ] T011 Verify account-specific TomTom v1 navigation/display/retention rights, Free entitlement and quota without exposing credentials; record permitted activation conditions per ROUTE-R2-02 (partial).
- [ ] T012 Add Mobile presentation/integration fixtures for mode switch, stale preview response, quota/no-route, persistent `other` warning and private navigation while Circle sharing is paused; verify logout/account switch cancellation per SC-001/SC-004 (partial).
- [ ] T013 Run real Vietnam motorcycle route and iPhone foreground/locked-screen/background/interruption/permission pilot, plus vi/en light/dark/large-text accessibility review; record evidence and defects per SC-002/FR-007 (missing).
- [ ] T014 Reconcile any pilot defects with approved scope, rerun affected Backend/Mobile checks and native convergence, then update verification/progress before scoped commit/push per ROUTE-R2-08/09 (partial).
