# Routing provider feasibility — checked 2026-11-13

Read-only primary-source research under Spec Kit plan Phase0. No accounts/keys,
provider route calls, installations or private source/GPS uploads. User requires
Vietnam, motorcycle priority/car/walking, alternatives/live traffic, native in-app
voice and loaded-route continuation; free trial without enabling paid billing.
**No complete provider fit has yet been verified or selected.**

| Candidate | Verified in public documentation | Still requires confirmation |
|---|---|---|
| TomTom REST + current renderer/custom guidance | No-card free allowance; motorcycle BETA/car/pedestrian, alternatives/guidance/traffic; Vietnam traffic coverage | Navigation-use entitlement, MapKit display/route retention and motorcycle pilot accuracy; iOS Navigation SDK is request-only |
| VietMap REST + current renderer/custom guidance | No-card 60K trial transactions, motorcycle/car routes, alternatives/maneuvers/congestion | Trial duration/actual quotas/navigation entitlement; foot enum conflict; traffic timestamp and delay baseline; MapKit integration/retention rights |
| Apple MapKit | Alternatives, route steps and device speech building blocks | No motorcycle mode or proven server-readable traffic delay; not a complete solution |
| OSM/Valhalla/Geoapify | Mode-aware routes and maneuvers feasible | No verified free live Vietnam traffic source; hosting/data remain obligations |

Sources for TomTom:
[pricing](https://docs.tomtom.com/pricing),
[route reference](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route),
[Vietnam traffic coverage](https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/product-information/market-coverage),
[SDK access](https://docs.tomtom.com/navigation/ios/guides/advanced/telemetry-configuration).
Current pricing lists 20K routing requests/month, no credit card; do not reuse old
2,500/day figures. [Terms page](https://docs.tomtom.com/legal/terms-and-conditions)
did not render substantive terms in this check: this is neither permission nor
proof of a prohibition. Navigation/map display/retention authorization is unresolved.

Sources for VietMap:
[trial overview](https://maps.vietmap.vn/docs/map-api/overview/),
[trial homepage](https://maps.vietmap.vn/web),
[Route v4](https://maps.vietmap.vn/docs/map-api/route-version/route-v4/),
[playground description](https://tools.vietmap.vn/playground/en/route),
[native navigation SDK](https://maps.vietmap.vn/docs/sdk-mobile/sdk-ios/navigation/).
Homepage advertises two trial months and routing/day limits; do not describe trial
as perpetually free. Route enum/playground disagree on foot; unencoded coordinate
order also needs a controlled contract check. Ready-made navigation SDK uses its
own map views, not proof of a headless engine on MapKit.

Engineering inference: on-device maneuver advancement/speech can use retained
geometry/instructions without network, subject to data retention rights and device
QA. This does not provide offline map tiles, offline rerouting or fresh traffic.
[Apple steps](https://developer.apple.com/documentation/mapkit/mkroute/step/instructions),
[speech](https://developer.apple.com/documentation/avfoundation/speech-synthesis).

Before dependent implementation: choose an entitled provider/trial, confirm allowed
map/navigation use and contract capabilities; configure a restricted server-side
key privately. Do not ask the user to paste keys into chat. Do not switch the map,
use car as motorcycle, send fake traffic, enable billing, or invent a working SDK.
This research is not an implemented routing API.
