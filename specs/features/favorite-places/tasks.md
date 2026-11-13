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
