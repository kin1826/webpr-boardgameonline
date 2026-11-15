# Hội Quậy — nhận diện mới

Ngày 15/11/2026. Đổi thương hiệu Bàn Bạn thành Hội Quậy trong giao diện, metadata, tài liệu đặc tả hiện hành và thông báo server. Root npm package đổi thành `hoi-quay`, lockfile cập nhật đồng bộ. Giữ namespace workspace `@banban`, khóa session localStorage, BB-UNO-1 và NT-VI-1.

Icon `public/favicon.svg` tự vẽ: hai lá bài lệch và dấu sét trắng, không dùng artwork/logo UNO. Header dùng cùng asset qua `Brand`. Theme đỏ san hô #FF8275 trên nền than #151112; cập nhật tokens Lucian và accent cũ. Màu bài vẫn giữ ý nghĩa riêng.

Skill: ui-ux-pro-max tra thiết kế và minimalism; bỏ gợi ý 3D không phù hợp yêu cầu, dùng vector phẳng. Lucian catalog xác nhận #033 Inline title editing hiện có; chỉ đổi copy/token, không port thêm thành phần hoặc thay tương tác.

Kiểm chứng: production build/typecheck và git diff --check. Chưa kiểm chứng trực quan trên browser/điện thoại thật; chưa nghiệm thu Terra. Không chạy lại engine suite vì không đổi luật hoặc nghiệp vụ.

## Tinh gọn trang chủ

Trang chủ dùng headline “Vô Vô, sắp đủ tay rồi !!”; bỏ tagline, câu giới thiệu, helper dưới ô mã, ba chip lợi ích, eyebrow phía trên danh sách game, mô tả từng trò và câu miễn trừ ở footer. Giữ trường mã phòng, nút vào phòng, tên/trạng thái game và hành động để không đổi luồng chơi. Giảm khoảng đệm hero trên desktop/mobile để lưới game xuất hiện sớm hơn. Build hiện tại được chạy lại sau thay đổi này.
