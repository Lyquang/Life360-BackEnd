# Grafana: cổng quyết định M0

## Chốt sau duyệt M0 (2026-10-26)

C local trước, A sau approval M5 riêng và chủ dự án đọc Terms/DPA. Prom-client scrape 60s, bearer riêng và gzip. Staging bằng Docker Compose, không thêm Render service. Pino JSON stdout; Loki/worker hoãn đến sau benchmark CPU/RSS M4. Không Sentry/traces; cảnh báo email. Payload sampling 1/10; p95 overhead <=5%, RSS <=+20 MB; đo baseline trước metrics. Budget 2.000–2.500 series/env. Server luôn sinh requestId mới. Các đề xuất khác bên dưới chỉ có hiệu lực nếu không trái các quyết định này.

Ngày nghiên cứu: 2026-10-26. Chưa chọn nhà cung cấp, chưa tạo tài khoản, token hoặc pipeline xuất dữ liệu. Mọi giá trị dưới đây là đề xuất trừ thông tin có nguồn.

## So sánh

| Phương án | Lưu trữ và pipeline | Chi phí / vận hành | Riêng tư và sự cố |
| --- | --- | --- | --- |
| A: Grafana Cloud Free | Hosted Metrics Endpoint scrape HTTPS; Loki nhận log JSON gom lô từ worker sau M3 | Free trong quota; không cần collector riêng; phụ thuộc Internet | Chỉ telemetry đã lọc rời Render; mất mạng gây mất mẫu/log, không chặn nghiệp vụ |
| B: tự host | VPS riêng: Prometheus scrape + Loki + Grafana + collector | Ước lượng ngân sách 10–30 USD/tháng, chưa phải báo giá; cần disk, backup, TLS, vá lỗi | Chủ động nơi lưu; tự chịu trách nhiệm vận hành và khôi phục |
| C: local trước | Docker Compose, Prometheus scrape backend dev, log qua collector local vào Loki | Không phí SaaS; tốn RAM/disk máy phát triển | Không xuất dữ liệu ra Cloud; máy tắt thì không có giám sát production |

Render Free không phù hợp để tự host kho metrics/log: disk không bền vững và dịch vụ có thể ngủ. C luôn được thực hiện ở M4 và là đường lui khi A/B chưa duyệt.

## Thông tin Cloud đã kiểm chứng

Free: 10.000 active series, 50 GB log ingest/tháng, retention 14 ngày, 3 active visualization users/tháng. Pro bắt đầu 19 USD/tháng cộng usage; không tự chuyển Pro. Đây không phải quota theo từng người dùng ứng dụng. [Giá chính thức](https://grafana.com/pricing/).

Hosted Metrics Endpoint scrape URL công khai, hỗ trợ Basic hoặc Bearer; interval mặc định 1 phút. Interval thấp hơn tăng datapoints/minute và có thể ảnh hưởng chi phí. Chưa kiểm chứng giới hạn DPM/API ingest cụ thể của stack chưa tạo; phải xem limits/usage trước M5. [Hướng dẫn chính thức](https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-infrastructure/integrations/integration-reference/integration-metrics-endpoint/).

Có vùng Singapore AWS ap-southeast-1. Cần xác nhận region stack thực tế và phạm vi residency, backup/subprocessor trước shipping; không suy ra mọi xử lý đều nằm Singapore chỉ từ endpoint. [Regions](https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/account-management/regional-availability/).

Token shipping chỉ cấp scope `logs:write` hoặc `metrics:write` theo pipeline, giới hạn realm một stack, có hạn dùng; token provisioning dashboard là service account riêng. Scrape dùng token do backend kiểm tra, không dùng JWT người dùng. [Access policies](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/).

Trước M5 chủ dự án phải xem Terms/DPA/subprocessors và chấp nhận phạm vi dữ liệu xuất đi; chưa thực hiện đánh giá pháp lý hay chấp thuận thay chủ dự án. [Legal](https://grafana.com/legal/), [DPA](https://grafana.com/legal/data-processing-agreement/).

## Scrape hay push

- Đề xuất `prom-client` + hosted scrape mỗi 60 giây: phù hợp registry pull, dễ test bằng Prometheus local. Không cần tự viết remote-write protobuf/snappy.
- Push OTLP: cần SDK/exporter OpenTelemetry, flush và queue có trần; vẫn mất dữ liệu khi process bị kill. Prometheus exposition text không thể POST trực tiếp thành remote-write. Nếu chọn push, điều chỉnh M1 trước khi code.
- Push log: worker HTTP batch tới Loki, timeout/backoff/jitter, queue có trần và drop counter. Không dùng filesystem Render làm spool bền vững. M3 stdout trước, M5 mới shipping.
- Scrape có inbound traffic nên có thể ảnh hưởng chu kỳ ngủ của Render; push không thay thế inbound traffic. Không coi UptimeRobot là SLA. Scrape thất bại cần phân biệt target ngủ, cold-start và pipeline lỗi.
- Counter reset khi restart: dùng `rate()`/`increase()`, không lấy hiệu hai giá trị thô. Mẫu phát sinh rồi mất trước scrape không khôi phục được. Push cũng không đảm bảo exactly-once.
- Prometheus/OpenMetrics, Loki JSON và dashboard datasource UID biến hóa giúp đổi provider; không hứa dashboard tự tương thích hoàn toàn với mọi backend OTLP.

[Render Free](https://render.com/docs/free): ngủ sau 15 phút không có inbound traffic, filesystem tạm. [Compute plans](https://render.com/docs/compute-plans): Free 512 MB RAM, 0.1 CPU. Chưa truy cập dashboard để xác nhận service hiện tại.

## Đề xuất để chủ dự án chọn

1. A sau khi hoàn thành C/local và privacy tests; B chỉ khi có nhu cầu tự quản residency.
2. Prom-client, scrape 60 giây, bearer riêng trong Render Environment và secret cấu hình scrape; không commit giá trị.
3. Pino JSON stdout, info tổng hợp + warn/error; Loki shipping opt-in sau duyệt, retention tối đa 14 ngày trên Free (muốn ít hơn phải kiểm chứng tính năng stack).
4. Chưa thêm traces/Sentry. Backend chưa có Sentry; nếu bổ sung sau, Sentry phụ trách exception/trace đã lọc, Grafana phụ trách aggregate metrics/log.
5. Kênh cảnh báo đề xuất email vận hành; người nhận chờ chọn, không tạo contact point ngoài hệ thống lúc M0.
6. Staging riêng dùng dữ liệu tổng hợp, env riêng và ngân sách series chung với production.
7. Lấy mẫu payload 1/10 ban đầu; so sánh với 1/1 và tắt để quyết định bằng benchmark.

Quyết định cần trả lời: A/B/C; scrape/push và thư viện; Loki/level/retention; bearer/basic; traces; kênh/ngưỡng cảnh báo; staging; sampling. `approved M0` không tự đồng nghĩa đồng ý xuất dữ liệu ra Cloud nếu provider chưa chọn.
