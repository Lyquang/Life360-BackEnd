# Tra cứu và kiểm tra

1. Chọn feature tại [mục lục](../README.md), đọc spec/contracts/model của feature và [architecture](architecture.md) khi cần; tra file tương ứng trong [source-inventory.md](source-inventory.md).
2. Xem `graphify-out/backend/graph.html` hoặc `GRAPH_REPORT.md`; các cạnh inferred cần kiểm tra lại source.
3. Chạy `npm run context:skeleton` hoặc `npm run context:trace -- --term <name>`; `npm run context:graph` tạo thêm graph import trong `codex/context/`.
4. Xem contracts của feature, [HTTP conventions](api-conventions.md), [Socket lifecycle](realtime.md), DTO và Swagger tại `/api-docs` khi server đang chạy.
5. Với thay đổi code, chạy `npm test` và `npm run lint` hoặc bộ test phù hợp phạm vi; thực hiện kiểm tra tích hợp thực tế khi thay đổi cần MongoDB/Redis/storage.

## Tạo lại Graphify backend cục bộ

Với Graphify 0.9.30 đã cài trong môi trường riêng, chạy từ root repo, chọn một thư mục output trống ngoài repo trước khi cập nhật snapshot backend:

```sh
graphify extract src --code-only --out /tmp/family-tracker-graph-result --max-workers 4
graphify cluster-only /tmp/family-tracker-graph-result --no-label
```

Sau khi kiểm tra kết quả, cập nhật các file tương ứng trong `graphify-out/backend/`. Đường dẫn `/tmp` chỉ là ví dụ; tránh tái sử dụng output cũ nếu cần snapshot sạch. Quá trình này tạo AST graph, không bao gồm semantic extraction tài liệu.

## Verified Graphify workflow and freshness — 2026-11-11

The installed CLI used here is `/tmp/family-tracker-graphify-venv/bin/graphify` version 0.9.30. It is a temporary external tool environment, not a backend dependency. If missing later, use a verified installed binary or report the blocker; do not silently install dependencies or fabricate graph data. The commands above were verified; choose a fresh empty directory each time, preferably with `mktemp -d /tmp/backend-graph-survey.XXXXXX`.

`extract --out` writes a `graphify-out/` child directory. Inspect its report/commit/paths/counts before copying **only** `GRAPH_REPORT.md`, `graph.json`, `graph.html`, `.graphify_analysis.json` into `graphify-out/backend/`. Do not copy caches, logs, generated manifests or credentials, and keep the maintained graph in the backend folder. Keep generated report/JSON/HTML unedited. `--code-only` and `--no-label` use local AST/clustering with zero LLM tokens; no semantic extraction or remote labelling was performed.

The report's generic `graphify update .` advice is unsuitable at this repository root, because the maintained snapshot is in `graphify-out/backend/`, not the default root output location. Use scoped extraction. This graph covers 136 files in `src` only; source paths are relative to `src/`. Entry point/tests/scripts/configs are in survey inventory, not the graph.

Compare `git rev-parse HEAD` with backend `built_at_commit`, then compare file hashes and enumerate added/deleted source files. Matching commits do not cover a dirty working tree. This local check prints only changed/missing inventoried paths:

```sh
python3 - <<'PY'
import hashlib, json
from pathlib import Path
d = json.loads(Path('specs/system/source-inventory.json').read_text())
changed = [r['path'] for r in d['files']
           if not Path(r['path']).is_file()
           or hashlib.sha256(Path(r['path']).read_bytes()).hexdigest() != r['sha256']]
print('Changed/missing:', changed)
raise SystemExit(bool(changed))
PY
```

This hash check cannot discover additions; also enumerate the boundary defined in source-inventory.md. A changed `src` file makes the graph stale even when HEAD matches. Refresh source inventory alongside any regenerated graph. Tests/scripts/config changes outside `src` affect specs/evidence but do not expand this graph's stated scope.

Verified CLI forms: `graphify query "<term>" --graph graphify-out/backend/graph.json --budget 1000` and `graphify explain "<symbol>" --graph graphify-out/backend/graph.json`. Explicit graph path is required here. Confidence/relationships guide navigation; validate runtime DI, authorization and transactions in source.

## Validation record — 2026-11-11

Source commit `ddf5c58dbf24b35f503da8a43561e8156fedd38a` plus dirty working tree. Runtime/source/test implementations were unchanged in this task; previous user changes preserved.

| Check | Result / scope |
|---|---|
| `npm run context:skeleton` | Pass; ignored context generated and consulted before source batches. |
| `npm run context:trace -- --file src/presentation/http/controllers/chatController.js` | Pass; use-case dependencies are injected rather than imported by controller. |
| `MONGOMS_RUNTIME_DOWNLOAD=false npm test` | **277 passed /60 suites /0 failed /0 skipped**, ~89.8s; existing local Mongo binary, isolated replica-set/HTTP/Socket fixtures. |
| `npm run lint` | Exit0; D-10 in [system discrepancies](discrepancies.md) notes that the command does not prove per-file syntax coverage. |
| Individual `node --check` | **191 JavaScript files passed** in src/server/tests/scripts. No style or coverage-threshold claim. |
| REQ-CHAT-01 isolated integration | Pass: open private chat, remove last shared Circle membership, verify no shared Circle, both users send 201/read 200 via existing conversation ID; direct endpoint shared-Circle check still 403. |
| Official Graphify extract/cluster | Pass: local code-only/no-label, 136 files / 882 nodes / 1597 edges / 48 communities, zero LLM tokens; four official outputs copied. |

The private-chat check used `tests/helpers/testServer.js` as a session validation; no tracked test file was added. Existing chat/Circle tests cover component policies; add a dedicated regression when implementation changes next touch REQ-CHAT-01. No seed, dependency installation, Docker build/stack, migration, deployment, remote provider/Redis/storage call or email send ran. Final local link/inventory/graph checks are recorded in [survey history](survey-history.md).

Final consistency validation passed: 264 local documentation links; all 218 source/config/test inventory entries and hashes match; no added/missing files in defined boundary; graph covers all 136 src files, has 882 unique node IDs and 1597 edges with valid endpoints, source commit equals HEAD; `git diff --check` clean. Imported sample links were not treated as backend validity failures (D-12). No claim of runtime audit/production index health follows from these checks.


## Commands and effects

| Command | Verified purpose / effects |
|---|---|
| `npm start`, `npm run dev` | Starts server; connects DB, initializes indexes, backfills chat, starts jobs. Dev uses Node watch. |
| `npm test` | Node test runner, concurrency one, 44 test files plus helper; local MongoMemoryReplSet and real Socket/HTTP fixtures. External adapters use synthetic/fake boundaries. |
| `npm run lint` | Existing Node syntax command. Does not establish complete multi-file lint coverage; use per-file `node --check` as supplementary verification. No coverage threshold configured. |
| `npm run context:skeleton`, `context:graph`, `context:trace` | Local navigation generation/query; static imports are separate from Graphify AST. Generated `codex/context/` ignored by Git. |
| `npm run benchmark:live-trail` | Synthetic local publisher/matcher benchmark; no Mongo/Socket/network capacity proof. |
| `npm run seed` | Connects configured DB, writes a synthetic user into groups and changes digest intervals globally. Read for survey, **not run**. |
| `npm run monitoring:init/up/down/status` | Generates local secret files or manages Docker stack; not run during survey. Down retains volumes. |
| `npm run benchmark:monitoring` | Creates synthetic accounts and restarts local backend off/on metrics; writes ignored result artifact. Not a production load test; not run here. |
| `npm run monitoring:validate-alerts` | Reads local credential file and queries configured Grafana; not a pure static check, not run here. |

CI uses Node 20, npm ci, existing lint, audit high and tests. Push then builds/pushes a Linux amd64 GHCR image and main triggers Render deploy hook. Docker uses Node 20 Alpine/non-root; `render.yaml` requests Node 22 and disables live trail/matcher. This is configuration evidence, not confirmation either deployment path is active. No dependency installation, build, migration, deployment or audit/network call was performed for this documentation task.

The local monitoring stack includes Mongo replica set, backend, Prometheus, Grafana, Loki, Tempo and Alloy, with localhost-published ports and ignored secret files. Alert thresholds and benchmark gates belong to that operational workflow; the mobile sample's coverage/performance thresholds do not apply to this backend.
