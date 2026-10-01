# Agent Operating Guide

## Context Budget Rules

- Start broad codebase reads with `npm run context:skeleton`.
- Prefer `codex/context/codebase-skeleton.md` and `codex/context/module-graph.json` before opening many source files.
- Use targeted searches with `rg` and `npm run context:trace -- --term <name>` for data flow questions.
- Load full implementation files only after the skeleton or graph identifies the relevant files.
- Do not read `node_modules`, generated context output, build output, coverage, logs, lockfiles, or binary assets unless the task explicitly requires it.

## Architecture Rules

- Respect the existing layered flow: `presentation -> application -> infrastructure -> database/models`, with `domain` kept pure.
- Wire dependencies in `src/container.js`.
- Keep controllers/gateways focused on validation, auth context, use case calls, and response/event formatting.
- Keep use cases free of Express, Socket.io, Mongoose, S3, JWT, and bcrypt details.

## Memory And Progress

- Use the `memory` MCP server for durable knowledge graph entries when it is available.
- Record durable facts as entities and relations: architecture decisions, module ownership, dependency edges, unresolved risks, and task outcomes.
- Update `PROGRESS.md` after each completed task or meaningful refactor.
- `PROGRESS.md` is the local fallback when MCP memory is unavailable.

## Tracing Workflow

- For HTTP flow tracing, start from `src/presentation/http/routes`, then controller, use case, repository, model.
- For socket flow tracing, start from `src/presentation/socket/socketServer.js`, then gateway, use case/realtime service, repository/model.
- For dependency questions, run `npm run context:trace -- --file <path>` after refreshing the skeleton.
