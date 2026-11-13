# Kiến trúc MVP hiện tại

> BB-UNO-1 (`uno-rules.md`) đã được triển khai. Engine dùng predicate chung cho server validation và `allowedActions` trong projection riêng từng người. Khoản phạt có tổng, loại cuối và người nhận. Đánh lá cuối hợp lệ chốt thắng ngay và xóa phạt đang chờ. Mọi thay đổi async/đóng phòng phát snapshot/event lifecycle; RAM vẫn mất khi process dừng.

Trạng thái: hai game UNO + Nối từ, một backend process, state trong RAM; Nối từ chờ Terra nghiệm thu.

## Các vùng code

| Đường dẫn | Trách nhiệm |
|---|---|
| `src/App.tsx` | Điều hướng giao diện, nickname/session localStorage, socket client, snapshot và hành động người chơi. Có bàn xem thử tách khỏi bàn trực tuyến. |
| `src/components/` | Chỉnh biệt danh và chia sẻ link/mã; các thành phần Lucian #033 và #008 đã được port. |
| `src/styles/` | Token giao diện, thành phần và layout responsive/reduced motion. |
| `packages/shared/src/index.ts` | Catalog UNO/Nối từ, `RoomSnapshot` discriminated union và Zod schema cho nickname, mã, phiên, room/game action/draft. |
| `packages/uno/src/index.ts` | Deck, setup, state, luật, validation, transition và private projection; không nhập React/Socket.IO. |
| `packages/noitu/src/index.ts` | Engine NT-VI-1 thuần TypeScript, dictionary interface, lượt/proposal/vote/timer state và public projection. |
| `server/src/rooms.ts` | Room/session trong RAM, host, public/private, ready, start, kick/leave/rematch, reconnect, timeout và cleanup. |
| `server/src/index.ts` | HTTP/static, Socket.IO, parse payload, action ID/revision, quyền hiện hành, broadcast snapshot theo người nhận và rate limit. |

Khi thêm trò mới, dùng `gameKey` và catalog hiện tại làm điểm nối. Chưa có plugin framework hay luật game tổng quát.

## Luồng dữ liệu

1. `room:create`/`room:join` nhận nickname hoặc mã qua Zod. Server cấp `playerId` và token ngẫu nhiên 256-bit; chỉ token được lưu ở localStorage để nối lại.
2. Mỗi room có `roomId`, `code`, host, visibility, revision và các ghế. Phòng công khai được lọc ở server; private không nằm trong `/api/rooms`.
3. Server bắt đầu khi có từ 2 người, tất cả online và mọi khách sẵn sàng. Host xác nhận bằng `room:start`.
4. Client chỉ gửi intent. Server xác thực phiên/socket hiện tại, mã hành động, revision, phase, quyền, lượt và luật; sau đó gửi `room:snapshot` riêng cho từng người.
5. UNO snapshot gồm tay của chính người xem; đối thủ chỉ có tên và số lá. Nối từ snapshot chỉ gửi mạch/lịch sử công khai và quyền hành động; không gửi `usedWords`, nguyên bộ từ điển hoặc token.

Sau mỗi hành động game hợp lệ, server phát thêm `game:effect` sau snapshot tương ứng. Payload công khai có eventId theo game revision, room/game revision, action, người chơi liên quan và mặt lá đã đánh; lượt rút chỉ có số lượng, không có ID/mặt bài. Client chỉ phát animation khi snapshot hiện tại khớp chính xác cả hai revision. Duplicate action không phát event lần hai; event cũ bị bỏ. Event chỉ điều khiển trình bày, không thay đổi engine hoặc quyết định nước đi.

Các event gồm `room:create`, `room:join`, `session:resume`, `room:ready`, `room:visibility`, `room:start`, `room:kick`, `room:leave`, `room:rematch` và `game:action`. Client dùng `actionId` UUID, `roomId`, `gameId`, `expectedRevision`; server xác thực gameId và revision để chặn nước từ ván cũ. Action duplicate cùng payload nhận cache; ID trùng payload khác bị từ chối. Mỗi socket giới hạn 100 event/10 giây.

Nối từ dùng `noitu:action` cho submit/giveUp/vote và `noitu:draft` cho phần nhập tạm. Draft được xác thực theo socket/room/game/turn, sequence và rate limit; chỉ gửi trong room, không tăng revision và bị xóa khi đổi pha/lượt, pause hoặc cleanup. Voter, quorum, dictionary membership và deadline đều do engine/server quyết định. `/api/games` trả tình trạng sẵn sàng; loader lỗi tắt riêng Nối từ.

## UNO

`packages/uno` tạo bộ 108 lá và ID ổn định mỗi game, chọn dealer, chia bài, mở bàn trống bằng lá người đi đầu chọn, lượt, rút/giữ/đánh lá vừa rút, chọn màu, +2/+4 cộng dồn, Reverse, Skip, UNO/catch, tái tạo chồng rút và kết thúc. Luật và lựa chọn triển khai nằm ở [uno-rules.md](uno-rules.md).

RNG của engine được tiêm qua tham số để test; server dùng `node:crypto`. Mọi hành động sai bị từ chối trước khi thay đổi state.

## Nối từ

`packages/noitu` nhận dictionary interface và clock/RNG qua tham số. `server/src/noitu-dictionary.ts` nạp playable list một lần từ data pin và xác minh SHA/count/seed; danh sách không được import vào frontend. `RoomService` sở hữu deadline, pause/resume và cleanup; engine không phụ thuộc timer hay Socket.IO. Proposal vote giữ nguyên người có quyền bỏ phiếu và phần thời gian lượt đã đóng băng.

Snapshot Nối từ có gameId/turnId, currentWord/requiredSyllable, deadline/remaining, lịch sử giới hạn và dictionaryVersion. Người chơi chỉ thấy draft realtime hiện thời, không thấy từ đã nhập sai hoặc used words. Luật, quorum và giới hạn dữ liệu nằm ở [noitu-rules.md](noitu-rules.md) và [data/word-chain](../data/word-chain/README.md).

## Phiên và vòng đời

- Token là opaque random, server giữ SHA-256 digest. Resume có token hợp lệ nối lại cùng ghế và tăng generation; socket cũ mất quyền.
- Mất kết nối giữ ghế tối đa 90 giây và phát trạng thái offline. Reconnect resume đúng ghế; hết hạn hủy ván/ghế và phát snapshot hoặc room-close tương ứng. Chơi không tiến triển 15 phút cũng hủy ván. Phòng chờ không hoạt động hết 30 phút; phòng trống dọn ngay.
- Host rời phòng thì quyền chuyển cho người online vào sớm nhất. Kick trong ván hủy ván, xóa ghế và đưa người còn lại về chờ.
- Room cap mặc định 2.000; public directory trả tối đa 100 phòng chờ còn chỗ. Event/action cache có giới hạn.
- Restart server làm mất toàn bộ phòng/token; localStorage không phục hồi state đã mất. Client resume lỗi xóa session cũ, về sảnh và thông báo lý do.

## Triển khai

`npm run dev` chạy Vite và backend. `npm run build` tạo frontend trong `dist/`; `npm start` dùng một Node process phục vụ static, `/health`, `/api/rooms` và Socket.IO cùng origin. Bind LAN mặc định `0.0.0.0`; public production cần HTTPS/reverse proxy hỗ trợ WebSocket và `ALLOWED_ORIGINS` rõ ràng.

Không có database, Redis, multi-process adapter hoặc đồng bộ nhiều replica. Tài liệu setup nằm ở [README.md](../README.md), cấu hình mẫu ở [../.env.example](../.env.example).
