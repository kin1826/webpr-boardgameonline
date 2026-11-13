# Kế hoạch sửa theo phản hồi chơi thực tế

Trạng thái: đã triển khai theo **GPT-6.1 Sol · High** trong engine, server và UI; Terra cần nghiệm thu. Đặc tả đích duy nhất: [BB-UNO-1](./uno-rules.md). Không thêm game/chế độ Classic song song, database, bot hoặc chat.

Prompt được dùng: [sol-uno-fix-prompt.md](./sol-uno-fix-prompt.md). Bàn giao implementation: [sol-uno-fix-report.md](./sol-uno-fix-report.md), [sol-handoff.md](./sol-handoff.md). Luật BB-UNO-1 đã được nối vào source.

## Phân loại báo cáo

- Đã được người dùng thử: join và sync đánh bài hoạt động sau sửa HTTP LAN; offline hiện trạng thái mất kết nối.
- Cần tái hiện: Đỏ 5 nhận Xanh 9; Reverse sai lượt; đổi màu chưa đúng; host reload làm phòng biến mất và khách không biết. Không khẳng định nguyên nhân khi chưa có trace.
- Thay đổi sản phẩm có chủ đích: cộng dồn, bấm nhận phạt, +4 tự do không challenge, Reverse hai người như Skip, không cộng khi lá cuối.
- Cải thiện UI: tối/disabled lá sai, highlight rút khi không có bài, viền màu bàn, trạng thái chọn màu.

## Thứ tự thực hiện

1. Đọc repo, giữ bản sửa HTTP LAN `createActionId` và try/finally. Tái hiện các báo cáo bằng test failing, duyệt cả server validation và projection/client legality.
2. Engine + shared schemas: khoản phạt gồm tổng, loại cuối, người chịu, người đang chờ thắng nếu lá cuối; phase/intent rõ ràng. Thay challenge bằng cộng/nhận. Cập nhật màu trong cùng transition với lá đánh; Reverse dùng thứ tự ghế/hướng server. Lỗi không mutation.
3. Room/session: trace disconnect/resume/leave/expiry/deletion. Reload là mất kết nối tạm thời, cho resume đúng ghế nếu room tồn tại; không tự suy đoán reload là leave. Nếu room thực sự đóng, gửi event rõ lý do tới mọi socket còn liên quan trước khi xóa. Server restart không gửi được event: resume lỗi phải xóa session và đưa về sảnh có thông báo. Giữ chính sách host leave chuyển quyền, kick hủy ván; không đóng phòng vô điều kiện khi host offline.
4. UI: áp dụng luật mới vào live và preview; dialog màu, Nhận N lá, tối/disabled bài, highlight rút, viền màu có chữ. Dọn challenge và các lời giải thích Classic trái luật mới. Không đổi homepage hoặc mở rộng phong cách ngoài yêu cầu.
5. Test engine/service/socket trước, rồi hai browser độc lập, desktop/mobile và LAN nếu khả dụng. Báo rõ fixture so với production shuffle.
6. Cập nhật README, architecture, rooms, test/verification và handoff theo trạng thái thực; không giữ các cảnh báo “chưa triển khai” nếu đã thực hiện và kiểm chứng, nhưng giữ lịch sử nguồn.

## Ma trận bắt buộc

| Nhóm | Case |
|---|---|
| Nước đi | Đỏ 5 → Xanh 9 bị server từ chối, revision/state nguyên; Đỏ 5 → Xanh 5 được và màu xanh; ký hiệu trùng khác màu cập nhật màu |
| Reverse | 1→2→3, 2 reverse→1; cả hai hướng, wrap ghế 3–6; 2 người người đánh đi tiếp |
| Wild | Đúng người chọn; màu bắt buộc; sai màu/sai lượt từ chối; các client thấy cùng màu; Wild mở đầu |
| Cộng | +2→+2→+4→+4=12; +4→+2 từ chối; +2 khác màu được khi đang phạt; lá +2 đầu chuỗi vẫn cần hợp lệ |
| Nhận | Có/không có lá cộng đều được nhận; đúng N, mất lượt, không đánh lá vừa nhận; nhận lặp không tăng bài lần hai; recycle bảo toàn |
| Lá cuối | Thường/Wild; +2/+4 đầu chuỗi và trong chuỗi: chỉ nhận tổng, không cộng/challenge, rồi chốt thắng; cạn bài theo chính sách hòa |
| UNO | Hô/bắt trước lượt kế; nhận phạt/đánh đóng cửa sổ; Reverse/Skip/chuỗi phạt không để window treo |
| Phiên | Host reload resume, socket cũ mất quyền; offline timeout, host leave, room delete, server restart và thông báo khách |
| UI | Disabled lá sai; không có lá hợp lệ nổi bật Rút; pending penalty chỉ cộng/nhận; chọn màu; viền màu + tên; 360/390/1440px; focus/reduced motion |
| Hồi quy | 108 lá, 2–6 người, ready/kick/public/private, privacy, action ID/revision, HTTP LAN UUID fallback |

## Bằng chứng bàn giao

Ghi lệnh thực chạy, test count mới, tái hiện trước/sau, file thay đổi, ảnh/log đã che token, ván production qua hai phiên và giới hạn. Browser thiếu thì BLOCKED, không thay bằng kết luận từ source. Terra review độc lập sau Sol; không tự ghi đã được Terra duyệt.
