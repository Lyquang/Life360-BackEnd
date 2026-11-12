# SOS và nhận hỗ trợ — contracts

Status: **Current behavior**, surveyed 2026-11-11. [Spec](spec.md) · [Models](data-model.md). HTTP base `/api/v1`; authentication/errors/DTO conventions: [shared API conventions](../../system/api-conventions.md). Socket handshake/rooms: [shared realtime contract](../../system/realtime.md).

## HTTP

| Method/path | Input | Success response / authorization / errors |
|---|---|---|
| POST `/sos` | required UUID clientRequestId; message? trimmed<=500; paired latitude/longitude?; offset recordedAt? only with coordinates | 201 create /200 replay `{created,incident:CreationSummary}`; no Circle400, other active request409, fanout unavailable503. REST rejects batteryLevel. |
| GET `/sos` | status active/resolved/cancelled/expired/all default active; cursor? ID; limit1…100 default50 | 200 `{items:IncidentSnapshot[],hasMore,nextCursor}`, newest ID first, authorized rows filtered before limit. |
| GET `/sos/:id` | id ID; afterId? ID; limit1…100 default50 | 200 `{incident:IncidentSnapshot,responders,hasMore,nextAfterId}`; owner or same original/current Circle audience; 403/404. Responders ID ascending and viewer-filtered before limit. |
| POST `/sos/:id/responses` | `{status:"coming"}` | 201 /200 replay `{created,sosId,revision,response:{id,responderId,status,respondedAt}}`; authorized non-owner; self400, new response to closed409. |
| PATCH `/sos/:id` | `{status:"resolved"\|"cancelled"}` | 200 `{changed,incident:CreationSummary+closedAt}`; owner only403; same closure replay, different closure409. |

All routes require Bearer and share the per-account SOS REST quota. Valid requests return503 when feature/transaction support unavailable; malformed/auth/rate-limited requests may be rejected earlier. See [SOS guide](../../../api-docs/SOS_ASSISTANCE_API_DOC.md) for exact nested summary/snapshot types and retry semantics.

CreationSummary: `{id,ownerId,status,revision,groupCount,recipientCount,createdAt}`. IncidentSnapshot: `{id,ownerId,status,revision,message,location,groupIds,createdAt,closedAt}`. Location is null or `{latitude,longitude,recordedAt?}`. Counts are original audience summaries, never delivery/read counts. Owner retains history; new joiners do not acquire incident access. No automatic expiry implementation despite reserved `expired` status.

## Client → server socket events

| Event | Payload / validation | Response and scope |
|---|---|---|
| `sos_alert` | optional/null object; message? trimmed<=500; independent latitude?/longitude?; batteryLevel?; UUID clientRequestId?; offset recordedAt? | No callback ack; listen for `sos_confirmed` or `error`. Legacy confirms message/groupCount; persisted path adds sosId/status/revision/created and uses transactional outbox. Incomplete coordinate pair stores no location. Explicit SOS allowed while sharing paused. |

## Server → client socket events

| Event | Payload |
|---|---|
| Legacy `sos_alert` | `{type:"SOS",userId,name,message,latitude?,longitude?,batteryLevel?,timestamp,groupId,groupName}` per Circle; no durable ID. |
| Persisted `sos_alert` | Legacy fields plus `{eventId,sosId,revision,ownerId,status,location,createdAt}`; coordinates/battery may be absent; one eligible Circle represents the deduplicated per-recipient event. timestamp is incident creation time. |
| `sos:updated` | `{eventId,sosId,revision}`; invalidation only, fetch authorized detail for responders. |
| `sos_confirmed` | `{message,groupCount,sosId?,status?,revision?,created?}`; durable-path success means commit/enqueue, not recipient receipt. |
