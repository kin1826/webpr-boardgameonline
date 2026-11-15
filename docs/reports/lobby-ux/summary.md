# Tinh gọn giới thiệu game và lời mời phòng

Ngày 15/11/2026. Trang giới thiệu bỏ câu mô tả UNO, liên kết xem thử bàn chơi và ghi chú dài dưới danh sách phòng công khai. Mỗi phòng công khai là một nút vào phòng trực tiếp; nhấn sẽ gọi luồng join hiện có bằng mã của phòng và nhận lỗi từ server nếu phòng không còn chỗ.

Phòng chờ đặt “Sao chép” mã và “Chia sẻ link” cạnh mã phòng. Chia sẻ dùng Web Share API khi trình duyệt hỗ trợ (gồm share sheet trên iPhone trong ngữ cảnh được phép); nếu không có thì sao chép link với fallback cho HTTP LAN. Bỏ dòng “Gửi mã này cho bạn bè”, ô copy link nhiều tab, icon trang trí ở panel bên phải và nút copy link trùng lặp. Không thay đổi logic phòng, quyền chủ phòng hay luật game.

Danh sách phòng công khai hiện đúng hình đại diện của chủ phòng cạnh tên. Server gửi `hostAvatarId` từ ghế chủ phòng trong `PublicRoomSummary`; HTTP client xác thực ID 0–11 rồi dùng cùng bộ SVG với sảnh/bàn. Khi chủ phòng chuyển quyền, dữ liệu danh sách lấy hình từ chủ mới.

Kiểm chứng bổ sung: `npm run build` đạt; `npx vitest run server/src/rooms.test.ts` đạt 26/26, trong đó xác nhận tên và avatar chủ phòng trong danh sách công khai. Chưa xác nhận giao diện trên điện thoại thật.

Kiểm chứng: `npm run build` đạt, `git diff --check` đạt. Chưa thử share sheet trên iPhone hoặc hai trình duyệt thật; Terra cần xác nhận trải nghiệm mobile/clipboard và join phòng công khai.
