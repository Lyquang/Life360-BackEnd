# Spec Kit setup — discovery and evidence

## Discovery before changes (2026-11-12)

Scope: workflow/tooling only; no application feature implementation. Repository:
Family Tracker Backend, branch `main`, HEAD
`0c42dc669daa64f233a7b2e8f619e3dc9bbddb55` at discovery. Existing working-tree
changes (including `package-lock.json`) were preserved; a local temporary SHA-256
baseline records 338 existing files without exporting their contents.

The existing source survey covers 218 owned files; this setup uses that ledger and
targeted reads, not a claimed second complete survey. Architecture is CommonJS
Node >=20, Express/Socket.IO, Mongoose/MongoDB, Zod; layered presentation →
application → infrastructure → database/models, pure domain, DI in `src/container.js`.
The command registry is `package.json`; Node tests and the limited syntax lint
exist. No new build, formatter or coverage command is inferred. CI also has
publication/deployment effects and is not invoked for this setup.

Existing conventions: `AGENTS.md` is canonical, `CLAUDE.md` routes to it;
`specs/README.md` indexes feature owners, shared system docs and accepted decisions.
Legacy features live in `specs/features/`; client handoff is `api-docs/`, learning is
`Study/`, progress fallback is `PROGRESS.md`. Existing Swagger/socket descriptions
remain interface evidence. No mass migration or change to product decisions.
Graph report source commit `ddf5c58d` differs from HEAD: verify source/inventory
instead of treating the revision label as freshness. Graph regeneration is outside
this documentation/tooling change.

No `.specify/`, project `.agents/skills/`, or actual `.codex/config.toml` existed.
`codex/config.example.toml` is an existing example, not active configuration.
`specify` and `uv` were absent. Python 3.14.4, Git 2.50.1 and Codex CLI
0.167.0-alpha.4.1 were available. Tool installation is explicitly authorized by
the setup request; application dependency installation is not part of it.

## Official sources and selected integration

- [Official repository](https://github.com/github/spec-kit),
  [installation](https://github.github.io/spec-kit/installation.html),
  [Codex integration](https://github.github.io/spec-kit/integrations/codex.html).
- [Stable release v1.4.0](https://github.com/github/spec-kit/releases/tag/v1.4.0),
  published 2026-11-10, source commit
  `0019fa14d12f45edabc2cc3176c9168a68bd0f97`. Reviewed the tagged implementation
  as well as docs; website/main can describe features newer than the stable tag.
- [Official Codex skill discovery](https://learn.chatgpt.com/docs/build-skills):
  repository skills use `.agents/skills/<name>/SKILL.md`.

Use the official pinned Python CLI in an ignored project-local virtual environment,
then official `specify init` with the Codex integration. Preview in a temporary
project before merging into this nonempty repository. Preserve native templates,
scripts and generated skills; customize using supported project overrides and a
native workflow overlay. Native commands and local policy must be labelled separately.
No API keys, private source uploads, model calls or application feature are needed
to install and dry-run the scaffold.

New Spec Kit features follow its numbered `specs/NNN-name` default. Existing
`specs/features/*` owners stay where they are, selected explicitly when needed.
Requirements confirmation precedes planning; implementation approval follows
tasks and analysis. Additional artifacts are useful records, not a second framework.

## Installation actually executed

1. Created ignored `.specify/.venv` with `python3 -m venv`, installed official
   `specify-cli @ git+https://github.com/github/spec-kit.git@v1.4.0` via its pip.
   `specify version` reports 1.4.0. No application packages/lockfile changed.
2. Ran official `init --here --integration codex --script sh --non-interactive`
   in an owned temporary directory. It generated 29 files, with **zero** path
   collisions against the existing Backend. No active `.codex/config.toml` or
   root AGENTS replacement was generated.
3. Only after preview, ran official `init --here --force --integration codex
   --script sh --non-interactive` in Backend. No optional Git extension, automatic
   commit, stash, branch checkout, migration, deploy or model call was invoked.
4. Added project constitution and a local launcher `scripts/specify`. It sets the
   native Python override/PATH then executes the official binary; it is not a
   replacement CLI. System Python lacks PyYAML, so direct native helper calls
   must also supply `SPECKIT_PYTHON_EXECUTABLE` as documented.
5. Installed the reviewed local `backend-policy` preset using native `preset add
   --dev ... --priority 10`; verified `preset update ... --dev ...` refresh too.
   It prepends policy to all nine native commands and appends backend sections
   to native spec/plan/tasks without copying/replacing the core templates.
6. Installed `backend-sdd` with native `workflow overlay add ... --priority 10`.
   `workflow resolve speckit` and `workflow info speckit` show the expected 15 steps:
   specify, clarify, review-spec, record-requirements, plan, tasks, analyze,
   prepare-approval, review-implementation, record-approval, implement, verify,
   document, converge, record-outcome. The stable bundled workflow remains 1.0.1.

The editable preset/overlay sources live in `codex/spec-kit/`; `.specify/presets/`
and installed overlay/skills are native materializations. Keep native layer
manifests; ignore venv, run logs, feature pointer and regenerable `.composed/`
intermediates. Upstream MIT notice is retained in `.specify/UPSTREAM-LICENSE` for
generated Spec Kit material; it does not relicense this application.

## Validation executed

| Check | Result and scope |
|---|---|
| CLI version and init help | PASS — official 1.4.0, actual flags verified |
| Init preview and Backend init | PASS — 29 initial files, zero collisions, Codex default integration |
| `integration list` and integration metadata | PASS — codex installed/default, sh helpers |
| Native `artifact info spec-template --json` | PASS — local append layer above native replace base |
| `resolve-template.sh <spec/plan/tasks-template> --json` | PASS — all three contain native structure plus project addendum using venv Python |
| `workflow resolve/info speckit` | PASS — 15-step composed order including two human gates and read-only analyze before final approval |
| Local Codex app-server `skills/list` | PASS — all 9 expected speckit skills discovered, zero project skill errors; no thread/turn/model call |
| Native feature dry-run in Backend | PASS — `create-new-feature.sh --dry-run --json --short-name setup-check ...`; no real feature/pointer created |
| Legacy owner selection | PASS — `SPECIFY_FEATURE_DIRECTORY=specs/features/chat`, `SPECIFY_FEATURE_NO_PERSIST=1`, native prerequisites paths-only resolves the actual owner without migration |
| Native scaffold fixture | PASS — temporary official init + preset, native feature spec creation, setup-plan and setup-tasks resolution include backend additions |
| Native gate fixture | PASS — no verdict => paused, reject => aborted, approve => completed and only then a harmless marker; entirely temporary, not real feature approval |
| Launcher shell syntax | PASS — `sh -n scripts/specify` |
| Source/lock preservation | PASS — temporary baseline comparison: no application source/test/config/lock changes or pre-existing file deletions |
| Graph scope comparison | PASS — all 136 `src/**/*.js` hashes match survey ledger; no added/deleted JS. Commit label is old but AST input scope unchanged |

The gate fixture initially asserted `failed`; this version correctly reports run
state `aborted` on rejection, so the temporary harness expectation was corrected
and re-run. No gate implementation was changed. Graph comparison is scoped to
owned JavaScript, not OS/binary metadata outside the graph's source boundary.
These are setup checks, not application feature acceptance or historical npm tests.

### Explicit limits

- IDE skill-picker display and a model-driven end-to-end interview/implementation
  were NOT RUN; local Codex discovery itself was tested through the installed
  app-server protocol. Only initialize and skills/list requests were sent, then
  that temporary server was terminated.
- Application runtime tests/build/provider/device QA were NOT RUN because no
  application behavior changed. No new formatter, coverage threshold, CI workflow,
  production flag or deployment readiness claim was introduced.
- Native CLI workflow dispatch uses `codex exec`; it is not a dry-run and was not
  executed against Backend. Interactive clarification needs real human answers.
  Gates and direct-skill approval instructions are workflow controls, not an OS
  sandbox. Do not auto-answer a gate or treat its existence as a completed interview.
- Native converge is available/installed; no model-driven convergence of this app
  was run. Core append-only instructions were preserved. Remaining tasks require
  an explicit next cycle, not an unconditional engine loop.
- Existing proposals/open product decisions remain open. Native setup does not
  approve routing/weather/place-purpose designs or rewrite Current behavior.
- MCP memory was not available; local `PROGRESS.md` is the progress fallback.

The usage guide has actual install/refresh commands, lifecycle entry/exit/recovery,
manual skill invocation, optional native engine commands, approval audit records,
artifact ownership and the new/legacy feature selection policy:
[codex/spec-kit/README.md](../../codex/spec-kit/README.md).


## Final file inventory and final checks

Relative paths below describe this setup only, compared with the pre-edit baseline;
pre-existing unrelated working-tree changes are not attributed to this task.
**6 existing files updated, 49 files added.** No pre-existing files were deleted.
Ignored installed tooling/cache/logs are excluded from this versionable inventory.

| Updated existing file | Reason |
|---|---|
| `.gitignore` | Exclude project venv, local feature pointer, workflow logs and composition cache. |
| `AGENTS.md` | Canonical native workflow, ownership, environment and review-stage guards. |
| `CLAUDE.md` | Thin entry point aligned with the canonical guide. |
| `PROGRESS.md` | Actual setup outcomes, verification and explicit limitations. |
| `Study/SPEC_DRIVEN_WORKFLOW.md` | Vietnamese explanations grounded in the installed workflow and validation. |
| `specs/README.md` | Registry routing, native new-feature convention and supplementary templates. |

| Added file | Reason |
|---|---|
| `.agents/skills/speckit-analyze/SKILL.md` | Official Codex skill, materialized by native init/preset; retain native body. |
| `.agents/skills/speckit-checklist/SKILL.md` | Official Codex skill, materialized by native init/preset; retain native body. |
| `.agents/skills/speckit-clarify/SKILL.md` | Official Codex skill, materialized by native init/preset; retain native body. |
| `.agents/skills/speckit-constitution/SKILL.md` | Official Codex skill, materialized by native init/preset; retain native body. |
| `.agents/skills/speckit-converge/SKILL.md` | Official Codex skill, materialized by native init/preset; retain native body. |
| `.agents/skills/speckit-implement/SKILL.md` | Official Codex skill, materialized by native init/preset; retain native body. |
| `.agents/skills/speckit-plan/SKILL.md` | Official Codex skill, materialized by native init/preset; retain native body. |
| `.agents/skills/speckit-specify/SKILL.md` | Official Codex skill, materialized by native init/preset; retain native body. |
| `.agents/skills/speckit-tasks/SKILL.md` | Official Codex skill, materialized by native init/preset; retain native body. |
| `.specify/.gitignore` | Native init metadata/manifests/ignore rules; generated by official CLI. |
| `.specify/UPSTREAM-LICENSE` | Retain upstream notice for generated Spec Kit material. |
| `.specify/init-options.json` | Native init metadata/manifests/ignore rules; generated by official CLI. |
| `.specify/integration.json` | Native init metadata/manifests/ignore rules; generated by official CLI. |
| `.specify/integrations/codex.manifest.json` | Native init metadata/manifests/ignore rules; generated by official CLI. |
| `.specify/integrations/speckit.manifest.json` | Native init metadata/manifests/ignore rules; generated by official CLI. |
| `.specify/memory/.constitution-template.json` | Native init metadata/manifests/ignore rules; generated by official CLI. |
| `.specify/memory/constitution.md` | Project constitution for native design/analysis checks. |
| `.specify/presets/.registry` | Native installed preset/registry; regenerate from reviewed local source. |
| `.specify/presets/backend-policy/commands/project-policy.md` | Native installed preset/registry; regenerate from reviewed local source. |
| `.specify/presets/backend-policy/preset.yml` | Native installed preset/registry; regenerate from reviewed local source. |
| `.specify/presets/backend-policy/templates/plan-addendum.md` | Native installed preset/registry; regenerate from reviewed local source. |
| `.specify/presets/backend-policy/templates/spec-addendum.md` | Native installed preset/registry; regenerate from reviewed local source. |
| `.specify/presets/backend-policy/templates/tasks-addendum.md` | Native installed preset/registry; regenerate from reviewed local source. |
| `.specify/scripts/bash/check-prerequisites.sh` | Official native Bash helper, unmodified. |
| `.specify/scripts/bash/common.sh` | Official native Bash helper, unmodified. |
| `.specify/scripts/bash/create-new-feature.sh` | Official native Bash helper, unmodified. |
| `.specify/scripts/bash/resolve-template.sh` | Official native Bash helper, unmodified. |
| `.specify/scripts/bash/setup-plan.sh` | Official native Bash helper, unmodified. |
| `.specify/scripts/bash/setup-tasks.sh` | Official native Bash helper, unmodified. |
| `.specify/templates/checklist-template.md` | Official native template, unmodified; project sections compose via preset. |
| `.specify/templates/constitution-template.md` | Official native template, unmodified; project sections compose via preset. |
| `.specify/templates/plan-template.md` | Official native template, unmodified; project sections compose via preset. |
| `.specify/templates/spec-template.md` | Official native template, unmodified; project sections compose via preset. |
| `.specify/templates/tasks-template.md` | Official native template, unmodified; project sections compose via preset. |
| `.specify/workflows/overlays/speckit/backend-sdd.yml` | Native-installed backend workflow overlay. |
| `.specify/workflows/speckit/workflow.yml` | Official bundled workflow and native registry. |
| `.specify/workflows/workflow-registry.json` | Official bundled workflow and native registry. |
| `codex/spec-kit/README.md` | Actual setup/use/refresh guide, lifecycle and recovery rules. |
| `codex/spec-kit/backend-policy/commands/project-policy.md` | Editable local preset source: supported command/template composition. |
| `codex/spec-kit/backend-policy/preset.yml` | Editable local preset source: supported command/template composition. |
| `codex/spec-kit/backend-policy/templates/plan-addendum.md` | Editable local preset source: supported command/template composition. |
| `codex/spec-kit/backend-policy/templates/spec-addendum.md` | Editable local preset source: supported command/template composition. |
| `codex/spec-kit/backend-policy/templates/tasks-addendum.md` | Editable local preset source: supported command/template composition. |
| `codex/spec-kit/backend-sdd.yml` | Editable local native workflow overlay source. |
| `scripts/specify` | Small local launcher into the official isolated CLI, with native Python override. |
| `specs/_templates/interview.md` | Supplemental artifact template; does not replace native spec/plan/tasks. |
| `specs/_templates/progress.md` | Supplemental artifact template; does not replace native spec/plan/tasks. |
| `specs/_templates/verification.md` | Supplemental artifact template; does not replace native spec/plan/tasks. |
| `specs/system/spec-kit-setup.md` | Discovery, provenance, actual validation/limits and full changed-file inventory. |


Final checks: JSON/YAML parse passed for all new manifests/configs; core templates
and Bash scripts are byte-identical to the official init preview; local references
passed in 14 edited/added project Markdown files; launcher `sh -n` and
`git diff --check` passed. Ignore checks confirm venv, composition intermediates,
feature pointer and workflow run state are excluded. Baseline comparison confirms
only the six existing files above changed, no existing files disappeared, and
`package-lock.json` remains exactly as it was in the user's dirty tree.
No real numbered feature or `.specify/feature.json` was left in Backend.
Temporary fixtures and public-source/schema scratch directories were removed after
validation. No commit was created. Application API documentation is N/A for this
setup because no HTTP/socket contract changed; Study was updated in its existing owner.
