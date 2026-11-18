# Cờ tướng — HQ-COTUONG-1

Ngày 18/11/2026. **HQ-COTUONG-1 đã được triển khai trong working tree; đang chờ Terra nghiệm thu độc lập.** Phạm vi: đúng hai người, online hoặc chung một thiết bị, cùng bộ luật. Quy tắc đi quân dựa trên Cờ tướng thông thường; xử lặp, hòa, thời gian và phiên là lựa chọn của Hội Quậy. Không quảng bá tương thích đầy đủ luật thi đấu WXF, đặc biệt luật đuổi quân dai. Bằng chứng code, test và giới hạn hiện tại: [báo cáo triển khai](./reports/cotuong/summary.md), [checklist Terra](./reports/cotuong/summary.md).

## 1. Nguồn và phạm vi áp dụng

- [WXF: World Xiangqi Rules](https://www.wxf-xiangqi.org/index.php?Itemid=291&id=269&lang=en&option=com_content&view=article), [PDF 2018 chính thức](https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf): nguồn tham khảo chính, không trộn thêm điều lệ giải khác.
- [Xếp bàn](https://www.xiangqi.com/help/board-and-set-up), [quân và nước đi](https://www.xiangqi.com/help/pieces-and-moves): đối chiếu cách chơi cơ bản.
- [Quy tắc vận hành Xiangqi.com](https://www.xiangqi.com/help/limits): minh chứng một nền tảng có thể công bố luật giản lược riêng; HQ-COTUONG-1 không sao chép ngưỡng/phán quyết của trang này.
- [Tan/Medina 2024: triển khai xử lặp WXF](https://arxiv.org/html/2412.17334v1): tài liệu cho hướng nâng cấp WXF đầy đủ về sau. Không lấy nghiên cứu làm chứng nhận implementation.

Màn Luật chơi phải ghi: **“Luật Hội Quậy: cách đi Cờ tướng cơ bản; xử lặp và giới hạn ván theo HQ-COTUONG-1. Chưa áp dụng toàn bộ luật đuổi quân dai WXF.”** Các điều ở mục 3–8 là đặc tả sản phẩm, không phải tuyên bố trích nguyên luật liên đoàn.

## 2. Bàn, quân và nước hợp lệ

Bàn 9 cột ×10 hàng giao điểm, 32 quân, mỗi bên 16; Đỏ đi trước. Góc nhìn không đổi tọa độ logic: hàng 0 phía Đen, hàng 9 phía Đỏ; cột 0–8 từ trái sang phải khi Đỏ ở dưới. Sông giữa hàng 4–5; cung cột 3–5, Đen hàng 0–2, Đỏ hàng 7–9.

Hàng 0/9: Xe–Mã–Tượng–Sĩ–Tướng–Sĩ–Tượng–Mã–Xe. Pháo tại hàng 2/7 cột 1/7; Tốt tại hàng 3/6 cột 0/2/4/6/8. Mỗi quân có pieceId ổn định suốt ván.

| Quân | Số/bên | Nước đi |
|---|---:|---|
| Tướng | 1 | Một điểm ngang/dọc trong cung; cấm hai tướng nhìn thẳng không vật cản. |
| Sĩ | 2 | Một điểm chéo trong cung. |
| Tượng | 2 | Hai điểm chéo, không qua sông, cấm mắt tượng bị chặn. |
| Xe | 2 | Ngang/dọc qua đường trống. |
| Mã | 2 | Lệch hai/một điểm, cấm chân mã bị chặn. |
| Pháo | 2 | Đi đường trống; ăn ngang/dọc qua đúng một quân làm ngòi, bất kỳ bên nào. |
| Tốt | 5 | Một điểm tiến; qua sông thêm ngang; không lùi/phong cấp. |

Không ăn quân cùng bên, không đứng yên, không nhảy ngoài luật. Mỗi nước phải bảo toàn an toàn tướng mình; khi đang bị chiếu phải giải chiếu. Lộ mặt tướng là bất hợp lệ. Chặn chân/mắt/ngòi tính cả quân hai bên. Tướng không được có nước “bay” rời cung để tới giao điểm trống; thế tướng đối mặt không được phát sinh từ nước hợp lệ.

## 3. Kết thúc ván và thứ tự quyết định

Sau mỗi intent server kiểm deadline trước; nếu còn giờ thì xác thực và áp nước hợp lệ, rồi theo thứ tự:

1. Bên tiếp theo không còn nước hợp lệ: thua. Nếu bị chiếu là `checkmate`, nếu không là `stalemate`; bí nước không hòa.
2. Áp xử lặp ở mục 4.
3. Hòa `no-attacking-material` nếu cả hai bên chỉ còn Tướng/Sĩ/Tượng; không tự hòa các tổ hợp khác bằng heuristic giá trị quân.
4. Hòa `no-capture-limit` ở mục 5.
5. Tiếp tục và mở lượt mới.

Không yêu cầu bắt tướng thật: ván dừng khi chiếu hết/bí nước. `resign` là thua sau xác nhận dialog. Hết đồng hồ là thua theo mục 6. `draw-agreement` là hòa chỉ khi đề nghị được bên kia chấp thuận. Finished khóa mọi nước sau kết quả; cùng một ván chỉ settle điểm một lần.

## 4. Xử lặp thế giản lược của Hội Quậy

Đây là **house rule có chủ ý**, không phải thuật toán đầy đủ WXF. Chốt cho bản đầu để không bỏ ngỏ phán quyết hoặc treo ván:

- Position key chứa loại quân/màu tại 90 điểm và bên tới lượt; không chứa thời gian, revision hoặc lựa chọn hình. Giữ pieceId riêng trong lịch sử nhưng không đưa ID của hai quân cùng loại vào position key.
- Ghi cả thế ban đầu. Sau mỗi nước hợp lệ, đếm số lần key hiện tại đã xuất hiện kể từ lần ăn quân cuối; lần ăn quân reset lịch sử đếm và ghi thế mới.
- Khi key có mặt lần thứ ba: server trả cảnh báo và số lần. Khi lần thứ tư: lấy bốn lần xuất hiện gần nhất, xét mọi nước từ sau lần thứ nhất tới lần thứ tư.
- Một bên bị coi là chiếu liên tục trong đoạn xét nếu bên đó có ít nhất một nước và **mọi nước của bên đó trong đoạn đều tạo chiếu**. Cờ `gaveCheck` do engine tính sau nước, không nhận từ client.
- Đúng một bên chiếu liên tục: bên đó thua (`perpetual-check`), bên còn lại thắng. Cả hai hoặc không bên nào thỏa: hòa (`repetition`). Không cần các khoảng lặp dài bằng nhau: điều kiện là key, bốn mốc và phân loại trên.
- Đuổi quân không kèm chiếu liên tục sẽ rơi vào hòa lặp thế theo quy tắc trên; **chưa xử riêng đuổi quân dai WXF**, không phạt thua theo nhận định mơ hồ “đe dọa ăn quân”. UI ghi rõ giới hạn này.
- Phán quyết tự động ở lần thứ tư, không cần người chơi gọi trọng tài; không tự chặn một nước hình học hợp lệ để che việc xử lặp.

Không được âm thầm thay bằng lặp ba lần hòa, cùng pieceId, hoặc đếm riêng một quân đi qua lại. Bộ test phải bao gồm hai quân cùng loại đổi vị trí, khác bên tới lượt, một/cả hai/không bên chiếu, ăn quân reset và bốn mốc không cách đều.

## 5. Giới hạn không ăn quân và lịch sử

House rule: **120 ply liên tiếp không ăn quân thì hòa**, tương đương tối đa 60 lượt mỗi bên trong đoạn luân phiên. Một ply là một nước của một bên. Mọi nước không ăn quân đều cộng 1, kể cả chiếu hoặc Tốt tiến. Chỉ ăn quân reset về 0. Server cảnh báo từ 100 ply. Thứ tự mục 3 đảm bảo chiếu hết/bí nước hoặc chiếu dai thua không bị ghi đè bằng hòa ở cùng nước.

Giữ lịch sử đầy đủ ván trong RAM: nước đi, pieceId/capturedId, from/to, gaveCheck, position key và counters. API snapshot trả lịch sử theo trang hoặc giới hạn 100 nước cuối + tổng số; không gửi toàn bộ cấu trúc tra cứu lặp. Không có database/ghi lịch sử lâu dài.

## 6. Đồng hồ

- Online: preset thời gian mỗi bên 300/600/900 giây, mặc định 600; cộng sau nước hợp lệ 0/3/5 giây, mặc định 3. Đây là tổng giờ suy nghĩ của mỗi bên, không dùng timer 30 giây/lượt.
- Cùng máy: mặc định không đồng hồ, có thể bật cùng preset trên. Cấu hình clock là discriminated union `none` hoặc `fischer`, không dùng số 0 mơ hồ; online chỉ nhận `fischer`.
- Lượt bắt đầu: server ghi `turnStartedAt`, `deadlineAt = now + remainingForSide`. Nước nhận lúc `now >= deadlineAt` bị tính hết giờ trước; nước hợp lệ trừ thời gian đã nghĩ rồi cộng increment và đổi lượt.
- Nước lỗi không cộng giây, không đổi lượt hoặc gia hạn deadline. Offer/decline draw không dừng đồng hồ. Draw accept/resign cũng resolve hết giờ trước.
- Engine nhận `now` từ ngoài; server sở hữu timer, callbacks stale không tác động ván mới. Frontend chỉ hiển thị remaining/deadline từ server trên clock monotonic, không chốt timeout.

## 7. Hai chế độ và quyền

### Online

Room public/private, mã/link, ready/host/reconnect như nền hiện tại; min=max=2. Host chọn phía Đỏ/Đen/ngẫu nhiên trước trận, mặc định ngẫu nhiên do server bốc. Phía còn lại thuộc khách. Các ván sau đổi bên; Đỏ vẫn đi trước. Settings/roster khóa trong trận.

Mỗi socket chỉ điều khiển bên của ghế mình và chỉ tới lượt. Mất mạng pause cả đồng hồ trong grace đang dùng (mặc định 90 giây); resume đúng ghế và phần giờ còn lại. Hết grace/rời/kick hủy trận theo room policy, không tặng điểm. Cờ tướng không dùng cleanup “15 phút không có nước” để cắt một lượt vẫn còn giờ: dùng deadline đồng hồ; idle TTL chỉ áp sảnh và pause có hạn.

### Hai người cùng máy

Một phiên backend riêng `local`, hai tên/avatar, hai sideId. Một token owner điều khiển bên tới lượt. Không tạo hai socket giả, không đếm owner thành hai ghế public, không join/public/ready/host-kick trong phiên này. Hai người phải ở cùng thiết bị và vẫn cần mạng/server.

Default bàn cố định Đỏ dưới, có toggle tự lật mỗi lượt; chỉ đổi góc nhìn. Đề nghị hòa ghi `offeredBySide`; accept phải mang `respondingSide` khác bên đề nghị và có prompt chuyển thiết bị. Cùng máy là mô hình tin cậy người cầm thiết bị, không thể chứng minh danh tính hai người bằng một token.

Reload/resume cùng token về đúng bàn. Socket mới thu hồi generation cũ. Disconnect pause clock, giữ phiên tối đa 90 giây; hết grace đóng phiên. Online/cùng máy dùng namespace credential và schema tách rõ, không cho token local hành động trong room online. Local không đồng hồ còn kết nối nhưng không thao tác 30 phút thì đóng phiên; hành động hợp lệ mới gia hạn idle. Finished giữ 30 phút; rời/xóa phiên dọn ngay. Server restart mất state.

## 8. Điểm, ván sau và phạm vi

- Online dùng match hiện có: thắng +10, hòa/thua/hủy 0; target 10–500 bội 10, mặc định 50. Chưa đạt mục tiêu thì countdown 3 giây mở ván mới, đổi bên; rời/kick hủy countdown/trận, disconnect pause theo grace.
- Cùng máy chơi từng ván, hiển thị kết quả rồi nút “Ván mới”/“Đổi bên và chơi lại”; không tự bắt đầu khi hai người còn xem bàn. Reset board/clock/history/counters, tên/avatar giữ lại. Không gộp điểm local vào trận online.
- Đề nghị hòa tối đa một lần mỗi bên sau mỗi 10 ply kể từ đề nghị trước của chính bên đó; đầu ván cho phép đề nghị. Offer hết hiệu lực khi có nước mới, decline hoặc kết thúc. Server kiểm drawOfferId và phiên bản, spam không gia hạn giờ/TTL.
- Bản đầu không có bot, offline thật, đi lại, chấp quân, tùy chỉnh thế xuất phát, chat hoặc spectator. Các hành động cần để chơi đủ gồm move/offerDraw/acceptDraw/declineDraw/resign và tạo/resume/rời/ván mới.
