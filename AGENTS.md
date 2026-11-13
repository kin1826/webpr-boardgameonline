# Hướng dẫn làm việc trong repo

## Trạng thái và thẩm quyền

- MVP UNO React/Vite + Node/Socket.IO đã được triển khai trong phạm vi 2–6 người, phòng RAM và luật W2085. Khi sửa tiếp, cập nhật trạng thái theo kiểm chứng thật trong `docs/verification-report.md`.
- Nếu người dùng yêu cầu tiếp tục triển khai, thực hiện lần lượt `docs/implementation-plan.md`; không cần xin duyệt từng điều luật hoặc thay đổi thông thường trong phạm vi đã giao.
- Cập nhật trạng thái đúng thực tế: phân biệt dự kiến, đã làm, đã build, đã thử bằng trình duyệt và đã kiểm chứng trên thiết bị thật. Không đánh dấu hoàn tất bằng suy đoán.
- Đọc tài liệu hiện có trước khi sửa; nếu thay quyết định, ghi lý do vào tài liệu liên quan.

## Quy tắc sản phẩm

- Chỉ UNO 2–6 người, tiếng Việt, phòng public/private theo mã, không tài khoản/database/bot/chat.
- Server là nguồn sự thật; client chỉ gửi ý định. Không gửi tay bài đối thủ hoặc thứ tự chồng rút.
- Engine độc lập Socket.IO, React, timer hệ thống và lưu trữ. Random/clock được truyền vào để test.
- Không coi house rule là luật chính thức. Mọi điều chưa rõ phải ghi nguồn hoặc nhãn lựa chọn triển khai trong `docs/uno-rules.md` trước khi code.
- BB-UNO-1 tại `docs/uno-rules.md` đã được triển khai trong engine, giao thức, UI và test; chờ Terra nghiệm thu độc lập theo `docs/sol-handoff.md`. Không phục hồi luật Classic trái quyết định này.
- Giữ ID lá, ván, người chơi ổn định. Xác thực payload runtime, phiên socket hiện tại, lượt, action ID và phiên bản trạng thái.
- Không để animation hoặc đồng hồ client quyết định kết quả ván.

## UI và skill

- Dùng `/Users/admin/.agents/skills/ui-ux-pro-max/SKILL.md` cho thiết kế tổng thể và rà soát.
- Dùng `/Users/admin/.agents/skills/lucian-uxui/SKILL.md` cho thành phần tương tác phù hợp. Tìm lại catalog khi triển khai; chỉ port mã từ `get`, giữ dòng MIT/ghi công, đọc hướng dẫn porting và dọn effect React.
- Ánh xạ token Lucian vào hệ màu dự án; Việt hóa nội dung; hỗ trợ bàn phím, mobile và reduced motion.
- Tự vẽ lá bằng HTML/CSS/SVG; không lấy logo hoặc artwork độc quyền. Ghi rõ dự án không chính thức.

## Kiểm chứng và bàn giao

- Chạy test engine và integration liên quan trước khi nối UI; xem `docs/test-plan.md`.
- Kiểm tra socket session độc lập; browser/thiết bị thật chỉ ghi “đã thử” khi thực sự mở riêng. Không gọi hai tab cùng session là hai người độc lập.
- Không cần thêm abstraction cho game chưa tồn tại, hạ tầng nhiều node hoặc database.
- README cuối cùng phải có lệnh thực đã chạy: cài, dev, kiểm thử, build, production và LAN; kèm `.env.example` không chứa bí mật.
