# FamilyTracker monitoring local

Stack riêng cho dữ liệu giả lập: backend + MongoDB replica set + Prometheus + Grafana + Loki + Tempo + Alloy. Không đọc `.env` của backend; Redis, Google và R2 không được cấu hình trong stack này. Credential local nằm trong `.local/` (gitignored, loại khỏi Docker build context). Stack chỉ bind localhost, không gửi log/trace lên Cloud.

## Chạy

```sh
npm run monitoring:init
npm run monitoring:up
npm run monitoring:status
```

- Grafana: http://localhost:3101 ; user `admin`, password xem file `ops/monitoring/.local/grafana` trên máy. Không gửi password vào chat.
- Dashboard DB/cache/workflows: http://localhost:3101/d/familytracker-data/familytracker-database-cache-and-workflows
- Dashboard Logs: http://localhost:3101/d/familytracker-logs/familytracker-logs
- Traces: Grafana > Explore > chọn datasource `FamilyTracker Tempo`; lọc service `familytracker-backend` hoặc mở trace từ trường `traceId` trong log.
- Prometheus: http://localhost:9091 ; kiểm tra Targets và query `up{job="familytracker-local"}`.
- Backend/Swagger riêng: http://localhost:3100/api-docs . Tài khoản local tách biệt production.

Chỉ bind localhost; MongoDB không publish port. Nếu port đã bị chiếm, chỉnh port trong compose và benchmark tương ứng. Stack không nên được expose ra Internet; MongoDB local không bật auth. Không mount Docker socket vào Grafana/Prometheus.

Prometheus scrape 60 giây bằng bearer riêng qua secret file, gzip, giới hạn 2.500 sample/lần và retention 3 ngày/512 MB. Chờ ít nhất hai scrape để biểu đồ rate có dữ liệu. `No data` nghĩa là chưa có mẫu, không phải zero. Backend bị giới hạn 0,1 CPU/512 MB; Docker Desktop và Mongo/Prometheus/Grafana vẫn dùng tài nguyên máy chủ riêng.

Metrics scrape hiện bao gồm HTTP/runtime, Socket/Location/Live Trail, Mongo pool/repository/transaction, Redis/cache/auth-blacklist, privacy/membership, media ticket và digest job outcomes. Bốn dashboard metrics có description giải nghĩa ở từng panel; dashboard thứ năm hiển thị log JSON qua Loki. Redis panels có thể không có sample khi Redis tắt; `No data` không phải giá trị zero.

HTTP request và Socket action có manual OpenTelemetry spans. Attributes chỉ gồm method, route group, status code hoặc tên Socket event đã biết; không ghi full URL, payload, user ID, email hay tọa độ. Local Compose lấy mẫu 100% để tiện debug. Log JSON giữ ở volume local và Alloy tail file sang Loki; `traceId`/`spanId` giúp chuyển qua lại giữa Logs và Tempo. Đây là tracing mức request/event, chưa phải tracing từng query Mongo/Redis.

## Gmail email alerts

`npm run monitoring:init` tạo `ops/monitoring/.local/gmail-app-password` dạng placeholder, nằm trong gitignore. Để bật gửi email, tạo Gmail App Password trong [Google Account](https://myaccount.google.com/apppasswords) (Google yêu cầu bật 2-Step Verification; đây là credential riêng, không phải mật khẩu Gmail), rồi thay nội dung file đó bằng App Password. Không commit file này và không dán secret vào chat. Sau đó chạy:

```sh
docker compose --env-file ops/monitoring/compose.env -f ops/monitoring/compose.yml up -d --force-recreate grafana
npm run monitoring:validate-alerts
```

Alert contact point `familytracker-gmail` chỉ gửi summary rule, severity và runbook; không đính kèm log thô, trace, token, tọa độ hay dữ liệu tài khoản. Rules cảnh báo backend scrape down, Mongo pool checkout failure, Redis connection errors, digest job errors, HTTP 5xx tăng cao, Socket action errors, và bất kỳ backend error-level log nào trong 5 phút. Ngưỡng tổng hợp là baseline ban đầu, chưa hiệu chỉnh theo production. Chưa thể gửi thử thư cho tới khi App Password thật được thêm; sau đó dùng Grafana > Alerting > Contact points > Test.

## Alerts

Grafana file provisioning tạo bảy local rules. Mở Grafana > Alerting > Alert rules để xem trạng thái. Mongo/Redis/job/HTTP/Socket/log query không có sample được xử lý như `OK` để tránh email NoData; lỗi truy vấn được tách khỏi trạng thái alert. Redis đang tắt trong Compose, nên rule Redis chỉ cảnh báo event `error`, không cảnh báo event `end`/`disabled`.

Sau khi sửa alert YAML, áp dụng bằng `docker compose -f ops/monitoring/compose.yml restart grafana`. Kiểm tra rule provisioning bằng `npm run monitoring:validate-alerts`.

Smoke fire/recovery backend-down (chỉ với local stack): đảm bảo Prometheus Targets đang `up`, sau đó `docker compose -f ops/monitoring/compose.yml stop backend`. Với scrape/evaluation 60 giây và `for: 2m`, chờ tối đa khoảng 4 phút rồi xác nhận alert Firing. Chạy `docker compose -f ops/monitoring/compose.yml start backend`, đợi healthcheck healthy và thêm tối đa 2 phút để alert trở về Normal. Không chạy thao tác stop/start này trên production. Không cần thay notification policy tree; Grafana xem policy tree là một resource toàn cục và provisioning có thể ghi đè toàn bộ cây.

Alert thresholds hiện là ngưỡng vận hành ban đầu, chưa được hiệu chỉnh theo production baseline. SMTP đã cấu hình cho Gmail nhưng chưa xác minh gửi thật do App Password chưa được cung cấp. M5 Cloud telemetry vẫn đang chờ duyệt Terms/DPA; Gmail chỉ nhận alert summary theo yêu cầu hiện tại, không có remote log/trace export.

## Benchmark

```sh
npm run benchmark:monitoring -- --smoke
npm run benchmark:monitoring
```

Benchmark chỉ gọi 127.0.0.1:3100, tạo tài khoản/nhóm giả lập trong Mongo local. Mỗi case khởi động lại backend: một user, hai Socket, một Circle; lần lượt GET /auth/me và gửi GPS rồi đợi thiết bị thứ hai nhận; nghỉ 200 ms. Metrics off/on dùng cùng thuật toán vị trí; safe JSON logger vẫn bật trong cả hai case. Không dùng workload này để kết luận sức tải nhiều người dùng.

Smoke: warmup 3s, đo 10s, một cặp. Full: warmup 30s, đo 120s, ba cặp, đảo thứ tự ở cặp thứ hai. Script khôi phục metrics bật sau khi chạy. Kết quả nằm trong `.local/benchmark-smoke.json` hoặc `.local/benchmark.json`.

Gate theo từng cặp: HTTP và Socket p95 tăng <=5%, RSS tăng <=20 MiB. RSS lấy từ `/proc/1/status` trước/sau đo, không phải RSS peak. Độ trễ tính cả vòng mạng local. Docker Desktop/host contention ảnh hưởng kết quả. Benchmark trước đó không gồm Loki/Tempo worker; thêm chúng chưa được benchmark nên không thể khẳng định đạt gate M4 hoặc phù hợp Render Free.

## Dừng và khôi phục

```sh
npm run monitoring:down
```

Lệnh này giữ volume DB/Grafana/Prometheus. Không tự chạy `down -v` vì sẽ xóa dữ liệu local. `monitoring:init` không ghi đè credential đã có. Dashboard JSON được quản lý bằng git; thay đổi UI cần export và review trước khi đưa vào repo.

Tham khảo cấu hình chính thức: [Prometheus configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/), [Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/).
