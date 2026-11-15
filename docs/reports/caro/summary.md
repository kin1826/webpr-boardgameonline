# Caro HQ-CARO-1 — Tổng kết

Cập nhật 15/11/2026. Code hoàn tất; **Terra chưa nghiệm thu UI/thiết bị thật**. Đã gom hồ sơ kế hoạch/prompt/code/checklist theo yêu cầu người dùng.

## Quyết định luật đã triển khai

- Hai người, bàn 15×15; X đi trước, người cầm X bốc ngẫu nhiên cho ván đầu.
- Host chọn mục tiêu 4/5/6 (mặc định 5). Nối đúng số đã chọn theo ngang/dọc/chéo và còn ít nhất một đầu trống mới thắng. Mép bàn là chặn; chặn hai đầu hoặc vượt mục tiêu không thắng. Xét dãy cực đại trên cả bốn trục; có thể trả nhiều dãy thắng.
- Mỗi lượt 30 giây do server quyết định. Hết giờ hoặc chịu thua trao ván cho đối thủ; kín bàn không có dãy thắng thì hòa.
- Mất kết nối tạm dừng và giữ thời gian còn lại trong grace period 90 giây. Leave/kick/quá hạn reconnect hủy ván theo chính sách room chung.
- Rematch của cùng hai người đảo X/O; nếu thành viên đổi, ký hiệu X được bốc lại. Không thêm cấm nước Renju, Swap2, xin đi lại hoặc luật freestyle.
- Các nguồn và lựa chọn sản phẩm được ghi ở [caro-rules.md](../../caro-rules.md).

## Thay đổi chính

- `packages/caro/`: engine thuần TypeScript, state/projection/capabilities, place/resign/timeout/pause/resume và luật HQ-CARO-1.
- `packages/shared/src/index.ts`: catalog `caro` min/max=2, schema strict cho intent và snapshot public được parse runtime ở API.
- `server/src/rooms.ts`, `server/src/index.ts`: Caro state riêng theo phòng, timer/deadline, pause/resume/cleanup, `caro:action`, kiểm tra phiên/revision/game/turn/ô; không đưa action Caro qua UNO.
- `src/api/realtime.ts`, `src/api/http.ts`: API client typed, kiểm payload snapshot/ACK, availability và public room Caro.
- `src/App.tsx`, `src/caro/CaroTable.tsx`, `src/styles/app.css`: thẻ game, route/luật/phòng công khai, bàn 15×15, trạng thái lượt/kết nối/kết quả, responsive, phóng/pan, preview→xác nhận trên touch và dialog chịu thua.
- Tệp cấu hình workspace/server và `package-lock.json` mở rộng workspace; **không thêm dependency bên ngoài**.

Frontend không import engine để quyết định nước đi, thắng, giờ hết hoặc ký hiệu. Bàn và thời gian hiển thị từ snapshot/capabilities; server xác thực lại mọi action. Public snapshot có bàn, người chơi/ký hiệu, nước cuối/dãy thắng, deadline và capabilities theo người xem; không chứa session token.

## Bổ sung — chọn 4/5/6 quân để thắng

Thêm `caroWinLength` trong phòng/snapshot Caro và `winLength` trong engine/public game. Event `room:caro-settings` dùng command helper với schema strict, session/revision/idempotency. Chỉ host ở sảnh được chọn 4/5/6; đổi giá trị reset ready, đồng bộ snapshot, lưu qua rematch và chụp vào ván lúc start. Đúng số đã chọn và còn đầu mở mới thắng; vượt số không thắng. Mặc định 5. Mã kết quả `five` được giữ tương thích, UI dùng winLength cho thông báo thực tế.

UI chọn trong phòng chờ dùng nút sẵn có, aria-pressed, touch target tối thiểu 44px và theme tokens; mục tiêu cũng hiện trên bàn. Áp dụng ui-ux-pro-max cho trạng thái lựa chọn; tái sử dụng nút nên không port Lucian mới. File chính: engine/shared, rooms/index server, API realtime, App, CaroTable và app.css.

Kiểm chứng bổ sung: npm test đạt 148/148, 14 file (có quyền loopback). Engine test từng mục tiêu 4/5/6 với đầu mở/chặn/vượt số; schema từ chối 3/7/string/null; room test host/phase/reset-ready/rematch; hai socket đổi mục tiêu 4 rồi thắng. Chưa thử UI/thiết bị thật; Terra kiểm tra chọn luật host/guest, đổi sau ready, reload và rematch.

Gate cuối sau bổ sung: npm run build đạt (gồm frontend/server typecheck), 170 modules; hai cảnh báo annotation Zod như trước. git diff --check đạt.

## Kiểm chứng và việc còn lại

Lịch sử trước Caro: baseline 125 test; bản đầu 142 test; bổ sung 4/5/6 đạt 148 test. Sau đợt chuẩn bị deploy, suite toàn repo đạt 152/152 test trong 16 file. Xem bằng chứng mới tại [tổng kết deploy](../deployment-readiness/summary.md). Hai socket độc lập đã kiểm tra create/join/ready/start/place/win/rematch, chống lặp và đổi X/O; test engine bao gồm bốn trục, chặn/biên/dãy dài, hòa, deadline và pause/resume. Engine không phụ thuộc React/Socket.IO; frontend không tự tính thắng.

Gate Terra còn mở (không đánh dấu PASS):

- Hai browser/profile hoặc thiết bị độc lập: vào bằng mã/public, ready/start, chơi tới thắng với từng mục tiêu 4/5/6, resign/hết giờ/hòa và rematch.
- Người thứ ba bị chặn; guest không chỉnh luật, host đổi luật reset ready; cấu hình giữ qua reload/rematch.
- 1440/390/360px: keyboard, focus/dialog, reduced motion, touch chọn→xác nhận, zoom/pan không tràn ngang/đánh nhầm.
- Reload, mất mạng/giữ thời gian, hết 90 giây, kick/leave/hủy ván, chuyển host và restart.
- HTTPS/WSS hosting thật và hai mạng; privacy, callback ván cũ, session/revision/game/turn cũ; kiểm tra hồi quy UNO/Nối từ.

Không có thiết bị thật, load test hay public deployment trong đợt này. Report tiếp theo của Terra ghi trong cùng folder, nêu PASS/FAIL/BLOCKED, browser/device, bước tái hiện, expected/actual và bằng chứng đã che token.
