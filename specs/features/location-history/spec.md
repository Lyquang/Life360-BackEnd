# Lịch sử vị trí và journey

Status: **Current behavior** | Survey: 2026-11-11 | Legacy survey scope: CB-03 — history slice.

Đọc today/range, cursor và journey stay/moving/geometry; không quản lý snapshot/watch Live Trail.

[Contracts](contracts.md) · [Data model](data-model.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

History reads authorize self or shared Circle with target sharing enabled. Today mode queries local `[start,end)`; range mode uses inclusive endpoints and exclusive `(timestamp,_id)` cursor. Journey builds stay/moving segments; geometry mode adds sorted/deduplicated points, thinning, gap boundaries, stable IDs and observation quality. Temporal gaps within stay radius can remain inferred stays. Thinning preserves boundaries; the configured point cap is best-effort when mandatory gap endpoints exceed it.

History persistence policy belongs to the history domain and is invoked by [location-sharing ingestion](../location-sharing/spec.md); Live Trail has a [separate owner](../live-trail/spec.md).

## Source and existing verification

- [src/application/history/historyUseCases.js](../../../src/application/history/historyUseCases.js)
- [src/domain/journey.js](../../../src/domain/journey.js)
- [src/domain/routeGeometry.js](../../../src/domain/routeGeometry.js)
- [src/domain/historyPersistence.js](../../../src/domain/historyPersistence.js)
- [src/infrastructure/repositories/locationHistoryRepository.js](../../../src/infrastructure/repositories/locationHistoryRepository.js)
- [src/presentation/dto/history.schemas.js](../../../src/presentation/dto/history.schemas.js)

Existing tests (survey evidence; not a new test run):

- [tests/locationHistoryRange.test.js](../../../tests/locationHistoryRange.test.js)
- [tests/historyPersistence.test.js](../../../tests/historyPersistence.test.js)
- [tests/journeyEnrichment.test.js](../../../tests/journeyEnrichment.test.js)
- [tests/routeGeometry.test.js](../../../tests/routeGeometry.test.js)

## Cross-feature changes

[Chia sẻ vị trí và privacy](../location-sharing/spec.md) · [Circle và thành viên](../circles/spec.md) · [Live Trail và map matching](../live-trail/spec.md).

No additional product approval is inferred from this split. When behavior changes, record the confirming instruction and observable acceptance criteria here; add a concrete plan/tasks only for actual work.
