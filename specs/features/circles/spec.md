# Circle và thành viên

Status: **Current behavior** | Survey: 2026-11-11 | Legacy survey scope: CB-02.

Tạo/join Circle, danh sách thành viên, rời Circle và admin xóa thành viên; phối hợp membership group chat.

[Contracts](contracts.md) · [Data model](data-model.md) · [Discrepancies / questions](discrepancies.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

Create Circle writes Group + group Conversation + creator ConversationMember in one unit of work; join updates Circle and group-chat membership together. After commit, existing user sockets join rooms. Startup backfill ensures missing conversations/memberships idempotently. Standalone development uses the unit-of-work fallback without atomicity; production refuses standalone MongoDB.

Any current member can update digest interval or group-chat metadata. Only Circle admin may remove another member. Ordinary members can leave; admin cannot leave or be removed (409). Transfer/delete APIs are absent. End-membership removes Circle/group-chat rows in the same transaction, then emits membership notifications, removes rooms and revalidates trail access. Realtime cleanup failure is logged and does not undo committed membership.

Direct-conversation retention is owned by [chat](../chat/decisions.md); Circle exit only removes group-chat membership.

Evidence: `groupUseCases.js`, `chatUseCases.js`, group/conversation repositories; `tests/groupChatLifecycle.test.js`, `tests/circleExitPrivacy.test.js`, `tests/chat.test.js`. The private-chat post-exit scenario is also checked by the isolated validation recorded in [system validation](../../system/validation.md).

## Source and existing verification

- [src/application/groups/groupUseCases.js](../../../src/application/groups/groupUseCases.js)
- [src/presentation/http/routes/groupRoutes.js](../../../src/presentation/http/routes/groupRoutes.js)
- [src/infrastructure/repositories/groupRepository.js](../../../src/infrastructure/repositories/groupRepository.js)
- [src/infrastructure/repositories/conversationMemberRepository.js](../../../src/infrastructure/repositories/conversationMemberRepository.js)

Existing tests (survey evidence; not a new test run):

- [tests/groupChatLifecycle.test.js](../../../tests/groupChatLifecycle.test.js)
- [tests/circleExitPrivacy.test.js](../../../tests/circleExitPrivacy.test.js)
- [tests/api.test.js](../../../tests/api.test.js)

## Cross-feature changes

[Chat nhóm và trò chuyện riêng](../chat/spec.md) · [Chia sẻ vị trí và privacy](../location-sharing/spec.md) · [Live Trail và map matching](../live-trail/spec.md) · [SOS và nhận hỗ trợ](../sos/spec.md) · [Digest trạng thái nhóm](../group-digests/spec.md) · [Địa điểm yêu thích](../favorite-places/spec.md).

No additional product approval is inferred from this split. When behavior changes, record the confirming instruction and observable acceptance criteria here; add a concrete plan/tasks only for actual work.
