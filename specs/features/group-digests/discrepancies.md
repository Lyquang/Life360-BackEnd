# Digest trạng thái nhóm — discrepancies and questions

Survey 2026-11-11. Records retain their original stable IDs and status. No runtime fix or product approval is implied by documentation migration. [Spec](spec.md) · [All record owners](../../system/discrepancies.md).

## Discrepancies

| ID | Conflicting evidence / current behavior | Impact and disposition |
|---|---|---|
| D-08 | `api-docs` promise pause hides new digest coordinates. `digestUseCases.listDigests/getLatestDigest` return stored snapshots, without redacting old coordinates against current sharing state. | Q-02: retain historical snapshot visibility or redact on read? Current membership still required. No automatic data purge. |

## Questions

| ID | Current evidence | Decision / status |
|---|---|---|
| Q-02 | Old digest snapshots can contain locations collected before a pause. | Should pause hide historical snapshots from other current Circle members? Define privacy/retention intent before changing behavior. |
