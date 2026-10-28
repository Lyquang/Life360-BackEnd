# Grafana Production Rollout Plan

## Current State

- Grafana, Prometheus, Loki, Tempo and Alloy currently run in a localhost-only Docker Compose stack. It monitors the Compose backend at port 3100, not the native dev server at port 3000 or Render.
- Seven local alert rules and the Gmail contact point are provisioned. Local validation confirms the rules and datasources exist; SMTP delivery and production alerting still require separate verification.
- Cloud telemetry export was explicitly gated at M0 until the project owner reviews Grafana Terms, DPA and subprocessors. This production request does not silently waive that privacy gate.
- Render service is currently treated as a Free web service. Render documents that any inbound request prevents a Free service from spinning down; Grafana Cloud's hosted metrics endpoint scrapes every 60 seconds by default. A scrape target would therefore keep the API awake and consume nearly all of a 750-hour monthly workspace allowance if it runs continuously. Render also says Free services are for testing/hobby use, not production.

## Proposed Architecture

1. Use Grafana Cloud as the managed production UI and alert evaluator, reusing the existing dashboard and alert definitions after validating datasource UIDs and queries against Cloud.
2. Start with metrics only. Add the existing authenticated, gzip `/metrics` endpoint to the Cloud Metrics Endpoint using a dedicated bearer credential. Do not expose secrets in URLs, labels, logs or dashboards.
3. Do not use 60-second pull scraping against a sleeping Render Free service. Preferred production path: move the API to an always-on Render plan, then enable 60-second hosted scraping. Alternative: approve a bounded push/remote-write design if keeping the API on Free is a hard requirement; that requires a separate implementation and delivery/retry review.
4. Provision dashboards and alert rules to the Cloud stack only after the privacy gate. Configure Gmail contact point there and run a contact-point test plus a controlled alert fire/recovery test.
5. Keep Loki log shipping and Tempo trace export disabled until a separate review confirms the exact payload, retention, region, access controls and overhead. Existing local redaction remains mandatory.

## Data and Safety Controls

- Current metrics use bounded allowlisted labels; they must not include user, group, conversation or device IDs, email, raw URL, request body, token, media key or coordinates.
- Log/trace export is a distinct approval, not implicitly included in metrics approval. Do not send raw logs or unreviewed spans.
- Create least-privilege, stack-scoped Cloud access policies: metrics write for an approved push path, and only the minimum required provisioning permissions for dashboard/alert deployment. Keep credentials in Render Environment / GitHub Actions secrets as appropriate; never commit them.
- Separate local and production datasource labels and alert names. Prevent a local test rule from paging the production recipient.
- Keep the local Compose stack as rollback and development environment.

## Execution Plan After Approval

### M5a: Production metrics and alerts

- Review exact Grafana Terms, DPA, subprocessor list and actual stack region with the project owner.
- Confirm Render compute plan and choose hosted scrape (always-on plan) or bounded push (separate design approval).
- Configure production metric enablement, bearer token and endpoint; verify `/metrics` authentication, gzip, bounded cardinality and no sensitive labels.
- Add the production scrape/ingest, validate target health and metric queries, migrate dashboards/alert rules, configure Gmail and execute test + fire/recovery.
- Record quota/usage baseline and rollback instructions; keep log and trace export off.

### M5b: Optional logs/traces

- Separate payload/privacy review and explicit approval.
- Benchmark Render CPU/RSS and verify data minimization before enabling either pipeline.
- Ship only allowlisted structured logs and reviewed spans with bounded queues, timeouts and fail-open behavior; verify redaction, retention and deletion.

## Verification and Rollback

- Verify target is healthy for at least three scrape intervals; inspect sample exposition size and active series.
- Run dashboard queries, Gmail contact-point test, one controlled alert fire and recovery, and inspect only sanitized log/trace examples if those pipelines are separately approved.
- Roll back by disabling the production exporter/scrape job and revoking the dedicated access token. Do not change API business behavior to mask monitoring failures.

## Decisions Needed Before M5

1. Have you reviewed and accepted Grafana's current Terms, DPA and subprocessors for the telemetry scope? **No export is enabled until you explicitly confirm.**
2. Confirm whether Render will remain Free. Recommendation: use an always-on plan for production scraping; otherwise defer pull scraping and approve a separate push design.
3. Approve metrics-only M5a first? Logs and traces remain off until a later explicit approval.

## References

- [Grafana Cloud Terms](https://grafana.com/legal/)
- [Grafana Cloud DPA](https://grafana.com/legal/data-processing-agreement/)
- [Grafana Cloud Prometheus integration methods](https://grafana.com/docs/grafana-cloud/send-data/metrics/metrics-prometheus/prometheus-config-examples/integration-guide/)
- [Render Free service limitations](https://render.com/docs/free)
