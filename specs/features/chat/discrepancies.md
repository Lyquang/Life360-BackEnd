# Chat nhóm và trò chuyện riêng — discrepancies and questions

Survey 2026-11-11. Records retain their original stable IDs and status. No runtime fix or product approval is implied by documentation migration. [Spec](spec.md) · [All record owners](../../system/discrepancies.md).

## Discrepancies

| ID | Conflicting evidence / current behavior | Impact and disposition |
|---|---|---|
| D-05 | Swagger `Message.type` and REST send examples only show text/image; DTO, use case, mapper and `upload.test.js` support voice. `socketEventDocs.js` also omits newer SOS identity/update details. | Swagger/socket-info are incomplete indexes; use verified contracts and SOS integration guide. Updating runtime documentation generators is a separate code change. |

## Questions

| ID | Current evidence | Decision / status |
|---|---|---|
| Q-01 — Resolved | `chatUseCases.openDirectConversation` requires shared Circle; `sendMessage/listMessages/markRead` require ConversationMember only. Circle exit removes group-chat membership, not direct memberships. | User confirmed on 2026-11-11 that existing direct 1–1 conversations must remain usable after leaving Circles. Accepted as REQ-CHAT-01 in `decisions.md`; code retained. |

D-05 also affects [media-upload](../media-upload/contracts.md) and [SOS events](../sos/contracts.md); update affected contracts together when fixing generated Swagger/socket-info. Q-01 is resolved by [REQ-CHAT-01](decisions.md).
