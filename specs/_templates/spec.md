# Feature: <name>

Status: Draft / Clarifying / Ready for review / Approved / Implementing / Implemented
Date: <YYYY-MM-DD> | Revision: <id> | Owner: <feature owner>
Authority: <specific user instruction or linked scoped approval; never infer approval>

Use `specs/features/<feature>/spec.md`. Reuse the existing owner for changes; register
a new feature in specs/README.md. Read AGENTS.md first. Delete unused template
instructions when writing real content; no empty artifacts or invented decisions.

## Problem and expected outcome

<Who needs what? What is the concrete before/after behavior? What did the user request?>

## Scope and non-goals

- In scope: <testable boundaries, roles/consumers/platforms>.
- Out of scope: <explicit exclusions, not assumptions about future approval>.
- Related features/shared conventions: <links and dependency impact>.

## Current behavior and evidence

<Relevant source/test/contract evidence and revision. Separate CB from accepted intent.
Record discrepancies at the existing owner; do not silently rewrite either side.>

## Requirement questions and confirmed answers

Populate only real questions; record a reference if another owner already owns one.
Ask focused rounds and follow up until blockers are answered. User answers are not
the same as approval of a whole plan. Routine technical details do not need user decisions.

| Question ID | Question / impact | Blocking for which work? | User answer / authority / date | Status / decision reference |
|---|---|---|---|---|
| <Q-ID> | <specific ambiguity and why it matters> | <scope or none> | <actual answer, or Pending> | <Open/Resolved/Proposed> |

## Accepted requirements and proposals

| ID | Requirement | Status | Authority / decision |
|---|---|---|---|
| <REQ-ID> | <observable behavior> | <Accepted/Proposed> | <confirmation or pending> |

<Include lifecycle/permissions/privacy/failure/concurrency/retention/provider or budget
constraints where relevant. Do not invent a numerical SLA, API field or entitlement.>

## Scenarios and acceptance criteria

| Acceptance ID | Requirement | Given / When / Then | Planned verification |
|---|---|---|---|
| <AC-ID> | <REQ-ID> | <concrete observable scenario> | <test/manual check> |

Include important invalid input, denied access, empty/offline/failure/retry and race
cases as applicable. Label proposed checks separately from executed evidence.

## Review and approval status

- Requirements revision: <id>.
- Plan revision: <id/path>.
- Canonical approval/decision record: <link or exact user instruction/date/scope>.
- Unresolved blockers: <IDs, or None with evidence; non-blocking rollout gaps remain explicit>.

Do not mark Approved from file creation, silence or passing tests. Reuse a valid
scoped approval rather than asking the same question again.

## Delivery and ownership

- Feature contracts/model: <owner paths; add only when this feature needs them>.
- Client integration handoff: `api-docs/<chosen-file>.md`, or specific N/A reason.
- Human learning note: `Study/<chosen-file>.md`; update an existing note if it owns the topic.
- Source/tests: <exact affected paths>.
- Verification outcome/limits: <actual commands/results/date; implemented != deployed>.
- Related plan/tasks and PROGRESS: <paths>.
