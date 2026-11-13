# Vì sao địa điểm chung nhưng nhãn Nhà/Công ty phải thuộc từng người?

Implemented backend slice, 2026-11-13. [Spec](../specs/features/favorite-places/spec.md),
[API guide](../api-docs/PLACES_API_DOC.md),
[management tests](../tests/placeManagement.test.js), [presence tests](../tests/placePresence.test.js). Đây là giải thích cơ chế hiện có, không
phê duyệt các proposal GPS/navigation/weather chưa thực hiện.

## Tách ba khái niệm

`FavoritePlace` là một địa điểm được chia sẻ trong Circle: tên, loại POI, tọa độ
và người tạo. `category=cafe` chỉ nói loại địa điểm; với một người đó là nơi làm
việc, với người khác là nơi đi chơi. Nếu thêm `purpose=work` chung vào place rồi
hiển thị cho mọi thành viên, ta đã vô tình biến một lựa chọn cá nhân thành kết
luận cho cả nhóm.

`MemberPlaceLabel` vì thế gắn `(groupId,userId,label)` với một place thuộc Circle.
Hai người có thể cùng key work nhưng trỏ tới nơi khác nhau. Unique compound index
ngăn duplicate key ngay tại DB; Group guard còn giúp các upsert được serialize.
Một key có một giá trị trong Circle, PUT thay giá trị, DELETE gỡ nhãn. Key custom
có tên người dùng đặt, được kiểm tra riêng; không nhận ownerId từ client.

Khái niệm thứ ba là **presence**: đang thực sự ở đâu tại một thời điểm. Có label
home không có nghĩa đang ở nhà. Revision A chưa có presence engine, vì vậy không thêm
nhãn vào socket location hoặc lịch sử/digest để trông như đã nhận diện GPS. Đây
là ranh giới quan trọng khi xây tiếp dwell khoảng 2 phút và privacy khi pause.

## Revision giải quyết lost update thế nào?

Giả sử hai client cùng đọc place revision 0. Cả hai đều có quyền sửa, nhưng quyền
đúng không giải quyết được việc ghi đè. Repository dùng compare-and-swap:
điều kiện gồm group, place và revision mong đợi; update tăng revision trong cùng
thao tác DB. Người thắng nhận revision 1, request dùng revision 0 còn lại nhận 409.
Client phải đọc lại và cho người dùng xem thay đổi trước khi thử tiếp.

Model cũ không có revision được coi là zero. Chỉ khai báo default trong Mongoose
chưa đủ: query MongoDB `revision:0` không tự match document chưa có field. Repository
vì thế chấp nhận zero hoặc missing khi caller đưa zero. Kiểm thử thực sự unset
field rồi PATCH, thay vì chỉ thử document mới đã có default. Không cần migration
để dùng được các bản ghi cũ trong slice này.

## Transaction không tự loại mọi race về quyền

Nếu code chỉ đọc membership, rồi update place trong transaction, một transaction
khác có thể remove member trên document Group. Nếu hai transaction ghi hai document
khác nhau, snapshot cũ về membership có thể vẫn được dùng để ghi place. Đây là
lý do ta cần một điểm xung đột ghi chung.

`groupRepo.lockForPlaceWrite` kiểm tra member và tăng hidden `placeGuardVersion`
trên chính Group trong transaction. Leave/remove cũng ghi Group. MongoDB buộc một
transaction retry hoặc hoàn tất theo thứ tự; callback retry kiểm tra quyền lại.
Mọi mutation mới của places/labels dùng guard trước các thao tác liên quan. Đây
là tính tuần tự ở biên commit, không phải lời hứa có thể thu hồi một HTTP response
đã được đọc hợp lệ trước khi leave.

Tương tự, delete place và set label đều khóa Group. Nếu set commit trước, delete
xóa place và toàn bộ label trong transaction kế tiếp. Nếu delete commit trước,
set kiểm tra place và nhận 404. Kiểm thử đua hai request này rồi kiểm tra DB không
còn orphan labels. Khóa chung có chi phí: các place mutation trong một Circle
serialize với nhau; hợp lý cho tần suất quản lý địa điểm hiện tại, chưa phải thiết
kế tối ưu cho một stream GPS. Không đem guard này chạy trên mỗi điểm định vị.

## Vì sao fail closed với transaction mới?

Xóa place rồi xóa labels thành hai lệnh rời có thể để lại dữ liệu dở dang. Test
inject lỗi lúc cascade và kiểm tra place/label còn nguyên sau rollback. Trên Mongo
standalone, helper unitOfWork hiện hữu có fallback không atomic cho development;
những mutation mới chủ động trả 503 trước ghi thay vì giả vờ có guarantee giống
replica set. Endpoint create/list cũ giữ compatibility, không được suy rằng toàn
bộ mọi route trong backend đã có cùng guarantee.

## Tài liệu cũng cần kiểm chứng

JSDoc đúng cú pháp JavaScript không chứng minh Swagger đã đọc được operation.
Trong lần thực hiện này, YAML aliases do formatter tạo khiến operation/schema mới
không xuất hiện trong output swagger-jsdoc. Loại aliases và kiểm tra document
`/api-docs.json` thực được phục vụ đã khắc phục; regression test kiểm tra đủ sáu
operation và DTO schemas. Đây là bài học khác với test một file text có chứa tên
endpoint: client cần tài liệu thực được server xuất ra.

Đọc [verification](../specs/features/favorite-places/verification.md) cho commands,
counts và giới hạn chính xác. Test REST/replica set không chứng minh Mobile đã nối,
provider licence, QA thiết bị hoặc production indexes/deployment đã hoàn tất.

## Revision B: trạng thái nơi ở phải gắn với phiên bản quyền và dữ liệu

Backend hiện đã thêm projection `PlacePresence` và API snapshot; không còn chỉ
là shortcut. Hàm domain `advancePlacePresence` nhận input thuần, policy và đồng hồ,
trả candidate/confirmed hoặc bỏ qua điểm không hợp lệ. Điều này cho phép kiểm thử
2 phút trong vài milliseconds bằng fake source times, thay vì sleep120s.

Một điểm hợp lệ bắt đầu candidate, các điểm khác giữ cùng context qua khoảng120s
mới xác nhận; gap>90s hoặc accuracy không đủ làm mất continuity. Source time cũ
không được đè state mới, kể cả worker/request chạy khác thứ tự. Projection lưu DB
nên tạo use-case instance mới không mất state. Group guard tuần tự hóa competing
writes trong một Circle; snapshot không dùng durationTracker process-local để kết
luận đang ở nhà.

Điều dễ bỏ sót là timestamp **không phải version counter**. Hai thao tác privacy
có thể cùng giá trị Date milliseconds. Test cố ý pause và resume với cùng updatedAt:
chỉ so Date sẽ cho phép state cũ sống lại. `User.placePrivacyVersion` được tăng
nguyên tử, query snapshot đọc trực tiếp DB, nên state thuộc phiên bản trước không
thể trở lại chỉ vì enabled=true. Membership có version/time riêng; đây là global
Circle epoch, đổi thành viên cũng làm state các thành viên khác phải xác nhận lại.
Đánh đổi này được nêu trong API guide, ưu tiên unknown thay vì hiển thị sai.

Tương tự, label ID/updatedAt chưa đủ nếu PUT gán cùng key sang place khác trong
cùng millisecond. So cả place ID và revision. Query snapshot join lại label/place
hiện hành, vì TTL xóa projection vài phút sau không phải authorization. Model chỉ
lưu IDs/context/times, không có raw tọa độ hoặc collection lịch sử đi/đến mới.

Pipeline GPS cũ có lý do compatibility để fallback recordedAt sai sang server time.
Nếu lấy timestamp đã fallback làm evidence “mới”, điểm từ nhiều ngày trước có thể
thành “đang ở công ty”. Hook vì thế chuyển **original recordedAt** cho projection;
batch offline không gọi hook. Khi projection lỗi, GPS đã xử lý/broadcast vẫn thành
công; kiểm thử inject lỗi trực tiếp trên use-case được wiring thật để chứng minh.
Một sự kiện location_update cũng không phải ack state presence đã commit: UI cần
poll/revalidate snapshot thay vì tự ghép một label cũ vào tọa độ vừa nhận.

Chưa có Mobile UI/device QA, personal-location channel khi pause, arrival push hoặc
weather/navigation. Đó là các chức năng kế tiếp với quyền/nguồn dữ liệu riêng; không
dùng việc backend snapshot chạy đúng để suy ra cả trải nghiệm app đã hoàn thành.
