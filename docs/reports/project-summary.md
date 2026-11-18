# Tổng kết dự án Hội Quậy

Cập nhật 18/11/2026. Nền **Fix 1.1 (`1.1.0`)** và hotfix 1.2 vẫn chưa push/deploy. Cờ tướng HQ-COTUONG-1 đã được polish; chờ Terra QA độc lập. Full suite hiện đạt 208/208 khi cho phép loopback; typecheck/build đạt. Browser/device smoke Cờ tướng chưa chạy vì browser access host unavailable. Không tăng package version, commit, push hoặc deploy.

## Hiện trạng

React/TypeScript/Vite + Node/Socket.IO, state RAM một process. UNO BB-UNO-1 và Nối từ NT-VI-1 chơi 2–6 người; Caro HQ-CARO-1 và Bắn tàu HQ-BANTAU-1 đúng 2 người. Bắn tàu đã nối sảnh, cài đặt phòng, xếp tàu kín, nhắm/bắn, timeout, điểm trận và tự mở ván mới. Phòng public/private, mã/link mời, avatar/tên, ready/host/kick, reconnect đúng ghế. Không tài khoản/database/bot/chat. Giữ HTTP LAN UUID fallback.

Server quyết định nghiệp vụ, lượt, deadline, điểm và kết quả; frontend dùng API/snapshot/capabilities đã kiểm schema runtime. Không lộ tay bài đối thủ, chồng rút, từ điển hoặc token. HTTP/Socket.IO chung origin policy; một backend/replica. Restart/deploy mất phòng, phiên và điểm.

## Tra cứu

| Phần | Đặc tả và hồ sơ |
|---|---|
| Fix 1.1 | Thắng +10, target mặc định 50; timer cấu hình; tự nối ván sau 3 giây; panel phòng, public directory, sound và chỉnh bố cục. [Tổng kết và QA còn mở](./fix-1.1/summary.md) |
| UNO | [BB-UNO-1](../uno-rules.md): 108 lá/chia 7, bàn trống; stacking tùy chọn, +4 không challenge; Reverse hai người đi tiếp; lá cuối thắng ngay; hết giờ loại tới ván sau. [Lịch sử UI bàn](./uno-table-ui/summary.md) |
| Nối từ | [NT-VI-1](../noitu-rules.md): prefix khóa, dictionary-first/unknown vote, vote 15 giây, hai proposal/lượt, active cuối thắng; active row và chữ bác vỡ tại chỗ. [Tổng kết](./noitu/summary.md) |
| Caro | [HQ-CARO-1](../caro-rules.md): bàn 9/15/19, nối đúng 4/5/6 có đầu mở; chọn ô hai lần, timeout/resign thua, đổi X/O ván sau. [Lịch sử triển khai](./caro/summary.md) |
| Bắn tàu | [HQ-BANTAU-1](../bantau-rules.md): đúng 2 người; đội hình 3/4/5 tàu; lần đầu nhắm, lần hai bắn; miss không lưu dấu; hết giờ bắn aim đã xác nhận hoặc ô ngẫu nhiên. [Tổng kết và QA còn mở](./bantau/summary.md) |
| Cờ tướng | [HQ-COTUONG-1](../cotuong-rules.md): đúng 2 người; online theo room hoặc hai người cùng máy qua backend; quân SVG chữ truyền thống tự vẽ; bảng thông báo kết quả nổi bật; luật lặp/120 ply là lựa chọn giản lược Hội Quậy. [Tổng kết và QA còn mở](./cotuong/summary.md) |
| Kiến trúc/phòng | [Backend](./backend-separation/summary.md), [room/session](../rooms-and-reuse.md), [kiến trúc](../architecture.md) |
| Nhận diện/UI | [Branding](./branding/summary.md), [12 avatar](./player-avatars/summary.md), [lobby/share](./lobby-ux/summary.md), [đặc tả UI](../ui-ux.md) |

## Kiểm chứng và giới hạn

Kiểm định chuẩn bị **1.2 ngày 18/11/2026**: đã sửa sprite nổ/nước chuyển frame và dùng clock trình bày neo serverNow vào performance.now() để không phụ thuộc giờ hệ thống điện thoại. Hồi quy sau sửa đạt **188/188 trong 18 file** khi cho phép loopback; build gồm typecheck đạt. Smoke production local trước hai bản sửa trả HTTP 200 cho health/catalog/trang chính và asset Bắn tàu. Root metadata vẫn 1.1.0. Xem [báo cáo trước phát hành 1.2 và kết quả sửa](./release-1.2/01-review.md). Chưa thử lại browser/mobile/hosting hoặc Terra QA trong lượt này.

Lần kiểm định Fix 1.1 đạt **169/169 test trong 16 file** khi cho phép loopback, build/typecheck đạt; production HTTP local trả 200 cho health/API/trang chính. Fixture Chrome headless sáu người ở 360/390/768/1440 px không chồng ghế hoặc tràn ngang. Build còn cảnh báo Zod và chunk JS 509.00 kB minified. Chi tiết, lỗi môi trường và giới hạn bằng chứng nằm trong [hồ sơ phiên bản](./fix-1.1/summary.md).

Chưa kiểm chứng UI cuối trên điện thoại thật, cảm giác sound/motion, trận đông người qua hosting, HTTPS/WSS và tải đồng thời; fixture và socket tests không thay thế các kiểm tra này. Những xác nhận join/sync LAN và UI Nối từ của người dùng ở bản trước là bằng chứng lịch sử. Kết quả cũ được giữ tại summary từng tính năng và [kiểm định trước v2](./deployment-readiness/summary.md).

Riêng Cờ tướng sau polish ngày 18/11: `npm test` đạt **208/208 trong 21 file**, `npm run typecheck` và `npm run build` đạt. Build cảnh báo JS 577.88 kB minified (169.86 kB gzip), vượt 500 kB. Browser access không khả dụng nên chưa thử UI, hai browser độc lập, mobile hoặc nghe âm thanh. Xem [báo cáo polish và checklist Terra](./cotuong/summary.md).

## Việc còn lại

- Cờ tướng: đã triển khai Online/2P, quân truyền thống, geometry/motion/sound và bảng kết quả. Chờ browser/device/audio và Terra QA. [Tổng kết cùng checklist](./cotuong/summary.md).
- Bắn tàu: đã triển khai và polish; browser cục bộ mới tới nhắm/bắn, chưa hoàn tất ván thắng hoặc QA hotfix 1.2 trên thiết bị. [Tổng kết cùng checklist](./bantau/summary.md).
- Build/deploy frontend và backend cùng phiên bản; cấu hình Node một process, origin và WebSocket theo [README](../../README.md), [operations](../operations.md).
- Terra/device QA cho năm game: session độc lập, mobile/IME/motion/sound, reconnect/reload/kick, timer/score/countdown. [Checklist Fix 1.1](./fix-1.1/summary.md#checklist-bàn-giao-terra-còn-mở), [test plan](../test-plan.md), [checklist Bắn tàu](./bantau/summary.md), [checklist Cờ tướng](./cotuong/summary.md).
- Nối từ: 47.877 mục thử nghiệm; 200 mẫu semantic review và quyền từng nguồn chưa xác minh. Giữ [nguồn/hash/giấy phép](../../data/word-chain/README.md); chưa khẳng định bộ từ đã sạch hoặc được duyệt phân phối rộng.

Quy trình tài liệu theo [AGENTS.md](../../AGENTS.md): đặc tả hiện hành ở `docs/`, báo cáo tại `docs/reports/<tính-năng>/`, khi chốt/gom chỉ giữ `summary.md` cùng bằng chứng cần thiết.
