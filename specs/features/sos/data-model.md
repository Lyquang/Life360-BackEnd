# SOS và nhận hỗ trợ — data model

Status: **Current behavior**, source survey 2026-11-11. [Spec](spec.md) · [Schema conventions and ownership index](../../system/data-model.md). Model indexes are declared schema, not production-index validation.

| Model | Typed fields, validation/defaults and ownership |
|---|---|
| SosIncident | Required owner/status(active default)/nonempty groupIds/revision positive safe integer default 1. Optional lowercase UUID clientRequestId, audience per-Circle recipient refs, unique-recipient refs, message<=500 default empty, battery0…100, location null or validated numeric pair with optional Date, closedAt Date null. timestamps; no TTL/expiry field. Audience refs are internal, not returned to client. |
| SosResponse | Required sosId/responderId/status coming default coming. respondedAt is creation timestamp; no updatedAt or TTL. Unique incident+responder. |
| SosOutbox | Required unique eventKey<=200, kind chat_message/sos_alert/sos_updated, incident/recipient refs, revision positive safe integer, nextAttemptAt now. messageId required only chat_message; status pending/processing/delivered/failed/discarded default pending, attempts>=0 default 0, leaseUntil/token/deliveredAt nullable. timestamps; reference-only, no payload/token/GPS snapshot and no TTL. |

## SosIncident — `sos_incidents`

**Schema paths:** `ownerId`, `clientRequestId`, `status`, `groupIds`, `recipientIds`, `audience`, `message`, `batteryLevel`, `location`, `revision`, `closedAt`, `createdAt`, `updatedAt`.

**Indexes được khai báo:**

- `{"ownerId":1}` — `{"unique":true,"partialFilterExpression":{"status":"active"}}`
- `{"ownerId":1,"clientRequestId":1}` — `{"unique":true,"partialFilterExpression":{"clientRequestId":{"$type":"string"}}}`
- `{"ownerId":1,"createdAt":-1,"_id":-1}`
- `{"ownerId":1,"status":1,"_id":-1}`
- `{"recipientIds":1,"status":1,"_id":-1}`

## SosResponse — `sos_responses`

**Schema paths:** `sosId`, `responderId`, `status`, `respondedAt`.

**Indexes được khai báo:**

- `{"sosId":1,"responderId":1}` — `{"unique":true}`
- `{"sosId":1,"_id":1}`

## SosOutbox — `sos_outbox`

**Schema paths:** `eventKey`, `kind`, `sosId`, `recipientId`, `messageId`, `revision`, `status`, `attempts`, `nextAttemptAt`, `leaseUntil`, `leaseToken`, `deliveredAt`, `createdAt`, `updatedAt`.

**Indexes được khai báo:**

- `{"eventKey":1}` — `{"unique":true}`
- `{"status":1,"nextAttemptAt":1,"_id":1}`
- `{"status":1,"leaseUntil":1}`
