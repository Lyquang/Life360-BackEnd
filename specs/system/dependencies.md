# Stack and external dependencies

## Stack and ownership

CommonJS JavaScript on Node >=20; Express 4, Socket.IO 4, Mongoose 8, Zod 4, JWT/bcryptjs. MongoDB is durable state. Optional ioredis cache does not replace refresh persistence. AWS SDK v3 signs S3/R2 uploads. Google auth library verifies ID tokens. Optional Mapbox adapter uses HTTPS fetch. Pino, prom-client and manual OpenTelemetry spans implement observability.

This repository has no application UI/routes, mobile background services, frontend state management, native build configuration or analytics SDK. Vietnamese/English response strings and Vietnamese duration summaries are hardcoded; no localization catalog or user-locale negotiation was found. Monitoring is operational telemetry, not evidence of product analytics or APNs/FCM delivery.

## External-service boundaries

| Dependency | Data crossing at runtime | Verification boundary in this survey |
|---|---|---|
| MongoDB | Profiles, hashed credentials/tokens, memberships, GPS/history/trails, chat/SOS/outbox/digests | Local memory replica-set tests; no production connection. |
| Redis | Cache profiles/memberships/latest GPS, token hashes/session metadata/media metadata | Fake adapter tests and no-op mode; no remote Redis. Redis is not configured as a Socket.IO adapter. |
| Google | Client-supplied ID token verification via Google library | Adapter/source reviewed; no real Google credentials/token exchange. |
| S3/R2/CDN | Presigned upload issuance; client transfers bytes directly | Signing/ownership tests using synthetic config; no upload/object inspection. |
| Mapbox | GPS window, profile, timestamps/radii and server token when enabled | Fake fetch/Noop/FakeMatcher tests; no provider network request. |
| Monitoring | Local metrics/logs/traces; provisioned SMTP can send alert summaries when configured | Config/source/dashboard tests; no Docker stack started, no SMTP email sent. |

The survey/Graphify extraction does not upload repository code or private configuration to any of these services.
