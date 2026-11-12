# Family Tracker Backend — Graphify snapshot

Generated on 2026-11-11 with Graphify 0.9.30 `extract src --code-only` followed by `cluster-only --no-label`. This graph covers 136 JavaScript files in `src`: 882 nodes, 1,597 edges and 48 communities. Source paths in `graph.json` are relative to the `src/` directory. Open `graph.html` for the visualization and `GRAPH_REPORT.md` for analysis.

This is AST-only extraction; docs and semantic LLM extraction were not included. Some edges are inferred by Graphify and must be checked against source. Community labels are automatic placeholders. The report title reflects the temporary build directory, and its commit marker does not capture uncommitted changes; use the file hashes in `specs/system/source-inventory.md` to compare the source snapshot.

This is the maintained backend graph. Imported reference-project graphs and their root-level caches/metadata were removed at the user's request on 2026-11-11. Keep future output in this backend folder.

Refreshed with the official local CLI during the 2026-11-11 full survey, from commit `ddf5c58dbf24b35f503da8a43561e8156fedd38a` with unchanged `src` content. Full hashes/read ledger: `specs/system/source-inventory.json`. Compare both commit and source hashes, including additions/deletions. The wider 218-file survey includes tests/config/scripts, but this graph does not. Four generated outputs were copied from a fresh directory without hand edits; caches/logs excluded.

To regenerate safely, use a separately installed `graphifyy==0.9.30` and a fresh empty output directory, then inspect and copy the four graph outputs into this folder. For commands see `specs/system/validation.md`. Graphify's Python environment is not a dependency of the backend runtime.

The existing binary is `/tmp/family-tracker-graphify-venv/bin/graphify`; its temporary location may disappear. Verify tool/version or report a blocker if absent; do not install automatically. Do not follow the report's generic `graphify update .` command at repository root. Use scoped `extract src --code-only` followed by `cluster-only <fresh-output> --no-label`. Navigation must explicitly pass `--graph graphify-out/backend/graph.json`.
