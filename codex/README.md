# Codex Context Toolkit

This folder contains local agent configuration and generated context files.

## Files

- `config.example.toml`: Copy to `.codex/config.toml` to enable project-scoped Codex MCP memory.
- `memory.jsonl`: Local knowledge graph storage used by `@modelcontextprotocol/server-memory`.
- `context/`: Generated skeleton and module graph output.

## Commands

```bash
npm run context:skeleton
npm run context:graph
npm run context:trace -- --term conversationId
npm run context:trace -- --file src/presentation/http/controllers/chatController.js
```

Generated context files are ignored by git because they can be regenerated.
