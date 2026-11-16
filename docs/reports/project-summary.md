# Tổng kết dự án Hội Quậy

Cập nhật 16/11/2026. Phiên bản **Fix 1.1 (`1.1.0`)** đã chuẩn bị trong repo, đủ để CLB chơi thử giới hạn; chưa push/deploy trong đợt kiểm định. Hồ sơ triển khai, kiểm chứng và checklist Terra được gom tại [Fix 1.1](./fix-1.1/summary.md). **Chưa có Terra approval.**

## Hiện trạng

React/TypeScript/Vite + Node/Socket.IO, state RAM một process. UNO BB-UNO-1 và Nối từ NT-VI-1 chơi 2–6 người; Caro HQ-CARO-1 đúng 2 người. Phòng public/private, mã/link mời, avatar/tên, ready/host/kick, reconnect đúng ghế. Không tài khoản/database/bot/chat. Giữ HTTP LAN UUID fallback.

Server quyết định nghiệp vụ, lượt, deadline, điểm và kết quả; frontend dùng API/snapshot/capabilities đã kiểm schema runtime. Không lộ tay bài đối thủ, chồng rút, từ điển hoặc token. HTTP/Socket.IO chung origin policy; một backend/replica. Restart/deploy mất phòng, phiên và điểm.

## Tra cứu

| Phần | Đặc tả và hồ sơ |
|---|---|
| Fix 1.1 | Thắng +10, target mặc định 50; timer cấu hình; tự nối ván sau 3 giây; panel phòng, public directory, sound và chỉnh bố cục. [Tổng kết và QA còn mở](./fix-1.1/summary.md) |
| UNO | [BB-UNO-1](../uno-rules.md): 108 lá/chia 7, bàn trống; stacking tùy chọn, +4 không challenge; Reverse hai người đi tiếp; lá cuối thắng ngay; hết giờ loại tới ván sau. [Lịch sử UI bàn](./uno-table-ui/summary.md) |
| Nối từ | [NT-VI-1](../noitu-rules.md): prefix khóa, dictionary-first/unknown vote, vote 15 giây, hai proposal/lượt, active cuối thắng; active row và chữ bác vỡ tại chỗ. [Tổng kết](./noitu/summary.md) |
| Caro | [HQ-CARO-1](../caro-rules.md): bàn 9/15/19, nối đúng 4/5/6 có đầu mở; chọn ô hai lần, timeout/resign thua, đổi X/O ván sau. [Lịch sử triển khai](./caro/summary.md) |
| Kiến trúc/phòng | [Backend](./backend-separation/summary.md), [room/session](../rooms-and-reuse.md), [kiến trúc](../architecture.md) |
| Nhận diện/UI | [Branding](./branding/summary.md), [12 avatar](./player-avatars/summary.md), [lobby/share](./lobby-ux/summary.md), [đặc tả UI](../ui-ux.md) |

## Kiểm chứng và giới hạn

Lần kiểm định Fix 1.1 đạt **169/169 test trong 16 file** khi cho phép loopback, build/typecheck đạt; production HTTP local trả 200 cho health/API/trang chính. Fixture Chrome headless sáu người ở 360/390/768/1440 px không chồng ghế hoặc tràn ngang. Build còn cảnh báo Zod và chunk JS 509.00 kB minified. Chi tiết, lỗi môi trường và giới hạn bằng chứng nằm trong [hồ sơ phiên bản](./fix-1.1/summary.md).

Chưa kiểm chứng UI cuối trên điện thoại thật, cảm giác sound/motion, trận đông người qua hosting, HTTPS/WSS và tải đồng thời; fixture và socket tests không thay thế các kiểm tra này. Những xác nhận join/sync LAN và UI Nối từ của người dùng ở bản trước là bằng chứng lịch sử. Kết quả cũ được giữ tại summary từng tính năng và [kiểm định trước v2](./deployment-readiness/summary.md).

## Việc còn lại

- Build/deploy frontend và backend cùng phiên bản; cấu hình Node một process, origin và WebSocket theo [README](../../README.md), [operations](../operations.md).
- Terra/device QA cho ba game: session độc lập, mobile/IME/motion/sound, reconnect/reload/kick, timer/score/countdown. [Checklist Fix 1.1](./fix-1.1/summary.md#checklist-bàn-giao-terra-còn-mở), [test plan](../test-plan.md).
- Nối từ: 47.877 mục thử nghiệm; 200 mẫu semantic review và quyền từng nguồn chưa xác minh. Giữ [nguồn/hash/giấy phép](../../data/word-chain/README.md); chưa khẳng định bộ từ đã sạch hoặc được duyệt phân phối rộng.

Quy trình tài liệu theo [AGENTS.md](../../AGENTS.md): đặc tả hiện hành ở `docs/`, báo cáo tại `docs/reports/<tính-năng>/`, khi chốt/gom chỉ giữ `summary.md` cùng bằng chứng cần thiết.
