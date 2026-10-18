# Road Map Matching cho Journey Geometry

## 1. Trạng thái và phạm vi

Tài liệu này là bản phân tích và execution plan. Chưa có adapter map-matching nào được nối vào production.

Mục tiêu là bổ sung `roadGeometry` theo kiểu additive cho từng moving segment của:

```http
GET /api/v1/history/:userId/journey?date=YYYY-MM-DD&detail=geometry
```

Quyền truy cập tiếp tục dùng `assertCanView`: chủ tài khoản hoặc thành viên có chung Circle. Raw `points`, `gaps` và `path` vẫn là dữ liệu kiểm chứng/fallback; road geometry chỉ là kết quả suy luận. Không dùng route giữa hai đầu mút như bằng chứng về đường đã đi.

### Dependency gate

Map matching phụ thuộc B6b/B6c, và hai prerequisite này đã hoàn tất ngày 2026-10-18:

- B6b khóa semantics hybrid gap/stay và stable `segmentId` cho mọi segment.
- B6c khóa `includePath` mà không thay đổi mảng `points` dùng làm index space.

Point index space và hybrid gap/stay semantics hiện đã được khóa. Tuy vậy T4 vẫn hoãn theo M0; hoàn tất prerequisite không đồng nghĩa tự động bật provider map matching.

## 2. Hiện trạng đã kiểm chứng

- `src/application/history/historyUseCases.js` kiểm tra quyền trước khi đọc history.
- `src/domain/journey.js` tạo moving geometry từ điểm GPS thật, làm thưa và trả `points`, `gaps`, `path`.
- `src/domain/routeGeometry.js` không simplify xuyên temporal gap và giữ hai boundary point.
- Index của `gaps` tham chiếu mảng `points` sau thinning.
- `detail=geometry` hiện không gọi routing/map-matching provider.
- Redis là optional và fail-soft; `NoopCacheManager` được dùng khi Redis tắt.
- Chưa có job queue hoặc worker bền vững cho tác vụ map matching.

## 3. Provider evaluation

### 3.1. OSRM Match

OSRM Match hỗ trợ `polyline6`, timestamp, radius theo accuracy, nhiều sub-trace và trả `confidence` từ 0 đến 1. Đây là mapping gần nhất với contract đề xuất. OSRM cũng có thể bỏ outlier hoặc tách trace khi timestamp jump lớn hơn khoảng 60 giây hay transition bất khả thi.

Điểm cần lưu ý:

- Match API truyền coordinate trong URL. Không dùng public demo cho dữ liệu thật.
- Nếu self-host, phải đặt trong private network, tắt/redact reverse-proxy access log và không log request URL.
- Graph OSM cần preprocess, RAM/disk và thời gian khởi động riêng; không nên chạy chung container web Render hiện tại.
- `confidence` là điểm tin cậy của engine, không phải xác suất đã đo/calibrate cho FamilyTracker.

Nguồn: [OSRM Match API](https://project-osrm.org/docs/v26.5.0/http), [OSRM repository](https://github.com/Project-OSRM/osrm-backend).

### 3.2. Valhalla Map Matching

Valhalla nhận POST JSON, hỗ trợ timestamp, GPS accuracy, search radius, discontinuity và nhiều costing mode. POST giảm nguy cơ tọa độ xuất hiện trong URL/proxy log. Tài liệu khuyến nghị mật độ GPS khoảng 1-10 giây; dữ liệu thưa làm tăng sai số.

Đổi lại, Valhalla không cung cấp trực tiếp một confidence scalar có semantics giống OSRM. Nếu chọn Valhalla, backend không được tự tạo confidence giả; contract phải định nghĩa confidence từ metric đã kiểm chứng hoặc đổi nó thành optional.

Nguồn: [Valhalla Map Matching](https://valhalla.github.io/valhalla/api/map-matching/api-reference/), [Valhalla repository](https://github.com/valhalla/valhalla).

### 3.3. Managed providers

- Mapbox có Map Matching API và POST, nhưng kết quả Map Matching phải tuân theo điều khoản hiển thị của Mapbox; tài liệu hiện nêu kết quả phải hiển thị trên Mapbox map. Vì mobile đang dùng Apple Maps, không chọn trước khi được xác nhận bằng điều khoản/hợp đồng cụ thể. API cũng tính phí theo request và giới hạn coordinate/request.
- Google Directions không phù hợp: đó là route planning, không phải bằng chứng đường đã đi. Policy Directions còn yêu cầu kết quả hiển thị trên Google Map và hạn chế cache. Không dùng cho overlay Apple Maps.

Nguồn: [Mapbox Map Matching](https://docs.mapbox.com/api/navigation/), [Mapbox navigation pricing overview](https://docs.mapbox.com/help/getting-started/navigation/), [Google Directions policies](https://developers.google.com/maps/documentation/directions/policies).

### 3.4. Đề xuất

Quyết định M0 ngày 2026-10-18 là **chưa khớp đường** trong T1-T3. Raw trail và gap metadata là output production duy nhất; `NoopMatcher`/`FakeMatcher` chỉ phục vụ contract và test.

T4 được hoãn. Nếu raw trail cho thấy cần map matching, POC **self-host OSRM** trước vì `polyline6` và confidence khớp contract. Chỉ đánh giá Valhalla nếu OSRM không đạt privacy/accuracy; không dùng Mapbox cho `MKMapView`.

Đây chưa phải quyết định cuối cùng. Trước production cần benchmark RAM/disk/cold-start với extract Việt Nam/APAC, xác nhận OSM attribution/ODbL trên UI, và so sánh chi phí với một managed provider cho phép overlay Apple Maps bằng văn bản.

## 4. Contract đề xuất

Mỗi moving segment trong geometry mode có thể thêm:

```json
{
  "roadGeometry": {
    "version": 1,
    "status": "matched",
    "encoding": "polyline6",
    "provider": "osrm",
    "runs": [
      {
        "fromPointIndex": 0,
        "toPointIndex": 8,
        "data": "<encoded polyline6>",
        "confidence": 0.91
      }
    ],
    "sourceRevision": "sha256-base64url",
    "generatedAt": "2026-10-17T10:00:00.000Z"
  }
}
```

### Status semantics

| Status | Ý nghĩa |
| --- | --- |
| `matched` | Mọi eligible observed run đều có kết quả hợp lệ trên ngưỡng chất lượng. |
| `partial` | Có ít nhất một run hợp lệ, nhưng một run khác thiếu dữ liệu, bị provider từ chối hoặc dưới ngưỡng. |
| `insufficient_data` | Không có run đủ điểm/mật độ/chất lượng để gọi engine; không gọi provider. |
| `unavailable` | Feature/provider chưa cấu hình, timeout, circuit open hoặc dependency tạm thời không truy cập được. |
| `failed` | Provider trả dữ liệu malformed/không thể normalize, hoặc lỗi xử lý không thuộc nhóm tạm thời. |

Quy tắc bắt buộc:

- `runs` luôn là array; không match được thì `[]`.
- Index là inclusive và tham chiếu đúng `moving.points` được trả cho client.
- Mỗi run có `fromPointIndex < toPointIndex`, timestamp tăng dần và không cắt qua một entry trong `gaps`.
- Polyline đầu/cuối phải nằm trong tolerance đã cấu hình so với fix boundary tương ứng.
- `confidence` dùng native OSRM confidence, miền `[0, 1]`, chỉ là engine score; không mô tả nó như xác suất đúng.
- Run dưới ngưỡng không được đưa vào `runs` chỉ để làm đường đẹp.
- `provider` chỉ là enum kỹ thuật; không trả endpoint, token hay URL request.
- Client cũ bỏ qua field mới. Client mới vẫn dùng raw points/gaps khi status hoặc version không hỗ trợ.

### Observed runs

Từ `moving.points` sau thinning và `moving.gaps`:

1. Sort/order đã được journey builder khóa trước đó.
2. Cắt tại từng cặp `gap.fromIndex -> gap.toIndex`.
3. Giữ các range liên tục có tối thiểu số điểm được cấu hình.
4. Provider có thể tách một observed run thành nhiều sub-run; từng sub-run vẫn phải map về một range index liên tục và không vượt boundary gốc.

Ngưỡng ban đầu để benchmark, chưa chốt production:

- tối thiểu 3 fix/run;
- tối đa 100 fix/request;
- accuracy hữu hạn và không âm; bỏ fix có accuracy quá kém theo policy;
- reject transition có tốc độ vật lý bất hợp lý;
- confidence tối thiểu đề xuất `0.75`, phải calibrate bằng fixture và track test đồng thuận.

## 5. Clean Architecture

### Domain

Tạo pure helpers, không biết HTTP/provider:

- `buildObservedRuns(points, gaps)`;
- `evaluateRunQuality(run, policy)`;
- `computeSourceRevision(...)`;
- `validateRoadGeometry(...)`.

`sourceRevision` là SHA-256 của canonical point fields, gap boundaries, geometry policy version, profile và matcher engine version. Không chứa tên/email; cache/log chỉ dùng digest.

### Application

Port:

```js
// IMapMatchingProvider
matchRun({ points, profile, signal })
// -> { encoding, data, confidence, matchedInputRange, engineVersion }
```

Use case/service `EnrichJourneyRoadGeometry`:

1. Nhận journey đã qua authorization và geometry building.
2. Tách observed runs, quality gate trước khi gọi infrastructure.
3. Tính revision và đọc durable cache.
4. Cache hit: validate rồi gắn response.
5. Cache miss: gọi provider với timeout/concurrency limit.
6. Normalize, validate, lưu cache và gắn status.
7. Mọi lỗi provider đều fallback về raw geometry; không làm endpoint journey trả 5xx.

### Infrastructure

- `OsrmMapMatchingProvider`: encode URL an toàn, timeout/abort, parse response, map tracepoints/sub-traces và không log URL.
- `RoadGeometryCacheRepository`: MongoDB là durable cache để Redis-off không gây gọi provider lặp lại.
- Redis chỉ là hot cache optional trước MongoDB; Noop vẫn giữ đúng behavior.
- Mongo unique key gồm target user, local date, segment ID, source revision, policy version, provider và engine version.
- In-process semaphore giới hạn concurrency; circuit breaker ngắn bảo vệ provider.

Không lưu access token/provider secret trong model. Cache retention không được dài hơn retention của source location history.

### Presentation và composition root

- Không thêm logic map matching vào controller.
- `historyController` và route giữ nguyên authorization/response wrapper.
- `src/container.js` chọn adapter theo config; disabled/missing config tạo unavailable provider.
- OpenAPI và mobile doc mô tả additive contract/status/fallback.

## 6. Data flow

```mermaid
sequenceDiagram
    participant Mobile
    participant Controller as HistoryController
    participant JourneyUC as HistoryUseCase
    participant Domain as Journey + Run Policy
    participant Cache as RoadGeometry Cache
    participant Matcher as IMapMatchingProvider
    participant Engine as Private OSRM

    Mobile->>Controller: GET journey?detail=geometry (Bearer JWT)
    Controller->>JourneyUC: getDayJourney(requesterId, targetUserId)
    JourneyUC->>JourneyUC: assertCanView self/shared Circle
    JourneyUC->>Domain: build raw points, gaps, moving segments
    Domain-->>JourneyUC: observed runs + sourceRevision
    JourneyUC->>Cache: get(revision, policy, engine)
    alt cache hit
        Cache-->>JourneyUC: validated roadGeometry
    else cache miss and run eligible
        JourneyUC->>Matcher: matchRun(points, accuracy, timestamps)
        Matcher->>Engine: bounded request without identity/token
        Engine-->>Matcher: polyline6 + confidence/sub-traces
        Matcher-->>JourneyUC: normalized result
        JourneyUC->>Cache: upsert validated result
    else insufficient/unavailable
        JourneyUC->>JourneyUC: runs=[] + safe status
    end
    JourneyUC-->>Controller: legacy geometry + optional roadGeometry
    Controller-->>Mobile: 200; raw fallback always retained
```

## 7. Cache, invalidation và privacy

- Late/offline history point thay đổi canonical source nên tạo `sourceRevision` mới; cache cũ không còn hit.
- Policy/provider/engine version là một phần key, nên deployment mới không dùng nhầm geometry cũ.
- Có unique index để hai request đồng thời không tạo hai bản cache logic.
- Có lock best-effort để giảm stampede; correctness không phụ thuộc Redis.
- Không log coordinate, encoded geometry, provider request URL, token hoặc raw response.
- Metrics chỉ gồm count/status/latency/confidence bucket/payload bytes/cache hit; không gắn user ID thô.
- Gửi provider tối thiểu coordinate, timestamp tương đối và accuracy; không gửi user name, email, Circle ID.
- Dữ liệu OSM-derived cần attribution và review ODbL trước rollout; đây không phải tư vấn pháp lý.

## 8. Failure policy

- Timeout/connection/circuit open: `unavailable`, giữ raw points/gaps.
- No match hoặc run không đạt quality: `insufficient_data`, không dựng line giả.
- Một phần thành công: `partial`, chỉ trả các run hợp lệ.
- Malformed polyline, index hoặc endpoint tolerance sai: bỏ run; không chuyển dữ liệu không kiểm chứng cho mobile.
- Redis lỗi: đọc Mongo cache rồi provider; app không crash.
- Mongo cache lỗi: có thể match trong giới hạn nhưng không retry vòng lặp trong cùng request.
- Provider lỗi hàng loạt: circuit breaker ngừng gọi, trả fallback nhanh.

## 9. Execution plan

### M0 - Hoàn tất dependency

Đã hoàn tất và test B6b/B6c; stable moving point index space và geometry policy version đã được khóa.

### M1 - Contract/domain

Tạo domain port/pure policy, status model, observed-run split, source revision và validator. Thêm synthetic unit/contract tests, chưa có network.

File dự kiến:

- `src/domain/roadGeometry.js`
- `src/application/ports/IMapMatchingProvider.js`
- `tests/roadGeometryContract.test.js`

### M2 - Durable cache

Tạo Mongoose cache model/repository với unique revision key và retention đã duyệt. Test cache hit, revision invalidation, concurrent upsert và Redis-disabled path.

File dự kiến:

- `src/infrastructure/database/models/RoadGeometryCache.js`
- `src/infrastructure/repositories/roadGeometryCacheRepository.js`
- migration/index bootstrap theo pattern hiện có

### M3 - Provider adapter

Sau khi chốt provider, viết OSRM adapter với timeout, response size cap, index/polyline validation và redacted logging. Tests dùng fake HTTP transport/fixture tổng hợp; CI không gọi internet.

### M4 - Journey integration

Wire `EnrichJourneyRoadGeometry` sau journey build và authorization, qua `src/container.js`. Giới hạn request/concurrency/circuit breaker. Feature flag mặc định off.

### M5 - Contract/docs/tests

Test bắt buộc:

- nhiều góc phố, đường song song, sparse fixes, stationary, off-road;
- một run match và một run fail => `partial`;
- không run xuyên gap, index luôn hợp lệ;
- Circle/self được phép, outsider 403 trước khi provider được gọi;
- cache hit không gọi provider lần hai;
- late batch point đổi revision;
- timeout/malformed/provider down vẫn 200 với raw fallback;
- legacy response không đổi khi flag off;
- unknown status/version/malformed geometry có fixture cho mobile fallback.

Cập nhật `api-docs/JOURNEY_ROUTE_API_DOC.md`, README, `.env.example`, `render.yaml`, skeleton/graph và `PROGRESS.md`.

### M6 - Benchmark và rollout

1. Deploy matcher riêng với dữ liệu tổng hợp, flag off.
2. Đo p50/p95 latency, cache hit, match rate, confidence distribution, response size, RAM/disk/cost.
3. Chạy tài khoản test; không đưa track thật vào repo/log.
4. Bật canary theo môi trường/tỷ lệ nhỏ.
5. Rollback bằng flag; raw geometry luôn còn nguyên.

## 10. Biến môi trường dự kiến

```dotenv
ROAD_MATCH_ENABLED=false
ROAD_MATCH_PROVIDER=osrm
ROAD_MATCH_ENDPOINT=
ROAD_MATCH_PROFILE=driving
ROAD_MATCH_TIMEOUT_MS=3000
ROAD_MATCH_MIN_POINTS=3
ROAD_MATCH_MAX_POINTS_PER_REQUEST=100
ROAD_MATCH_MIN_CONFIDENCE=0.75
ROAD_MATCH_MAX_CONCURRENCY=2
ROAD_MATCH_CACHE_TTL_DAYS=7
ROAD_MATCH_ENGINE_VERSION=
```

Không commit endpoint private có credential hoặc provider token.

## 11. Rủi ro và rollback

| Rủi ro | Giảm thiểu | Rollback |
| --- | --- | --- |
| Vẽ sai con đường đã đi | quality gate, confidence threshold, raw fallback | tắt `ROAD_MATCH_ENABLED` |
| Tọa độ xuất hiện trong URL/log | private OSRM, redact/tắt access log | ngắt adapter/provider |
| N lời gọi khi mở Journey | durable revision cache, lock, limits | chỉ trả cached/raw |
| Render quá tải | matcher service độc lập, benchmark vùng nhỏ | scale matcher hoặc tắt flag |
| Offline point làm cache cũ | content revision | revision miss tự nhiên |
| Điều khoản không cho overlay Apple Maps | legal/ToS gate trước rollout | không chọn provider đó |
| Client cũ vỡ | field additive, legacy golden tests | omit `roadGeometry` |

## 12. Adapter gate đã duyệt

Không code adapter thật trong T1-T3. Các profile, confidence threshold, provider cache và latency model chỉ được quyết định trong một T4 plan mới sau khi raw trail được đánh giá. OSM attribution, privacy consent và retention review vẫn là gate bắt buộc trước mọi OSRM POC dùng ngoài dữ liệu tổng hợp.

