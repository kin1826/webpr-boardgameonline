# Kế hoạch triển khai và trạng thái

Trạng thái: MVP realtime UNO đã triển khai; BB-UNO-1 được nối vào engine/UI. Luna đã sửa lỗi HTTP LAN; đợt Sol bổ sung luật phạt, đồng bộ màu/nước đi và lifecycle phòng. Kết quả test mới nhất, browser blocker và giới hạn nằm trong [sol-uno-fix-report.md](./sol-uno-fix-report.md) và [verification-report.md](./verification-report.md).

Đợt motion UNO cũng đã được triển khai: radius bài 6px, animation theo `game:effect`, tùy chọn Giảm hiệu ứng. Typecheck/build và test 57/57 đạt. Kiểm tra trực quan desktop/mobile còn chờ Terra; xem [uno-motion-report.md](./uno-motion-report.md).

Sau phản hồi chơi thử, đợt motion v2 đã triển khai: rung theo tổng phạt, bài bay từ actor, tray trên tay bài và chọn lá mobile theo hàng. Kiểm tra trực quan đang BLOCKED vì browser host không khả dụng; xem [báo cáo Terra](./uno-motion-v2-report.md).

Đợt motion v3 đã triển khai theo phản hồi mới: mobile chạm hai lần vào cùng lá, flight→landing→impact liền mạch, FLIP cho bài còn lại, ring trang trí dày đã bỏ và focus bàn phím/reduced motion được giữ. Typecheck/build và 59/59 test đạt; nghiệm thu trực quan vẫn BLOCKED vì browser host không khả dụng. Xem [báo cáo v3](./uno-motion-v3-report.md).

## Hạng mục đã làm

1. React/TypeScript/Vite frontend, Node/TypeScript/Socket.IO backend, Zod, Vitest và HTTP LAN action ID fallback.
2. Engine thuần: 108 lá, setup 2–6, validation/transition, Wild chọn màu, +2/+4 cộng dồn theo BB-UNO-1, Reverse, UNO, recycle, kết thúc và projection hành động/bài riêng.
3. Room/session: public/private, mã tham gia, ready/start/kick/leave/rematch, token reconnect/takeover, offline timeout, close/change broadcast.
4. UI homepage/lobby/live/preview; trạng thái legal card và penalty theo server, màu bàn, thông báo phòng đóng.
5. Typecheck, Vitest, production build và Socket.IO test. Xem báo cáo chạy thật; không suy ra browser hoặc thiết bị đã thử từ các test này.

## Còn cần Terra nghiệm thu

Đợt hiệu ứng và góc lá UNO đã code; hồ sơ chi tiết và checklist Terra nằm ở [uno-motion-report.md](./uno-motion-report.md). Phần cần nghiệm thu trực quan gồm lá số nhẹ, +2/+4 và Bỏ lượt đập/rung, reduced motion và hành vi trên màn hình thật.

- Dùng hai browser profile độc lập và ít nhất một ván production qua UI nếu browser khả dụng.
- Duyệt 360/390/1440px, focus/bàn phím, reduced motion và điện thoại thật/LAN.
- Xem đầy đủ ma trận luật, race/timer và boundaries ở `docs/uno-fix-plan.md`.
- Không coi report test-fixture hay socket test thay cho nghiệm thu UI trên thiết bị.
