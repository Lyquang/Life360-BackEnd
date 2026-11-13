# Từ ý tưởng tính năng đến code có thể kiểm chứng

Date: 2026-11-12 | Scope: quy trình agent được yêu cầu trong repo này.
Quy tắc thực thi: [AGENTS.md](../AGENTS.md). [Feature registry](../specs/README.md).
Đây là giải thích để học cách sử dụng quy trình, không phải một bộ quy tắc thứ hai.

## Spec Kit chính thức trong repo

Repo đã cài official Specify CLI 1.4.0 và Codex skills. Cách dùng/lifecycle nằm ở
[hướng dẫn Spec Kit](../codex/spec-kit/README.md); bằng chứng kiểm tra ở
[setup report](../specs/system/spec-kit-setup.md). Native spec/plan/tasks giữ cấu
trúc mặc định, còn local preset thêm quy tắc backend bằng composition. Khi sửa
policy, sửa nguồn `codex/spec-kit/backend-policy/` rồi dùng CLI refresh, tránh sửa
generated skills khiến lần cập nhật sau mất thay đổi.

Hai quyết định khác nhau cần con người: xác nhận **requirements** trước thiết kế,
và duyệt **implementation** sau plan/tasks/analyze. `progress.md` giữ authority,
scope và hashes bản được đọc; trạng thái AWAITING_APPROVAL không phải lỗi agent.
Nó ngăn một bản plan chưa duyệt biến thành code. Native gate không có TTY sẽ pause;
fixture setup xác minh reject không chạy bước sau, approve chỉ cho marker tạm.
Đây không phải approval cho feature thật, cũng không phải security sandbox.

Một chi tiết thực tế: system Python của môi trường này không có PyYAML, trong khi
native Bash helpers cần nó để compose presets. Tool venv có dependency đó; dùng
`SPECKIT_PYTHON_EXECUTABLE` đúng đường dẫn như hướng dẫn thay vì sửa core script
hoặc cài package lẫn vào app. Local launcher xuất biến này cho subprocess; direct
agent helper calls phải truyền lại vì môi trường giữa tool calls có thể không giữ.

`verification.md` giữ kết quả thật, `interview.md` giữ câu trả lời, spec giữ intent,
Study giữ giải thích. Feature `study.md` có thể link bài trong `Study/` để tránh
hai bản cùng cơ chế bị lệch. Native converge chỉ append việc còn thiếu vào tasks;
nó không sửa requirements để hợp thức hóa implementation sai. Nếu còn gaps thì
quay lại thực hiện/kiểm chứng trong scope đã duyệt, thay đổi scope phải review lại.

## Vì sao cần làm rõ trước khi code?

“Thêm thông báo khi tới địa điểm” có thể mang nhiều nghĩa: thông báo cho chính
người đó, cho mọi Circle, khi app đang mở hoặc khi chạy nền, dựa vào một điểm GPS
hay một khoảng đứng yên. Mỗi lựa chọn dẫn đến quyền, dữ liệu và kiểm thử khác nhau.
Đây là ví dụ giả định để minh họa, không phải feature mới đã được yêu cầu/duyệt.

Vòng hỏi đầu có thể tập trung vào ba việc: ai nhận thông báo, lúc nào tính là
“đã tới”, và phạm vi quyền chia sẻ. Vòng sau hỏi về GPS cũ/sai, chạy nền, retry và
chống trùng. Chỉ hỏi phần chưa biết; không buộc người dùng chọn tên class hoặc
pattern kỹ thuật nếu agent có thể quyết định từ kiến trúc hiện có.

## Bốn loại thông tin khác nhau

| Loại | Ví dụ minh họa | Ý nghĩa |
|---|---|---|
| Intent | Muốn biết người thân tới nơi | Mục tiêu, chưa đủ để code |
| Requirement | User xác nhận ai được xem và điều kiện tới nơi | Hành vi cần đáp ứng trong phạm vi đã chốt |
| Plan | Thay đổi những lớp/file nào, xử lý lỗi và kiểm thử ra sao | Giải pháp cụ thể để user review |
| Evidence | Kết quả test/kiểm tra thực chạy | Chứng minh một phần behavior; không tự phê duyệt yêu cầu |

Một spec Draft không thành requirement đã duyệt chỉ vì agent viết rất chi tiết.
Ngược lại, khi user đã duyệt đúng plan/phạm vi, agent phải tiếp tục làm trong phạm
vi đó; hỏi “bắt đầu nhé?” lần nữa chỉ lặp quyết định cũ.

## Một lần bàn giao có ba góc nhìn

- **specs:** ý định/thiết kế đã chốt và các quyết định còn mở. Acceptance criterion nên mô tả kết quả quan sát được, rồi link tới kiểm chứng.
- **api-docs:** frontend/mobile cần gọi gì, gửi dữ liệu nào, xử lý lỗi/retry/recovery ra sao. Tránh bắt client đọc use case/repository để đoán contract.
- **Study:** cơ chế hoạt động và bài học cho người bảo trì. Ví dụ vì sao dùng unique index làm backstop, vì sao socket emit không chứng minh client đã nhận, hoặc vì sao cache không thay durable state. Từng bài phải có bằng chứng/giới hạn phù hợp, không mặc định mọi feature có cùng guarantee.

Giữ một owner cho contract/model rồi link giữa ba góc nhìn giúp tránh ba bản API
khác nhau. `CLAUDE.md` nay chỉ dẫn tới AGENTS/specs, thay vì giữ thêm một catalog
route/default/model dễ cũ khi source thay đổi.

## Một bài học thật từ lựa chọn nền tảng

[Place search plan](../specs/features/place-search/plan.md) được sửa sau khi biết
mobile dùng native MapKit. Search/history nằm trong Mobile, không cần tạo backend
proxy chỉ vì agent đang mở Backend. Đây là lý do phải kiểm tra repo/platform trước
chọn dependency hoặc áp một kiến trúc mẫu. Phần routing/weather vẫn có quyết định
riêng; search chạy không chứng minh mọi provider/mode đã được hỗ trợ.

Với feature không tạo interface backend, bàn giao API ghi N/A và lý do; không tạo
endpoint giả. Với backend client-facing mới, API guide là đầu ra thực sự cần có,
không phải lời hứa “có thể viết sau”.

## Cách bạn đưa yêu cầu lần sau

Chỉ cần mô tả tính năng mong muốn. Agent đọc AGENTS/specs, tự tìm owner, hỏi các
câu còn thiếu và gửi link plan để bạn đọc. Khi duyệt, chỉ rõ plan/phạm vi, ví dụ:
“Tôi duyệt requirements và plan revision X cho phần Y; hãy triển khai phần đó”.
Không cần điền prompt dài; [prompt tùy chọn](../specs/_templates/feature-request.md)
chỉ nhắc lại luồng khi cần chuyển qua một phiên/công cụ khác.

## Kiểm chứng thay đổi quy trình này

Lần cập nhật hiện tại chỉ sửa hướng dẫn/templates/index/docs, không sửa behavior
sản phẩm. Kiểm tra liên kết, tính nhất quán workflow và whitespace; không lấy kết
quả runtime tests cũ làm bằng chứng mới cho việc thay quy trình.
