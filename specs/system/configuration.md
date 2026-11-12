# Backend configuration

Status: Current behavior, source survey 2026-11-11; not deployed-state confirmation. See `src/config/env.js`.

## Config groups and defaults

Defaults below come from schema, not deployed state. `loadConfig` receives env; production requires JWT secret and MongoDB URI. Partial S3/R2 credential groups fail validation; complete R2 takes precedence over complete legacy S3. No values from a live account belong in specs.

| Area | Verified configuration and behavior |
|---|---|
| Process | `NODE_ENV=development`, `PORT=3000`, `TZ=Asia/Ho_Chi_Minh`; `PUBLIC_URL` → `RENDER_EXTERNAL_URL` → localhost for public docs URL. CORS defaults `*`; trust proxy is one hop. JSON/urlencoded bodies 100kb; Socket buffer 100 KiB. |
| Database | Default local Mongo URI; in-memory replica-set fallback only when `NODE_ENV=development`. Production refuses non-transaction-capable topology. Startup initializes registered model indexes; no migration command exists in manifest. |
| JWT/session | Required `JWT_SECRET`; production rejects literal default secret. Access lifetime precedence `JWT_ACCESS_EXPIRES_IN` → `JWT_EXPIRES_IN` → `15m`; refresh TTL 30 days, active-family limit ten. Auth IP limit 20/15min; refresh IP limit 60/15min. |
| OAuth | `GOOGLE_CLIENT_ID` optional; absent Google adapter returns 503. Apple/Facebook are DTO values but no adapter is wired. |
| Redis | `REDIS_ENABLED=false`; enabled requires `REDIS_URL`. Prefix `familytracker:`, default TTL 300s, connect timeout 5000ms, max retries/request two, location TTL 300s. Fail-soft commands; profile cache 600s+jitter, group member cache 90s+jitter. Blacklist outage fails open. |
| Batch | `LOCATION_BATCH_RATE_LIMIT=30`/user/minute; `MAX_POINTS=100` (config allows 1…1000); max age 24h (1…168h); future tolerance fixed 60s. |
| History | `LOCATION_HISTORY_DENSE_ENABLED=false`. Dense moving interval 15s, distance 25m, idle 300s. Journey gap 180s, max points/segment 1000, simplification 8m; geometry v2, stay radius 80m/minimum 5min. Range default limit 500/max 1000/max days seven. |
| Trail | `LIVE_TRAIL_ENABLED=false`; retention seven days; max accuracy 100m; read limit 60/user/minute; five watches/socket, 30 actions/minute, watch revalidation 60s; delta 50 points/65536 bytes/2000ms. |
| Matcher | `LIVE_TRAIL_MATCHER_ENABLED=false`, provider `noop` (also fake/mapbox). Mapbox requires server token when enabled; min confidence 0.6. Window five points, wait 30s, overlap two, future context two, min points three, accuracy 50m; queue 100 trails, concurrency one, timeout 1000ms, circuit after three failures/cooldown 30s. Overlap/context must be smaller than window; min points <=window. Fake forbidden in production. |
| SOS | API and outbox flags false; API enabled requires outbox. Max groups ten, unique recipients 100, events 300, rate 60/user/minute. API is mounted but valid requests return controlled 503 while unavailable. REST and socket quotas are separate; socket quota is per user/process. |
| Outbox | Poll 1000ms, batch 20 claims/cycle, lease 30000ms, attempts five, retry base/max 1000/60000ms. Retry max cannot be below base. Data is retained without automatic TTL. |
| Legacy S3 | Complete bucket/access key/secret/public URL required as a group. Optional endpoint; region auto, force-path-style false. Max upload 10 MiB, URL TTL 300s (60…3600s). |
| R2 | Complete account/access key/secret/bucket/public domain required. Region auto, image 10 MiB, voice 25 MiB, URL TTL 300s. Adapter uses account-derived endpoint and path-style addressing. |
| Metrics | `METRICS_ENABLED=false`; enabled requires separate `METRICS_TOKEN` 32…256 chars, different from JWT secret. GET `/metrics`, no CORS, not Swagger; 10 scrapes/minute/process, one concurrent scrape, 1 MiB response ceiling, gzip/identity negotiation, 2500 series cap. |
| Logs/traces | `LOG_FILE_PATH` adds local JSONL file; safe logger only emits known event codes/allowlisted bounded fields. `OTEL_ENABLED=true` starts manual spans; trace endpoint defaults to local Tempo. These env values are read directly by logging/tracing, outside `envSchema`. No automatic Mongo/Redis query tracing was found. |

LocationHistory has no TTL in source; GroupDigest has 30-day TTL; refresh/trail entities expire via TTL. SOS/chat retention and historical visibility require explicit product decisions rather than inferred deletion policies.

Feature contract/behavior owners: [feature map](../README.md). External adapters: [dependencies](dependencies.md); startup/reliability: [architecture](architecture.md).
