# Nghiên cứu provider và giới hạn mobile

Date: 2026-11-12 | **Research, không phải lựa chọn provider đã duyệt**.
[Roadmap](mobility-roadmap.md). Chỉ đọc tài liệu công khai; không gửi source/GPS/token
của repo ra ngoài, không gọi API dự báo hay tính tuyến, không kiểm chứng account/billing.

## Kiểm chứng thêm ngày 2026-11-13 — navigation và free-only

User xác nhận Việt Nam trước, chưa bật tính phí và dẫn đường từng ngã rẽ/giọng
nói trong app. Đây là requirements; chưa có provider được chọn để đáp ứng tất cả.

- Google Navigation SDK for iOS yêu cầu billing được bật. Vì vậy ứng viên này hiện
  không thỏa ràng buộc chưa bật billing, dù quota/allowance có thể giới hạn mức dùng.
  Không bật tài khoản/billing hoặc gọi endpoint để thử.
  [Official usage/billing](https://developers.google.com/maps/documentation/navigation/ios-sdk/pricing).
- Apple công bố MKRoute.Step cho chỉ dẫn theo bước và transport types; danh sách
  hiện hành không có mode motorcycle riêng. Suy luận thiết kế: có step/polyline
  chưa chứng minh đã có hệ thống in-app voice/navigation đúng cho xe máy tại Việt
  Nam. Không dùng automobile như motorcycle. Availability đúng iOS16, coverage,
  audio/background/reroute và điều kiện dùng dữ liệu vẫn cần kiểm chứng.
  [Route steps](https://developer.apple.com/documentation/mapkit/mkroute/step),
  [Transport types](https://developer.apple.com/documentation/mapkit/mkdirectionstransporttype).

- Open-Meteo public free API dành cho non-commercial use; user đã xác nhận thử nghiệm cá nhân/nội bộ chưa thương mại (REQ-MOB-25).
  Điều này chưa tự chứng minh ứng viên đáp ứng nowcast/coverage hoặc mọi điều kiện dùng.
  [Official pricing](https://open-meteo.com/en/pricing).
- Open-Meteo nêu dữ liệu 15 phút ngoài Central Europe/North America là nội suy từ
  hourly models. Suy luận cho Việt Nam: không coi chuỗi nội suy này là bằng chứng
  nowcast mưa 30 phút đã đủ chính xác. Cần đánh giá nguồn/model và giới hạn cụ thể.
  [Official docs](https://open-meteo.com/en/docs), [overview](https://open-meteo.com/).

Không kết luận mọi giải pháp miễn phí đều bất khả thi; chưa hoàn tất so sánh SDK/
provider. Các đề xuất Google Routes phía dưới là research lịch sử, chưa được duyệt
và không tự đáp ứng in-app voice/free-only. Ngưỡng weather/traffic và nguồn nowcast
30 phút cho Việt Nam cũng chưa được lựa chọn hoặc kiểm thử live.

## Search và bản đồ

**Cập nhật platform đã xác minh, 2026-11-12:** user cung cấp Mobile path và xác
nhận MapKit. Lượt đọc có mục tiêu kiểm chứng LiveTrailMapView/RouteMapView dùng
MKMapView, HistoryView dùng SwiftUI Map, ReverseGeocoder dùng CLGeocoder;
AI_RULES/project config xác nhận native Swift, iOS16. Không còn giả định app là
React Native hoặc cần chọn một Google/Mapbox SDK mới. Các đoạn Google dưới đây là
research ứng viên trước đó, không phải quyết định tích hợp native hiện tại.

Apple có MKLocalSearchCompleter cho gợi ý và MKLocalSearch.Request cho natural-
language query hoặc selected completion. Đề xuất search trực tiếp trong native
adapter, trả model thuần Swift về use cases; giữ native objects ngoài Domain.
Không cần backend search proxy/Google key cho slice này. Kiểm tra API availability
iOS16; region không mặc định là hard country filter.
[Completer](https://developer.apple.com/documentation/mapkit/mklocalsearchcompleter),
[Search request](https://developer.apple.com/documentation/mapkit/mklocalsearch/request).

Apple hỗ trợ requestsAlternateRoutes khi có tuyến phù hợp; transport type công bố
có automobile/walking/transit/cycling nhưng không motorcycle riêng. Không diễn
giải automobile là tuyến an toàn/hợp lệ cho xe máy, và không coi native search
là giải pháp cho backend traffic polling. Future routing provider cần kiểm tra
coverage và quyền hiển thị trên Apple Maps trước chốt.
[Alternate routes](https://developer.apple.com/documentation/mapkit/mkdirections/request/requestsalternateroutes),
[Transport types](https://developer.apple.com/documentation/mapkit/mkdirectionstransporttype).

Không áp quota Maps Server API cho native SDK hoặc hứa native unlimited; xử lý
throttled errors theo API. Cache lịch sử chỉ query người dùng thay vì serialize
Apple POI content vô hạn. Saving Apple-supplied fields vào Circle cần review
điều kiện sử dụng riêng, không suy từ quyền cache Google placeId.

Google Places có autocomplete, detail và tìm kiếm text/nearby. Session token liên kết
chuỗi gõ tìm kiếm với lần chọn detail; abandoned session không tự trở thành miễn phí.
Field mask và số lần gọi ảnh hưởng chi phí. [Overview](https://developers.google.com/maps/documentation/places/web-service/op-overview), [session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing).

Khi dùng Google Places phải thiết kế đúng attribution, bề mặt bản đồ và điều kiện
lưu/cache nội dung; place ID có ngoại lệ riêng. Không mặc định được sao chép vĩnh viễn
tên/địa chỉ/tọa độ provider sang DB geofence. Đề xuất lưu nhãn/tọa độ người dùng tự
đặt độc lập với POI reference; dữ liệu từ provider chỉ lưu khi cách sử dụng được cho phép.
[Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).

Đây là ràng buộc thiết kế cần kiểm tra trước P0; không tạo middleware cache chung
cho mọi API maps. Không chọn Google Places rồi mặc định render kết quả trên bản đồ
khác. Tên “như Google Maps” là yêu cầu UX, không phải người dùng đã chọn vendor.

## Routing và traffic

Routes API có route polyline và traffic intervals. Traffic-aware polyline dùng
các nhóm tốc độ; khả năng này và lựa chọn phương tiện ảnh hưởng billing. Cần kiểm tra
chi tiết đoạn đường, mode và freshness, không suy từ hình vẽ tuyến sang có traffic.
[Traffic polylines](https://developers.google.com/maps/documentation/routes/traffic_on_polylines).

Google có mode xe máy riêng; không tương đương bicycle. Tài liệu yêu cầu thông báo
giới hạn cho các mode beta. Kiểm tra quốc gia được hỗ trợ và thử tuyến thực tế trước
khi chốt. [Two-wheeler](https://developers.google.com/maps/documentation/routes/route_two_wheel), [coverage](https://developers.google.com/maps/documentation/routes/coverage-two-wheeled).

Mapbox Directions là ứng viên nếu phù hợp nền bản đồ mobile. `driving-traffic`
phụ thuộc coverage và có thể fallback sang driving khi ngoài vùng; vì vậy có tuyến
trả về không chứng minh có dữ liệu kẹt xe. Existing MapboxMapMatcher chỉ khớp GPS.
[Directions API](https://docs.mapbox.com/api/navigation/directions/).

Không chốt lựa chọn theo tính năng quảng cáo: P0 phải lập bảng capability cho từng
thành phố/mode với search quality, traffic thực sự có/không, ETA và chi phí.

## Bổ sung: nhiều phương tiện, nhiều tuyến và history cache

Google Routes là ứng viên ưu tiên khảo sát, **chưa phải provider đã được chọn**:
mode xe máy/ô tô/đi bộ có enum riêng và không nên để mặc định DRIVE. Đi bộ không
được áp traffic delay của ô tô; API options cần gửi đúng capability từng mode.
[Vehicle modes](https://developers.google.com/maps/documentation/routes/vehicles),
[RoutingPreference](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RoutingPreference).

API có `computeAlternativeRoutes`; có thể chỉ trả một tuyến, không bảo đảm luôn có
nhiều lựa chọn. Tuyến có intermediate waypoints có hạn chế với alternatives. Đề
xuất UI nhận tối đa 3 tuyến để so sánh thay vì hứa một số cố định; con số này là
giới hạn app đề xuất, không phải tuyên bố giới hạn tuyệt đối của provider.
[Alternative routes](https://developers.google.com/maps/documentation/routes/alternative-routes).

History cache chứa query người dùng và provider/placeId reference có thể phục vụ
recent searches; cache không miễn trừ hạn chế lưu provider content. Place ID có
ngoại lệ riêng, detail cần lấy mới khi dùng. Không mặc định cache nguyên tên/địa
chỉ/tọa độ response vô thời hạn hoặc coi chọn suggestion là tự viết nội dung đó.
[Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id).
Account-scoped mobile history cache 20 mục/30 ngày nay đã được duyệt trong
[DEC-SEARCH-01](../features/place-search/decisions.md); thư viện/native integration chưa chọn.
Không thêm Mongo history; saved Circle places vẫn là dữ liệu khác có DB.

## Mưa gần hạn

OpenWeather hiện giới thiệu One Call 4.0 cho tích hợp mới; có dữ liệu theo phút và
15 phút. Bản 3.0 vẫn có tài liệu riêng. Đề xuất khảo sát 4.0 trước thay vì đóng đinh
API version cũ. Phải thử coverage và field thực tế ở khu vực phục vụ trước khi hứa
thời điểm mưa chính xác. [One Call 4.0](https://openweathermap.org/api/one-call-4), [3.0 và hướng dẫn chuyển](https://openweathermap.org/api/one-call-3).

Quy tắc app là thiết kế của dự án: chỉ nói “có khả năng mưa trong khoảng…” khi nguồn
đủ resolution/freshness; hourly-only không chứng minh “10 phút nữa”. Trường bị thiếu
phải là unknown, không bằng zero. Không diễn giải lượng mưa mm/h thành xác suất %.

## Push và vị trí nền

Đề xuất FCM cho Android/iOS, với APNs configuration trên Apple. Push cần đăng ký
thiết bị, lifecycle token và xử lý app trạng thái khác nhau; không phải Socket.IO
chạy khi app đã đóng. [FCM Apple](https://firebase.google.com/docs/cloud-messaging/ios/receive-messages), [FCM Android](https://firebase.google.com/docs/cloud-messaging/android/receive-messages).

Token invalid cần loại bỏ, token đổi cần cập nhật; chỉ kết luận token invalid với
đúng loại lỗi và payload hợp lệ. [Token management](https://firebase.google.com/docs/cloud-messaging/manage-tokens).

iOS có cơ chế/điều kiện riêng cho background location. Android có quyền và giới hạn
nền; cần đánh giá đúng use case và phiên bản OS. Không dựa vào silent push để đánh
thức app lấy GPS theo lịch chính xác. Đề xuất visible notification với TTL, server
chạy độc lập và GPS có freshness; force-stop/revoke quyền/offline phải được thử riêng.
[Apple background location](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background), [Android background location](https://developer.android.com/develop/sensors-and-location/location/background).

Mobile chỉ mới được đọc ở các điểm map/DI/places phục vụ search, chưa audit toàn
bộ GPS/push. App là native Swift/iOS16, không cần chọn React Native package.
DI hiện có PushNotificationService; transport và khả năng delivery nền chưa được
kiểm chứng. P0 phải đánh giá service hiện hữu trước thêm SDK hoặc server delivery;
không bỏ REQ-MOB-05 hay tự tạo lại toàn bộ push chỉ vì plan đầu chưa thấy mobile.

## Mô hình chi phí và vận hành đề xuất

- Search calls ≈ phiên tìm kiếm × số request sau debounce; thêm detail/nearby theo lựa chọn và SKU. Session token không thay hard quota.
- Route calls ≈ lượt xem tuyến + active trip × thời lượng/tần suất cập nhật được duyệt; recompute có backoff và cap. Không gọi route trên từng GPS fix.
- Weather calls ≈ số ô vùng đang có user đủ điều kiện × số chu kỳ refresh, chỉ khi điều khoản cho cache/coalescing và đúng resolution. Không quét toàn bộ user mỗi phút.
- Push/worker/storage/egress và map SDK usage cũng cần tính; metrics theo provider/operation/status, không gắn tọa độ/user ID làm label.
- Chốt daily request caps và monthly budget theo traffic pilot, sau đó cấu hình quota/provider và giới hạn app; budget alert không được coi là hard stop. Không ghi số giá cố định khi chưa chốt SKU/account/region.
- Worker phải chạy được khi không có socket hoặc HTTP request. Cold sleep của web process không đáp ứng lịch background; phương án worker/scheduler always-on cần duyệt vận hành.

## Chưa kiểm chứng

Chưa có xác nhận độ chính xác/coverage tại Việt Nam, entitlement tài khoản, hạn mức,
cache licence, SDK mobile compatibility, pin/hiệu năng thiết bị hoặc giao push thật.
Các mục này là cổng P0/P3 trong roadmap; không đánh dấu hoàn tất từ tài liệu web.
