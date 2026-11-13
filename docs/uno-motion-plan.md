# Kế hoạch hiệu ứng và hình dáng bài UNO

Trạng thái: đã triển khai hiệu ứng và radius; kết quả và giới hạn tại [uno-motion-report.md](./uno-motion-report.md). Chờ Terra nghiệm thu trực quan. Luật BB-UNO-1 và bản sửa join HTTP LAN được giữ.

Phản hồi người dùng sau khi chơi thử: lực đập/rung còn yếu, chưa có bài bay từ ghế và mobile cần bàn gọn/tay bài chồng. Kế hoạch tiếp theo **chưa code**: [motion v2](./uno-motion-v2-plan.md); [prompt cho Luna](./luna-uno-motion-v2-prompt.md). V2 thay các quyết định tương ứng của v1, báo cáo v1 vẫn là lịch sử.

## Mục tiêu

Lá số có animation bình thường, nhanh và nhẹ. Lá chức năng tạo cảm giác tác động mạnh: đặc biệt +2/+4 và Bỏ lượt (người dùng gọi là lá cấm) phải có cú đập và rung bàn. Không làm mọi lá rung như nhau. Tay bài, nút bấm và nội dung đọc không rung theo bàn.

## 1. Hình dáng lá bài

- Giảm border-radius từ khoảng 11px xuống 5–6px ở kích thước bài cơ sở; khai báo token và tỷ lệ phù hợp cho lá lớn/nhỏ.
- Áp dụng nhất quán cho CardArt ở tay bài, chồng bỏ, preview, minh họa và các biến thể lá trang chủ. Rà cả hero-card riêng để không bỏ sót.
- Giữ số đen đã được người dùng yêu cầu; rà khả năng đọc cả khi lá bị làm tối. Cân lại viền/bóng mà không đổi palette hoặc artwork.

## 2. Ma trận hiệu ứng

Các thông số dưới đây là điểm bắt đầu để tinh chỉnh trực quan, không phải tiêu chuẩn bắt buộc.

| Sự kiện được server xác nhận | Chuyển động | Tác động bàn và nhãn |
|---|---|---|
| Đánh lá số 0–9 | Trượt về chồng bỏ, xoay 2–4 độ rồi nằm ổn định, khoảng 180–240ms | Chạm nhẹ, không shake, không flash |
| Wild thường | Đặt bài nhẹ, viền bàn chuyển sang màu đã chọn khoảng 200ms | Tên màu rõ; không rung mạnh |
| +2 | Lá nhấc nhẹ rồi đập xuống, scale/rotate nhỏ, khoảng 220–300ms | Rung bàn 3–4px trong 140–180ms; nhãn +2 và tổng phạt mới |
| +4 | Cú đập rõ hơn +2, kết hợp đổi màu | Rung bàn 4–6px trong 160–220ms; nhãn +4 và tổng phạt mới |
| Cộng tiếp +2/+4 | Cú đập theo loại lá vừa đánh, cập nhật tổng phạt | Tổng N nhấn một lần; cường độ có trần, không tăng vô hạn theo N |
| Bỏ lượt / lá cấm | Lá đập xuống rõ, ký hiệu cấm bật một lần | Rung bàn 3–4px trong 140–180ms; nhãn Bỏ lượt ở ghế chịu tác động, kể cả hai người |
| Đảo chiều | Lá chạm chắc, mũi tên quay về hướng mới | Nhấn nhẹ, rung tối đa 2px nếu phù hợp; vẫn có chữ chiều chơi |
| Rút một lá | Lá úp bay từ chồng rút về ghế/tay bài, 180–260ms | Không rung; chỉ lật mặt lá riêng của người nhận |
| Nhận N lá phạt | Một nhóm lá úp tối đa 3–4 phần tử đại diện, badge ×N | Một cú nhấn/rung nhẹ lúc nhận, không chạy N animation nối tiếp |
| Chia bài đầu ván | Lá úp chia theo nhịp ngắn, toàn cảnh khoảng 500–700ms | Không khóa thao tác; đủ dữ liệu thì hiển thị ngay |
| Hô UNO / bắt UNO | Nhãn xuất hiện cạnh đúng người, khoảng 500–800ms | Không rung toàn bàn; phân biệt hô và bị bắt |
| Hết ván | Làm nổi ghế thắng, giấy màu ít và ngắn dưới 1 giây | Một lần mỗi game; không che kết quả và nút chơi lại |

Không tiết lộ lá đối thủ qua các vật thể animation. Chỉ lá đã đánh lên chồng bỏ là công khai. Chọn màu trong dialog chưa được xem là đánh bài; khi server từ chối thì không phát cú đập thành công.

## 3. Rung và giới hạn chuyển động

- Camera shake ở đây là transform trên lớp hình ảnh bàn, không rung body/header/tay bài/nút/modal. Dùng wrapper riêng để không đè transform của bố cục lá.
- Mobile giảm biên độ khoảng một nửa; kiểm tra không gây tràn ngang. Không dùng WebGL, thư viện nặng hoặc browser vibration API.
- Tối đa hai điểm chuyển động nổi bật cùng lúc; gộp/đơn giản hóa hiệu ứng đến dồn, không tích hàng đợi dài sau trạng thái thật.
- Có tùy chọn Giảm hiệu ứng, lưu cục bộ. Khi hệ điều hành bật prefers-reduced-motion, luôn bỏ shake, bay lá, xoay/scale lớn và giấy màu; giữ nhãn, trạng thái và đổi màu tức thời hoặc fade ngắn. Tùy chọn trong app không ghi đè yêu cầu giảm chuyển động của hệ thống.
- Không chớp sáng toàn màn hình, không dùng loop rung liên tục. Motion chỉ trang trí, không điều khiển luật hoặc cửa sổ bắt UNO.

## 4. Đồng bộ realtime

- Rà source cho thấy server chỉ broadcast snapshot riêng theo người và ack cho actor; snapshot không nêu nguyên nhân thay đổi. Bổ sung event Socket.IO riêng `game:effect` sau hành động UNO được chấp nhận.
- Payload strict: `eventId` ổn định từ `gameId` + game revision; `roomId`, `gameId`, room `revision`, game `revision`, `actionType`, `actorId`; lá công khai vừa đánh `{type,color,value?}`; `targetId`/`winnerId`/`currentColor`/`penaltyTotal` khi áp dụng. Rút một/nhiều chỉ gửi số lá rút, tuyệt đối không gửi ID hoặc mặt lá rút.
- Server tạo event từ intent đã validate và state trước/sau transition; emit ngay sau snapshot, chỉ tới socket đang giữ ghế. Socket.IO giữ thứ tự packet trên cùng socket. Hành động sai không phát event; action ID lặp trả cache, không phát event lần hai.
- Client dedupe theo `gameId:eventId`, chỉ phát khi event thuộc game hiện hành và snapshot khớp chính xác room/game revision. Nếu event đến trước snapshot hoặc snapshot đã qua revision thì bỏ hiệu ứng; không xếp hàng phát muộn. Resume đặt snapshot nền và xóa event đã thấy. Snapshot luôn quyết định trạng thái.
- Snapshot là nguồn trạng thái. Sự kiện chỉ giúp trình bày; mất sự kiện vẫn chơi đúng. Không giữ luật chờ animationend, timeout hoặc DOM.
- Chống trùng theo gameId/eventId; không phát lại do ack và broadcast cùng trả kết quả. Không phát event cũ sau snapshot mới hơn. Nếu không ghép được mốc trạng thái, bỏ hiệu ứng và vẽ trạng thái mới nhất.
- Join/reload/resume lấy snapshot nền và không diễn lại lịch sử; rematch đổi gameId thì xóa effect cũ. Không chạy lại cú đập khi socket nhận snapshot không có nước đánh mới.
- Cleanup timer, RAF, listeners và animation khi unmount/leave/room close/disconnect; dừng overlay khi background rồi về lại trạng thái hiện tại. Lớp hiệu ứng pointer-events:none, aria-hidden; không cản focus/chạm hoặc phát aria-live lặp.

## 5. Thứ tự triển khai và nghiệm thu

1. Khảo sát CardArt/CSS và snapshot/event; ghi quyết định thiết kế sự kiện trước khi chỉnh realtime.
2. Sửa radius và token motion; xác minh số đen, hình lá ở các kích thước.
3. Làm luồng đánh lá số/rút bài/chia bài và cơ chế chống trùng/cleanup.
4. Thêm +2/+4/cộng phạt/Bỏ lượt, sau đó Reverse/Wild/UNO/kết quả.
5. Thêm Giảm hiệu ứng; rà desktop 1440px, mobile 390px và 360px, hand nhiều lá, hai và sáu ghế.
6. Đã chạy test metadata/privacy, duplicate/stale revision, reconnect/rematch và production round hai socket; typecheck/build. Kiểm tra hai phiên browser, mobile, reduced motion trực quan vẫn cần nghiệm thu Terra.
7. Đã ghi [report triển khai](./uno-motion-report.md), cập nhật UI/architecture/test plan. Không thêm âm thanh hoặc game.

## Điều kiện hoàn thành

- Phân biệt rõ lá số nhẹ và lá cộng/Bỏ lượt đập mạnh; lá bo ít hơn, số đen đọc rõ.
- Luật/lượt/server state và HTTP LAN không hồi quy; effect không tạo nước đi hoặc trì hoãn thao tác.
- Không lộ bài, không phát hiệu ứng lặp khi ack/broadcast/reconnect, không để overlay treo qua ván mới.
- Reduced motion hoạt động, không tràn ngang, không che nút hoặc làm rung tay bài.
- Có báo cáo kiểm tra thực tế và phần bị chặn cho Terra.
