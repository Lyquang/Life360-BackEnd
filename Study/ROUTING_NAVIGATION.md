# Tìm tuyến TomTom v1: những điều cần nhớ

Status: Backend preview **implemented locally**; iOS navigation chưa được xác
nhận hoàn tất (2026-11-14). [Spec](../specs/features/routing/spec.md) ·
[API cho Mobile](../api-docs/ROUTING_API_DOC.md).

## Luồng dữ liệu

Mobile gửi origin, destination và mode tới Backend. Zod chặn field lạ/toạ độ
sai; JWT và limiter áp dụng trước khi gọi provider. Use case gọi adapter TomTom
v1 rồi chuẩn hóa geometry, maneuvers, modeSections và traffic. Key chỉ ở Backend,
không trả trong DTO. Backend không tạo/lưu chuyến; Mobile sẽ giữ route đang đi
trong bộ nhớ của account hiện tại.

## Vì sao cần modeSections và coded maneuvers

Một tuyến `motorcycle` có thể chứa đoạn `TRAVEL_MODE=other`; trong mẫu Hà Nội
đã gặp trường hợp này. Trả nguyên đoạn trong DTO cho Mobile là cách giữ sự
không chắc chắn của provider, để UI cảnh báo đúng. `other` không đồng nghĩa
với walking. Provider từng trả câu tiếng Anh dù request `vi-VN`, nên Mobile
phải dịch các maneuver code đã biết thành câu nói vi/en và im lặng với code lạ,
tránh hướng dẫn rẽ sai.

Walking từng có `trafficDelayInSeconds=0`; số 0 ấy không chứng minh đường
không kẹt. Adapter đánh dấu traffic walking `unavailable`. `fetchedAt` chỉ
là thời điểm Backend hoàn tất request; không phải thời điểm đo traffic upstream.

## Giới hạn và điểm dễ sai

- TomTom motorcycle v1 là BETA. HTTP 200 và geometry hợp lệ không chứng minh
  đường hợp pháp/đi được bằng xe máy. Cần kiểm tra hiện trường Việt Nam.
- Route id là index của response, không bền qua lần tính lại. Một callback cũ
  không được thay route revision mới trong Mobile.
- 429 có thể do quota upstream hoặc giới hạn người dùng. Không tự retry dồn dập
  hay bật gói trả phí. Request đã gửi upstream có thể vẫn tính quota nếu Mobile
  ngắt kết nối.
- Không log URL upstream vì URL chứa cả key và tọa độ. Adapter chỉ phát lỗi
  đã chuẩn hoá, không đưa raw response lên client.
- Offline chỉ tiếp tục route đã nạp trong tiến trình app; không có offline
  basemap hay offline reroute.

## Kiểm chứng

Ngày 2026-11-14: `node --test tests/routingPreview.test.js` kiểm tra mode
mapping, `other`, walking traffic, phản hồi lỗi và HTTP auth/validation/limit.
Một lệnh adapter với hai tọa độ công khai Hà Nội nhận 3 route; đây là mẫu
feasibility, không phải thử nghiệm điều hướng trên thiết bị hay xác nhận
điều khoản tài khoản.
