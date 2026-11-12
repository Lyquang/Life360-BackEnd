# Ghi chú khảo sát

- Khảo sát dựa vào `src/`, schema và cấu hình; không kết nối MongoDB hay đọc secrets. Graphify 0.9.30 chạy `extract src --code-only`: 136 file, phân tích AST, không gửi source tới LLM. Xem báo cáo trong `graphify-out/backend/`.
- Các mẫu spec/graph của project khác đã được dùng trong lượt khảo sát ban đầu, rồi xóa theo yêu cầu người dùng ngày 2026-11-11. Chỉ baseline, template và graph backend được duy trì.
- Graph có cạnh suy luận độ tin cậy khác nhau; đường đi và quyền phải đối chiếu implementation. Danh sách file và hash là inventory tự động, không phải xác nhận review thủ công từng dòng hay audit bảo mật.
- Schema chấp nhận tên provider Google, Apple, Facebook nhưng factory hiện chỉ nối Google; không diễn giải schema là chức năng đã hỗ trợ đủ ba provider.
- `SOS_API_ENABLED` và `SOS_OUTBOX_ENABLED` là các flag riêng; `src/container.js` còn kiểm tra transaction. Không khẳng định các flag đang bật ở deployment.
- Chưa kiểm tra database đang chạy, tình trạng index thực tế, thời hạn dữ liệu đã lưu, tích hợp từ xa hay client mobile.

## Reference practices reused (historical survey, 2026-11-11)

User explicitly selected the then-imported mobile artifacts as the reference; no separate reference path was accessed. These artifacts were subsequently removed at the user's request; this section records the survey method, not a dependency on retained reference files. Reviewed the sample's spec/scenario structure, plan context, model table, contract status marker, research decisions, task dependencies, checklist and quickstart, plus root Graphify report and targeted message-service/inbox graph relationships.

Reusable practices: link spec → design/model/contracts → independently verifiable tasks → validation; separate superseded proposals from current contracts; record decision rationale and unresolved dependencies; tie scenarios to evidence. Adaptation: the initial survey used a combined baseline; the user subsequently approved feature-scoped specs with shared system docs. Current navigation is in [specs/README.md](../README.md); reuse `_templates/` only for actual work. No frontend folders, provider-specific requirements, routes, entities, commands or coverage thresholds were imported.

Reference conflicts: explicit-read spec differs from older task/quickstart auto-read descriptions; a contract is marked superseded but points to missing mobile `API_V2.md`; the sample checklist is not proof these conflicts are resolved. This is why the backend checklist tracks evidence/status rather than silently declaring blanket product approval. The reference graph commit `4608a5e9e90b0fc54cb09025d1e27f3312bf2126` belongs to the foreign project and cannot be compared as backend lineage.

## Survey method and limits

Started with `npm run context:skeleton`, then its tree/static module graph, instructions/manifest/working tree. Read complete owned implementation/config/test files in bounded directory batches, tracked hashes/read states in a session ledger, and reread only ranges lost to output truncation or needed for contradictions. All 218 boundary files completed; five had env values/email literals withheld, and dashboard JSON was normalized without omitting keys/values. Excluded dependencies, locks, caches, secrets, generated/build output and binary assets. Full ledger: `source-inventory.md` and `source-inventory.json`.

Relevant backend integration docs read in full: mobile location index, location update/batch, journey/history, live trail, privacy/Circle exit, SOS and refresh-token guides. `Guide.md` read in full; older README/iOS monolith and Study documents were consulted selectively, not claimed as fully reviewed or as accepted requirements. Imported graph queries were limited to relevant relationships and verified against backend source before drawing backend conclusions.

Memory MCP is not exposed in the current toolset; `PROGRESS.md` is the durable local fallback. Tool/version/graph freshness and verification results are recorded in [validation.md](validation.md). Runtime remained unchanged. Open behavioral choices are retained in [record owner index](discrepancies.md); Q-01 was resolved only after the user explicitly confirmed continued private chat after Circle exit.
