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

## Recheck — 2026-11-14

User has **no TomTom/VietMap account yet** and authorized routing-scoped Mobile
changes. Public docs now make version selection important:

- [TomTom Orbis migration v2](https://docs.tomtom.com/routing-api/documentation/tomtom-orbis-maps/v2/product-information/migration-guide) says its `travelMode` query supports only `car`; the [v3 migration guide](https://docs.tomtom.com/routing-api/documentation/tomtom-orbis-maps/v3/product-information/migration-guide) lists only `car` and `taxi` in POST. Neither is a verified motorcycle/walking implementation. If TomTom is selected, investigate the [TomTom Maps Routing v1 contract](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route), which documents motorcycle **BETA**, car and pedestrian, before binding any adapter.
- The [v1 introduction](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/product-information/introduction) explicitly lists drawing route geometry on TomTom or other map suppliers' tiles. This supports a MapKit rendering approach as a documented use case; it does not settle full account terms, retention, background navigation, attribution or final entitlement.
- [TomTom pricing](https://docs.tomtom.com/pricing) still lists 20K free Routing API calls/month with no upfront credit card. The key's actual assigned products/billing type must be checked privately in the [TomTom key dashboard](https://docs.tomtom.com/platform/documentation/my-tomtom/api-key-management); public pricing does not establish this future account's permissions.
- [VietMap error guide](https://maps.vietmap.vn/docs/map-api/errors/) says Trial accounts cap each API at 500/day and **Traffic is off by default**. Route v4 may return HTTP 200 with `code: ZERO_RESULTS`; HTTP 423 also means quota or entitlement failure. Do not promise trial traffic availability or parse every non-200 response as JSON.

No account was created, provider API called, key configured, or live Vietnam
motorcycle route verified in the research check. The account/terms and
mode-specific pilot remain gates to claiming the end-to-end feature works.

**Decision update:** user selected TomTom Maps Routing API v1 as a conditional
internal trial on 2026-11-14 (Q-MOB-31). Selection exists; entitlement/live
validation does not. Orbis should not be substituted because its documented mode
set differs.

## Keyed public-route feasibility — 2026-11-14

After user said they had placed a key in ignored Backend `.env`, a local check
confirmed one nonempty `TOMTOM_ROUTING_API_KEY` entry without printing its value.
Six authenticated GET calls to TomTom Maps Routing **v1** used two public Hanoi
map points; no private/user GPS or source was sent. The key stayed on the local
machine and was never echoed. HTTP 200 returned two alternatives each for
`motorcycle`, `car` and `pedestrian`; each had geometry and coded guidance.
Motorcycle/car responses included `trafficDelayInSeconds`; the pedestrian response
contained `0` but **walking traffic remains unavailable**, not a proven zero-jam
measurement. A follow-up requested `sectionType=travelMode`: motorcycle and car
each contained their requested mode **and an `other` section**; pedestrian contained
pedestrian. The motorcycle and car routes/ETA were identical for this one sample.
Do not claim vehicle-specific correctness or road legality from HTTP 200; test
multiple real Vietnam trips and inspect `other` spans before activation. No
device navigation, free-tier dashboard/billing verification, retention terms or
production account entitlement was established by these calls.

The [official v1 contract](https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route)
says `motorcycle` is BETA and a `TRAVEL_MODE` section can be `other` where the
requested mode is unavailable. It also defines traffic delay relative to free
flow; the [pricing page](https://docs.tomtom.com/pricing) advertises a free
Routing allowance, but actual account assignment still needs dashboard review.

Follow-up: user reports the dashboard key is **Free** with **Routing API** assigned
(Q-MOB-33), and chose to display a motorcycle route containing `other` with an
explicit unverified-segment warning (Q-MOB-32). A seventh public-point v1 call
with `instructionsType=text&language=vi-VN` returned HTTP 200 but sample maneuver
messages remained English (for example, the turn verb). App-owned vi/en speech
cannot rely on provider text localization; use supported maneuver codes and
localized templates, preserve street names as proper nouns, and fail safely for
unknown codes. Real-device speech and coverage remain unverified.

## Public terms recheck — 2026-11-14

The current [TomTom public pricing page](https://docs.tomtom.com/pricing) describes free monthly requests without an upfront card, but does not establish this account's actual quota or permitted navigation/display/retention use. The [TomTom SDK license](https://github.com/tomtom-international/maps-sdk-js/blob/main/LICENSE.txt) permits displaying API results over third-party map data for applications using that SDK; this project does **not** use the SDK, so that clause is not evidence of this app's API license. The [developer terms landing page](https://docs.tomtom.com/legal/terms-and-conditions) did not expose account-specific agreement text in the public page inspection. Account dashboard/agreement confirmation remains an activation gate; do not infer MapKit display or retention rights from HTTP 200.
