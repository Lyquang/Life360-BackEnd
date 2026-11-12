# Xác thực và phiên đăng nhập — contracts

Status: **Current behavior**, surveyed 2026-11-11. [Spec](spec.md) · [Models](data-model.md). HTTP base `/api/v1`; authentication/errors/DTO conventions: [shared API conventions](../../system/api-conventions.md). Socket handshake/rooms: [shared realtime contract](../../system/realtime.md).

## HTTP

| Method/path | Input | Success data / status | Authorization and errors |
|---|---|---|---|
| POST `/auth/register` | name trimmed 2…50; normalized valid email; password 6…128; deviceName? trimmed 1…100 | AuthResult, 201 | Public auth limiter; duplicate email 409. |
| POST `/auth/login` | normalized email; password 1…128; deviceName? | AuthResult, 200 | Public auth limiter; invalid credentials 401. |
| POST `/auth/social-login` | provider google/apple/facebook; token trimmed 1…4096; deviceName? | AuthResult, 200 | Public auth limiter; only Google wired; unsupported 400, unconfigured Google 503, invalid token 401. |
| POST `/auth/refresh` | refreshToken trimmed 32…512 | TokenPair, 200 | Public refresh limiter; 401 INVALID_REFRESH_TOKEN / REFRESH_TOKEN_REUSED. Reuse revokes family. |
| GET `/auth/me` | none | User, 200 | Bearer. |
| POST `/auth/logout` | refreshToken? 1…4096; allDevices? boolean; default body `{}` | `{loggedOut:true}` or `{loggedOut:true,allDevices:true}`, 200 | Bearer; family revocation requires submitted token or allDevices. Cache unavailable limits immediate access-JWT revocation. |
| POST `/auth/logout-all` | no validated body | `{loggedOut:true,allDevices:true}`, 200 | Bearer; revokes all refresh families and disconnects user. |
| POST `/auth/change-password` | currentPassword 1…128; newPassword 6…128 and different | `{passwordChanged:true,requiresLogin:true}`, 200 | Bearer; incorrect current password 401. |

All paths below include `/api/v1`. `TokenPair={token,accessToken,refreshToken,expiresIn}`; token aliases accessToken, expiresIn is seconds. `AuthResult={user,...TokenPair}`. Public User serialization removes password and `__v`, maps `_id` to `id`; other persisted public fields may be present (not limited to the examples in older guides).

Full integration detail: [refresh guide](../../../docs/REFRESH_TOKEN_MOBILE_API_DOC.md). Device names/request user-agent/IP are stored as session metadata, never copy live values into specs.
