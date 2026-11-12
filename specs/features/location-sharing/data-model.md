# Chia sẻ vị trí và privacy — data model

Status: **Current behavior**, source survey 2026-11-11. [Spec](spec.md) · [Schema conventions and ownership index](../../system/data-model.md). Model indexes are declared schema, not production-index validation.

This feature owns behavior of `User.locationSharing` (enabled/pausedUntil/updatedAt), `lastKnownLocation`, battery/presence/lastSeenAt and optional cached latest GPS. The complete User schema/index definition is maintained by [authentication](../authentication/data-model.md). Process-local lastSavedLocation/durationTracker Maps are not collections. Persisted raw points belong to [LocationHistory](../location-history/data-model.md); trail points belong to [Live Trail](../live-trail/data-model.md). Pause changes effective sharing and runtime/cache state; it does not delete history.
