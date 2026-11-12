# Xác thực và phiên đăng nhập — data model

Status: **Current behavior**, source survey 2026-11-11. [Spec](spec.md) · [Schema conventions and ownership index](../../system/data-model.md). Model indexes are declared schema, not production-index validation.

| Model | Typed fields, validation/defaults and ownership |
|---|---|
| User | Required name trimmed2…50, normalized unique email; optional `password` String contains bcrypt hash (`select:false`), avatar String default empty, battery Number0…100 default 100, isOnline Boolean false. locationSharing enabled Boolean true / pausedUntil Date null / updatedAt Date now. lastSeenAt Date null; lastKnownLocation Point with coordinates array default null, updatedAt Date null, durationMinutes Number0. timestamps. Public JSON removes password/_id/__v and adds id. |
| RefreshSession | Required userId/familyId/tokenHash/expiresAt; status active/rotated/revoked default active. rotatedAt/revokedAt/replacement token hash/device metadata/lastUsedAt/access-token hash/access expiry/revoke reason optional/null. timestamps. Raw refresh token is returned to client; durable model stores hash, not token. |
| UserSocialAccount | Required userId/provider/providerId trimmed; enum google/apple/facebook describes storage acceptance, not adapter availability. Unique provider+providerId and userId+provider. Timestamp names created_at/updated_at. |

## User — `users`

**Schema paths:** `name`, `email`, `password`, `avatar`, `batteryLevel`, `isOnline`, `locationSharing.enabled`, `locationSharing.pausedUntil`, `locationSharing.updatedAt`, `lastSeenAt`, `lastKnownLocation.type`, `lastKnownLocation.coordinates`, `lastKnownLocation.updatedAt`, `lastKnownLocation.durationMinutes`, `createdAt`, `updatedAt`.

**Indexes được khai báo:**

- `{"email":1}` — `{"unique":true}`

## RefreshSession — `refresh_sessions`

**Schema paths:** `userId`, `familyId`, `tokenHash`, `status`, `expiresAt`, `rotatedAt`, `revokedAt`, `replacedByTokenHash`, `deviceInfo.userAgent`, `deviceInfo.ip`, `deviceInfo.name`, `lastUsedAt`, `accessTokenHash`, `accessTokenExpiresAt`, `revokeReason`, `createdAt`, `updatedAt`.

**Indexes được khai báo:**

- `{"userId":1}`
- `{"tokenHash":1}` — `{"unique":true}`
- `{"expiresAt":1}` — `{"expireAfterSeconds":0}`
- `{"userId":1,"familyId":1}`
- `{"familyId":1,"status":1}`

## UserSocialAccount — `user_social_accounts`

**Schema paths:** `userId`, `provider`, `providerId`, `created_at`, `updated_at`.

**Indexes được khai báo:**

- `{"userId":1}`
- `{"provider":1,"providerId":1}` — `{"unique":true}`
- `{"userId":1,"provider":1}` — `{"unique":true}`

User privacy/location/presence behavior is owned by [location-sharing](../location-sharing/spec.md); the complete schema is kept here once, rather than duplicating User across features.
