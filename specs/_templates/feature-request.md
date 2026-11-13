# Prompt tùy chọn khi yêu cầu tính năng

Bạn chỉ cần mô tả tính năng bằng lời bình thường; agent phải tự theo AGENTS.md.
Không cần điền form kỹ thuật hoặc viết lại toàn bộ quy trình mỗi lần.

```text
Tôi muốn thêm/cập nhật tính năng: <mô tả mục tiêu của bạn>.

Hãy đọc AGENTS.md và specs liên quan trước. Tái sử dụng folder chức năng hiện có;
nếu là chức năng mới, tạo folder rõ nghĩa trong specs/features/ và đăng ký mục lục.

Hỏi tôi các câu hỏi cụ thể theo từng vòng để làm rõ yêu cầu, gồm tình huống thực tế,
phạm vi, quyền, dữ liệu và lỗi khi có liên quan. Ghi câu trả lời đã xác nhận và câu
hỏi còn mở; không đoán business rules hoặc hỏi lại thông tin đã có.

Viết spec với acceptance criteria, plan và tasks cụ thể theo templates của repo.
Gửi đường dẫn plan để tôi đọc, chốt requirements/phạm vi và duyệt trước khi code.
Sau khi tôi duyệt đúng plan/phạm vi đó, hãy triển khai mà không hỏi bắt đầu lần nữa.

Khi hoàn thành: chạy kiểm tra phù hợp, cập nhật specs/tasks/PROGRESS, viết hoặc cập
nhật api-docs cho frontend/mobile và Study để giải thích kiến thức hữu ích. Nếu
không có API mới, ghi rõ lý do thay vì tạo API giả. Nêu kết quả thực tế và giới hạn.
```
