# Địa điểm yêu thích — data model

Status: **Current behavior**, source survey 2026-11-11. [Spec](spec.md) · [Schema conventions and ownership index](../../system/data-model.md). Model indexes are declared schema, not production-index validation.

| Model | Typed fields, validation/defaults and ownership |
|---|---|
| FavoritePlace | Required group/name/category/location/addedBy. Category restaurant/entertainment/cafe/shopping/other; Point coordinates exactly2, valid lon/lat. timestamps. JSON adds id/flattened latitude/longitude while retaining location; addedBy is populated by repository. |

## FavoritePlace — `favoriteplaces`

**Schema paths:** `groupId`, `name`, `category`, `location.type`, `location.coordinates`, `addedBy`, `createdAt`, `updatedAt`.

**Indexes được khai báo:**

- `{"groupId":1}`
- `{"location":"2dsphere"}`
