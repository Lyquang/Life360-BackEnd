# Live Trail và map matching — discrepancies and questions

Survey 2026-11-11. Records retain their original stable IDs and status. No runtime fix or product approval is implied by documentation migration. [Spec](spec.md) · [All record owners](../../system/discrepancies.md).

## Discrepancies

| ID | Conflicting evidence / current behavior | Impact and disposition |
|---|---|---|
| D-07 | `LIVE_TRAIL_API_DOC.md` section 10 says real provider not configured; section 12 and `MapboxMapMatcher.js` describe an implemented Mapbox adapter. | Adapter implementation confirmed; production enablement remains unknown. Record both instead of claiming it is deployed. |
