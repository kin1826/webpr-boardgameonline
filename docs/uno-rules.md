# Luật UNO tùy chỉnh Bàn Bạn — BB-UNO-1

Trạng thái: BB-UNO-1 đã được triển khai trong engine và UI, nhưng cần Terra nghiệm thu độc lập. Test/bằng chứng hiện hành ở `docs/sol-uno-fix-report.md` và `docs/verification-report.md`.

## Nguồn và phạm vi

Bộ 108 lá và nền tảng cách chơi tham khảo [Mattel W2085-0629](https://service.mattel.com/instruction_sheets/W2085-Eng.pdf), [trang hỗ trợ W2085](https://service.mattel.com/us/productDetail.aspx?prodno=W2085&siteid=27). Cộng dồn, +4 tự do, Reverse hai người và cách kết thúc dưới đây là **luật tùy chỉnh Bàn Bạn do người dùng chốt**, không phải quy định Mattel. Không tuyên bố đây là UNO Classic nguyên bản. Hồ sơ Classic ban đầu lưu tại [uno-classic-reference.md](./uno-classic-reference.md) để đối chiếu lịch sử; nếu khác nhau, file này được ưu tiên. Không cần thêm bộ chọn nhiều chế độ luật.

## R01 — Bộ bài, người chơi, setup

- 2–6 người thật; mỗi người nhận 7 lá.
- 108 lá: mỗi màu có một số 0, hai mỗi số 1–9, hai Bỏ lượt, hai Đảo chiều, hai +2 (25 lá/màu); thêm 4 Wild và 4 Wild +4. ID lá và ván ổn định.
- Giữ cách chọn dealer đã ghi ở hồ sơ Classic: rút so số, ký hiệu tính 0, hòa rút lại; bảo vệ hòa kéo dài là quyết định vận hành đã có. Người bên trái dealer đi đầu, chiều ban đầu thuận thứ tự ghế.
- Không lật lá mở đầu từ chồng rút. Sau chia bài, chồng bỏ rỗng, màu hiện tại chưa xác định và không có phạt mở đầu. Đây là thay đổi luật tùy chỉnh do người dùng chốt.
- Người đi đầu được đánh bất kỳ lá nào trên tay để mở bàn; lá có màu đặt màu hiện tại, Wild/+4 phải chọn màu. Bỏ lượt, Reverse, +2/+4 có hiệu lực bình thường ngay từ lá đầu do người chơi đánh.
- Vẫn được rút tự nguyện ở lượt mở bàn; chỉ được đánh lá vừa rút hoặc giữ để nhường lượt. Nếu chưa ai đánh thì người kế tiếp cũng được mở bằng bất kỳ lá nào.

## R02 — Nước đi thường và màu

- Mỗi lượt một lá cùng màu hiện tại, cùng số hoặc cùng ký hiệu với lá bỏ trên cùng. Wild/+4 theo R03. Không jump-in hay đánh nhiều lá.
- Đỏ 5 → Đỏ 9: hợp lệ, màu đỏ. Đỏ 5 → Xanh lá 5: hợp lệ, màu xanh lá. Đỏ 5 → Xanh lá 9: từ chối, state không đổi.
- Mọi lá có màu vừa đánh đều cập nhật màu hiện tại sang màu của lá đó, kể cả đi bằng số/ký hiệu trùng. Không tiếp tục dùng màu trước đó.
- Không có lá phù hợp thì rút một. Được rút tự nguyện dù có lá phù hợp. Sau rút chỉ đánh chính lá mới nếu hợp lệ hoặc giữ để kết thúc lượt; không đánh lá cũ, không rút lần hai.

## R03 — Wild, +4 và chọn màu

- Wild thường được đánh trong lượt thường của mình; không được dùng để đáp khoản phạt.
- +4 được đánh tự do trong lượt thường dù có lá cùng màu. Không còn điều kiện tay bài cùng màu và **không thách thức +4**.
- Wild/+4 phải chọn đỏ/vàng/xanh lá/xanh dương; server không chuyển lượt trước khi màu hợp lệ được chọn. Có thể gửi cardId + màu trong một intent nguyên tử; mở dialog chưa phải đánh bài.
- Không có bước chọn màu trước lá đầu. Người đi đầu chọn màu bằng lá mình đánh; Wild/+4 chọn màu cùng intent đánh bài.
- +4 được đánh để cộng phạt theo R04. Màu do +4 gần nhất chọn có hiệu lực; nếu sau đó nhận phạt, giữ màu đó.

## R04 — Khoản phạt cộng dồn

| Lá phạt gần nhất | Được cộng tiếp | Tổng phạt |
|---|---|---|
| +2 | +2 hoặc +4 | Cộng 2 hoặc 4 |
| +4 | Chỉ +4 | Cộng 4 |

- Lá +2 đầu chuỗi phải hợp lệ theo màu/ký hiệu của lượt thường. Khi đã có khoản phạt, +2 cộng tiếp không cần trùng màu.
- Ví dụ +2 → +2 → +4 → +4: tổng 12. Sau +4 không được cộng +2.
- Người chịu phạt chỉ có hai lựa chọn: đánh đúng loại được cộng, hoặc bấm **Nhận N lá**. Có lá cộng vẫn được chọn nhận. Không tự rút phạt ngay khi lá + được đánh.
- Không có lá cộng thì chỉ cho nhận. Cấm rút thường, giữ lượt, đánh số/Skip/Reverse/Wild thường trong phase này.
- Nhận toàn bộ số phạt trong một hành động server, xóa khoản phạt và mất lượt; không đánh lá vừa nhận. Người kế tiếp theo hướng hiện hành bắt đầu lượt thường.
- Khi cộng, chuyển khoản phạt cho người kế theo hướng hiện hành. Gửi lặp thao tác nhận không rút lần hai.

## R05 — Bỏ lượt và Đảo chiều

- Skip bỏ người kế. Reverse đổi hướng rồi chuyển tới người kế theo hướng mới.
- Ba người chiều 1 → 2 → 3: 2 đánh Reverse thì tới 1, dù 1 vừa đánh. Reverse không đồng thời bỏ thêm ghế trong ván từ 3 người.
- Hai người: Reverse như Skip, người đánh được đi tiếp. Đây là tùy chỉnh đã xác nhận, thay quyết định Classic cũ.

## R06 — UNO

- Khi đánh xuống còn một lá phải hô UNO, có thể hô kèm intent đánh hoặc hô riêng trước khi bị bắt.
- Quên hô bị bắt trước hành động đầu tiên của người kế thì nhận 2 lá. Hai lá này là phạt UNO riêng, không cộng vào chuỗi R04 và không đổi lượt.
- Cửa sổ bắt đóng tại hành động đánh, rút thường hoặc nhận khoản phạt của người kế; animation và đồng hồ client không quyết định thời điểm này. Race theo thứ tự server xử lý.
- Nếu Skip/Reverse hai người đưa lượt về chính người vừa đánh, không tạo cửa sổ bắt UNO kéo dài qua hành động tiếp theo; áp dụng mốc bắt trước hành động đầu của lượt mới. Cần test rõ để không để cửa sổ treo.

## R07 — Tái tạo bài và kết thúc

- Giữ lá bỏ trên cùng, xáo phần bỏ còn lại để tái tạo chồng rút khi cần; bảo toàn ID/tổng lá.
- Không đủ bài kể cả tái tạo: kết thúc hòa với lý do rõ ràng, không tạo lá hoặc trao thắng giả; đây là chính sách bế tắc của sản phẩm.
- Người đánh hợp lệ lá cuối cùng và còn 0 lá trên tay thắng ngay, bất kể lá số hay lá chức năng. Không tích điểm nhiều ván.
- Lá cuối +2/+4 (kể cả đang cộng dồn) chốt thắng ngay; xóa khoản phạt đang chờ, không bắt người kế nhận bài hoặc cộng tiếp. +4/Wild cuối vẫn phải chọn màu hợp lệ để hoàn tất nước đánh. Không tự rút phạt sau khi ván kết thúc. Đây là luật tùy chỉnh do người dùng chốt.
- Ván mới có game ID mới; xóa khoản phạt, màu đang chọn, cửa sổ UNO và hành động dở từ ván cũ.

## R08 — Server và giao diện

- Server xác thực mọi intent/phase/lượt/màu/số/ký hiệu; UI disabled không thay thế validation. Hành động lỗi không đổi state/revision.
- Không gửi tay đối thủ, chồng rút hoặc dữ liệu kín. Chỉ gửi tay riêng, trạng thái công khai và mô tả hành động được phép nếu cần.
- Lá không hợp lệ tối đi nhưng vẫn đọc được và không bấm được; tới lượt không có lá hợp lệ thì highlight Rút bài. Đang phạt thì dùng Nhận N lá, không highlight nút rút thường.
- Màu giữa bàn có tên/ký hiệu và viền màu. Dialog chọn màu khóa thao tác bên dưới; focus, bàn phím, reduced motion và mobile theo hệ thiết kế hiện có.
- Luật trong website và bàn xem thử phải phản ánh BB-UNO-1, không còn hành động challenge.
