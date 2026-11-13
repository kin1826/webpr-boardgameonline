# Báo cáo kiểm chứng

## Thắng ngay khi đánh lá cuối

- R07 của BB-UNO-1 và màn hình Luật chơi đã đổi theo yêu cầu: mọi lá cuối hợp lệ chốt thắng ngay; +2/+4 không chờ người kế nhận phạt. Wild/+4 vẫn cần màu hợp lệ trước khi gửi nước đánh.
- Engine ưu tiên chốt thắng khi tay bài về 0 trước khi tạo khoản phạt; xóa khoản phạt cũ, cửa sổ UNO và hành động rút dở. Không rút phạt tự động sau khi thắng.
- Production build (gồm typecheck frontend/backend) đạt; 72/72 test trên 7 file đạt với loopback. Test gồm sáu loại lá cuối, lá cuối cộng trong chuỗi, chồng rút trống, khóa nhận phạt sau thắng và ván hai socket thật. Chưa kiểm tra lại trực quan trên thiết bị trong lượt này.

## Thay đổi mở bàn không lật lá sẵn

- Theo yêu cầu người dùng, R01/R03 trong `docs/uno-rules.md` đã đổi: chia 7 lá mỗi người, giữ toàn bộ bài còn lại trong chồng rút, chồng bỏ rỗng; người trái dealer đi trước và được đánh bất kỳ lá nào. Lá chức năng đầu tiên do người chơi đánh áp dụng bình thường; Wild/+4 chọn màu cùng intent đánh.
- Projection trả `topCard: null` khi chưa mở bàn. UI hiện ô “Chờ lá đầu” và màu “Chưa mở bàn”, sau nước đánh giữ mặt lá bỏ thực từ server.
- Đã chạy typecheck, production build và 66/66 test trên 7 file (Socket.IO có quyền loopback), gồm sáu loại lá đầu, sai lượt, rút/giữ ở bàn rỗng, 2–6 người và bảo toàn 108 lá. Chưa kiểm tra trực quan/điện thoại trong lượt này.

## Bản sửa lá bỏ biến mất sau motion v3

- Sửa `src/App.tsx`: chỉ ẩn lá bỏ khi tồn tại cả flight và event khớp ID. Điều kiện cũ dùng optional chaining làm `undefined === undefined` đúng khi cả hai không tồn tại, nên lá bỏ bị ẩn sau khi event được dọn.
- Trạng thái mặc định đặt rõ `visibility: visible`; lá vừa đánh tiếp tục nằm trên bàn theo `game.topCard` từ server.
- Đã chạy `npm run build`: đạt, gồm TypeScript frontend/backend. Chưa kiểm chứng lại trực quan trên điện thoại trong lượt sửa này.

Ngày chạy gần nhất: 13/11/2026. Bản code BB-UNO-1 đã qua typecheck, test tự động, production build và smoke test HTTP/Socket.IO cục bộ. Terra chưa nghiệm thu độc lập.

## Kết quả đợt Sol

| Lệnh / kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Pass: frontend/packages và backend TypeScript. |
| `npm test -- --reporter=verbose` | Pass: **53/53 test, 6 file**. Chạy lại với quyền loopback vì realtime integration cần bind localhost; lần sandbox thường báo `EPERM`/timeout. |
| `npm run build` | Pass: TypeScript + server typecheck + Vite production. JS 414.90 kB (123.84 kB gzip), CSS 70.96 kB (15.57 kB gzip). Rollup báo hai annotation comment trong dependency Zod sẽ bị bỏ; không làm build fail. |
| `HOST=127.0.0.1 PORT=4315 npm start` + HTTP checks | Pass: `/`, `/health`, `/api/rooms`, Socket.IO polling handshake đều trả 200. Smoke chỉ xác minh production server và handshake; không thay thế ván game qua trình duyệt. |
| Hai client Socket.IO qua ván production shuffle | Pass trong lần chạy cuối: **126 hành động**, kết quả winner. Một lần chạy trước kết thúc sau 39 hành động. Sau mỗi hành động xác nhận đủ 108 ID bài duy nhất và không có tay bài đối thủ/chồng rút trong projection. |

### Phạm vi test tự động

- Engine: bộ 108 lá, chia 2–6, setup/dealer/lá mở đầu, màu và legality, chiều 2–6 người, +2/+4 chain/nhận phạt, rút/tái tạo, kết thúc, UNO và riêng tư.
- Room service: public/private, ready/start 2–6, kick, reconnect và thu hồi socket cũ, offline timeout, lifecycle close.
- Schema: envelope có game ID, strict payload, từ chối intent challenge cũ, dữ liệu đóng phòng.
- Socket.IO: hai client độc lập, join/start, privacy, hành động lặp, stale game/revision, reload host và resume, phạt cộng/nhận, rematch, sự kiện đóng phòng và ván production shuffle.
- HTTP LAN action ID: kiểm tra UUID fallback khi không có `crypto.randomUUID()`.

## Trình duyệt và thiết bị

Browser access host trả về trạng thái **unavailable** trong phiên này. Vì vậy chưa mở được hai profile trình duyệt riêng, chưa kiểm tra trực quan desktop/mobile 1440/390 px, bàn phím/focus/reduced motion, và chưa xác nhận lại trên điện thoại thật/LAN. Người dùng đã từng xác nhận bản sửa join trước đó hoạt động trên desktop, ẩn danh và điện thoại; đây là phản hồi lịch sử, không phải kiểm tra của đợt Sol.

## Giới hạn đã biết

- Phòng, phiên và ván nằm trong RAM của một process. Restart/crash làm mất phòng; không có database hoặc khôi phục state.
- Socket integration dùng hai client thật và có thêm ván production shuffle; không thay thế kiểm tra UI bằng browser và thao tác cảm ứng.
- Chưa chạy `npm ci` trên một checkout sạch hoặc kiểm tra deploy công khai/reverse proxy.

## Kết luận

Build và kiểm thử tự động hiện đạt. Có bằng chứng backend realtime cho một ván trọn vẹn trên hai socket; tiêu chí giao diện hai thiết bị/browser vẫn chờ Terra hoặc người dùng kiểm tra thủ công theo [sol-handoff.md](./sol-handoff.md). Không xem đây là nghiệm thu Terra.
