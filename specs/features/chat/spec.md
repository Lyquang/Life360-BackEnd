# Chat nhóm và trò chuyện riêng

Status: **Current behavior** | Survey: 2026-11-11 | Legacy survey scope: CB-06.

Hội thoại nhóm/1–1, text/image/voice, lịch sử, unread, read cursor, typing và metadata hội thoại.

[Contracts](contracts.md) · [Data model](data-model.md) · [Discrepancies / questions](discrepancies.md) · [Accepted decisions](decisions.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

**REQ-CHAT-01 — Accepted:** Existing private 1–1 chat remains usable after leaving shared Circles. Direct memberships are retained. Opening/get-or-creating a DM requires a shared Circle; subsequent send/read/list checks the direct ConversationMember, independently of Circle membership. A participant can use its existing conversation ID after leaving.

1. Require conversation membership before message operations. Text/image/voice share one use case for REST and socket. DTO strips unsupported ordinary-message fields; ordinary repository creation does not accept server-owned SOS metadata.
2. Persist message, then monotonically update conversation last-message and sender read cursor. These ordinary writes are not one transaction. Broadcast follows persistence; socket send excludes the initiating socket while REST includes all sockets. A lost response/retry of an ordinary send has no client idempotency key and can create another message.
3. History fetch uses newest-first ID paging then reverses each page for oldest-to-newest display. Mark read defaults to latest; explicit target must be in conversation. Atomic max prevents cursor regression; receipt emits only when advanced. Unread counts messages after cursor.

URL validation and upload issuance are owned by [media-upload](../media-upload/spec.md). Socket send limit is 20 messages/10s/connection; REST does not use that socket limiter.

## Source and existing verification

- [src/application/chat/chatUseCases.js](../../../src/application/chat/chatUseCases.js)
- [src/application/chat/chatMappers.js](../../../src/application/chat/chatMappers.js)
- [src/presentation/http/routes/chatRoutes.js](../../../src/presentation/http/routes/chatRoutes.js)
- [src/presentation/socket/gateways/chatGateway.js](../../../src/presentation/socket/gateways/chatGateway.js)
- [src/presentation/dto/chat.schemas.js](../../../src/presentation/dto/chat.schemas.js)
- [src/infrastructure/repositories/messageRepository.js](../../../src/infrastructure/repositories/messageRepository.js)

Existing tests (survey evidence; not a new test run):

- [tests/chat.test.js](../../../tests/chat.test.js)
- [tests/groupChatLifecycle.test.js](../../../tests/groupChatLifecycle.test.js)
- [tests/circleExitPrivacy.test.js](../../../tests/circleExitPrivacy.test.js)
- [tests/upload.test.js](../../../tests/upload.test.js)

## Cross-feature changes

[Xác thực và phiên đăng nhập](../authentication/spec.md) · [Circle và thành viên](../circles/spec.md) · [Tải ảnh và voice](../media-upload/spec.md) · [SOS và nhận hỗ trợ](../sos/spec.md).

**Accepted requirement:** [REQ-CHAT-01](decisions.md): existing private 1–1 conversations remain usable after the last shared Circle ends. Keep the original confirmation and acceptance criteria.
