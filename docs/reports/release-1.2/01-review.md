# Kiểm định trước khi commit bản 1.2

Ngày 18/11/2026. Phạm vi: working tree hiện tại, tích hợp Bắn tàu và các sửa chữa hiệu ứng gần đây trên nền Fix 1.1. Đây là báo cáo kiểm tra, không phải chứng nhận Terra nghiệm thu. Sau kiểm định, người dùng đã giao sửa hai lỗi hiệu ứng bên dưới; source đã sửa và chạy hồi quy. Chưa đổi version, stage, commit, push hoặc deploy.

## Kết luận

Hai lỗi trình bày đã được sửa sau khi người dùng duyệt. Hồi quy mới đạt 188/188 test trong 18 file; build/typecheck đạt. Metadata vẫn ghi 1.1.0 và cần đưa đủ file mới vào commit. Đánh giá này không thay thế kiểm tra browser/điện thoại và hosting thật.

## Kết quả sửa hai lỗi

- `src/styles/bantau.css`: keyframes nước/nổ chuyển `background-position` từ 0% tới 100% bằng steps 7/9 tương ứng 8/10 frame; giữ mốc rơi 280 ms, thời gian nổ 420/520 ms và lửa sau nổ.
- `src/bantau/presentation-clock.ts`: neo `serverNow` từ snapshot vào `performance.now()`. Snapshot trễ không quay ngược clock; reset khi đổi room/game hoặc reconnect. Event được quy đổi một lần thành `startedAt`/`expiresAt` trên đồng hồ monotonic; snapshot sau không khởi động lại event hoặc kéo dài TTL.
- `src/App.tsx` và `src/bantau/BantauTable.tsx`: TTL, progress rơi/nổ/lửa và sound cùng dùng timeline monotonic này, không so timestamp server với giờ hệ thống của điện thoại. Không sửa timer nghiệp vụ/backend.
- Thêm 5 test có ý nghĩa: lệch giờ ±2 phút, đổi giờ giữa event, event trễ/hết hạn, snapshot trễ, reconnect/tái neo và timeline event ổn định. Full suite `npm test` với loopback đạt **188/188 trong 18 file**; `npm run build` gồm typecheck đạt; `git diff --check` sạch. Build còn cảnh báo Zod/chunk như trước.
- Chưa kiểm tra lại animation bằng browser hoặc thiết bị thật trong lượt sửa này.

Các phát hiện bên dưới mô tả trạng thái trước bản sửa, được giữ để đối chiếu.

## Các phát hiện cần xử lý

### P2 — Sprite nổ và nước chưa chạy các frame — đã sửa

`src/styles/bantau.css:180–185`: splash/explosion đã khai báo sprite sheet 8/10 frame và `steps()`, nhưng keyframes tương ứng chỉ đổi `opacity`, không đổi `background-position`. Vì vậy background luôn giữ frame đầu thay vì diễn hoạt cả sprite sheet. `fire` đã có keyframe chuyển background-position riêng nên không mắc cùng lỗi. Hướng sửa: đưa background-position từ frame đầu tới frame cuối vào keyframes nổ/nước; giữ nguyên delay, tọa độ và mốc hiện lửa sau nổ. Đây là phát hiện tĩnh từ CSS, chưa chạy browser để ghi hình.

### P2 — Đồng hồ thiết bị có thể làm mất hoặc lệch trình tự hiệu ứng — đã sửa

`src/App.tsx:213`, `src/bantau/BantauTable.tsx:173,261–267`: timestamp do server cấp đang được so sánh trực tiếp với `Date.now()` của thiết bị. Ví dụ server gửi event có TTL 1.200 ms nhưng điện thoại nhanh hơn server 2 giây: event mới tới bị bỏ vì bị coi là hết hạn, không có thủy lôi/nổ/sound. Nếu lệch dưới TTL, phần rơi có thể bị nhảy qua. Hướng sửa: dùng mốc thời gian server ước lượng từ snapshot `serverNow` và thời điểm nhận local, áp dụng thống nhất cho TTL, progress, sound và lửa; không đổi timer nghiệp vụ. Chưa tái hiện bằng thiết bị lệch đồng hồ trong lượt này.

### Metadata phát hành vẫn là 1.1.0

`package.json:4`, hai mục version gốc của `package-lock.json`, dòng đầu phiên bản trong README và trạng thái AGENTS vẫn ghi Fix 1.1. Nếu đặt tên phát hành 1.2, cần đồng bộ root metadata thành 1.2.0 và tài liệu hiện hành sau khi xử lý phát hiện trên. Package workspace có version riêng 0.1.0 không bắt buộc tăng theo root.

### Cần đưa đủ file mới vào commit

`packages/bantau/`, `src/bantau/`, `src/styles/bantau.css`, `packages/shared/src/bantau-public-game-schema.ts`, asset `public/assets/bantau/` và hồ sơ Bắn tàu hiện chưa được Git theo dõi. Chỉ commit tracked diff sẽ thiếu engine/schema/UI/asset và có thể làm bản clone/build mới hỏng. Không stage trong lượt kiểm tra này. `git ls-files` không thấy `.env`, `.env.local`, `.aws`, `.codex`, `node_modules` hoặc `dist` đã được theo dõi.

## Kiểm chứng thực tế ngày 18/11/2026

| Lệnh/kiểm tra | Kết quả |
|---|---|
| `npm test` trong sandbox | 171/183 đạt; 12 test HTTP/realtime không mở loopback được, `listen EPERM 127.0.0.1` |
| `npm test` chạy lại với quyền loopback | **183/183 đạt trong 17 file**, exit 0 |
| `npm run build` | Đạt; gồm `tsc -b`, typecheck backend và Vite build |
| `git diff --check` | Đạt |
| Smoke server dùng `dist/` trong chế độ production local | `/health`, `/api/games`, `/`, asset tàu carrier và explosion sheet đều HTTP 200 |
| Catalog production local | UNO, Nối từ, Caro, Bắn tàu đều `available:true` |

Smoke test dùng cổng loopback tạm và dọn server sau khi xong, không động tới tiến trình dev đang chạy. Không chạy `npm ci` trong lượt này; chưa kiểm chứng cài mới trên clean checkout.

Build còn cảnh báo annotation Zod và chunk JS 543.59 KB (gzip 160.66 KB); CSS 146.54 KB. Đây không phải lỗi build. Full suite có engine/projection, room/session, timer/countdown, origin và hai socket độc lập; test realtime Bắn tàu hiện tới phát trượt đầu tiên, không chứng minh toàn bộ trận thắng trên UI.

## Rà soát các sửa chữa gần đây

- Sprite impact có offset hàng và cột của phát bắn.
- Torpedo kết thúc với opacity 0; nổ/nước dùng `forwards` để không hiện khung đầu trong thời gian chờ rơi.
- Lửa mới có delay 700 ms khi hit và 800 ms khi sunk, sau flight 280 ms + thời gian nổ 420/520 ms.
- Class trúng của bảng mình bị giới hạn `kind === 'own'`; class hit/sunk của biển đối thủ bị giới hạn `kind === 'target'`. Không còn dùng ownHits để tô biển đối thủ.
- Projection server chỉ gửi fleet của chủ snapshot và footprint tàu địch đã chìm; test privacy hiện đạt.

Các mục này đã rà source và build; chưa kiểm tra hình ảnh chuyển động trên browser trong lượt này. Xác nhận trải nghiệm mới nhất của người dùng được ghi nhận riêng, không gọi là Terra nghiệm thu.

## Phần còn cần thử trực tiếp

- Hai thiết bị trên hosting thật: một ván thắng, +10, countdown, ván tiếp và kết thúc trận.
- Kéo/xoay tàu trên điện thoại, lỗi placement, reload/reconnect trong setup và đang bắn.
- Chuỗi rơi → chạm → nổ tắt → cháy, miss sạch, bảng nhỏ/lớn không lẫn dấu trúng; âm thanh, reduced motion và lệch đồng hồ thiết bị.
- Không làm mới/đánh dấu đã đạt các kết quả browser ở hồ sơ cũ. Chưa có Terra approval cho bản 1.2.
