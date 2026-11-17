# Bắn tàu — hợp đồng dữ liệu/API đề xuất

**Hợp đồng hiện hành đã được đối chiếu source; phần bổ sung `revealedSunkShips` thuộc đợt polish.** Payload/schema đặt trong shared, transition và projection trong engine, room orchestration trong server, UI chỉ gửi intent. Xem trạng thái triển khai tại [09-polish-implementation.md](./09-polish-implementation.md). Dựa trên [HQ-BANTAU-1](../../bantau-rules.md), [UI](./03-ui-ux.md) và kiến trúc RAM hiện tại.

## 1. Biên kiến trúc

- Engine dự kiến `packages/bantau/`, không import React, shared, Socket.IO, Date.now, Math.random hoặc timer hệ thống. State/transition/validation/projection tách file theo nhu cầu, RNG/now truyền từ server.
- Shared có dependency/type import từ engine như các game hiện tại; không tạo vòng engine → shared → engine. Schema payload/snapshot strict nằm ở shared.
- `server/src/rooms.ts` quản lý ghế, session generation, timer, điểm, intermission và gọi engine; server dùng crypto RNG. `server/src/index.ts` xử lý envelope, ACK/cache/rate limit và emit riêng người nhận.
- `src/api/*` là lớp truyền thông duy nhất. Component chỉ gửi intent/hiển thị snapshot, có preview/pointer math/layout/motion; không tự xác định trúng, fleet hợp lệ, hết giờ, tàu chìm, random shot hoặc thắng.
- Không mở plugin framework, database, Redis, nhiều replica hoặc refactor cả ba engine để thêm game này.

## 2. Settings/catalog

`bantau`: name “Bắn tàu”, minPlayers=maxPlayers=2. Settings gồm gameKey, targetScore, turnSeconds dùng range hiện tại; boardSize 8/10/12, shipCount 3/4/5, hitContinues boolean, allowTouch boolean. setupSeconds=90, resolveMs=900, maxRoundActiveMs=30 phút là hằng server công bố read-only, không nhận override client.

`/api/games` trả availability/defaults/options của Bắn tàu độc lập dictionary Nối từ. Public room summary chỉ thêm gameKey/settings an toàn, không ship position, aim, fleet state hoặc seed. Client không hardcode thêm option khác với schema server.

## 3. State engine và identity

| Phần | Nội dung dự kiến |
|---|---|
| Định danh | gameId riêng mỗi ván, public revision, setupId, turnId mới cho từng phát, shotId/eventId duy nhất, shipId ổn định trong ván, playerId ổn định ghế |
| Pha | setup / turn / resolving / finished; room.phase dùng playing cho setup/turn/resolving, finished cho kết quả/intermission |
| Players | đúng hai id/nickname, placementLocked, fleetRevision, fleet gồm shipId/length/anchor/orientation/cells, damage/hit mask |
| Mục tiêu riêng | actor/turnId/cell/aimSequence, private revision; không dùng localStorage làm nguồn aim |
| Đồng hồ | setupDeadlineAt, turnDeadlineAt, resolveAt, remaining khi pause, active duration ván và round-limit deadline; engine nhận now |
| Phát bắn | lastShot giới hạn một bản ghi, actor/target/row/col/result, manual/timeout, commit time; không mảng miss history |
| Resolving | pendingNextPlayerId và resolvingId; sau 900 ms engine chuyển lượt, reset aim và cấp deadline mới; finished không có pending turn |
| Kết quả | winnerId hoặc null; reason fleet-sunk / resign / round-limit / generation-failed, hủy không tính điểm |

Không gửi internal state nguyên khối qua JSON. Public revision tăng khi phát bắn/ready/phase/kết quả đổi. Chỉnh fleet riêng và aim có private version/sequence; không bump deadline/TTL tiến triển. Hai người cùng xếp tàu không được gây vòng stale do chỉnh riêng.

## 4. Projection riêng từng người

Tránh tên gây hiểu nhầm: `BantauPlayerSnapshot` là **snapshot cá nhân**, đặt trong nhánh `RoomSnapshot` gameKey bantau; không phải một broadcast chung cho cả phòng.

- Phần chung: gameId, public revision, phase/settings, hai player summaries + locked/sunkCount, currentPlayerId, turnId, deadline/remaining/serverNow, result và capabilities của người xem.
- `ownFleet`: toàn bộ tàu của chính mình, damage và fleetRevision; aim của chính mình kèm sequence nếu còn hợp lệ. `ownIncomingHits`: chỉ thông tin trúng đã công khai, không miss history.
- `targetBoard`: chỉ unknown/hit/sunk; hit chưa chìm không có shipId/type/length/orientation. `revealedSunkShips` bổ sung nhóm cho đúng tàu đã chìm để render bền sau reload; mỗi mục chỉ có displayId chung/length/cells, và schema kiểm tra mọi cell trong nhóm đã có trạng thái sunk, nằm trong bàn, không trùng. ID nội bộ và mọi tàu chưa chìm luôn kín. Không gửi nguyên board rồi cho React che.
- Capabilities: canEditFleet, canRandomize, canLock, canAim, canFire, canResign cùng lý do khóa. Không trả danh sách “ô chưa bắn” dựa trên miss; nếu cần ô hợp lệ thì phải là mọi ô trừ hit/sunk theo luật đã chốt.
- Không full reveal cuối ván trong bản đầu; người còn lại không nhận tàu chưa bị đánh trúng chỉ vì ván xong. Không ảnh thumbnail tàu đối phương trong public listing.

## 5. Intent, ACK và phiên bản

Tên event đề xuất, cần Luna phiên 0 kiểm tên/routing thực tế trước khi khóa:

| Event / intent | Dữ liệu và quy tắc |
|---|---|
| `bantau:placement` → moveShip/rotateShip/replaceFleetRandom | actionId, roomId, gameId, setupId, expectedFleetRevision; move thêm shipId + ô neo, rotate thêm hướng. Server tạo/kiểm fleet; owner-only result và tăng private fleetRevision. Không dùng room revision chung cho từng drag để tránh hai bên xếp tàu gây stale lẫn nhau. UI chỉ gửi một lệnh khi thả, không gửi pointermove. |
| `bantau:action` → lockFleet | action envelope hiện tại + gameId/setupId + expectedFleetRevision. Bất kỳ stale public revision phải resync, không lặng lẽ khóa fleet khác với người dùng đang thấy. |
| `bantau:aim` → aim/clearAim | actionId, roomId, gameId, turnId, aimSequence tăng đơn điệu + tọa độ/null. Không tự tạo deadline mới, không tăng public revision; ACK riêng với confirmed aim/sequence. |
| `bantau:action` → fire | action envelope có expectedRevision + gameId, turnId, tọa độ và confirmed aimSequence. Phải khớp aim đã xác nhận, phiên hiện tại và phase turn; không client outcome. |
| `bantau:action` → resign | action envelope + gameId; cho trong setup/turn/resolving khi ván chưa xong. Server chốt thua ván một lần. |
| Nội bộ server | expireSetup, expireTurn, advanceResolution, expireRound, pause/resume; không nhận client intent tương ứng để ép timer. |

Private mutation vẫn kiểm phiên socket/generation, game/phase và version riêng. Đây là ngoại lệ có chủ đích so với public expectedRevision, không bỏ kiểm version. Public commit lock/fire/resign tiếp tục expectedRevision như các game hiện tại. Chặn aim sequence cũ/giảm, movement sau khóa, coords ngoài bounds và payload thừa. Toàn bộ ACK/cache scope theo session/player, không dùng cache actor khác để trả fleet/aim.

ACK theo ApiReply hiện có: success hoặc code/message tiếng Việt, owner-safe data khi cần; lỗi trả không chứa fleet đối phương hoặc stack trace. Cached retry cùng actionId/payload trả cùng response và không emit effect nữa; cùng ID payload khác bị từ chối. Timeout là event/action do server cấp ID, không dùng ID client đoán.

Rate limit dùng cơ chế chung cộng hạn riêng cho aim/placement (đề xuất 8/s/seat, coalesce/debounce preview ~120 ms; không gửi pointermove 60fps). Rate limiting không gia hạn giờ và không bỏ qua fire hợp lệ vì socket của đối thủ spam. Client request fire có thể chạy sau aim ACK, không chung global busy khiến ACK stale đánh nhầm ô.

## 6. Sự kiện

- `room:snapshot`: từng seat nhận projection riêng. Không tái sử dụng payload của host cho khách.
- `bantau:private-state`: chỉ owner đang ở socket generation hiện tại, chứa gameId/setupId hoặc turnId, public revision tương ứng, fleetRevision/aimSequence và phần riêng cần cập nhật. API client merge chỉ nhánh cá nhân nếu version mới và context khớp. Resume luôn có snapshot đầy đủ của chính mình để phục hồi.
- `bantau:effect`: payload an toàn chung cho shot committed, có eventId/shotId, room/game/public revision, turnId phát đã bắn, actor/target, tọa độ, result hit/miss/sunk, source manual/timeout, serverTime và presentationExpiresAt. Chỉ sunk mới chứa cells đã công bố. Không dùng schema `game:effect` của UNO làm wildcard.
- Effect chấp nhận khi game đúng và revision đã được snapshot xác nhận; nếu tới trước snapshot thì buffer ngắn theo ID, nếu snapshot phase resolving đã advance thì vẫn cho phát còn tươi khi cùng game và không có shot mới hơn. Không đòi room revision bằng tuyệt đối sau mọi update vì resolving/timer có thể đi trước effect. Bỏ event hết hạn/đã thấy, không replay khi reconnect.
- Miss chỉ có thông tin ở live event tạm. Snapshot/ACK replay không trả miss history; dedupe cache chỉ giữ xác nhận lệnh, không giữ bản đồ miss cho client tải lại. UI không dựng dấu miss từ cached ACK. Mạng/người chơi vẫn có thể tự ghi nhớ live event, không hứa chống ghi chép.

## 7. Timer và race

- Mỗi callback mang roomId, gameId, phaseId (setupId/turnId/resolvingId), deadlineAt; callback stale không làm gì. Kiểm now trước khi transition.
- Đường action và timer callback cùng gọi hàm resolve overdue trước public commit. Tại biên now >= deadline, expireTurn bắn đúng một lần; action đến muộn trả ACTION_EXPIRED + resync, không tiếp tục với lượt mới.
- Setup hết hạn đồng thời lockFleet: một transition; hai khóa cùng lúc không mở hai lượt đầu. Bắn chìm cuối/resign đồng thời resolving callback: một finish và +10 một lần.
- Pause đóng băng cả setup/turn/resolving/round-limit và intermission; một nguồn remaining, resume tính deadline mới. Không tạo thêm đồng hồ client quyết định kết quả.
- Leave/kick/grace/cleanup/round-limit hủy và dọn toàn bộ timer/private state/pending effect. Không gọi `settleRound(null)` mặc định nếu mục tiêu là hủy trận: tránh tự nối trận hòa vô hạn.
- Server đã có `settleRound`, `scheduleNextRound`, `startRound`, `cancelMatch`; dùng lại điểm/countdown nhưng bổ sung tạo game setup và luân phiên người bắn đầu. Không dùng đường UNO timeout loại ghế cho Bắn tàu.

## 8. Mã lỗi dự kiến

Giữ mã chung: ROOM_NOT_FOUND, ROOM_FULL, WRONG_GAME, SESSION_REVOKED, STALE_REVISION, NOT_PLAYING, GAME_PAUSED, RATE_LIMITED, ACTION_EXPIRED và mã duplicate/action cache hiện có. Tên mã chung phải tra repo trước khi dùng, không tạo biến thể gần giống.

Mã riêng đề xuất: WRONG_PHASE, NOT_YOUR_TURN, OUT_OF_BOUNDS, UNKNOWN_SHIP, SHIP_OVERLAP, SHIPS_TOUCHING, FLEET_LOCKED, STALE_FLEET, STALE_AIM, NO_CONFIRMED_AIM, CELL_ALREADY_HIT, FLEET_GENERATION_FAILED. Ghi mapping UI tiếng Việt và phân biệt lỗi resync với lỗi cần người dùng sửa thao tác.

## 9. Điều kiện nghiệm thu hợp đồng

Test projection/serialization cho hai người, public list, ACK cached/lỗi/effect/private-state; không chỉ kiểm DOM. Biến đổi tàu chưa lộ của đối thủ mà giữ mọi thông tin công khai giống nhau phải không làm target snapshot/capabilities/revealedSunkShips khác. Thử session cũ, out-of-order aim A/B, reload sau ACK, fire/timeout tại biên, setup simultaneous, reconnect trong resolving và leave countdown. Đây là phần bắt buộc trước nối UI.
