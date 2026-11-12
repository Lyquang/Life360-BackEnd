# Circle và thành viên — data model

Status: **Current behavior**, source survey 2026-11-11. [Spec](spec.md) · [Schema conventions and ownership index](../../system/data-model.md). Model indexes are declared schema, not production-index validation.

| Model | Typed fields, validation/defaults and ownership |
|---|---|
| Group | Required name String2…50, admin User ref; members User refs; unique inviteCode String generated six digits before save. Digest interval Number0…1440 default60, lastDigestSentAt Date null. Hidden sosGuardVersion Number used for transactional membership conflict. timestamps. JSON maps id/removes __v. |

## Group — `groups`

**Schema paths:** `name`, `inviteCode`, `members`, `admin`, `sosGuardVersion`, `notificationIntervalMinutes`, `lastDigestSentAt`, `createdAt`, `updatedAt`.

**Indexes được khai báo:**

- `{"inviteCode":1}` — `{"unique":true}`

Group schema stores digest interval/time, but their behavior and update API are owned by [group-digests](../group-digests/spec.md). Group conversation/membership schemas are owned by [chat](../chat/data-model.md); direct memberships survive Circle exit.
