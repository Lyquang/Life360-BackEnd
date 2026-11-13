# Requirements and decisions register

Date: 2026-11-11. This register distinguishes accepted repository policy from observed product behavior. Authority is the user's current setup request and supplied `AGENTS.md`, not inferred approval from code/tests.

| ID | Status | Accepted intent / acceptance check | Authority |
|---|---|---|---|
| REQ-DOC-01 | Accepted | Maintain `specs/` as the source of accepted requirements/design; keep CB, REQ, DEC and Q distinct. Disagreements have source evidence and remain open until decided. | User setup request, 2026-11-11 |
| REQ-DOC-02 | Accepted | Survey every owned source/config/test file in a defined boundary; list read status and hashes. No runtime edits during this survey. | User setup request |
| REQ-DOC-03 | Accepted; reference-retention superseded | Preserve user changes and use reference examples for organization only. Retaining the imported files was superseded by the subsequent explicit cleanup request; examples were removed after survey. | Initial setup request, followed by user cleanup request, 2026-11-11 |
| DEC-ARCH-01 | Accepted | Presentation validates and formats; application orchestrates via injected ports; infrastructure implements I/O; domain stays pure; dependencies wired in `src/container.js`. | Existing `AGENTS.md`, supplied by user |
| DEC-DOC-01 | Accepted process | For a behavior change, record requirements/design/tasks before or with implementation; verify acceptance and update docs/progress after. | User setup request; existing `AGENTS.md` |
| DEC-GRAPH-01 | Accepted scope | Official Graphify, local AST extraction, output scoped to `graphify-out/backend/`; no source/secrets uploaded and no manual graph editing. | User request and existing `AGENTS.md` |

## Feature intake and delivery workflow — accepted 2026-11-12

**REQ-DOC-04 — Accepted process.** User explicitly requested: read existing specs
as accepted-intent source of truth; update the owner for changes or create a new
feature folder; ask multiple focused questions to align requirements; deliver a
concrete plan for review; agree requirements/plan before implementation; complete
client integration docs in `api-docs/` and useful human learning notes in `Study/`.

Authority: the user's current agent-system restructuring request, 2026-11-12.
This refines DEC-DOC-01: substantial/new behavior needs requirements/plan approval
**before** dependent coding; an existing scoped approval already authorizes that
work. Routine accepted-behavior fixes/documentation remain proportional. No
retrospective product approval or runtime change is implied.

Operational details live in [AGENTS.md](../../AGENTS.md); templates/index in
[specs/README.md](../README.md). CLAUDE is a thin entry point, specs owns accepted
intent, api-docs owns implemented consumer instructions, Study owns explanation.
Record legitimate API/learning N/A instead of fabricating artifacts. Question
rounds resolve real gaps, not an arbitrary question quota; do not re-ask answered
questions or request a second start approval for the same accepted plan.


## Product authority

Accepted product requirements live with their feature. [REQ-CHAT-01](../features/chat/decisions.md) is explicitly accepted; Current behavior elsewhere does not become an approved requirement by migration. Record approval/date, acceptance criteria and evidence at the owner.

## Documentation layout decision — accepted 2026-11-11

User approved shared `system/` and ten separate `features/` scopes to reduce unrelated AI reads and make bug/feature updates local. Each model/contract/decision/question has one primary owner, linked from other scopes; plans/tasks exist only for concrete changes. See [reorganization plan](reorganization.md).

`Guide.md` is historical product input, not automatic approval of later feature behavior. [Discrepancy index](discrepancies.md) routes open choices to their owners.
