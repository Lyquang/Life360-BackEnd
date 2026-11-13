# Implementation: tìm kiếm địa điểm native MapKit

Status: **Implemented in Mobile** | Date: 2026-11-12.
[Spec](spec.md) · [Tasks](tasks.md) · [Decisions](decisions.md) · [Roadmap](../../system/mobility-roadmap.md).
Authority: DEC-SEARCH-03 / user “Hãy hiện thực full chức năng đầu tiên đi” thay
thế design-only DEC-SEARCH-02 cho slice này. Backend runtime/API không thay đổi.

## Luồng đã triển khai

LiveMap search entry → coordinator-owned NavigationStack sheet → @MainActor
PlaceSearchViewModel → Domain use cases/repository → Core MapKit service qua Data
adapter. MKLocalSearchCompleter tạo gợi ý; MKLocalSearch resolve selected completion
hoặc tìm bằng user query/visible map region. Có shortcut cafe/restaurant cho tìm
quanh vùng. Không yêu cầu quyền GPS mới, không ép quốc gia chưa được user chọn.

Chọn result → Coordinator đóng sheet, focus map và thêm một search pin/card riêng.
Member pins/trail/history không bị dùng làm dữ liệu route tìm mới. Cancel/close
hủy task; request generation và terminal session flag loại obsolete response.
Native completion/search có timeout 10/15s và typed throttled/unavailable state.
Delegate chuyển về MainActor rõ ràng. Không thêm dependency hoặc tăng iOS16 target.

## Files thực tế trong Mobile

Paths tương đối `Mobile/FamilyTracker/`:

| Layer | File |
|---|---|
| Domain models | `Domain/Entities/PlaceSearch.swift` |
| Repository contracts | `Domain/Repositories/PlaceSearchRepository.swift` (search và history) |
| Use cases | `Domain/UseCases/Places/PlaceSearchUseCases.swift` |
| Native adapter | `Core/Maps/MapKitPlaceSearchService.swift` |
| Data | `Data/Repositories/MapKitPlaceSearchRepository.swift`, `Data/Local/Cache/SearchHistoryCache.swift` |
| Presentation | `Presentation/Scenes/Places/Search/PlaceSearchViewModel.swift`, `PlaceSearchView.swift` cùng folder |
| Integration | `App/DI/AppContainer.swift`, `Presentation/Coordinators/MapCoordinator.swift`, `MainTabCoordinator.swift`, `Presentation/Scenes/LiveMap/Map/LiveMapView.swift`, `LiveTrailMapView.swift` |
| Resources/tests | vi/en Localizable.strings, `Tests/PlaceSearchTests.swift`, `scripts/test_place_search.sh`, CI search test step |

Native ownership/spec: [Mobile spec](../../../../Mobile/.spec/013-place-search/spec.md),
[execution plan](../../../../Mobile/.spec/013-place-search/plan.md),
[verification/QA](../../../../Mobile/.spec/013-place-search/quickstart.md).
AppContainer chỉ compose; Domain không import MapKit/CoreLocation/SwiftUI.
Views gọi intents; Coordinator sở hữu sheet/navigation và selected result.

## Cache/lifecycle đã thực hiện

DEC-SEARCH-01: account-scoped **local UserDefaults query cache**, tối đa 20 mục,
30 ngày tính từ last use; giữ qua restart nếu OS chưa xóa cache. Đây là cache trên
đĩa, không phải memory-only; không Redis/Mongo/server sync. Payload chỉ user query
và timestamp; không serialize Apple result/address/coordinate/token. Cache key dùng
SHA256 account ID, không log query/GPS. Apple POI chỉ giữ trong memory cho phiên search.

Normalized whitespace/case/diacritics dedup, newest first, prune expiry/future or
invalid records; corrupt cache trở về rỗng. Delete-one/all và rerun history lấy
kết quả mới. Cache failure hiển thị warning, không làm hỏng tìm kiếm.

MainTabCoordinator.stop gọi search endSession trước async logout. Kết thúc session
xóa cache owner, hủy requests và vĩnh viễn vô hiệu old model; repeated teardown
không xóa cache của phiên mới. Close sheet bình thường chỉ cancel, giữ history.
SOS/member deeplink đóng search để không bị modal che. Search không bật GPS nền.

## Backend và các phạm vi chưa hiện thực

Không có /map-search endpoints/new JS ports/provider hoặc DB history. Backend
proxy draft trước là superseded cho native slice, chưa từng hiện thực. Saved
Circle place API vẫn giữ nguyên; chưa thêm purpose/geofence/route/traffic/weather/
push hay nút giả cho chức năng chưa có. Motorcycle routing vẫn cần capability và
provider/coverage phù hợp; không thay bằng automobile. Không trộn Google route
content trên Apple Maps khi chưa xác minh quyền/capability.

## Verification — thực chạy 2026-11-12

| Check | Evidence |
|---|---|
| Standalone production model/cache/VM harness | **21 tests passed**: TTL/cap/dedup/restart/corruption/account/logout, stale completion/error, cancellation, retry, selection và deallocation |
| Localization | 20 new keys; 550 total vi/en, zero parity/missing/literal/duplicate findings; dùng Ruby Homebrew hiện có vì system Ruby2.6 thiếu filter_map |
| Scoped strict SwiftLint | 13 affected/new production Swift files, zero findings; cùng rules repo, không sửa spacing baseline ngoài phạm vi |
| Unsigned Debug Simulator build | Pass, Xcode26.2/iOS16, existing cached package checkouts, automatic package updates disabled |
| Native MapKit public-landmark smoke on macOS | 7 suggestions, selected completion resolves 1 place, text search 1 valid place; không GPS/device/account/private data |
| Networking regression | Edited working-tree script fails from pre-existing omitted SOS sources, preserved. Committed HEAD harness run from /tmp against current sources passes REST/SOS/refresh/media with 26 REST examples. Không gọi script hiện tại là pass. |

Actual executable tests không cần cấu hình một XCTest target mới; CI chạy search
script. Chưa chạy interactive UI/device/VoiceOver/weak-network coverage hay
production-account test. Manual steps nằm ở native quickstart; không claim SLA,
miễn phí/unlimited native API hoặc routing xe máy từ search smoke.
