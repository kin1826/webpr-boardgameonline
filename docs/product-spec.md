# Phạm vi sản phẩm MVP

Trạng thái: UNO theo [BB-UNO-1](./uno-rules.md) đã triển khai; Nối từ NT-VI-1 vừa được thêm và đang chờ nghiệm thu độc lập. Kết quả kiểm chứng nằm trong [tóm tắt dự án](./reports/project-summary.md) và [báo cáo Nối từ](./reports/noitu/summary.md).

## Mục tiêu

Hai người trở lên trên thiết bị riêng mở web, nhập biệt danh, vào cùng phòng và chơi UNO hoặc Nối từ realtime. Mỗi phòng chỉ có một game, tối đa sáu người; trạng thái do server kiểm tra. Không có điểm tích lũy qua nhiều ván.

## Luồng và điều kiện chấp nhận

| Bước | Hành vi | Điều kiện chấp nhận |
|---|---|---|
| Trang chủ | Giới thiệu ngắn, thẻ UNO, biệt danh ở header, nhập mã | Toàn bộ tiếng Việt; có Luật chơi; vào UNO để tạo phòng; không yêu cầu đăng nhập |
| Tạo phòng | Server cấp mã và token phiên | Có mã sao chép được và chọn public/private; không tạo phòng hai lần khi nhấn lặp |
| Tham gia | Nhập mã rồi nhập tên | Báo rõ phòng sai/đầy/đang chơi; không có luồng join qua link |
| Phòng chờ | Hiện ghế, tên, kết nối, sẵn sàng, chủ phòng | 2–6 người; tất cả online, mọi khách sẵn sàng; chủ phòng bấm bắt đầu |
| Ván chơi | Tay bài riêng, lượt, rút, đánh, màu, hô UNO và thao tác luật cần thiết | Server xác thực; thông báo lý do từ chối; không lộ thông tin riêng |
| Nối từ | Từ mồi, tiếng khóa, nhập realtime, validate/dictionary vote, lượt và lịch sử | 2–6 người; server chốt từ/phiếu/deadline; từ chưa biết chỉ có hiệu lực trong ván khi nhóm duyệt |
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

## Nối từ NT-VI-1

- Server chọn người bắt đầu và từ mồi; tiếng cuối khóa sẵn, người chơi nhập một tiếng. Sai từ có thể thử lại mà không reset 30 giây.
- Từ chưa có trong dictionary thử nghiệm tạo proposal vote tối đa 15 giây. Chỉ người khác còn active được bỏ phiếu; strict majority trên toàn bộ eligible voter để nhận; timeout bác.
- Hết giờ hoặc chịu thua loại người khỏi ván; người cuối active thắng. Pause/reconnect giữ deadline còn lại.
- Bộ từ điển hiện có 47.877 mục sau heuristic; semantic review mẫu 200 mục chưa hoàn tất và quyền dữ liệu chưa xác minh. Đây là bản thử nghiệm, không phải nguồn kết luận ngôn ngữ hoặc data public đã cleared.
- Luật đầy đủ: [NT-VI-1](./noitu-rules.md).

## Ngoài phạm vi

Game khác ngoài UNO và Nối từ, bot, tự động ghép trận, khán giả, chat/voice, bạn bè, tài khoản, thanh toán, quảng cáo, giải đấu, điểm nhiều ván, lịch sử lâu dài, đồng bộ nhiều backend.

## Tiêu chí nghiệm thu cuối

- Chạy trọn tạo → tham gia → sẵn sàng → bắt đầu → chơi → kết thúc → chơi lại trong từng game.
- Có trường hợp kiểm thử luật đặc biệt, bắt UNO và giải quyết Wild Draw Four theo quyết định đã ghi.
- Hai thiết bị dùng cùng URL LAN/production, không dùng mock đối thủ.
- Có kiểm tra mobile không tràn trang, mất mạng/nối lại, và packet không lộ bài.
- Có README chạy được, nguồn luật, báo cáo kiểm thử thật và giới hạn còn lại.

## Bổ sung phòng và tái sử dụng

Áp dụng [Phòng chơi và phần dùng lại](./rooms-and-reuse.md): chỉ join bằng mã, public/private, danh sách công khai để tìm mã, quyền kick và điều kiện ready của khách. Link mời chỉ điền mã vào form, không tự join. Tài liệu này thay các mô tả link mời và yêu cầu host tự ready trước đây.
