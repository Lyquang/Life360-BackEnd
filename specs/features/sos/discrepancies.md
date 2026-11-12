# SOS và nhận hỗ trợ — discrepancies and questions

Survey 2026-11-11. Records retain their original stable IDs and status. No runtime fix or product approval is implied by documentation migration. [Spec](spec.md) · [All record owners](../../system/discrepancies.md).

## Questions

| ID | Current evidence | Decision / status |
|---|---|---|
| Q-05 | SOS `expired` exists in schema/query but no expiry scheduler; no APNs/FCM or SOS-specific temporary location lease exists. | Are these future requirements? Do not mark them implemented or add them to current scope. |
