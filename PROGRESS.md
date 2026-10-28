# Progress Log

## Current Goal

Deliver a gated, cursor-safe live journey trail without breaking existing location and offline-sync clients.

### Grafana M3b HTTP correlation (2026-10-27)

- Added server-generated `X-Request-Id` to Express requests, including health and `/metrics`; inbound IDs are ignored. AsyncLocalStorage carries the ID through async handlers. Completion logs contain only allowlisted route group, status, elapsed time and generated ID; no URL, query, headers or body.
- Wired safe JSON logger into default bootstrap and `server.js`; startup/shutdown and conversation-sync logs use fixed event codes. Socket per-event correlation and remaining dynamic logging are M3c, not covered here. No Cloud shipping or production metrics enablement.
- Seven review files: `server.js`, `src/bootstrap.js`, `src/infrastructure/observability/safeLogger.js`, `src/presentation/http/app.js`, `src/presentation/http/middleware/requestContext.js`, `tests/httpRequestContext.test.js`, `PROGRESS.md`. Suggested commit: `feat(observability): propagate server-generated HTTP request IDs`. No git add/commit/push.
- Verification: final full suite 193/193 passed (49 suites), targeted HTTP test 2/2 passed, npm run lint, context graph refresh and git diff --check passed. M4 performance acceptance remains pending.

### Grafana M1a foundation (2026-10-26)

- Added application Metrics/Noop port, isolated Prometheus registry and bounded policy; METRICS_ENABLED defaults false. No bootstrap wiring, runtime collectors or /metrics endpoint yet (M1b). No external shipping.
- Exactly 8 review files: package.json/lock, config/env.js, application/ports/metrics.js, infrastructure/observability/{metricsPolicy,metricsRegistry}.js, tests/metricsFoundation.test.js, PROGRESS.md. No commit.
- HTTP policy groups routes into 10 fixed values; 5 finite duration buckets, duration labels only route. Enumerated worst case = 570 series, leaving 1,930 of the 2,500 cap for later runtime/business metrics. Unknown input collapses to other; forbidden extra fields are discarded; registry construction/recording/snapshot failures are fail-soft. Noop avoids loading prom-client or reading input.
- Dependency pinned to approved prom-client 15.1.3. npm marks it deprecated in favor of @prometheus-io/client; no migration performed without revisiting the approved dependency choice. Official reference: https://github.com/prometheus/client_js . Audit after install: zero vulnerabilities.
- Baseline BEFORE instrumentation: local darwin/arm64 Node v26.7.0, real createServer through tests/helpers/testServer.startTestServer({withStorage:false}), Mongo in-memory replica set child, Redis off. Warm up 5 seconds after listen; 10 RSS samples one second apart, one GET /api/health before each sample; process.memoryUsage().rss sorted. Min 80,379,904 bytes; median (upper middle) 149,143,552 bytes; max 172,589,056 bytes. Includes test harness/imports, excludes Mongo child. No .env loaded or production service contacted. Short local smoke is not a stable Render baseline or a measured monitoring overhead; wide RSS spread warrants longer warmup/repeats at M4. Production baseline remains unverified.
- M1b must add authenticated gzip endpoint and measure actual compressed/uncompressed exposition plus runtime lifecycle cleanup. README/.env.example operational setup accompanies endpoint wiring, not this disconnected foundation.
- M1a verification: 184/184 tests pass across 49 suites, including cardinality enumeration, 10,000 unknown label inputs, disabled mode, isolated registries, invalid values and cap enforcement. npm run lint, audit (zero vulnerabilities), context graph regeneration and git diff --check pass. No runtime overhead claim: enabled instrumentation benchmark remains M4.

## Task Board

### Grafana M1b (2026-10-26)

- Added private GET /metrics before CORS/parsers, no Swagger path, no DB query; disabled=404, wrong bearer=401, non-GET=405, per-instance 10/min=429 with Retry-After, concurrent scrape bounded to one. Dedicated METRICS_TOKEN 32-256 characters required when enabled, cannot equal JWT_SECRET. TLS is terminated by deployment proxy. Defaults stay disabled; no secrets configured.
- Gzip negotiated through Accept-Encoding (gzip;q=0 respected), async zlib, 1 MiB plain exposition cap, no-store. HTTP finish/close measured once with route groups; unexpected route input collapses to unmatched/other. Abort counted as status_class=other; metrics failures cannot alter business responses.
- Runtime adds 16 fixed series: RSS/heap/external/array buffers, cumulative sampled CPU/GC, uptime/start time, active resource count (not native handle inventory), event loop mean/max/p99 and series count. Local perf observers disabled/disconnected on server close, no worker/shipping. CPU/GC totals are exported as cumulative gauges in this version; not per-user. Timers/observers only created when enabled.
- Actual payload measurement: real-server fixture (50 unknown URLs + auth + Swagger) = 43 series, 5,413 plain bytes / 845 gzip bytes. Exhaustive HTTP label fixture + runtime = 586 series, 51,694 plain bytes / 2,830 gzip bytes. Runtime values vary; these are fixtures, not production egress claims. At one scrape/min, exhaustive fixture ~4.08 MB/day gzip excluding transport headers, versus ~74.44 MB/day uncompressed.
- Exactly 8 review files: .env.example, config/env.js, bootstrap.js, presentation/http/app.js, middleware/metrics.js, infrastructure/observability/metricsRegistry.js, tests/metricsHttp.test.js, PROGRESS.md. Operational settings documented in env example here; full README/runbook remains pending documentation phase to respect file budget. Container business services remain unchanged; bootstrap owns operational registry lifetime.
- Suggested commit: feat(observability): expose authenticated gzip metrics endpoint. No git add/commit/push. Full overhead acceptance (p95 <=5%, RSS <=+20 MB) still requires M4; current measurements are exposition size, not benchmark proof.
- Verification: 188/188 tests pass across 49 suites; targeted foundation/HTTP tests 8/8 pass, npm run lint passes, explicit node --check on all 114 server/source JS files passes, git diff --check passes, context graph regenerated. No production configuration or Cloud export changed.

### Grafana M3a foundation (2026-10-27)

- Added pinned Pino 10.1.0, Logger port, JSON stdout adapter, strict event-code and metadata allowlists, generated correlation IDs and AsyncLocalStorage helper. Arbitrary strings, Error objects, nested fields, user IDs and location data are discarded before reaching the Pino writer. Socket/HTTP propagation and replacement of existing console wiring are M3b/M3c.
- Seven review files: package.json/lock, src/application/ports/logger.js, src/infrastructure/observability/logContext.js and safeLogger.js, tests/safeLogger.test.js, PROGRESS.md. Suggested commit: `feat(observability): add privacy-safe JSON logger foundation`. No commit/push or external log shipping.
- Verification: 191/191 tests pass (49 suites), including 3 new privacy/concurrency tests. Lint, audit (0 vulnerabilities), diff check and context graph refresh pass. Log transport overhead and M4 acceptance remain unmeasured.

Grafana observability M0 (2026-10-26): source/log inventory and provider research completed in `Study/grafana-observability.md` and `Study/grafana-options.md`. Waiting for `approved M0`, provider choice and phase splits; no runtime instrumentation or external telemetry configured. Documentation-only verification; tests not run for M0.

Grafana M0 approved with amendments (2026-10-26): local Compose staging, C then A with separate M5 consent, gzip scrape, 2,000-2,500 series/env, generated request IDs and stdout-only logging before benchmark. M3-0 first: fixed event codes replace URI/raw errors and identity-bearing logs. Review batches: foundation (connection/HTTP/server/Redis + study docs), then socket/auth/stay/chat/digest + privacy test. No metrics enabled, no secrets accessed, no commit. Baseline RSS measurement remains a prerequisite before M1 enables instrumentation.

M3-0 verification: 180/180 tests pass (49 suites), including two new privacy regression tests; npm run lint and git diff --check pass. Initial sandbox run failed on localhost EPERM; rerun outside sandbox passed. This is targeted log removal, not yet the full M3 sanitization layer; digestScheduler raw error.message and other dynamic errorName fields remain for the comprehensive logging phase. No Cloud shipping or RSS baseline claim.

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
| Done | Patch follow-redirects security advisories | Updated the test-only transitive dependency `follow-redirects` from `1.16.0` to `1.16.1`; high-level audit, lint, and all 178 tests pass. |
| Done | Implement Redis caching/session layer | Added Upstash-compatible `ioredis` cache manager with no-op fallback, user/circle cache-aside decorators, logout token blacklist, refresh session tracking, last-location Redis cache, and media metadata cache. |
| Done | Configure local Upstash Redis URL | Added local `.env` Redis settings with `REDIS_ENABLED=true` and the Upstash `rediss://` connection URL. |
| Done | Document Redis localhost testing | Expanded `Study/REDIS_PERFORMANCE_AND_CACHING_ARCHITECTURE.md` with important files, setup steps, runtime flows, sequence diagrams, and localhost test checklist. |
| Done | Implement refresh token rotation | Added MongoDB-backed opaque single-use refresh tokens, atomic family rotation/reuse detection, logout-all, password-change revocation, device/session limits, Socket disconnect, Swagger/mobile docs, and integration tests. |
| Done | Document Cloudflare R2 mobile integration | Added a standalone mobile API guide covering presigned tickets, raw PUT uploads, image/voice Socket and REST contracts, Swift models/services, errors, and testing. |
| Done | Accept measured GPS time and accuracy | Added optional `recordedAt`/`accuracy` to `update_location`, bounded timestamp fallback, monotonic last-known writes, Mobile API docs, and integration coverage. |
| Done | Implement offline location batch sync | Added authenticated `POST /api/v1/locations/batch`, partial per-point validation, UUID idempotency, monotonic MongoDB/Redis last-location updates, per-user rate limiting, no-broadcast behavior, mobile docs, and integration tests. |
| Done | Refresh project README | Reconciled implemented features, Google OAuth mobile setup, refresh rotation, Redis/R2, offline location sync, API routes, environment variables, tests, Docker and Render/GHCR delivery with the current codebase. |
| Done | Route geometry B0-B1 | Documented the verified history/journey behavior and added pure, tested domain primitives for route distance, gaps, thinning, ordering, deduplication, and dense-history persistence decisions. |
| Done | Route geometry B2-B5 | Added feature-flagged dense persistence, realtime/batch deduplication, opt-in journey geometry with gaps/thinning, cursor-paginated raw history, mobile contracts, deployment configuration, and interview notes. |
| Done | Route geometry B6 mobile contract follow-up | Published geometry policy, hybrid gap/stay quality, stable stay IDs, defensive gap filtering, observed/unobserved summaries, and `includePath=false`; measured a 31.07% reduction on the documented 100-point fixture. |
| Planned / Deferred | Road map matching for journey geometry | B6b/B6c prerequisites are complete, but M0 deliberately keeps T1-T3 unmatched and defers T4 until raw-trail evaluation; OSRM is the first POC if matching is later approved. |
| Approved / Gated | Live trail B7-0 and map-matching M0 | T1-T3 use raw trails with Noop/Fake matcher behind default-off flags. Privacy/Circle hooks are done; rollout still requires real MongoDB/Socket.IO load gates. T4/OSRM POC remains deferred. |
| Done / Gated | Live trail B7 T1a persistence | Added transaction-backed trail metadata/points, monotonic insertion cursors, late revision, idempotent realtime/batch projection, TTL/accuracy policy and fail-soft tests. `LIVE_TRAIL_ENABLED` remains false; T1b is next. |
| Done / Gated | Live trail B7 T1b REST read | Added authorized snapshot/catch-up pagination, revision conflict recovery, stable seq-boundary gaps and per-requester limiting. Feature remains disabled by default; T2 socket watch is next. |
| Done / Gated | Live trail B7 T2 Socket watch/delta | Added authorized per-trail rooms, five-watch cap, per-socket limiter, 60-second permission lease, bounded cursor deltas, late/batch resets, stale-current suppression, cleanup and integration coverage. Immediate privacy/member-removal hooks now supplement the lease. |
| Done / Gated | Live trail B7 T3 matcher framework | Added the provider port, Noop/Fake adapters, gap/accuracy-safe overlapping windows, provisional/final lifecycle, revision-scoped durable matches, bounded queue, timeout/circuit fallback, REST/Socket match updates and tests. No real provider; matcher remains disabled. |
| Done / Gated | Live trail B7 T5 docs and deployment readiness | Added complete Swagger/mobile contracts, rollout and rollback gates, Render/env documentation and a reproducible synthetic benchmark. Production remains blocked on real MongoDB/Socket.IO load tests. |
| Done | Live trail privacy and Circle exit hooks | Added account-wide pause/resume, shared location access enforcement, SOS override, transactional leave/admin removal, room cleanup, immediate watch invalidation, Swagger/mobile docs and integration tests. |
| Done | Mobile location API documentation index | Added one canonical reading map for realtime/offline location, journey/history, Live Trail, privacy and Circle membership contracts. |
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
- `api-docs/MOBILE_LOCATION_INTEGRATION_INDEX.md`: Entry point and integration order for all mobile location, Live Trail, privacy and Circle membership contracts.
- `api-docs/LIVE_TRAIL_API_DOC.md`: Mobile REST snapshot/catch-up contract, cursor/revision recovery and stable gap semantics.
- `Study/OFFLINE_LOCATION_BATCH_SYNC.md`: P6 architecture, decisions, data flow, risks, and rollback.
- `Study/route-geometry-backend.md`: Verified journey/history behavior, geometry design, storage estimates, decisions, rollout, and rollback.
- `Study/route-geometry-mobile-contract-followup.md`: B6 plan for timezone, gap semantics, stay quality, timestamp naming, and payload negotiation.
- `Study/ROAD_MAP_MATCHING_BACKEND.md`: Provider assessment and implementation plan for gap-safe, cacheable road map matching.
- `Study/live-trail-backend.md`: B7-0 verified architecture and execution plan for watch-based live journey trails.
- `Study/LIVE_TRAIL_PRIVACY_AND_CIRCLE_EXIT.md`: Plan for temporary sharing pause, Circle leave/removal and immediate live-watch invalidation.
- `api-docs/PRIVACY_AND_CIRCLE_MEMBERSHIP_API_DOC.md`: iOS contract for privacy state, Circle membership lifecycle and realtime closure events.
- `Study/map-matching-options.md`: M0 provider, Apple Maps terms, infrastructure, privacy and cost decision gate.
- `src/domain/routeGeometry.js`: Pure route ordering, distance, gap analysis, link construction, and gap-safe thinning.
- `src/domain/historyPersistence.js`: Pure configurable decision policy for dense history persistence.
- `src/domain/liveTrail.js`: Pure live-trail date, retention, quality and deduplication policy.
- `src/infrastructure/repositories/liveTrailRepository.js`: Transactional seq/revision persistence adapter.
- `src/application/history/liveTrailWatchUseCases.js`: Authorization and lease revalidation for trail watches.
- `src/application/location/liveTrailDeltaPublisher.js`: Bounded single-instance delta aggregation and reset publication.
- `src/presentation/socket/gateways/liveTrailGateway.js`: Socket watch/unwatch validation, limits, rooms and cleanup.
- `src/domain/liveTrailMatching.js`: Pure window, quality, revision and stable segment policies.
- `src/application/location/liveTrailMatchingService.js`: Bounded asynchronous matching queue, timeout and circuit breaker.
- `src/infrastructure/database/models/LiveTrail.js`: Trail, point and revision-scoped match persistence.
- `src/infrastructure/matching/`: Noop production fallback and deterministic test-only FakeMatcher.
- `scripts/benchmark-live-trail.js`: Synthetic delta/matcher queue regression benchmark; deliberately excludes database and network capacity.

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
- Route geometry B2-B6d is wired; dense persistence remains rollout-gated and legacy reads stay backward compatible.
- Geometry B6b treats long same-region silence as an inferred stay and long far movement as a route gap; legacy journey output remains unchanged.
- Live trail T1a writes are disabled by default and fail independently from the existing location broadcast/history flow.
- Live trail T2 is single-instance: watch rooms and pending delta buffers are in memory. Horizontal scale requires a Socket.IO Redis adapter and distributed limiter/coordination.
- Offline batches never emit trail deltas; any accepted batch projection emits `journey:trail_reset` so clients reload canonical ordering through REST.
- B7 T2 verification on 2026-10-18: all 155 tests passed with `--test-concurrency=1`; lint and `git diff --check` passed.
- B7 T3 verification on 2026-10-19: all 165 tests passed; matcher failure/timeout leaves raw trail available, and no real provider is enabled.
- B7 T5 local smoke on 2026-10-19: 2,000 points produced 100 bounded deltas (max 2,899 bytes) in 22.47 ms; FakeMatcher persisted/published 600 windows in 9.03 ms at concurrency 4. These in-process numbers are not a production SLA.
- Privacy/Circle targeted verification on 2026-10-19: 9 tests pass, including domain expiry, runtime reset, digest masking, immediate closure, shared-Circle preservation and transaction rollback.
- Privacy/Circle final verification on 2026-10-19: full regression passes 174/174 tests across 48 suites; syntax lint and whitespace checks pass.
- 2026-10-22: Mapbox Map Matching adapter đã nối vào pipeline Live Trail; 178/178 Backend tests và syntax lint pass. Chưa bật trên deployment do thiếu token, load gate và thử nghiệm hai thiết bị. Cấu hình mặc định vẫn noop/tắt.
- 2026-10-22: Patched transitive `follow-redirects` advisory through a lockfile-only update to `1.16.1`; `npm audit --audit-level=high` reports 0 vulnerabilities.

## Next Update Checklist

- 2026-10-26 security patch: lockfile upgrades body-parser 1.20.8 -> 1.20.9, fast-uri 3.1.8 -> 3.1.9, ip-address 10.7.2 -> 10.7.5, zod 4.6.5 -> 4.6.7. No force/major upgrade. Audit reports zero vulnerabilities; all 180 tests (49 suites) and lint pass. No commit performed.

- Add any architectural decisions discovered during future work.
- Record important module relationships in MCP memory when the server is available.
