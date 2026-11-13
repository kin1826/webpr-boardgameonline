# Báo cáo triển khai motion UNO — bàn giao Terra

Ngày triển khai: 13/11/2026  
Trạng thái: code và kiểm tra tự động hoàn tất; nghiệm thu hình ảnh trên browser/thiết bị thật đang chờ Terra. Đây không phải xác nhận Terra đã approve.

## Tóm tắt

- Giảm radius lá bài xuống 6px qua token `--card-radius`; áp dụng cho lá trên tay, lá trên chồng bỏ, mặt sau và artwork/preview liên quan. Số trên lá tiếp tục màu đen.
- Thêm chuyển động ngắn, theo loại hành động: lá số đặt nhẹ; Wild chuyển màu viền bàn; +2/+4/Bỏ lượt có cú đập, nhãn và rung viền hình ảnh bàn; +4 mạnh hơn. Reverse quay ký hiệu chiều; rút bài chỉ làm nổi lá vừa rút với người nhận; chia bài có stagger ngắn; UNO/bắt UNO có callout; kết quả nhấn sáng ghế thắng.
- Nhận nhiều lá phạt dùng ba lá úp minh họa tối đa và huy hiệu `×N`; không lặp animation cho từng lá. Nội dung sự kiện không có ID hoặc mặt các lá nhận.
- Có checkbox “Giảm hiệu ứng” lưu bằng `localStorage`, kết hợp `prefers-reduced-motion`. Lớp rung không nhận pointer event và không dịch chuyển tay bài, nút hay dialog.
- Giữ nguyên BB-UNO-1, engine luật và HTTP LAN UUID fallback. Thay đổi server chỉ bổ sung event trình bày sau action được chấp nhận.

## Ma trận hiệu ứng đã làm

| Hành động đã được server xác nhận | Phản hồi đang có |
|---|---|
| Đánh lá số | Lá trên chồng bỏ trượt/chạm nhẹ; không rung bàn. |
| Đánh Wild/chọn màu | Viền bàn đổi theo màu hiện hành với transition ngắn. |
| +2 / +4, kể cả cộng tiếp | Lá đập xuống; viền felt rung ngắn; nhãn cho biết loại lá và tổng phạt mới. +4 có biên độ/cường độ lớn hơn. |
| Bỏ lượt | Lá đập xuống và viền felt rung; nhãn “Bỏ lượt” nằm cạnh ghế mục tiêu đã tính từ hướng trước nước đi. |
| Reverse | Biểu tượng chiều quay và nhãn chiều mới vẫn dựa trên snapshot. |
| Rút 1 / nhận nhiều lá / bắt UNO | Người nhận chỉ thấy lá mới của mình đi vào tay; nhóm bài phạt chỉ là mặt sau đại diện kèm `×N`; không gửi bài riêng cho người khác. |
| Chia đầu ván | Lá trên tay chạy stagger ngắn; ghế đối thủ fade vào. |
| Hô UNO / bắt lỗi UNO | Callout ngắn theo action được xác nhận; bắt lỗi có số lá phạt đại diện. |
| Kết thúc ván | Kết quả thắng được nhấn sáng một lần; không có confetti trong bản này. |

## Luồng sự kiện và riêng tư

`game:effect` có schema Zod strict tại `packages/shared/src/index.ts`. Payload có `eventId` từ `gameId:gameRevision`, room/game ID và revision, loại action, actor/target/winner khi có, loại/màu/giá trị lá vừa đánh, màu hiện hành/chiều/phạt và số lá được nhận khi phù hợp.

Server dựng metadata từ state trước/sau transition sau khi `gameAction` đã xác thực. Nó broadcast snapshot theo từng người trước rồi mới gửi event tới các ghế đang online. Action sai không phát event. Action ID trùng trả response cache nên không phát event lần hai. Payload tuyệt đối không chứa hand, ID lá vừa rút, mặt lá rút hoặc draw pile.

Client parse lại payload; `src/game-effects.ts` chỉ cho chạy nếu room ID, game ID, room revision và game revision trùng chính xác snapshot hiện hành, đồng thời event chưa thấy. Event đến sớm, cũ hoặc trùng bị bỏ, không xếp hàng phát muộn. Resume lấy snapshot làm nền và xóa effect cũ; rematch/gameId mới xóa dấu event cũ.

Timer callout được cleanup khi đổi effect/unmount. Tab ẩn, disconnect/connect-error, resume, rời phòng, đóng phòng và đổi ván xóa effect đang hiện. WAAPI animation của viền được cancel khi effect mất hoặc component unmount. Trạng thái bàn vẫn luôn đến từ snapshot; motion không khóa nút hoặc đổi lượt.

## Thay đổi mã

| File | Nội dung |
|---|---|
| `packages/shared/src/index.ts` | Schema/type công khai strict cho `game:effect`. |
| `server/src/index.ts` | Phát event sau snapshot cho start và game action hợp lệ; suy ra dữ liệu hiển thị từ transition, không đưa bài riêng vào payload. |
| `src/game-effects.ts` | Gate theo snapshot/revision và dedupe event. |
| `src/App.tsx` | Nhận/kiểm tra event, dọn effect theo lifecycle, render callout/nhãn/animation và tùy chọn giảm hiệu ứng. |
| `src/styles/app.css`, `src/styles/theme.css` | Token radius/motion, motion theo loại lá, viền rung, trạng thái reduced motion/mobile và nhóm lá minh họa. |
| `packages/shared/src/index.test.ts`, `server/src/realtime.test.ts`, `src/game-effects.test.ts` | Schema privacy, server event/idempotency, exact revision và stale/duplicate tests. |
| `docs/uno-motion-plan.md`, `docs/architecture.md`, `docs/ui-ux.md`, `docs/test-plan.md`, `docs/implementation-plan.md`, `README.md` | Đồng bộ quyết định, trạng thái và liên kết bàn giao. |

## Những phần Terra cần kiểm tra trực quan

Browser automation host không khả dụng trong lượt triển khai này; không có ảnh chụp UI hoặc kiểm tra thiết bị thật. Terra cần mở hai phiên độc lập và kiểm tra:

1. Tạo phòng, tham gia bằng mã, sẵn sàng, bắt đầu; bài chia xong hiển thị ngay và không chặn thao tác.
2. Đánh lá số, Wild/chọn màu, +2 và +4; thử cộng phạt theo BB-UNO-1, sau đó nhận phạt. Xác nhận tổng `×N`, màu bàn và bài riêng từng người đúng.
3. Đánh Bỏ lượt và Reverse ở 2 người lẫn nhiều người; nhãn nằm cạnh người bị bỏ, ký hiệu chiều khớp snapshot.
4. Rút một lá, hô UNO, bắt lỗi UNO, kết thúc ván và chơi lại; không phát lại hiệu ứng sau reload/resume/rematch.
5. Thử drop/reconnect, tab chuyển nền rồi quay lại; xác nhận không có effect cũ phát lại và có thể tiếp tục đúng ghế.
6. Màn hình 1440, 390 và 360 CSS px, 2/4/6 người, tay bài nhiều lá; không tràn ngang, viền rung không kéo lệch tay bài/controls/dialog.
7. Bật checkbox “Giảm hiệu ứng” và kiểm tra OS `prefers-reduced-motion`; trạng thái cuối vẫn rõ, không còn rung/di chuyển đáng kể. Kiểm tra bàn phím/focus ở dialog chọn màu và controls.

### Giới hạn đã biết của bản motion

- “Rung bàn” được thể hiện bằng Web Animations API trên viền hình ảnh của felt table, không rung toàn bộ viewport hoặc UI điều khiển. Biên độ thấp hơn trên màn hình nhỏ.
- Kết quả dùng winner pulse; chưa có confetti. Chia bài tạo stagger cho tay bài và fade ghế đối thủ, không mô phỏng đường bay riêng cho từng lá.
- Event lifecycle/reduced-motion đã được rà qua mã và có test cho schema, privacy, duplicate và revision gate; visibility/reconnect cleanup chưa có browser test tự động.
- Màu, nhịp, cảm giác cú đập và độ dễ đọc vẫn cần mắt người xác nhận trên desktop/mobile. Không coi build xanh là nghiệm thu UI.

## Kiểm tra đã chạy

| Lệnh/kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt. |
| `npm test -- --reporter=dot` | Đạt: 57/57 test, 7 file. Socket.IO integration được chạy với quyền loopback. |
| Production-shuffle round qua hai socket | Ván kết thúc sau 22 hành động trong lần chạy cuối; số nước thay đổi theo shuffle. |
| `npm run build` | Đạt. Vite có hai cảnh báo không fatal về annotation comment của Zod trong Rollup. |
| Browser hai phiên / screenshot 360, 390, 1440 / điện thoại LAN | **BLOCKED — chưa thực hiện**; `cua.getState()` trả lỗi “The browser access host is unavailable”. |

## Bảo toàn phạm vi

- `docs/uno-rules.md` và BB-UNO-1 không đổi trong đợt này.
- Không đổi giao thức HTTP LAN tạo UUID/action ID fallback hoặc join flow.
- Không thêm thư viện animation, game khác, audio, vibration API hoặc database.
- Server khởi động lại vẫn làm mất phòng như giới hạn MVP hiện có.
