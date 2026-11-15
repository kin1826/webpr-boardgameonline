# Tinh gọn bàn UNO

Ngày 15/11/2026. Dòng trên bàn chơi thật hiển thị mã phòng lớn kèm “UNO”, bỏ chấm trạng thái và nút Luật chơi tại vị trí đó. Tên lá dưới tay bài được bỏ khỏi DOM; nút lá vẫn có tên truy cập bằng `aria-label`. Trên điện thoại, bỏ thông báo đã chọn lá/chạm lần nữa trong vùng hành động; cơ chế chạm một lần nâng bài, lần hai đánh vẫn giữ. Nếu không có lá hợp lệ, thông báo rút bài còn hiện.

Nền mặt bàn pha nhẹ màu hiện tại từ cùng token với viền, giữ viền làm mốc rõ. Kết quả ván bỏ icon trang trí; hiển thị “VÁN ĐÃ KẾT THÚC” rồi tên người thắng bằng màu nhấn. Trạng thái không có người thắng vẫn có câu riêng. Bản xem thử ẩn khỏi luồng chọn game cũng được bỏ nhãn dưới lá và icon ở kết quả để giữ nhất quán.

Kiểm chứng: `npm run build` đạt; `git diff --check` đạt. Chưa kiểm tra bằng trình duyệt hoặc điện thoại thật; Terra cần xem tương phản nền theo bốn màu, mobile 360–390 px và kết quả thắng/thế hòa.
