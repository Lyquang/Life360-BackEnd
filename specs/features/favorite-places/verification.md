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


## Revision B — durable GPS place presence

Checked 2026-11-13, after code stabilized. No JS file changed after the successful
full-suite run before interruption/resume; resumption verifies docs and delivery.

| Acceptance | Executed evidence | Outcome |
|---|---|---|
| B-AC1 | Pure deterministic source-time tests: dwell120s, distinct fixes, accuracy, gap, freshness/future/old points, hysteresis and overlap | PASS |
| B-AC2 | Real HTTP/replica set: same-timestamp pause/resume counter, leave/rejoin, label/place invalidation, cross-Circle isolation | PASS |
| B-AC3 | Re-instantiated use case reads durable projection; concurrent projections preserve newer fix; real wired realtime path isolates injected projection failure; fallback and offline batch do not project | PASS |
| B-AC4 | Bounded auth/cursor/limit HTTP, served OpenAPI path; updated client guide/Study/contracts/model | PASS |

- `MONGOMS_RUNTIME_DOWNLOAD=false node --test --test-concurrency=1 tests/placePresence.test.js tests/placeManagement.test.js`: **27/27 PASS**, 3 suites (15 presence tests + 12 management tests).
- `MONGOMS_RUNTIME_DOWNLOAD=false npm test`: **304/304 PASS**, 63 suites, no skips/failures; final code run completed in ~102s.
- `npm run lint` and individual `node --check` on **16** changed/new JS files: PASS.
- Local Markdown path/whitespace checks and `git diff --check`: checked at delivery.

No production DB/index validation, Mobile UI/device/background QA, personal GPS
channel during pause, routing/weather adapter, APNs/FCM, provider account/key or
runtime deployment claim. Backend projection consumes persisted shared realtime
points only; ordinary GPS transport/legacy time fallback remains compatible.
Timestamp fields alone were insufficient to bind epochs; hidden privacy/membership
counters and current label/place identity are checked. Snapshot reads current DB
context instead of profile/member caches; TTL only cleans storage.

Convergence review of backend revisions A/B finds no remaining active code gap.
Mobile/production roadmap entries are explicitly deferred; the full app/mobility
project is not declared converged. T011 delivery closes after commit/push succeeds.
