# Phạm vi sản phẩm MVP

Trạng thái: UNO [BB-UNO-1], Nối từ [NT-VI-1], Caro [HQ-CARO-1] và Bắn tàu [HQ-BANTAU-1] đã có trong code. UNO/Nối từ chơi 2–6 người; Caro/Bắn tàu đúng 2 người. Bắn tàu đang chờ Terra nghiệm thu độc lập. Kết quả kiểm chứng nằm trong [tóm tắt dự án](./reports/project-summary.md), hồ sơ game và [QA Bắn tàu](./reports/bantau/07-qa.md).

## Mục tiêu

Hai người trở lên trên thiết bị riêng mở web, nhập biệt danh, vào cùng phòng và chơi một trong bốn game realtime. Mỗi phòng chỉ có một game; Caro/Bắn tàu đúng hai người, UNO/Nối từ tối đa sáu. Server quyết định nước đi và kết quả. Trận dùng điểm trong RAM: thắng ván +10, mục tiêu trận do phòng cấu hình.

## Luồng và điều kiện chấp nhận

| Bước | Hành vi | Điều kiện chấp nhận |
|---|---|---|
| Trang chủ | Giới thiệu ngắn, thẻ UNO, biệt danh ở header, nhập mã | Toàn bộ tiếng Việt; có Luật chơi; vào UNO để tạo phòng; không yêu cầu đăng nhập |
| Tạo phòng | Server cấp mã và token phiên | Có mã sao chép được và chọn public/private; không tạo phòng hai lần khi nhấn lặp |
| Tham gia | Nhập mã rồi nhập tên | Báo rõ phòng sai/đầy/đang chơi; không có luồng join qua link |
| Phòng chờ | Hiện ghế, tên, kết nối, sẵn sàng, chủ phòng | 2–6 người; tất cả online, mọi khách sẵn sàng; chủ phòng bấm bắt đầu |
| Ván UNO | Tay bài riêng, lượt, rút, đánh, màu, hô UNO và thao tác luật cần thiết | Server xác thực; thông báo lý do từ chối; không lộ thông tin riêng |
| Nối từ | Từ mồi, tiếng khóa, nhập realtime, validate/dictionary vote, lượt và lịch sử | 2–6 người; server chốt từ/phiếu/deadline; từ chưa biết chỉ có hiệu lực trong ván khi nhóm duyệt |
| Caro | Bàn 9/15/19, chọn ô, lượt X/O và kết quả | Đúng 2 người; server xác thực nước, timer và quy tắc đúng mục tiêu 4/5/6 còn đầu mở theo HQ-CARO-1 |
| Bắn tàu | Đặt tàu kín, nhắm/bắn hai lần, hit/miss/sunk | Đúng 2 người; placement, timer, kết quả và điểm do server quyết định; miss không lưu lịch sử |
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

Game khác ngoài UNO, Nối từ, Caro và Bắn tàu; bot, tự động ghép trận, khán giả, chat/voice, bạn bè, tài khoản, thanh toán, quảng cáo, giải đấu, lịch sử lâu dài, đồng bộ nhiều backend.

## Tiêu chí nghiệm thu cuối

- Chạy trọn tạo → tham gia → sẵn sàng → bắt đầu → chơi → kết thúc → chơi lại trong từng game.
- Có trường hợp kiểm thử luật đặc biệt, bắt UNO và giải quyết Wild Draw Four theo quyết định đã ghi.
- Hai thiết bị dùng cùng URL LAN/production, không dùng mock đối thủ.
- Có kiểm tra mobile không tràn trang, mất mạng/nối lại, và packet không lộ bài.
- Có README chạy được, nguồn luật, báo cáo kiểm thử thật và giới hạn còn lại.

## Bổ sung phòng và tái sử dụng

Áp dụng [Phòng chơi và phần dùng lại](./rooms-and-reuse.md): chỉ join bằng mã, public/private, danh sách công khai để tham gia trực tiếp bằng mã của phòng, quyền kick và điều kiện ready của khách. Link mời chỉ điền mã vào form, không tự join. Tài liệu này thay các mô tả link mời và yêu cầu host tự ready trước đây.

## HQ-CARO-1

Caro dùng bàn 9×9, 15×15 hoặc 19×19 và đúng 2 người. Thắng khi nối đúng mục tiêu 4/5/6 theo bốn hướng, ít nhất một đầu trống; dãy vượt mục tiêu không thắng. Mỗi lượt 30 giây do server quyết định; timeout hoặc chịu thua kết thúc ván, mất kết nối tạm dừng lượt theo grace period phòng. Xem [luật và nguồn](./caro-rules.md) cùng [báo cáo triển khai](./reports/caro/summary.md).

## HQ-BANTAU-1

Bắn tàu đúng 2 người. Mỗi người xếp kín preset 3/4/5 tàu trên bàn 8/10/12. Chạm lần đầu để ngắm; chạm lại cùng ô để bắn. Miss không để dấu và được bắn lại; timeout bắn aim đã ACK hoặc ô ngẫu nhiên. Thắng ván +10, chưa đạt target thì tự nối ván sau 3 giây. Luật và khác biệt với Hasbro nằm ở [bantau-rules.md](./bantau-rules.md); triển khai đang chờ Terra QA tại [07-qa.md](./reports/bantau/07-qa.md).
