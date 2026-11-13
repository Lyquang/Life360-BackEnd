# Tasks: Context alerts

[Spec](spec.md) · [Plan](plan.md). Product intent được yêu cầu; implementation chờ duyệt thiết kế.

- [x] ALERT-T01 Ghi explicit background requirement, source gaps, rules/worker/device/inbox design proposal.
- [ ] ALERT-T02 Chốt Q-MOB-02/03/05, weather resolution/coverage/licence, worker runtime/budget và mobile push/location capabilities.
- [ ] ALERT-T03 Pure weather/traffic rules + fake-clock freshness/unknown/threshold tests; AC-ALERT-01/02/03/05.
- [ ] ALERT-T04 Device/preferences/inbox models, repos, auth APIs, logout/rotation isolation; AC-ALERT-05/06 và migration/index review.
- [ ] ALERT-T05 Durable context scheduling + atomic alert/delivery/outbox + worker lease/backoff/dedup/reconciliation; AC-ALERT-03/07/08.
- [ ] ALERT-T06 Weather/push provider adapters, redaction, quota cap/circuit breaker và safe config; fake upstream tests, không gọi live mặc định.
- [ ] ALERT-T07 Nối GPS mới/privacy/trip lifecycle, loại stale batch/job và queued push sau revoke/reroute; regression GPS/SOS/chat/auth.
- [ ] ALERT-T08 Mobile permissions/registration/background GPS/visible push/deep links; AC-ALERT-04/06 trên iOS và Android thật, cả deny/offline/force-stop.
- [ ] ALERT-T09 Pilot coverage/latency/battery/cost, retention và rollback; chỉ bật sau cả backend/mobile gates; cập nhật actual evidence/progress.
- [x] ALERT-T10 Ghi REQ-MOB-09 chỉ cảnh báo điều kiện đáng chú ý, không nắng đẹp; tách đề xuất DB alert/delivery khỏi cache forecast và history search.
- [ ] ALERT-T11 Chốt phần Q-MOB-08 còn mở: loại hiện tượng/ngưỡng vào-ra/escalation. DB alert tối thiểu/retention 7 ngày đã được DEC-ALERT-01 duyệt, không hỏi lại.
- [ ] ALERT-T12 Episode dedup và normal/recovery/outage tests AC-ALERT-09/10; xác minh không tạo alert/delivery hoặc push khi normal, không gửi lặp cùng episode sau cache expiry.
- [x] ALERT-T13 Ghi confirmation DEC-ALERT-01 về DB alert/delivery 7 ngày, không normal-weather notification; không duyệt ngầm numerical thresholds/provider.
