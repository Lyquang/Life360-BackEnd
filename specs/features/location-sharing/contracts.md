# Chia sẻ vị trí và privacy — contracts

Status: **Current behavior**, surveyed 2026-11-11. [Spec](spec.md) · [Models](data-model.md). HTTP base `/api/v1`; authentication/errors/DTO conventions: [shared API conventions](../../system/api-conventions.md). Socket handshake/rooms: [shared realtime contract](../../system/realtime.md).

## HTTP

| Method/path | Validated input | Success response | Permission and special errors |
|---|---|---|---|
| GET `/privacy/location-sharing` | none | 200 data `{enabled,pausedUntil,updatedAt}` | Self. `enabled` is effective state, not raw persisted flag. |
| PATCH `/privacy/location-sharing` | enabled boolean; pausedUntil? offset datetime/null | Same data, 200 | Self; enabled with non-null pause invalid; timed pause must be future and <=7 days. |
| POST `/locations/batch` | points array 1…configured max; each requires UUID pointId, latitude, longitude, offset recordedAt; accuracy>=0?, batteryLevel?, motionState? | 200 data `{accepted:UUID[],duplicates:UUID[],rejected:[{index,pointId,code,reason}]}` | Self; paused 403 LOCATION_SHARING_PAUSED; envelope/schema limit errors 400; per-user limiter 429. Invalid points alone can all be rejected with HTTP 200. |

Batch permanent point codes: INVALID_POINT_ID, INVALID_LATITUDE, INVALID_LONGITUDE, INVALID_RECORDED_AT, INVALID_ACCURACY, INVALID_BATTERY_LEVEL, INVALID_MOTION_STATE, INVALID_POINT, RECORDED_AT_IN_FUTURE, RECORDED_AT_TOO_OLD. The rejection pointId may be raw invalid text or null, not always a valid UUID.

## Client → server socket events

| Event | Payload / validation | Response and scope |
|---|---|---|
| `update_location` | numeric latitude/longitude; batteryLevel? clamped; recordedAt? offset ISO; accuracy?>=0; UUID pointId?; motionState? stationary/walking/running/cycling/automotive/unknown | No success ack. Schema failure `error:{message,errors}`; business failure `{code,message}`; unexpected error generic message. Broadcast `location_update` to each current Circle, excluding sending socket. |

## Server → client socket events

| Event | Payload |
|---|---|
| `member_online` | `{userId,name,isOnline:true,timestamp}`; emitted to Circles on connect. |
| `member_offline` | `{userId,name,isOnline:false,lastSeenAt,timestamp}`; only after last current user socket disconnects. |
| `location_update` | `{userId,name,latitude,longitude,batteryLevel,timestamp,recordedAt,durationAtLocation,durationSince,durationFormatted,accuracy?,motionState?}`; timestamp aliases effective GPS time. |
| `location_stay_alert` | `{type:"STAY_ALERT",userId,name,latitude,longitude,durationMinutes,durationFormatted,durationSince,groupId,groupName,message,timestamp}`. |
