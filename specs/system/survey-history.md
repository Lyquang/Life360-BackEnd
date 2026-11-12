# Historical survey and cleanup evidence

The records below describe completed survey/cleanup steps before feature separation. Old filenames and preservation claims are historical, not current navigation. Use [current feature map](../README.md) and [reorganization](reorganization.md). No previous tests were rerun by moving these documents.

# Công việc và trạng thái

Đây là trạng thái lập tài liệu hiện trạng, không phải backlog triển khai feature mới.

- [x] T001 Thu thập inventory toàn bộ file JavaScript trong `src` và phân tích AST bằng Graphify.
- [x] T002 Đối chiếu các điểm vào HTTP/socket, container, models và policy quan trọng.
- [x] T003 Ghi mô tả tính năng, kiến trúc, schema và chỉ mục API/socket từ source.
- [x] T004 Tạo Graphify AST graph riêng cho backend, giữ graph mobile gốc.
- [ ] T005 Với mỗi thay đổi tương lai, rà soát lại tài liệu và chạy kiểm thử phù hợp; không coi checklist này là xác nhận mọi nhánh runtime đã được kiểm thử.
- [ ] T006 Nếu cần graph ngữ nghĩa bao gồm tài liệu, chọn backend LLM/quyền xử lý dữ liệu và quy trình cập nhật; graph hiện tại là `--code-only`.
- [ ] T007 Nếu cần xác nhận hiện trạng triển khai, kiểm tra cấu hình, index và dữ liệu thực tế trên môi trường được chỉ định.

## Full setup survey — 2026-11-11

T001…T004 describe the earlier src-only snapshot; evidence below extends it. T005 is recurring workflow, T006/T007 optional future work, not unfinished implementation in this documentation setup.

- [x] S001 Read instructions/manifest/root config and skeleton/module graph; preserve existing dirty files.
- [x] S002 Read all 218 boundary files, 213 full/5 redacted/0 pending or inaccessible; source-inventory.md/json records complete paths/hashes.
- [x] S003 Inspect imported spec/plan/model/contracts/research/tasks/checklist/quickstart patterns and relevant foreign graph relationships; document adaptation/conflicts; sample unchanged.
- [x] S004 Separate current behavior from accepted requirements/decisions; document typed contracts, models/indexes, flows, config/dependencies and discrepancies.
- [x] S005 Record user acceptance of continued private chat after Circle exit as REQ-CHAT-01 and validate exact scenario; preserve code.
- [x] S006 Regenerate official Graphify code-only/no-label output in fresh directory; copy four backend outputs, no cache/logs or remote semantic extraction.
- [x] S007 Full tests 277/277, existing lint and individual syntax checks 191/191 pass; evidence in quickstart.md.
- [x] S008 Final checks pass: 264 local documentation links, 218 inventory hashes/boundary entries, 136 graph source paths, 882 unique nodes / 1597 valid edges, graph commit=HEAD, no runtime diff and `git diff --check` clean. Outcome appended to PROGRESS.md.

Unresolved choices Q-02…Q-06 remain explicit. Recording them does not approve implementation. Future work starts from specs/README.md and relevant backend graph report.

## Artifact change manifest

Existing uncommitted baseline/example files were present before this task. “Added” below means added by this survey, not every file Git currently reports as untracked.

| Files changed by this survey | Reason |
|---|---|
| Added `decisions.md`, `discrepancies.md` | Separate accepted governance/product decisions from open conflicts; record explicit REQ-CHAT-01 confirmation. |
| Added `flows.md`, `operations.md` | Cover all business flows, reliability/state boundaries, configuration, dependencies and quality gates found in source. |
| Added `source-inventory.json`; updated `source-inventory.md` | Full 218-file read checklist, source boundary/exclusions and full hashes; prior snapshot covered src only. |
| Updated `spec.md`, `plan.md`, `data-model.md` | CB identifiers/approval distinction, accepted private-chat requirement, architecture/state and typed model relationships/defaults/indexes. |
| Updated `contracts/http.md`, `contracts/socket.md` | Expand route/event indexes into verified inputs/outputs/auth/error/pagination/gate descriptions. |
| Updated `research.md`, `quickstart.md`, `tasks.md`, `checklists/requirements.md` | Reference adaptation/conflicts, tool workflow, exact validation evidence, setup tasks and remaining approvals. |
| Updated `../README.md` (`specs/README.md`) | Canonical intent/status/traceability workflow and baseline index. |
| Updated root `AGENTS.md` | Persist read-spec/graph-first, discrepancy/approval and spec-maintenance rules; existing user instructions retained. |
| Regenerated `graphify-out/backend/GRAPH_REPORT.md`, `graph.json`, `graph.html`, `.graphify_analysis.json`; updated backend `README.md` | Official scoped AST snapshot and commit/hash freshness/regeneration guidance. Generated outputs copied unchanged from Graphify. |
| Appended root `PROGRESS.md` | Durable survey outcome, accepted requirement, validation and unresolved scope. |

The imported `001-message-notifications/`, templates, parent mobile graph, `src/`, tests, runtime configs and user-modified `scripts/codebase-skeleton.js` were not changed by this survey. `codex/context/` was regenerated by the instructed skeleton command and remains Git-ignored. No commit was created.

## Reference cleanup — 2026-11-11

- [x] Remove unrelated reference spec folder and foreign root Graphify artifacts under explicit user authorization; preserve the backend baseline, templates and generated backend graph.
- [x] Update current agent/spec/graph guidance and decision history; earlier survey preservation statements above describe the pre-cleanup snapshot.
- [x] Validation passed: all 218 inventoried source hashes unchanged; 267 local links valid; retained graph has 882 nodes/1597 valid edges; four generated backend artifacts unchanged; refreshed skeleton and git diff --check passed. Runtime tests were not rerun for this reference/docs-only cleanup.


# Checklist tài liệu hiện trạng

- [x] Phân biệt hành vi hiện có, flags và đề xuất chưa triển khai.
- [x] Có đường dẫn source và phạm vi của inventory.
- [x] Có data model và chỉ mục hợp đồng HTTP/socket.
- [x] Nêu giới hạn của static graph, dữ liệu runtime và môi trường deployment.
- [x] Giữ nguyên các artifact nhập từ project mobile.
- [ ] Xác thực runtime, index production và acceptance end-to-end nếu cần cho một thay đổi cụ thể.

## Full survey extension — 2026-11-11

- [x] Every boundary source/config/test file has explicit read status and full hash; redactions/exclusions documented; none inaccessible.
- [x] Imported sample organization and reference conflicts inspected; no mobile requirements/thresholds adopted.
- [x] CB, accepted REQ/DEC and open Q/D kept distinct. REQ-CHAT-01 has explicit user confirmation, criteria, code evidence and isolated integration validation.
- [x] Contracts cover auth, fields, outputs, permissions, paging, errors and flags; model types/defaults/indexes and business/reliability flows documented.
- [x] Official Graphify local AST/no-label refresh, commit/hash method and graph scope documented.
- [x] Existing tests/lint plus per-file syntax checks pass; no production/mobile/external-provider claim.
- [ ] Remaining product choices explicitly accepted: historical digest privacy, blacklist outage policy, rollout and future SOS scope. These remain open and do not block an accurately labelled current-behavior baseline.
