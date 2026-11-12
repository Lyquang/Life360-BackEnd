# Digest trạng thái nhóm — data model

Status: **Current behavior**, source survey 2026-11-11. [Spec](spec.md) · [Schema conventions and ownership index](../../system/data-model.md). Model indexes are declared schema, not production-index validation.

| Model | Typed fields, validation/defaults and ownership |
|---|---|
| GroupDigest | Required groupId/groupName/intervalMinutes; members embed userId/name, online/lastSeen text, battery, optional coordinates/location time, duration/formatted/summary. sentAt Date now, no timestamps. Snapshot is historical, not a live join; old coordinates remain until record expires/deleted. |

## GroupDigest — `groupdigests`

**Schema paths:** `groupId`, `groupName`, `intervalMinutes`, `members`, `sentAt`.

**Indexes được khai báo:**

- `{"groupId":1}`
- `{"groupId":1,"sentAt":-1}`
- `{"sentAt":1}` — `{"expireAfterSeconds":2592000}`
