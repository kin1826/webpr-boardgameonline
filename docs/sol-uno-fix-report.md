# Báo cáo triển khai Sol — BB-UNO-1

Ngày: 13/11/2026. Thực hiện theo [prompt](./sol-uno-fix-prompt.md), luật đã chốt tại [uno-rules.md](./uno-rules.md), kế hoạch tại [uno-fix-plan.md](./uno-fix-plan.md). Trạng thái: source đã triển khai; Terra cần review độc lập.

Workspace không có metadata `.git`, nên không có commit hash hoặc diff từ Git để đính kèm; đường dẫn source và checklist đọc code được liệt kê trong [sol-handoff.md](./sol-handoff.md).

## Đã thay đổi

- Engine ở `packages/uno/src/index.ts`: mô hình phạt có tổng, loại lá cuối, người chịu và winner chờ xử lý; hỗ trợ +2/+4 chain theo BB-UNO-1, nhận tổng phạt trong một hành động và không tự rút ngay khi có lá +. +4 tự do, không có challenge. Lá +2 mở đầu cũng chuyển vào phase phạt.
- Engine: màu hiện tại chuyển sang màu của mọi lá thường được đánh; lá cùng số khác màu vì vậy đổi màu bàn. Reverse đổi hướng rồi tính ghế kế trong hướng mới; bàn hai người để người đánh đi tiếp. Guard màu Wild chạy trong engine.
- Engine projection sinh `allowedActions` từ cùng predicate mà server dùng để xác thực. Client làm tối/disable bài không hợp lệ, làm nổi bài hợp lệ và nút Rút khi không có bài; khoản phạt chỉ hiện cộng/nhận đúng trạng thái.
- Shared/server: payload strict có `gameId`; bỏ intent challenge cũ; từ chối hành động từ game cũ. Snapshot riêng từng người giữ kín tay bài và chồng rút.
- Room/session: reload tạm giữ ghế và game để resume; socket cũ bị thu hồi. Timeout broadcast thay đổi trạng thái cho khách còn lại. Phòng bị dọn phát `room:closed` cùng reason trước khi xóa; server restart vẫn làm mất phòng RAM như đã ghi trong README.
- UI: màu/chiều và nhãn rõ trên bàn, Wild chọn màu, tổng phạt và lựa chọn nhận/cộng, trạng thái UNO/kết nối/kết quả. Challenge đã được bỏ khỏi luồng thật; CSS dùng tên trạng thái hành động trung tính. Giữ sửa `createActionId` cho HTTP LAN.
- Tài liệu luật, giao diện, phòng, test và vận hành được cập nhật; hồ sơ Classic cũ vẫn lưu riêng làm tài liệu lịch sử.

## Kiểm chứng thực chạy

- `npm run typecheck` — pass.
- `npm test -- --reporter=verbose` — pass, 53/53 test trên 6 file. Cần quyền bind loopback cho test Socket.IO; chạy thường trong sandbox bị `EPERM`/timeout.
- `npm run build` — pass sau các chỉnh sửa cuối. Bundle: JS 414.90 kB / 123.84 kB gzip; CSS 70.96 kB / 15.57 kB gzip. Có cảnh báo không fatal về vị trí annotation trong Zod.
- Production smoke sau build cuối trên `127.0.0.1:4315`: `/`, `/health`, `/api/rooms`, Engine.IO polling handshake đều 200. Smoke trước đó trên cổng 4314 cũng đạt.
- Test Socket.IO hai client chơi hết ván production shuffle trong lần chạy cuối với 126 hành động (lần chạy trước 39); kiểm tra bảo toàn đủ 108 lá duy nhất ở mỗi bước và không lộ dữ liệu riêng.
- Browser host không khả dụng. Chưa kiểm tra bằng hai browser profile, chưa xem layout desktop/mobile, bàn phím/accessibility trực quan hoặc điện thoại thật trong phiên này. Xem [verification-report.md](./verification-report.md).

## Tài liệu cho reviewer

Đọc [gói nghiệm thu Terra](./sol-handoff.md) để lần theo code, kiểm tra regression cần thiết và chạy lại thao tác UI. Báo cáo Terra cũ trong `terra-test-report.md` được giữ nguyên như lịch sử; chưa có kết luận approve mới.
