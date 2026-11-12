# Chia sẻ vị trí và privacy

Status: **Current behavior** | Survey: 2026-11-11 | Legacy survey scope: CB-03 — ingestion slice; CB-04.

Nhận GPS realtime, đồng bộ batch offline, last-known location, presence, stay alerts và pause/resume toàn tài khoản.

[Contracts](contracts.md) · [Data model](data-model.md) · [Discrepancies / questions](discrepancies.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

Socket `update_location` checks sharing policy and DTO. Missing timestamp uses server time; valid ISO outside 24-hour past/60-second future window falls back to server time. Battery is clamped. Redis last location is compare-if-newer. History policy is legacy 50m OR 30s, or dense opt-in (moving interval AND distance, motion change, idle heartbeat, late-arrival handling). User's last-known location advances only to a newer timestamp. Stay tracking uses server clock and a 50m radius, with 30/60/120/240/480/1440-minute milestones.

Live-trail projection/matching follows, independently of history throttling. A successfully projected late trail point suppresses the normal current-marker broadcast. With trail disabled, a late realtime point can still be broadcast even though MongoDB/cache latest state does not regress. Do not infer a universal no-late-broadcast guarantee from no-last-known-regression tests.

Offline batch checks privacy, validates envelope, returns per-point schema/time rejections, stable-sorts and deduplicates point IDs, and persists idempotently by pointId/fix fingerprint. Accepted/duplicate IDs are safe to remove from the client buffer. Newest eligible fix updates last-known state only if newer. Batch does not call stay tracking or emit `location_update`; enabled trail projection can emit reset and schedule matching. Partial validation success is HTTP 200; database failures can occur after some independent writes, so retry preserves IDs.

Pause applies account-wide, indefinitely or until a future time at most seven days away. Effective state resumes when pause expires; no expiry job is needed. Pause clears last-location cache/runtime trackers and revalidates target watches. Publishing and other-user history/trail reads are denied; self history remains accessible. New digests redact paused coordinates/durations. Explicit SOS remains independent. Historical digest read behavior is Q-02.

## Source and existing verification

- [src/application/location/locationUseCases.js](../../../src/application/location/locationUseCases.js)
- [src/application/location/syncLocationBatchUseCase.js](../../../src/application/location/syncLocationBatchUseCase.js)
- [src/application/privacy/privacyUseCases.js](../../../src/application/privacy/privacyUseCases.js)
- [src/application/privacy/locationAccessPolicy.js](../../../src/application/privacy/locationAccessPolicy.js)
- [src/presentation/socket/gateways/locationGateway.js](../../../src/presentation/socket/gateways/locationGateway.js)
- [src/presentation/dto/locationBatch.schemas.js](../../../src/presentation/dto/locationBatch.schemas.js)

Existing tests (survey evidence; not a new test run):

- [tests/locationRecordedAt.test.js](../../../tests/locationRecordedAt.test.js)
- [tests/locationBatch.test.js](../../../tests/locationBatch.test.js)
- [tests/locationDensePersistence.test.js](../../../tests/locationDensePersistence.test.js)
- [tests/locationSharing.test.js](../../../tests/locationSharing.test.js)
- [tests/locationSharingPrivacy.test.js](../../../tests/locationSharingPrivacy.test.js)

## Cross-feature changes

[Xác thực và phiên đăng nhập](../authentication/spec.md) · [Circle và thành viên](../circles/spec.md) · [Lịch sử vị trí và journey](../location-history/spec.md) · [Live Trail và map matching](../live-trail/spec.md) · [SOS và nhận hỗ trợ](../sos/spec.md) · [Digest trạng thái nhóm](../group-digests/spec.md).

No additional product approval is inferred from this split. When behavior changes, record the confirming instruction and observable acceptance criteria here; add a concrete plan/tasks only for actual work.
