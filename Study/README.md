# Study — tài liệu để con người hiểu và học từ code

Folder này giải thích cơ chế, lý do thiết kế, đánh đổi, tình huống lỗi và kiến thức
hữu ích của một feature. Nó **không thay thế** [yêu cầu/thiết kế đã duyệt](../specs/README.md)
hoặc [hướng dẫn tích hợp API](../api-docs/README.md).

## Cách duy trì

- Với mỗi substantial feature hoàn thành, viết/cập nhật note có ý nghĩa tại đường dẫn đã ghi trong plan, theo [template](../specs/_templates/study.md). Nếu chủ đề đã có note, ưu tiên cập nhật/link đúng owner.
- Giải thích bài toán thật, flow trong source, vì sao chọn cách đó, cơ chế dễ hiểu nhầm, invariants và cách đã kiểm chứng. Dẫn file/test liên quan; không chép nguyên spec hoặc source.
- Phân biệt implemented observation, historical note, inference và proposed experiment. Những plan/provider/rollout chưa duyệt vẫn là đề xuất, không thành source of truth vì nằm trong Study.
- Không bịa bug đã gặp, phương án đã thử, đóng góp con người/AI hoặc kết quả test. Bài tập là tùy chọn và phải ghi tác động nếu chạy lệnh có side effects.
- Bug/doc fix nhỏ không cần một bài giảng mới: cập nhật bài liên quan hoặc ghi rõ không có kiến thức mới cần note. Không tạo file rỗng/filler.

## Một số điểm đọc

| Chủ đề | Tài liệu |
|---|---|
| Làm việc với agent từ ý tưởng đến bàn giao | [Spec-driven workflow](SPEC_DRIVEN_WORKFLOW.md) |
| Các lớp và data flow backend | [Core backend flows](CORE_FLOWS_BACKEND.md) |
| Offline batch và retry/idempotency | [Offline location batch sync](OFFLINE_LOCATION_BATCH_SYNC.md) |
| Cache và durable correctness | [Redis/cache architecture](REDIS_PERFORMANCE_AND_CACHING_ARCHITECTURE.md) |
| Privacy và Circle exit | [Live Trail privacy](LIVE_TRAIL_PRIVACY_AND_CIRCLE_EXIT.md) |
| Token/session lifecycle | [Refresh token rotation](refresh-token-rotation.md) |
| SOS transactions/outbox | [SOS group chat assistance](SOS_GROUP_CHAT_ASSISTANCE.md) |

Các link trên là điều hướng; đọc status/lịch sử trong từng bài và đối chiếu feature
spec/source hiện tại. Việc lập mục lục không xác nhận lại mọi nhận định trong bài cũ.
