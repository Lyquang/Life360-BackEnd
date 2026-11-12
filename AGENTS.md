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
- `CLAUDE.md`, integration guides and older `Study/` notes provide supporting context. Verify summaries against relevant specs/source; do not promote old API lists, deployment advice or proposals into accepted contracts. Record conflicts explicitly.
- Imported reference-project artifacts were removed at the user's request. Learn organization from examples without importing their stack, business rules, commands or completion claims.

## AI Collaboration Workflow

**Plan non-trivial work before implementation. Obtain approval when the scope or
approach has not already been authorized.**

Follow this workflow:

1. **Understand** — Read `specs/README.md`, the owning feature's active spec and relevant contracts,
   data model, and existing plan, research and tasks before every code, test, configuration,
   documentation, review, or debugging task. Then inspect the relevant source and tests.
   Keep reading scoped to affected features; do not create missing artifacts merely
   to satisfy a template. Inspect the working tree and preserve unrelated user work.
   Re-read affected documents if their content changes during the task; do not use a
   previous chat summary as the latest source of truth.
2. **Simplify** — Break the problem into the smallest meaningful tasks.
3. **Plan** — Resolve requirement ambiguities first, then restate the intended
   outcome and propose a solution before writing code. For changes affecting
   behavior, show how the proposal matches the relevant requirements and acceptance
   criteria, using a concrete before/after example when useful. Include:
   - Proposed approach and reasoning
   - Files to create or modify
   - Important design decisions and trade-offs
   - Edge cases and potential risks
   - How the solution will be tested
4. **Review** — If approval is still needed, wait for the developer to approve the plan.
   An approved plan or an explicit instruction to implement the discussed approach
   authorizes work within that scope; do not request the same approval again.
5. **Implement** — Work incrementally within the approved scope. Record authorized
   requirement/logic changes in affected active specs before dependent implementation;
   complete affected spec, code, test and root documentation updates in the same change.
   Do not rewrite requirements merely to justify a defect or mark a proposed fix done.
6. **Verify** — Compare behavior and tests against the latest active specs and the
   applicable feature contracts and shared HTTP/Socket conventions. Update affected
   tasks and record actual verification results. For formatting-only changes, verify documentation and report when no
   specification logic changed; do not edit unrelated specs.
7. **Report** — Summarize what changed, which spec documents were read/updated, what
   was verified, and remaining limitations. Update `PROGRESS.md` after a completed
   task or meaningful refactor. A review-only request does not authorize editing
   code or specs; leave proposed changes pending until approved.

Proceed autonomously with routine implementation choices and fixes within the approved
scope. If a discovery requires a significant change to scope or architecture, explain
the issue and obtain approval for that change before proceeding with dependent work.

Do not expand the scope or introduce new dependencies without justification.

For small, directly requested changes, keep the process lightweight and implement them without a separate approval round.

### Clarify uncertainty and confirm requirement alignment

- **Ask instead of guessing about requirements.** First inspect the current user
  request, active specs, feature contracts, documented decisions and relevant implementation.
  If the intended behavior or expected result is still unclear, ask the user before
  choosing a behavior or implementing work that depends on that answer.
- Ask when multiple reasonable interpretations would change business rules, API
  behavior, data integrity, concurrency/retry guarantees, security, scope, or
  acceptance criteria. Missing requirements and conflicts between sources must be
  surfaced explicitly; do not silently resolve them by editing a specification.
- Explain the uncertainty briefly: what is known, what is missing or conflicting,
  which source is involved, and what the answer changes. Prefer one focused question
  at a time; offer concrete alternatives and a recommendation when helpful, without
  treating the recommendation as the user's decision.
- **Confirm alignment when misunderstanding would materially change the result.**
  Before a substantial behavior change, summarize the goal, affected requirements,
  proposed behavior, exclusions, and acceptance checks. If alignment or approval is
  unresolved, explicitly ask the user to confirm or correct that interpretation.
  Ask again if new evidence contradicts the confirmed understanding or requires a
  significant change in scope or architecture.
- Wait for an actual answer to required clarification/confirmation. Silence,
  elapsed time, an option shown as the default, or an unanswered question is not
  approval. Continue only independent, already-authorized work while waiting.
- Record confirmed requirement decisions in the owning feature's active specs/decisions
  (or `specs/system/decisions.md` for shared policy) before dependent implementation.
  Preserve their source and distinguish user-confirmed decisions from proposals and
  historical behavior.
- Do not ask the user to repeat information already provided or to approve the same
  scope again. Existing explicit authorization remains valid. Routine implementation
  details within that scope may be resolved using established patterns and technical
  research; an unresolved product decision may not be disguised as a routine detail.
- This policy applies whether or not the client is in Plan mode. Do not claim a
  client mode has changed merely because these instructions were read.

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

The authorized result is implemented or documented, applicable requirements and
contracts are satisfied, meaningful checks have completed, and affected specs/tasks
and progress reflect the outcome. Report unresolved questions, failed/unavailable
checks and remaining limitations. Keep the change scoped and preserve unrelated work.
