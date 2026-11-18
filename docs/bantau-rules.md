# Bắn tàu — HQ-BANTAU-1

**Trạng thái: HQ-BANTAU-1 và đợt polish UI đã triển khai trong working tree; chờ Terra kiểm thử độc lập.** Chrome và Safari độc lập đã vào trận và kiểm tra aim/bắn/đổi lượt. Kéo thả trực tiếp, mobile thật, nghe sound trên iOS và ván thắng vẫn cần QA. Xem [báo cáo polish](./reports/bantau/summary.md) và [checklist Terra](./reports/bantau/summary.md). Chưa deploy, chưa Terra approve. Không thay đổi luật hoặc hành vi UNO, Nối từ hay Caro. Tên hiển thị “Bắn tàu”, gameKey `bantau`. Phần dưới phân biệt nguồn tham khảo với biến thể Hội Quậy; không quảng bá biến thể là luật chính thức Hasbro.

## 1. Nguồn tham khảo

Tra cứu ngày 16/11/2026:

- [Hasbro Battleship Classic, A3264](https://instructions.hasbro.com/en-us/instruction/Battleship-Classic-Board-Game-Strategy-Game): trang sản phẩm và hướng dẫn chính thức, xác nhận trò chơi hai người.
- [Hasbro A3264, bản hướng dẫn ES ©2012, mã 1112A3264105](https://www.hasbro.com/common/documents/dad261471c4311ddbd0b0800200c9a66/805D571750569047F563BF06118D7780.pdf): đã đọc phần văn bản cả hai trang; dùng làm hồ sơ Classic cụ thể cho đối chiếu. PDF tiếng Anh được liên kết từ trang sản phẩm nhưng lần truy cập này timeout; không tuyên bố đã đọc bản tiếng Anh.

Theo PDF này: mỗi bên giấu năm tàu dài 5/4/3/3/2 trên lưới. Tàu đặt ngang/dọc, nằm trong biển. Người chơi gọi tọa độ, nhận kết quả trúng/trượt và ghi dấu; lượt kết thúc sau một phát kể cả khi trúng. Tàu chìm khi tất cả ô bị trúng; đánh chìm hết hạm đội đối phương thì thắng. Tài liệu có Salvo riêng, không dùng trong đề xuất này. Phần placement không quy định khoảng cách bắt buộc giữa hai tàu; tùy chọn cấm chạm dưới đây là luật Hội Quậy.

Ảnh người dùng cung cấp chỉ tham khảo tổ chức bàn, màn đặt tàu và các tùy chọn. Không suy ra luật đã được xác minh của website trong ảnh; không sao chép artwork, logo, font hoặc theme của website đó.

## 2. Cấu hình phòng đề xuất

| Thuộc tính | Giá trị | Mặc định |
|---|---|---|
| Người chơi | Đúng 2, không bot/spectator/đội | 2 |
| Visibility | Riêng tư / công khai, cùng hệ thống mã/link hiện tại | Riêng tư |
| Bàn | 8×8 / 10×10 / 12×12 | 10×10 |
| Số tàu mỗi bên | 3 / 4 / 5, cùng thành phần cho cả hai | 5 |
| Thời gian mỗi phát | 15 / 30 / 45 / 60 giây | 30 |
| Trúng bắn tiếp | Bật / tắt; trúng hoặc chìm đều tính là trúng | Bật |
| Tàu được chạm nhau | Bật / tắt; vẫn không được đè ô | Tắt |
| Thời gian xếp tàu | Cố định 90 giây, chưa thêm setting | 90 |
| Điểm thắng trận | 10–500, bước 10; thắng ván +10 | 50 |

Chỉ chỉnh trước trận; đổi setting reset ready. Khi trận đã chạy, settings và roster khóa như các game hiện có. Không sao chép dòng trong ảnh “đổi luật giữa các ván”; countdown tự nối không phải cơ hội chỉnh luật giữa trận.

Đội hình cố định theo preset, không cho chỉnh tự do từng chiều dài ở bản đầu:

| Số tàu | Độ dài | Tổng ô | Nhãn trong UI |
|---|---|---|---|
| 3 | 3, 3, 2 | 8 | Khu trục, Tàu ngầm, Tuần tra |
| 4 | 4, 3, 3, 2 | 12 | Thiết giáp, Khu trục, Tàu ngầm, Tuần tra |
| 5 | 5, 4, 3, 3, 2 | 17 | Hàng không mẫu hạm, Thiết giáp, Khu trục, Tàu ngầm, Tuần tra |

Preset 3/4 tàu và tên Việt là lựa chọn sản phẩm, không quy về bộ Classic khác. Hai tàu dài 3 có shipId khác nhau.

## 3. Xếp tàu và bắt đầu

1. Phòng chờ dùng ready/start hiện tại. Chủ phòng bắt đầu trận mới khi đủ đúng hai người, online và khách ready.
2. Mỗi ván vào pha xếp tàu 90 giây. Server tạo ngay một đội hình ngẫu nhiên hợp lệ riêng cho từng người; họ có thể dùng luôn, đổi ngẫu nhiên hoặc chỉnh vị trí.
3. Tàu thẳng, ngang/dọc, nguyên độ dài, không ra biên, không đè ô. Tắt chạm: giữa hai tàu phải cách ít nhất một ô theo cả ngang/dọc/chéo. Bật chạm: được kề cạnh/chéo nhưng tuyệt đối không đè ô.
4. Kéo trực tiếp thân tàu để di chuyển; thao tác chọn tàu → chạm ô neo và nút Xoay vẫn là phương án thay thế. Mỗi yêu cầu server xác nhận mới trở thành đội hình đã lưu. Preview lỗi không ghi đè đội hình hợp lệ trước đó.
5. “Sẵn sàng” trong pha này là khóa đội hình của mình, khác ready phòng chờ. Đã khóa không chỉnh tiếp; không thêm hủy khóa trong bản đầu. Người kia không thấy vị trí/tên tàu đang chọn.
6. Hai bên khóa thì bắt đầu bắn ngay. Hết 90 giây server tự khóa đội hình hợp lệ cuối cùng, gồm đội hình ban đầu nếu chưa chỉnh. Không thua vì hết giờ xếp tàu.
7. Server bốc người bắn đầu ván đầu, luân phiên người bắn đầu ở các ván sau trong cùng trận. Tất cả tàu được đặt lại kín từ đầu mỗi ván; không tự giữ đội hình cũ.

Server sinh đội hình bằng tìm kiếm hữu hạn có backtracking, RNG được truyền vào; không dùng retry vô hạn. Nếu preset không sinh được, không mở ván lỗi và không tính điểm; báo lỗi có thể phục hồi. Phiên engine phải chứng minh đủ chín cặp boardSize/shipCount với cả hai chế độ chạm.

## 4. Nhắm, bắn và hết giờ

- Lần chạm/click đầu vào ô biển đối phương: gửi ý định **nhắm**, hiện dấu ngắm mảnh và tọa độ. Đổi sang ô khác thì đổi mục tiêu; không bắn.
- Kích hoạt lại đúng ô đang nhắm: gửi **bắn**. Không có nút xác nhận bắn riêng. Đây là hai lần kích hoạt cùng ô, không yêu cầu double-click nhanh trong một khoảng thời gian.
- Client chỉ hiện mục tiêu như đã xác nhận sau ACK server; có thể hiện preview đang gửi khác trạng thái. Không bắn trước ACK nhắm; ACK cũ không kéo dấu ngắm quay lại ô cũ.
- Mục tiêu riêng tư, chỉ người bắn biết. Server lưu aim theo gameId/turnId và sequence; reload/đổi kết nối vẫn khôi phục ô đã được ACK nếu lượt chưa hết.
- Hết giờ: có aim hợp lệ đã xác nhận thì tự bắn ô đó; chưa có thì server random đều một ô đủ điều kiện. Aim chưa đến server khi hết giờ không được tính. Không loại người chơi vì timeout bắn trong game này.
- Đồng hồ tính theo mỗi phát, không theo chuỗi trúng. Nhắm/đổi aim không reset đồng hồ. Mỗi phát hợp lệ tạo shotId/turnId mới và reset aim.
- Chọn trúng một ô đã bị bắn trúng trước đó bị từ chối, không mất lượt/không reset giờ. Các ô từng trượt vẫn bắn lại được.
- Đến deadline (`now >= deadlineAt`), timeout thắng race với thao tác tay; mỗi lượt chỉ có một phát. Bắn tay, callback timer, retry hay socket cũ không tạo thêm phát.

## 5. Kết quả từng phát và chế độ nhớ

- **Trượt:** có rơi thủy lôi, nổ nước ngắn và âm thanh. Sau hiệu ứng, ô biển trở lại hệt ô chưa bắn; không peg trắng, không dấu X, không dim/tooltip/aria-label “đã bắn”.
- **Trúng:** nổ lửa, để dấu hư hại/lửa tĩnh ở đúng ô. Chưa chìm thì không vẽ thân tàu còn lại hoặc nói loại tàu, hướng, độ dài.
- **Chìm:** khi toàn bộ ô một tàu bị trúng, báo “Chìm một tàu” và lộ đúng các ô của tàu vừa chìm. Không lộ tàu khác hoặc các ô hàng xóm.
- Sau khi tải lại bàn, giao diện vẽ lại thân tàu chỉ từ footprint tàu chìm do server công bố; tàu chưa chìm vẫn không được gửi hoặc suy ra từ các ô trúng.
- Tắt “Trúng bắn tiếp”: sau mỗi phát chuyển sang đối phương. Bật: hit/sunk được phát nữa, miss đổi người; trúng ô cuối kết thúc ngay.
- Trong animation, server có pha `resolving` cố định **900 ms** từ shot commit trước khi mở lượt tiếp. Đây là pacing server có deadline riêng, không đợi client báo animation xong. Animation thiết kế hoàn tất trong khoảng này; reduced motion vẫn dùng cùng luật thời gian. Nếu thắng thì chốt kết quả ngay, không đợi 900 ms.
- Random timeout lấy mọi ô chưa bị đánh dấu hit/sunk, gồm ô từng trượt. Không dùng lịch sử trượt để loại ứng viên.

Không lưu bảng lịch sử ô trượt trong snapshot/ACK hồi phục, không trả canFire/legalCells loại ô trượt. Có thể giữ event phát mới nhất ngắn hạn để hiển thị, có serverTime và thời hạn trình bày; hydrate/reconnect không dựng lại dấu trượt. Client từng nhận event vẫn có thể tự ghi nhớ/log lại: đây là chế độ chơi bằng trí nhớ, không có cam kết chống ghi chép ngoài ứng dụng.

## 6. Thắng ván, thắng trận và phiên

- Đánh chìm hết tàu đối phương: thắng ván ngay, +10 đúng một lần. Không cộng điểm theo hit/chìm để tái sử dụng bảng điểm chung, tránh tăng điểm vì timeout hoặc bắn lặp.
- Chưa đạt mục tiêu: intermission 3 giây hiện hành → ván mới bắt đầu ở pha xếp tàu, không ready phòng chờ lại. Đã đạt mục tiêu: dừng trận, chỉ host mở trận mới theo luồng hiện tại.
- Nút “Chịu thua” có dialog của web; xác nhận thua ván, đối phương +10 và áp dụng target/countdown bình thường. Rời/kick thay đổi roster thì hủy trận/countdown, không tặng điểm vì rời.
- Mất kết nối: pause setup/turn/resolving/countdown, giữ phần thời gian còn lại; nối lại trong grace 90 giây về đúng ghế/đội hình/aim. Hết grace hủy trận theo phòng hiện tại, không tạo ván ma hay phát tự động trong lúc pause.
- Giữ cleanup/TTL hiện có. Một trận không được treo vô hạn vì nhắm liên tục; aim không gia hạn deadline hoặc TTL tiến triển. Giới hạn server cho ván 30 phút thời gian không pause: hết hạn hủy trận không điểm, về chờ có notice; đây là phương án chống AFK vô hạn khi cho bắn trượt lặp. Mốc 30 phút là đề xuất sản phẩm cần xem lại sau playtest.
- Restart/deploy mất phòng và toàn bộ dữ liệu RAM như hiện tại. Không thêm database hoặc lưu lịch sử lâu dài.

## 7. Khác biệt với Classic

HQ-BANTAU-1 bổ sung đội hình tùy chọn, kích thước bàn, cấm chạm tùy chọn, giấu dấu trượt/loại tàu chưa chìm, trúng bắn tiếp tùy chọn, chọn hai lần, timeout tự bắn, pacing và trận tính điểm. Tất cả là lựa chọn triển khai cho Hội Quậy. Màn Luật chơi phải nói ngắn gọn các điểm này và dẫn nguồn Hasbro; dùng hình tàu/thủy lôi SVG/CSS tự thiết kế, không sao chép tài sản từ ảnh hoặc Hasbro.
