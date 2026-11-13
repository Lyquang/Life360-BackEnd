# Plan mở rộng: địa điểm theo mục đích và nhận diện trong Circle

Status: **Proposed — chưa hiện thực** | Date: 2026-11-12.
[Current spec](spec.md) · [Current contracts](contracts.md) · [Current model](data-model.md)
· [Tasks](tasks.md) · [Roadmap/authority](../../system/mobility-roadmap.md).
REQ-MOB-04/06 yêu cầu purpose, chia sẻ Circle và tự nhận diện nơi ở. Các field,
permission/default/acceptance bên dưới chờ duyệt, không sửa contract hiện hữu.

## Thiết kế sản phẩm

- `category` hiện có là loại POI; thêm `purpose` riêng đề xuất home/work/leisure/study/custom, không thay enum cũ bằng home/work làm client cũ lỗi.
- Địa điểm thuộc Circle và các thành viên được xem. Tên ví dụ “Nhà ông bà”, “Văn phòng A”; user chọn nơi áp dụng cho shortcut Nhà/Công ty của chính họ, tránh mặc định cả Circle làm chung công ty.
- Có create/list/detail/update/delete với quản lý quyền rõ. Đề xuất creator hoặc admin sửa/xóa, thành viên khác chỉ xem và gán shortcut cá nhân; admin không được thay shortcut cá nhân người khác.
- Auto presence là “đang ở địa điểm có nhãn X” theo geofence, không phải bằng chứng người dùng đang làm việc hay vui chơi. Ngoài vùng → none/unknown; không mặc định thành “đi chơi”. Nhãn do user đặt không phải suy luận AI.
- Chỉ hiển thị trong chính Circle chứa địa điểm; pause/leave/remove phải mất access và label ngay khi đọc/revalidate. Không dùng nhãn để tiết lộ địa chỉ riêng ở Circle khác.

## Proposed API/model extension

Giữ POST/GET `/groups/:groupId/places` và response cũ; thêm optional `purpose`,
`customPurposeLabel`, `radiusMeters`, `providerRef` khi cách lưu hợp lệ. Older
place thiếu purpose → mục đích chưa đặt, không tự gán home/work. Additive response
cần test strict client compatibility trước rollout.

Routes mới đề xuất dưới `/api/v1`:

| Method/path | Quyền/ý nghĩa |
|---|---|
| GET/PATCH/DELETE `/groups/:groupId/places/:placeId` | Current member đọc; creator/admin ghi theo đề xuất; optimistic revision cho edit/delete |
| PUT `/groups/:groupId/me/place-labels/:label` | Member tự gán home/work/... vào place thuộc chính Circle, label unique theo user/Circle; gỡ bằng DELETE cùng path |
| GET `/groups/:groupId/place-presence` | Member xem bounded/paginated current member presence hợp lệ của Circle; target privacy kiểm tra từng user, không lộ toàn bộ nơi lưu riêng |

API exact DTO/envelope/status chưa chốt. Bearer auth; no arbitrary addedBy/ownerId;
record ID và group ID phải ràng buộc cùng scope. Edit/delete membership phải được
kiểm tra trong transaction/guard để không race với leave; dùng existing patterns
thay vì chỉ check authorization trước mutation lâu dài.

Model `FavoritePlace` extension: purpose/custom label, recognition radius, revision,
provenance của tọa độ (user pin/user GPS/provider). Không persist Google detail hay
dùng provider-derived tọa độ cho geofence khi chưa xác nhận quyền sử dụng; xem
[research](../../system/mobility-research.md). Cho người dùng thả pin độc lập để
lưu user-authored place khi provider chưa cho phép lưu field tương ứng.

New proposed `MemberPlaceLabel`: groupId/userId/label/placeId, revision; unique
`(groupId,userId,label)`, enforce membership/place relation. New proposed
`PlacePresence`: groupId/userId/placeId/placeRevision, sourceFixAt, accuracy,
candidateSince/confirmedAt/expiresAt/revision; unique `(groupId,userId)`.
Đây là current projection, không tạo lịch sử tới/đi mới chưa được yêu cầu.

## Nhận diện và freshness đề xuất

Candidate radius 100m, giới hạn cấu hình 50–500m. Require fixes đủ mới/accuracy đủ
tốt, dwell >=2 phút và >=2 fixes trước confirm. Exit dùng hysteresis (radius+50m)
để GPS dao động không đổi nhãn liên tục; stale sau 5 phút → unknown. Giá trị cần
duyệt/tune; existing ingestion chưa có mọi field cần thiết thì bổ sung có contract.

Nếu nhiều vùng chồng nhau: ưu tiên nơi user đã gán shortcut, sau đó vùng nhỏ/điểm
gần nhất; tie chưa đủ rõ → unknown. Quy tắc này là Proposed, cần product review.
GPS ghi nhận muộn/offline không được thay current presence. Xử lý theo recordedAt,
ignore stale sourceFixAt, CAS tránh job cũ đè projection mới. Không gọi provider
trong geofence engine; pure geo calculation với tọa độ được phép sử dụng.

Pause, Circle exit, xóa/sửa place, ungán label phải invalidate projection; đọc API
luôn kiểm tra quyền/freshness/place revision hiện tại, không dựa TTL xóa đúng lúc.
Không thêm label vào digest/history có retention dài ở bản đầu để tránh làm rộng
Q-02 historical privacy. Optional user-room/Circle hint event chỉ chứa ID; fetch
snapshot có authorization, không broadcast stale label/address sau revoke.

## Files dự kiến và acceptance

Extend `src/application/places/placeUseCases.js`, `src/infrastructure/repositories/placeRepository.js`,
`src/infrastructure/database/models/FavoritePlace.js`, `src/presentation/dto/group.schemas.js`,
`src/presentation/http/routes/groupRoutes.js`, `src/presentation/http/controllers/groupController.js`.
New pure geofence helper và placePresence use cases/repos/models; wire container,
GPS/privacy/group membership hooks. Không làm thay đổi direct chat REQ-CHAT-01.

- AC-PLACE-01: Client cũ tạo/list restaurant/cafe vẫn được, place cũ không bị tự đổi purpose; purpose mới lưu hiển thị đúng.
- AC-PLACE-02: Cross-Circle/read/write và sửa label người khác bị từ chối; creator/admin quyền như thiết kế đã duyệt; race leave/edit không ghi trái phép.
- AC-PLACE-03: Nhận diện dwell/hysteresis/accuracy đúng khi replay synthetic GPS; một fix nhảy hoặc điểm cũ không chuyển nhãn; overlap deterministic hoặc unknown.
- AC-PLACE-04: Pause/stale/leave/delete/edit/label reassignment loại projection lỗi; user rời Circle không còn xem nhãn; người còn Circle chung khác không lộ nơi thuộc Circle đã rời.
- AC-PLACE-05: Presence chỉ địa điểm, không tự khẳng định hoạt động “đi chơi”; UI có updatedAt/unknown; không đưa nhãn vào digest lịch sử.
- AC-PLACE-06: Mobile lưu được từ search hoặc pin/current GPS hợp lệ với provenance; không sao chép provider data trái storage policy.

Tests đề xuất: mở rộng `tests/api.test.js` cho tương thích; new
`tests/placePurpose.test.js`, `tests/placePresence.test.js`,
`tests/placePresencePrivacy.test.js` và Mongo transaction race. Existing
`tests/locationSharingPrivacy.test.js`/`tests/circleExitPrivacy.test.js` là regression
liên quan, chưa chạy cho thiết kế. Native GPS cần device E2E theo roadmap P3/P4.
