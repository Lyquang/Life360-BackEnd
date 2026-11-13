# Family Tracker Backend Constitution

<!-- Sync Impact Report
Version: template -> 1.0.0 (initial project constitution).
Authority: explicit Spec Kit setup request, 2026-11-12.
Principles: existing repository architecture/safety + user-requested SDD reviews.
Templates: native templates retained; backend-policy preset composes additions.
Guidance: AGENTS.md, specs/README.md, codex/spec-kit/README.md synchronized.
No retrospective approval of Current behavior; no application behavior changed.
-->

## I. Accepted intent and human control

`specs/README.md` indexes accepted requirements/design and their status. Source and
tests prove current behavior, not approval. Preserve stable IDs and authorities;
record discrepancies instead of silently changing intent or code. Existing product
decisions remain owned by their feature. Ask relevant questions over as many rounds
as needed, reuse answers, and never infer consent from silence. Requirements need
human confirmation before planning. After plan, tasks and analysis, request explicit
implementation approval for the concrete revision; remain AWAITING_APPROVAL until
it arrives. Material scope/contract/architecture changes invalidate affected approval.
An already valid approval authorizes its scope without another start confirmation.

## II. Existing architecture and simplicity

Node.js >=20, CommonJS, Express, Socket.IO, Mongoose/MongoDB and Zod are the existing
stack, not a license to add dependencies. Respect presentation → application →
infrastructure → database/models; domain stays pure. Compose dependencies in
`src/container.js`. Controllers/gateways validate, obtain auth context, invoke use
cases and format outputs. Keep Express, Socket.IO, Mongoose, storage, JWT and bcrypt
implementation details out of use cases. Prefer explicit, focused code and current
conventions; add abstraction only for a concrete requirement.

## III. Security, privacy and data integrity

Validate input with existing DTO/error conventions; authorize the resource and its
membership/privacy, not identity alone. Never expose secrets or private payloads.
Preserve transactions, unique indexes, idempotency and ordering. Mongo transactions
need replica set/mongos; development fallback is not proof of atomicity. Redis and
process-local state are not durable or multi-instance guarantees. Preserve bounded
safe retries; emission/outbox state does not prove client receipt. Review failure,
concurrency, retention and recovery behavior for the affected feature.

## IV. Proportionate verification

Map accepted criteria to meaningful checks, including authorization/failure/races
where relevant. Runtime behavior changes require appropriate tests; documentation
edits need reference/content checks and `git diff --check`, not invented runtime
coverage. Use existing Node test fixtures and configured commands. `npm run lint`
has limited multi-file syntax coverage; use individual `node --check` where needed.
Record PASS, FAIL, SKIPPED, NOT CONFIGURED and NOT RUN distinctly with commands,
results and limits. Never invent evidence, ignore a required failure, or infer
deployment/device/provider readiness from local checks.

## V. Documentation and delivery

Use native Spec Kit spec/plan/tasks, supporting artifacts when applicable, and the
existing feature owner for legacy changes. Interview records own answers; specs own
accepted intent; plans own design; tasks own execution; verification owns evidence;
progress owns stage/approval. Link rather than duplicate. Update client-facing
`api-docs/` and affected Swagger/socket descriptions for implemented interfaces;
mark proposed interfaces clearly. Teach mechanisms in Vietnamese in `Study/`, with
English technical terms and real code pointers. Feature study records may link to
that canonical note. Record genuine N/A cases without filler. Update `PROGRESS.md`.
Use native analyze before approval and append-only converge after implementation;
remaining approved work becomes tasks, changed scope returns to review.

## VI. Scope and operational safety

Preserve dirty work, existing specs, source, lockfiles and project configuration.
Do not auto-commit, stash, reset, install app dependencies, migrate, seed, build
native apps, deploy or modify another repository without authorization for those
effects. Do not send private source/data/secrets to external services. Review script
effects. Navigation graphs are generated evidence, not requirements; never edit
them manually or fabricate them. Use native Spec Kit mechanisms before adding a
custom process; no parallel workflow database or orchestration service.

## Governance

`AGENTS.md` is the canonical operating guide; this constitution supplies native
Spec Kit's project checks. Both must agree with accepted specs and explicit user
instructions. Amendments need the user's decision, impact review, version/date and
updates to affected instructions/templates; do not ratify product behavior here.
Review constitution checks before research/design and again after design and during
analysis. Record justified exceptions and obtain required approval before dependent
implementation. Major changes remove/redefine principles; minor adds principles;
patch clarifies without changing obligations. Current setup is an explicitly
authorized tooling change, not approval of any application feature.

**Version**: 1.0.0 | **Ratified**: 2026-11-12 | **Last Amended**: 2026-11-12
