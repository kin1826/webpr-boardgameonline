# Bộ tên và hình người chơi

Ngày 15/11/2026. Người mở web lần đầu nhận ngẫu nhiên một trong 12 tên ngắn và một trong 12 hình SVG tự vẽ. Tên/hình lưu trên thiết bị; hộp “Đổi tên” cho sửa tên và chọn hình. Hình được gửi lúc tạo/tham gia phòng, server kiểm tra ID 0–11, gắn vào ghế và đưa trong snapshot công khai; nối lại giữ nguyên hình theo ghế. UNO, Nối từ, sảnh và header hiển thị hình tương ứng. Client cũ không gửi ID vẫn dùng hình mặc định 0.

Ảnh gồm Mèo, Gấu, Ếch, Cáo, Robot, Mây, Dâu, Sao, Trăng, Ma nhỏ, Vịt, Thỏ; vẽ bằng SVG nội bộ tại `src/components/PlayerAvatar.tsx`, không dùng ảnh bên ngoài. Khi đổi tên/hình giữa lúc đã ở phòng, thông tin mới được áp dụng với người khác khi tham gia phòng tiếp theo; hành vi cũ của tên trong phòng được giữ.

Kiểm chứng: `npm run build` đạt; `npx vitest run server/src/rooms.test.ts` đạt 26/26, gồm ghế khách giữ avatar sau resume. Chưa kiểm tra trực quan trên trình duyệt/điện thoại thật, chưa nghiệm thu Terra.

Cập nhật header mobile 15/11/2026: hiển thị avatar cùng biệt danh; chạm vào cả cụm mở hộp đổi tên/hình. Dòng “Tên & hình” chỉ hiện trên desktop. Tên dài được rút gọn bằng dấu ba chấm để không đẩy header tràn ngang. `npm run build` đạt sau thay đổi; chưa xem trên thiết bị thật.
