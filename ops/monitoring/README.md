# FamilyTracker monitoring local

Stack riêng cho dữ liệu giả lập: backend + MongoDB replica set + Prometheus + Grafana. Không đọc `.env` của backend; Redis, Google và R2 không được cấu hình trong stack này. Credential local được sinh ngẫu nhiên và nằm trong `.local/` (gitignored, loại khỏi Docker build context).

## Chạy

```sh
npm run monitoring:init
npm run monitoring:up
npm run monitoring:status
```

- Grafana: http://localhost:3101 ; user `admin`, password xem file `ops/monitoring/.local/grafana` trên máy. Không gửi password vào chat.
- Dashboard DB/cache/workflows: http://localhost:3101/d/familytracker-data/familytracker-database-cache-and-workflows
- Prometheus: http://localhost:9091 ; kiểm tra Targets và query `up{job="familytracker-local"}`.
- Backend/Swagger riêng: http://localhost:3100/api-docs . Tài khoản local tách biệt production.

Chỉ bind localhost; MongoDB không publish port. Nếu port đã bị chiếm, chỉnh port trong compose và benchmark tương ứng. Stack không nên được expose ra Internet; MongoDB local không bật auth. Không mount Docker socket vào Grafana/Prometheus.

Prometheus scrape 60 giây bằng bearer riêng qua secret file, gzip, giới hạn 2.500 sample/lần và retention 3 ngày/512 MB. Chờ ít nhất hai scrape để biểu đồ rate có dữ liệu. `No data` nghĩa là chưa có mẫu, không phải zero. Backend bị giới hạn 0,1 CPU/512 MB; Docker Desktop và Mongo/Prometheus/Grafana vẫn dùng tài nguyên máy chủ riêng.

Metrics scrape hiện bao gồm HTTP/runtime, Socket/Location/Live Trail, Mongo pool/repository/transaction, Redis/cache/auth-blacklist, privacy/membership, media ticket và digest job outcomes. Bốn dashboard được provision trong folder FamilyTracker: HTTP & Runtime, Socket Actions, Location & Live Trail, Database/Cache/Workflows. Redis panels sẽ không có sample khi Redis bị tắt; `No data` không phải giá trị zero. Chưa có Loki datasource. Log hiện xem bằng Docker logs của backend. Không có remote_write hay Cloud datasource.

## Benchmark

```sh
npm run benchmark:monitoring -- --smoke
npm run benchmark:monitoring
```

Benchmark chỉ gọi 127.0.0.1:3100, tạo tài khoản/nhóm giả lập trong Mongo local. Mỗi case khởi động lại backend: một user, hai Socket, một Circle; lần lượt GET /auth/me và gửi GPS rồi đợi thiết bị thứ hai nhận; nghỉ 200 ms. Metrics off/on dùng cùng thuật toán vị trí; safe JSON logger vẫn bật trong cả hai case. Không dùng workload này để kết luận sức tải nhiều người dùng.

Smoke: warmup 3s, đo 10s, một cặp. Full: warmup 30s, đo 120s, ba cặp, đảo thứ tự ở cặp thứ hai. Script khôi phục metrics bật sau khi chạy. Kết quả nằm trong `.local/benchmark-smoke.json` hoặc `.local/benchmark.json`.

Gate theo từng cặp: HTTP và Socket p95 tăng <=5%, RSS tăng <=20 MiB. RSS lấy từ `/proc/1/status` trước/sau đo, không phải RSS peak. Độ trễ tính cả vòng mạng local. Docker Desktop/host contention ảnh hưởng kết quả. Full benchmark này chưa bao gồm mọi cấu hình sampling/slow transport trong M0; không có Loki worker để đo. Kết quả fail hoặc smoke không cho phép bật Cloud hay khẳng định đạt gate M4.

## Dừng và khôi phục

```sh
npm run monitoring:down
```

Lệnh này giữ volume DB/Grafana/Prometheus. Không tự chạy `down -v` vì sẽ xóa dữ liệu local. `monitoring:init` không ghi đè credential đã có. Dashboard JSON được quản lý bằng git; thay đổi UI cần export và review trước khi đưa vào repo.

Tham khảo cấu hình chính thức: [Prometheus configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/), [Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/).
