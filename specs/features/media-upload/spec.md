# Tải ảnh và voice

Status: **Current behavior** | Survey: 2026-11-11 | Legacy survey scope: CB-06 — media slice.

Cấp presigned PUT, MIME/extension/kích thước và key ownership của media; object bytes đi thẳng tới storage.

[Contracts](contracts.md) · [Data model](data-model.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

1. Image/voice URLs must resolve under configured public storage prefix and match the user's conversation-scoped key pattern. This validates namespace ownership; it does not query an issued-ticket ledger or perform a HEAD/byte-content check on the object.
2. Ticket flow: validate size/MIME/extension + membership → generate UUID key → presign PUT bound to content type/length → client uploads directly → client sends message URL. New tickets use `chats/`; legacy image tickets use `chat/`. Missing storage yields 503. Media cache is optional metadata, not durable object verification.

## Source and existing verification

- [src/application/chat/chatUseCases.js](../../../src/application/chat/chatUseCases.js)
- [src/domain/media.js](../../../src/domain/media.js)
- [src/infrastructure/storage/s3Storage.js](../../../src/infrastructure/storage/s3Storage.js)
- [src/infrastructure/storage/CloudflareR2StorageService.js](../../../src/infrastructure/storage/CloudflareR2StorageService.js)
- [src/presentation/dto/chat.schemas.js](../../../src/presentation/dto/chat.schemas.js)

Existing tests (survey evidence; not a new test run):

- [tests/upload.test.js](../../../tests/upload.test.js)
- [tests/observabilityWorkflows.test.js](../../../tests/observabilityWorkflows.test.js)

## Cross-feature changes

[Chat nhóm và trò chuyện riêng](../chat/spec.md) · [Xác thực và phiên đăng nhập](../authentication/spec.md).

No additional product approval is inferred from this split. When behavior changes, record the confirming instruction and observable acceptance criteria here; add a concrete plan/tasks only for actual work.
