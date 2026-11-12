# Tải ảnh và voice — contracts

Status: **Current behavior**, surveyed 2026-11-11. [Spec](spec.md) · [Models](data-model.md). HTTP base `/api/v1`; authentication/errors/DTO conventions: [shared API conventions](../../system/api-conventions.md). Socket handshake/rooms: [shared realtime contract](../../system/realtime.md).

## HTTP

| Method/path | Input | Success response / authorization / errors |
|---|---|---|
| POST `/chat/upload-ticket` | conversationId ID; contentType image MIME; contentLength positive integer <=100MiB DTO ceiling | 201 data `{uploadUrl,method:"PUT",headers,key,fileUrl,expiresIn,expiresAt}`; membership and effective storage max; missing storage503. |
| POST `/chat/media/presigned-url` | conversationId ID; mediaType image/voice; extension normalized lowercase2…10 alphanumeric; mimeType; fileSize positive integer <=100MiB | 201 data `{uploadUrl,method:"PUT",headers,key,publicUrl,expiresIn,expiresAt}`; membership, matching MIME/extension and per-media configured size. |

Images: image/jpeg→jpg, png, webp, heic, heif, gif. Voice: audio/m4a or audio/mp4→m4a, audio/aac→aac, audio/mpeg→mp3, audio/ogg→ogg, audio/webm→webm, audio/wav→wav. Effective upload maximum comes from storage policy; DTO ceiling is not permission to upload that size. Ownership checks validate storage prefix/key scope, not prior ticket issuance or remote object bytes.

MessageView and SendMessage union are owned by [chat](../chat/contracts.md); uploads do not create a message themselves.
