# Discrepancy and question ownership

Status: original records/status preserved, reorganized2026-11-11. Read only records owned by the feature being changed. Cross-feature conflicts link to the primary owner. Recording a mismatch does not authorize a behavior change.

| Record | Primary owner |
|---|---|
| D-01 | [authentication](../features/authentication/discrepancies.md) |
| D-02 | [system](discrepancies.md) |
| D-03 | [authentication](../features/authentication/discrepancies.md) |
| D-04 | [authentication](../features/authentication/discrepancies.md) |
| D-05 | [chat](../features/chat/discrepancies.md) |
| D-06 | [location-sharing](../features/location-sharing/discrepancies.md) |
| D-07 | [live-trail](../features/live-trail/discrepancies.md) |
| D-08 | [group-digests](../features/group-digests/discrepancies.md) |
| D-09 | [circles](../features/circles/discrepancies.md) |
| D-10 | [system](discrepancies.md) |
| D-11 | [system](discrepancies.md) |
| D-12 | [system](discrepancies.md) |
| D-13 | [system](discrepancies.md) |
| Q-01 | [chat](../features/chat/discrepancies.md) |
| Q-02 | [group-digests](../features/group-digests/discrepancies.md) |
| Q-03 | [authentication](../features/authentication/discrepancies.md) |
| Q-04 | [system](discrepancies.md) |
| Q-05 | [sos](../features/sos/discrepancies.md) |
| Q-06 | [system](discrepancies.md) |

## Shared discrepancies

| ID | Conflicting evidence / current behavior | Impact and disposition |
|---|---|---|
| D-02 | `CLAUDE.md` lists `/api/docs` and `{status:"ok"}` health. `http/app.js` mounts `/api-docs`; `systemRoutes.js` returns `success,message,timestamp,uptime,mongodb`. | Client examples can fail; verified contract is documented here. No route aliases added. |
| D-10 | `package.json` lint passes many paths to `node --check`; that invocation checks the entry script rather than establishing a per-file lint gate. | Supplemented with individual syntax checks in this survey; no formatter/style/coverage threshold inferred. CI uses existing script. |
| D-11 | `PROGRESS.md` earlier entry says Graphify absent; existing backend snapshot and `/tmp/family-tracker-graphify-venv/bin/graphify --version` show 0.9.30 available now. | Historical tool state superseded by this survey; no installation needed. The former root graph belonged to the reference project; it was subsequently removed by explicit user request. |
| D-12 | Imported sample's spec says opening detail does not mark read; its older task/quickstart descriptions say it does. Its contract is labelled superseded and references an absent `API_V2.md`. | Reference inconsistency only. Reuse linked artifacts/status/traceability, never mobile requirements, thresholds or missing contracts. Resolved for repository cleanup: the reference sample was removed by explicit user request on 2026-11-11; its behavior was never adopted. |
| D-13 | The former imported Graphify report suggested `graphify update .`, targeting the default root output rather than the backend snapshot. Existing inventory hashes only 136 `src` files and does not assert full review. | Use scoped Graphify commands and expanded 218-file review ledger; reference graph removed by user request; continue using the maintained backend path. |

## Shared open questions

| ID | Current evidence | Decision still needed |
|---|---|---|
| Q-04 | Raw live trail, matching, dense history, SOS and metrics are configurable and default off; tests enable them selectively. | Which environments/features are accepted for rollout, at what tested capacity? No production access or external service checks performed. |
| Q-06 | Baseline enumerates implementation, test evidence and documented contracts. | Which CB behaviors should become accepted product requirements? Record explicit confirmation and scoped acceptance criteria rather than approving code wholesale. |

Q-01 is resolved in [chat](../features/chat/decisions.md); Q-02 belongs to [group-digests](../features/group-digests/discrepancies.md), Q-03 to [authentication](../features/authentication/discrepancies.md), Q-05 to [SOS](../features/sos/discrepancies.md). Q-04 is shared rollout intent; feature flags/defaults remain in configuration until explicitly approved.
