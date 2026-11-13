# Saved-place / presence engineering research

Date: 2026-11-13. Decisions reflect source inspection, not an external provider
choice or production deployment. Plan revisions A/B and the original interview
supply accepted scope. No new dependencies or remote data service used.

## Decision: personal labels separate from shared places

Rationale: REQ-MOB-17 permits different home/work for each Circle member. Keep
legacy category/coordinates shared, key labels by group/user/label. A shared purpose
field from the earlier proposal was superseded by the confirmed per-member rule.
Alternative: shared home/work property would misrepresent other members.

## Decision: write guard and CAS

Existing group membership transactions mutate Group. Snapshot-reading membership
while writing only a place does not force a conflict with leave. Write hidden
placeGuardVersion in the same transaction; compare revision in the place update
predicate. Accept missing revision as zero for older documents. New mutations
fail closed without a real transaction; legacy create/list preserve compatibility.
Observed/verified in tests/placeManagement.test.js (concurrent writes and rollback).

## Decision: durable minimal projection for GPS presence

A process-local duration tracker cannot survive restart or safely bind a label,
place revision, consent epoch and membership. A pure transition plus PlacePresence
stores IDs/epochs/times, not duplicate GPS history. Consume original recordedAt;
the existing location pipeline intentionally substitutes server time for certain
legacy timestamps, which must not manufacture live presence evidence. Offline
batch ingestion is not wired into this projection. Restrict projection work to
persisted realtime points; no provider calls on the GPS path.

## Decision: version counters supplement timestamps

Pause/resume can happen with identical Date milliseconds; updatedAt alone must not
resurrect a confirmed label. Increment hidden User.placePrivacyVersion atomically
when changing locationSharing; snapshot reads raw current privacy, not cached
profiles. Group membership version/time increments on join/remove; this safely
invalidates all projections in that Circle until fresh evidence. Place revision,
label identity/place ID and label updatedAt bind the remaining context. A global
place guard write does not change Group.updatedAt: housekeeping must not surface
as a user-visible group edit. Candidate state ignores older/equal source times.

## Decision: conservative quality and bounded snapshot

Default entry radius100m/exit150m, accuracy<=50m, dwell120s, continuity gap<=90s,
freshness300s and future tolerance5s are explicit prototype policy, not a GPS
accuracy promise. Account for the uncertainty radius; overlapping eligible labels
produce unknown. GET snapshots page member IDs (20 default, max100), revalidate
fresh membership/privacy and current place/label revisions, return one recognized
label or unknown without raw coordinates or the user's whole label list. TTL is
storage cleanup only; every read enforces freshness/context independently.

## Alternatives and limits

Computing current presence from LocationHistory alone was rejected: batch points,
legacy timestamp fallback and history throttling do not establish trustworthy live
context, and repeated unbounded history scans would add read cost. Emitting a label
on existing GPS payloads was avoided until explicit context-safe client support.
Polling snapshot is a valid backend handoff; Mobile screen/device/background QA is
not implied. Projection failures are caught after normal GPS handling so optional
presence cannot fail location updates. Read authorization linearizes during the
request; it cannot recall an already delivered HTTP response after a later revoke.
