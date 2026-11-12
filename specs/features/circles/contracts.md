# Circle và thành viên — contracts

Status: **Current behavior**, surveyed 2026-11-11. [Spec](spec.md) · [Models](data-model.md). HTTP base `/api/v1`; authentication/errors/DTO conventions: [shared API conventions](../../system/api-conventions.md). Socket handshake/rooms: [shared realtime contract](../../system/realtime.md).

## HTTP

| Method/path | Input | Success response | Permission / business errors |
|---|---|---|---|
| POST `/groups` | name trimmed 2…50 | 201 data GroupWithConversation | Authenticated creator becomes admin/member. |
| GET `/groups` | none | 200 `{success,count,data:GroupWithConversation[]}` | Current user's Circles. |
| POST `/groups/join` | inviteCode six decimal digits | 200 data GroupWithConversation | 404 invalid code, 400 already member. |
| GET `/groups/:groupId/members` | groupId ID | 200 data `{groupId,groupName,inviteCode,conversationId,memberCount,members}` | Current Circle member; 403/404. |
| DELETE `/groups/:groupId/members/me` | groupId ID | 200 data `{groupId,conversationId,userId,left:true}` | Current non-admin member; admin 409. |
| DELETE `/groups/:groupId/members/:userId` | both ID | Same membership-result data, 200 | Admin only; target absent 404, admin target 409. |

`GroupWithConversation` is the serialized Group plus `conversationId`; create populates admin, list populates admin/members and join populates members. A missing backfilled conversation can appear as null in list. Member profiles use repository-selected fields (`name,email,avatar,isOnline,batteryLevel,locationSharing`) rather than full User.

## Server → client socket events

| Event | Payload |
|---|---|
| `group:membership_ended`, `group:member_left` | `{groupId,userId,removedBy}`; first to removed user's devices, second to remaining group room. |
