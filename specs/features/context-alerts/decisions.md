# Context alerts — accepted decisions

Date: 2026-11-12. [Spec](spec.md) · [Plan](plan.md) · [Roadmap](../../system/mobility-roadmap.md).

| ID | Status | Decision / acceptance | Authority |
|---|---|---|---|
| DEC-ALERT-01 | Accepted; not implemented | Persist generated noteworthy alerts and minimal delivery state in DB, retain 7 days for inbox/recovery/dedup. Upstream forecasts/traffic use permitted short-lived cache; do not persist every poll or generate normal/sunny-weather notifications. Same episode does not notify on every poll; additional warnings require a meaningful approved escalation. | User: “Tôi đồng ý với đề xuất của bạn” following the concrete recommendation, 2026-11-12 |

Seven-day retention does not keep a warning live or push-eligible for seven days;
forecast/context freshness and expiresAt still apply. Specific severe-weather
types, numeric thresholds, quiet hours, provider/budget and background runtime
remain unresolved; acceptance of the recommendation does not silently approve
every candidate value in the earlier plan. No runtime implementation is present.
