# Lịch sử vị trí và journey — data model

Status: **Current behavior**, source survey 2026-11-11. [Spec](spec.md) · [Schema conventions and ownership index](../../system/data-model.md). Model indexes are declared schema, not production-index validation.

| Model | Typed fields, validation/defaults and ownership |
|---|---|
| LocationHistory | Required userId/Point location (validated coordinates); timestamp Date now; optional trimmed pointId/dedupeKey, accuracy>=0, motionState enum. No timestamps or TTL. Repository fingerprint hashes measured timestamp+lat/lng, scoped by user. JSON maps id and flattened coordinates. |

## LocationHistory — `locationhistories`

**Schema paths:** `userId`, `location.type`, `location.coordinates`, `timestamp`, `pointId`, `dedupeKey`, `accuracy`, `motionState`.

**Indexes được khai báo:**

- `{"userId":1}`
- `{"timestamp":1}`
- `{"location":"2dsphere"}`
- `{"userId":1,"timestamp":-1}`
- `{"userId":1,"timestamp":1,"_id":1}`
- `{"userId":1,"pointId":1}` — `{"unique":true,"partialFilterExpression":{"pointId":{"$type":"string"}}}`
- `{"userId":1,"dedupeKey":1}` — `{"unique":true,"partialFilterExpression":{"dedupeKey":{"$type":"string"}}}`
