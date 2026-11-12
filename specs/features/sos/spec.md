# SOS và nhận hỗ trợ

Status: **Current behavior** | Survey: 2026-11-11 | Legacy survey scope: CB-07.

SOS legacy/persisted, audience theo Circle, tạo/đọc/list/respond/close, chat server-owned và outbox.

[Contracts](contracts.md) · [Data model](data-model.md) · [Discrepancies / questions](discrepancies.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

Legacy socket SOS broadcasts per Circle without persistence when SOS API is disabled. Enabled SOS requires outbox flag and transaction-capable MongoDB. REST uses strict DTO and required clientRequestId UUID; legacy socket UUID is optional and incomplete coordinate pairs are dropped for compatibility.

Create snapshots each original Circle audience and deduplicates urgent recipients across Circles. Sorted membership guards serialize with membership writes. A transaction commits incident + per-Circle server chat + sender read pointers + reference-only outbox. Capacity overflow/unavailable chat rolls back; same UUID replays even after closure; another UUID during active SOS conflicts. One active SOS per owner is enforced by partial unique index.

Respond requires original AND current audience in the same Circle, forbids self-assistance and commits one response/person plus chat/revision/outbox. Owner sees historical responders; other viewers see only eligible responders, filtered before pagination. Existing response can replay after closure if authorized; new responses cannot. Owner may resolve/cancel idempotently; no reopen/automatic expiry.

Dispatcher atomically claims one reference job with expiring lease/token, reloads data and checks current access, then emits to user room. Revoked/closed urgent events are discarded; failures retry with bounded exponential jitter and ultimately fail. Stale lease cannot acknowledge a reclaimed job. `delivered` records successful transport invocation, not receipt/read or offline OS notification. Duplicate/out-of-order delivery remains possible; eventId enables deduplication. Serial scheduler drains active work on stop.

Evidence: SOS application/repositories/models/scheduler and all nine `tests/sos*.test.js` files; mobile guide `api-docs/SOS_ASSISTANCE_API_DOC.md`. No APNs/FCM, SOS-specific sharing lease or rescue-service integration exists in this source.

## Source and existing verification

- [src/application/sos/sosUseCases.js](../../../src/application/sos/sosUseCases.js)
- [src/application/sos/sosAccessPolicy.js](../../../src/application/sos/sosAccessPolicy.js)
- [src/application/sos/sosOutboxDispatcher.js](../../../src/application/sos/sosOutboxDispatcher.js)
- [src/presentation/http/routes/sosRoutes.js](../../../src/presentation/http/routes/sosRoutes.js)
- [src/presentation/jobs/sosOutboxScheduler.js](../../../src/presentation/jobs/sosOutboxScheduler.js)
- [src/infrastructure/repositories/sosRepository.js](../../../src/infrastructure/repositories/sosRepository.js)
- [src/infrastructure/repositories/sosOutboxRepository.js](../../../src/infrastructure/repositories/sosOutboxRepository.js)

Existing tests (survey evidence; not a new test run):

- [tests/sosAssistanceUseCase.test.js](../../../tests/sosAssistanceUseCase.test.js)
- [tests/sosChatOutbox.test.js](../../../tests/sosChatOutbox.test.js)
- [tests/sosCreateUseCase.test.js](../../../tests/sosCreateUseCase.test.js)
- [tests/sosDispatcher.test.js](../../../tests/sosDispatcher.test.js)
- [tests/sosHttp.test.js](../../../tests/sosHttp.test.js)
- [tests/sosList.test.js](../../../tests/sosList.test.js)
- [tests/sosPersistence.test.js](../../../tests/sosPersistence.test.js)
- [tests/sosScheduler.test.js](../../../tests/sosScheduler.test.js)
- [tests/sosSocket.test.js](../../../tests/sosSocket.test.js)

## Cross-feature changes

[Xác thực và phiên đăng nhập](../authentication/spec.md) · [Circle và thành viên](../circles/spec.md) · [Chat nhóm và trò chuyện riêng](../chat/spec.md) · [Chia sẻ vị trí và privacy](../location-sharing/spec.md).

No additional product approval is inferred from this split. When behavior changes, record the confirming instruction and observable acceptance criteria here; add a concrete plan/tasks only for actual work.
