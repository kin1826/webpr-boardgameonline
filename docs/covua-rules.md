# Cờ vua — luật triển khai HQ-COVUA-1

Ngày 19/11/2026. **Đã triển khai engine, phòng Online và chế độ 2P cùng máy; đang chờ Terra kiểm thử độc lập.** Đây là lựa chọn luật của Hội Quậy, không phải chứng nhận luật thi đấu FIDE đầy đủ. [Tổng kết và checklist Terra](./reports/covua/summary.md).

## Nguồn và phạm vi

- [FIDE Laws of Chess, hiệu lực 01/01/2023](https://handbook.fide.com/chapter/E012023), [PDF chính thức](https://rcc.fide.com/wp-content/uploads/2022/12/20230101Laws-of-Chess_final.pdf): tham chiếu cách đi/chiếu/nhập thành/phong cấp (Điều 3), kết quả (5), thời gian (6), hòa (9).
- [Thông báo FIDE về bản 2023](https://www.fide.com/2023-fide-laws-of-chess-published/) xác nhận bản nguồn; không trộn Chess960 hoặc luật blitz phạt nước sai vào game thường.
- Nghiên cứu 18/11: truy cập toàn trang Handbook timeout, kết quả tìm kiếm trang chính thức đọc được các Điều 3.8/3.9/9.2/9.3/9.6. Luna phải đọc được nguồn đầy đủ trước khóa baseline luật; không ghi đã đọc toàn bộ PDF khi chưa đọc.

Quy ước phần mềm bên dưới gồm đồng hồ, phiên, điểm, chống spam và phần nhận diện hòa giới hạn. Những phần này là lựa chọn sản phẩm, không gán cho FIDE.

## Bàn và quân

Đúng hai người Trắng/Đen, bàn 8×8, 32 quân. Trắng đi trước, góc h1 là ô sáng. Tọa độ chuẩn a1–h8; khi Trắng dưới: hàng 1 Xe–Mã–Tượng–Hậu–Vua–Tượng–Mã–Xe, hàng 2 tám Tốt; Đen tương ứng hàng 8/7. Hậu đứng trên ô cùng màu bên mình.

| Quân | Số/bên | Đặc tả nước đi dự kiến |
|---|---:|---|
| Vua | 1 | Một ô mọi hướng, không tới ô bị tấn công; có nhập thành khi đủ điều kiện. |
| Hậu | 1 | Ngang/dọc/chéo qua đường trống. |
| Xe | 2 | Ngang/dọc qua đường trống. |
| Tượng | 2 | Chéo qua đường trống. |
| Mã | 2 | Chữ L, nhảy qua quân. Không áp luật cản chân Mã của Cờ tướng. |
| Tốt | 8 | Tiến một ô trống; từ vị trí xuất phát có thể tiến hai nếu cả hai ô trống; ăn chéo một ô; không lùi. |

Không ăn quân cùng bên, tự chiếu hoặc để hai Vua kề nhau. Ô bị tấn công khác với danh sách nước đi hợp lệ (đặc biệt Tốt/Vua/quân ghim). Kết thúc bằng chiếu bí, không bắt Vua thật. Bí nước mà không bị chiếu là hòa.

## Nước đặc biệt

- Nhập thành thường: Vua e1/e8 sang g1/g8 hoặc c1/c8, Xe góc sang f hoặc d trong một nước. Vua và Xe tương ứng chưa từng đi, có quyền còn lưu, đường trống, Vua không đang chiếu/qua ô chiếu/đến ô chiếu. Xe đi rồi quay lại, bị bắt hoặc Xe phong cấp không khôi phục quyền. Ô b1/b8 phải trống khi nhập dài nhưng không cần an toàn khỏi tấn công. Không nhập thành bằng cách gửi hai action.
- Bắt tốt qua đường: ngay lượt sau Tốt địch tiến hai ô và đứng kề, Tốt mình có thể ăn vào ô nó vừa vượt; bỏ lượt đó mất quyền. Loại đúng Tốt ở ô khác ô đích; cấm nếu làm Vua mình lộ chiếu.
- Phong cấp: Tốt đến hàng cuối chọn Hậu/Xe/Tượng/Mã cùng bên, kể cả loại chưa bị bắt; có thể có nhiều Hậu. Không phong Vua/Tốt. UI mở chọn bốn quân, gửi from/to/promotion nguyên tử; chưa chọn thì server chưa commit và clock vẫn chạy. Không tự phong Hậu khi hết giờ. Đóng chọn có thể chọn nước khác nếu chưa gửi.

## Hòa và thứ tự kết quả

Đề xuất giữ phân biệt yêu cầu hòa và hòa tự động:

1. Chiếu bí: thắng ngay sau nước hợp lệ. Bí nước: hòa.
2. Nhận diện thiếu vật chất chắc chắn theo tập hỗ trợ phía dưới: hòa tự động.
3. Lặp cùng vị trí 5 lần hoặc 150 ply liên tiếp không đi Tốt/ăn quân: hòa tự động; chiếu bí cùng nước ưu tiên.
4. Lặp 3 lần hoặc 100 ply không đi Tốt/ăn quân: người tới lượt có thể **Yêu cầu hòa**, không tự dừng ở lần 3/100 ply. Có thể yêu cầu dựa trên nước dự định: server thử nước hợp lệ (cả promotion) trên bản sao, nếu đạt điều kiện thì kết thúc hòa mà không commit nước vào bàn. Không đạt trả lỗi, không đổi state/giờ; bản web không phạt thêm giờ như trọng tài bàn thật.
5. Hai bên đồng ý hòa qua offer/response ID. Offer chỉ bên tới lượt tạo, tối đa một lần/10 ply mỗi bên, hết hiệu lực khi có nước/decline/finish; offer không dừng clock. Đây là quy ước UI.

Position key: quân cùng loại/màu trên ô, bên đi, quyền nhập thành và quyền en passant thực sự làm thay đổi nước hợp lệ. Không dùng pieceId, đồng hồ hoặc cả chuỗi FEN gồm counters làm key. Ghi cả vị trí ban đầu. Halfmove reset khi đi Tốt hoặc ăn, tăng khi nước khác, tính cả chiếu/nhập thành; một ply là một nước của một bên.

**Giới hạn đề xuất cho bản đầu:** tự hòa K–K, K+B–K, K+N–K và chỉ Vua/Tượng với tất cả Tượng cùng màu ô. Không tự hòa K+2N–K, Tượng khác màu hoặc các tổ hợp chỉ vì không thể ép thắng. Không có bộ giải mọi dead position (ví dụ khóa Tốt phức tạp). Hai bên có thể thỏa thuận hòa; không quảng bá bộ nhận diện đầy đủ Điều 5.2.2.

## Hết giờ, xin thua, đồng hồ

Đề xuất HQ-COVUA-1: hết giờ hoặc xin thua thì đối phương thắng, trừ nếu đối phương chỉ có Vua hoặc cả bàn thuộc tập hòa chắc chắn trên thì hòa. Các trường hợp thiểu quân khác áp quy ước này; **không khẳng định tương đương mọi thế “không có chuỗi hợp lệ dẫn tới mate” của FIDE 5.1.2/6.9**. Nếu cần tuân thủ đầy đủ, phải mở rộng solver và fixture trước khi đổi nhãn luật; Luna không được tự suy diễn từ tổng điểm quân.

Online: 5/10/15 phút mỗi bên, increment 0/3/5 giây, mặc định 10+3. 2P mặc định không clock, có thể bật cùng preset. Server nhận action tại now >= deadline xử timeout trước, nước chưa nhận đúng hạn không được cứu bằng animation/client timestamp. Nước sai, offer/claim sai không reset deadline/cộng giờ; move đúng trừ thời gian đã dùng, cộng increment một lần rồi đổi bên. Deadline/remaining/pause do server, UI dùng mốc monotonic để trình bày.

## Phiên, điểm và phạm vi

Online tái dùng public/private, mã/link, ready/host/kick, đúng hai ghế. Ván đầu random Trắng hoặc host-Trắng; ván sau đổi màu. Thắng +10, hòa/thua/hủy 0; target 10–500 bội 10 mặc định 50; chưa đạt tự nối ván sau 3 giây. Hòa vẫn sang ván, không thêm cap số ván ngầm. Rời/kick/grace hết hủy trận; disconnect pause clock/countdown trong grace hiện có (90 giây mặc định). TTL sảnh không cắt lượt còn clock.

2P: một phiên backend/token owner, hai danh tính, điều khiển luân phiên; không join/public, không giả hai socket, không offline. Handover trả lời hòa; local `actingSide` phải hợp quyền loại intent. Reload resume, socket mới thu hồi socket cũ; disconnect grace 90 giây; không clock idle/finished TTL 30 phút, cap phiên theo backend. Nút ván mới đổi bên thủ công, không auto-start local. Restart mất state.

Không bot/Stockfish, rating, tài khoản, database, Chess960, premove, đi lại, phân tích thế, nhập FEN/PGN từ UI, chat hoặc spectator. Luật, khả năng đi, kết quả và điểm chỉ do backend quyết định; frontend không import runtime engine.
