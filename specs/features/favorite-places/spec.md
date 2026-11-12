# Địa điểm yêu thích

Status: **Current behavior** | Survey: 2026-11-11 | Legacy survey scope: CB-02 — places slice.

Tạo và liệt kê địa điểm của Circle, category và GeoJSON; chưa có update/delete.

[Contracts](contracts.md) · [Data model](data-model.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

Places require current Circle membership; create converts lat/lng to GeoJSON and populates adding user; list sorts newest first. There are no place update/delete routes.

Evidence: places/digests use cases and repositories, `tests/api.test.js`, `tests/observabilityWorkflows.test.js`. Operational limits and quality gates are in [configuration](../../system/configuration.md) and [validation](../../system/validation.md).

## Source and existing verification

- [src/application/places/placeUseCases.js](../../../src/application/places/placeUseCases.js)
- [src/infrastructure/repositories/placeRepository.js](../../../src/infrastructure/repositories/placeRepository.js)
- [src/presentation/http/routes/groupRoutes.js](../../../src/presentation/http/routes/groupRoutes.js)
- [src/presentation/dto/group.schemas.js](../../../src/presentation/dto/group.schemas.js)

Existing tests (survey evidence; not a new test run):

- [tests/api.test.js](../../../tests/api.test.js)

## Cross-feature changes

[Circle và thành viên](../circles/spec.md).

No additional product approval is inferred from this split. When behavior changes, record the confirming instruction and observable acceptance criteria here; add a concrete plan/tasks only for actual work.
