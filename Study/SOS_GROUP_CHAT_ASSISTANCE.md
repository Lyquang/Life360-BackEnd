# SOS trong chat nhom va xac nhan den ho tro

Trang thai: Da duoc yeu cau hien thuc theo tung phan nho; S1a persistence hoan thanh de review.
Ngay: 2026-10-28. Pham vi repo da kiem tra: Backend JavaScript/CommonJS.
Chua kiem tra source iOS; cac hang muc mobile ben duoi la hop dong va ke hoach tich hop de xuat.

## Tien do review

- S1a: `src/domain/sos.js`, models `SosIncident.js`/`SosResponse.js`,
  `sosRepository.js`, `tests/sosPersistence.test.js`. Luat mot incident active/owner,
  unique requestId optional va unique responder/incident; mutation bat buoc transaction,
  compare-and-set revision cho close/respond. Chua noi container hay duong SOS cu.
- Repository la persistence noi bo, KHONG tu cap quyen: use case S2 phai authorize,
  touchActive va createResponse trong cung transaction. Duplicate-key abort transaction;
  use case chi load ket qua replay SAU rollback, khong tiep tuc query transaction da abort.
- Chua them expiry tu dong/TTL; status expired duoc du tru nhung chua co job hoac deadline.
  Chua tu chon push provider, response withdrawal hoac retention.
- S1b tiep theo: chat metadata/index/session support va outbox. Sau do S2/S3 noi
  use case, authorization/membership race, API/socket; S4 can tich hop iOS/push.
- Kiem chung S1a: 9 tests moi pass tren MongoMemoryReplSet; full suite 224/224 tests,
  53 suites. Lint, syntax tung file moi, diff check va context graph refresh pass.
  Chua co endpoint SOS moi de mobile test. Khong stage/commit/push.

## 1. Viet lai yeu cau de xac nhan

Khi A bam SOS, backend tao mot su co khan cap va tu dong gui mot tin nhan vao
MOI group chat tuong ung voi cac Circle ma A dang tham gia tai thoi diem do.
Vi du A thuoc Nhom Gia dinh (A, B, C) va Nhom Ban be (A, D, E), ca hai nhom
deu co tin nhan "A dang can ho tro khan cap". Khong gui vao DM 1-1 hay nhom A khong tham gia.

Tin nhan co nut "Toi se den ngay". B, C, D, E co the nhan ho tro dong thoi.
Khi B bam, backend luu B la nguoi nhan ho tro, bao cho A va cap nhat chat nhom
phu hop. A thay danh sach ai da nhan ho tro va thoi diem xac nhan, ke ca khi A
thoat app roi mo lai. Day la loi cam ket cua nguoi bam, KHONG phai xac nhan da den noi.

Mot nguoi nam trong nhieu nhom cua A chi duoc tinh mot lan trong danh sach ho tro
cua su co. Moi nhom van co mot tin SOS rieng; popup/push can deduplicate theo sosId.
Nguoi offline xem lai tin SOS va trang thai qua API sau khi ket noi lai.

"Nhan thong bao" can gom hai truong hop:

- App dang ket noi: Socket.IO cap nhat chat va man hinh SOS ngay khi server phat event.
- App nen/dong: can push notification iOS va dang ky device token. Repo hien chua co
  pipeline nay; chi lam Socket.IO thi chua hoan thanh yeu cau thong bao cho app nen.
  Push duoc gui best effort; khong duoc hien thi "tat ca da nhan" chi vi emit/gateway chap nhan.

## 2. Hien trang da doi chieu code

| File | Hanh vi hien tai |
| --- | --- |
| `src/presentation/socket/gateways/locationGateway.js` | Nhan `sos_alert`, validate, goi `location.sendSos`, tra `sos_confirmed` voi groupCount. Chua co ack callback cho SOS. |
| `src/application/location/locationUseCases.js` | `sendSos` chi lay nhom va emit `sos_alert` tung nhom; khong luu incident/chat/response. |
| `src/presentation/dto/location.schemas.js` | SOS cho message va toa do/pin tuy chon; chua co clientRequestId. |
| `src/application/chat/chatUseCases.js` | `sendMessage` luu message, cap nhat lastMessage/read pointer, emit `chat:new_message`; flow nay chua transaction cho fanout SOS. |
| `src/infrastructure/database/models/ChatMessage.js` | Chi co type text/image/voice; chua co SOS metadata. |
| `src/application/chat/chatMappers.js` | Mapper dung cho history va lastMessage, can them metadata o ca hai duong. |
| `src/application/groups/groupUseCases.js` | Create/join/leave/remove dong bo Circle va Conversation membership; leave/remove da unsubscribe rooms. |
| `src/infrastructure/realtime/socketRealtime.js` | Co port emit toi user, group, conversation; emit khong bao dam client da nhan. |
| `src/infrastructure/database/unitOfWork.js` | Ho tro transaction; local standalone fallback KHONG bao dam atomicity. SOS moi can replica set. |
| `tests/api.test.js`, `tests/locationSharingPrivacy.test.js` | Da test SOS circle broadcast, confirmation va SOS khi sharing paused. |

Chua tim thay APNs/FCM adapter, device-token model hay push registration trong src/package.json.
CLAUDE.md huong dan dung Clean Architecture, nhung bang message type trong tai lieu da cu;
ke hoach nay dua tren implementation text/image/voice thuc te.

## 3. UX va quy tac nghiep vu de xuat

1. A bam SOS: tao su co status `active`, tin chat duoc luu truoc khi bao thanh cong.
2. Mobile moi render SOS card tu metadata; mobile cu van doc duoc content text.
3. B bam nut: hien dang gui, chi hien da nhan ho tro sau response thanh cong.
4. A thay "B se den ho tro" va danh sach nguoi ho tro cap nhat realtime.
5. A bam "Toi da an toan" hoac "Huy SOS": dong su co, tat nut nhan ho tro.
6. Khi reconnect: tai lai incident/response qua REST, khong dua duy nhat vao socket.
7. De xuat mot SOS active/user; bam lai tra su co dang active, khong spam moi group.
8. Chua co Circle: tra loi nghiep vu ro rang, khong noi da gui; mobile huong dan
   lien he nguoi than/dich vu khan cap bang luong rieng.

Su co luu tap nhom/nguoi nhan tai luc tao. Nhap nhom sau khong duoc tu dong them vao
audience SOS dang active. Quyen xem/respond phai kiem tra lai membership hien tai.
Nguoi roi/bi xoa khoi nhom khong tiep tuc nhan vi tri/cap nhat SOS cua nhom do.
Neu con chung mot nhom trong audience thi van co the duoc truy cap qua nhom do.

SOS la hanh dong chia se vi tri chu dong va van duoc phep khi chia se thuong bi pause,
giu hanh vi cu. Chi dung toa do do client gui cho SOS; khong tu lay vi tri rieng tu
cu tu cache. Thieu toa do van gui SOS, hien "Chua co vi tri".

## 4. Thiet ke du lieu va chong trung

### SosIncident (model moi)

- `ownerId`, `clientRequestId?`, `status: active|resolved|cancelled|expired`.
- `groupIds`, `recipientIds` la snapshot audience; query response phai loc quyen hien tai.
- `message`, `location?`, `locationRecordedAt?`, `createdAt`, `closedAt?`, `expiresAt?`, `revision`.
- Partial unique `(ownerId, clientRequestId)` chi khi co requestId.
- Partial unique `ownerId` khi `status=active`, neu duyet quy tac mot SOS active/user.
- `expiresAt` dung quy tac nghiep vu, KHONG dung TTL xoa incident dang can chat tham chieu.
  Can job chuyen status va kiem tra het han trong use case, khong phu thuoc job chay dung gio.

### SosResponse (model moi)

- `sosId`, `responderId`, `status: coming`, `respondedAt`.
- Unique `(sosId, responderId)`: nhan nut hai lan/hai thiet bi van mot response.
- Khong luu dia chi/vi tri B chi vi B nhan ho tro.
- A xem toan bo response; thanh vien khac chi xem nguoi ho tro cung nhom duoc phep.
- De xuat bo sung rut lai `withdrawn` neu chu du an can; chua ngam hieu "coming" la "arrived".

### ChatMessage (mo rong additive)

Giu `type: text` va content fallback, them metadata do server tao:

```json
{
  "type": "text",
  "content": "A dang can ho tro khan cap.",
  "sos": { "id": "<sosId>", "kind": "alert" }
}
```

Tin response: `sos.kind=assistance`, content "B: Toi se den ngay" va responderId.
Unique partial `(conversationId, sos.id)` cho kind=alert; unique partial
`(conversationId, sos.id, senderId)` cho kind=assistance. Khong dung sparse compound
index thay cho partial filter, vi message cu co conversationId/senderId nhung khong co sos.
Client khong duoc tao SOS metadata qua endpoint chat text thong thuong.
Trang thai SOS tren card doc tu incident/revision; content tin lich su khong phai trang thai hien tai.
Toa do khong chen vao text chat/push; mo incident qua API da xac thuc de xem.

### Outbox cho event/push (model moi)

Luu event key duy nhat, kind, reference IDs, pending/delivered, attempts, nextAttemptAt,
leaseUntil va thoi gian tao cung transaction incident/chat. Worker lease atomic de
khong xu ly trung khi co nhieu instance; retry co backoff/jitter, gioi han va metric failed.
Payload nhay cam chi nap khi xu ly va kiem tra lai audience; khong log noi dung/IDs/toa do/token.
Emit sau commit; khong emit trong transaction callback vi callback co the retry.
Crash sau emit truoc danh dau delivered co the phat lai: client dedupe theo eventId/messageId.
Da emit != da doc != da nhan ho tro; outbox khong tao bao dam exactly-once tren socket/push.

## 5. Luong xu ly

```mermaid
sequenceDiagram
    actor A as Nguoi can ho tro
    participant MA as iOS cua A
    participant G as REST/Socket Gateway
    participant U as SosUseCases
    participant DB as MongoDB replica set
    participant W as Outbox Dispatcher
    participant RT as Realtime / Push Port
    participant MB as iOS cua B,C,D
    A->>MA: Bam SOS
    MA->>G: Tao SOS, clientRequestId
    G->>U: User tu JWT va payload da validate
    U->>DB: Transaction incident + chat tung nhom + outbox
    DB-->>U: Commit
    U-->>G: sosId, status, groupCount
    G-->>MA: HTTP 201 / sos_confirmed
    W->>DB: Claim outbox, recheck quyen
    W->>RT: Phat chat:new_message va sos_alert
    RT-->>MB: Socket; push neu da tich hop
    Note over MA,MB: Dedupe popup theo sosId, tin chat theo messageId
    MB->>G: POST /sos/{id}/responses
    G->>U: Xac nhan coming cho user tu JWT
    U->>DB: Transaction response unique + chat + outbox
    DB-->>U: Commit / response da ton tai
    U-->>G: Response persisted
    G-->>MB: HTTP 201 / 200 khi retry
    W->>RT: sos:updated va chat:new_message
    RT-->>MA: B se den ho tro
    MA->>G: GET /sos/{id} khi reconnect
    G->>U: Load incident va responders co quyen
    U-->>MA: Snapshot co revision
```

MongoDB la nguon su that; Redis khong bat buoc cho tinh dung SOS.
Dong thoi close/respond phai cung ghi incident (conditional status/revision) de transaction
khong chap nhan response sau khi dong. Snapshot read rieng khong du de tranh race.
Create/respond vs leave/remove can membership revision/guard chung trong transaction voi
groupRepo va groupUseCases; recheck truoc dispatch, khong chi tin socket room cu.
Tin chat response chi vao cac nhom cua incident ma ca A va B con quyen; khong gui danh tinh
B sang nhom B khong tham gia. A nhan event truc tiep vao user room tren moi thiet bi.
Fanout can do voi nhieu nhom/thanh vien; neu transaction qua lon, chuyen sang fanout ledger
idempotent theo group va tra trang thai dang gui, khong bao da gui het khi moi xu ly mot phan.

## 6. Hop dong API/socket de xuat (chua phai API da co)

Tat ca REST dung Bearer va response `{ success, data }` / loi chuan cua repo.

| Method/path | Muc dich |
| --- | --- |
| POST `/api/v1/sos` | `{clientRequestId: UUID, message?, latitude?, longitude?, recordedAt?}`. 201 khi tao, 200 khi replay/active da ton tai. |
| GET `/api/v1/sos?status=active&cursor=...&limit=...` | Incident cua minh/duoc nhan, phan trang va loc quyen. |
| GET `/api/v1/sos/:id` | Snapshot incident, revision, response list phan trang/co gioi han theo quyen. |
| POST `/api/v1/sos/:id/responses` | `{status:"coming"}`. Responder lay tu JWT; 201 moi, 200 retry. |
| PATCH `/api/v1/sos/:id` | Owner dong incident: `{status:"resolved"|"cancelled"}`; idempotent. |

Loi de xuat: 400 payload sai/no eligible group; 401 token sai/het han; 403 khong co quyen;
404 khong co incident; 409 incident da dong/het han; 429 rate limit co Retry-After.
Rate limit rieng cho tao/respond theo user (ca HTTP va socket); muc cu the can duyet.

- Giu `sos_alert` client cu, them clientRequestId optional; delegate cung use case voi REST.
- Giu `sos_alert` server va `sos_confirmed` fields cu; them sosId/status de client moi dong bo.
- Them `sos:updated` voi eventId/sosId/revision va du lieu loc theo audience; client fetch
  snapshot neu thieu event/qua revision. Danh sach toan bo responders chi gui cho owner.
- `chat:new_message` giu event cu, them sos metadata. Khong phat hai tin chat cho cung action.
- Moi SOS cu khong co requestId chi duoc dedupe qua active incident; khong hua dedupe duoc
  retry cua client cu sau khi su co da dong.
- Khong bat buoc socket event moi de respond: mobile dung REST co response ro rang,
  socket dung de cap nhat cac thiet bi. Optional ack cho SOS cu khong lam vo event hien tai.

## 7. Execution Plan theo tang

### S1: Domain va persistence

- Tao `src/domain/sos.js`: transitions, authorization policy, idempotency policy.
- Tao models `SosIncident.js`, `SosResponse.js`, `SosOutbox.js` va repositories tuong ung.
- Sua `ChatMessage.js`, `messageRepository.js`, `conversationRepository.js`,
  `conversationMemberRepository.js` de ho tro metadata va session cho flow SOS.
- Them session-aware membership snapshot/guard o `groupRepository.js` va hook leave/remove
  trong `groupUseCases.js` neu can de giai quyet race. Khong refactor chat thuong ngoai pham vi.
- Verify index voi du lieu message cu; replica set bat buoc cho tinh nang moi.

### S2: Application va delivery

- Tao `src/application/sos/sosUseCases.js`: create/list/get/respond/close.
- Tao dispatcher application va infrastructure outbox adapter; scheduler chi goi use case.
- `locationUseCases.sendSos` delegate use case moi de giu client cu, tranh hai luong nghiep vu.
- DI trong `src/container.js`; start/drain dispatcher trong `src/bootstrap.js`.
- Cap nhat `chatMappers.js` de lastMessage va paginated messages deu co SOS metadata.

### S3: Presentation va docs

- Tao `src/presentation/dto/sos.schemas.js`, HTTP controller/routes SOS, dang ky o app.js.
- Sua locationGateway, socketEventDocs, rateLimiter; mapping loi phai ro rang voi client cu/moi.
- Tao `api-docs/SOS_ASSISTANCE_API_DOC.md`: payload, vi du, retry, permission, UI states,
  reconnect, multi-group dedup, push deep link, va gioi han delivery.
- Cap nhat README/CLAUDE.md, tai lieu mobile lien quan, PROGRESS va `npm run context:graph`.

### S4: iOS va background push (can chot de hoan thanh day du)

- Them SOS card va nut "Toi se den ngay", danh sach nguoi ho tro cua A, trang thai dong.
- Main-thread UI, optimistic pending/retry, idempotency UUID giu qua retry va reconnect REST.
- Backend device registration/revoke endpoints, device-token model, push provider port/adapter.
- Chon APNs truc tiep hoac FCM sau khi kiem tra cau hinh iOS hien co. Credentials luu env/secret.
- Dang ky/thay token, logout/unbind, sandbox/production, invalid-token cleanup; outbox dedupe
  theo incident/user/device. Khong include toa do/nhom/danh sach nguoi trong push preview.
- Push mo vao incident da xac thuc; khong tu submit hanh dong ho tro chi vi nguoi dung mo push.
- Chi realtime/persisted chat hoan thanh S1-S3; khong ghi "hoan thanh tat ca thong bao" khi S4 chua xong.

## 8. Kiem thu bat buoc

- A o hai nhom: mot incident, hai tin chat; lastMessage/unread dung va history mo lai van co tin.
- B o ca hai nhom: mot response, popup khong trung; hai thiet bi bam cung luc van mot ban ghi.
- B va C bam dong thoi: A thay ca hai; retry create/respond khong tang so message.
- Stranger, responder tu nhan la A, client gia sender/sos metadata, member da leave bi tu choi.
- D o nhom khac nhan SOS nhung khong thay danh tinh B neu khong chung nhom B.
- SOS khi sharing paused van hoat dong; thieu vi tri khong tu doc vi tri an; khong log toa do.
- DB rollback khong phat event; crash sau commit truoc emit duoc outbox xu ly; worker restart/lease.
- Close/respond va create/leave race co ket qua nhat quan; event toi cham khong mo lai card da dong.
- Offline/reconnect lay du snapshot; push bi tat/loi khong danh dau da giao thanh cong.
- Tuong thich client cu, sos_confirmed cu, tin text/image/voice, unread va pagination khong doi.
- MongoMemoryReplSet integration + socket.io-client; `npm test`, lint va diff check.
- iOS that: foreground/background/app terminated, hai tai khoan/nhieu nhom, push va deep link.

## 9. Danh doi, rollout va rollback

- Text + metadata giu kha nang hien thi tren app cu; nut ho tro chi co sau khi cap nhat iOS.
- Outbox them model/job nhung giu duoc su co khi server restart; realtime va push van co the trung.
- Fanout durable ton write/storage theo so nhom; can gioi han payload va benchmark thay vi
  transaction/unbounded array qua lon. Response list dung pagination.
- De xuat flag rieng `SOS_ASSISTANCE_ENABLED`, rollout local truoc. Flag tat giu SOS cu;
  viec tat creation moi khong duoc lam mat quyen doc/dong incident da tao.
- Rollback dung tao incident moi, giu model/index du lieu cu; drain/pause outbox co chu dich,
  khong xoa tin SOS/response de rollback.
- Retention phai thong nhat giua incident, response, chat va outbox; chua tu dat TTL xoa toan bo.
- Observability chi counter outcome/queue lag/retry/drop; khong labels theo ID hay noi dung SOS.

## 10. Can chu du an quyet dinh

1. Background push co trong dot nay khong? De xuat co de dap ung "tat ca thanh vien";
   can kiem tra iOS/APNs/FCM truoc khi chon adapter. Neu chi S1-S3, phai ghi ro chi realtime
   va tin luu lai, khong thong bao he thong khi app nen.
2. Mot SOS active/user, A co nut "Da an toan"/"Huy", het han sau 24h co phu hop khong?
   Day la de xuat; thoi han va retention chua duoc chot. Co can B rut lai loi nhan ho tro khong?
3. Dong y A thay tat ca responders, moi nhom chi thay responders thuoc nhom minh khong?
   De xuat dong y de khong lo danh tinh giua cac nhom khac nhau.
4. Dong y thong diep fallback la "A dang can ho tro khan cap" va "B: Toi se den ngay",
   metadata dung de iOS localize va tao button? De xuat co; khong them type SOS moi lam hong enum cu.

Hien thuc theo tung phan nho de review theo yeu cau ngay 2026-10-28. Cac quyet dinh
push/retention/rut lai chua chot duoc de lai cho phan lien quan. Khong tu commit/push.
