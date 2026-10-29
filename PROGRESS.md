# Progress Log

### SOS assistance S2b: responses, visibility and closure (2026-10-29)

- Added get/respond/close application use cases and shared audience access policy. Owners see historical responders; other members see only responders in their original, still-authorized Circles. Filtering happens before pagination. Later joiners cannot access the incident through these use cases.
- Assistance persists response, revision, per-group chat messages and recipient outbox events atomically. Concurrent retries deduplicate; membership changes trigger transaction retries. Only the owner can resolve/cancel; repeated same closure is idempotent. Existing assistance can replay after closure while authorized; new assistance is rejected.
- Nine new replica-set integration tests cover concurrent response/closure, pagination visibility, join/leave races, self-assistance, authorization and rollback. Full npm test: 249/249 passed across 56 suites; lint and explicit syntax checks passed.
- Updated Study and CLAUDE.md; refreshed context graph. Container, dispatcher and HTTP/socket wiring remain upcoming. Final mobile contract will be delivered as `api-docs/SOS_ASSISTANCE_API_DOC.md` after integration is implemented and tested. No stage/commit/push.
- Suggested commit: `feat(sos): add assistance responses and incident lifecycle`.

### SOS assistance S2a: transactional creation (2026-10-29)

- Added application `createSosUseCases().create`: persists incident, one text SOS per Circle, conversation/read-pointer updates and per-recipient outbox events in one transaction. Urgent alerts deduplicate across shared Circles; creation response reports groupCount/recipientCount without exposing recipient IDs.
- Added per-Circle audience snapshots and hidden Group sosGuardVersion writes, which conflict with existing join/leave/remove writes so transaction retries reload membership. Fanout limits must be injected explicitly; no production defaults/env changes. Missing chat or capacity overflow rolls back the whole creation.
- Same request ID replays even after closure; a new ID during an active incident returns conflict rather than acknowledging an unpersisted alias. Legacy requests without IDs reuse the active incident. SOS coordinates are explicit-only and not copied into generated chat text/outbox.
- Nine new replica-set tests cover multi-Circle fanout, concurrent replay, legacy behavior, explicit coordinates, capacity/no groups, multi-group rollback, missing chat, leave race and standalone rejection. Full npm test passes 240/240 tests across 55 suites; lint, explicit syntax checks of six changed JS files, graph refresh and diff check pass.
- Updated Study and CLAUDE.md. Creation is not wired to container/API/socket; dispatcher, respond/read/close remain next. No stage/commit/push. Suggested commit: `feat(sos): create incidents with atomic group chat fanout`.

### SOS assistance S1b: chat metadata and durable outbox (2026-10-28)

- Added optional server-owned SOS metadata to text messages and additive message DTOs. Partial unique indexes enforce one alert per incident/conversation and one assistance message per incident/conversation/sender. Ordinary message creation still ignores injected SOS metadata.
- Added transaction-only createSosMessage and optional session propagation for conversation lastMessage/member read-pointer updates. Integration test verifies all writes, including incident/outbox, roll back together; ordinary chat remains compatible.
- Added per-recipient reference-only SosOutbox and repository: unique event keys, atomic claim, expiring token-protected lease, retry scheduling, attempt limits and recovery of a final-attempt crash. Dispatcher, backoff policy, permission revalidation and API/socket wiring are upcoming; no notifications emitted by this slice.
- Verification: seven new tests pass; full suite 231/231 tests in 54 suites. Lint, explicit syntax checks for eight changed JS files, graph refresh and diff check pass. Updated CLAUDE.md and SOS Study progress. No stage/commit/push.
- Suggested commit: `feat(sos): add chat metadata and durable outbox`. Next: application use cases and membership authorization, followed by dispatcher and HTTP/socket wiring.

### SOS assistance S1a: persistence foundation (2026-10-28)

- Added pure SOS state/self-assistance rules, SosIncident/SosResponse models and an aggregate repository. Unique indexes enforce one active incident per owner, per-owner optional request IDs, and one response per incident/responder. No expiry/TTL policy has been enabled.
- Repository writes require an active MongoDB transaction; revision compare-and-set serializes future response/closure operations. Authorization, replay recovery and touchActive + createResponse composition belong to the upcoming use cases. No API/socket/container wiring yet; existing SOS behavior remains operational.
- Added nine domain/replica-set tests covering concurrent duplicates, missing transaction/revision, rollback, close/respond contention and bounded pagination. Full suite passes 224/224 tests in 53 suites; lint, explicit syntax checks for all five new files, context graph refresh and diff check pass.
- Updated `Study/SOS_GROUP_CHAT_ASSISTANCE.md`; next slice is chat SOS metadata/session support and durable outbox. Push provider, withdrawal and retention remain for their respective phases. No stage/commit/push. Suggested commit: `feat(sos): add incident and assistance persistence`.

### Grafana local logs, traces, Gmail alerts and dashboard descriptions (2026-10-28)

- Added local Loki 3.7.8 + Alloy 1.21.2 log collection and Tempo 3.1.1 traces, Grafana 12.3.0 datasources, and manual request/Socket spans with bounded attributes. Logs stay local; only allowlisted JSON fields and static Loki labels are indexed, with traceId/spanId correlation.
- Added a Logs dashboard; added Vietnamese descriptions to all 31 metrics panels and test enforcement. Provisioned seven alert rules plus Gmail contact point to `lythanhnhatquangthongnhat2004@gmail.com`, including any backend error-level log event; SMTP uses an ignored local secret placeholder. Real email delivery remains unverified until user sets Gmail App Password. Cloud log/trace export remains disabled and gated.
- Updated local monitoring README and Study doc. No Render configuration, production secrets, commit, or push. Suggested commit: `feat(observability): add local logs traces and email alerts`.
- Verification: full `npm test` 215/215 across 51 suites; lint and `npm audit --audit-level=high` pass with zero vulnerabilities; Compose config and `git diff --check` pass. Grafana has all seven evaluated rules and the Gmail contact point, all three datasource health checks are `OK`; Loki returns correlated JSON log lines and Tempo trace lookup returned HTTP 200. 31 metrics panel descriptions are present; Grafana Logs dashboard API returned HTTP 200. No email was sent because the ignored Gmail App Password file is still a placeholder. No commit/push. M4 performance gate with Loki/Tempo remains unmeasured.

### Grafana M4c local alert rules (2026-10-28)

- Added four Grafana-provisioned local rules: backend scrape down, Mongo pool checkout failure, Redis connection error, digest job error. No contact point/policy/SMTP and no Cloud telemetry export.
- Added `npm run monitoring:validate-alerts`, a Grafana API validation command, plus local-only fire/recovery instructions. Benchmark evidence remains noisy: one of three repeats met the p95 gate; no acceptance claim.
- Files changed: `ops/monitoring/provisioning/alerting/familytracker.yml`, `scripts/validate-monitoring-alerts.js`, `package.json`, `ops/monitoring/README.md`, `Study/grafana-observability.md`, `PROGRESS.md`. No commit/push. Suggested commit: `feat(monitoring): provision local alert rules`.
- Verification: Grafana 12.1.0 loaded/evaluated all four rules; backend-down smoke fired and recovered after local Compose stop/start. `NoData` for unused error counters is expected and separately validated. Full test suite 214/214 and lint pass; final validator/graph/diff checks pending.

### Grafana M4 local database/cache/workflow dashboard (2026-10-28)

- Added a 12-panel Grafana dashboard for Mongo pool/repository/transactions, Redis/cache/auth blacklist, privacy/Circle membership, media ticket and digest job metrics. Updated local monitoring runbook and Study notes; no Cloud datasource, Loki, alert rule, env or business-code change.
- Grafana provisioned the dashboard with 12 panels; all 33 PromQL queries across four local dashboards were accepted by Prometheus. Full `npm test` 214/214 across 51 suites; dashboard structure/privacy test passes; lint, graph refresh and diff check pass. Stack remains healthy at localhost. Redis is intentionally disabled locally, so Redis command panels correctly have no samples. No stage/commit/push. Suggested commit: `feat(observability): add database cache and workflow dashboard`.

### Grafana M2e privacy, membership, media and digest metrics (2026-10-28)

- Added bounded workflow counters for location-sharing pause/resume, Circle leave/remove, media upload tickets, and digest job outcomes; digest duration and scheduler delay histograms use fixed buckets. Rejections (4xx) are separate from system errors. No actor/group/conversation IDs, content, URLs, or object keys in labels.
- Scheduler passes its expected tick time to the digest use case only for measurement; business schedule and API/socket contracts are unchanged. Existing post-commit realtime cleanup remains fail-soft. Added success/rejected/error and privacy-canary coverage; no env or DB migration.
- Verification: full `npm test` 213/213 across 50 suites; targeted workflow/regression suite 63/63; lint, graph refresh and `git diff --check` pass. Maximum metric policy cardinality is 1,416/2,500. Rebuilt local Compose is healthy; synthetic register/privacy update returned 201/200 and authenticated gzip scrape returned 200 with the pause counter plus membership/media/digest metric families registered. No stage/commit/push. Suggested commit: `feat(observability): instrument privacy chat and digest workflows`.

### Grafana M2d Redis/cache and auth blacklist metrics (2026-10-28)

- Added bounded cache hit/miss/negative-hit/error/disabled outcomes by logical key category; Redis command outcome/duration and connection event metrics; explicit auth blacklist fail-open counters separating Redis disabled from unavailable. Existing fallback/auth semantics stay unchanged; no IDs, key material, tokens, command payloads or errors enter labels/logs. No new env or migration.
- Targeted Redis/cache tests pass; full suite 209/209 across 49 suites, lint, diff check and graph refresh pass. Theoretical policy cardinality max is 1,342/2,500. Fake-client tests cover healthy/error Redis operations without contacting Upstash. Local Compose rebuilt and all four containers are healthy; synthetic register `/me` returned 201/200, authenticated gzip scrape returned 200 and exposed 87 samples (12,768 bytes plain / 2,189 gzip), including cache-disabled and auth blacklist fail-open counters. Redis stayed disabled; no Upstash access. No commit/push. Suggested commit: `feat(observability): instrument Redis cache and auth fallback`.

### Grafana M2c Mongo pool/transaction metrics (2026-10-28)

- Added bounded Mongo driver pool/connection lifecycle and checkout-failure counters, repository operation outcome/duration metrics grouped into five fixed operation classes, and unit-of-work transaction outcomes. Metrics are fail-soft; no Mongo command monitoring, query/document payload capture, collection scan, or schema/env change. Listener attaches after connect and before model/index init; handshake events may be missed, so pool counters are observed-event counts, not current pool gauges.
- Added tests for allowlisted pool events, detach behavior, repository wrapping/disabled mode, transaction success/error and standalone fallback. Targeted tests 4/4; full suite 206/206 across 49 suites; lint, diff check and graph refresh pass. Theoretical max is 877 series; final local gzip scrape observed 8 connection-created, 8 connection-ready, 45 repository calls and 61 active series. No transaction sample in startup workload. No commit/push. Suggested commit: `feat(observability): expose MongoDB pool metrics`.

### Grafana M4 local monitoring and benchmark (2026-10-28)

- Added an isolated localhost-only Docker Compose stack with synthetic MongoDB replica set, backend capped at 0.1 CPU/512 MiB, Prometheus and Grafana; local-only credentials are generated under ignored `.local/` files. Provisioned HTTP/runtime, Socket and Location/Live Trail dashboards. No production `.env`, Cloud datasource, Redis or Loki.
- Verified all four containers healthy, Prometheus target `up=1`, Grafana datasource and all three dashboards provisioned, and all 19 dashboard PromQL expressions accepted. `/metrics` returns 401 without bearer and 200 with the local scrape credential.
- Full paired benchmark (30s warmup, 120s per case, 3 repeats; one user/two sockets): repeat 1 HTTP p95 +52.7% / Socket +1.2%; repeat 2 HTTP -3.9% / Socket +33.8%; repeat 3 HTTP -12.9% / Socket -15.2%. RSS deltas: -0.15, +0.16, +2.18 MiB. Only repeat 3 met both p95 <=5% and RSS <=20 MiB. High variance and 90-130 samples/case mean the overhead gate is not established; this is not production capacity evidence and does not approve Loki/Cloud.
- Smoke is non-acceptance. Full run completed and restored metrics enabled. Results are in ignored `ops/monitoring/.local/benchmark.json`; `node --check scripts/benchmark-monitoring.js` passed. No commit/push.

### Grafana M2b Location/Live Trail metrics (2026-10-28)

- Added business counters for realtime history decisions, timestamp fallback, completed batch point outcomes, projection and matcher/cache/queue failures. Matcher state is collected at scrape time. Added every-tenth-emit JSON byte sampling per realtime channel with no payload logging and no serialization when disabled.
- Added fail-soft metrics facade for application code. Timer-driven trail flush now catches emit failures and records an error instead of allowing an uncaught exception. Business payloads and batch result contracts are unchanged.
- Verification: 202/202 tests pass (49 suites); new sampling/failure/real-batch tests 3/3 pass; lint and diff check pass; graph regenerated. Enumerated all labelsets: 810 application + 16 runtime = 826 series, 71,764 plain bytes / 4,717 gzip bytes on local synthetic snapshot. M4 overhead still unmeasured.
- Updated Study/grafana-observability.md with metric semantics, sampling bias, PromQL and rollback. No new env or schema migration. No stage/commit/push. Suggested commit: `feat(observability): instrument location and live trail workflows`.
- M4 local Compose benchmark is complete but noisy and does not establish the <=5% p95 gate. M2c-e instrumentation may continue for local evaluation; production enablement and M5 Cloud export remain gated.

### Grafana M2a Socket performance metrics (2026-10-28)

- Final verification: 199/199 tests pass (49 suites), lint and diff check pass, graph regenerated. Enumerated every allowed label combination with runtime enabled: 753 accounted series and 753 exposition samples; synthetic snapshot 65,593 bytes plain / 3,882 gzip. Values include local runtime samples and are not a production overhead benchmark.

- Added bounded Socket action counters/duration histograms for handshake, lifecycle, location, chat and watch actions, including explicit rejected/error outcomes when gateways catch exceptions. Gauge collection at scrape time tracks connections, rooms and watches; realtime adapter counts emit calls by channel.
- Metrics remain optional, use the existing dedicated authenticated /metrics endpoint, and contain no user/room IDs or payloads. Registry supports bounded gauges and synchronous scrape collectors with cleanup. Maximum application series 737 + runtime 16 = 753. M4 overhead remains unmeasured.
- Added tests for fail-soft measurement, arbitrary label collapse and real Socket rejection/disconnect behavior. Updated observability study with meanings, limitations and PromQL. No git add/commit/push. Suggested commit: `feat(observability): instrument socket action performance`.

### Grafana M3d-b Location/Live Trail logging (2026-10-28)

- Completed fixed event codes for the remaining location/projection/matching/delta/invalidation log calls. Timestamp fallback preserves its bounded reason via separate event codes and exposes the existing process counter as `count`. Removed provider error-name metadata without changing fallback behavior.
- Strengthened projection failure regression coverage using private Error name/message canaries. Full npm test: 196/196 pass (49 suites); lint and diff check pass; context graph regenerated.
- Updated Study/grafana-observability.md with event meanings and the user's revised review rule: complete coherent functional sections, no rigid eight-file cap. No stage/commit/push. Suggested commit: `refactor(observability): normalize location and live trail log events`.
- Existing src logger call sites now use fixed codes. Next: M2a Socket performance metrics. Worker/backpressure benchmarks and Loki/Cloud shipping remain deferred to the approved M4/M5 gates.

## Current Goal

Deliver a gated, cursor-safe live journey trail without breaking existing location and offline-sync clients.

### Grafana M3d-a auth/cache/database logs (2026-10-28)

- Normalized Redis-ready, Mongo fallback/standalone, auth blacklist failure and Circle realtime-cleanup warnings to fixed allowlisted event codes. Removed unused caught errors and dynamic error-name metadata; no fallback, revocation or membership behavior changed.
- Exactly eight review files: `src/infrastructure/observability/safeLogger.js`, `src/infrastructure/cache/RedisCacheManager.js`, `src/infrastructure/database/connection.js`, `src/infrastructure/database/unitOfWork.js`, `src/application/auth/authUseCases.js`, `src/application/groups/groupUseCases.js`, `tests/safeLogger.test.js`, `PROGRESS.md`. No git add/commit/push. Suggested commit: `refactor(observability): normalize auth cache and database log events`.
- Verification: full suite 196/196 passed (49 suites), targeted logger test 4/4 passed, lint passed. Remaining dynamic location/Live Trail logs are M3d-b. Loki/Cloud transport and any worker stay deferred until the local M4 benchmark and separate M5 approval.

### Grafana M3c Socket correlation (2026-10-28)

- Each Socket connection now receives a generated `connectionId`; every event handler receives a fresh `eventId` and a bounded event name in AsyncLocalStorage. The three gateways preserve their existing client payloads and ack behavior. Live Trail and digest scheduler failures use fixed event codes without raw error names/messages.
- Exactly eight review files: `src/presentation/socket/socketServer.js`, three gateway files, `src/presentation/jobs/digestScheduler.js`, `src/infrastructure/observability/safeLogger.js`, `tests/socketLogContext.test.js`, `PROGRESS.md`. No git add/commit/push; suggested commit: `feat(observability): correlate socket events with safe logs`.
- Verification: 195/195 tests passed (49 suites), new targeted tests 2/2 passed, lint passed. Remaining dynamic logs in application/infrastructure are M3d; M4 benchmark and any Loki/Cloud shipping are still pending.

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

- 2026-10-28: Added plan-first `Study/SOS_GROUP_CHAT_ASSISTANCE.md` after inspecting SOS/chat/membership flows. Proposed persistent SOS incidents, per-Circle chat messages, idempotent assistance responses, outbox delivery and mobile contracts. Background push is not implemented in the current repo; scope/provider and lifecycle/privacy decisions await user review. No feature code or commits made.
- 2026-10-28: Added `Study/GRAFANA_PRODUCTION_ROLLOUT.md` for M5 production planning. Grafana Cloud export remains disabled pending explicit Terms/DPA approval; Render Free + 60s pull scraping would keep the service awake. No production secrets/config changed.
- 2026-10-28: GitHub Actions Render deploy-hook step now keeps the secret in an environment variable and prints HTTP status/response body for diagnosis; non-2xx still fails the job. No retry is performed because a 5xx can occur after Render has accepted the deploy. Not committed.
- 2026-10-26 security patch: lockfile upgrades body-parser 1.20.8 -> 1.20.9, fast-uri 3.1.8 -> 3.1.9, ip-address 10.7.2 -> 10.7.5, zod 4.6.5 -> 4.6.7. No force/major upgrade. Audit reports zero vulnerabilities; all 180 tests (49 suites) and lint pass. No commit performed.

- Add any architectural decisions discovered during future work.
- Record important module relationships in MCP memory when the server is available.
