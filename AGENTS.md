# Hướng dẫn làm việc trong repo

## Trạng thái và thẩm quyền

- MVP có UNO (BB-UNO-1) và Nối từ (NT-VI-1), React/Vite + Node/Socket.IO, 2–6 người và phòng RAM. Người dùng đã xác nhận đợt sửa Nối từ ổn; hồ sơ được gom tại `docs/reports/noitu/summary.md`, Terra chưa nghiệm thu độc lập. Khi sửa tiếp, cập nhật trạng thái theo kiểm chứng thật trong `docs/reports/project-summary.md` và hồ sơ `docs/reports/noitu/`.
- Nếu người dùng yêu cầu tiếp tục triển khai, đọc hiện trạng tại `docs/reports/project-summary.md` và đặc tả liên quan, rồi triển khai yêu cầu đang được giao; không cần xin duyệt từng điều luật hoặc thay đổi thông thường trong phạm vi đã giao.
- Cập nhật trạng thái đúng thực tế: phân biệt dự kiến, đã làm, đã build, đã thử bằng trình duyệt và đã kiểm chứng trên thiết bị thật. Không đánh dấu hoàn tất bằng suy đoán.
- Đọc tài liệu hiện có trước khi sửa; nếu thay quyết định, ghi lý do vào tài liệu liên quan.

## Quy tắc sản phẩm

- Chỉ UNO và Nối từ 2–6 người, tiếng Việt, phòng public/private theo mã, không tài khoản/database/bot/chat. Không tự mở rộng Caro/Gián điệp.
- Server là nguồn sự thật; client chỉ gửi ý định. Không gửi tay bài đối thủ, thứ tự chồng rút, `usedWords`/bộ từ điển đầy đủ hoặc token.
- Engine độc lập Socket.IO, React, timer hệ thống và lưu trữ. Random/clock được truyền vào để test.
- Không coi house rule là luật chính thức. Mọi điều chưa rõ phải ghi nguồn hoặc nhãn lựa chọn triển khai trong `docs/uno-rules.md` trước khi code.
- BB-UNO-1 tại `docs/uno-rules.md` đã được triển khai trong engine, giao thức, UI và test; chưa có Terra approval cho bản hiện tại; checklist nằm trong `docs/test-plan.md`. Không phục hồi luật Classic trái quyết định này.
- NT-VI-1 tại `docs/noitu-rules.md` là lựa chọn triển khai cho từ mồi/prefix, lượt, timeout, draft, vote và thắng. Bộ từ là thử nghiệm, chưa semantic-review mẫu 200 mục và chưa xác minh quyền phân phối từng nguồn. Không khẳng định dữ liệu đã sạch hoặc dùng vote để vượt denylist.
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

## Tổ chức tài liệu và báo cáo

- Khi bắt đầu tính năng/game hoặc đợt công việc mới, tạo thư mục riêng `docs/reports/<ten-tinh-nang>/`, ví dụ `docs/reports/noitu/`. Đây là thư mục hồ sơ công việc, không phải thư mục source game.
- Trong lúc đang làm, lưu kế hoạch, quyết định, prompt triển khai, báo cáo code, QA và bàn giao trong cùng thư mục đó. Được tách theo chặng/phiên bản khi cần theo dõi; dùng tên rõ thứ tự như `01-plan.md`, `02-implementation.md`, `03-qa.md`. Không gom/xóa hồ sơ trung gian khi công việc vẫn đang mở, trừ khi người dùng yêu cầu gom; khi đó giữ rõ các mục kiểm chứng còn thiếu trong tổng kết.
- Khi đợt công việc hoàn tất hoặc người dùng yêu cầu chốt/gom tài liệu, hợp nhất hồ sơ trong thư mục tính năng thành **một file `summary.md`**: hành vi cuối, quyết định quan trọng, file code, kiểm tra/bằng chứng, giới hạn và việc còn lại. Kiểm tra đã giữ đủ thông tin, cập nhật liên kết rồi dọn các Markdown trung gian đã được thay thế; không xóa source, dữ liệu, giấy phép hoặc bằng chứng cần thiết.
- Cập nhật `docs/reports/project-summary.md` bằng trạng thái ngắn và liên kết tới tổng kết tính năng; tránh sao chép toàn bộ nội dung. Không đánh dấu hoàn tất/QA approve chỉ để gom tài liệu. Nếu mở lại tính năng, tiếp tục hồ sơ trong cùng thư mục, giữ tổng kết cũ cho tới khi có bản hợp nhất mới.
- Mọi báo cáo mới phải nằm trong `docs/reports/` hoặc thư mục con tương ứng; không tạo report/handoff ở gốc `docs/`. Không tái tạo hồ sơ UNO cũ đã được gom, trừ khi có đợt sửa mới thực sự được giao.
- Gốc `docs/` chỉ giữ đặc tả hiện hành về sản phẩm, luật, kiến trúc, UI, phòng, vận hành và kế hoạch kiểm thử; cập nhật trực tiếp khi quyết định thay đổi.
- Báo cáo nêu ngắn gọn: đã đổi gì, file chính, kiểm tra thật/lệnh/kết quả, bằng chứng, giới hạn và việc còn lại. Không lấy test count cũ làm kết quả mới hoặc ghi đã nghiệm thu khi chưa kiểm tra.
