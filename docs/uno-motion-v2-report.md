# Báo cáo motion UNO v2 — bàn giao Terra

Ngày: 13/11/2026. Trạng thái: code và kiểm thử tự động đạt; nghiệm thu UI bằng browser/điện thoại **BLOCKED**, chưa có Terra approval.

## Đã triển khai

- Tay bài mobile xếp thành các hàng chồng khoảng 18px, phần lộ xấp xỉ 46px; nhiều lá xuống hàng và cuộn dọc trong vùng tay bài. Lá hợp lệ được chọn rồi xác nhận ở tray, không đánh ngay khi tap lần đầu; Wild vẫn mở dialog màu. Các thao tác luật vẫn dựa trên `allowedActions` từ server.
- Mobile felt giảm min-height 430px xuống 285px; tray nằm sau scene felt, trước hand, có chiều cao dự trữ và chứa trạng thái UNO/nhận phạt/giữ lá cùng action tương ứng. Các bản prompt cũ trong felt được ẩn để tránh trùng nút. Tray vẫn cần kiểm tra trực quan để xác nhận không chồng với pile ở các kích thước.
- Event `play` đã xác nhận làm lá bay 290ms từ rect lá local đã lưu trước khi snapshot xóa, hoặc từ avatar ghế đối thủ, tới chồng bỏ. Overlay không chặn tương tác; thiếu nguồn/vắng event thì không chạy. Snapshot cập nhật ngay, animation không khóa lượt.
- Mặt scene felt (ring và pile) rung theo `penaltyTotal` server xác nhận; cường độ tăng đơn điệu và giới hạn 14px desktop/8px mobile, thời lượng tối đa 320ms. +4 sử dụng tổng phạt lớn hơn; Skip dùng impact nhẹ hơn. Tray/tay bài không nằm trong lớp transform. App setting và OS reduced motion bỏ animation.
- Không sửa engine luật, BB-UNO-1 hoặc HTTP LAN UUID action fallback. Không thêm dependency.

## File chính

| File | Nội dung |
|---|---|
| `src/App.tsx` | Felt wrapper, impact WAAPI, flight overlay, tray, chọn/xác nhận bài trên mobile, reset khi tab nền/resize/orientation. |
| `src/game-effects.ts` | Hàm cường độ impact có trần. |
| `src/game-effects.test.ts` | Test tính tăng đơn điệu, trần desktop/mobile, dữ liệu không hữu hạn và gate event hiện hữu. |
| `src/styles/app.css` | Felt/tray/mobile hand chồng, flight overlay, reduced motion. |
| `docs/uno-motion-v2-plan.md`, `docs/luna-uno-motion-v2-prompt.md`, `docs/implementation-plan.md`, `docs/test-plan.md` | Cập nhật trạng thái và checklist. |

## Event, riêng tư và lifecycle

Dùng lại `game:effect` của v1; không thêm trường event. Ghép lá local bằng `actorId` và revision kế tiếp vì hiện chỉ có một action client đang gửi tại một thời điểm; cache rect trước intent. Người khác lấy nguồn từ ghế theo `actorId`, mặt lá lấy từ event đã parse. Event phải khớp room/game revision qua gate cũ trước khi effect được render. Payload không thêm token, hand hoặc lá rút. Invalid action không có event nên không có animation thành công.

Flight và pending rect bị xóa khi tab ẩn, resize/orientation, đổi effect hoặc unmount; timeout dọn overlay. WAAPI bị cancel trong cleanup. Rematch/disconnect/room close tiếp tục xóa `gameEffect` qua lifecycle v1. Rủi ro còn lại: actor+revision là correlation không có actionId tường minh; Terra cần kiểm tra chuỗi action nhanh và event bị bỏ do revision không khớp. Nếu cần nâng cấp, thêm actionId đã validate vào event và test tính tương thích trước.

## Kết quả kiểm tra thực chạy

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt. |
| `npm run build` | Đạt; có hai cảnh báo Rollup không fatal từ annotation comment trong Zod. |
| `npm test -- --reporter=dot src/game-effects.test.ts` | Đạt: 4/4 test. |
| `npm test -- --reporter=dot` | Đạt: 58/58 test trên 7 file, chạy với quyền loopback. Ván production shuffle hai socket kết thúc sau 12 action ở lần chạy này. |
| Browser/UI 1440, 390, 360; hai client; motion/reduced motion; điện thoại thật | **BLOCKED**: `cua.getState()` báo “The browser access host is unavailable”. Không có ảnh/video mới và không khẳng định đã xem trực quan. |

## Terra cần nghiệm thu

1. Hai client độc lập: lá số bay đúng từ tay/avatar tới discard; rejected/stale action không chạy flight.
2. Chuỗi phạt 2→4→8→12→16: lực tăng dễ nhận thấy, chạm trần; +4 mạnh hơn +2 cùng mức thích hợp; Skip nhẹ; nhận phạt không giả như đánh lá cộng.
3. Tray ở chờ, vừa rút, UNO, bắt lỗi, phạt và khi UNO/phạt cùng tồn tại: nút chính xác, không che bài, chiều cao ổn định.
4. 1440px; mobile 360×640 và 390×844, 2/4/6 người, 1/7/14/25/40 lá, portrait/landscape: các lá dễ tap, không tràn ngang; cuộn dọc khi hand dài.
5. Keyboard/focus, zoom 200%, app/OS reduced motion, tab nền, reconnect/rematch. Xác nhận không replay effect và không rung tray/hand.

Lưu ý implementation: các thẻ mobile chồng bằng flex wrap và phần lộ 46px, chưa tự tính hàng theo từng chiều rộng. Thiết kế/độ chồng, tray trong giới hạn felt và đường bay chỉ có thể được chốt sau kiểm tra trực quan. Không dùng test xanh thay cho nghiệm thu Terra.
