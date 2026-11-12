# Địa điểm yêu thích — contracts

Status: **Current behavior**, surveyed 2026-11-11. [Spec](spec.md) · [Models](data-model.md). HTTP base `/api/v1`; authentication/errors/DTO conventions: [shared API conventions](../../system/api-conventions.md). Socket handshake/rooms: [shared realtime contract](../../system/realtime.md).

## HTTP

| Method/path | Input | Success response | Permission / business errors |
|---|---|---|---|
| POST `/groups/:groupId/places` | name trimmed 1…100; category restaurant/entertainment/cafe/shopping/other; latitude/longitude | 201 data FavoritePlace | Any current member; addedBy from auth. |
| GET `/groups/:groupId/places` | groupId ID | 200 `{success,count,data:FavoritePlace[]}` | Current member, newest created first. |

FavoritePlace serializes id, name/category/groupId/addedBy, GeoJSON location, flattened latitude/longitude and timestamps.
