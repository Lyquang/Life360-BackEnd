# Progress Log

## Current Goal

Set up a token-efficient repository understanding workflow with MCP memory configuration, skeleton generation, task tracking, and code flow tracing.

## Task Board

| Status | Task | Notes |
| --- | --- | --- |
| Done | Add MCP memory configuration | Added `mcp.json`, `.vscode/mcp.json`, and `codex/config.example.toml` for `@modelcontextprotocol/server-memory`. |
| Done | Add codebase skeleton tooling | Added `scripts/codebase-skeleton.js` to generate source signatures and module graph. |
| Done | Add visual graph viewer | Added `scripts/codebase-graph-html.js` and `npm run context:graph` to generate `codex/context/graph.html`. |
| Done | Add code flow tracing tooling | Added `scripts/trace-flow.js` for file dependency and term tracing. |
| Done | Add agent workflow rules | Added `AGENTS.md` with context budget, tracing, architecture, and progress rules. |
| Done | Validate generated context output | `npm run context:skeleton`, `npm run context:trace -- --file ...`, and `npm run context:trace -- --term conversationId` pass. |
| Done | Implement Google OAuth social login | Added domain OAuth contract, Google provider adapter, social account repository/model, auth use case, REST endpoint, config, and tests. |
| Pending | Seed MCP memory graph | Requires MCP server to be installed/connected by the local client. |

## Key Files

- `mcp.json`: Portable MCP server configuration.
- `.vscode/mcp.json`: VS Code MCP server configuration.
- `codex/config.example.toml`: Codex project-scoped MCP config sample.
- `scripts/codebase-skeleton.js`: Generates compact codebase skeleton and module graph.
- `scripts/codebase-graph-html.js`: Generates an interactive browser graph at `codex/context/graph.html`.
- `scripts/trace-flow.js`: Traces term matches and file dependency edges.
- `AGENTS.md`: Operating rules for future AI agent sessions.
- `PROGRESS.md`: Human-readable progress and task state.

## Technical Notes

- The repository is currently JavaScript, not TypeScript, but the tooling scans both JS and TS extensions.
- The architecture follows `presentation -> application -> infrastructure`, with pure helpers in `domain`.
- The local sandbox blocks writes to `.codex/`, so the Codex config is provided as `codex/config.example.toml`. Copy it to `.codex/config.toml` outside the sandbox if project-scoped Codex MCP config is needed.
- Google OAuth follows the existing Clean Architecture flow: `authRoutes -> authController -> authUseCases -> oauthProviderFactory/user repositories -> Mongoose models`.

## Next Update Checklist

- Add any architectural decisions discovered during future work.
- Record important module relationships in MCP memory when the server is available.
