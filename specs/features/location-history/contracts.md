# Lịch sử vị trí và journey — contracts

Status: **Current behavior**, surveyed 2026-11-11. [Spec](spec.md) · [Models](data-model.md). HTTP base `/api/v1`; authentication/errors/DTO conventions: [shared API conventions](../../system/api-conventions.md). Socket handshake/rooms: [shared realtime contract](../../system/realtime.md).

## HTTP

| Method/path | Validated input | Success response | Permission and special errors |
|---|---|---|---|
| GET `/history/:userId` today | userId ID; no from/to | 200 `{success,count,date,data:[{id,latitude,longitude,timestamp}]}` | Self or current shared Circle + target sharing enabled. |
| GET `/history/:userId` range | from?/to? offset datetime; positive integer limit?; opaque cursor?; from or to required for paging | 200 `{success,count,data,nextCursor,range:{from,to},timeZone,rangePolicy}` | Same policy; order/range/limit/cursor failures 400 BAD_REQUEST. Defaults 500/max1000/seven days; config may vary. |
| GET `/history/:userId/journey` | date? valid calendar YYYY-MM-DD; detail? `geometry`; includePath? string `true`/`false` only with geometry | 200 `{success,date,userId,summary,journey,timeZone?,geometryPolicy?}` | Same policy; no detail preserves legacy shape. |

History range rows add recordedAt (alias timestamp), optional accuracy/pointId. Endpoints inclusive; cursor exclusive and ordered timestamp/_id. Today uses the process local day `[start,end)`. Geometry fields and stay/moving union are detailed in [journey guide](../../../api-docs/JOURNEY_ROUTE_API_DOC.md); trail seq order differs from chronological path order, and every page repeats full-trail gaps and current-revision matches. Defaults and feature gates: [shared configuration](../../system/configuration.md).
