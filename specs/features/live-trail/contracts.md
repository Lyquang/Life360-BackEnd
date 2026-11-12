# Live Trail và map matching — contracts

Status: **Current behavior**, surveyed 2026-11-11. [Spec](spec.md) · [Models](data-model.md). HTTP base `/api/v1`; authentication/errors/DTO conventions: [shared API conventions](../../system/api-conventions.md). Socket handshake/rooms: [shared realtime contract](../../system/realtime.md).

## HTTP

| Method/path | Validated input | Success response | Permission and special errors |
|---|---|---|---|
| GET `/history/:userId/journey/trail` | date?; afterSeq? integer>=0 requiring revision; revision? integer>=1; limit 1…500 default200 | 200 `{success,trailId,userId,date,timeZone,revision,lastSeq,points,gaps,matched,hasMore,nextAfterSeq}` | Feature disabled 503; otherwise location policy, absent trail404, revision conflict409 TRAIL_REVISION_CHANGED with data `{trailId,currentRevision,lastSeq}`; limiter429. |

Trail points: seq, latitude, longitude, recordedAt, optional accuracy/motionState/pointId. Seq is insertion order; chronological path order is(recordedAt,seq). Each page repeats full-trail gaps/current-revision matches. Gap and match shapes: [integration guide](../../../api-docs/LIVE_TRAIL_API_DOC.md).

## Client → server socket events

| Event | Payload / validation | Response and scope |
|---|---|---|
| `journey:watch` | userId24hex; calendar ISO date? | Ack `{ok:true,trailId,userId,date,revision,lastSeq}`; no points. Errors `{ok:false,status,code,message,errors?}` when ack supplied. Feature/access/limits checked before joining room. |
| `journey:unwatch` | same target/date | Ack `{ok:true,removed:boolean}`. Idempotent for absent registration; shares watch-action limiter. |

## Server → client socket events

| Event | Payload |
|---|---|
| `journey:trail_delta` | `{userId,trailId,revision,afterSeq,fromSeq,toSeq,points,matchedUpdates}`; points contain seq/latitude/longitude/recordedAt with optional accuracy/motionState/pointId. A match-only delta has points=[] and afterSeq at current insertion cursor. |
| `journey:trail_reset` | `{userId,trailId,revision}`; discard old snapshot and reload REST. |
| `journey:trail_closed` | `{userId,trailId,reason}` where reason permission_revoked/sharing_paused/trail_expired. |

Absent callback means a failing watch/unwatch has no emitted client error from this gateway; clients needing confirmation should provide ack. Chat and trail intentionally use different `success`/`ok` envelopes. Defaults/quotas are in [shared configuration](../../system/configuration.md).

Full-trail gaps/matches repeat across REST pages. Apply delta only when revision and afterSeq join local state; never assume seq adjacency or seq path order. Reload after409/reset and stop watch after closed; reconnect does not restore a watch registry. See [live-trail guide](../../../api-docs/LIVE_TRAIL_API_DOC.md) and [SOS guide](../../../api-docs/SOS_ASSISTANCE_API_DOC.md). No event establishes APNs/FCM, offline replay, exactly-once delivery or client read receipt unless an explicit application action supplies it.
