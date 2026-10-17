# Progress Log

## Current Goal

Deliver truthful, gap-aware journey geometry and sufficiently dense location history without breaking existing mobile clients.

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
| Done | Create iOS integration documentation | Added `API_INTEGRATION_IOS.md` covering REST APIs, Socket.io contracts, integration flows, and Swift Codable models. |
| Done | Create Google OAuth2 mobile testing documentation | Added `GOOGLE_OAUTH2_MOBILE_API_DOC.md` for mobile Google ID token setup, API testing, Swagger/cURL usage, and debug checklist. |
| Done | Implement Cloudflare R2 image and voice upload flow | Added generalized media presigned URL endpoint, R2 storage config, voice chat messages, socket contract updates, docs, and tests. |
| Done | Add local Cloudflare R2 account config | Added complete local Cloudflare R2 config for bucket `life360`, including account ID, API credentials, public development URL, upload TTL, and media size limits. |
| Done | Fix npm audit CI failure | Removed `nodemon`/`chokidar` dev dependency by switching `npm run dev` to Node 20 native watch mode and updated `proxy-addr` to the patched lockfile version. |
| Done | Implement Redis caching/session layer | Added Upstash-compatible `ioredis` cache manager with no-op fallback, user/circle cache-aside decorators, logout token blacklist, refresh session tracking, last-location Redis cache, and media metadata cache. |
| Done | Configure local Upstash Redis URL | Added local `.env` Redis settings with `REDIS_ENABLED=true` and the Upstash `rediss://` connection URL. |
| Done | Document Redis localhost testing | Expanded `Study/REDIS_PERFORMANCE_AND_CACHING_ARCHITECTURE.md` with important files, setup steps, runtime flows, sequence diagrams, and localhost test checklist. |
| Done | Implement refresh token rotation | Added MongoDB-backed opaque single-use refresh tokens, atomic family rotation/reuse detection, logout-all, password-change revocation, device/session limits, Socket disconnect, Swagger/mobile docs, and integration tests. |
| Done | Document Cloudflare R2 mobile integration | Added a standalone mobile API guide covering presigned tickets, raw PUT uploads, image/voice Socket and REST contracts, Swift models/services, errors, and testing. |
| Done | Accept measured GPS time and accuracy | Added optional `recordedAt`/`accuracy` to `update_location`, bounded timestamp fallback, monotonic last-known writes, Mobile API docs, and integration coverage. |
| Done | Implement offline location batch sync | Added authenticated `POST /api/v1/locations/batch`, partial per-point validation, UUID idempotency, monotonic MongoDB/Redis last-location updates, per-user rate limiting, no-broadcast behavior, mobile docs, and integration tests. |
| Done | Refresh project README | Reconciled implemented features, Google OAuth mobile setup, refresh rotation, Redis/R2, offline location sync, API routes, environment variables, tests, Docker and Render/GHCR delivery with the current codebase. |
| Done | Route geometry B0-B1 | Documented the verified history/journey behavior and added pure, tested domain primitives for route distance, gaps, thinning, ordering, deduplication, and dense-history persistence decisions. |
| In Progress | Route geometry B2-B5 | B2 and B3 are complete: dense persistence/deduplication are wired, and `detail=geometry` adds stable route points, gaps, distance, thinning, and observed moving time without changing the legacy response. B4 range pagination is next. |
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
- `API_INTEGRATION_IOS.md`: iOS-facing API and realtime integration guide.
- `GOOGLE_OAUTH2_MOBILE_API_DOC.md`: Focused Google OAuth2 mobile login testing guide.
- `Study/CLOUDFLARE_R2_MEDIA_UPLOAD.md`: R2 media upload architecture and implementation decisions.
- `Study/REDIS_PERFORMANCE_AND_CACHING_ARCHITECTURE.md`: Redis architecture, implementation plan, and current implementation status.
- `Study/refresh-token-rotation.md`: Refresh token threat model, approved decisions, implementation plan, and status.
- `docs/REFRESH_TOKEN_MOBILE_API_DOC.md`: Mobile contract and Swift single-flight refresh guidance.
- `docs/CLOUDFLARE_R2_MEDIA_UPLOAD_API_DOC.md`: Complete iOS contract for image and voice uploads through Cloudflare R2.
- `api-docs/LOCATION_UPDATE_API_DOC.md`: Mobile Socket.IO contract for measured GPS timestamps and accuracy.
- `Study/OFFLINE_LOCATION_BATCH_SYNC.md`: P6 architecture, decisions, data flow, risks, and rollback.
- `Study/route-geometry-backend.md`: Verified journey/history behavior, geometry design, storage estimates, decisions, rollout, and rollback.
- `src/domain/routeGeometry.js`: Pure route ordering, distance, gap analysis, link construction, and gap-safe thinning.
- `src/domain/historyPersistence.js`: Pure configurable decision policy for dense history persistence.

## Technical Notes

- The repository is currently JavaScript, not TypeScript, but the tooling scans both JS and TS extensions.
- The architecture follows `presentation -> application -> infrastructure`, with pure helpers in `domain`.
- The local sandbox blocks writes to `.codex/`, so the Codex config is provided as `codex/config.example.toml`. Copy it to `.codex/config.toml` outside the sandbox if project-scoped Codex MCP config is needed.
- Google OAuth follows the existing Clean Architecture flow: `authRoutes -> authController -> authUseCases -> oauthProviderFactory/user repositories -> Mongoose models`.
- Cloudflare R2 media upload keeps backend out of the binary path: REST issues signed PUT URLs, clients upload to R2, and chat messages carry verified media URLs.
- Security audit now passes with `npm audit --audit-level=high`; dev reload uses `node --watch server.js` instead of `nodemon`.
- Redis integration is optional and fail-soft: `REDIS_ENABLED=false` uses a no-op cache, while `REDIS_ENABLED=true` expects an Upstash-style `rediss://` URL.
- Redis keys follow domain naming in `src/domain/cacheKeys.js`; application code depends on cache abstractions, not directly on `ioredis`.
- Refresh session correctness lives in MongoDB transactions; Redis remains best-effort for cache and access-token blacklist. Refresh tokens are opaque and only SHA-256 hashes are persisted.
- Offline location batches are idempotent by `(userId, pointId)`, accept partial validity, never broadcast or trigger stay alerts, and keep last-known MongoDB/Redis state monotonic by `recordedAt`.
- Route geometry B1 is not wired to production yet; B2 must preserve the old realtime policy while its feature flag is off.

## Next Update Checklist

- Add any architectural decisions discovered during future work.
- Record important module relationships in MCP memory when the server is available.
