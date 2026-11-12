# Chia sẻ vị trí và privacy — discrepancies and questions

Survey 2026-11-11. Records retain their original stable IDs and status. No runtime fix or product approval is implied by documentation migration. [Spec](spec.md) · [All record owners](../../system/discrepancies.md).

## Discrepancies

| ID | Conflicting evidence / current behavior | Impact and disposition |
|---|---|---|
| D-06 | Older descriptions say 50m OR 30s and batch emits no realtime events. Source has opt-in dense history and live-trail reset/matching after batch. | Correct scope: batch never emits `location_update`/stay alerts; trail resets are possible when enabled. Defaults and flags matter. |
