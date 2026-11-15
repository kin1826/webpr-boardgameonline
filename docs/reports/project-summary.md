# Tổng kết dự án Hội Quậy

Cập nhật 15/11/2026. Điểm tra cứu chung sau khi gom hồ sơ; chi tiết và bằng chứng tại từng summary.

## Hiện trạng

React/TypeScript/Vite + Node/Socket.IO, state RAM một process. UNO BB-UNO-1 và Nối từ NT-VI-1 chơi 2–6 người; Caro HQ-CARO-1 đúng 2 người. Không tài khoản/database/bot/chat. Tạo phòng public/private, nhập mã hoặc bấm phòng công khai, avatar/tên, share link, host/ready/kick, reconnect đúng ghế và rematch. Link chỉ điền sẵn mã. Giữ HTTP LAN UUID fallback.

Server quyết định luật/quyền/lượt/kết quả; frontend dùng typed API và snapshot/capabilities. Snapshot ba game kiểm schema runtime, HTTP/Socket.IO dùng chung origin policy; production không cho ngoại lệ LAN/dev. Restart/deploy mất phòng. Một backend/replica; chưa có persistence hoặc scale ngang.

## Quyết định sản phẩm

| Phần | Hành vi cuối và hồ sơ |
|---|---|
| UNO | [BB-UNO-1](../uno-rules.md): 108 lá/chia 7, bàn trống; cộng +2/+4 theo loại cuối; +4 tự do không challenge; Reverse hai người đi tiếp; lá cuối hợp lệ thắng ngay. [UI bàn](./uno-table-ui/summary.md) |
| Nối từ | [NT-VI-1](../noitu-rules.md): prefix khóa, dictionary-first/unknown vote đa số, 30/15 giây, 2 proposal/lượt, người cuối active thắng; một active row và suffix bác vỡ tại chỗ. [Tổng kết](./noitu/summary.md) |
| Caro | [HQ-CARO-1](../caro-rules.md): 15×15, host chọn đúng 4/5/6 có đầu mở; quá mục tiêu không thắng; 30 giây, timeout/resign thua; cùng cặp rematch đổi X/O. [Tổng kết và QA còn mở](./caro/summary.md) |
| Kiến trúc/phòng | [Backend](./backend-separation/summary.md), [room/session](../rooms-and-reuse.md), [kiến trúc](../architecture.md) |
| Nhận diện/UI | Hội Quậy/theme đỏ, SVG lá tự vẽ; [branding](./branding/summary.md), [12 avatar](./player-avatars/summary.md), [lobby/share/public join](./lobby-ux/summary.md), [đặc tả UI](../ui-ux.md) |

UNO motion giữ bay/đập/rung theo tổng phạt có trần, FLIP hand, reduced motion và correlation revision. Animation không quyết định luật. Người dùng từng xác nhận join/sync LAN và UI Nối từ ổn; đó không thay thế Terra QA cho bản mới.

## Kiểm chứng mới nhất

**152/152 test trong 16 file**, typecheck/full build, cài sạch offline, build:client và npm start production đều đạt. Production smoke hai socket độc lập qua ba game, strict DTO và chặn origin dev/LAN đạt. Xem [tổng kết chuẩn bị deploy](./deployment-readiness/summary.md) để biết lệnh, môi trường và giới hạn chính xác.

Lịch sử trước đó: 112 test Nối từ ngày 14/11, backend 124, baseline trước Caro 125, Caro 142 rồi cấu hình 4/5/6 nâng lên 148. Đây là mốc lịch sử, không lấy thay kết quả mới. Các lần headless Nối từ ở 1440/390/360px là fixture UI, không thay thế multiplayer trên thiết bị thật.

## Việc còn lại

- Đưa đủ source/config/docs vào commit/push, cấu hình Vercel frontend và backend Node HTTPS/WebSocket một process; hướng dẫn [README](../../README.md), [operations](../operations.md).
- Terra/device QA độc lập cho ba game, 2–6 người với UNO/Nối từ, 2 người với Caro; keyboard/mobile/IME/motion/dialog, reconnect/reload/kick và URL hosting HTTPS/WSS. [Test plan](../test-plan.md). Browser access host hiện không khả dụng.
- Chưa load test, vận hành public/reverse proxy thật hoặc kiểm toán bảo mật. Đủ để staging/CLB test có giới hạn, chưa tuyên bố production đã nghiệm thu.
- Nối từ: bộ 47.877 mục còn thử nghiệm, 200 mẫu semantic review pending, quyền từng nguồn chưa xác minh. Giữ [nguồn/hash/giấy phép](../../data/word-chain/README.md); không coi dữ liệu đã được duyệt để phân phối rộng.

Hồ sơ đã gom theo yêu cầu người dùng; kế hoạch/prompt trung gian Caro và audit deploy cũ được thay bằng summary. Hồ sơ mới vẫn theo [AGENTS.md](../../AGENTS.md). **Chưa có Terra approval.**
