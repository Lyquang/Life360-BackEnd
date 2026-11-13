## Family Tracker project policy (composed by local preset)

Read `AGENTS.md`, `specs/README.md`, `.specify/memory/constitution.md` and
`codex/spec-kit/README.md`. These project instructions supplement the native command
below; retain its functionality and honor the current stage's write boundary.

- Select the actual owner before running helpers. New features use native numbered
  `specs/NNN-name`. Existing `specs/features/name` folders stay in place; set
  `SPECIFY_FEATURE_DIRECTORY` explicitly. Only work inside this authorized repo;
  native path selection alone is not containment. Check selection before writes.
- Run native Bash helpers from the repo root with
  `SPECKIT_PYTHON_EXECUTABLE="$PWD/.specify/.venv/bin/python"` in their environment.
  This is a supported native override: the isolated CLI venv supplies PyYAML;
  system Python may not. The local `scripts/specify` launcher exports it and PATH
  for its child processes. Stop for documented tool setup if the venv is absent;
  do not silently ignore preset composition or install application dependencies.
- A new idea is discovery/design authorization. Do not implement app code through
  specify/clarify/plan/tasks/checklist. Use native analyze read-only; do not write
  a report or progress from inside analyze. Persist its review summary separately.
- Interview uses repeated native clarify invocations (up to five questions each),
  with stable Q-IDs across rounds in `interview.md`. Five is not a lifetime feature
  limit. Follow up until blocking uncertainty is resolved; respect a user-requested
  stop. Avoid repeating known answers or inventing requirements. Keep native spec
  clarification bullets concise with Q-ID links to the canonical answer record.
- Before native plan: obtain and record the user's requirements confirmation for
  the selected spec revision in `progress.md`. Open blockers keep CLARIFYING or
  REQUIREMENTS_REVIEW. Do not turn a command invocation into fictitious approval.
- After native tasks: run native analyze. Resolve critical contradictions and
  constitution violations before asking approval; no auto-remediation of scope.
  A separate review step records the analysis, risk summary, changed files, actual
  spec/plan SHA-256, task digest and approval request in `progress.md`. Set
  AWAITING_APPROVAL; stop and ask the human. A CLI gate also requires a real human
  verdict. Never supply an approval input, simulate a keypress or generate consent.
- Before native implement: read spec/plan/tasks/interview/progress; verify explicit
  approval and current spec/plan/task scope against its snapshot. If absent/stale,
  ask for the missing decision and stop implementation. Approval is valid only for
  its concrete scope. This guard also applies to direct skill invocation outside
  the workflow engine. Record truthfully; never self-approve. Normal task checkbox
  progress is not a material scope change; newly added tasks need scope review.
- Verification produces `verification.md` with criterion/task, command, actual
  outcome and limitations. Then update existing api-docs/Swagger/socket docs and
  `Study/` where applicable; `study.md` links to the canonical human note, not a
  second copy. Templates for supplemental records are in `specs/_templates/`.
- Native converge is append-only to tasks and does not repair requirements or code.
  Do not change spec/plan to excuse failures. If convergence finds gaps, record
  them in a separate progress step: approved-scope work returns to implementation,
  changed scope returns to clarification/review. Do not claim COMPLETED with open
  critical checks or unmet acceptance. Update feature progress and root PROGRESS.
- These are logical roles in one session: orchestrator, analyst, architect,
  developer, reviewer/QA, documentation/Study. They are not commands or a requirement
  to spawn agents. Never silently dispatch private code to a model or service.

The native workflow's human gate is an execution pause. Markdown approval records
are the canonical feature audit trail. Neither is an OS security boundary.

---
