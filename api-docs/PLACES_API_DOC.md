# Circle places và nhãn mục đích cá nhân

Implemented backend, 2026-11-13; chưa claim deployed/Mobile UI. Base `/api/v1`.
Owner: [spec](../specs/features/favorite-places/spec.md),
[contract](../specs/features/favorite-places/contracts.md),
[verification](../specs/features/favorite-places/verification.md).
OpenAPI chạy thật tại `/api-docs.json`, UI `/api-docs`.

## Auth và quyền

Mọi request dùng `Authorization: Bearer <accessToken>`. Người đang là thành viên
Circle có thể tạo/list/get nơi chung và quản lý nhãn **của chính mình**. Chỉ creator
hoặc admin hiện tại được PATCH/DELETE nơi chung; creator rời Circle cũng mất quyền.
Không gửi `userId`, `ownerId`, `addedBy` trong payload mới. Place phải thuộc group
trên URL; ID của place Circle khác trả 404. Nhãn không có API đọc/sửa của người khác.

## Endpoint registry

| Method và path (sau /api/v1) | Request | Success |
|---|---|---|
| POST `/groups/:groupId/places` | name,category,latitude,longitude | 201 `{success,message,data:Place}` |
| GET `/groups/:groupId/places` | Không query | 200 `{success,count,data:Place[]}` newest first |
| GET `/groups/:groupId/places/:placeId` | Không body | 200 `{success,data:Place}` |
| PATCH `/groups/:groupId/places/:placeId` | revision và ít nhất một field được sửa | 200 `{success,data:Place}` |
| DELETE `/groups/:groupId/places/:placeId?revision=N` | revision trên query, không body | 200 `{success,data:{id,deleted:true}}` |
| GET `/groups/:groupId/me/place-labels` | Không body | 200 `{success,count,data:Label[]}` sort theo label |
| PUT `/groups/:groupId/me/place-labels/:label` | placeId, customLabel chỉ khi custom | 200 `{success,data:Label}` |
| DELETE `/groups/:groupId/me/place-labels/:label` | Không body | 200 `{success,data:{label,removed:boolean}}` |

Không thêm socket event hoặc pagination mới. List places giữ hành vi cũ; label
list tối đa 4 entries, một entry mỗi key trong một user/Circle. List places không
được xem như toàn bộ POI search hoặc dữ liệu vị trí hiện tại.

## Fields

Place có `id`, `groupId`, `name`, `category`, `location`, `latitude`, `longitude`,
`addedBy`, `revision`, `createdAt`, `updatedAt`. IDs là chuỗi MongoDB 24 hex; dates
ISO 8601 UTC. `addedBy` là object có `id,name,email,avatar` tùy dữ liệu user, hoặc
null nếu tài khoản không còn; không phải caller được phép đổi ownership.
GeoJSON `location={type:"Point",coordinates:[longitude,latitude]}` vẫn được giữ
cho client cũ, cùng tọa độ phẳng. Mẫu tọa độ bên dưới là dữ liệu tổng hợp.

Create: `name` trim 1..100; category giữ enum cũ
`restaurant|entertainment|cafe|shopping|other`; lat [-90,90], lng [-180,180]. Không
đổi category thành home/work. API cũ vẫn hoạt động; revision là field cộng thêm.

PATCH chỉ nhận name/category/latitude/longitude và revision. Tọa độ phải gửi cả
cặp; không nhận field lạ. `revision` là integer 0..9007199254740990, bắt buộc; mỗi
PATCH thành công tăng một. Place cũ thiếu revision được biểu diễn/so sánh là zero.
DELETE cũng bắt buộc revision. Không dùng createdAt/updatedAt thay CAS revision.

Label có `id,groupId,userId,label,placeId,customLabel,createdAt,updatedAt`;
`placeId` trong response là **Place object đã populate**, trong PUT input là ID.
`label` chỉ `home|work|leisure|custom`. Với custom, customLabel trim 1..50 bắt buộc;
nhãn khác không được gửi customLabel, response customLabel=null. Một key chỉ trỏ
một nơi; PUT thay nơi gắn key, không đổi nhãn của người khác hoặc toàn Circle.

## Ví dụ flow

1. User tạo nơi chung bằng POST hoặc chọn từ GET list. Việc search không tự lưu
   place; app chỉ POST sau hành động Lưu rõ ràng của người dùng.
2. User gán Nhà/Công ty/Đi chơi bằng PUT shortcut tương ứng:

```http
PUT /api/v1/groups/111111111111111111111111/me/place-labels/work
Authorization: Bearer <accessToken>
Content-Type: application/json

{"placeId":"222222222222222222222222"}
```

3. Mỗi tài khoản đọc GET `/me/place-labels` của chính mình. Hai thành viên có thể
   gán Công ty vào hai nơi khác nhau trên cùng danh sách địa điểm Circle.
4. Muốn sửa place, GET lấy revision mới rồi PATCH, ví dụ:

```json
{"revision":0,"name":"Văn phòng A","latitude":10.77,"longitude":106.7}
```

5. Khi xóa nơi chung, server xóa mọi nhãn đang trỏ tới nơi đó trong **cùng
   transaction**. Client refetch places/labels sau success; không giữ pin đã xóa.
   DELETE label chỉ gỡ shortcut của caller, không xóa nơi chung.

## Errors, retry và concurrency

Lỗi theo envelope chung `{success:false,code,message,...}`; DTO errors có `errors`
field/path theo middleware hiện có. Không dựa vào text message để phân nhánh.

| Status/code | Client xử lý |
|---|---|
| 400 VALIDATION_ERROR hoặc BAD_REQUEST | Sửa payload/ID/coords/label; không tự retry |
| 401 UNAUTHORIZED | Theo refresh/login flow hiện có |
| 403 FORBIDDEN | Membership hoặc quyền creator/admin không còn; bỏ cache quyền |
| 404 NOT_FOUND | Group/place không tồn tại trong scope; refetch, không đổi group tự động |
| 409 CONFLICT | Revision cũ; GET lại, trình user kiểm tra, không tự ghi đè thay đổi mới |
| 503 SERVICE_UNAVAILABLE | Mutation mới cần Mongo transaction; không retry dồn dập |

Các mutation mới (PATCH/DELETE place, PUT/DELETE label) yêu cầu replica set/mongos;
standalone dev bị từ chối trước ghi. Create/list cũ giữ hành vi hiện hữu. DELETE
label lặp trả removed=false khi không còn entry. PUT cùng body không tạo duplicate,
nhưng là last-write-wins: retry request cũ sau thao tác mới có thể đổi shortcut lại;
app phải hủy/loại request lỗi thời. PATCH/DELETE place dùng revision; retry sau
success có thể nhận 409/404 và cần refetch. POST create chưa có request-id dedup;
không tự gửi lại vô hạn sau timeout không rõ kết quả.

Membership write guard serialize mutation với leave/remove; không dùng cache
membership làm bằng chứng ghi. Label riêng được giữ khi rời để phục hồi sau rejoin,
nhưng mọi read/write bị từ chối trong thời gian không còn membership. Xóa place
thì label tham chiếu bị xóa hẳn. Không dùng label cache để suy quyền hiện tại.

## Giới hạn revision A và phần mở rộng bên dưới

Revision A ban đầu chỉ quản lý places/labels; snapshot auto-presence của revision B
được mô tả bên dưới. Vẫn chưa có radius-setting API, background GPS consent mới,
arrival/departure notifications hoặc Mobile UI nối API này. Không suy “đang ở Nhà”
từ việc một user có shortcut home. Pause location hiện có không được thay đổi ở
đợt này. Không lưu POI provider data mới; user nhập pin/tọa độ theo quyền ứng dụng.
Device/production/index rollout QA vẫn tách khỏi kiểm thử backend cục bộ.

## Chức năng 2 — snapshot nơi đang ở từ GPS (backend implemented)

`GET /api/v1/groups/:groupId/place-presence?limit=20&cursor=<lastUserId>`.
Bearer auth, caller phải đang thuộc Circle. limit integer1..100, default20;
cursor Mongo ObjectId, member IDs sort tăng. Đây là live pagination, không phải
snapshot token cố định; refresh từ đầu khi membership thay đổi.

```json
{
  "success": true,
  "count": 1,
  "data": [{
    "userId": "333333333333333333333333",
    "status": "at_place",
    "place": {"id":"222222222222222222222222","name":"Văn phòng A","label":"work","customLabel":null},
    "sourceFixAt": "2026-11-13T02:00:00.000Z",
    "expiresAt": "2026-11-13T02:05:00.000Z"
  }],
  "pagination": {"hasMore":false,"nextCursor":null}
}
```

Nếu không xác định được, row chỉ còn userId, `status:"unknown"`, `place:null`,
`sourceFixAt:null`, `expiresAt:null`. Không lấy saved shortcut để tự đổi unknown
thành “Ở Nhà”, không biến ngoài vùng thành “Đi chơi”. Không trả raw GPS, toàn bộ
nhãn riêng của thành viên hoặc lý do riêng tư để đoán người đó đã pause.

Điều kiện backend hiện tại: original recordedAt đủ mới, accuracy<=50m, fixes liên
tục không gián đoạn quá90s, ở trong bán kính100m khoảng120s. Có hysteresis ra vùng
150m; uncertainty radius được tính, overlap không rõ → unknown. Đây là policy
thử nghiệm, không cam kết GPS chính xác100m. Không có radius-setting API đợt này.

Mobile vẫn gửi `update_location` như cũ; để trở thành bằng chứng presence, **cần
recordedAt gốc và accuracy**. Thiếu thông tin/recordedAt fallback/batch offline
không tạo xác nhận live mới. Projection chạy sau xử lý GPS bình thường khi point
được persist; không có socket event presence mới hoặc ack riêng. `location_update`
không chứng minh projection đã commit. Đề xuất UI poll snapshot mỗi20–30s khi xem
Circle, xử lý offline/loading và unknown; vòng poll/device/battery cần mobile QA.

Presence hết hiệu lực sau5 phút không có evidence mới; read luôn kiểm tra lại
privacy/membership/label/place, không chờ TTL dọn dữ liệu. Pause Circle ẩn label
ngay khi snapshot revalidate; resume cần evidence mới. Join/leave bất kỳ thành viên
đổi membership epoch của Circle nên các label cũ trong Circle tạm unknown cho tới
khi có dwell mới. Sửa place, gán lại/xóa label hoặc xóa place cũng làm context cũ
không hợp lệ. Một HTTP response đã gửi hợp lệ không thể bị server thu hồi; client
phải bỏ cache khi nhận membership/privacy update và khi expiresAt đã qua.

403 khi caller mất membership,404 khi group không tồn tại lúc bắt đầu,400 khi
query sai,401 khi chưa auth. Nếu member rời trong lúc phân trang, page có thể ít
rows hơn limit; tiếp tục theo nextCursor hoặc refresh. Self-only GPS trong lúc
pause không được dùng cho endpoint Circle này; backend chưa thêm kênh personal
GPS/consent mới. No device/production rollout claim; đây là client integration
contract cho backend đã kiểm chứng.

Pause Circle ẩn vị trí/nhãn hiện tại; không tự xóa các địa điểm chung đã lưu trong Circle. Những địa điểm đó vẫn theo quyền membership của API quản lý places.
