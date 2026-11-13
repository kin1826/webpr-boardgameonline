# Kế hoạch UNO motion v3 — thao tác gọn, chuyển động liền mạch

Trạng thái: **đã triển khai và qua kiểm thử tự động; chưa nghiệm thu trực quan**. Kết quả, thông số và checklist Terra: [uno-motion-v3-report.md](./uno-motion-v3-report.md). Prompt triển khai đã thực hiện: [uno-motion-v3-prompt.md](./uno-motion-v3-prompt.md).

## 1. Phát hiện từ source và phản hồi

- Mobile lưu `selectedMobileCardId` nhưng class nâng lá đang dựa vào `isDrawn`, chưa phản ánh lá người dùng chọn. Nút xác nhận nằm ở tray khiến thao tác đi vòng.
- Viền xanh dày trong ảnh nút Rút bài đến từ `.draw-attention` (outline 3px và shadow lan thêm 7px). Các lá cũng có nhiều lớp shadow theo playable/selected. Đây không chỉ là focus bàn phím.
- Overlay bay cố định 65×96, đặt ở góc rect nguồn nhưng tính dịch chuyển theo tâm rect nguồn. Với avatar rộng khác lá bài, tâm overlay và tâm dùng tính toán lệch nhau.
- Keyframe bay giảm opacity về 0 ở đích; lá bỏ chạy animation riêng ngay khi event đến. Người chơi dễ thấy hai bản lá, cảm giác hụt/giật khi chuyển giữa overlay và discard.
- Rung chạy bằng effect riêng ngay khi nhận event, trước khi lá bay tới. Chỉ nội dung scene bên trong di chuyển, nền/viền felt chưa tạo cảm giác va chạm rõ.
- Khi một lá bị xóa khỏi hand, các lá còn lại đổi layout ngay, chưa có animation bù vị trí.

Các nhận xét trên là kiểm tra source và phản hồi người dùng, chưa phải kết quả đo FPS/video mới. V2 đã có báo cáo test tự động; không dùng kết quả đó để kết luận motion đạt.

## 2. Quyết định tương tác mới

### Mobile: chạm lá hai lần, bỏ nút xác nhận

1. Chạm lá A hợp lệ lần đầu: nâng A thêm khoảng 12–16px trong 100–140ms, đưa lên trước các lá lân cận. Không gửi play.
2. Chạm lại chính A đang nâng: gửi intent đánh. Đây là hai lần chạm riêng, **không yêu cầu double-tap nhanh hoặc giới hạn thời gian**.
3. Chạm B: hạ A và nâng B; chạm lại B mới đánh.
4. Wild/+4: lần chạm thứ hai mở dialog chọn màu, chọn màu mới gửi intent như hiện tại.
5. Bỏ nút “Đánh lá” và dòng xác nhận chọn lá trong tray. Có thể dùng hướng dẫn gọn “Chạm lần nữa để đánh” ở tay bài, không làm đổi chiều cao tray.
6. Reset selection khi mất lượt, lá không còn hợp lệ, mất mạng/pause, đổi game hoặc rời bàn. Cuộn tay bài không được tính thành lần chạm đánh; không đánh từ pointerdown. Tap sau khi scroll phải theo đúng trạng thái chọn đang hiển thị.

Desktop giữ click-to-play. Keyboard trên desktop tiếp tục Enter/Space như button hiện có. Mọi action vẫn phải được server xác thực; chống gửi lặp dùng request lock hiện hành.

### Bỏ viền trang trí dày

- Bỏ halo/outline tự động của draw-attention, playable và selected trong bàn live. Nút Rút bài có thể dùng màu nền/chữ và nhãn chỉ dẫn nhẹ; lá hợp lệ phân biệt bằng độ sáng, lá chọn bằng vị trí nâng.
- Tap/click không để lại vòng focus nổi hoặc glow nhiều lớp. Bỏ tap highlight mặc định có kiểm soát trong bàn chơi nếu cần.
- Giữ `:focus-visible` gọn 1–2px khi dùng bàn phím, không xóa focus toàn website. Phân biệt rõ focus, selected và legal card; không dùng cùng một ring cho cả ba.
- Giữ viền cấu tạo lá bài, viền theo màu hiện tại của mặt bàn và accessible name màu/số/loại.

## 3. Một nhịp bay → tiếp đất → tác động

- Một effect trình bày điều phối cho mỗi eventId, không để discard CSS, flight WAAPI và shake cùng tự khởi chạy.
- Flight chỉ bắt đầu sau xác nhận server. Nguồn local lưu rect trước khi snapshot xóa lá; đối thủ dùng avatar/ghế theo actorId. Kiểm tra correlation hiện tại actor/gameRevision; nếu phải thêm actionId thì ghi hợp đồng trước khi sửa schema/server.
- Tính source/target cùng tọa độ viewport và cùng điểm neo tâm. Overlay có kích thước/scale chuyển từ nguồn sang kích thước lá bỏ; không hard-code góc trái nguồn rồi tính delta từ tâm nguồn.
- Đo source/target một lần đầu effect. Không đọc layout mỗi frame; dùng transform/opacity. Chỉ dùng màu/mặt lá đã công khai.
- Số: bay khoảng 230–300ms, đường cong nhẹ, ease-out liên tục, xoay tối đa khoảng 4 độ. Đến đích giữ opacity 1 và bàn giao hình ảnh sang discard cùng vị trí/kích thước, không fade mất trước khi chạm.
- +2/+4/Skip: bay 240–300ms, tiếp đất/slam thêm 70–110ms. Rung bắt đầu ở nhịp tiếp đất, không chạy từ đầu đường bay. +4 nặng hơn +2; lá số không rung.
- Có thể tạm che bản vẽ lá bỏ mới trong lúc overlay hợp lệ đang bay, nhưng không trì hoãn snapshot, quyền đi hoặc state. Khi hủy/thiếu rect/không có event, hiện ngay lá bỏ authoritative; không để chồng bỏ trống hoặc lộ sai lá.
- Event mới thay effect cũ, không xếp hàng dài. animation finish chỉ điều khiển hình ảnh, không chuyển lượt hoặc tính luật.

## 4. Rung phải nhìn thấy được

- Giữ intensity tăng theo tổng phạt server và có trần; rà lại biên độ thực đang áp dụng sau clipping và reduced motion, không chỉ kiểm tra giá trị hàm.
- Tách rõ lớp nền/viền/ring/hình chồng bài được rung và lớp nút tương tác đứng yên. Tay bài, tray, header, dialog và hit target Rút bài không dịch chuyển.
- Có thể dùng visual clone mặt sau chồng rút trong scene rung, nút hit target cố định ở lớp trên. Tránh dựng hai nút có thể focus hoặc hai bản đọc bởi screen reader.
- Mốc desktop tổng 2/4/8/12/16: khoảng 4/6/9/12/14px, mobile khoảng 60%, trần 8px. Pulse giảm dần 180–320ms, không flash toàn màn hình, không kéo dài theo tổng N.
- App Giảm hiệu ứng hoặc OS reduced motion tắt bay/rung/reflow lớn; phải kiểm tra hai nguồn này trước khi kết luận “không rung”. Không tự tắt preference đã lưu để làm demo đẹp hơn.

## 5. Dồn bài mượt sau khi đánh/rút

- Đo vị trí hand trước/sau commit theo cardId ổn định; dùng FLIP hoặc WAAPI tương đương để các lá còn lại trượt về chỗ mới khoảng 180–240ms.
- Bù cả X/Y khi một lá chuyển sang hàng trước trên mobile. Chỉ animate vị trí của lá còn lại, không remount cả hand, không đổi key theo index.
- Dùng wrapper hoặc thuộc tính translate riêng để không ghi đè transform nâng lá, hover hay deal/draw. Không để FLIP và CSS cùng tranh transform một node.
- Khi có update tiếp trong lúc đang chạy: lấy vị trí hiện tại hoặc kết thúc có kiểm soát, hủy animation cũ; không kéo ngược lá về mốc cũ.
- Resize/orientation, cuộn và gameId mới reset baseline. Dọn WAAPI/RAF/listeners/timer khi leave, background, disconnect và unmount. Số phần tử động được giới hạn; không dựng vòng đo layout liên tục.
- Giữ số/màu đọc được, phần lộ mỗi lá đủ chạm, nâng lá không đổi chiều cao hàng hoặc kéo cả trang.

## 6. Thứ tự triển khai

1. Rà source hiện tại và ghi quyết định event/DOM; dùng ui-ux-pro-max cho chuyển động/focus và Lucian nếu có thành phần khớp sau khi tra catalog. Không thêm thư viện nặng.
2. Mobile chạm hai lần + nâng lá đúng selection; xóa nút xác nhận và ring trang trí dày.
3. Hợp nhất flight/landing/discard, sửa tâm/kích thước và bàn giao opacity.
4. Gắn shake vào landing, tách lớp hình ảnh khỏi hit target, kiểm tra tăng lực thực tế.
5. FLIP hand/reflow, cleanup và reduced motion.
6. Typecheck/build và test logic thay đổi; nghiệm thu browser/video rồi tạo report Terra.

Giữ BB-UNO-1, legal actions, UUID HTTP LAN, privacy/session và tray ổn định. Không thay luật để animation dễ chạy.

## 7. Tiêu chí nghiệm thu

- Mobile: tap A nâng A, tap B đổi chọn, tap lại B đánh; không cần nút riêng; không gửi hai action do tap nhanh; Wild vẫn chọn màu.
- Không còn vòng mint/glow dày như ảnh người dùng. Keyboard vẫn thấy focus rõ, pointer không bị ring bám.
- Hai phía đều thấy lá bay đúng tâm đến chồng bỏ, không nhảy đích/biến mất sớm/lá kép; + chỉ rung sau khi tiếp đất.
- Sau khi đánh lá ở đầu/giữa/cuối, các lá còn lại trượt sang vị trí mới kể cả qua hàng; không giật lên ngay.
- Thử 360×640, 390×844, 1440px; hand 1/7/14/25/40 lá, 2/4/6 ghế; cuộn tay, rotate, zoom, reconnect/rematch/tab nền, app/OS reduced motion.
- Regression test cho action gate/correlation/dedupe nếu sửa, giữ intensity và luật/socket/HTTP LAN tests. Không viết test chỉ khẳng định class CSS.
- Bằng chứng bắt buộc cho kết luận motion đạt: video ngắn từ local và phía đối thủ, chuỗi phạt tăng tổng, dồn bài qua hàng. Browser không có thì ghi BLOCKED; build/test xanh không thay thế xem motion.
- Tạo `docs/uno-motion-v3-report.md`: file, thông số thật, kiểm tra thực chạy, bằng chứng, giới hạn, checklist Terra; không tự ghi Terra approve. Giữ report v2 làm lịch sử.
