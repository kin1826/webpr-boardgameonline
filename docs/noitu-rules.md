# Luật Nối từ NT-VI-1

Trạng thái: luật MVP được triển khai trong `packages/noitu`; chờ Terra nghiệm thu độc lập. Đây là lựa chọn luật sản phẩm của Bàn Bạn, không tuyên bố là một bộ luật Nối từ tiêu chuẩn.

## Mục tiêu và người chơi

- 2–6 người thật trong một phòng. Chủ phòng bắt đầu khi có ít nhất hai người và mọi khách đã sẵn sàng.
- Người cuối cùng còn thi đấu thắng. Không có điểm tích lũy qua nhiều ván.

## Bắt đầu và nối tiếng

- Server chọn ngẫu nhiên người bắt đầu và một từ mồi từ danh sách đã duyệt, ví dụ `nấu cơm`. Người chơi không tự chọn từ mồi.
- Từ mồi tính là đã dùng. Tiếng cuối của từ mồi được khóa sẵn ở ô đầu. Người tới lượt nhập đúng một tiếng vào ô thứ hai.
- Từ mới có cấu trúc hai tiếng. Tiếng đầu phải trùng chính xác tiếng cuối của từ vừa được chấp nhận.
- Ví dụ: `nấu cơm → cơm nước → nước lọc`. `nước lọc` làm tiếng tiếp theo cần nối là `lọc`.
- Chuẩn hóa Unicode NFC, chữ thường và khoảng trắng đầu/cuối hoặc lặp. Giữ dấu tiếng Việt; không tự sửa chính tả, đổi `i/y`, bỏ dấu hoặc coi hai biến thể dấu là như nhau.
- Từ đã dùng trong ván không được dùng lại. Từ bị nhóm bác cũng không được gửi lại trong cùng lượt.

## Từ điển và biểu quyết

- Server là bên duy nhất kiểm tra bộ từ điển thử nghiệm. Từ có trong playable set, đúng tiếng nối và chưa dùng sẽ được chấp nhận ngay.
- Từ không có trong bộ từ điển có thể được đề xuất cho cả nhóm. Người gửi không được bỏ phiếu; chỉ những người khác còn đang thi đấu được vote. Danh sách người có quyền được cố định khi mở biểu quyết. Chủ phòng không có quyền đặc biệt.
- Mỗi người đủ điều kiện có một phiếu. Từ được nhận khi phiếu chấp nhận nhiều hơn một nửa tổng số người có quyền bỏ phiếu, không chỉ quá nửa số người đã bỏ.
- Biểu quyết kéo dài tối đa 15 giây. Đạt đa số sớm thì kết thúc ngay. Nếu không đủ đa số khi hết giờ, từ bị bác, kể cả hòa hoặc không có phiếu.
- Khi biểu quyết mở, thời gian còn lại của lượt được giữ nguyên. Nếu bị bác, người đang lượt giữ nguyên tiếng cần nối và nhập từ khác trong phần thời gian còn lại.
- Mỗi lượt cho phép tối đa hai đề xuất không có trong từ điển. Từ đã bị bác không thể gửi lại trong lượt đó. Từ do nhóm nhận chỉ có hiệu lực trong ván hiện tại, không được ghi ngược vào bộ dữ liệu.
- Từ sai cấu trúc, không khớp tiếng nối, đã dùng hoặc nằm trong denylist bị từ chối trực tiếp; không thể dùng biểu quyết để vượt denylist.

## Thời gian, mất kết nối và kết thúc

- Mỗi lượt có 30 giây. Nhận yêu cầu tại hoặc sau `deadlineAt` được coi là hết giờ. Sai từ không đặt lại thời gian.
- Hết giờ hoặc chọn **Chịu thua** sẽ loại người đang tới lượt khỏi ván. Họ vẫn ở lại phòng và xem tiếp; lượt chuyển cho người còn thi đấu tiếp theo. Khi chỉ còn một người, người đó thắng.
- Mất kết nối của bất kỳ thành viên nào tạm dừng ván và giữ phần thời gian còn lại; khi mọi người nối lại, server tiếp tục phần thời gian đó. Hết 90 giây reconnect grace, hoặc có người rời/bị kick trong ván, phòng hủy ván theo chính sách vòng đời chung.
- Chủ phòng có thể chơi lại sau khi ván kết thúc. Ván mới tạo game ID, người bắt đầu và tập từ đã dùng mới.

## Dữ liệu thử nghiệm và giới hạn

- Playable list được pin tại `data/word-chain/playable-words.txt`, có version/hash trong `playable-manifest.json`. Runtime nạp và kiểm tra hash/count một lần ở server start; frontend không nhận toàn bộ từ điển.
- 51.898 mục ứng viên hai tiếng; hiện 4.021 mục có dạng nguồn viết hoa duy nhất được quarantine, 47.877 mục playable sau heuristic, 4 allow override, 0 deny override và 29 từ mồi. Các con số đầy đủ nằm trong [README dữ liệu](../data/word-chain/README.md).
- `lọc cọc` hiện có trong playable list nên sẽ được chấp nhận như từ đã biết; không kích hoạt vote. Giao diện luôn ghi “Từ điển thử nghiệm”.
- Đây mới là lọc hình thức, không chứng minh nghĩa/chất lượng cho toàn bộ mục. Quyền phân phối dữ liệu nguồn chưa được xác minh theo từng thành phần; không dùng báo cáo số lượng để tuyên bố dataset sạch hoặc sẵn sàng phân phối công khai.

## Nguồn và quyết định

- Bộ ứng viên: [Underthesea Dictionary](https://github.com/undertheseanlp/dictionary), snapshot commit `2c078cfc373b06e2980d324ce1d7bd13740c3319`, file `dictionary/words.txt`; đường dẫn, SHA và tài liệu upstream được giữ tại `data/word-chain/source/underthesea/`.
- Cách lọc ban đầu và giới hạn nguồn: [data/word-chain/README.md](../data/word-chain/README.md), [filter-report.json](../data/word-chain/filter-report.json), [provenance.json](../data/word-chain/source/underthesea/provenance.json).
- GPL-3.0 trong README upstream áp dụng cho mã nguồn theo khai báo đó; chưa có căn cứ khẳng định các danh sách dữ liệu thành phần đều được cấp cùng giấy phép.
- Thời gian 30/15 giây, strict majority, timeout vote tính bác, hai đề xuất lạ mỗi lượt, từ mồi và cách loại người là lựa chọn nhất quán NT-VI-1 cho bản thử. Không cộng dồn người chơi, không bot/AI xét nghĩa, không host override.
