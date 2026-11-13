# AGENTS.md — Family Tracker Backend

## Project Context and Authority

This repository implements the Family Tracker backend: authentication, Circles,
chat/media, location sharing/history/live trails, SOS, group digests and favorite
places. It contains no mobile app implementation.

- Stack: Node.js >=20, CommonJS JavaScript, Express, Socket.IO, Mongoose/MongoDB and Zod. Redis, OAuth, S3/R2 and map matching are infrastructure adapters with configuration-dependent availability.
- Read this guide first when starting work in the repository, then [specs/README.md](specs/README.md) to select the owning feature and shared documents. Follow any additional instructions scoped to files being changed.
- `specs/` is the source of accepted requirements/design. Code and tests establish current behavior, not product approval. Preserve Requirement, Decision, Current behavior, Proposed and Open question labels.
- Read the selected feature's `spec.md`, relevant contracts/models and existing decisions/discrepancies before implementation investigation. Read plans/tasks/research when relevant and present; do not load every feature or historical survey for each task.
- Re-read instructions/specs when they change. A chat summary is navigation context, not a replacement for current documents.
- `CLAUDE.md` is a short entry point to this guide, not a second rulebook. Integration guides explain implemented client usage; `Study/` explains mechanisms/lessons. `Guide.md` is historical product input. None replaces accepted feature specs; surface conflicts rather than silently choosing one.
- Imported reference-project artifacts were removed at the user's request. Learn organization from examples without importing their stack, business rules, commands or completion claims.

## AI Collaboration Workflow — Requirements Before Implementation

A new feature idea starts **discovery and design**, not immediate coding. Default
flow: **read relevant specs → interview/clarify → human confirms requirements →
native plan → native tasks → native analyze → AWAITING_APPROVAL → human approves
implementation → implement → verify → API handoff + Study → native converge →
update specs/progress**. This applies regardless of client Plan mode.

### Spec Kit integration and stage boundaries

- Use the official Spec Kit integration described in [codex/spec-kit/README.md](codex/spec-kit/README.md). Read `.specify/memory/constitution.md` for native constitution checks. Terminal `scripts/specify` is a local launcher for official CLI 1.4.0; `$speckit-specify`, `$speckit-clarify`, `$speckit-plan`, `$speckit-tasks`, `$speckit-analyze`, `$speckit-implement`, `$speckit-converge` are Codex skills, not shell commands. Do not invent native commands.
- Run native Bash helpers from the repo root with supported `SPECKIT_PYTHON_EXECUTABLE="$PWD/.specify/.venv/bin/python"` in their environment so preset composition can import PyYAML. The local CLI launcher exports this and its venv PATH; direct chat helper calls must supply it explicitly. Do not modify core scripts to work around a missing tool environment.
- New Spec Kit features use the native `specs/NNN-name/` convention. Preserve existing `specs/features/<name>/` owners; explicitly select them with `SPECIFY_FEATURE_DIRECTORY` for native helpers. Verify the selected path is inside this repository before writes. Register native feature/change folders in `specs/README.md` and link existing owners; no mass migration or duplicate authority.
- Native clarify's five-question limit is per invocation. Repeat rounds with stable Q-IDs in `interview.md`; there is no five-question limit for a feature's entire interview. Record real answers once and link resulting decisions in the spec. Requirements confirmation in `progress.md` is required before plan; it is not implementation approval.
- After plan/tasks, native analyze is read-only. Separately record its findings, risks and exact reviewed spec/plan SHA-256 plus task scope/digest in `progress.md`; set AWAITING_APPROVAL and request the human decision. Do not start implementation with missing/stale approval or unresolved critical findings, including when `$speckit-implement` is invoked directly. A valid explicit approval of the already-reviewed scope authorizes implementation without another start question.
- `progress.md` owns feature stage and human approval evidence. `verification.md` owns actual acceptance/check results. `study.md`, when useful, links to the canonical Vietnamese note in `Study/` rather than duplicating it. Supplemental templates are in `specs/_templates/`; native spec/plan/tasks templates compose with the local backend-policy preset. Existing manual templates remain compatible for legacy/small work.
- Canonical customization sources are `codex/spec-kit/backend-policy/` and `codex/spec-kit/backend-sdd.yml`. Refresh through official preset/overlay CLI commands in the guide; do not hand-edit generated `.agents/skills/`, installed preset copies, core scripts/templates or the bundled workflow. Native workflow gates pause execution; manual chat follows the same review rules. Never auto-answer a gate or fabricate human approval. These are workflow controls, not an OS sandbox.
- After implementation, verify/document and run native append-only converge. Unmet approved-scope work returns to implementation/verification; material scope changes return to clarification/review. Do not rewrite requirements to fit code or claim completion with critical unmet acceptance. Logical roles may run sequentially in one agent; no delegation is required.

### 1. Understand and choose the owner

- Read `specs/README.md`, then the owning feature's spec, contracts/model and existing decisions/questions, and applicable system conventions. Use the graph/skeleton rules below before deep source reads. Inspect working-tree changes and preserve them.
- For an existing feature, update its folder; do not create a new folder for every bug/change. For a genuinely new feature, use native specify to create `specs/NNN-<clear-kebab-name>/`, register it in the index, and create artifacts at their actual stage. Do not prefill plan/tasks before requirements confirmation or create empty supporting folders. Files must contain actual task information.
- Distinguish accepted intent from code-observed behavior. Keep current implementation evidence separate from proposed contracts, questions and design. Do not approve all legacy behavior merely by touching its spec.
- Read affected docs again if they change; a chat summary does not replace current requirements or approval records.

### 2. Clarify through focused question rounds

- Proactively ask enough questions to understand a new feature; do not stop at one broad question or silently fill business rules from assumptions. Prefer small rounds of 3–5 focused questions for substantial features, followed by targeted follow-ups until blocking gaps are resolved. If the user's request already supplies an answer, reuse it.
- Start with the user/problem, desired outcome, scenarios, scope/non-goals and before/after behavior. Then cover roles/permissions/privacy, data/lifecycle/retention, API/realtime consumers, edge cases/failure/retry/offline, providers/cost/limits and acceptance checks as applicable.
- Explain what each important answer changes. Offer concrete choices and a recommendation when useful; recommendations remain Proposed until confirmed. Avoid irrelevant questions, questionnaires with a fixed quota, or asking the user to decide routine implementation details.
- Record real questions, answers and their authority in the feature's open-decision table or existing questions/discrepancy register. Give blocking questions IDs and explain their impact. A separate questions/research/decisions document is useful only when there is substantive content; link instead of duplicating the record.
- While answers are pending, continue independent read-only investigation and documentation. Do not implement dependent behavior, write a production prototype or treat silence/default selections as an answer. If sources conflict, show the evidence and ask for the missing decision.

### 3. Agree requirements and prepare a reviewable plan

- Turn confirmed answers into stable requirements and Given/When/Then acceptance criteria in `spec.md`, with authority/date and scope. Present the requirements for explicit human confirmation and record it in `progress.md` before native plan. Keep unresolved choices explicitly Proposed/Open; never invent an endpoint, field or permission as an accepted contract.
- For substantial features, write the concrete `plan.md` and actionable `tasks.md` before implementation. Explain the approach/reasons, alternatives/trade-offs, architecture flow, files to create/change, dependencies, proposed data/API changes, security/privacy, concurrency/idempotency, failure behavior, compatibility/rollout and verification mapped to acceptance IDs.
- State which `api-docs/<feature>_API_DOC.md` and `Study/<feature>.md` will be created/updated. For existing integration/learning docs, update the owner rather than creating duplicates. Explain a genuine not-applicable case instead of inventing APIs or lessons.
- Split work into the smallest independently verifiable slices. Mark provider/account/native/migration/deployment dependencies without claiming they are configured or authorized.
- Put review metadata in the plan: revision/date, current status, requirements/acceptance IDs, unresolved blockers and a link to the approval/decision record. Link the exact plan for the user to review; a chat-only sketch is insufficient for a substantial feature.

### 4. Approval gate

- Before coding a new feature or a substantial behavior change, complete plan/tasks and native analysis, present the concrete review packet and ask the user to approve implementation. Set AWAITING_APPROVAL in `progress.md` and wait for a real answer. Do not mark Approved or start dependent implementation while blocking product questions or critical analysis findings remain.
- Record what was approved, the plan revision/scope, authority/date and any exclusions at the owning feature. Approval is scoped; agreeing to investigate a provider does not choose it, authorize spending, approve deployment or approve every candidate threshold.
- An approved plan, or an explicit instruction to implement an already-discussed concrete plan, authorizes implementation within that scope. **Do not ask again whether to start**. Reopen only changed decisions if later evidence requires a material scope, contract, business-rule or architectural change.
- Reuse prior valid approvals and answers across turns. A later explicit instruction can supersede an earlier design-only constraint; record the change. Do not infer an override from an unrelated question.
- Scale routine fixes and documentation edits to the task: a directly requested small fix that preserves accepted behavior does not require a new feature folder, long questionnaire or separate approval round. A small diff that changes permissions/API/business rules still requires resolving the relevant behavior decision.
- User instructions can explicitly waive a stage for a defined scope. Record that authorization; do not use it to guess unresolved requirements. A review-only request remains read-only unless the user requests edits.

### 5. Implement within the agreed scope

- Follow the approved requirements/plan and existing architecture. Keep spec/contract/task changes together with implementation; update tasks as real work completes. Resolve routine engineering choices autonomously.
- Do not rewrite requirements merely to justify a defect, or mark a proposal implemented because tests around another behavior pass. Record discrepancies at the owner and resolve the missing decision before dependent changes.
- Keep other feature folders current only where actually affected. Respect repository boundaries; a backend feature plan does not automatically authorize edits to a mobile repository or external service.

### 6. Verify and deliver documentation

- Map meaningful tests/checks to the accepted criteria; report actual commands/results and limits. Distinguish implemented locally, verified automatically, deployed and device/provider-tested. Never hide a failed required check behind a passing unrelated test.
- For client-facing HTTP/socket changes, create/update **`api-docs/`** in the same change, using the [integration template](specs/_templates/api-doc.md). Document implemented routes/events, auth/permissions, exact DTOs, success/errors, flows, retry/idempotency/cursors, realtime recovery and examples as relevant. Link the feature contract; synchronize affected Swagger/socket docs. No invented API for an internal-only or native-only feature: record why API docs are not applicable.
- For each substantial completed feature, create/update a useful **`Study/`** note using the [learning template](specs/_templates/study.md): how the mechanism works, why choices were made, real trade-offs/pitfalls, code pointers and verification limits. This teaches a human; it is not another normative spec or a copy of the API reference. Keep hypotheses and historical observations labelled.
- Update the owning specs/contracts/models/decisions/tasks, doc indexes and `PROGRESS.md` to match the implemented authorized scope. If a small fix adds no new learning/API, update existing notes where relevant or explicitly record not-applicable; do not create filler documents.

### 7. Report

State the outcome, affected specs, implementation/verification status, links to API
handoff and Study notes (or the reason not applicable), and remaining questions or
limitations. If requirements/plan review is the current stage, deliver those
artifacts and the necessary questions instead of claiming the feature is implemented.

### Artifact responsibilities

| Artifact | Responsibility |
|---|---|
| `AGENTS.md` | Canonical operating workflow for this backend |
| `CLAUDE.md` | Entry point that routes to this guide; no duplicate API/model/config catalog |
| `specs/README.md` | Feature registry, accepted intent/design authority and status |
| `specs/features/<feature>/` | Requirements, owner contracts/models, decisions, plan/tasks and verification |
| `specs/NNN-name/` | Native Spec Kit artifacts for new features; explicitly link existing owners for changes |
| Feature `progress.md` | Canonical feature stage, requirements confirmation, approval scope/revisions and next action |
| `.specify/`, `.agents/skills/` | Native Spec Kit scaffold and generated Codex integration; customization sources in `codex/spec-kit/` |
| `specs/system/` | Shared architecture/conventions and cross-feature ownership |
| `api-docs/` | Frontend/mobile integration instructions for implemented backend interfaces |
| `Study/` | Human learning, mechanisms, rationale, trade-offs and real evidence |
| `PROGRESS.md` | Work outcomes, checks/limits and historical progress, not implicit product approval |

Native spec/plan/tasks templates resolve through the backend-policy preset;
supplemental and legacy templates live under `specs/_templates/`.
Do not retroactively rewrite all existing
features to match new templates; apply the workflow to the affected change. Use
[the optional feature-request prompt](specs/_templates/feature-request.md) when
helpful; the user may simply describe a new feature in ordinary language.

## Engineering Principles

- Prefer the simplest correct solution that satisfies current requirements.
- Keep code explicit and easy to review; make state transitions, rule precedence,
  and failure handling visible.
- Add layers, infrastructure, or design patterns only for a concrete need.
- Extract shared business logic when it improves clarity; similar small blocks alone
  do not justify an abstraction.
- Prioritize data integrity and concurrency safety. Optimize based on evidence or an
  explicit performance requirement.

Do not silently change code to match an uncertain spec. Record disagreements in
the owning feature's `discrepancies.md`; use [the system index](specs/system/discrepancies.md)
for shared records and ownership. Obtain missing product decisions before dependent changes.

## Feature Ownership and Product Decisions

- Use existing `specs/features/<feature>/` folders for bugs/enhancements. Register new features with concrete scope/status; a folder does not imply approval.
- Keep shared architecture/configuration/transport rules in `specs/system/`. Give contracts, models and decisions one primary owner; link across affected features instead of duplicating them.
- Use templates linked in `specs/README.md` for substantial changes. Create feature-local plans/tasks only for actual work; small fixes do not need a full artifact set or empty scaffolding.
- Preserve stable REQ/DEC/D/Q IDs, authority and acceptance criteria. [REQ-CHAT-01](specs/features/chat/decisions.md) allows sending/reading an existing direct 1–1 conversation after the last shared Circle ends. Opening/get-or-creating through `/conversations/direct` retains its separate shared-Circle check.
- For Circle exit, check group chat membership, location-sharing/live-trail and SOS access. For privacy pause, check ingestion/history/trail and digest snapshots. Unresolved digest policy is not an approved behavior change.
- Keep feature contracts, shared conventions and affected DTO/route/socket documentation aligned with authorized changes. Mark proposed APIs clearly; do not invent endpoints, fields, permissions or delivery guarantees.

## Code Navigation and Context Budget

- Start broad codebase reads with `npm run context:skeleton`. Consult `codex/context/codebase-skeleton.md` and `codex/context/module-graph.json` before opening many implementation files.
- Use `rg` and `npm run context:trace -- --term <name>` for discovery. For dependency questions, use `npm run context:trace -- --file <path>` after refreshing the skeleton.
- Load full implementations after the skeleton, graph, spec or targeted search identifies relevant files. A symbol match or import edge is not sufficient evidence of runtime behavior.
- Read `graphify-out/backend/GRAPH_REPORT.md` before deep investigation. Check its source commit and inventory hashes against the working tree, including added/deleted files; a matching commit alone does not prove freshness. Verify stale graph conclusions directly in source.
- Backend Graphify covers `src` AST relationships. It is navigation data, not requirements or an API contract. Follow [its README](graphify-out/backend/README.md) and [verified refresh instructions](specs/system/validation.md); use explicit backend graph paths. Refresh only when requested or required by workflow, using official Graphify. Never hand-edit generated graph files or fabricate output when the tool is unavailable.
- `npm run context:graph` creates `codex/context/graph.html`, a separate static-import graph. Neither graph captures all runtime dependency injection, authorization or delivery semantics.
- Exclude dependencies/vendor, build/coverage output, logs, locks, binary assets and caches from routine reads. Generated context/graph artifacts named above are deliberate navigation exceptions; query only relevant portions instead of dumping them.
- Do not repeat a full survey for routine work. When one is requested, define the source boundary, track every file read, recover truncated ranges and report unread/inaccessible files honestly. Existing survey evidence is in `specs/system/source-inventory.md` and its JSON ledger.

## Architecture Rules and Code Conventions

```text
server.js -> src/bootstrap.js -> src/container.js
HTTP routes -> middleware/DTO -> controller -> use case -> repository -> model
socketServer -> gateway/DTO -> use case / realtime service -> repository/model
```

- Respect `presentation -> application -> infrastructure -> database/models`, with pure helpers/policies in `domain`. Wire dependencies in `src/container.js` using existing factories and injection.
- HTTP tracing starts at `src/presentation/http/routes`; socket tracing starts at `src/presentation/socket/socketServer.js`. Follow the flow above into concrete implementations.
- Controllers/gateways handle validation, auth context, use-case calls and response/event formatting. Keep persistence and business orchestration out of transport handlers.
- Use cases enforce business rules through injected dependencies; keep them free of Express, Socket.IO, Mongoose, S3, JWT and bcrypt implementation details. Keep domain code free of I/O.
- Follow each module's CommonJS, naming and formatting conventions. Prefer focused functions, `async`/`await`, clear state transitions and the simplest correct solution. Add abstractions/dependencies only for a concrete need; do not impose a template's layout or formatter.
- Use existing Zod DTOs, domain error factories and shared error conventions. Do not swallow failures or expose tokens, credentials, raw database errors or private payloads in responses/logs.
- When changing authorization, verify resource membership/privacy at relevant HTTP/socket/use-case boundaries. Authenticated identity alone does not establish access.

## Persistence, Concurrency and Recovery

- Preserve documented transaction boundaries, unique indexes, idempotency and monotonic updates. Review races/retries when changing membership, refresh rotation, message read pointers, location ordering or SOS/outbox behavior.
- MongoDB transactions require a replica set or mongos. Development fallbacks do not establish atomicity; SOS explicitly rejects writes without a transaction. Use injected unit-of-work/repository APIs rather than database calls in use cases.
- MongoDB owns durable data. Optional fail-soft Redis is not a durable refresh-session authority or Socket.IO distributed adapter. Process-local watch rooms, queues and limiters do not establish multi-instance guarantees.
- Preserve safe bounded retries and lease ownership where implemented. Socket emission and outbox `delivered` state do not prove client receipt/read. Do not retry non-idempotent operations without a defined safety mechanism.
- Consult the owning feature and [architecture](specs/system/architecture.md) for exact invariants; do not generalize one feature's guarantees to every write path.

## Verification and Commands

The command registry is `package.json`; [validation](specs/system/validation.md)
documents effects and limits. Use only commands confirmed to exist.

- `npm test`: Node's test runner, concurrency one. Use targeted `node --test` runs for affected tests; run the full suite when shared behavior/risk requires regression coverage.
- Test observable acceptance criteria and meaningful failure/authorization/concurrency cases. Use existing isolated `MongoMemoryReplSet`/HTTP/Socket fixtures for transaction/integration checks; mocks alone do not prove database atomicity. Do not use production data or silently download/install missing test dependencies.
- `npm run lint`: the existing syntax command; its multi-file invocation does not prove every file was checked. Supplement with individual `node --check <file>` for affected JavaScript. No formatter or coverage threshold is established by this command.
- Documentation-only changes: verify content, local references and `git diff --check`. Runtime tests are unnecessary unless behavior is affected. Avoid tests that merely mirror low-impact edits.
- Report exactly what ran, failed, passed or was not run. Keep historical test counts distinct from checks executed for the current change; isolated tests do not establish production/provider readiness.

## Operational Safety and Progress

- Inspect `git status` before edits. Do not reset, discard or overwrite unrelated work, fix unrelated issues, or delete files outside the requested scope.
- Do not install dependencies, run migrations, native builds, deployment or destructive commands without authorization for their effects. Inspect unfamiliar scripts before execution.
- `npm start` / `npm run dev` connect to the configured DB, initialize indexes, backfill chat and start jobs. `npm run seed` writes users/memberships and changes digest intervals; it is not a test command. Monitoring/benchmark scripts may generate secrets, start Docker, restart services or call configured endpoints. Do not use these as routine read-only checks.
- Do not dump secrets or read actual `.env`/local credentials for routine documentation work. Never copy private repository code, credentials or data to external services. Preserve configuration and rollout flags unless the task changes them.
- Use the `memory` MCP server for durable architecture/module/dependency/risk/outcome entities and relations when available. Otherwise use `PROGRESS.md`; do not claim memory writes that did not occur.
- Record actual decisions, work and verification. Keep known gaps explicit rather than reconstructing approval, AI/human contributions or test results.

## Definition of Done

Completion is scoped to the authorized stage. A design task is done when the
reviewable requirements/plan/questions are delivered; implementation is not implied.
A substantial feature implementation is done when accepted criteria are satisfied,
meaningful checks have completed, specs/tasks/progress reflect the result, client
API docs and Study notes are delivered (or a real not-applicable reason is recorded),
and failures/limits are explicit. Do not claim deployed/production-ready from local
tests. Preserve unrelated work and do not leave required documentation as an offer
to write later.
