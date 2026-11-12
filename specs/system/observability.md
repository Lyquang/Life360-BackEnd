# Health, API discovery and observability

Status: Current behavior, source survey 2026-11-11. This is shared operational infrastructure. [Configuration](configuration.md) · [Validation](validation.md).

## System/operational responses

Public health returns HTTP200 `{success:true,message,timestamp,uptime,mongodb:"connected"|"disconnected"}` at `/api/health` and `/api/v1/health`; it reports DB state without changing status to503. `/api/v1/socket-info` returns `{success,connection:{url,auth},events}` (documentation can lag, see D-05). `/api-docs.json` is generated OpenAPI3 from route comments; `/api-docs` serves UI and `/` redirects there. `/metrics` uses its own operational bearer, not application auth; disabled404, unsupported method405, invalid bearer401, rate/busy429, failed/oversized snapshot503 or unacceptable encoding406. Metrics bodies are exposition text or HTTP status text, not the JSON business envelope.

## Operations

The local monitoring stack includes Mongo replica set, backend, Prometheus, Grafana, Loki, Tempo and Alloy, with localhost-published ports and ignored secret files. Alert thresholds and benchmark gates belong to that operational workflow; the mobile sample's coverage/performance thresholds do not apply to this backend.

Sources: `src/presentation/http/routes/systemRoutes.js`, HTTP middleware metrics/requestContext, `src/infrastructure/observability/`, `ops/monitoring/`. Existing tests: `tests/metricsFoundation.test.js`, `tests/metricsHttp.test.js`, `tests/httpRequestContext.test.js`, `tests/socketMetrics.test.js`, `tests/socketLogContext.test.js`, `tests/safeLogger.test.js`, `tests/logPrivacyHotfix.test.js`, `tests/locationMetrics.test.js`, `tests/mongoMetrics.test.js`, `tests/redisMetrics.test.js`, `tests/monitoringDashboards.test.js`, `tests/observabilityWorkflows.test.js`.
