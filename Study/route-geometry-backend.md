# Route Geometry Backend - B0 Study

## 1. Muc tieu va pham vi

Tai lieu nay la ket qua B0: chi doc, do dac va thiet ke cho lich su GPS va journey. Chua co ma nguon, schema, API hay bien moi nao duoc ap dung.

Muc tieu cua cac buoc sau la:

- tra chuoi diem GPS that theo thu tu thoi gian de iOS ve duong di;
- bieu dien khoang trong du lieu thay vi tinh no thanh thoi gian di chuyen lien tuc;
- luu history du day khi dang di chuyen, van gioi han dung luong;
- them truy van raw history theo khoang thoi gian va cursor;
- giu nguyen contract hien tai cho client cu.

Map matching (OSRM, Valhalla hoac dich vu ngoai), socket acknowledgement, SOS idempotency, APNs va thay doi mobile nam ngoai pham vi.

## 2. Hien trang da kiem chung

### 2.1. Ghi history tu realtime

Duong goi:

```text
Socket update_location
  -> locationGateway
  -> locationUseCases.updateLocation
  -> locationHistoryRepository.create
  -> LocationHistory
```

Bang chung:

- `src/presentation/socket/gateways/locationGateway.js:7-19` validate payload roi truyen user tu socket auth vao use case.
- `src/application/location/locationUseCases.js:4-7` dat nguong history realtime co dinh la 50 m hoac 30 giay; `recordedAt` chap nhan toi da tre 24 gio va som 60 giay.
- `src/application/location/locationUseCases.js:44-49` dung dieu kien **OR**: luu neu da qua 30 giay, hoac neu khoang cach dat 50 m. Ham nay dung `Date.now()` luc server nhan, khong dung `recordedAt`.
- `src/application/location/locationUseCases.js:23-24` giu `lastSavedLocation` va `durationTracker` trong `Map` cua mot tien trinh. Restart hoac scale nhieu instance lam mat/chia tach state.
- `src/application/location/locationUseCases.js:86-110` history duoc ghi voi timestamp GPS da resolve (`at`), nhung quyet dinh throttle va state `lastSavedLocation.timestamp` lai dung gio server.
- `src/infrastructure/repositories/locationHistoryRepository.js:4-10` luu GeoJSON, `timestamp: at` va `accuracy` neu co. Diem realtime khong co `pointId`.

He qua:

- diem den muon co the duoc chen dung thoi gian vao MongoDB, nhung quyet dinh co luu hay khong phu thuoc thoi diem server nhan;
- mot diem realtime va cung diem do gui lai qua batch khong co khoa chung de deduplicate;
- sau restart, diem realtime dau tien cua moi user luon duoc luu;
- tren nhieu instance, moi instance co throttle va duration rieng.

### 2.2. Ghi history tu batch P6

- `src/application/location/syncLocationBatchUseCase.js:16-29` loai diem qua cu/qua som va stable-sort theo `recordedAt`.
- `src/application/location/syncLocationBatchUseCase.js:30-41` deduplicate `pointId` trong request, sau do ghi tat ca diem hop le.
- `src/infrastructure/repositories/locationHistoryRepository.js:13-38` upsert idempotent theo `(userId, pointId)` voi `ordered: false`.
- Batch **khong** ap dung nguong 50 m/30 giay va khong thinning. Vi vay batch co the day hon realtime.
- `src/application/location/syncLocationBatchUseCase.js:42-69` chi cap nhat last-known MongoDB/Redis neu diem moi nhat thuc su moi hon.
- Batch khong goi `durationTracker`, khong stay alert va khong broadcast. Day la hanh vi dung can giu nguyen.

### 2.3. Schema, index va retention

`src/infrastructure/database/models/LocationHistory.js:4-49` co:

- `userId`;
- `location` GeoJSON Point;
- `timestamp`;
- `pointId` tuy chon;
- `accuracy` tuy chon;
- khong co motion state, source, dedupe fingerprint hay TTL.

Index hien tai tai `LocationHistory.js:52-60`:

- `location: 2dsphere`;
- `(userId ASC, timestamp DESC)`;
- unique partial `(userId, pointId)` cho ban ghi co `pointId`;
- ngoai ra `userId` va `timestamp` khai bao `index: true`, nen Mongoose tao them single-field index.

Khong co TTL index, do do history duoc giu vo thoi han. `src/infrastructure/database/connection.js:42` goi `model.init()` luc khoi dong. Code khong tat `autoIndex`, nen mac dinh Mongoose hien tai se build index; tuy nhien khong nen phu thuoc startup index build khi production da co nhieu du lieu. B5 nen co mot lenh migration/index rieng, idempotent, chay truoc khi bat feature flag.

Tai lieu chinh thuc:

- [Mongoose autoIndex](https://mongoosejs.com/docs/guide.html#autoIndex): `init()` tao schema indexes khi `autoIndex` bat, va mac dinh la bat.
- [MongoDB TTL indexes](https://www.mongodb.com/docs/current/core/index-ttl/): TTL chi la single-field index, xoa bat dong bo, va giam TTL dot ngot co the tao tai xoa lon.

### 2.4. Journey hien tai

Duong goi:

```text
GET /api/v1/history/:userId/journey?date=YYYY-MM-DD
  -> historyController.journey
  -> historyUseCases.getDayJourney
  -> locationHistoryRepository.listForUserBetween
  -> buildDayJourney
```

Quyen xem tai `src/application/history/historyUseCases.js:15-19`: requester duoc xem chinh minh hoac user co chung it nhat mot Circle; nguoi ngoai nhan `403`.

Khoang ngay:

- `src/domain/dates.js:3-15` tinh nua dem theo local timezone cua process, sau do cong dung 24 gio.
- Render khai bao `TZ=Asia/Ho_Chi_Minh` trong `render.yaml:16-17`, nen ngay production theo Viet Nam neu service dung Blueprint nay.
- Neu chay o moi truong khong dat `TZ`, ket qua theo timezone cua process do.
- Cach cong 24 gio khong an toan cho timezone co daylight-saving, nhung `Asia/Ho_Chi_Minh` hien khong co DST.

Thuat toan:

- `src/domain/journey.js:3-4`: stay neu cac diem nam trong ban kinh 80 m quanh diem dau va cua so keo dai it nhat 5 phut.
- `journey.js:22-68`: cua so khong nhan biet data gap. Hai diem gan nhau nhung cach nhau nhieu gio co the bi xem la mot stay.
- `journey.js:88-91`: neu khong co stay va co it nhat hai diem, toan bo ngay tro thanh mot moving segment.
- `journey.js:70-85`: moving `path` chua **tat ca** `segPoints`, nhung moi phan tu chi co latitude/longitude; timestamp va accuracy bi bo.
- `src/application/history/historyUseCases.js:6-12` cung bo `_id`, `accuracy` va `pointId` truoc khi vao domain.
- `journey.js:142-154`: `totalPoints` la so ban ghi raw da doc; moving minutes la tong chenh le endpoint cua segment. Khoang trong nhieu gio hien bi tinh vao moving duration.
- `src/infrastructure/repositories/locationHistoryRepository.js:40-43`: doc toan bo ngay, sort timestamp tang dan, `lean()`, khong projection, limit hay pagination.

Do phuc tap `detectStayPoints` khong dam bao O(n). Truong hop nhieu diem gan nhau nhung cua so chua du 5 phut se quet lai phan duoi nhieu lan, worst case O(n^2).

Benchmark cuc bo B0 tren Node hien tai, du lieu tong hop, khong co I/O MongoDB:

| Mau | So diem | Thoi gian `buildDayJourney` |
| --- | ---: | ---: |
| Duong cac diem cach xa | 1,000 | 2.60 ms |
| Duong cac diem cach xa | 5,000 | 2.03 ms |
| Duong cac diem cach xa | 10,000 | 2.41 ms |
| Cum day, cua so ngan | 1,000 | 12.42 ms |
| Cum day, cua so ngan | 3,000 | 85.31 ms |
| Cum day, cua so ngan | 5,000 | 444.56 ms |

Day chi la phep do mot may dev, khong phai SLA. Mau xau cho thay Event Loop co the bi chan dang ke truoc khi dat hang chuc nghin diem. B3 phai co benchmark lap lai va ngan sach thoi gian ro rang.

### 2.5. Response that hien tai

Theo `src/domain/journey.js:47-58` va `70-85`, shape hien tai la:

```text
success: Boolean
date: YYYY-MM-DD
userId: String
summary:
  totalPoints: Number
  stayPointCount: Number
  totalStayMinutes: Number
  totalStayFormatted: String (khong co khi rong)
  totalMovingMinutes: Number
  totalMovingFormatted: String (khong co khi rong)
  firstSeenAt: ISO-8601 | null
  lastSeenAt: ISO-8601 | null
journey:
  stay:
    type, latitude, longitude, arrivedAt, leftAt,
    durationMinutes, durationFormatted, pointCount
  moving:
    type, fromLatitude, fromLongitude, toLatitude, toLongitude,
    startTime, endTime, durationMinutes, durationFormatted,
    path: [{ latitude, longitude }]
```

Backend hien khong tra `movingSegmentCount`, `points`, timestamp tung diem, `accuracy`, `segmentId`, distance hay gap.

Kiem chung deploy ngay 2026-10-17:

- health cong khai cua `https://life360-backend-6v9n.onrender.com` tra server running va MongoDB connected;
- OpenAPI deploy cong bo `/history/{userId}` va `/history/{userId}/journey` voi contract tong quat giong source;
- local `HEAD` va `origin/main` cung o commit `691aac4`.

Khong co build SHA trong health/OpenAPI va khong co token/du lieu test production, nen B0 **khong the chung minh** container Render dang chay chinh xac commit nao, cung khong the lay mot response journey chua du lieu nhay cam. Shape chi tiet tren duoc chung minh tu source/test cua `origin/main`, khong phai tu mot request history production.

### 2.6. Mau thuan voi iOS

Code mobile da duoc doi chieu:

- `Mobile/.../HistoryDTOs.swift:39-48` co `path` khong timestamp va `points` co `timestamp` tuy chon.
- `Mobile/.../CoreMappers.swift:134-149` uu tien `path` neu khong rong; chi dung `points` khi `path` rong. Timestamp trong `points` khong duoc dua vao domain.
- `Mobile/.../Journey.swift:21-32` domain `MovingSegment` chi giu `[GeoPoint]`.

Do backend luon tra `path`, mobile hien tai se ve dung cac toa do co trong `path`, nhung khong biet thoi gian/gap cua tung diem. Them `points` khong du de mobile hien tai tu dong dung gap; mobile can mot task rieng de doc contract moi.

### 2.7. Socket hien tai

- `src/presentation/dto/location.schemas.js:10-16` nhan `recordedAt` va `accuracy` tuy chon.
- `src/application/location/locationUseCases.js:113-129` phat moi update hop le toi cac Circle, khong throttle broadcast theo history persistence.
- `location_update` co `timestamp`, `recordedAt`, `accuracy?`, battery va duration fields.
- History co the bi throttle, nhung live map van nhan update da validate.
- `src/presentation/socket/gateways/locationGateway.js:21-23` log ten user khi loi, nhung khong log toa do/token. B2-B4 khong duoc bo sung log userId kem du lieu vi tri.

## 3. Chan doan "0 stops, 3 h 41 min moving" chi co hai dau mut

Co ba co che lien quan:

1. Neu query chi doc duoc hai ban ghi va khong co stay, `buildMovingSegments` tao mot moving segment tu ca hai (`journey.js:88-91`).
2. `durationMinutes` lay `last.timestamp - first.timestamp` (`journey.js:70-84`), khong tru data gap. Vi vay khoang mat mang/tat app cung bi tinh la moving.
3. `path` khong bi backend co tinh rut ve hai diem; no map tat ca `segPoints`. Neu response that chi co hai diem thi history cua segment da chi con hai diem sau stay classification, hoac MongoDB ngay do chi co hai ban ghi.

Nguyen nhan co the lam history thua:

- realtime luu theo 50 m **hoac** 30 giay va state chi nam trong RAM;
- mobile co policy rieng: automotive toi thieu 10 giay, walking 20 giay, stationary heartbeat 30 giay (`Mobile/.../LocationSendPolicy.swift:39-51`);
- socket khong ack, nen emit thanh cong o client khong chung minh server da persist;
- app offline chi duoc phuc hoi neu batch P6 da chay thanh cong;
- deployment/restart/multi-instance lam reset `lastSavedLocation` va `durationTracker`.

Khong biet tu source:

- hai ban ghi production do realtime, batch hay du lieu cu tao ra;
- trong khoang 3 gio 41 phut client khong gui, server khong luu, hay request bi loi;
- Render dang chay mot hay nhieu instance tai thoi diem do;
- collection production co dung/du index nhu schema hay khong;
- dung luong va pattern history that tren Atlas.

Can metric khong chua toa do: so location received, persisted, throttled, batch accepted/duplicate/rejected, va distribution cua gap theo bucket.

## 4. Thiet ke de xuat

### 4.1. Mo hinh diem noi bo

Domain nen nhan mot shape framework-independent:

```text
HistoryPoint {
  id,
  latitude,
  longitude,
  recordedAt,
  accuracy?
}
```

Repository project chi cac field can thiet va map `timestamp` cua MongoDB thanh `recordedAt`. Tat ca ham domain sap xep tang dan theo `(recordedAt, id)` de deterministic khi trung timestamp.

### 4.2. Journey enriched ma khong pha client cu

Giu nguyen cac field moving hien tai. Them:

```text
segmentId
points: [{ latitude, longitude, recordedAt, accuracy? }]
pointCount
originalPointCount
distanceMeters
maxGapSeconds
gaps: [{ fromIndex, toIndex, seconds, meters }]
thinned
```

Quy tac:

- `path` cu van la mang toa do de decoder iOS cu khong vo.
- `points` moi co thoi gian va accuracy; index trong `gaps` tro vao mang `points` **sau thinning**.
- `distanceMeters` tinh Haversine tren chuoi raw truoc thinning.
- `maxGapSeconds` tinh tren cap diem raw lien ke.
- Douglas-Peucker dung khoang cach met, khong dung do lat/lng truc tiep.
- Tach chuoi thanh cac run tai gap, thinning tung run, sau do ghep lai va bat buoc giu hai bien cua gap. Khong noi DP qua khoang khong quan sat.
- `segmentId` nen la hash versioned tu target user + first raw history id + thoi gian bat dau. Khong tra userId trong segment id va khong dung chi so mang. Khi quy tac segmentation doi, prefix version cung doi de cache/mobile khong nham danh tinh.

Mau thuan can duyet: neu thinning truc tiep `path`, client cu nhan it diem hon; neu giu `path` raw va chi thinning `points`, payload van lon va mobile cu khong huong loi. Phuong an tuong thich nhat la giu response mac dinh y het, va cho client moi opt-in bang query nhu `detail=geometry`; phuong an don gian hon la them/thinning mac dinh nhung khong con dam bao "y nguyen" ve noi dung `path`.

### 4.3. Hai phuong an xu ly gap

**A. Tach moving segment tai gap**

- Uu: timeline trung thuc; duration tung moving segment khong chua khoang khong quan sat; de ve net dut giua cac segment.
- Nhuoc: so segment va duration ma client cu hien thi thay doi; gap nam giua hai segment nen can them `journeyGaps` cap ngay hoac gan gap vao segment lien ke; `segmentId` co the thay doi khi nguong doi.
- Summary: giu `totalMovingMinutes` cu de backward compatibility va them `observedMovingSeconds`; neu tinh lai field cu thi la breaking semantic change.

**B. Giu segment, kem `gaps`**

- Uu: it thay doi response/timeline cu; mobile moi co the ve net dut; de giu `totalMovingMinutes` cu.
- Nhuoc: client cu van hien thi "moving" xuyen gap; moi client phai tu tru gap khi hien thi observed duration.
- Summary: them `observedMovingSeconds`, tinh tong cac interval quan sat va loai interval gap; khong doi `totalMovingMinutes`.

De xuat cho rollout tuong thich: B truoc, hoac A chi trong che do opt-in/version moi. Can nguoi dung quyet dinh.

Nguong gap nen dua vao config. Goi y khoi dau de test, chua phai quyet dinh:

- time gap: 180 giay;
- `meters` la metadata khoang cach giua hai diem, khong nen thay the time gap;
- neu muon rule ket hop, co the danh dau gap khi qua 180 giay, va them loai `largeJump` khi khoang cach vuot nguong rieng. Dung dieu kien `time AND distance` se bo sot truong hop mat du lieu khi thiet bi khong di xa.

### 4.4. Stay va khoang trong cung vi tri

Hai diem gan nhau cach nhieu gio khong du chung cu de ket luan user o yen lien tuc. Co ba lua chon:

- giu nhu hien tai: UI de hieu nhung co the bịa stay;
- gap-first: tach tai gap truoc stay detection, khong tinh khoang vo du lieu thanh stay; day la de xuat an toan ve tinh trung thuc;
- tra mot trang thai moi nhu `unknown`: ro nghia nhat nhung them contract/UI.

Khong doi stay algorithm truoc khi co quyet dinh va test mo phong. Bat ke lua chon nao, stay van phai co `arrivedAt` va `leftAt`.

### 4.5. Raw history range va cursor

Endpoint van la:

```http
GET /api/v1/history/:userId?from=&to=&limit=&cursor=
```

Che do legacy: khong co query moi thi chay dung use case/response hom nay hien tai.

Che do range:

- `from`, `to` la ISO-8601 co timezone; neu chi co mot dau, dau con lai duoc suy ra theo max range da duyet;
- validate `from < to` va do rong khong vuot cau hinh;
- sort `(timestamp ASC, _id ASC)`;
- cursor opaque base64url chua version, timestamp va `_id`; decode/validate that bai tra `400` chung, khong echo payload cursor;
- truy van trang sau bang `timestamp > cursor.timestamp` hoac `timestamp == cursor.timestamp AND _id > cursor.id`;
- doc `limit + 1`, tra toi da `limit`, `nextCursor = null` neu het;
- projection chi `_id`, `location.coordinates`, `timestamp`, `accuracy`;
- `lean()`;
- quyen xem dung `assertCanView` hien tai, va `403` khong noi user co history hay khong.

Can index `(userId ASC, timestamp ASC, _id ASC)`. Index `(userId, timestamp DESC)` hien tai co the scan nguoc cho hai field dau, nhung khong co `_id` tie-break de dam bao cursor khong trung/khong sot. MongoDB cung khuyen sort kem mot field unique khi field chinh co the trung: [cursor sort documentation](https://www.mongodb.com/docs/manual/reference/method/cursor.sort/).

### 4.6. Pure persistence policy

Tach pure function:

```text
shouldPersistHistoryPoint(previousLatest, candidate, config)
```

Ket qua nen la enum/reason thay vi chi Boolean, vi can metric va test:

```text
persist(first | movingThreshold | idleHeartbeat | motionChanged | lateArrival)
skip(tooSoon | stationaryNoise | duplicate)
```

Quy tac de xuat:

- dung `recordedAt` hop le;
- moving: dat ca `minIntervalMoving` **va** `minDistanceMoving`;
- stationary: luu heartbeat sau `maxIdleInterval`;
- motion change: luu diem bien neu payload co motion state;
- diem den muon: co the luu vao history, nhung khong thay `previousLatest`, User last-known, Redis last-known hay duration tracker;
- invalid domain values bi presentation validation chan truoc;
- `accuracy` duoc luu, khong dung de loai diem trong scope nay.

Backend hien khong nhan motion state. Khong the hien thuc nhanh `motionChanged` ma khong them optional `motionState` vao socket/batch hoac khong co mot bo suy luan. De xuat them optional enum, client cu van hop le; neu mobile chua gui thi policy chi dung distance/time.

State persistence policy khong nen chi dua vao `Map` cua process. Lua chon:

- lay latest persisted point tu MongoDB khi cache miss, sau do dung in-memory fast path;
- Redis atomic state khi bat, MongoDB fallback khi Redis tat;
- chap nhan approximate throttle nhung unique dedupe phai nam o MongoDB.

De xuat: MongoDB la correctness boundary; Redis/in-memory chi toi uu. Redis down khong duoc lam fail update.

### 4.7. Deduplicate realtime va batch

Unique `(userId, pointId)` chi bao ve batch. De bao ve cung GPS fix di qua hai kenh, co hai phuong an:

1. Them `pointId?` vao `update_location` va mobile dung cung UUID khi retry batch. Day la phuong an ro nghia nhat, nhung can mobile thay doi.
2. Backend tao `dedupeKey` tu timestamp millisecond va toa do da canonicalize, unique partial `(userId, dedupeKey)`. Hoat dong voi client cu, nhung can quy tac rounding on dinh va co rui ro gop hai fix that co cung gia tri.

Khong nen tao unique compound index truc tiep tren mang `location.coordinates`; no tao multikey semantics khong phu hop khoa cap toa do. Can quyet dinh truoc B2. Du lieu cu khong co khoa moi van hop le nho partial index.

### 4.8. Feature flag va config

Tat ca config moi duoc parse tap trung trong `src/config/env.js`, inject qua `src/container.js`, khong doc `process.env` trong domain.

Nhom de xuat:

```text
LOCATION_HISTORY_DENSE_ENABLED
LOCATION_HISTORY_MOVING_INTERVAL_SECONDS
LOCATION_HISTORY_MOVING_DISTANCE_METERS
LOCATION_HISTORY_IDLE_INTERVAL_SECONDS
JOURNEY_GAP_SECONDS
JOURNEY_MAX_POINTS_PER_SEGMENT
JOURNEY_SIMPLIFY_TOLERANCE_METERS
HISTORY_RANGE_DEFAULT_LIMIT
HISTORY_RANGE_MAX_LIMIT
HISTORY_RANGE_MAX_HOURS
LOCATION_HISTORY_RETENTION_DAYS (chi co hieu luc neu TTL duoc duyet)
```

Feature flag mac dinh tat la rollout bao thu nhat: deploy code/index, quan sat, sau do bat tren Render ma khong deploy lai. Neu mac dinh bat thi mobile co duong dep som hon nhung tang write/storage ngay lap tuc.

## 5. Uoc tinh mat do va dung luong

### 5.1. Diem moi gio

Voi rule moving dung dieu kien interval **va** distance:

| Cau hinh minh hoa | Lai xe 36 km/h | Di bo 1.4 m/s |
| --- | ---: | ---: |
| 10 giay + 20 m | toi da 360 diem/gio | xap xi 252 diem/gio |
| 15 giay + 25 m | toi da 240 diem/gio | xap xi 202 diem/gio |

So lieu gia dinh co GPS fix du va toc do on dinh. Thuc te con phu thuoc Core Location, accuracy, app lifecycle va mang. Motion policy iOS hien tai da gui automotive toi thieu 10 giay va walking toi thieu 20 giay, nen backend khong the tao diem day hon du lieu mobile da gui.

### 5.2. Kich thuoc BSON da do

Da khoi dong MongoDB in-memory, ghi qua Mongoose model/repository shape hien tai, doc raw document va dung `BSON.calculateObjectSize`:

| Document hien tai | Fields lien quan | BSON bytes |
| --- | --- | ---: |
| Realtime co accuracy | `_id`, `__v`, user, GeoJSON, timestamp, accuracy | 159 |
| Batch co UUID va accuracy | cac field tren + `pointId` | 209 |

Day la kich thuoc **uncompressed BSON document da ghi that** trong phep do. Chua gom index, allocator/storage-engine overhead, replication, hoac collection khac. Dung luong Atlas can theo doi bang collection stats/Atlas metrics production; khong suy dien index bytes tu BSON.

### 5.3. Gia dinh 5 nguoi trong 30 ngay

Scenario minh hoa, chua phai quyet dinh config: moi nguoi di chuyen 2 gio/ngay o moc 15 giay, va 22 gio con lai co heartbeat 5 phut.

```text
moving: 240 * 2 = 480 diem/ngay/nguoi
idle:   12 * 22 = 264 diem/ngay/nguoi
total:  744 * 5 * 30 = 111,600 diem
```

Raw BSON:

- theo shape realtime 159 bytes: khoang 16.9 MiB;
- theo shape batch 209 bytes: khoang 22.2 MiB.

Worst-case 5 nguoi di chuyen lien tuc 24/7 trong 30 ngay:

- 15 giay: 864,000 diem, khoang 131.0-172.2 MiB raw BSON;
- 10 giay: 1,296,000 diem, khoang 196.5-258.3 MiB raw BSON.

Atlas Free hien gioi han 0.5 GB va tinh ca uncompressed BSON **lan associated indexes**, theo [MongoDB Atlas Free Cluster Limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/#operational-limits). Vi collection con co `_id`, geo, user/timestamp va idempotency indexes, worst-case co the cham tran som hon phep tinh raw. Can dashboard alert va retention truoc khi bat dense persistence rong rai.

### 5.4. TTL/retention

TTL 30 ngay tren `timestamp` se tu xoa raw history cu, nhung:

- ngay cu hon retention se tra rong cho date picker;
- TTL monitor chay bat dong bo, khong dam bao xoa dung tung giay;
- index TTL phai la single-field;
- collection hien da co `timestamp_1`; neu bat TTL, migration nen dung `collMod` de doi index hien co hoac thay index mot cach co kiem soat;
- giam retention tren collection lon co the tao burst delete; nen xoa cu theo batch truoc.

Khong bat TTL trong B0 va khong bat trong B2 neu chua duoc phe duyet.

## 6. Hieu nang, cache va rieng tu

- Journey domain moi phai O(n) cho sort-da-co-thu-tu, gap scan, distance va segmentation. Douglas-Peucker can implementation iterative de tranh recursion depth voi route dai.
- Repository can projection, hard cap va query dung compound index. Khong load tuy y hang chuc nghin full document.
- B3 benchmark it nhat 1k/10k/50k synthetic points, ghi p50/p95 qua nhieu vong; test correctness tach rieng performance de CI khong flaky.
- Neu raw count vuot hard cap, API phai tra loi ro rang/yeu cau range nho hon; khong im lang cat raw points truoc khi tinh summary.
- Redis journey cache la optional. Neu dung: key khong log ra ngoai, gom user/date/config version; TTL ngan; invalidate khi persist diem trong ngay do. Redis loi thi query MongoDB.
- Cach an toan hon ban dau la **khong cache journey** cho den khi co metric query that, vi invalidation voi late/batch points de sai.
- Khong log toa do, raw cursor, access token, hoac userId gan voi thong tin vi tri. Metric chi dung count, reason enum, duration bucket va gap bucket.
- `403` giu message chung, khong query/tra count truoc khi authorization.

## 7. Rui ro va rollback

| Rui ro | Giam thieu | Rollback |
| --- | --- | --- |
| Write/storage tang dot bien | feature flag mac dinh theo quyet dinh, Atlas alert, metric persist reason | tat dense flag |
| Client cu thay doi journey | giu field cu; can nhac opt-in enriched mode | tat enriched mode/tra legacy builder |
| Gap/stay phan loai sai | fixture synthetic va golden regression | quay ve journey builder cu |
| Duplicate cross-channel | unique partial dedupe strategy da duyet | tat ghi dedupeKey, giu index partial vo hai |
| Index build anh huong deploy | migration rieng, kiem tra duplicate, build truoc feature | khong bat feature; drop index moi neu can |
| TTL xoa du lieu mong muon | khong bat truoc phe duyet, backup/retention notice | `collMod` tat TTL; du lieu da xoa khong khoi phuc neu khong backup |
| Event Loop bi chan | O(n), cap raw count, benchmark | tat enriched mode/giam max range |
| Redis khong san sang | MongoDB la correctness boundary | NoopCacheManager/fallback hien tai |

Thu tu rollout de xuat: index va code compatible -> deploy -> smoke test legacy -> bat telemetry -> bat feature flag -> theo doi storage/error/latency -> mobile opt-in. Rollback khong can deploy lai neu moi hanh vi duoc gate boi flag.

## 8. Execution Plan sau khi duyet B0

Moi stage la mot commit rieng, toi da khoang 8 file. Khong commit `README.md`/`PROGRESS.md` dang thay doi san neu chung khong thuoc stage da duyet.

### B1 - Pure domain va unit tests

Du kien 3-5 file:

- them/sua domain module cho normalize/sort/dedupe, Haversine total, gap analysis, iterative Douglas-Peucker va `shouldPersistHistoryPoint`;
- sua `src/domain/journey.js` chi neu can tach helper, chua wire production;
- them unit tests synthetic cho empty/one point, A-C-D, line/curve, duplicate, out-of-order, threshold boundary va gap-preserving thinning.

Verify: `npm test`, `npm run lint`, benchmark domain nho. Commit rieng B1.

### B2 - Dense persistence, dedupe va config

Du kien 6-8 file, tuy quyet dinh pointId/dedupe:

- `src/config/env.js`, `src/container.js`;
- realtime/batch use cases;
- location history repository/model;
- integration tests;
- migration/index script neu index moi duoc duyet (neu vuot 8 file, tach B2a/B2b va xin phep).

Bao dam batch van khong broadcast/stay alert. Late point khong ghi de last-known. Feature flag off phai cho hanh vi realtime cu. Commit rieng B2.

### B3 - Journey enriched

Du kien 4-7 file:

- journey domain;
- history use case/repository projection;
- DTO/query neu opt-in duoc chon;
- unit/integration/performance tests.

Them field, khong xoa/doi field cu. Test stay `arrivedAt/leftAt`, gap option da duyet, shared-Circle/self/outsider, va client legacy contract. Commit rieng B3.

### B4 - Raw range/cursor endpoint

Du kien 5-7 file:

- history Zod schema, route/controller;
- use case va repository cursor query;
- model index/migration neu chua co;
- integration tests pagination, equal timestamp, malformed cursor, max range, auth va legacy no-query.

Commit rieng B4.

### B5 - Contract va deploy

Du kien toi da 8 file:

- `api-docs/JOURNEY_ROUTE_API_DOC.md`;
- cap nhat `api-docs/LOCATION_UPDATE_API_DOC.md`;
- Swagger route docs;
- `.env.example`, `render.yaml`, README;
- `Study/route-geometry-backend-interview-notes.md`;
- `PROGRESS.md`.

Checklist: tao/verify index -> deploy backend -> smoke test legacy -> bat flag -> test mobile moi -> theo doi Atlas/latency -> rollback flag neu can. Commit rieng B5.

Moi stage chay that `npm test` (script da co `--test-concurrency=1`) va `npm run lint`; khong tuyen bo pass neu chua chay.

## 9. Can toi quyet dinh

1. **Gap:** de xuat 180 giay, khong bat buoc distance; chon A (tach segment) hay B (giu segment + gaps). De xuat B cho backward compatibility, A cho API opt-in/version moi.
2. **Dense persistence:** chon 10 giay + 20 m hay 15 giay + 25 m; idle heartbeat de xuat 5 phut. Chon feature flag mac dinh bat hay tat; de xuat tat khi deploy dau.
3. **Thinning:** max diem/segment va tolerance. De xuat 1,000 diem va 8 m, can benchmark tren duong synthetic.
4. **Retention:** co bat TTL khong va bao nhieu ngay. De xuat chua bat o lan dau; theo doi 30 ngay roi chon 30/60/90 ngay theo nhu cau date picker.
5. **Raw range:** default/max limit va max range. De xuat 500/1,000 diem va toi da 7 ngay moi request.
6. **Redis journey cache:** de xuat chua cache; chi them sau khi metric chung minh read latency can toi uu.
7. **Stay qua data gap:** de xuat gap-first, khong ket luan stay tu hai diem cach nhau qua nguong gap.
8. **Summary:** de xuat them `observedMovingSeconds`, giu nguyen `totalMovingMinutes` cu.
9. **Motion state:** co them `motionState?` vao socket va batch khong? De xuat co, additive; neu chua cap nhat mobile thi server van chay distance/time.
10. **Cross-channel dedupe:** de xuat them `pointId?` vao realtime va dung cung UUID voi batch; fallback dedupeKey chi neu bat buoc ho tro client cu ma khong the sua mobile.
11. **Enriched journey mode:** them mac dinh hay opt-in `detail=geometry`? De xuat opt-in de giu `path` legacy y nguyen va tranh payload lon cho client cu.
12. **Mot dau range bi thieu:** de xuat `from`-only suy ra `to = min(from + maxRange, now)`, `to`-only suy ra `from = to - maxRange`; hoac bat buoc cap `from/to` de contract don gian hon.

Chua co quyet dinh nao trong danh sach nay duoc ap dung.

## 10. Ngoai pham vi da ghi nhan

Map matching can mot task rieng de chon OSRM/Valhalla/dich vu ngoai, dieu khoan hien thi voi Apple Maps, chi phi Render, privacy khi gui history ra ngoai va caching geometry. Contract tuong lai co the them `geometry` mot cach additive, nhung task nay khong them field rong hay goi provider.
