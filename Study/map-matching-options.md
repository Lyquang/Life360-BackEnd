# M0 - Map Matching Options

## 1. Cổng quyết định

Ngày đọc nguồn: **2026-10-17**.

Tài liệu này ghi lại M0 đã được quyết định ngày 2026-10-18. `MapMatcher` port, `NoopMatcher` và `FakeMatcher` được phép làm ở T3 mà không khóa provider; adapter thật bị hoãn.

## 2. Tiêu chí

- Cho phép hiển thị geometry trên Apple Maps `MKMapView`.
- Không biến route planning giữa hai endpoint thành lịch sử đã đi.
- Nhận GPS trace, timestamp và accuracy; xử lý gap/sub-trace.
- Có geometry versioned, tốt nhất `polyline6`.
- Có privacy/retention rõ; tránh coordinate trong application logs.
- Có timeout/rate/cost predictable và đổi provider được qua port.
- Có thể chạy với hạ tầng hiện tại hoặc nêu rõ hạ tầng mới.

## 3. Bảng phương án

| Phương án | Apple Maps / license | Hạ tầng và chi phí | Privacy | Kết luận M0 |
| --- | --- | --- | --- | --- |
| Self-host OSRM + OSM Việt Nam | OSRM permissive license; OSM yêu cầu attribution và ODbL notice. Geometry OSM có thể overlay nếu đáp ứng attribution, cần review pháp lý trước production. | Cần preprocess graph, disk bền vững và service riêng. Free Render hiện không có persistent disk/private inbound/horizontal scale, nên không phù hợp. | Coordinate ở hạ tầng dự án, nhưng OSRM Match dùng URL; phải private service và tắt/redact access logs. | Ứng viên kỹ thuật mạnh cho driving/polyline6/confidence. Cần benchmark. |
| Self-host Valhalla + OSM Việt Nam | Valhalla MIT; OSM attribution/ODbL vẫn áp dụng. | Docker/service riêng, graph build và persistent storage; không phù hợp chạy chung Free web container. | POST JSON giảm coordinate trong URL; dữ liệu ở hạ tầng dự án. | Ứng viên privacy/multimodal tốt; confidence scalar không tương đương OSRM. |
| Hosted/commercial, ví dụ Mapbox | Official Map Matching docs yêu cầu result hiển thị trên Mapbox map. Không phù hợp `MKMapView` nếu không có thỏa thuận bằng văn bản khác. | Hosted, tối đa 100 coordinates/request, 300 req/min; free 100k request/tháng, sau đó tính theo request. | GPS rời hạ tầng và đi tới provider; cần consent/privacy/DPA/retention review. | Loại khỏi mặc định cho Apple Maps; chỉ xem lại nếu vendor cấp quyền rõ ràng. |
| Chưa match | Không có provider/license ngoài Apple Maps và raw GPS hiện có. | Không thêm compute/API cost. | GPS không rời hạ tầng. | Đường lui hợp lệ và là default ban đầu: raw point + gap/unmatched. |

## 4. OSRM

### Khả năng

OSRM Match:

- nhận GPS trace, timestamps và per-point radius;
- trả `polyline6` và confidence `[0,1]`;
- có thể split sub-trace khi timestamp jump lớn hoặc transition không hợp lý;
- có thể bỏ outlier không match được.

Official source: [OSRM HTTP Match API](https://project-osrm.org/docs/v26.5.0/http), [OSRM license](https://github.com/Project-OSRM/osrm-backend/blob/master/LICENSE.TXT).

### Data và infrastructure

Geofabrik ghi nhận `vietnam-latest.osm.pbf` khoảng **315 MB** tại ngày đọc. Processed OSRM graph sẽ lớn hơn PBF, nhưng chưa benchmark nên không ghi con số RAM/disk giả định.

Official source: [Geofabrik Vietnam extract](https://download.geofabrik.de/asia/vietnam.html).

Render source hiện dùng Free web service. Render nêu Free service không có persistent disk, không scale nhiều instance và không nhận private-network inbound; vì vậy không nên chạy OSRM chung container hoặc coi Free plan là production matcher.

Official source: [Render Free limitations](https://render.com/docs/free), [Render compute plans](https://render.com/docs/compute-plans).

### Risk

- Match request dùng coordinates trong URL. Reverse proxy/APM mặc định có thể ghi URL.
- Driving profile không phù hợp walking/cycling nếu motion mode không chắc.
- Confidence là engine score, không phải xác suất đã calibrate cho đô thị Việt Nam.

## 5. Valhalla

Valhalla map matching:

- dùng POST cho trace lớn;
- hỗ trợ timestamp, GPS accuracy, search radius và costing modes;
- split discontinuity;
- tài liệu khuyến nghị density khoảng 1-10 giây; sparse data tăng sai số.

Official source: [Valhalla Map Matching](https://valhalla.github.io/valhalla/api/map-matching/api-reference/), [Valhalla Docker](https://github.com/valhalla/valhalla/blob/master/docker/README.md), [Valhalla MIT license](https://github.com/valhalla/valhalla/blob/master/COPYING).

Ưu điểm so với OSRM là POST và multimodal. Nhược điểm cho contract hiện tại là không có native confidence scalar giống OSRM. Không được tự chế confidence mà chưa có calibration method.

## 6. Hosted/commercial

Mapbox được dùng làm case study vì có tài liệu rõ:

- `polyline6`, timestamp, radiuses và confidence;
- 2-100 coordinates/request;
- 300 requests/phút;
- docs hiện ghi result phải hiển thị trên Mapbox map;
- pricing hiện có 100,000 request/tháng miễn phí, tier tiếp theo bắt đầu `$0.75 / 1,000` requests.

Official source: [Mapbox Map Matching API](https://docs.mapbox.com/api/navigation/map-matching/), [Mapbox pricing](https://www.mapbox.com/pricing).

Vì app dùng Apple Maps, Mapbox **không vượt qua legal/display gate** theo public docs. Các hosted provider khác chỉ được thêm vào shortlist khi có official terms xác nhận overlay `MKMapView`, retention, reuse/cache và DPA; không suy luận từ marketing page.

## 7. OSM attribution

OpenStreetMap yêu cầu:

- hiển thị credit OpenStreetMap;
- nêu dữ liệu có theo Open Database License;
- interactive map phải theo attribution guidelines phù hợp.

Official source: [OpenStreetMap Copyright and Licence](https://www.openstreetmap.org/copyright).

Trước rollout, iOS cần vị trí attribution rõ trên màn Journey/Live Trail. Việc Apple Maps đã có attribution riêng không thay thế attribution của derived OSM road geometry.

## 8. Cost model

### Hosted request formula

```text
windowsPerHour = 3600 / min(T, K * fixIntervalSeconds)
monthlyRequests = activeUsers * watchedHoursPerDay * 30 * windowsPerHour
```

Ví dụ chỉ để sizing: K=5, fix mỗi 15 giây => 48 windows/hour.

- 10 active users x 2 giờ/ngày => 28,800 requests/tháng.
- 100 active users x 2 giờ/ngày => 288,000 requests/tháng.
- Với Mapbox public pricing hiện tại, 188,000 request vượt free tier đầu tiên tương đương khoảng `$141` ở tier `$0.75/1,000`, chưa tính thuế/contract và các tier khác.

Mapbox vẫn không được chọn cho Apple Maps chỉ vì giá phù hợp.

### Self-host formula

```text
monthlyCost = matcherCompute + persistentDisk + bandwidth + update/build jobs + monitoring
```

Render current pricing có plan 2 GB RAM từ khoảng `$40/month` và 4 GB từ khoảng `$55/month`, nhưng chưa có benchmark nên chưa biết plan nào đủ. POC phải đo RSS, graph disk, preprocess time, p95 match latency và requests/second trước khi chọn plan.

Official source: [Render pricing](https://render.com/pricing).

## 9. Accuracy evaluation

Không dùng track thật trong repo. Tạo synthetic truth set trên lưới giả và, ở staging riêng, controlled test có consent:

- đường song song cách gần;
- hẻm/đường nhỏ;
- cầu vượt/tunnel/layer khác nhau;
- stationary cluster;
- GPS drift/off-road;
- gap dài;
- walking/cycling/automotive;
- provisional tail thay đổi khi thêm future context.

Metrics tổng hợp:

- matched/unmatched ratio;
- confidence distribution nếu provider có;
- endpoint displacement và path deviation so với known truth;
- wrong-road rate tại parallel roads;
- p50/p95 latency;
- request/window và estimated monthly cost;
- không log raw coordinate/polyline/userId.

## 10. Provider-neutral port

```js
// Application port; no provider URL/token types leak outward.
MapMatcher.matchWindow({
  points: [{ seq, latitude, longitude, recordedAt, accuracy, motionState }],
  profile,
  signal
})
// -> { provider, version, encoding, geometry, confidence?, matchedFromSeq, matchedToSeq }
```

Adapters:

- `NoopMatcher`: luôn unmatched, default production behavior.
- `FakeMatcher`: deterministic synthetic geometry cho T3 tests.
- Real adapter chỉ ở T4 sau selection.

## 11. Reliability/privacy gate

Trước khi gửi coordinate ra ngoài phải chốt:

- user-facing consent và privacy notice;
- provider processing region/subprocessor/DPA;
- provider retention và training/reuse policy;
- quyền cache geometry và thời hạn;
- deletion process khi user xóa account/history;
- endpoint secret rotation và budget/rate cap;
- không gửi userId, email, Circle ID hoặc device identifier.

## 12. Quyết định M0

1. T1-T3 dùng phương án **(c) chưa khớp đường**: `NoopMatcher`/`FakeMatcher`, vệt điểm thật và nét đứt qua khoảng trống.
2. T4 hoãn cho đến khi chủ dự án đánh giá vệt trên dữ liệu thật.
3. Nếu sau này cần khớp đường, chỉ POC self-host OSRM trước bằng dữ liệu tổng hợp/controlled test có consent.
4. Chỉ đánh giá Valhalla nếu OSRM không đạt yêu cầu privacy hoặc accuracy.
5. Không dùng Mapbox cho `MKMapView` theo public terms hiện tại.
6. Không gửi production coordinate tới bất kỳ provider nào nếu privacy/consent/retention gate chưa hoàn tất.

