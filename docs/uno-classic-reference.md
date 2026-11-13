# Hồ sơ luật UNO cho MVP

> Lưu trữ lịch sử Classic. Không còn là đặc tả đích và nội dung không mô tả luật đang chạy. BB-UNO-1 hiện hành được ghi tại [uno-rules.md](./uno-rules.md).

Trạng thái: quy tắc số hóa đã chốt trước khi viết engine. Nguồn được đối chiếu 13/11/2026.

## Phiên bản và nguồn

Chỉ dùng [Mattel W2085-0629, hướng dẫn tiếng Anh ©2012](https://service.mattel.com/instruction_sheets/W2085-Eng.pdf) làm luật chính. [Trang sản phẩm/hỗ trợ W2085 của Mattel](https://service.mattel.com/us/productDetail.aspx?prodno=W2085&siteid=27) xác nhận SKU W2085. PDF có 3 trang, ghi bộ 108 lá và không có mục riêng cho luật hai người. Trang sản phẩm cho biết 2–10 người; MVP giới hạn 2–6.

Không lấy luật hai người từ SKU hoặc phiên bản UNO khác. Không có luật cộng dồn phạt, jump-in hay đánh nhiều lá trong phiên bản đã chọn.

## Bộ bài và setup (R01–R02)

108 lá:

| Thành phần | Số lá |
|---|---:|
| Số màu xanh dương | 19: một 0 và hai mỗi số 1–9 |
| Số màu xanh lá | 19: một 0 và hai mỗi số 1–9 |
| Số màu đỏ | 19: một 0 và hai mỗi số 1–9 |
| Số màu vàng | 19: một 0 và hai mỗi số 1–9 |
| Rút hai | 8: hai mỗi màu |
| Đảo chiều | 8: hai mỗi màu |
| Bỏ lượt | 8: hai mỗi màu |
| Đổi màu | 4 |
| Đổi màu Rút bốn | 4 |

Mỗi người rút một lá để chọn người chia; lá ký hiệu được tính như 0; lá số cao nhất chia. Chia 7 lá mỗi người. Người bên trái dealer đi trước. Server rút từ phân bố 108 lá không hoàn lại trong vòng chọn dealer, dùng RNG ngẫu nhiên; ID từng lá không trùng. Nếu hòa khi chọn dealer, người hòa rút lại. Nếu vẫn còn hòa sau 108 lần rút so sánh, server chọn ngẫu nhiên trong nhóm hòa để tránh setup treo; đây là bảo vệ vận hành cực hiếm, không phải luật Mattel.

## Nước đi thường và lá mở đầu (R03–R06)

- Người chơi đánh lá trùng số, màu hoặc biểu tượng với lá trên cùng; Wild đánh được bất cứ lúc nào. So với màu đang có hiệu lực, không so với màu gốc của lá Wild ở dưới.
- Không có lá hợp lệ thì phải rút một lá. Nếu lá rút có thể đánh, người chơi có thể đánh ngay lá vừa rút. Cũng được chọn rút dù đang có lá hợp lệ; sau đó chỉ có thể đánh lá vừa rút, không được đổi sang lá khác trong tay. Có thể chọn giữ lá vừa rút; lượt kết thúc.
- Rút hai: người kế rút hai lá, mất lượt. Đảo chiều: đổi chiều đi. Bỏ lượt: người kế mất lượt. Không cộng dồn hiệu ứng phạt.
- Với hai người, W2085 không có luật riêng. Đảo chiều vẫn chỉ đổi chiều, nên lượt kế tiếp là đối thủ; không trao thêm lượt cho người đánh. Bỏ lượt làm đối thủ mất lượt. Sau Draw Two, đối thủ rút hai và mất lượt, rồi lượt về người đánh như hệ quả của thứ tự thông thường.
- Lá số mở đầu: người trái dealer đi trước.
- Rút hai mở đầu: áp dụng chức năng Rút hai; người trái dealer rút hai và mất lượt.
- Đảo chiều mở đầu: dealer đi đầu, chiều chuyển sang phải.
- Bỏ lượt mở đầu: bỏ người trái dealer; người tiếp theo bắt đầu.
- Wild mở đầu: người trái dealer chọn màu và bắt đầu lượt.
- Wild Draw Four mở đầu bị đưa trở lại bộ rút và lật lá khác. Số hóa: xáo chồng rút trước khi lật lại; lặp nếu tiếp tục lật Wild Draw Four.

## Wild Draw Four và challenge (R07)

Chỉ được đánh Wild Draw Four nếu người đánh không giữ lá nào cùng màu hiện hành. Lá cùng số hoặc cùng ký hiệu nhưng khác màu không ngăn cản lá này. Người kế có quyền chấp nhận phạt hoặc challenge.

Khi người chơi đánh một lá +4 rồi bị challenge, server phải cho phép lá +4 được đặt trước khi biết người kia sẽ challenge. Vì vậy UI vẫn cho gửi nước đi +4 đang bị nghi ngờ, nhưng đánh dấu cảnh báo; server lưu kín việc người đó có màu hiện hành hay không. Nếu người bị phạt chấp nhận thì +4 được giải quyết như bình thường; nếu challenge, server xét tay bài. Không broadcast lá nào chứng minh challenge.

- Chấp nhận: rút bốn, mất lượt.
- Challenge đúng (người đánh đã có lá cùng màu): người đánh rút bốn thay vì người challenge; người challenge tiếp tục lượt.
- Challenge sai (người đánh không có lá cùng màu): người challenge rút sáu và mất lượt.
- Server giữ snapshot tay kín trước khi đánh để xét challenge; chỉ gửi kết luận và hậu quả, không gửi tay bài người khác. Đây là thay cách xem bài trực tiếp trên bàn để bảo vệ riêng tư, không đổi điều kiện luật.

## UNO, cạn bài và kết thúc (R08–R10)

- Khi đánh lá áp chót, người chơi phải hô UNO. Nếu bị bắt trước khi người kế bắt đầu lượt thì người quên hô rút hai. Tự hô trước khi bị bắt thì an toàn.
- Request hô/bắt UNO được xử lý tuần tự theo thứ tự server nhận. Cửa sổ bắt đóng khi người kế bắt đầu lượt bằng hành động đánh hoặc rút. Không dùng animation hay đồng hồ client để quyết định.
- Nếu draw pile hết, giữ lá bỏ trên cùng, xáo các lá bỏ còn lại thành chồng rút và tiếp tục.
- Nếu không thể rút vì draw pile rỗng và lá bỏ trên cùng là lá duy nhất còn khả dụng, ván kết thúc hòa với thông báo **“Không còn bài để rút — ván hòa”**. Đây là chính sách bế tắc của sản phẩm, không phải luật Mattel.
- Người hết bài đầu tiên thắng một ván; không tích lũy 500 điểm.
- Nếu lá cuối là Draw Two hoặc Wild Draw Four, người kế vẫn phải giải quyết phạt; chỉ sau đó mới kết thúc. Wild Draw Four cuối vẫn có thể bị challenge. Challenge thành công khiến người đánh rút bốn và ván tiếp tục; challenge thất bại khiến challenger rút sáu rồi người hết bài thắng. Đây là diễn giải thứ tự giải quyết số hóa để tuân hướng dẫn W2085 rằng lá phạt cuối vẫn được rút trước khi chốt round.

## Ánh xạ mã test

| Mã | Nhóm test |
|---|---|
| R01 | Thành phần 108 lá, số bản sao, ID duy nhất |
| R02 | Chọn dealer, chia 7, thứ tự ghế, hòa khi rút |
| R03 | Từng loại lá mở đầu và màu khởi động |
| R04 | So màu/số/ký hiệu/Wild và sai lượt |
| R05 | Rút tự nguyện/bắt buộc, đánh lá vừa rút, giữ, không rút lần hai |
| R06 | Hướng đi, skip, draw two và ván hai người |
| R07 | Wild Draw Four hợp lệ, challenge thành/bại, giữ bí mật tay bài |
| R08 | Hô UNO, bắt UNO, ranh giới lượt và race requests |
| R09 | Tái tạo chồng rút, giữ lá trên cùng, bế tắc |
| R10 | Lá cuối thường/+2/+4, challenge cuối, không hành động sau finished |
| R12 | Cộng dồn, jump-in, đánh nhiều lá đều bị từ chối |

Test phải chứng minh hành động bị từ chối không làm đổi state. Engine dùng RNG có thể điều khiển trong test; production dùng nguồn ngẫu nhiên server.
