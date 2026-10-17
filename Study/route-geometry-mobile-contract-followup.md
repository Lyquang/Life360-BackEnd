# Route Geometry Mobile Contract Follow-up - B6 Plan

## 1. Mục tiêu

Khép kín các điểm chưa rõ giữa journey/history backend và iOS sau B2-B5 mà không làm vỡ client đang dùng legacy mode hoặc `detail=geometry` hiện tại.

Đây là tài liệu plan-first. Chưa có API, schema hay thuật toán production nào được thay đổi trong B6.

## 2. Hiện trạng đã kiểm chứng

### 2.1. Múi giờ

- `date` của journey dùng `localDayRange()` theo timezone process.
- Render và `.env.example` đặt `TZ=Asia/Ho_Chi_Minh`.
- Response hiện không trả `timeZone`, nên mobile không thể chứng minh timezone mà server đã dùng.

Kết luận: nhận xét của mobile là đúng. Giá trị deploy dự kiến đã biết, nhưng contract thiếu metadata.

### 2.2. Ngưỡng gap

- Backend dùng `JOURNEY_GAP_THRESHOLD_SECONDS`, mặc định 180 giây.
- `maxGapSeconds` là gap lớn nhất thực tế, không phải ngưỡng cấu hình.
- Response không công bố `gapThresholdSeconds`.

Kết luận: nhận xét đúng. Mobile không nên hard-code 180 vì Render có thể override.

### 2.3. Index của `gaps`

- `enrichedGeometry()` tạo mapping từ raw index sang index sau thinning.
- `fromIndex` và `toIndex` hiện tham chiếu tới mảng `points` thực sự được trả.
- Hai biên gap được thuật toán giữ lại nên index hợp lệ nếu invariant không bị phá.

Kết luận: code đã đúng, nhưng API contract cần tuyên bố invariant rõ ràng và mobile vẫn cần defensive validation.

### 2.4. Stay đi qua gap

- Stay detection chạy trước gap analysis và giữ thuật toán legacy.
- Hai điểm gần nhau nhưng cách nhau lâu có thể trở thành một stay.
- Response stay không có cờ cho biết dữ liệu chứa khoảng không quan sát.

Kết luận: đây là data-quality gap thật, đã được ghi chú nhưng chưa có machine-readable signal.

### 2.5. `timestamp` và `recordedAt`

- Socket mới dùng `recordedAt` và giữ `timestamp` làm alias.
- Journey geometry points dùng `recordedAt`.
- Raw history vẫn chỉ trả `timestamp`; query `to` là inclusive.

Kết luận: không sai về dữ liệu nhưng naming làm mapper iOS dễ nhầm. Cần alias additive và tài liệu boundary rõ ràng.

### 2.6. `path` và `points`

- `detail=geometry` trả cùng chuỗi tọa độ ở cả `path` và `points`.
- Điều này giữ compatibility nhưng gần gấp đôi phần geometry trong payload.
- Bỏ `path` mặc định ngay bây giờ có thể làm vỡ client đã bắt đầu dùng geometry mode.

Kết luận: cần cơ chế opt-out additive, không âm thầm xóa field hiện có.

## 3. Contract đề xuất

### 3.1. Metadata top-level

Với `detail=geometry`, thêm:

```json
{
  "timeZone": "Asia/Ho_Chi_Minh",
  "geometryPolicy": {
    "version": 2,
    "gapThresholdSeconds": 180,
    "gapIndexSpace": "points",
    "toBoundary": "inclusive",
    "stayRadiusMeters": 80,
    "minStayMinutes": 5
  }
}
```

- `timeZone` dùng IANA Time Zone Identifier, lấy từ config đã validate.
- `gapThresholdSeconds` là ngưỡng hiệu lực của request, không phải `maxGapSeconds` quan sát được.
- `gapIndexSpace=points` tuyên bố `fromIndex/toIndex` tham chiếu mảng `points` sau thinning.
- `toBoundary=inclusive` giúp mobile không tự suy đoán boundary của range API.
- `version` khóa semantics của gap/stay để mobile có thể xử lý thay đổi policy trong tương lai.
- `stayRadiusMeters` và `minStayMinutes` công bố các ngưỡng dùng để phân loại stay.

Đề xuất: metadata chỉ bắt buộc trong geometry/range mode; legacy response không query giữ nguyên tuyệt đối.

### 3.2. Defensive gap invariant

Backend bảo đảm với mọi gap:

```text
0 <= fromIndex < toIndex < points.count
points[fromIndex].recordedAt < points[toIndex].recordedAt
```

Nếu invariant không thể bảo đảm, backend phải bỏ gap lỗi và ghi metric không chứa userId/toạ độ thay vì trả index hỏng.

Mobile nên validate lại. Nếu index lỗi: bỏ riêng gap đó, không crash; không tự truy cập mảng; ghi telemetry không chứa tọa độ. Đề xuất UX an toàn là không vẽ cạnh không xác định thay vì vẽ đường liền.

### 3.3. Stay quality - quyết định hybrid gap-first

Không áp gap-first thuần theo thời gian. `gapThresholdSeconds=180` nhỏ hơn heartbeat đứng yên mặc định 300 giây, và iOS có thể im lặng hàng giờ khi stationary; cắt mọi interval trên 180 giây sẽ triệt tiêu stay hợp lệ.

Quy tắc geometry mode đã duyệt cho mỗi cặp điểm liên tiếp vượt time threshold:

1. Nếu khoảng cách hai đầu **lớn hơn** `stayRadiusMeters`, đây là data gap của route: không tạo stay xuyên qua và trả trong `gaps` để mobile vẽ nét đứt.
2. Nếu khoảng cách hai đầu **không lớn hơn** `stayRadiusMeters`, đây là khoảng im lặng tại cùng khu vực: cho phép giữ trong cùng stay, đánh dấu stay suy luận và **không** đưa interval này vào moving `gaps`.

Stay suy luận trả:

```json
{
  "type": "stay",
  "containsDataGap": true,
  "maxGapSeconds": 7200,
  "confidence": "inferred"
}
```

- Stay không chứa interval im lặng vượt ngưỡng trả `confidence: observed`, `containsDataGap: false`.
- Mỗi stay geometry có `segmentId` ổn định, dẫn xuất versioned từ identity của điểm đầu giống moving segment; không dùng array index.

**Quy ước `leftAt` và duration:**

- `arrivedAt` là timestamp của điểm đầu trong stay.
- `leftAt` là timestamp của **điểm cuối vẫn nằm trong bán kính stay**, kể cả điểm đó xuất hiện sau một khoảng im lặng. Không dùng timestamp của điểm chuyển động đầu tiên ngoài bán kính.
- `durationMinutes = leftAt - arrivedAt`, vì product muốn biểu diễn khoảng thời gian có khả năng ở lại khu vực.
- Phần im lặng được công bố riêng qua `maxGapSeconds`, `containsDataGap` và summary; client không được hiểu toàn bộ duration là GPS quan sát liên tục.

Đánh đổi: quy tắc này giữ được stationary stay khi iOS tiết kiệm pin, nhưng vẫn là suy luận và có thể sai nếu người dùng rời đi rồi quay lại trong lúc app im lặng. `confidence: inferred` làm uncertainty machine-readable; backend không tuyên bố đây là continuous observation.

Summary additive, chỉ geometry mode:

- `observedStaySeconds`: tổng các interval nằm trong stay và không vượt `gapThresholdSeconds`.
- `unobservedSeconds`: tổng các interval vượt threshold, gồm cả inferred same-place silence và moving route gaps. Field này không thay đổi `totalStayMinutes` hay `totalMovingMinutes` cũ.

### 3.4. Chuẩn hóa timestamp additive

Raw range point trả đồng thời:

```json
{
  "timestamp": "2026-10-17T01:00:00.000Z",
  "recordedAt": "2026-10-17T01:00:00.000Z"
}
```

- `recordedAt` là tên chuẩn cho code mobile mới.
- `timestamp` là compatibility alias và chưa bị xóa.
- `from` là inclusive, `to` là inclusive, cursor là exclusive sau phần tử cuối trang trước.

Đề xuất mapper iOS: decode `recordedAt ?? timestamp` vào một property domain duy nhất tên `recordedAt`.

### 3.5. Giảm payload mà không phá contract

Thêm query tùy chọn:

```http
GET /api/v1/history/{userId}/journey?detail=geometry&includePath=false
```

- Mặc định `includePath=true` để giữ contract geometry hiện tại.
- Khi `false`, moving segment bỏ `path`; `points` vẫn đầy đủ.
- Legacy mode không cho phép hoặc bỏ qua `includePath=false`; đề xuất validate chỉ dùng cùng `detail=geometry`.
- Swift DTO giữ `path: [Coordinate]?` optional.

Không đề xuất đổi mặc định ngay. Sau khi mọi mobile version dùng `points`, có thể tạo geometry contract version mới nếu muốn mặc định bỏ `path`.

## 4. Execution Plan

### B6a - Contract metadata và timestamp alias

Tầng presentation/application:

- thêm `TZ` vào env schema và expose `historyTimeZone` từ composition root;
- geometry response thêm `timeZone` và `geometryPolicy`;
- range response thêm `timeZone`, boundary metadata và `recordedAt` alias;
- giữ legacy no-query response nguyên dạng;
- cập nhật Swagger và API doc.

Test:

- timezone từ config xuất hiện đúng;
- gap threshold trong response đúng cả khi env override;
- `recordedAt === timestamp` ở raw range;
- no-query legacy deep-equal với shape cũ.
- policy trả đủ `version`, gap/index/boundary và stay thresholds.

### B6b - Hybrid gap invariant và stay quality

Tầng domain/application:

- thêm validator thuần cho gap index sau thinning;
- phân loại interval dài bằng cả thời gian và khoảng cách: far = route gap, in-radius = inferred stay silence;
- thêm stable stay `segmentId`, `confidence`, `containsDataGap`, `maxGapSeconds`;
- thêm `observedStaySeconds` và `unobservedSeconds` vào summary geometry;
- không đổi legacy journey builder.

Test:

- mọi gap index nằm trong `points` sau thinning;
- gap qua đoạn đã thinning vẫn trỏ đúng hai biên;
- các điểm cách nhau 300 giây hoặc nhiều giờ nhưng trong bán kính tạo đúng một inferred stay và không tạo route gap;
- di chuyển rồi mất tín hiệu hai giờ và xuất hiện cách xa tạo gap, không tạo stay xuyên gap;
- im lặng tại chỗ rồi di chuyển dùng timestamp của điểm in-radius cuối làm `leftAt`;
- legacy mode vẫn trả stay/summary cũ;
- golden test xác nhận field cũ trong geometry mode không đổi ý nghĩa;
- malformed internal gap bị loại an toàn, không crash.

### B6c - Payload negotiation

Tầng DTO/presentation/domain:

- validate `includePath` boolean và chỉ chấp nhận với `detail=geometry`;
- truyền policy vào journey builder;
- bỏ `path` khi client opt out, mặc định vẫn trả;
- đo kích thước JSON fixture trước/sau để ghi nhận mức giảm thực tế.

Test:

- geometry mặc định vẫn có `path` và `points`;
- `includePath=false` chỉ có `points`;
- legacy mode không thay đổi;
- invalid combinations trả `400` rõ ràng.
- test serialization ghi nhận byte UTF-8 thật của cùng fixture với `includePath=true/false`; B6d đưa đúng hai con số đo được vào tài liệu.

### B6d - Mobile contract và rollout

- cập nhật `api-docs/JOURNEY_ROUTE_API_DOC.md`, Swift models và mapper rules;
- cập nhật README, `.env.example`, `render.yaml`, `PROGRESS.md`;
- chạy `npm test`, lint, Swagger smoke test và tái tạo context graph;
- deploy backend trước, mobile dùng metadata thay vì hard-code;
- theo dõi response size, invalid-gap metric và journey latency.

## 5. Rủi ro và rollback

| Rủi ro | Giảm thiểu | Rollback |
| --- | --- | --- |
| Mobile cũ phụ thuộc `path` | `includePath=true` mặc định | bỏ query mới, luôn trả path |
| Geometry summary đổi do hybrid gap-first | chỉ geometry mode, golden tests | quay về classifier legacy cho geometry |
| TZ deploy cấu hình sai | validate IANA identifier, trả chính giá trị hiệu lực | đặt lại `TZ`, không đổi dữ liệu |
| Index gap lỗi | domain invariant + defensive filtering | không trả gap lỗi, points vẫn dùng được |
| Payload metadata làm decoder strict lỗi | chỉ additive; Swift DTO optional | version/opt-in metadata nếu cần |

## 6. Quyết định đã duyệt

1. Dùng hybrid gap-first: interval dài chỉ là route gap khi hai đầu cách xa hơn stay radius; cùng khu vực giữ inferred stay và không vẽ gap.
2. `includePath=false` là opt-out; mặc định vẫn `true`.
3. Raw history thêm `recordedAt`, giữ `timestamp`; test hai trường luôn bằng nhau.
4. `timeZone` và `geometryPolicy` ở cấp cao nhất.
5. Geometry stay có stable `segmentId`; summary thêm `observedStaySeconds` và `unobservedSeconds` theo định nghĩa trên.

