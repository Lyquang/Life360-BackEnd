# Shared HTTP conventions

The tables below are **Current behavior**, verified against all routes, DTOs, controllers, use cases and models on 2026-11-11. They are not blanket approval of product intent; see [governance decisions](decisions.md) and [record owner index](discrepancies.md). Source paths in this document are repository-relative.

- `ID`: 24 hex characters, HTTP DTO normalizes lowercase. Dates are ISO-8601 with offset where specified; JSON dates serialize as strings. Coordinates are numeric latitude -90…90 / longitude -180…180; battery values clamp to 0…100.
- Most Zod objects strip unknown keys. SOS request/query objects and conversation metadata patch are strict; do not assume every DTO rejects unknown keys. Body defaults differ: logout defaults to `{}`, mark-read expects an object.
- Successful response is usually `{success:true,data:T}` with optional message/count. History/trail put result fields at the top level; digest pagination and groupSettings are also top-level. Health/socket-info are special shapes. Do not use one mandatory `data` envelope for every endpoint.
- App errors: `{success:false,code,message,errors?:[{field,message}],data?:object}`. Validation uses 400 `VALIDATION_ERROR`; malformed JSON 400 `BAD_REQUEST`; body overflow 413 `PAYLOAD_TOO_LARGE`; unknown route 404 `NOT_FOUND`; unexpected error 500 `INTERNAL_ERROR` (production generic message). Rate-limit responses use 429 `RATE_LIMITED`.
- Protected routes authenticate Bearer before business validation. Public register/login/social/refresh have IP limiters; batch/trail/SOS have authenticated-user limiters. Nonexistent resources can yield 403 before 404 where membership is checked first. Status columns below list main successful/business outcomes, in addition to common 400/401/413/500 errors.

Feature-specific endpoints/types live in each [feature contracts file](../README.md); operational endpoints belong to [observability](observability.md).
