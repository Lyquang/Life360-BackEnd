# Live Trail và map matching

Status: **Current behavior** | Survey: 2026-11-11 | Legacy survey scope: CB-05.

Projection theo ngày, snapshot/catch-up, seq/revision, watch/delta/reset/closed và matcher Noop/Fake/Mapbox.

[Contracts](contracts.md) · [Data model](data-model.md) · [Discrepancies / questions](discrepancies.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

Raw trail groups eligible points by configured local date and retains them separately from LocationHistory. Transactional append deduplicates pointId/fingerprint, allocates insertion seq and bumps revision for late points. REST returns seq-ordered pages, full-trail gaps/current-revision matches; path order is `(recordedAt,seq)`. Supplied stale revision gives 409 with reload metadata.

Watch authorizes and joins a trail room, returns metadata only and periodically revalidates (default 60s). Defaults: five watches/socket, 30 combined watch/unwatch actions/minute. Privacy/membership hooks revalidate immediately; remaining shared Circles preserve access. An unexpected revalidation error logs and retains the watch; the lease is not an absolute fail-closed expiry guarantee.

Deltas batch by points/bytes/timer; batch or late insertion resets queued deltas. Matcher builds bounded overlapping windows separated by gaps/poor accuracy, uses a durable source hash, timeouts, bounded queue/concurrency and a circuit breaker. Noop/fake/Mapbox adapters are wired; fake is rejected in production. Matcher/projection errors are fail-soft. Matches remain revision-scoped; oversized match publication can reset rather than emit an oversized payload.

Evidence: trail application/domain/repository/gateway modules; `liveTrail*`, `mapboxMapMatcher`, `locationSharingPrivacy`, `circleExitPrivacy` tests. No multi-instance coordination or mobile implementation was verified.

## Source and existing verification

- [src/application/history/liveTrailWatchUseCases.js](../../../src/application/history/liveTrailWatchUseCases.js)
- [src/application/location/liveTrailProjection.js](../../../src/application/location/liveTrailProjection.js)
- [src/application/location/liveTrailDeltaPublisher.js](../../../src/application/location/liveTrailDeltaPublisher.js)
- [src/application/location/liveTrailMatchingService.js](../../../src/application/location/liveTrailMatchingService.js)
- [src/presentation/socket/gateways/liveTrailGateway.js](../../../src/presentation/socket/gateways/liveTrailGateway.js)
- [src/infrastructure/repositories/liveTrailRepository.js](../../../src/infrastructure/repositories/liveTrailRepository.js)
- [src/infrastructure/matching/MapboxMapMatcher.js](../../../src/infrastructure/matching/MapboxMapMatcher.js)

Existing tests (survey evidence; not a new test run):

- [tests/liveTrailProjection.test.js](../../../tests/liveTrailProjection.test.js)
- [tests/liveTrailRead.test.js](../../../tests/liveTrailRead.test.js)
- [tests/liveTrailSocket.test.js](../../../tests/liveTrailSocket.test.js)
- [tests/liveTrailMatching.test.js](../../../tests/liveTrailMatching.test.js)
- [tests/liveTrailMatchingIntegration.test.js](../../../tests/liveTrailMatchingIntegration.test.js)
- [tests/liveTrailDeltaPublisher.test.js](../../../tests/liveTrailDeltaPublisher.test.js)
- [tests/mapboxMapMatcher.test.js](../../../tests/mapboxMapMatcher.test.js)

## Cross-feature changes

[Chia sẻ vị trí và privacy](../location-sharing/spec.md) · [Lịch sử vị trí và journey](../location-history/spec.md) · [Circle và thành viên](../circles/spec.md).

No additional product approval is inferred from this split. When behavior changes, record the confirming instruction and observable acceptance criteria here; add a concrete plan/tasks only for actual work.
