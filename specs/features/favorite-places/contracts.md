# Circle places — implemented HTTP contract, 2026-11-13

Base `/api/v1`. [API handoff](../../../api-docs/PLACES_API_DOC.md) supplies concrete
DTO examples/error/retry guidance; [data model](data-model.md) owns field details.
All routes require Bearer auth and current group membership. No socket additions.

| Method/path | Input | Success | Permission |
|---|---|---|---|
| POST `/groups/:groupId/places` | name 1..100 trimmed; legacy category; lat/lng | 201 data Place | Current member, addedBy from auth |
| GET `/groups/:groupId/places` | group ID | 200 success/count/data Place[] newest first | Current member |
| GET `/groups/:groupId/places/:placeId` | scoped IDs | 200 success/data Place | Current member |
| PATCH `/groups/:groupId/places/:placeId` | expected revision + name/category or paired lat/lng | 200 success/data Place, revision+1 | Creator or admin, still member |
| DELETE `/groups/:groupId/places/:placeId?revision=N` | expected revision query | 200 success/data id,deleted=true | Creator or admin, still member |
| GET `/groups/:groupId/me/place-labels` | group ID | 200 success/count/data Label[] | Caller only, member |
| PUT `/groups/:groupId/me/place-labels/:label` | placeId; customLabel iff custom | 200 success/data Label | Caller only, member |
| DELETE `/groups/:groupId/me/place-labels/:label` | group ID + label | 200 success/data label,removed boolean | Caller only, member |

Place JSON retains GeoJSON and flattened lat/lng, id/name/category/groupId,
populated addedBy and timestamps; adds revision default zero (including legacy
missing field). Labels home/work/leisure/custom are per caller/Circle. Returned
Label.placeId is populated Place, input placeId is ID. customLabel trimmed 1..50
only for custom, otherwise null in response. No shared home/work field is added.
PATCH strict body, at least one changed field; coords paired; revision integer
0..9007199254740990. DELETE requires revision query. Label body rejects owner IDs.

400 validation/label text, 401 auth, 403 membership/editor, 404 group/scoped place,
409 stale revision, 503 new mutation without transaction support. New writes use
Group membership write guard and transactions; place delete cascades labels.
Label PUT last-write-wins/retry-safe state; DELETE label repeated returns false.
After leave, no label access; retained private labels may be restored on rejoin.
No geofence/presence, GPS, external POI provider data or Mobile integration here.
