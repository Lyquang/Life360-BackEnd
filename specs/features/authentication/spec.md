# Xác thực và phiên đăng nhập

Status: **Current behavior** | Survey: 2026-11-11 | Legacy survey scope: CB-01.

Đăng ký, đăng nhập, Google OAuth, access/refresh token, đăng xuất và đổi mật khẩu.

[Contracts](contracts.md) · [Data model](data-model.md) · [Discrepancies / questions](discrepancies.md). Shared [architecture](../../system/architecture.md), [API conventions](../../system/api-conventions.md), [configuration](../../system/configuration.md). Read this feature first; follow only dependencies affected by the task. Observed behavior is not blanket product approval.

## Current behavior and flow

1. Auth route normalizes/validates DTO; controller supplies request context. Register hashes the password and creates a user, then issues a session; duplicate email becomes 409. Login checks password and marks online. Google login verifies provider token, resolves an existing social link or account by normalized email, links it and updates profile.
2. Session issue creates a MongoDB RefreshSession in a unit of work and enforces the active-family limit (default ten); cache stores optional session metadata. Older families are revoked and their sockets disconnected.
3. Refresh hashes the submitted opaque token and inspects MongoDB status. Active token rotates once in a transaction, records replacement and returns a new pair. Reused/revoked token revokes its family; concurrent duplicate rotation can revoke the newly issued replacement. Client single-flight is required by the integration guide.
4. Access authentication verifies HS256 JWT and optional Redis blacklist, then resolves user. Legacy access JWTs without type/familyId are accepted until expiry; an explicit non-access type is rejected. Blacklist unavailability fails open; it does not restore revoked refresh sessions.
5. Logout blacklists current access token when cache is available. Supplying a refresh token revokes that device family; logout-all/password change revoke all families and disconnect relevant sockets. Without Redis, immediate access-JWT invalidation is not guaranteed.

Evidence: `src/application/auth/authUseCases.js`, security adapters, refresh repository; `tests/refreshTokenRotation.test.js`, `tests/socialLoginUseCase.test.js`, `tests/redisMetrics.test.js`. Registering the user and issuing its session are not one enclosing transaction; do not claim all-or-nothing registration/session creation.

## Source and existing verification

- [src/application/auth/authUseCases.js](../../../src/application/auth/authUseCases.js)
- [src/presentation/http/routes/authRoutes.js](../../../src/presentation/http/routes/authRoutes.js)
- [src/presentation/dto/auth.schemas.js](../../../src/presentation/dto/auth.schemas.js)
- [src/infrastructure/security/tokenService.js](../../../src/infrastructure/security/tokenService.js)
- [src/infrastructure/repositories/refreshSessionRepository.js](../../../src/infrastructure/repositories/refreshSessionRepository.js)
- [src/infrastructure/oauth/oauthProviderFactory.js](../../../src/infrastructure/oauth/oauthProviderFactory.js)

Existing tests (survey evidence; not a new test run):

- [tests/refreshTokenRotation.test.js](../../../tests/refreshTokenRotation.test.js)
- [tests/socialLoginUseCase.test.js](../../../tests/socialLoginUseCase.test.js)
- [tests/redisMetrics.test.js](../../../tests/redisMetrics.test.js)

## Cross-feature changes

[Circle và thành viên](../circles/spec.md) · [Chat nhóm và trò chuyện riêng](../chat/spec.md).

No additional product approval is inferred from this split. When behavior changes, record the confirming instruction and observable acceptance criteria here; add a concrete plan/tasks only for actual work.
