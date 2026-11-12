# Digest trạng thái nhóm — contracts

Status: **Current behavior**, surveyed 2026-11-11. [Spec](spec.md) · [Models](data-model.md). HTTP base `/api/v1`; authentication/errors/DTO conventions: [shared API conventions](../../system/api-conventions.md). Socket handshake/rooms: [shared realtime contract](../../system/realtime.md).

## HTTP

| Method/path | Input | Success response | Permission / business errors |
|---|---|---|---|
| PATCH `/groups/:groupId/notification-interval` | intervalMinutes integer 0…1440 | 200 data `{groupId,notificationIntervalMinutes}` | Any current member. 0 disables. |
| GET `/groups/:groupId/digests` | page >=1 default 1; limit 1…100 default 20; from?/to? coercible dates | 200 `{success,data:Digest[],pagination,groupSettings}` | Current member. No DTO constraint orders from/to. |
| GET `/groups/:groupId/digests/latest` | groupId ID | 200 `{success,data:Digest\|null,groupSettings,message?}` | Current member; no digest returns null and message. |

`pagination={currentPage,totalPages,totalItems,itemsPerPage,hasNextPage,hasPrevPage}`. `groupSettings={notificationIntervalMinutes,lastDigestSentAt}`. Digest is a stored snapshot; current pause does not redact historical snapshots (Q-02).

## Server → client socket events

| Event | Payload |
|---|---|
| `group_digest` | `{type:"GROUP_DIGEST",groupId,groupName,intervalMinutes,members,timestamp}`; members are status snapshots; paused member coordinates/durations omitted as null/zero in new snapshots. |
