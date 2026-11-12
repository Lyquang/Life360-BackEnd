# Live Trail và map matching — data model

Status: **Current behavior**, source survey 2026-11-11. [Spec](spec.md) · [Schema conventions and ownership index](../../system/data-model.md). Model indexes are declared schema, not production-index validation.

| Model | Typed fields, validation/defaults and ownership |
|---|---|
| LiveTrail | Required userId/localDate YYYY-MM-DD/timeZone/revision>=1 default 1/lastSeq>=0 default 0/expiresAt. maxRecordedAt Date null, timestamps. Uniqueness is user+localDate; timezone is stored but not part of that key. |
| LiveTrailPoint | Required trail/user refs, seq>=1, validated Point, recordedAt Date, trimmed dedupeKey, expiresAt. Optional accuracy>=0, motionState, pointId. createdAt only. seq is insertion order; path sorts measured time/seq. |
| LiveTrailMatch | Required trail/user/revision>=1/segmentId/fromSeq>=1/toSeq>=1/status provisional-final-unmatched/matcher provider+version/sourceRevision/expiresAt; geometry encoding polyline6/data optional; confidence0…1 optional. timestamps. Durable cache is keyed by source hash/revision/window context; final matches are preserved within revision. |

## LiveTrail — `livetrails`

**Schema paths:** `userId`, `localDate`, `timeZone`, `revision`, `lastSeq`, `maxRecordedAt`, `expiresAt`, `createdAt`, `updatedAt`.

**Indexes được khai báo:**

- `{"userId":1,"localDate":1}` — `{"unique":true}`
- `{"expiresAt":1}` — `{"expireAfterSeconds":0}`

## LiveTrailPoint — `livetrailpoints`

**Schema paths:** `trailId`, `userId`, `seq`, `location.type`, `location.coordinates`, `recordedAt`, `accuracy`, `motionState`, `pointId`, `dedupeKey`, `expiresAt`, `createdAt`.

**Indexes được khai báo:**

- `{"trailId":1,"seq":1}` — `{"unique":true}`
- `{"trailId":1,"pointId":1}` — `{"unique":true,"partialFilterExpression":{"pointId":{"$type":"string"}}}`
- `{"trailId":1,"dedupeKey":1}` — `{"unique":true}`
- `{"trailId":1,"recordedAt":1,"seq":1}`
- `{"expiresAt":1}` — `{"expireAfterSeconds":0}`

## LiveTrailMatch — `livetrailmatches`

**Schema paths:** `trailId`, `userId`, `revision`, `segmentId`, `fromSeq`, `toSeq`, `status`, `geometry.encoding`, `geometry.data`, `matcher.provider`, `matcher.version`, `confidence`, `sourceRevision`, `expiresAt`, `createdAt`, `updatedAt`.

**Indexes được khai báo:**

- `{"trailId":1,"revision":1,"segmentId":1}` — `{"unique":true}`
- `{"trailId":1,"revision":1,"fromSeq":1}`
- `{"sourceRevision":1}`
- `{"expiresAt":1}` — `{"expireAfterSeconds":0}`
