# Feature: <name>

Status: Draft | Date: <YYYY-MM-DD> | Owner: <name or team>

Location: `specs/features/<feature>/spec.md`. Reuse the existing feature folder for bugs/enhancements; read its decisions/discrepancies before editing. Shared architecture/config/transport conventions live in `specs/system/` and must be linked rather than duplicated.

## Problem and outcome

<Who needs what, and why?>

## Scope and non-goals

- In scope: <...>
- Out of scope: <...>

## Current behavior and dependencies

<Link source files and existing contracts; identify assumptions and external dependencies.>

## Scenarios and acceptance criteria

- Given <context>, when <action>, then <observable result>.
- Include authorization, invalid inputs, failure, retries, privacy and concurrency when relevant.

## Requirements

<Record authority/date for accepted requirements; keep proposals and source-observed behavior distinct. Preserve existing stable IDs.>

- FR-001: <testable behavior>
- NFR-001: <security, reliability or performance requirement with measurable conditions>

## Open decisions

- <Question, impact and owner; do not state proposed behavior as implemented.>

## Ownership and verification

<List exact affected source/test files, owning model/contract, linked feature impacts and verification evidence. Add contracts/model documents only when needed; plan/tasks only for concrete substantial work.>
