# Verification — saved-place function, revision A

Date: 2026-11-13. Backend only; real local MongoMemoryReplSet and HTTP server;
MONGOMS_RUNTIME_DOWNLOAD=false, no new dependency/binary download.

| Acceptance | Check | Result / evidence |
|---|---|---|
| AC-P1 | REST legacy create/list/coordinates/populated creator and revision zero | PASS in tests/placeManagement.test.js |
| AC-P2 | Creator/admin, scoped get/update/delete, two simultaneous CAS writes, missing legacy revision | PASS; one concurrent update 200, one 409 |
| AC-P3 | Own label isolation, replacement, repeated PUT/DELETE, custom validation | PASS; no duplicate label, separate work/home per user |
| AC-P4 | Outsider/left member/spoof/cross-Circle validation; cascade deletion | PASS in real HTTP/replica set |
| AC-P5 | Concurrent assign/delete, leave/write; injected cascade failure rollback; no-transaction fail-closed | PASS, no orphan labels or partial deletion observed |
| AC-P6 | GET /api-docs.json actually lists all 6 new operations/schemas; API/Study notes | PASS focused suite; local links checked at delivery |

Commands executed:

- `MONGOMS_RUNTIME_DOWNLOAD=false node --test --test-concurrency=1 tests/placeManagement.test.js`: **12/12 PASS**, 1 suite.
- `MONGOMS_RUNTIME_DOWNLOAD=false npm test`: final full regression **289/289 PASS**, 61 suites, including final Swagger/nested-population refinements (earlier run was 288/288 before adding the OpenAPI regression).
- `npm run lint`: PASS, with known multi-file syntax limitation; individual `node --check` on all 12 changed/new JS files: PASS.
- `git diff --check`: PASS; final delivery also checks local links.

No external weather/routing API calls, credential/billing changes, production DB,
migrations, Mobile edits/build/device QA, live deployment or production-index
verification. Auto-presence/geofence is not part of this completed function;
legacy roadmap tasks remain pending. Graphify snapshot becomes stale after source
changes; generated output untouched, context skeleton refreshed for navigation.

Implementation review: actual membership guard writes the same Group document as
leave/remove; new mutations require a real transaction, update/delete compare the
expected revision atomically, and label deletion cascades in that transaction.
No transport/DB library imported into use cases. No new container dependency: label
persistence stays behind existing placeRepo port. Private label retention across
leave is documented; membership gates deny access until rejoin.
