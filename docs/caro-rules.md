# Luật Caro — HQ-CARO-1

Ngày nghiên cứu và chốt triển khai: 15/11/2026. **HQ-CARO-1 đã được chọn để triển khai trong MVP.** Đây là luật sản phẩm Hội Quậy dựa trên Standard Caro của Gomocup; không tuyên bố là luật duy nhất của cờ Caro Việt Nam. BB-UNO-1 và NT-VI-1 giữ nguyên.

## Nguồn và chọn biến thể

| Nguồn đã đọc | Điều xác nhận và cách dùng |
|---|---|
| [Gomocup — Detail Information, mục Gomoku Rules/Tournament rules](https://gomocup.org/detail-information/) | Ban tổ chức mô tả game hai người luân phiên, Standard Caro bàn 15×15; đúng 5 liên tiếp, chặn hai đầu không thắng, 6 trở lên không thắng. Đây là nguồn chính cho điều kiện thắng. |
| [Renju International Federation — International Rules of Gomoku](https://www.renju.net/gomokurules/) | Đối chiếu bối cảnh Gomoku thi đấu và quy định riêng; không nhập các quy tắc mở đầu/thi đấu vào bản Caro này. |
| [Board Game Arena — Gamehelpgomoku](https://en.doc.boardgamearena.com/Gamehelpgomoku) | Nền tảng có Standard/Freestyle/Caro và tùy chọn xác nhận nước, đánh dấu nước cuối. Caro trên BGA cho hàng trên 5 thắng, khác Gomocup; chỉ tham khảo UX, không dùng làm điều kiện thắng. |

Không trộn Standard Caro với freestyle (từ 5 trở lên thắng) hoặc Renju (quân đi trước có nước cấm). Mở đầu tự do, X/O, timer và vòng đời phòng bên dưới là lựa chọn sản phẩm, không phải kết luận từ nguồn thi đấu.

## Người chơi, bàn và lượt

- Đúng **2 người thật**, một X và một O; không bot, khán giả hay chơi theo đội trong bản đầu. Room Caro min/max đều 2; UNO/Nối từ vẫn 2–6.
- Bàn chọn 9×9, 15×15 hoặc 19×19; mặc định 15×15. Dùng ô vuông chứa X/O để dễ chạm, thay cách đặt quân tại giao điểm của bàn cờ truyền thống. Tọa độ hàng/cột từ 0 tới `boardSize-1` ở API.
- Server bốc ngẫu nhiên người cầm X cho ván đầu; X đi trước. Ván mới trong cùng phòng với đúng hai người cũ đổi người cầm X; thành viên thay đổi thì bốc lại. Rematch vẫn về sảnh, khách ready rồi chủ bắt đầu.
- Mỗi lượt đặt đúng một quân của mình vào ô trống. Không di chuyển/xóa quân, không bỏ lượt hoặc xin đi lại. Không ép nước đầu ở giữa, không Swap/Swap2 hoặc nước cấm đôi ba/đôi bốn.

## Thắng và hòa

Sau mỗi nước hợp lệ, server xét bốn trục qua ô vừa đánh: ngang, dọc, chéo xuống và chéo lên. Đếm **toàn bộ dãy liên tục cực đại**, không cắt một dãy 6 thành một cửa sổ 5.

- Chủ phòng chọn mục tiêu **4, 5 hoặc 6 quân** trong phòng chờ (mặc định 5). Nối đúng số đã chọn, cùng loại và có ít nhất một đầu mở thì thắng ngay.
- Đầu mở là ô còn trong bàn và trống. Đầu bị chặn là quân đối phương **hoặc mép bàn**. Quy ước mép bàn này là lựa chọn Hội Quậy, nguồn chính không nêu rõ.
- Chặn cả hai đầu: chưa thắng, tiếp tục ván. Dãy dài hơn mục tiêu đã chọn: nước vẫn hợp lệ nhưng không thắng trên trục đó.
- Nếu một nước tạo nhiều trục, bất kỳ trục nào đạt điều kiện thì thắng. Server trả các ô của những dãy thắng để UI vẽ đường.
- Ưu tiên kiểm tra thắng trước hòa. Bàn kín không có dãy thắng thì hòa.

Ví dụ với mục tiêu mặc định 5: `·XXXXX·`, `OXXXXX·` thắng; `OXXXXXO` không thắng; `·XXXXXX·` không thắng. `|XXXXX·` thắng, `|XXXXXO` không thắng (`|` là mép bàn, `·` là ô trống).

## Thời gian, chịu thua và kết nối — lựa chọn MVP

- Mỗi lượt 15/30/45/60 giây theo cấu hình trận; mặc định 30 giây do server quản lý. Hết giờ người đang lượt thua ván và chờ ván sau; intent đến tại `now >= deadline` không được đặt quân. Chịu thua có dialog web, đối thủ thắng. UI đếm ngược/thanh thời gian chỉ hiển thị.
- Mạng gián đoạn: giữ ghế và tạm dừng đồng hồ, tối đa 90 giây theo room/session hiện hành. Resume giữ bàn/quân/lượt và thời gian còn lại, không reset 30 giây.
- Leave/kick/quá hạn reconnect khi đang chơi: **hủy ván**, không trao thắng; dùng chính sách chung đã có của phòng. Khác với hành động chịu thua có chủ ý. Reset ready và chuyển host theo chính sách chung.
- Không triển khai đề nghị hòa, xin đi lại, đồng hồ tổng ván, rating hoặc lưu lịch sử lâu dài. Hòa chỉ khi kín bàn.
- Ván kết thúc khóa đánh, dừng timer. Chủ phòng cho về sảnh/chơi lại; kết quả có lý do `five`, `timeout`, `resign`, `board-full` hoặc thông báo hủy của room.

## Hướng dẫn ngắn cho màn Luật chơi

“Hai người thay phiên đánh X và O. Chọn bàn 9×9, 15×15 hoặc 19×19, rồi chọn nối đúng 4/5/6 quân. Nối ngang, dọc hoặc chéo, còn ít nhất một đầu trống để thắng. Bị chặn hai đầu hoặc nối quá mục tiêu chưa thắng. Mép bàn tính là đầu bị chặn. Mỗi lượt chọn 15/30/45/60 giây; hết giờ hoặc chịu thua là thua ván.”

## Cấu hình Caro

Chỉ chủ phòng được đổi board size 9/15/19 và mục tiêu 4/5/6 khi phòng chờ hoặc lúc cấu hình trận mới. Đổi giá trị reset sẵn sàng của khách và phát snapshot mới; khách phải sẵn sàng lại trước ván đầu. Không đổi trong trận đang chạy. Mục tiêu được lưu trong phòng và `game.winLength`, giữ qua các ván/reconnect. Các size 9/19 là preset sản phẩm, không phải điều kiện nguồn thi đấu. `finishReason: 'five'` giữ làm mã kết quả nối đủ quân để tương thích giao thức; UI dùng `winLength` thực tế.

## Hai lần chọn ô và điểm trận

- Click/chạm lần đầu chọn ô trống và hiện preview quân; kích hoạt lần hai trên cùng ô gửi nước đi. Chọn ô khác chuyển preview; ô mới phải được kích hoạt lần nữa. Bàn phím Enter/Space cũng theo chọn→xác nhận; pan/zoom không đặt quân.
- Mỗi ván thắng được 10 điểm, hòa/hủy/thua 0. Mục tiêu trận 10–500 theo bội số 10, mặc định 50. Chưa đạt thì server tự khởi tạo ván mới sau 3 giây với cùng người/cấu hình và không yêu cầu ready lại. Đạt mục tiêu thì dừng trận.
- Có thể rời trong countdown; rời/kick/hết grace hủy countdown và trận, không tính điểm cho ván bị hủy. Điểm chỉ trong RAM.
