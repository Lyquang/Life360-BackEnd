# Implementation plan: <feature>

Spec: [spec.md](spec.md) | Tasks: [tasks.md](tasks.md)
Status: Draft / Ready for review / Approved / Implementing / Implemented
Revision/date: <id / YYYY-MM-DD> | Requirements revision/IDs: <...>
Approval record: <canonical feature decision / actual user instruction; Pending until answered>

## Requirement alignment and intended result

<Summarize confirmed outcome, before/after example, in/out scope and acceptance IDs.
List blocking open questions. Resolve them before dependent implementation; do not
ask for approval of an unspecified design. A non-blocking rollout item may stay open.>

## Approach, alternatives and trade-offs

<Smallest suitable solution, why it fits current architecture, alternatives rejected
and their costs. No dependency, provider choice or paid usage inferred from research.>

## Affected flow and file changes

<HTTP/socket entry → validation/auth → controller/gateway → use case → repository →
model/adapter; dependency wiring in src/container.js. Follow only affected features.>

| File / owner | Create/update | Purpose / requirement | Dependencies |
|---|---|---|---|
| <exact path> | <action> | <reason/ID> | <...> |

## Data and contracts

<Proposed schema/fields/indexes, state transitions, auth/permissions, HTTP/socket
contracts, retention/cache, compatibility and migration effects as applicable. Link
the owning contract/model; do not create a duplicate normative version here.>

## Reliability, privacy and operations

<Failure/timeout/offline/retry/idempotency/concurrency, privacy/revocation, metrics,
provider limits/costs, config/flags, rollout/rollback and deployment dependencies.
State explicitly if an operation writes data or needs additional authorization.>

## Implementation slices

<Ordered independently verifiable slices and dependencies, linked to tasks/AC IDs.
No production code/prototype before scoped requirements/plan approval.>

## Verification

| Acceptance / risk | Test or manual check | Command/environment/effects | Required evidence |
|---|---|---|---|
| <AC-ID> | <observable check> | <verified available command> | <result to record> |

Do not mark tests passed before execution. Keep device/provider/deployment checks
separate from local fixtures; report unavailable/failed checks and their implications.

## Required delivery artifacts

| Artifact | Chosen path | Content/change or genuine N/A reason |
|---|---|---|
| Approved intent / contracts / models | <feature/system owners> | <affected scope> |
| Frontend/mobile handoff | `api-docs/<file>.md` | <implemented interfaces/flows, or no client-facing API> |
| Human learning | `Study/<file>.md` | <mechanism, rationale, useful pitfalls, source/evidence> |
| Tasks / progress | <paths> | <checks, actual status, limitations> |

## Review decision and changes after approval

<Link this exact revision for user review; record accepted scope/date/authority at
one canonical owner. Approval authorizes work within that scope without another
start confirmation. Record material later changes and resolve only affected decisions.>
