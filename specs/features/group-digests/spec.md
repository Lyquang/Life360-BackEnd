# Digest trạng thái nhóm

Status: **Current behavior** | Survey: 2026-11-11 | Legacy survey scope: CB-02 — settings slice; CB-08 — digest slice.

Cài chu kỳ, tạo/phát/lưu digest, đọc list/latest và privacy của snapshot lịch sử.

[Contracts](contracts.md) · [Data model](data-model.md) · [Discrepancies / questions](discrepancies.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

Digest scheduler calls every minute. Enabled intervals are 1…1440 minutes (0 disables); only due Circles with connected sockets receive a new snapshot. It emits, persists snapshot and advances group send time as separate operations. Overlapping/multi-instance jobs have no distributed lock/exactly-once guarantee. List/latest require current Circle membership; snapshots expire via 30-day TTL. Summaries use Vietnamese text; no locale negotiation layer is present.

Evidence: places/digests use cases and repositories, `tests/api.test.js`, `tests/observabilityWorkflows.test.js`. Operational limits and quality gates are in [configuration](../../system/configuration.md) and [validation](../../system/validation.md).

## Source and existing verification

- [src/application/digests/digestUseCases.js](../../../src/application/digests/digestUseCases.js)
- [src/presentation/jobs/digestScheduler.js](../../../src/presentation/jobs/digestScheduler.js)
- [src/infrastructure/repositories/digestRepository.js](../../../src/infrastructure/repositories/digestRepository.js)
- [src/presentation/http/controllers/groupController.js](../../../src/presentation/http/controllers/groupController.js)
- [src/presentation/dto/group.schemas.js](../../../src/presentation/dto/group.schemas.js)

Existing tests (survey evidence; not a new test run):

- [tests/api.test.js](../../../tests/api.test.js)
- [tests/observabilityWorkflows.test.js](../../../tests/observabilityWorkflows.test.js)
- [tests/locationSharingPrivacy.test.js](../../../tests/locationSharingPrivacy.test.js)

## Cross-feature changes

[Circle và thành viên](../circles/spec.md) · [Chia sẻ vị trí và privacy](../location-sharing/spec.md).

No additional product approval is inferred from this split. When behavior changes, record the confirming instruction and observable acceptance criteria here; add a concrete plan/tasks only for actual work.
