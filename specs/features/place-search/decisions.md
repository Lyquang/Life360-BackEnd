# Place search — accepted decisions

Date: 2026-11-12. [Spec](spec.md) · [Plan](plan.md) · [Roadmap](../../system/mobility-roadmap.md).

| ID | Status | Decision / acceptance | Authority |
|---|---|---|---|
| DEC-SEARCH-01 | Accepted; implemented in Mobile | Recent searches use mobile account-scoped cache, maximum 20 recent entries, expire after 30 days, delete-one/clear-all; record submit/selection rather than every keystroke; fetch current place/route data on reuse. No search-history DB and no multi-device sync in the first version. Cache loss is allowed to clear history. | User: “Tôi đồng ý với đề xuất của bạn” following the concrete recommendation, 2026-11-12 |
| DEC-SEARCH-02 | Superseded by DEC-SEARCH-03 | Complete design documentation only. Do not edit Mobile or run its native build/tests. Keep implementation tasks deferred until a later explicit instruction changes this scope; do not keep requesting the same scope expansion. | User selected “Chỉ hoàn thiện thiết kế, chưa sửa Mobile”, 2026-11-12 |
| DEC-SEARCH-03 | Accepted; native implementation/build/tests completed | Implement the complete first native MapKit search/history slice in Mobile, including appropriate local build/tests. Preserve unrelated changes; do not expand into routing/weather/geofences. | Later explicit user instruction “Hãy hiện thực full chức năng đầu tiên đi”, 2026-11-12 |

Cache library, disk persistence across app restarts and logout implementation need
mobile integration review. Google Routes was recommended for evaluation, not
selected as a production provider by DEC-SEARCH-01.

## Platform evidence — 2026-11-12

User explicitly confirmed Apple Maps/MapKit and gave Mobile file paths. Read-only
inspection verified MKMapView in LiveTrailMapView/RouteMapView, SwiftUI Map in
HistoryView, CLGeocoder in ReverseGeocoder and iOS 16 deployment target. The app
is native Swift/SwiftUI; GoogleSignIn is not evidence of Google Maps integration.

The revised plan proposes native MapKit autocomplete/search, with no first-slice
backend search proxy. This is an adaptation to verified platform evidence, not a
claim that motorcycle routing or backend traffic polling is solved. Country,
future routing/weather provider/budget remain open. DEC-SEARCH-02 initially kept
the work design-only; DEC-SEARCH-03 later authorized Mobile implementation and
local build/tests. The native slice is implemented, with device/coverage QA still
separate; no pending write-permission request remains for the same feature.
