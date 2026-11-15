# Routing preview contract — implemented locally

Revision: 2026-11-14. Authority: [routing spec](spec.md),
[Revision 2 plan](plan.md#revision-2--route-finding--in-app-navigation-2026-11-14).
This is the accepted Revision 2 Backend→Mobile contract, implemented locally in
the HTTP route and verified by `tests/routingPreview.test.js`. See
`api-docs/ROUTING_API_DOC.md` for the actual client handoff. It is not deployed.

## POST `/api/v1/routes/preview`

Bearer JWT. Route is private to the requester. No Circle ID/membership or shared
destination. No backend trip storage/route ID lookup. Request:

```json
{
  "origin": { "latitude": 21.0285, "longitude": 105.8542 },
  "destination": { "latitude": 21.0368, "longitude": 105.8342 },
  "travelMode": "motorcycle"
}
```

`travelMode` required: `motorcycle|car|walking`. Coordinates finite, latitude
-90…90 and longitude -180…180; origin and destination must differ. Strict body:
no client-supplied provider URL, key, arbitrary geometry or traffic baseline.
Backend maps `walking` to TomTom `pedestrian`, others to same-named v1 values.
Request `routeType=fastest`, `traffic=true`, `maxAlternatives=2`,
`instructionsType=coded`, `sectionType=travelMode`; one origin/destination leg.
No intermediate stops or avoid/toll preferences in this revision.

Success: `200 {success:true,data:{provider:'tomtom-v1',travelMode,fetchedAt,
routes:[...]}}`. `routes` has 0…3 actual provider alternatives; zero means no
route, with `data.reason:'no_route'`. Each route carries response-local `id`
(not persistent), `distanceMeters`, `durationSeconds`, geometry as ordered
`[{latitude,longitude}]`, maneuvers as ordered
`[{code,pointIndex,routeOffsetMeters,streetName}]`, `modeSections` as ordered
`[{startPointIndex,endPointIndex,travelMode}]`, and
`traffic:{status:'provider_reported'|'unavailable',delaySeconds:number|null}`.
The client must keep `modeSections` with the selected route and display a warning
for `other`. `other` does not equal pedestrian. `walking` traffic always
`unavailable`, even if TomTom emits delay 0. `fetchedAt` is server observation
time, not a guarantee of source traffic freshness; lack of a provider timestamp
must not become an invented live age. Provider attribution is shown as TomTom.

The server validates all route/leg/point/index/summary shapes and bounds output
size; malformed/oversized provider data yields controlled failure, never a
truncated route. Provider response text is **not** a Vietnamese speech contract.
Mobile localizes known maneuver codes; unknown codes cannot produce a guessed
turn voice instruction. No provider key/upstream URL/raw response in client DTO.

## Errors and handling

| Case | HTTP | Client action |
|---|---:|---|
| Invalid/missing JWT | 401 | Sign in again |
| Invalid body | 400 `VALIDATION_ERROR` | Correct input; no provider call |
| User preview budget exceeded | 429 `RATE_LIMITED` | Respect Retry-After, do not spin |
| Provider quota/429 | 429 `ROUTE_QUOTA_EXCEEDED` | Stop automatic reroute, show unavailable |
| Missing config or provider 401/403/5xx/timeout/malformed response | 503 `ROUTE_UNAVAILABLE` | Keep already loaded route if active; no fake new route |
| Valid no-route | 200 with empty `routes` | Show no route for requested mode |

No automatic backend retry of provider calls. Bounded per-user limit defaults
to 10 preview calls/minute; provider Free account/quota is external and must
not auto-upgrade. A request may consume upstream quota even if the client
disconnects. Repeating preview may return a fresh route and is not a stable
idempotent trip command. Logged request metadata excludes GPS and secret.

## Lifecycle boundary

This endpoint only plans a route. Mobile owns selected route and local active
navigation in the current account/session; it retains loaded route in memory
through temporary network loss and clears it on end/logout. Backend does not
persist route geometry, GPS, trip or destination in this slice. Background
traffic push/worker is separately owned by `context-alerts`; it will need a
future reviewed durable context contract rather than claiming one exists now.
