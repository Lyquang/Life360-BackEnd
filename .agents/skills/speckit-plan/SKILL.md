---
name: speckit-plan
description: Execute the implementation planning workflow using the plan template
  to generate design artifacts.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: preset:backend-policy
---

# Speckit Plan Skill

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
  system Python may not. The local `.specify/scripts/specify` launcher exports it and PATH
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



## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before planning)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_plan` key
- If the YAML cannot be parsed or is invalid, do not skip silently: tell the user that `.specify/extensions.yml` could not be read (include the parser error) and that no hooks were checked, including any mandatory (`optional: false`) hooks registered there, then continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing command invocations from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `$speckit-git-commit`.
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

1. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, FEATURE_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Re-evaluate Constitution Check post-design

## Mandatory Post-Execution Hooks

**You MUST complete this section before reporting completion to the user.**

Check if `.specify/extensions.yml` exists in the project root.
- If it does not exist, or no hooks are registered under `hooks.after_plan`, skip to the Completion Report.
- If it exists, read it and look for entries under the `hooks.after_plan` key.
- If the YAML cannot be parsed or is invalid, do not skip silently: tell the user that `.specify/extensions.yml` could not be read (include the parser error) and that no hooks were checked, including any mandatory (`optional: false`) hooks registered there, then continue to the Completion Report.
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing command invocations from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `$speckit-git-commit`.
- For each executable hook, output the following based on its `optional` flag:
  - **Mandatory hook** (`optional: false`) — **You MUST emit `EXECUTE_COMMAND:` for each mandatory hook**:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```

## Completion Report

Command ends after Phase 1 design. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Define interface contracts** (if project has external interfaces) → `/contracts/`:
   - Identify what interfaces the project exposes to users or other systems
   - Document the contract format appropriate for the project type
   - Examples: public APIs for libraries, command schemas for CLI tools, endpoints for web services, grammars for parsers, UI contracts for applications
   - Skip if project is purely internal (build scripts, one-off tools, etc.)

3. **Create quickstart validation guide** → `quickstart.md`:
   - Document runnable validation scenarios that prove the feature works end-to-end
   - Include prerequisites, setup commands, test/run commands, and expected outcomes
   - Use links or references to contracts and data model details instead of duplicating them
   - Do not include full implementation code, model/service/controller bodies, migrations, or complete test suites
   - Keep this artifact as a validation/run guide; implementation details belong in `tasks.md` and the implementation phase

**Output**: data-model.md, /contracts/*, quickstart.md

## Key rules

- Use absolute paths for filesystem operations; use project-relative paths for references in documentation
- ERROR on gate failures or unresolved clarifications

## Done When

- [ ] Plan workflow executed and design artifacts generated
- [ ] Extension hooks dispatched or skipped according to the rules in Mandatory Post-Execution Hooks above
- [ ] Completion reported to user with branch, plan path, and generated artifacts
