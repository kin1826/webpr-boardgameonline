# Phạm vi sản phẩm MVP

> Đặc tả đích mới: BB-UNO-1 trong `uno-rules.md` và đợt sửa `uno-fix-plan.md` đã được duyệt và triển khai; Terra cần nghiệm thu. Những yêu cầu Classic/challenge không phù hợp bên dưới được thay bởi BB-UNO-1.

Trạng thái: MVP đã triển khai; đặc tả và các lựa chọn sản phẩm được chốt 13/11/2026. Phần chưa kiểm tra browser/thiết bị thật nằm trong [verification-report.md](./verification-report.md).

## Mục tiêu

Hai người trên hai thiết bị mở web, nhập biệt danh, vào cùng phòng và chơi trọn một ván UNO bằng realtime. Tối đa sáu người; người chơi đầu tiên hết bài thắng sau khi hoàn tất nghĩa vụ cuối ván theo bộ luật đã chọn. Không có điểm tích lũy qua nhiều ván.

## Luồng và điều kiện chấp nhận

| Bước | Hành vi | Điều kiện chấp nhận |
|---|---|---|
| Trang chủ | Giới thiệu ngắn, thẻ UNO, biệt danh ở header, nhập mã | Toàn bộ tiếng Việt; có Luật chơi; vào UNO để tạo phòng; không yêu cầu đăng nhập |
| Tạo phòng | Server cấp mã và token phiên | Có mã sao chép được và chọn public/private; không tạo phòng hai lần khi nhấn lặp |
| Tham gia | Nhập mã rồi nhập tên | Báo rõ phòng sai/đầy/đang chơi; không có luồng join qua link |
| Phòng chờ | Hiện ghế, tên, kết nối, sẵn sàng, chủ phòng | 2–6 người; tất cả online, mọi khách sẵn sàng; chủ phòng bấm bắt đầu |
| Ván chơi | Tay bài riêng, lượt, rút, đánh, màu, hô UNO và thao tác luật cần thiết | Server xác thực; thông báo lý do từ chối; không lộ thông tin riêng |
| Kết thúc | Hiện người thắng hoặc lý do hủy ván | Có nút trở về phòng chờ để chơi lại; reset sẵn sàng, giữ phòng và ghế hợp lệ |
| Nối lại | Reload hoặc mạng gián đoạn ngắn | Giữ đúng ghế, tay bài và ván; socket cũ không điều khiển được |

## Quyết định sản phẩm cho vòng đời phòng

- Bắt đầu với 2, 3, 4, 5 hoặc 6 người thật đang ở phòng; không yêu cầu đủ 6 ghế. Chỉ kiểm tra sẵn sàng của người tham gia, bỏ qua ghế trống. Chủ phòng quyết định lúc bắt đầu, không tự bắt đầu khi đủ 2 người.
- Biệt danh: trim, chuẩn hóa Unicode NFC, 1–24 ký tự Unicode; chỉ hiển thị dưới dạng text, không render HTML. Tên trùng vẫn là hai người khác nhau, phân biệt bằng vị trí/nhãn “Bạn”.
- Mã phòng: 6 ký tự chữ hoa/số dễ đọc, tạo ngẫu nhiên trên server, kiểm tra trùng. Mã dùng để tham gia, không phải mật khẩu hay token quyền điều khiển.
- Không có khán giả hoặc ghế mới trong ván đang chơi. Token hợp lệ được nối lại ghế cũ.
- Khi phòng chờ đổi thành viên hoặc người chơi mất kết nối, reset sẵn sàng để tránh bắt đầu với danh sách chưa được xác nhận.
- Chủ phòng rời chờ: chuyển cho người online vào sớm nhất; nếu tất cả offline, chuyển khi có người nối lại.
- Mất mạng khi đang chơi: tạm dừng toàn ván, hiện người offline và hạn còn lại. Thời gian nối lại đề xuất 90 giây, không kéo dài bởi sự kiện lặp.
- Quá hạn hoặc bấm rời khi đang chơi: **hủy ván**, ghi rõ người bỏ cuộc; không tuyên bố người hết bài thắng, không chia lại bài giữa chừng. Người còn lại quay về chờ và chơi ván mới.
- Phòng không còn ghế được dọn ngay. Ghế offline ở phòng chờ hết hạn sau 90 giây. Phòng chờ không có hoạt động hợp lệ hết hạn sau 30 phút.
- Người chơi mất kết nối bị loại khỏi ghế sau 90 giây; nếu đang chơi, ván bị hủy và người còn lại về chờ. Phòng có ván không tiến triển trong 15 phút bị hủy ván; không tự đánh hoặc rút thay người chơi. Đây là chính sách vận hành, không phải luật UNO.

Các mốc thời gian trên là lựa chọn MVP, có thể điều chỉnh có ghi nhận khi thử thực tế.

## Ngoài phạm vi

Game khác, bot, tự động ghép trận, khán giả, chat/voice, bạn bè, tài khoản, thanh toán, quảng cáo, giải đấu, điểm nhiều ván, lịch sử lâu dài, đồng bộ nhiều backend.

## Tiêu chí nghiệm thu cuối

- Chạy trọn tạo → tham gia → sẵn sàng → bắt đầu → đánh/rút/chọn màu → kết thúc → chơi lại.
- Có trường hợp kiểm thử luật đặc biệt, bắt UNO và giải quyết Wild Draw Four theo quyết định đã ghi.
- Hai thiết bị dùng cùng URL LAN/production, không dùng mock đối thủ.
- Có kiểm tra mobile không tràn trang, mất mạng/nối lại, và packet không lộ bài.
- Có README chạy được, nguồn luật, báo cáo kiểm thử thật và giới hạn còn lại.

## Bổ sung phòng và tái sử dụng

Áp dụng [Phòng chơi và phần dùng lại](./rooms-and-reuse.md): chỉ join bằng mã, public/private, danh sách công khai để tìm mã, quyền kick và điều kiện ready của khách. Link mời chỉ điền mã vào form, không tự join. Tài liệu này thay các mô tả link mời và yêu cầu host tự ready trước đây.
