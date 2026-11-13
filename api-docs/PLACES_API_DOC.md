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

## Giới hạn đợt này

Chưa có auto-presence/geofence, radius, dwell engine, background GPS consent mới,
arrival/departure notifications hoặc Mobile UI nối API này. Không suy “đang ở Nhà”
từ việc một user có shortcut home. Pause location hiện có không được thay đổi ở
đợt này. Không lưu POI provider data mới; user nhập pin/tọa độ theo quyền ứng dụng.
Device/production/index rollout QA vẫn tách khỏi kiểm thử backend cục bộ.
