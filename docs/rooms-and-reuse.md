# Phòng chơi và phần dùng lại giữa các game

Trạng thái: room/session dùng chung cho UNO, Nối từ và Caro; Nối từ/Caro đang chờ Terra nghiệm thu độc lập. Kết quả và giới hạn nằm trong [tóm tắt dự án](./reports/project-summary.md), [báo cáo Nối từ](./reports/noitu/summary.md) và [báo cáo Caro](./reports/caro/summary.md).

## Vào phòng bằng mã, public và private

- Mọi phòng có mã 6 ký tự do server cấp. Người dùng nhập biệt danh và mã để tham gia; không xây luồng join qua link mời.
- Khi tạo phòng, chủ phòng chọn “Công khai” hoặc “Riêng tư”; mặc định riêng tư.
- Danh sách công khai cho bấm vào hàng phòng để tham gia trực tiếp qua cùng API join bằng mã; không tự ghép trận. Link mời chỉ điền sẵn mã, không tự join.
- Private không xuất hiện trong danh sách. Ai biết mã vẫn có thể vào nếu phòng còn nhận người; không thêm mật khẩu hay duyệt đơn xin vào.
- Danh sách công khai chỉ trả game, mã phòng, biệt danh/avatar chủ phòng, số người/tối đa và trạng thái. Không trả danh sách bài, token hoặc mã phòng private. Có giới hạn số kết quả/tần suất; phòng hết hạn phải biến mất.
- Chỉ phòng đang chờ mới xuất hiện trong danh sách công khai. Phòng đang chơi không nhận người mới; nối lại ghế cũ vẫn được phép.
- Chủ phòng đổi public/private khi đang chờ. Server cập nhật danh sách ngay; thao tác này không đổi mã hoặc đẩy người đang ở phòng ra.

## Reload, reconnect và đóng phòng

- Reload hoặc ngắt mạng là offline tạm thời; giữ ghế trong grace period, báo mất kết nối và cho resume đúng ghế. Không tự hiểu reload là leave.
- Room hết TTL/ghế cuối bị dọn: phát `room:closed` kèm reason/message tới socket online trước khi xóa room. Timeout hủy ván phát snapshot với notice. Kick/leave giữ hành vi đã nêu.
- Server restart không giữ RAM và không thể phát event trước khi tắt đột ngột; lần resume sau restart trả ROOM_NOT_FOUND, client xóa session và về sảnh có thông báo.

## Sẵn sàng và bắt đầu

- UNO/Nối từ bắt đầu với 2–6 người thật, bỏ qua ghế trống. Caro chỉ bắt đầu khi có đúng 2 người.
- Khách có nút “Sẵn sàng” / “Hủy sẵn sàng”. Chủ phòng có nút “Bắt đầu”; bấm bắt đầu chính là xác nhận của chủ phòng, không cần thêm lần bấm sẵn sàng riêng cho chủ phòng.
- Server chỉ chấp nhận start khi đúng chủ phòng, game của phòng sẵn sàng, phòng đang chờ, có ít nhất 2 người, tất cả đang kết nối và tất cả khách sẵn sàng.
- Khi thiếu điều kiện, nút start bị vô hiệu hóa kèm lý do cụ thể như “Cần thêm 1 người”, “Chờ An sẵn sàng”, “Có người đang mất kết nối” hoặc “Từ điển thử nghiệm chưa sẵn sàng”. Khách không thấy nút bắt đầu.
- Thêm/bớt thành viên, chuyển chủ phòng hoặc bắt đầu một trận mới thì reset ready của khách. Disconnect hủy ready của người mất kết nối; reconnect không tự ready lại. Các ván tiếp theo trong cùng trận tự nối sau countdown 3 giây và không dùng lại ready.
- Join/ready/kick/start đều qua hàng đợi của phòng. Nếu danh sách đã đổi, start với revision cũ bị từ chối, không chia bài cho một danh sách chưa được xác nhận.

## Trận nhiều ván, cài đặt và public discovery

- Một trận là chuỗi ván của cùng game, roster và settings. Người thắng mỗi ván nhận 10 điểm; hòa/thua/hủy nhận 0. Mục tiêu 10–500 bội số 10, mặc định 50. Điểm chỉ trong RAM và không chuyển giữa phòng/game.
- Khi chưa ai đạt mục tiêu, server công bố intermission 3 giây rồi mở ván kế tiếp tự động, không reload trình duyệt, không host-confirm/ready lại. Khi đủ mục tiêu, trận dừng. Một kết quả được quyết toán đúng một lần theo gameId/roundId.
- Người chơi được rời trong intermission. Rời, kick hoặc hết reconnect grace trước khi ván mới bắt đầu hủy countdown và trận; không âm thầm đổi roster. Offline tạm thời pause countdown trong grace; khi tất cả quay lại thì resume phần thời gian còn lại. Callback cũ không thể khởi tạo ván mới sau khi match đã hủy.
- Host chỉ chỉnh settings trước trận: thời gian lượt 15/30/45/60 giây (mặc định30), mục tiêu điểm, UNO stacking và Caro board9/15/19 cùng win length4/5/6. Thay đổi thật reset ready; khi trận bắt đầu roster/settings khóa. Trận mới có thể reset điểm và chọn cấu hình lại.
- Public directory hiển thị cả ba game nhưng chỉ phòng đang chờ, công khai, còn chỗ và được server đánh dấu joinable. Client gọi lại API join; danh sách không đảm bảo chỗ và không phải quyền truy cập. Không lộ private, state bàn/bài/từ, token hoặc nội dung score riêng.

## Quyền chủ phòng và đuổi người

- Chủ phòng có menu “Mời ra khỏi phòng” tại từng ghế khác, có hộp thoại xác nhận đúng biệt danh. Không thể tự đuổi bản thân; có thao tác rời phòng riêng.
- Trong phòng chờ: xóa ghế mục tiêu, thu hồi token/phiên, ngừng gửi snapshot và reset ready. Người bị đuổi về sảnh với thông báo “Bạn đã được chủ phòng mời ra khỏi phòng”.
- Trong ván: hộp thoại ghi rõ việc đuổi sẽ **hủy ván hiện tại**. Sau xác nhận, server thu hồi ghế mục tiêu, hủy ván với lý do công khai, đưa người còn lại về chờ. Không xóa ghế rồi tiếp tục UNO với bài/lượt bị mất; không trao thắng giả.
- Quyền được kiểm tra ở server trên mỗi hành động, bao gồm chủ phòng vừa bị chuyển quyền. Client không thể tự nhận là host hoặc dùng socket/token cũ sau kick.
- Kick là đuổi phiên hiện tại, không phải cấm vĩnh viễn. Không có tài khoản nên không cam kết chặn một người quay lại bằng phiên mới nếu họ còn biết mã.
- Chủ phòng rời chờ thì chuyển cho người online vào sớm nhất. Nếu chủ phòng rời ván, áp dụng chính sách rời ván đã có: hủy ván, chuyển chủ phòng rồi trở về chờ.

## UI dùng chung, màn chơi riêng

Tái sử dụng hệ token, typography, nút/input/dialog/toast và các màn sảnh/chờ/kết quả. Tách các phần đó khỏi bố cục lá bài UNO:

| Phần chung | Dữ liệu và trách nhiệm |
|---|---|
| Danh mục game | `gameKey`, tên, minh họa, mô tả, min/max người, trạng thái ra mắt |
| Tạo phòng | Game đã chọn, chế độ public/private, nickname, lỗi tạo |
| Sảnh công khai | Dữ liệu phòng từ server; sao chép mã; loading/rỗng/lỗi |
| Khung phòng chờ | Mã/copy, chế độ, danh sách người, host, kết nối, ready, start, leave/kick |
| Khung phiên chơi | Thanh phòng, trạng thái mạng, luật chơi, vùng render game và kết quả |
| Riêng UNO | Lá bài, vị trí đối thủ, tay bài, lượt, chọn màu, cộng/nhận phạt và hô UNO |
| Riêng Nối từ | Prefix/suffix, draft, dictionary check, proposal vote, deadline, lịch sử và người bị loại |
| Riêng Caro | Bàn 15×15, X/O, nước cuối, dãy thắng, deadline và capabilities server |

Trang chủ giữ ô nhập mã; không khôi phục nút tạo phòng trong hero đã bị người dùng bỏ. Tạo phòng nằm sau bước chọn UNO. Phần danh sách công khai đặt dưới khu chọn game hoặc trong trang UNO để không đẩy game xuống khỏi màn đầu.

## Công nghệ và ranh giới tái sử dụng

- Giữ React + TypeScript + Vite và CSS tokens; backend Node + TypeScript + Socket.IO, trạng thái RAM trong một process.
- Room service sở hữu thành viên, host, visibility, ready, start/leave/kick, vòng đời và danh sách công khai. Session service sở hữu token và reconnect. Hai phần không biết lá bài hoặc luật UNO.
- Room lưu `gameKey`, giới hạn min/max từ catalog server và state riêng game. Điều kiện ready/start chung nằm ở room service; UNO/Nối từ min=2/max=6, Caro min=max=2.
- Module UNO, Nối từ và Caro lần lượt sở hữu state, validate hành động, transition, kết quả và projection. Không đẩy engine hoặc raw state kín vào bundle frontend.
- Room service rẽ nhánh tường minh theo từng game hiện có nhưng không tạo plugin framework hay engine luật tổng quát.
- Khách chỉ gửi ý định; server kiểm tra quyền, phase, payload, action ID và revision. Discovery public cũng do server lọc, không tải toàn bộ phòng rồi ẩn private bằng CSS.

## Thứ tự làm và kiểm chứng

1. Chốt hồ sơ luật UNO; dựng engine và test luật như kế hoạch hiện có.
2. Làm session/room chung, visibility/discovery, ready/start/kick/leave; kiểm thử bằng Socket.IO client thật.
3. Nối màn chờ chung và UI UNO; thay copy link bằng copy mã trong luồng thật.
4. Thử đủ 2–6 người, khách chưa ready, host chuyển quyền, join/kick đua với start, kick trong ván, public đổi private, private không lọt qua danh sách, socket đã bị kick không resume được.
5. UNO và Nối từ có unit/service tests; integration Socket.IO kiểm thử bằng hai client độc lập. Kiểm tra browser/điện thoại LAN thật cho Nối từ còn phải làm độc lập; xem báo cáo kiểm chứng.

Public là danh sách phòng tự chọn, không có matchmaking. Phòng và token mất khi backend khởi động lại.

## Caro HQ-CARO-1

Caro đã tích hợp vào catalog và room/session dùng chung. Room có min/max đều 2; người thứ ba bị từ chối bởi giới hạn server. Engine, action `caro:action`, timer, pause/resume, snapshot và UI riêng được ghi tại [luật](./caro-rules.md), [báo cáo code](./reports/caro/summary.md) và [QA checklist](./reports/caro/summary.md). Đây không thay giới hạn 2–6 của UNO/Nối từ.
