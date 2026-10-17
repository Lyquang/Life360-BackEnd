# Route Geometry Backend - Interview Notes

## 1. Vì sao thay đổi chỉ thêm, không sửa contract cũ?

**Situation:** iOS production đang decode `path`, `durationMinutes` và response history hôm nay. Thay đổi shape hoặc semantics sẽ làm app cũ hiển thị sai dù HTTP vẫn trả 200.

**Task:** Cung cấp route thật, gap và pagination mà vẫn rollout backend trước mobile.

**Action:** Journey geometry là opt-in bằng `detail=geometry`; endpoint history không query giữ response cũ. Các field mới đều additive, và `totalMovingMinutes` giữ semantics cũ trong khi `observedMovingSeconds` biểu diễn thời gian quan sát được.

**Result:** Backend và mobile có thể deploy độc lập; rollback dense write bằng feature flag không yêu cầu rollback API đọc.

## 2. Vì sao quyết định lưu dựa trên `recordedAt`?

Giờ server nhận phản ánh network latency, không phản ánh lúc GPS fix được đo. Offline sync có thể gửi điểm cũ sau nhiều phút; dùng receive time sẽ đảo thứ tự route và có thể ghi đè last-known mới hơn. Backend validate clock skew, sau đó dùng `recordedAt` cho history và monotonic compare. Điểm đến muộn được lưu đúng vị trí thời gian nhưng không thay marker hiện tại.

## 3. Dense persistence và chống trùng

- Legacy: lưu khi `50 m OR 30 s`.
- Dense flag: lưu khi đạt `15 s AND 25 m`, đổi motion state, heartbeat 300 s, hoặc là late arrival chưa có.
- Realtime và batch dùng cùng fingerprint của timestamp/latitude/longitude; `pointId` UUID vẫn là identity retry chính của mobile.
- Unique partial indexes bảo vệ correctness khi hai request concurrent. In-memory state chỉ là fast path; MongoDB latest point phục hồi state sau restart.

Trade-off: mật độ cao làm route đẹp hơn nhưng tăng document/index storage. Feature flag mặc định tắt giúp đo storage trước khi rollout.

## 4. Haversine và Douglas-Peucker theo mét

Haversine tính khoảng cách trên mặt cầu giữa hai GPS fix. `distanceMeters` cộng mọi cạnh raw nên không bị giảm khi response được làm thưa.

Douglas-Peucker giữ các góc có sai lệch lớn hơn tolerance. Implementation chiếu cục bộ sang mét và chạy iterative để tránh recursion depth. Route được chia thành các range ở data gap rồi mới simplify, vì chạy thuật toán xuyên gap sẽ tạo một đường tưởng tượng qua khoảng không có quan sát.

Benchmark smoke trên máy phát triển: route synthetic 50.000 điểm hoàn thành khoảng vài chục millisecond; đây không phải SLA production. Repository vẫn cần metric latency và giới hạn dữ liệu thực tế.

## 5. Vì sao gap không đồng nghĩa moving hoặc stay?

Hai điểm cách nhau 5 phút chỉ chứng minh vị trí ở hai thời điểm. Chúng không chứng minh user di chuyển liên tục, cũng không chứng minh đứng yên liên tục. API giữ segment legacy để tương thích nhưng thêm `gaps`, `maxGapSeconds` và `observedMovingSeconds`; mobile có thể vẽ nét đứt và tránh trình bày gap như dữ liệu chắc chắn.

Stay algorithm legacy chưa được đổi vì điều đó thay semantics hiện có. Một phiên bản sau có thể chạy gap-first nếu product duyệt thay đổi UX.

## 6. Vì sao cursor thay cho page number?

Location history liên tục nhận bản ghi mới. Offset pagination ngày càng chậm và dễ trùng/sót khi dữ liệu thay đổi. Cursor encode cặp `(timestamp, _id)`; `_id` là tie-break unique khi nhiều fix có cùng timestamp. Query trang sau dùng so sánh lớn hơn cặp này và compound index `{ userId, timestamp, _id }`.

Cursor opaque giúp server thay đổi implementation mà client không phụ thuộc cấu trúc bên trong. Mobile phải gửi lại cùng range và dừng khi `nextCursor == null`.

## 7. Redis và retention

Journey chưa cache Redis vì late arrivals và batch sync làm invalidation phức tạp; MongoDB là correctness boundary. Chỉ thêm cache khi metric chứng minh read latency cần tối ưu.

TTL cũng chưa bật. TTL giảm storage nhưng xóa dữ liệu bất đồng bộ và ảnh hưởng date picker. Quyết định retention cần dựa trên storage thực, yêu cầu sản phẩm và chính sách riêng tư; dữ liệu đã bị TTL xóa không thể rollback nếu không có backup.

## 8. Rollout và rollback

1. Deploy schema/index và API additive.
2. Smoke test legacy history/journey.
3. Kiểm tra index production đã build.
4. Bật dense flag, theo dõi persisted/throttled counts, storage và latency.
5. Mobile opt in `detail=geometry` và range pagination.
6. Khi có vấn đề ghi dữ liệu, tắt dense flag; không cần rollback mobile hoặc API đọc.

Không log token, tọa độ, cursor thô hoặc userId gắn với vị trí. Operational metrics chỉ nên chứa count, reason enum và latency/gap bucket.
