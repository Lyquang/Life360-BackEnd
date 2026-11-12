# Source survey inventory

Date: 2026-11-11. Source commit: `ddf5c58dbf24b35f503da8a43561e8156fedd38a` plus the working tree. All **218 files / 21,277 lines** in this boundary were read in this session: **213 read-full**, **5 read-redacted**, **0 pending/unreadable**. Hashing/Graphify extraction alone is not counted as reading. Full SHA-256, exact paths and statuses: [source-inventory.json](source-inventory.json).

## Boundary and exclusions

| Area | Files |
|---|---:|
| `src/` | 136 |
| `tests/` | 45 |
| `scripts/` | 9 |
| `ops/` | 17 |
| `.github/` | 1 |
| Entry point / root and editor config | 10 |

The boundary includes application/DTO/routes/controllers/gateways/domain/models/adapters; every test/helper; tooling/benchmark/seed scripts; CI/Docker/Render/monitoring and root/editor configuration. The two Markdown files under monitoring are included as operational source context. Root project docs/Study/specs and agent instructions are a separate documentation/reference corpus, not silently counted as reviewed implementation. Selected document coverage is recorded in [survey research](research.md).

Excluded: dependencies/vendor, lockfiles, actual `.env`, `.local/` secrets/runtime output, generated `codex/context` and Graphify files, compiled/build/coverage/log/cache output, `.git`, binary/media assets. No source file in the boundary was inaccessible. Redacted rows intentionally do not establish actual configuration values. Dashboard JSON was read in normalized JSON form preserving all keys/values. Output-truncated batches were completed with targeted file/range reads.

The pre-existing inventory covered only 136 src JavaScript files and explicitly did not prove full review. This ledger supersedes its scope claim; the previous work is retained in PROGRESS history. Source hashes establish a snapshot, not a security audit or production verification.

## Per-file checklist

| File | Lines | Read status | SHA-256 prefix |
|---|---:|---|---|
| [.dockerignore](../../.dockerignore) | 28 | read-full | `70fe6b4af0b0` |
| [.env.example](../../.env.example) | 134 | read-redacted | `b1d72a4c332a` |
| [.github/workflows/ci.yml](../../.github/workflows/ci.yml) | 148 | read-full | `dd0a7cefb8a5` |
| [.gitignore](../../.gitignore) | 7 | read-full | `e1104e3f78a6` |
| [.vscode/mcp.json](../../.vscode/mcp.json) | 14 | read-full | `37e0694a6ca2` |
| [Dockerfile](../../Dockerfile) | 35 | read-full | `d6432058dbcc` |
| [codex/config.example.toml](../../codex/config.example.toml) | 10 | read-full | `2da4d913ca58` |
| [mcp.json](../../mcp.json) | 14 | read-full | `c1463a2e389c` |
| [ops/monitoring/README.md](../../ops/monitoring/README.md) | 70 | read-full | `67c5ad91f04e` |
| [ops/monitoring/alloy.alloy](../../ops/monitoring/alloy.alloy) | 19 | read-full | `ccf70943db9d` |
| [ops/monitoring/compose.env](../../ops/monitoring/compose.env) | 1 | read-redacted | `b4bd9c7c8e5f` |
| [ops/monitoring/compose.yml](../../ops/monitoring/compose.yml) | 117 | read-full | `c5e5f310e143` |
| [ops/monitoring/dashboards/data.json](../../ops/monitoring/dashboards/data.json) | 448 | read-full | `1da365a8ad6e` |
| [ops/monitoring/dashboards/location.json](../../ops/monitoring/dashboards/location.json) | 263 | read-full | `0359631bf22b` |
| [ops/monitoring/dashboards/logs.json](../../ops/monitoring/dashboards/logs.json) | 40 | read-full | `1dc48f799fe9` |
| [ops/monitoring/dashboards/overview.json](../../ops/monitoring/dashboards/overview.json) | 228 | read-full | `0ffcc1838ea3` |
| [ops/monitoring/dashboards/socket.json](../../ops/monitoring/dashboards/socket.json) | 228 | read-full | `e447d721afc2` |
| [ops/monitoring/loki.yml](../../ops/monitoring/loki.yml) | 29 | read-full | `e294eadac756` |
| [ops/monitoring/prometheus.yml](../../ops/monitoring/prometheus.yml) | 17 | read-full | `307c91f70671` |
| [ops/monitoring/provisioning/alerting/contacts.yml](../../ops/monitoring/provisioning/alerting/contacts.yml) | 10 | read-redacted | `6ff8665405ce` |
| [ops/monitoring/provisioning/alerting/familytracker.yml](../../ops/monitoring/provisioning/alerting/familytracker.yml) | 211 | read-full | `645dda18e92b` |
| [ops/monitoring/provisioning/dashboards/local.yml](../../ops/monitoring/provisioning/dashboards/local.yml) | 9 | read-full | `b08351a666fb` |
| [ops/monitoring/provisioning/datasources/prometheus.yml](../../ops/monitoring/provisioning/datasources/prometheus.yml) | 40 | read-full | `789944272af0` |
| [ops/monitoring/provisioning/plugins/README.md](../../ops/monitoring/provisioning/plugins/README.md) | 1 | read-full | `ffb5ebced44b` |
| [ops/monitoring/tempo.yml](../../ops/monitoring/tempo.yml) | 21 | read-full | `c0fe3829ddd8` |
| [package.json](../../package.json) | 54 | read-full | `013c153b53b9` |
| [render.yaml](../../render.yaml) | 154 | read-full | `302cdd3be5d3` |
| [scripts/benchmark-live-trail.js](../../scripts/benchmark-live-trail.js) | 150 | read-full | `02a5446b26bc` |
| [scripts/benchmark-monitoring.js](../../scripts/benchmark-monitoring.js) | 125 | read-full | `9e6973cf06f6` |
| [scripts/codebase-graph-html.js](../../scripts/codebase-graph-html.js) | 553 | read-full | `8fc10bfbf95c` |
| [scripts/codebase-skeleton.js](../../scripts/codebase-skeleton.js) | 245 | read-full | `b1d58dbbd5e4` |
| [scripts/monitoring-local.js](../../scripts/monitoring-local.js) | 25 | read-full | `ddfdfccd1082` |
| [scripts/seed-fake-user.js](../../scripts/seed-fake-user.js) | 137 | read-redacted | `9c14323253a6` |
| [scripts/test-chat.js](../../scripts/test-chat.js) | 155 | read-redacted | `c33ec9bcc8af` |
| [scripts/trace-flow.js](../../scripts/trace-flow.js) | 112 | read-full | `f4596dc6bb8c` |
| [scripts/validate-monitoring-alerts.js](../../scripts/validate-monitoring-alerts.js) | 84 | read-full | `151ffa5d3a3e` |
| [server.js](../../server.js) | 56 | read-full | `77e93a411acc` |
| [src/application/auth/authUseCases.js](../../src/application/auth/authUseCases.js) | 323 | read-full | `7e032c6ccf4a` |
| [src/application/chat/chatMappers.js](../../src/application/chat/chatMappers.js) | 50 | read-full | `d4b6fd10ac38` |
| [src/application/chat/chatUseCases.js](../../src/application/chat/chatUseCases.js) | 422 | read-full | `fda60236ea22` |
| [src/application/digests/digestUseCases.js](../../src/application/digests/digestUseCases.js) | 117 | read-full | `7fa26955803b` |
| [src/application/groups/groupUseCases.js](../../src/application/groups/groupUseCases.js) | 191 | read-full | `f9c26544a7a4` |
| [src/application/history/historyUseCases.js](../../src/application/history/historyUseCases.js) | 228 | read-full | `609dfde4dce0` |
| [src/application/history/liveTrailWatchUseCases.js](../../src/application/history/liveTrailWatchUseCases.js) | 47 | read-full | `3a61a1dda157` |
| [src/application/location/liveTrailDeltaPublisher.js](../../src/application/location/liveTrailDeltaPublisher.js) | 199 | read-full | `856329fe385a` |
| [src/application/location/liveTrailMatchingService.js](../../src/application/location/liveTrailMatchingService.js) | 259 | read-full | `020c9a5027ec` |
| [src/application/location/liveTrailProjection.js](../../src/application/location/liveTrailProjection.js) | 39 | read-full | `213302ec8efa` |
| [src/application/location/locationRuntimeState.js](../../src/application/location/locationRuntimeState.js) | 14 | read-full | `97180a7b6d52` |
| [src/application/location/locationUseCases.js](../../src/application/location/locationUseCases.js) | 280 | read-full | `84158cde27bd` |
| [src/application/location/syncLocationBatchUseCase.js](../../src/application/location/syncLocationBatchUseCase.js) | 97 | read-full | `625402b436de` |
| [src/application/places/placeUseCases.js](../../src/application/places/placeUseCases.js) | 17 | read-full | `eb72bc1bd997` |
| [src/application/ports/logger.js](../../src/application/ports/logger.js) | 9 | read-full | `638b579b7544` |
| [src/application/ports/mapMatcher.js](../../src/application/ports/mapMatcher.js) | 14 | read-full | `05bdbf6ff9eb` |
| [src/application/ports/metrics.js](../../src/application/ports/metrics.js) | 26 | read-full | `b5a2337f2670` |
| [src/application/privacy/locationAccessPolicy.js](../../src/application/privacy/locationAccessPolicy.js) | 27 | read-full | `dbe76d20a2ac` |
| [src/application/privacy/privacyUseCases.js](../../src/application/privacy/privacyUseCases.js) | 52 | read-full | `2c435526fd49` |
| [src/application/shared/policies.js](../../src/application/shared/policies.js) | 14 | read-full | `da2211ce48fd` |
| [src/application/sos/sosAccessPolicy.js](../../src/application/sos/sosAccessPolicy.js) | 37 | read-full | `4ab342f28e78` |
| [src/application/sos/sosOutboxDispatcher.js](../../src/application/sos/sosOutboxDispatcher.js) | 90 | read-full | `bc401ef9e091` |
| [src/application/sos/sosUseCases.js](../../src/application/sos/sosUseCases.js) | 254 | read-full | `3f84a425bf62` |
| [src/bootstrap.js](../../src/bootstrap.js) | 92 | read-full | `afb383123fb8` |
| [src/config/env.js](../../src/config/env.js) | 308 | read-full | `7e374465f79f` |
| [src/config/swagger.js](../../src/config/swagger.js) | 222 | read-full | `f1e115f2fb9b` |
| [src/container.js](../../src/container.js) | 181 | read-full | `4f229f3ca209` |
| [src/domain/cacheKeys.js](../../src/domain/cacheKeys.js) | 44 | read-full | `101652a95319` |
| [src/domain/dates.js](../../src/domain/dates.js) | 24 | read-full | `4075a4a62244` |
| [src/domain/errors.js](../../src/domain/errors.js) | 36 | read-full | `4bae7aedba2f` |
| [src/domain/geo.js](../../src/domain/geo.js) | 35 | read-full | `b5afd1e8d902` |
| [src/domain/historyPersistence.js](../../src/domain/historyPersistence.js) | 74 | read-full | `5ef10eef59eb` |
| [src/domain/journey.js](../../src/domain/journey.js) | 307 | read-full | `f21b7d289c0c` |
| [src/domain/liveTrail.js](../../src/domain/liveTrail.js) | 91 | read-full | `c6c8c58dea11` |
| [src/domain/liveTrailMatching.js](../../src/domain/liveTrailMatching.js) | 96 | read-full | `77e5d5ed7a6f` |
| [src/domain/locationBatch.js](../../src/domain/locationBatch.js) | 19 | read-full | `dbecb7fd5553` |
| [src/domain/locationSharing.js](../../src/domain/locationSharing.js) | 36 | read-full | `8b7da900e93a` |
| [src/domain/media.js](../../src/domain/media.js) | 72 | read-full | `24dc226e1199` |
| [src/domain/oauth.js](../../src/domain/oauth.js) | 42 | read-full | `cad32f5c26fc` |
| [src/domain/refreshTokens.js](../../src/domain/refreshTokens.js) | 28 | read-full | `eb1b5f038c0e` |
| [src/domain/routeGeometry.js](../../src/domain/routeGeometry.js) | 213 | read-full | `a9335a8ad8dc` |
| [src/domain/sos.js](../../src/domain/sos.js) | 31 | read-full | `0b6d134ec915` |
| [src/infrastructure/cache/NoopCacheManager.js](../../src/infrastructure/cache/NoopCacheManager.js) | 47 | read-full | `aef4e871528f` |
| [src/infrastructure/cache/RedisCacheManager.js](../../src/infrastructure/cache/RedisCacheManager.js) | 187 | read-full | `8c844092922e` |
| [src/infrastructure/cache/cacheMetrics.js](../../src/infrastructure/cache/cacheMetrics.js) | 44 | read-full | `1461d863d55c` |
| [src/infrastructure/cache/cachedGroupRepository.js](../../src/infrastructure/cache/cachedGroupRepository.js) | 46 | read-full | `339c2a7373b3` |
| [src/infrastructure/cache/cachedUserRepository.js](../../src/infrastructure/cache/cachedUserRepository.js) | 66 | read-full | `7e5f2cba97ba` |
| [src/infrastructure/database/connection.js](../../src/infrastructure/database/connection.js) | 61 | read-full | `d5eaddd32daa` |
| [src/infrastructure/database/models/ChatMessage.js](../../src/infrastructure/database/models/ChatMessage.js) | 92 | read-full | `888600cd4547` |
| [src/infrastructure/database/models/Conversation.js](../../src/infrastructure/database/models/Conversation.js) | 65 | read-full | `c41e5a491318` |
| [src/infrastructure/database/models/ConversationMember.js](../../src/infrastructure/database/models/ConversationMember.js) | 38 | read-full | `bb5e08793a2d` |
| [src/infrastructure/database/models/FavoritePlace.js](../../src/infrastructure/database/models/FavoritePlace.js) | 74 | read-full | `a0a346016194` |
| [src/infrastructure/database/models/Group.js](../../src/infrastructure/database/models/Group.js) | 83 | read-full | `304f6d19a45f` |
| [src/infrastructure/database/models/GroupDigest.js](../../src/infrastructure/database/models/GroupDigest.js) | 73 | read-full | `9c61b7f1dc91` |
| [src/infrastructure/database/models/LiveTrail.js](../../src/infrastructure/database/models/LiveTrail.js) | 93 | read-full | `7e0cab111333` |
| [src/infrastructure/database/models/LocationHistory.js](../../src/infrastructure/database/models/LocationHistory.js) | 94 | read-full | `1610c3206ec7` |
| [src/infrastructure/database/models/RefreshSession.js](../../src/infrastructure/database/models/RefreshSession.js) | 36 | read-full | `46fe5307d032` |
| [src/infrastructure/database/models/SosIncident.js](../../src/infrastructure/database/models/SosIncident.js) | 49 | read-full | `1854ebfc43f2` |
| [src/infrastructure/database/models/SosOutbox.js](../../src/infrastructure/database/models/SosOutbox.js) | 26 | read-full | `36dcccf9f78e` |
| [src/infrastructure/database/models/SosResponse.js](../../src/infrastructure/database/models/SosResponse.js) | 15 | read-full | `96f9363cb861` |
| [src/infrastructure/database/models/User.js](../../src/infrastructure/database/models/User.js) | 98 | read-full | `d9301346e869` |
| [src/infrastructure/database/models/UserSocialAccount.js](../../src/infrastructure/database/models/UserSocialAccount.js) | 32 | read-full | `d2a3a2ba6be7` |
| [src/infrastructure/database/mongoMetricsObserver.js](../../src/infrastructure/database/mongoMetricsObserver.js) | 27 | read-full | `01da8c407722` |
| [src/infrastructure/database/mongoRepositoryMetrics.js](../../src/infrastructure/database/mongoRepositoryMetrics.js) | 59 | read-full | `9c5afef9578c` |
| [src/infrastructure/database/unitOfWork.js](../../src/infrastructure/database/unitOfWork.js) | 44 | read-full | `0f0b9a225c08` |
| [src/infrastructure/matching/FakeMapMatcher.js](../../src/infrastructure/matching/FakeMapMatcher.js) | 44 | read-full | `ea90c4a9ad2e` |
| [src/infrastructure/matching/MapboxMapMatcher.js](../../src/infrastructure/matching/MapboxMapMatcher.js) | 73 | read-full | `a569f97056c8` |
| [src/infrastructure/matching/NoopMapMatcher.js](../../src/infrastructure/matching/NoopMapMatcher.js) | 11 | read-full | `5e98be811462` |
| [src/infrastructure/oauth/googleOAuthProvider.js](../../src/infrastructure/oauth/googleOAuthProvider.js) | 41 | read-full | `fc7429d50b9c` |
| [src/infrastructure/oauth/oauthProviderFactory.js](../../src/infrastructure/oauth/oauthProviderFactory.js) | 19 | read-full | `9507d83dd02d` |
| [src/infrastructure/observability/logContext.js](../../src/infrastructure/observability/logContext.js) | 10 | read-full | `5754694788c5` |
| [src/infrastructure/observability/metricsPolicy.js](../../src/infrastructure/observability/metricsPolicy.js) | 74 | read-full | `912ab8226ce1` |
| [src/infrastructure/observability/metricsRegistry.js](../../src/infrastructure/observability/metricsRegistry.js) | 110 | read-full | `c9d02ba3b5fd` |
| [src/infrastructure/observability/safeLogger.js](../../src/infrastructure/observability/safeLogger.js) | 89 | read-full | `1ed35009a2ad` |
| [src/infrastructure/observability/tracing.js](../../src/infrastructure/observability/tracing.js) | 80 | read-full | `07658482e02f` |
| [src/infrastructure/realtime/liveTrailAccessInvalidator.js](../../src/infrastructure/realtime/liveTrailAccessInvalidator.js) | 29 | read-full | `9426bac372e5` |
| [src/infrastructure/realtime/socketRealtime.js](../../src/infrastructure/realtime/socketRealtime.js) | 85 | read-full | `7d3f05a8d1bd` |
| [src/infrastructure/repositories/conversationMemberRepository.js](../../src/infrastructure/repositories/conversationMemberRepository.js) | 66 | read-full | `9547a0cddfaa` |
| [src/infrastructure/repositories/conversationRepository.js](../../src/infrastructure/repositories/conversationRepository.js) | 66 | read-full | `cd04cdbe8099` |
| [src/infrastructure/repositories/digestRepository.js](../../src/infrastructure/repositories/digestRepository.js) | 30 | read-full | `294e3d26c685` |
| [src/infrastructure/repositories/groupRepository.js](../../src/infrastructure/repositories/groupRepository.js) | 95 | read-full | `5ad1fdb954a1` |
| [src/infrastructure/repositories/liveTrailRepository.js](../../src/infrastructure/repositories/liveTrailRepository.js) | 167 | read-full | `70313a901427` |
| [src/infrastructure/repositories/locationHistoryRepository.js](../../src/infrastructure/repositories/locationHistoryRepository.js) | 112 | read-full | `a452ce89e210` |
| [src/infrastructure/repositories/messageRepository.js](../../src/infrastructure/repositories/messageRepository.js) | 56 | read-full | `2c547c185e89` |
| [src/infrastructure/repositories/placeRepository.js](../../src/infrastructure/repositories/placeRepository.js) | 20 | read-full | `19daf7afd0a2` |
| [src/infrastructure/repositories/refreshSessionRepository.js](../../src/infrastructure/repositories/refreshSessionRepository.js) | 79 | read-full | `35497c888031` |
| [src/infrastructure/repositories/sosOutboxRepository.js](../../src/infrastructure/repositories/sosOutboxRepository.js) | 76 | read-full | `06d83a5b6cb0` |
| [src/infrastructure/repositories/sosRepository.js](../../src/infrastructure/repositories/sosRepository.js) | 131 | read-full | `44fd36ac812b` |
| [src/infrastructure/repositories/userRepository.js](../../src/infrastructure/repositories/userRepository.js) | 81 | read-full | `4ec14b2df906` |
| [src/infrastructure/repositories/userSocialAccountRepository.js](../../src/infrastructure/repositories/userSocialAccountRepository.js) | 11 | read-full | `39e6b5511b6f` |
| [src/infrastructure/security/passwordHasher.js](../../src/infrastructure/security/passwordHasher.js) | 12 | read-full | `08b95b545e4e` |
| [src/infrastructure/security/sosSocketLimiter.js](../../src/infrastructure/security/sosSocketLimiter.js) | 26 | read-full | `cfebbb5fa1e6` |
| [src/infrastructure/security/tokenService.js](../../src/infrastructure/security/tokenService.js) | 52 | read-full | `a3910f07c2ae` |
| [src/infrastructure/storage/CloudflareR2StorageService.js](../../src/infrastructure/storage/CloudflareR2StorageService.js) | 19 | read-full | `98b4139754cb` |
| [src/infrastructure/storage/s3Storage.js](../../src/infrastructure/storage/s3Storage.js) | 61 | read-full | `673fe436f725` |
| [src/presentation/dto/auth.schemas.js](../../src/presentation/dto/auth.schemas.js) | 46 | read-full | `99f34bacae0d` |
| [src/presentation/dto/chat.schemas.js](../../src/presentation/dto/chat.schemas.js) | 106 | read-full | `0236a1d3f88d` |
| [src/presentation/dto/common.js](../../src/presentation/dto/common.js) | 22 | read-full | `54f1d03d1847` |
| [src/presentation/dto/group.schemas.js](../../src/presentation/dto/group.schemas.js) | 42 | read-full | `6ebca9f2665f` |
| [src/presentation/dto/history.schemas.js](../../src/presentation/dto/history.schemas.js) | 61 | read-full | `43f9bb709729` |
| [src/presentation/dto/liveTrail.schemas.js](../../src/presentation/dto/liveTrail.schemas.js) | 8 | read-full | `a0cd513078c1` |
| [src/presentation/dto/location.schemas.js](../../src/presentation/dto/location.schemas.js) | 33 | read-full | `19391ef66f81` |
| [src/presentation/dto/locationBatch.schemas.js](../../src/presentation/dto/locationBatch.schemas.js) | 60 | read-full | `e57ec85cf736` |
| [src/presentation/dto/privacy.schemas.js](../../src/presentation/dto/privacy.schemas.js) | 18 | read-full | `b586d187a241` |
| [src/presentation/dto/sos.schemas.js](../../src/presentation/dto/sos.schemas.js) | 26 | read-full | `9dced3466b34` |
| [src/presentation/http/app.js](../../src/presentation/http/app.js) | 96 | read-full | `f700aedc41a7` |
| [src/presentation/http/controllers/authController.js](../../src/presentation/http/controllers/authController.js) | 56 | read-full | `7e5d71a82779` |
| [src/presentation/http/controllers/chatController.js](../../src/presentation/http/controllers/chatController.js) | 79 | read-full | `ec3da2ae18a6` |
| [src/presentation/http/controllers/groupController.js](../../src/presentation/http/controllers/groupController.js) | 92 | read-full | `7b8bd50f9ade` |
| [src/presentation/http/controllers/historyController.js](../../src/presentation/http/controllers/historyController.js) | 43 | read-full | `f22d2d675eae` |
| [src/presentation/http/controllers/locationController.js](../../src/presentation/http/controllers/locationController.js) | 18 | read-full | `aedbd62a223a` |
| [src/presentation/http/controllers/privacyController.js](../../src/presentation/http/controllers/privacyController.js) | 17 | read-full | `216df6c9cdf0` |
| [src/presentation/http/controllers/sosController.js](../../src/presentation/http/controllers/sosController.js) | 28 | read-full | `48e315b616fd` |
| [src/presentation/http/middleware/asyncHandler.js](../../src/presentation/http/middleware/asyncHandler.js) | 4 | read-full | `2f150a168c12` |
| [src/presentation/http/middleware/authenticate.js](../../src/presentation/http/middleware/authenticate.js) | 20 | read-full | `7efe0ea3fcba` |
| [src/presentation/http/middleware/errorHandler.js](../../src/presentation/http/middleware/errorHandler.js) | 39 | read-full | `8a7b252583b3` |
| [src/presentation/http/middleware/metrics.js](../../src/presentation/http/middleware/metrics.js) | 69 | read-full | `827f247a7e9b` |
| [src/presentation/http/middleware/rateLimiter.js](../../src/presentation/http/middleware/rateLimiter.js) | 74 | read-full | `0018b45b8927` |
| [src/presentation/http/middleware/requestContext.js](../../src/presentation/http/middleware/requestContext.js) | 42 | read-full | `9fa68a2323cc` |
| [src/presentation/http/middleware/validate.js](../../src/presentation/http/middleware/validate.js) | 26 | read-full | `28c98286f097` |
| [src/presentation/http/routes/authRoutes.js](../../src/presentation/http/routes/authRoutes.js) | 193 | read-full | `386a31ac97e5` |
| [src/presentation/http/routes/chatRoutes.js](../../src/presentation/http/routes/chatRoutes.js) | 301 | read-full | `0a3bd24fad4f` |
| [src/presentation/http/routes/groupRoutes.js](../../src/presentation/http/routes/groupRoutes.js) | 227 | read-full | `ce9d1f2a1a71` |
| [src/presentation/http/routes/historyRoutes.js](../../src/presentation/http/routes/historyRoutes.js) | 94 | read-full | `654ba1a57a50` |
| [src/presentation/http/routes/locationRoutes.js](../../src/presentation/http/routes/locationRoutes.js) | 50 | read-full | `6cde38f813bc` |
| [src/presentation/http/routes/privacyRoutes.js](../../src/presentation/http/routes/privacyRoutes.js) | 48 | read-full | `4f35ce4fa8c4` |
| [src/presentation/http/routes/sosRoutes.js](../../src/presentation/http/routes/sosRoutes.js) | 126 | read-full | `5563f6173a9c` |
| [src/presentation/http/routes/systemRoutes.js](../../src/presentation/http/routes/systemRoutes.js) | 51 | read-full | `152fa5165920` |
| [src/presentation/jobs/digestScheduler.js](../../src/presentation/jobs/digestScheduler.js) | 12 | read-full | `ffe883cac843` |
| [src/presentation/jobs/sosOutboxScheduler.js](../../src/presentation/jobs/sosOutboxScheduler.js) | 41 | read-full | `daae2546e433` |
| [src/presentation/socket/gateways/chatGateway.js](../../src/presentation/socket/gateways/chatGateway.js) | 87 | read-full | `a21c59a714cb` |
| [src/presentation/socket/gateways/liveTrailGateway.js](../../src/presentation/socket/gateways/liveTrailGateway.js) | 145 | read-full | `c10b02647d5d` |
| [src/presentation/socket/gateways/locationGateway.js](../../src/presentation/socket/gateways/locationGateway.js) | 53 | read-full | `32f9a7241350` |
| [src/presentation/socket/socketEventDocs.js](../../src/presentation/socket/socketEventDocs.js) | 66 | read-full | `b4ad6ee73392` |
| [src/presentation/socket/socketMetrics.js](../../src/presentation/socket/socketMetrics.js) | 29 | read-full | `612e986a1b48` |
| [src/presentation/socket/socketServer.js](../../src/presentation/socket/socketServer.js) | 82 | read-full | `9a2de062bbc5` |
| [tests/api.test.js](../../tests/api.test.js) | 224 | read-full | `0593b5c90481` |
| [tests/chat.test.js](../../tests/chat.test.js) | 372 | read-full | `ea3b2673aec0` |
| [tests/circleExitPrivacy.test.js](../../tests/circleExitPrivacy.test.js) | 127 | read-full | `6b82db5437f0` |
| [tests/groupChatLifecycle.test.js](../../tests/groupChatLifecycle.test.js) | 261 | read-full | `b7db96e8b33a` |
| [tests/helpers/testServer.js](../../tests/helpers/testServer.js) | 154 | read-full | `1c4cce0424e6` |
| [tests/historyPersistence.test.js](../../tests/historyPersistence.test.js) | 79 | read-full | `8fb7f63b0b0e` |
| [tests/httpRequestContext.test.js](../../tests/httpRequestContext.test.js) | 61 | read-full | `084fc1d34302` |
| [tests/journeyEnrichment.test.js](../../tests/journeyEnrichment.test.js) | 335 | read-full | `e3b5391b006c` |
| [tests/liveTrailDeltaPublisher.test.js](../../tests/liveTrailDeltaPublisher.test.js) | 99 | read-full | `5c2c222929ec` |
| [tests/liveTrailMatching.test.js](../../tests/liveTrailMatching.test.js) | 247 | read-full | `37f5bcefa274` |
| [tests/liveTrailMatchingIntegration.test.js](../../tests/liveTrailMatchingIntegration.test.js) | 118 | read-full | `8b6f69647c00` |
| [tests/liveTrailProjection.test.js](../../tests/liveTrailProjection.test.js) | 232 | read-full | `48ec4d7eecbc` |
| [tests/liveTrailRead.test.js](../../tests/liveTrailRead.test.js) | 197 | read-full | `ed0c14cc4414` |
| [tests/liveTrailSocket.test.js](../../tests/liveTrailSocket.test.js) | 189 | read-full | `f16fd04d8fa5` |
| [tests/locationBatch.test.js](../../tests/locationBatch.test.js) | 225 | read-full | `3c1e515d8fab` |
| [tests/locationDensePersistence.test.js](../../tests/locationDensePersistence.test.js) | 155 | read-full | `8c14fbac0596` |
| [tests/locationHistoryRange.test.js](../../tests/locationHistoryRange.test.js) | 119 | read-full | `64fca658a1b4` |
| [tests/locationMetrics.test.js](../../tests/locationMetrics.test.js) | 62 | read-full | `571d49d9d4fb` |
| [tests/locationRecordedAt.test.js](../../tests/locationRecordedAt.test.js) | 141 | read-full | `27775259b563` |
| [tests/locationSharing.test.js](../../tests/locationSharing.test.js) | 41 | read-full | `a3809bfb1036` |
| [tests/locationSharingPrivacy.test.js](../../tests/locationSharingPrivacy.test.js) | 144 | read-full | `f94cd1a65274` |
| [tests/logPrivacyHotfix.test.js](../../tests/logPrivacyHotfix.test.js) | 46 | read-full | `516adee0bbab` |
| [tests/mapboxMapMatcher.test.js](../../tests/mapboxMapMatcher.test.js) | 72 | read-full | `ca44ac81197b` |
| [tests/metricsFoundation.test.js](../../tests/metricsFoundation.test.js) | 67 | read-full | `3f1827f1f2c0` |
| [tests/metricsHttp.test.js](../../tests/metricsHttp.test.js) | 93 | read-full | `8c6448be67b4` |
| [tests/mongoMetrics.test.js](../../tests/mongoMetrics.test.js) | 81 | read-full | `5836948be55c` |
| [tests/monitoringDashboards.test.js](../../tests/monitoringDashboards.test.js) | 39 | read-full | `7d74cd6d37f7` |
| [tests/observabilityWorkflows.test.js](../../tests/observabilityWorkflows.test.js) | 127 | read-full | `271e33bab68b` |
| [tests/redisMetrics.test.js](../../tests/redisMetrics.test.js) | 111 | read-full | `1b69e6436771` |
| [tests/refreshTokenRotation.test.js](../../tests/refreshTokenRotation.test.js) | 200 | read-full | `c5c831b462d9` |
| [tests/routeGeometry.test.js](../../tests/routeGeometry.test.js) | 129 | read-full | `be2764fdb84d` |
| [tests/safeLogger.test.js](../../tests/safeLogger.test.js) | 96 | read-full | `5875c18c0297` |
| [tests/socialLoginUseCase.test.js](../../tests/socialLoginUseCase.test.js) | 201 | read-full | `9641a754fa73` |
| [tests/socketLogContext.test.js](../../tests/socketLogContext.test.js) | 78 | read-full | `128e987622f0` |
| [tests/socketMetrics.test.js](../../tests/socketMetrics.test.js) | 42 | read-full | `94ad0db0e572` |
| [tests/sosAssistanceUseCase.test.js](../../tests/sosAssistanceUseCase.test.js) | 224 | read-full | `71bac5daf412` |
| [tests/sosChatOutbox.test.js](../../tests/sosChatOutbox.test.js) | 164 | read-full | `1192e0293655` |
| [tests/sosCreateUseCase.test.js](../../tests/sosCreateUseCase.test.js) | 202 | read-full | `1fc359001b05` |
| [tests/sosDispatcher.test.js](../../tests/sosDispatcher.test.js) | 100 | read-full | `3f6bd52364da` |
| [tests/sosHttp.test.js](../../tests/sosHttp.test.js) | 99 | read-full | `ccf46d4b90d2` |
| [tests/sosList.test.js](../../tests/sosList.test.js) | 91 | read-full | `44c720248330` |
| [tests/sosPersistence.test.js](../../tests/sosPersistence.test.js) | 152 | read-full | `e75aa46c90a4` |
| [tests/sosScheduler.test.js](../../tests/sosScheduler.test.js) | 99 | read-full | `8e12cc17146e` |
| [tests/sosSocket.test.js](../../tests/sosSocket.test.js) | 80 | read-full | `ec3305d01c64` |
| [tests/upload.test.js](../../tests/upload.test.js) | 349 | read-full | `5ffc6b2cc3a0` |
