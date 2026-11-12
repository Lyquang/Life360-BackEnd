# Circle và thành viên — discrepancies and questions

Survey 2026-11-11. Records retain their original stable IDs and status. No runtime fix or product approval is implied by documentation migration. [Spec](spec.md) · [All record owners](../../system/discrepancies.md).

## Discrepancies

| ID | Conflicting evidence / current behavior | Impact and disposition |
|---|---|---|
| D-09 | `groupUseCases` error suggests transferring ownership/deleting Circle before admin leaves; no such mutation routes exist in `groupRoutes.js`. | Admin leave/remove remains 409. Ownership transfer/deletion is unimplemented, not an available recovery API. |
