---
name: speckit-constitution
description: Create or update the project constitution from interactive or provided
  principle inputs.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: preset:backend-policy
---

# Speckit Constitution Skill

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

## Scope Guard

This command's own work is limited to updating the project constitution itself. Dependent templates
and commands read the constitution at runtime and are not modified here.

- Classify every part of the user input as either constitution content or a separate,
  non-governance intent.
- If the input includes feature implementation, code generation, refactoring, building, or
  deployment requests, you **MUST NOT** execute them. Extract them as deferred intents instead.
- You **MUST NOT** create, modify, or delete application source files, feature routes,
  components, tests, deployment files, or other artifacts unrelated to the constitution
  workflow.
- If it is unclear whether an instruction is constitution content, ask for clarification before
  making changes.
- After completing the constitution update, include a `Next Actions` section for each deferred
  intent. List the original intent and suggest the appropriate follow-up Spec Kit command, such
  as `$speckit-specify`, without invoking it.
- If there are no non-governance intents, omit the `Next Actions` section.

## Pre-Execution Checks

**Check for extension hooks (before constitution update)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_constitution` key
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

You are updating the project constitution at `.specify/memory/constitution.md`. The active
constitution scaffold is resolved at command time from `constitution-template` through the Spec Kit
preset/template resolution stack.

Follow this execution flow:

1. Run `.specify/scripts/bash/resolve-template.sh constitution-template --json` from the repository root and parse `TEMPLATE_CONTENT` as the active template.
   - The shared resolver applies project overrides, composing preset layers, and extension layers
     before the core template fallback. It MUST succeed before continuing.
   - If it fails, stop and report the resolution error; do not continue with only one contributing
     template layer.
   - If `.specify/memory/constitution.md` exists, load it as the source of current project-specific
     values and amendments. Preserve information that is still applicable when applying the newly
     resolved scaffold.
   - If it does not exist, use the resolved template as the initial document.
   - Do not write back to any versioned template layer.
   - Identify every placeholder token of the form `[ALL_CAPS_IDENTIFIER]`.
   **IMPORTANT**: The user might require less or more principles than the ones used in the template. If a number is specified, respect that - follow the general template. You will update the doc accordingly.

2. Collect/derive values for placeholders:
   - If user input (conversation) supplies a value, use it.
   - Otherwise infer from existing repo context (README, docs, prior constitution versions if embedded).
   - For governance dates: `RATIFICATION_DATE` is the original adoption date (if unknown ask or mark TODO), `LAST_AMENDED_DATE` is today if changes are made, otherwise keep previous.
   - `CONSTITUTION_VERSION` must increment according to semantic versioning rules:
     - MAJOR: Backward incompatible governance/principle removals or redefinitions.
     - MINOR: New principle/section added or materially expanded guidance.
     - PATCH: Clarifications, wording, typo fixes, non-semantic refinements.
   - If version bump type ambiguous, propose reasoning before finalizing.

3. Draft the updated constitution content using the resolved template as the required structure:
   - Replace every placeholder with concrete text (no bracketed tokens left except intentionally retained template slots that the project has chosen not to define yet—explicitly justify any left).
   - Preserve heading hierarchy and comments can be removed once replaced unless they still add clarifying guidance.
   - Ensure each Principle section: succinct name line, paragraph (or bullet list) capturing non‑negotiable rules, explicit rationale if not obvious.
   - Ensure Governance section lists amendment procedure, versioning policy, and compliance review expectations.

4. Produce a Sync Impact Report as an HTML comment at the top of the constitution file after update.
   This report is temporary scratch material for human review of the amendment, not governance
   content; it is expected to be removed before the amended constitution file is committed.
   - Version change: old → new
   - List of modified principles (old title → new title if renamed)
   - Added sections
   - Removed sections
   - Follow-up TODOs if any placeholders intentionally deferred.

5. Validation before final output:
   - No remaining unexplained bracket tokens.
   - Version line matches report.
   - Dates ISO format YYYY-MM-DD.
   - Principles are declarative, testable, and free of vague language ("should" → replace with MUST/SHOULD rationale where appropriate).

6. Write the completed constitution back to `.specify/memory/constitution.md` (overwrite).

7. Output a final summary to the user with:
   - New version and bump rationale.
   - Any TODO placeholders or deferred items requiring manual follow-up.
   - Suggested commit message (e.g., `docs: amend constitution to vX.Y.Z (principle additions + governance update)`).
   - A `Next Actions` section for any deferred non-governance intents.

Formatting & Style Requirements:

- Use Markdown headings exactly as in the template (do not demote/promote levels).
- Wrap long rationale lines to keep readability (<100 chars ideally) but do not hard enforce with awkward breaks.
- Keep a single blank line between sections.
- Avoid trailing whitespace.

If the user supplies partial updates (e.g., only one principle revision), still perform validation and version decision steps.

If critical info missing (e.g., ratification date truly unknown), insert `TODO(<FIELD_NAME>): explanation` and include in the Sync Impact Report under deferred items.

Write only `.specify/memory/constitution.md`; do not create or modify template source files.

## Post-Execution Checks

**Check for extension hooks (after constitution update)**:
Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.after_constitution` key
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

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently
