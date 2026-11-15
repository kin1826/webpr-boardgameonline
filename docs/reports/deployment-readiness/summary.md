# Chuẩn bị deploy — Tổng kết sửa và kiểm định

15/11/2026. **Đủ điều kiện kỹ thuật để lên staging/CLB test; chưa có nghiệm thu production/thiết bị thật hoặc Terra approval.** Báo cáo này thay hồ sơ audit trước đó, giữ các giới hạn còn mở.

## Đã sửa

| Phần | Thay đổi và lý do |
|---|---|
| Dependency backend | Khai @banban/caro trực tiếp ở server/package.json, cập nhật package-lock.json; không dựa vào dependency bắc cầu/hoisting của shared |
| CORS | Ngoại lệ localhost/LAN 5173/4173 chỉ áp dụng ngoài production; production dùng origin cấu hình hoặc same-origin. HTTP và Socket.IO dùng chung hàm. HTTP LAN dev vẫn giữ |
| Snapshot UNO/Nối từ | Schema Zod chi tiết trong packages/shared/src/public-game-schemas.ts; validate bài/capabilities/players/proposal/votes/history/timer/phase. Unknown fields bị từ chối, gồm hand đối thủ, drawPile, dictionary/usedWords. Parse cả event và ACK ở API client hiện có |
| Kiểm tra tương thích | Kiểm DTO từ engine thật và kiểm mọi ACK snapshot trong suite realtime (đánh/rút/phạt/UNO/vote/kết thúc/rematch) bằng parser mà frontend dùng |
| Xác nhận kick | ConfirmKickDialog dùng chung lobby/bàn UNO; thay window.confirm. Nêu đúng tên, cảnh báo hủy ván, focus mặc định Hủy, Tab/Escape/backdrop, trả focus, chặn gửi lặp và khóa khi offline/busy/mất quyền |
| Hiển thị Caro | Số người là 2 thay vì 2–2; intro hiển thị lựa chọn 4/5/6; đặc tả và luật đồng bộ theo mục tiêu thực tế |
| Hồ sơ MD | Caro gom 4 file plan/prompt/report/QA thành một summary, giữ việc Terra chưa nghiệm thu. Audit deploy gom thành file này; Nối từ/backend đã có summary nên giữ. Có docs/README.md làm mục lục |

Server vẫn là nguồn sự thật cho luật, quyền, lượt và kết quả. Không đổi BB-UNO-1, NT-VI-1 hoặc motion. HQ-CARO-1 giữ mục tiêu 4/5/6 do host chọn, reset ready khi đổi, giữ qua rematch.

UI dùng ui-ux-pro-max và dialog có sẵn của dự án; đã tra Lucian catalog cho confirmation, các kết quả type-to-delete/share/subscription không khớp thao tác kick nên không port hoặc bịa ID mới. Không thêm dependency UI.

## Kiểm chứng mới sau sửa

| Kiểm tra | Kết quả thật |
|---|---|
| npm run typecheck | PASS frontend/server |
| npm test | PASS **152/152 test, 16 file**, integration có quyền loopback |
| npm run build | PASS, 172 modules, JS khoảng 490.24 kB / gzip 145.85 kB; hai cảnh báo comment annotation Zod/Rollup không làm build thất bại |
| npm ci sạch | PASS trong thư mục tạm, offline từ npm cache; không dùng node_modules của workspace; chưa xác minh registry/network từ máy host mới |
| npm run build:client trên bản cài sạch | PASS với cùng source/lockfile, như lệnh Vercel |
| npm start với NODE_ENV=production | PASS trên bản sao cài sạch, cổng 3019; không ảnh hưởng dev 3001 |
| Static/health/catalog | / trả 200; /health hoạt động; /api/games trả cả ba available |
| CORS production | Origin club.example.com được phép; localhost:5173, LAN:5173 và origin lạ đều trả 403 |
| Hai client Socket.IO production độc lập | UNO create/join/ready/start/draw; Nối từ create/join/ready/start/giveUp; Caro chọn 6/start/place/resign đều PASS; mọi snapshot ACK qua schema mới |

Production smoke dùng WebSocket với Origin header mô phỏng, không phải browser HTTPS thật. Test suite có ván UNO shuffle production tới kết thúc và bảo toàn 108 lá; Caro smoke chỉ đặt một nước rồi resign, điều kiện thắng đã được unit/integration test riêng. Browser access host báo không khả dụng; không ghi đã thử UI dialog hoặc mobile thật. Server smoke đã dừng; backend dev được giữ chạy.

## Đánh giá sơ bộ

Nền tảng MVP có thể triển khai để CLB thử: ba engine tách UI, room/session tái sử dụng, xác thực server, kiểm payload, CORS, reconnect, idempotency và bộ kiểm thử hồi quy có ý nghĩa. Không phát hiện lỗi chặn build/start trong kiểm định hiện tại. Đây chưa phải kiểm toán bảo mật hoặc chứng minh không còn bug.

Giới hạn đáng kể: state RAM một process, restart/sleep mất phòng; không scale nhiều replica; chưa có load test, giám sát/alert production, UI/device QA mới hoặc HTTPS/WSS hosting thật. Dataset Nối từ 47.877 mục còn thử nghiệm, semantic review 200 mục chưa xong và quyền từng nguồn chưa xác minh; chưa giải quyết bằng code trong đợt này. Không tuyên bố dữ liệu đã sạch/được phép phân phối rộng.

## Bàn giao deploy và QA còn mở

1. Commit/push đầy đủ source/config/lockfile/docs hiện hành trước deploy. Không đưa .env/node_modules/dist hoặc token lên Git; xem trạng thái Git thực tế và không bỏ sót file mới.
2. Vercel root: npm ci → npm run build:client → dist; VITE_BACKEND_URL=https://backend-domain khi build.
3. Backend root: npm ci → npm start; NODE_ENV=production, HOST=0.0.0.0, PORT do host cấp, ALLOWED_ORIGINS chứa domain frontend chính xác. Giữ packages và data/word-chain, một process/replica, HTTPS/WSS và WebSocket upgrade.
4. Sau khi có URL: hai thiết bị hoặc profile độc lập, mỗi game create/join/ready/start/chơi tới kết thúc/rematch. Thử UNO/Nối từ 2–6 và Caro đúng 2 với 4/5/6.
5. Reload host, offline/resume, hết grace, kick/leave/reset-ready/host transfer, restart và thông báo mất phòng. Hai domain, hai mạng, HTTPS/WSS, CORS ngoài allowlist.
6. 1440/390/360px, mobile keyboard/IME/zoom-pan, focus Tab/Enter/Space/Escape, dialog kick, reduced motion và cảm giác motion. Terra ghi bằng chứng và PASS/FAIL/BLOCKED; vẫn chưa nghiệm thu các mục này.

Nguồn luật/dữ liệu và quy trình hiện hành giữ ở docs/caro-rules.md, uno-rules.md, noitu-rules.md, operations.md, test-plan.md, AGENTS.md và data/word-chain/README.md. Không xóa dataset, license hoặc source trong đợt gom tài liệu.

## Trạng thái Git bàn giao

Đã stage 26 file mới hợp lệ (source, test, config và tài liệu), không còn file mới chưa được theo dõi theo `git ls-files --others --exclude-standard`. Các thay đổi ở file đã tồn tại vẫn được giữ trong working tree; khi chuẩn bị commit cần review và stage cả phần modified tương ứng, không commit chỉ riêng các file mới. Không revert nội dung sẵn có, không commit/push/deploy. `git diff --check` và `git diff --cached --check` đạt; rà Markdown nội bộ không có target hỏng (20 file MD trong docs).
