# Bắn tàu — baseline và hợp đồng triển khai

Cập nhật 16/11/2026 trước khi code. Người dùng đã giao triển khai liên tục phiên 0→5; các quyết định trong `01-plan.md`, `03-ui-ux.md`, `04-data-contract.md` là đặc tả HQ-BANTAU-1 cho lượt này. Source working tree ban đầu không có thay đổi; chỉ các tài liệu kế hoạch Bắn tàu chưa commit từ lượt lập kế hoạch.

## Baseline mới

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | Đạt, exit 0. |
| `npm test` trong sandbox mặc định | 158/169 đạt; 11 test HTTP/Socket.IO timeout vì Node `listen EPERM 127.0.0.1`. |
| `npm test` với loopback được cho phép | Đạt, 169/169 trong 16 file, exit 0. |
| `npm run build` | Đạt, exit 0; client 174 modules. Có 2 cảnh báo vị trí annotation Zod và cảnh báo bundle JS 509 kB minified. |

Không sửa source/test/config trước baseline. Build tạo/cập nhật `dist/` vốn bị bỏ qua bởi Git. Baseline không phải kiểm chứng trình duyệt hoặc thiết bị.

## Source audit và điểm mở rộng

- Workspace `packages/*`, `server`; package mới là `@banban/bantau`. `server/tsconfig.json` đang include engine UNO/Nối từ/Caro tường minh và phải thêm Bắn tàu. Shared import kiểu snapshot từ từng package; thêm import riêng, không cho engine phụ thuộc shared.
- `packages/shared/src/index.ts`: catalog, `GameKey`, discriminated `GameSettings`, defaults, `RoomSnapshot`, create/action/schema. Runtime parser strict hiện có ba nhánh.
- `packages/shared/src/public-game-schemas.ts`: snapshot UNO/Nối từ; thêm schema cá nhân Bắn tàu ở file game riêng hoặc cùng module, chỉ khai báo DTO an toàn.
- `server/src/rooms.ts`: Room hiện có ba state/timer; `startRound` nhánh UNO cuối cùng; thêm state, setup/turn/resolving/round-limit timers, per-seat projection, fleet revision/aim sequence riêng, pause/resume/cleanup/settle.
- `server/src/index.ts`: các handler UNO/Nối từ/Caro đều có envelope + schema + session hiện tại + action cache; `command()` mặc định kiểm public room revision và broadcast snapshot. Placement/aim cần đường private ACK riêng; fire/lock/resign dùng public revision. Thêm event realtime riêng cho effect, không đưa miss vào snapshot/cache.
- `src/api/http.ts`: game key public listing bị liệt kê 3 giá trị; schema settings options cần board/ship/touch/hit options. `src/api/realtime.ts` chỉ có intent/subscription ba game; thêm API typed Bắn tàu và parse event/snapshot strict. Giữ HTTP/LAN fallback.
- `src/App.tsx`: page union ba game; game entry, rules, table, action callbacks và intro có nhánh cuối mặc định UNO/Caro. Thêm route/game render Bắn tàu tường minh; public polling filter dựa catalog mở rộng.
- `src/components/RoomSettingsDialog.tsx`: submit nhánh cuối mặc định Nối từ, helper timeout chung nói “bị loại”; thêm Bắn tàu, options API, setup fixed 90s và copy timeout tự bắn.
- `src/audio/soundEffects.ts`: cue WebAudio hiện dùng chung; thêm cues nước/hit/sunk tường minh, giữ mute/volume và quản lý tuổi thọ.
- `src/styles/app.css`: style toàn cục hiện diện; thêm stylesheet scope `.bantau-*`, không sửa style UNO dùng chung.
- Luồng server hiện broadcast snapshot riêng theo seat và ghi nhận mỗi action bằng cache theo player; thiết kế Bắn tàu phải giữ nguyên nguyên tắc đó, đồng thời không cache lịch sử miss/aim để hydrate.

## Hợp đồng được chốt cho lượt triển khai

- GameKey `bantau`; đúng 2 ghế, public/private theo phòng chung; bàn 8/10/12 (mặc định 10), 3/4/5 tàu (mặc định 5), turn 15/30/45/60 giây (mặc định 30), target 10–500 (mặc định 50), hit-continue mặc định bật, chạm mặc định tắt.
- Presets tàu: 3 → 3/3/2; 4 → 4/3/3/2; 5 → 5/4/3/3/2. Không overlap; khi cấm chạm không kề cả cạnh lẫn chéo. Server random placement hữu hạn/backtracking, mỗi người sửa đội hình riêng. Setup 90 giây tự khóa đội hình hợp lệ.
- Phase engine: setup → turn/resolving → finished. Match round mới vào setup sau intermission 3 giây; điểm thắng ván +10; first attacker luân phiên qua ván trong cùng trận.
- Aim owner-only theo `gameId/turnId/sequence`, giữ qua reload/reconnect sau ACK; aim không đổi public revision/deadline. Tap lần đầu nhắm, lần hai cùng ô sau ACK mới bắn; đổi ô chỉ đổi aim. Timeout bắn aim đã xác nhận hoặc chọn ngẫu nhiên uniform từ mọi ô trừ hit/sunk.
- Không lưu hoặc trả dấu miss/history trong state projection/ACK replay. Miss chỉ xuất hiện qua effect event trực tiếp còn hạn và ô trở về unknown; bắn miss lặp lại hợp lệ. Hit đã biết chặn bắn lặp. Sunk chỉ reveal đúng footprint tàu vừa chìm; không reveal tàu chưa lộ.
- Fire/timeout race giải quyết đúng một lần tại `now >= deadlineAt`; resolving 900ms dùng server timer riêng, animation không quyết định trạng thái. Disconnect pause setup/turn/resolving/countdown và round active-limit; resume đúng ghế; stale socket/timer/action không thể thay đổi game.
- Chịu thua dùng dialog web và kết thúc ván. Thắng +10/settle một lần; đạt target thì match dừng; chưa đạt thì countdown và setup ván mới. Timeout bắn không loại người chơi. Round active-limit 30 phút hủy trận không điểm theo dự thảo HQ-BANTAU-1.
- Không database; restart mất phòng như các game khác. Không mở rộng UNO/Nối từ/Caro.

## Tiếp theo

Phiên 1 tạo engine thuần và ma trận test luật/privacy. Phiên 2 nối shared/backend/API và Socket.IO. Phiên 3 làm sảnh/cấu hình/xếp tàu. Phiên 4 làm chiến đấu/motion/sound/rules. Phiên 5 chạy hồi quy/build, thử realtime/browser nếu môi trường cho phép, cập nhật tài liệu và checklist Terra; trạng thái Terra QA vẫn để chờ.
