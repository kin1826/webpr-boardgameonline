# Tổng kết dự án Bàn Bạn

Cập nhật 14/11/2026. Đây là điểm tra cứu chung; báo cáo Nối từ được gom tại [noitu/summary.md](./noitu/summary.md). Kết quả dưới đây được giữ từ các lượt triển khai, không phải kiểm thử mới trong lượt gom tài liệu.

## Hiện trạng

- React/TypeScript/Vite + Node/Socket.IO, UNO và Nối từ realtime 2–6 người; server là nguồn sự thật. Không tài khoản/database/bot/chat. Phòng và phiên nằm trong RAM của một process; restart/deploy làm mất phòng.
- Join bằng mã, phòng public/private, đổi biệt danh, sao chép mã/link, lobby/ready, host bắt đầu/kick, reconnect đúng ghế và rematch. Link chỉ điền sẵn mã. Giữ UUID fallback cho HTTP LAN.
- Người dùng đã thử join/sync LAN và xác nhận các sửa giao diện Nối từ mới nhất đã ổn. Terra chưa có kết luận nghiệm thu độc lập cho bản hiện tại.

## Quyết định sản phẩm cần giữ

| Phần | Hành vi và tài liệu có thẩm quyền |
|---|---|
| UNO | [BB-UNO-1](../uno-rules.md): bộ 108 lá, chia 7, mở bàn trống; +2 cộng +2/+4, sau +4 chỉ cộng +4; nhận phạt mất lượt; +4 tự do không challenge; Reverse hai người đi tiếp; lá cuối hợp lệ thắng ngay kể cả chức năng. Đây là luật tùy chỉnh. |
| Nối từ | [NT-VI-1](../noitu-rules.md): từ hai tiếng, prefix khóa, dictionary-first, unknown vote đa số, 30/15 giây, hai proposal/lượt, loại người và người cuối thắng. [Source/kiểm chứng/giới hạn](./noitu/summary.md). |
| UI | [Đặc tả UI](../ui-ux.md): theme Đêm tím, tiếng Việt, lá tự vẽ; mobile UNO chạm lần đầu nâng, chạm lại đánh. Nối từ một active row xuyên suốt nhập/vote/bác, suffix vỡ tại chỗ, chữ dài cuộn trong bubble. |
| Room/session | [Phòng và tái sử dụng](../rooms-and-reuse.md): RAM, token server, thu hồi socket cũ, thời gian reconnect, timeout/kick/room-close và cleanup. |

UNO motion hiện tại: lá số bay 265 ms, chức năng 280 ms rồi tiếp đất; +2/+4 rung theo tổng phạt có trần, mobile giảm lực. Rung lớp hình ảnh, hand/tray/hit target đứng yên; FLIP theo card ID, discard còn lại theo snapshot. Animation không quyết định luật; giảm hiệu ứng app/OS và cleanup/dedupe được giữ. Correlation local effect dựa actor + game revision kế tiếp, chưa có actionId trong effect; cần thử action nhanh khi nghiệm thu.

## Kiểm chứng gần nhất

- Ngày 14/11/2026: typecheck, **112/112 test trong 11 file**, production build và diff check đạt. Build có hai cảnh báo annotation Zod/Rollup; test socket cần quyền bind loopback.
- Chrome headless: DOM Nối từ ở 1440/390/360 px và reduced motion đạt; đây là fixture UI, không thay thế hai browser chơi qua server thật.
- Suite realtime có hai Socket.IO client độc lập cho UNO/Nối từ, privacy và action chéo game. Lịch sử UNO đã có ván production shuffle kết thúc và kiểm tra bảo toàn 108 ID bài.
- Production smoke cục bộ ngày 13/11/2026 đạt `/`, `/health`, `/api/games`, `/api/rooms`, hai game available. Chưa có bằng chứng deploy công khai/reverse proxy, cài sạch hoặc tải lớn.

## Việc còn lại

1. Terra kiểm tra hai browser/thiết bị độc lập: create → join → ready → chơi → kết thúc/rematch, cả 2–6 người; disconnect/reconnect, host reload, kick/leave và thông báo đóng phòng.
2. Thử mobile/IME thật, focus/keyboard/zoom/reduced motion và cảm giác motion. Checklist cụ thể trong [kế hoạch kiểm thử](../test-plan.md) và [tổng kết Nối từ](./noitu/summary.md).
3. Trước khi phân phối dataset công khai: semantic review mẫu 200 mục và xác minh quyền từng nguồn. [Hồ sơ dữ liệu](../../data/word-chain/README.md) giữ nguồn, hash và giấy phép; bộ playable 47.877 mục vẫn là thử nghiệm.
4. Khi deploy: Node một process, HTTPS/WebSocket, health check và ALLOWED_ORIGINS; thử từ hai mạng. [Hướng dẫn vận hành](../operations.md), lệnh cài/dev/build/production/LAN tại [README](../../README.md).

## Quy trình tài liệu

Mỗi đợt mới lưu plan/prompt/report trong `docs/reports/<tinh-nang>/`. Khi người dùng chốt đợt, gom quyết định cuối, source, kiểm chứng và việc còn lại thành `summary.md`, cập nhật liên kết rồi dọn hồ sơ trung gian đã thay thế. Việc gom không đồng nghĩa Terra approve. Luật/kiến trúc/UI/vận hành giữ ở gốc `docs/`; nguồn dữ liệu và giấy phép giữ cạnh dataset. Quy tắc đầy đủ tại [AGENTS.md](../../AGENTS.md).
