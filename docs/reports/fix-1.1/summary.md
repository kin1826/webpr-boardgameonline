# Fix 1.1 — đánh giá và chuẩn bị phát hành

Ngày kiểm tra: 16/11/2026. Phiên bản ứng dụng: **1.1.0** trong `package.json` và root `package-lock.json`. Các workspace nội bộ giữ version hiện tại. Không tạo git tag, commit, push hoặc deploy trong đợt này.

## Kết luận

Đủ để phát hành giới hạn cho CLB chơi thử, với phạm vi ba game hiện có. Nghiệp vụ đã có engine độc lập, xác thực server, snapshot riêng tư và kiểm thử HTTP/Socket.IO với client độc lập. Chưa gọi là bản production đã nghiệm thu: cảm giác motion/sound, thiết bị thật, trận 6 người trên hosting và tải đồng thời chưa được kiểm chứng trong đợt này. Chưa có Terra approval.

## Nội dung bản 1.1

- Thắng ván +10 điểm, mục tiêu trận cấu hình 10–500 (mặc định 50). Server nối ván sau 3 giây khi chưa đủ điểm; roster đổi hủy trận/countdown.
- Cấu hình thời gian lượt; người hết giờ chờ ván sau, những người còn active tiếp tục; UNO dừng ván khi có người thắng.
- Panel tạo/chỉnh phòng chung; public directory theo game, vào phòng trực tiếp.
- UNO bật/tắt cộng dồn, bỏ gợi ý lá, hiển thị lưng bài đối thủ; rung/âm thanh phạt và nhận bài. Caro chọn ô hai lần, bàn 9/15/19 và mục tiêu 4/5/6.
- Bố cục khay hành động UNO và vùng bài theo luồng dọc; khoảng cách giới thiệu/tạo phòng với public list là 22 px desktop, 16 px mobile. Sound mặc định bật sau gesture, âm lượng mặc định 55%, giữ lựa chọn lưu của người dùng.

Hồ sơ này hợp nhất triển khai trải nghiệm v2, tinh chỉnh UI/motion và kiểm định Fix 1.1. BB-UNO-1, NT-VI-1 và HQ-CARO-1 hiện hành tiếp tục là đặc tả luật; không mở rộng từ vựng Nối từ trong đợt này.

## Triển khai và source chính

| Vùng | Nội dung và file |
|---|---|
| Đặc tả | Đã cập nhật luật ba game, `docs/architecture.md`, `docs/rooms-and-reuse.md`, `docs/test-plan.md` trước khi triển khai. Giữ HTTP LAN, reconnect và privacy. |
| Engine/schema | `packages/shared/` định nghĩa settings strict, presets/ranges và snapshot. `packages/uno/` nhận deadline, stacking, loại người hết giờ và kết thúc khi còn một người active. `packages/noitu/` nhận thời hạn lượt; vote giữ 15 giây. `packages/caro/` dùng boardSize cho bounds, ô, dãy thắng và public state. Có test tương ứng trong từng package. |
| Room/API | `server/src/rooms.ts` quản lý host-only settings, reset ready khi đổi cấu hình, điểm idempotent theo game/ván, target, countdown, khóa roster, timer và pause/resume. `server/src/index.ts` nhận settings và trả defaults/options/public directory an toàn; join kiểm tra lại trạng thái phòng. |
| Client/API | `src/api/http.ts` kiểm schema runtime cho defaults/options/public rooms; `src/api/realtime.ts` gửi create/update. `src/components/RoomSettingsDialog.tsx` chỉ gửi khi xác nhận. `src/App.tsx` poll sảnh 12 giây khi tab hiện, lọc/join, hiển thị điểm/countdown và capabilities. |
| Bàn game | `src/caro/CaroTable.tsx` chọn ô lần đầu, kích hoạt lại cùng ô mới gửi; đổi ô thay preview, hỗ trợ bàn phím và hủy preview khi kéo/zoom/pointer cancel. UNO trong `src/App.tsx` giữ mọi lá cùng độ sáng, chặn thao tác không hợp lệ theo capabilities; lưng bài tối đa 9 desktop/6 mobile, số lá thật vẫn hiện. `src/noitu/NoituTable.tsx` và UNO hiển thị deadline/trạng thái loại từ server. |
| UI/motion | `src/styles/app.css`, `src/styles/theme.css`: panel mobile, scoreboard, public list, giảm bo góc; bàn UNO theo flow, khay thông báo không phủ tay bài. Nhận phạt rung tay bài của mình hoặc lưng bài đối thủ trên client khác; cường độ theo số lá. Hiệu ứng dùng event server, có dedupe/revision correlation và reduced motion; animation không quyết định game. |
| Âm thanh | `src/audio/soundEffects.ts` dùng Web Audio, không thêm dependency: nút, đánh bài, phạt/nhận, gõ/xóa/bác từ, đặt quân và thắng. Mute/volume 0–100 lưu local; mặc định 55%, bật sau gesture; tab ẩn không phát, giới hạn voice và dọn nguồn. Giữ lựa chọn đã lưu, chống phát lại khi hydrate/reconnect. Đã sửa lỗi `Number(null)` khiến volume mặc định thành 0; dữ liệu volume không hợp lệ dùng 55%. |

Baseline trước triển khai là 152/152 test trong 16 file. Trong chặng backend, nhóm HTTP/rooms/Socket.IO đạt 47/47; đây là mốc lịch sử, kết quả toàn repo mới nhất ở bảng dưới.

## Phát hiện và sửa trong đợt kiểm định

Bố cục UNO mới đặt `.opponent-seats` vào flow nhưng các ghế vẫn giữ tọa độ tuyệt đối cũ. Fixture sáu người ở desktop có **hai cặp ghế chồng nhau**. Đã đổi vùng ghế sang flex wrap theo kích thước thực tế; tên dài giới hạn bằng ellipsis. Mobile giữ dải ghế cuộn riêng. File: `src/styles/app.css`.

Đây là sửa giao diện, không thay luật, protocol, timer hoặc kết quả game. Không thêm dependency. Các thay đổi sẵn có trong working tree được giữ lại.

## Kiểm chứng thực tế

| Kiểm tra | Kết quả |
|---|---|
| `npm test` với quyền loopback | **169/169 test, 16/16 file**, đạt. Có HTTP/Socket.IO độc lập và ván UNO shuffle production trong suite. |
| `npm test` trong sandbox mặc định | 158 đạt, 11 integration lỗi vì `listen EPERM 127.0.0.1`; chạy lại có quyền loopback đạt toàn bộ. |
| `npm run build` sau sửa ghế và version | Đạt; bao gồm TypeScript client/workspaces và server. |
| Production local: `HOST=127.0.0.1 PORT=3138 NODE_ENV=production npm start` | Server chạy. `/health`, `/api/games`, `/api/rooms`, `/` trả HTTP 200. API cấu hình có mặc định 30 giây/50 điểm, UNO stacking bật; ba game khả dụng. |
| Chrome headless, fixture HTML dùng CSS source | Sáu người, viewport 360/390/768/1440 px: 0 cặp ghế chồng nhau; không tràn trang theo chiều ngang. Khoảng hở mặt bàn–tay bài 8 px mobile, 10 px desktop; khay không phủ tay bài. Intro/public list cách 16/22 px. |
| `git diff --check` | Đạt. |

Fixture chỉ kiểm tra hình học của markup bàn và intro tương ứng, không chạy multiplayer React thật hoặc mô phỏng đầy đủ mọi nội dung. Công cụ Chrome tương tác không kết nối được. Lần thử `--dump-dom` trang React production không hoàn tất, nên không tính là browser smoke đạt; riêng HTTP asset JavaScript trả 200 và đúng MIME `text/javascript`. Không ghi đã test điện thoại thật, audio nghe thực tế hoặc QA trận online qua hosting. Đã dọn các tiến trình kiểm thử tạo trong đợt này.

Lịch sử kiểm chứng v2: typecheck/build và 169/169 test đạt; smoke production cổng 3137 trả 200 cho `/health`, `/api/games`, `/`. Trang chủ từng mở trên Chrome desktop trước bản sửa volume và layout cuối; thấy slider 0 khi đó, chưa reload bản đã sửa. Follow-up UI sau đó chỉ typecheck/build, không chạy suite và bị chặn mở cổng (`EPERM`). Các mốc này không thay thế lần kiểm định Fix 1.1 và không chứng minh UI/sound cuối đã được thử trên thiết bị thật.

Build còn hai cảnh báo annotation từ dependency Zod và JS chunk 509.00 kB minified / 151.52 kB gzip. Chúng không chặn build; có thể tách bundle theo game trong đợt tối ưu sau.

## Khi đưa bản này lên hosting

Build và deploy frontend/backend từ cùng phiên bản source vì hợp đồng settings/snapshot đã thay đổi. Khởi động lại backend sau build; người dùng tải lại tab để tránh giữ bundle/giao thức cũ. Phòng, điểm và phiên trong RAM sẽ mất khi restart/deploy. Backend dùng một process/replica, HTTPS/WebSocket và allowlist origin đúng theo README.

Sau deploy, ưu tiên một trận UNO 2 và 6 người (cộng/nhận, timeout, tự nối ván, đạt mục tiêu), một ván Nối từ vote bác bỏ/chịu thua, một ván Caro chọn ô hai lần; thử điện thoại và reconnect. Cần kiểm tra trực tiếp tiếng, rung và layout trên thiết bị thật.

Giới hạn đã biết: từ điển Nối từ thử nghiệm chưa rà nghĩa toàn tập/quyền từng nguồn; state RAM; chưa load test. Các việc này tiếp tục được ghi nhận, không bị coi là đã giải quyết nhờ đổi số phiên bản.

## Checklist bàn giao Terra còn mở

- [ ] Tạo public/private từng game; sửa settings trước trận, reset ready; join trực tiếp và race lúc phòng đầy/bắt đầu. Private/full/playing không xuất hiện trong directory.
- [ ] Target 10/50, thắng +10 đúng một lần; dưới target tự nối ván sau 3 giây, đạt target dừng; rời/kick/grace trong countdown hủy đúng.
- [ ] UNO 2–6 người: stacking bật/tắt, timeout loại/chờ, người còn lại tiếp tục; bài không hợp lệ bị chặn, không lộ mặt bài đối thủ; khay thông báo và ghế không chồng khi tên dài/nhiều bài.
- [ ] Nối từ: draft/vote chấp nhận/bác/timeout, chịu thua, người bị loại chờ và những người còn lại chơi tiếp; IME và chữ vỡ tại active row vẫn đúng.
- [ ] Caro bàn 9/15/19, mục tiêu 4/5/6, chọn ô hai lần, kéo/zoom/bàn phím, timeout/resign và đổi X/O ván sau.
- [ ] Sound bật/tắt/volume, tiếng phạt/nhận, rung theo số lá, reduced motion độc lập mute; không lặp khi tab ẩn/reconnect. Kiểm tra desktop và điện thoại thật.
- [ ] Hai client/thiết bị với session độc lập; reconnect/reload/kick/grace, socket cũ mất quyền, privacy, focus/keyboard/screen reader; HTTPS/WSS hosting thật và tải đồng thời.

Tài liệu đã gom theo yêu cầu; xóa hai summary trung gian đã được thay thế. Đợt dọn tài liệu không chạy lại game test/build và không thay đổi kết luận QA ở trên.
