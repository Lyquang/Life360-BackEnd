# Tasks: Routing

[Spec](spec.md) · [Plan](plan.md). Implementation pending design approval.

**Review needed — 2026-11-13:** danh sách dưới là task draft cũ, chưa bao phủ
REQ-MOB-13 in-app turn-by-turn/voice và constraint free-only. Xem [progress](progress.md).
Chưa tái sinh tasks/analyze hoặc bắt đầu code; giữ các ID/completion evidence cũ.

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
