# Feature documentation reorganization — 2026-11-11

Status: Complete. Authority: user explicitly approved splitting the system survey into shared system documentation and separately owned feature specifications. This changes documentation layout only; it does not change runtime behavior or approve unresolved product decisions.

## Requirements and design

- Move shared architecture, configuration, dependencies, transport conventions, inventory and survey evidence into `specs/system/`.
- Create ten feature scopes: authentication, circles, chat, media-upload, location-sharing, location-history, live-trail, sos, group-digests and favorite-places. Each has a short entry spec, its contracts and model details; only create decision/discrepancy files where there are records to own.
- Give each endpoint, socket event, Mongoose model, discrepancy and open question a single primary owner. Cross-feature effects link to their owners; do not duplicate business rules as competing sources of truth.
- Preserve all existing field/index/contract details, evidence and stable REQ/DEC/CB/D/Q IDs. REQ-CHAT-01 remains explicitly accepted. Other observed behaviors remain Current behavior; open questions remain open.
- Update root navigation, AGENTS guidance, graph README and templates. Remove the former combined folder only after migrated content has passed ownership/completeness checks.
- Runtime sources, tests, configuration, inventoried hashes and generated Graphify artifacts must stay unchanged. The static code graph does not need regeneration for a documentation-only move.

## Tasks and acceptance

- [x] M001 Read existing specs and graph report; identify shared content and feature ownership.
- [x] M002 Move shared docs/evidence and split feature flows, HTTP/socket contracts, models and decisions/questions without loss.
- [x] M003 Update navigation, AI reading workflow, templates and all active references to moved paths; retire the combined folder.
- [x] M004 Verify every previous contract row/model detail/index/decision/question is retained under its primary owner, local links/anchors resolve, 218 source hashes match and generated graph artifacts remain identical.
- [x] M005 Record results and limitations in PROGRESS.md; do not present old runtime test results as a new test run.

## Migration map

| Former combined artifact | New owner |
|---|---|
| `spec.md` | Root feature navigation and the ten `features/*/spec.md` entry points |
| `plan.md`, shared lifecycle in `flows.md` | `architecture.md` and links to feature flows |
| `operations.md` | `configuration.md`, `dependencies.md`, `observability.md`, `validation.md` |
| `data-model.md` | `data-model.md` ownership index and feature-local `data-model.md` files |
| `contracts/http.md`, `contracts/socket.md` | `api-conventions.md`, `realtime.md`, `observability.md` and feature-local `contracts.md` files |
| `decisions.md` | System governance decisions and chat's REQ-CHAT-01 decision |
| `discrepancies.md` | System index plus feature-owned discrepancy/question records |
| `source-inventory.md/json` | Same filenames under `system/`; original read ledger/hash values preserved |
| `quickstart.md` | `validation.md`; graph refresh/freshness and previous validation evidence retained |
| `research.md`, `tasks.md`, checklist | `research.md` and `survey-history.md`; historical records explicitly labelled |

The old combined source folder was `specs/002-family-tracker-backend/`. This map is historical provenance, not an active instruction to read retired paths.

## Validation result

- All ten feature folders have concrete spec/contracts/model content; only scopes with existing records have decisions/discrepancy files. No empty feature plans/tasks were created.
- Preserved all 42 HTTP contract rows, 7 client-event rows, 17 server-event rows and 16 complete typed schema/index blocks, with each primary owner unique. Shared session:ready/handshake/room contract remains in system realtime.
- Retained all 13 discrepancy records and six questions without changing approval/status, including the resolved Q-01. System index points to feature owners rather than duplicating their detailed records.
- REQ-CHAT-01's acceptance/authority row was moved verbatim into chat/decisions.md before Markdown table escaping; it has one canonical owner. Model/contract table pipes were escaped for correct rendering without changing values.
- 623 local links resolve; all 218 inventoried source/config/test hashes match the original survey; four generated Graphify artifacts are byte-identical to the pre-migration snapshot. Only the graph README's documentation paths changed.
- Refreshed the ignored context skeleton after the move and checked git whitespace/diff scope. Runtime tests were not rerun for this documentation-only change; earlier 277/277 results remain explicitly historical evidence in validation/survey-history.

## Maintenance outcome

Start at specs/README.md, choose the feature owner, read its spec and only relevant contracts/models/records, then follow cross-feature links as needed. System docs are shared context, not another combined business specification. Stable identifiers, unresolved questions, source read evidence and user approvals remain intact.
