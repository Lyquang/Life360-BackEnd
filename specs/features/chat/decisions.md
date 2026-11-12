# Chat — accepted requirements and decisions

Authority/confirmation date: 2026-11-11. [Feature spec](spec.md) · [Q-01 resolution](discrepancies.md).

| ID | Status | Accepted intent / acceptance check | Authority |
|---|---|---|---|
| REQ-CHAT-01 | Accepted | A previously created direct 1–1 conversation remains usable after the two participants leave their shared Circle(s). Acceptance: ending the last shared Circle does not remove direct ConversationMember rows; both participants can still send/read that conversation. Opening/get-or-creating through `/conversations/direct` still follows current shared-Circle validation; the confirmation concerns continued use of an existing conversation. | User explicit confirmation in this session, 2026-11-11: “vẫn giữ nguyên như vậy dù cho hai người có rời Circle rồi vẫn có thể nhắn tin với nhau được” |

Evidence: `src/application/chat/chatUseCases.js` membership checks and `src/application/groups/groupUseCases.js` group-only cleanup. Existing `tests/chat.test.js` and `tests/circleExitPrivacy.test.js` cover the component policies; the exact post-exit direct-message scenario is not a dedicated regression test yet. No runtime implementation change is needed for this confirmed requirement.
