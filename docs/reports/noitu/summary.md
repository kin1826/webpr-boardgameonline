# Tổng kết Nối từ — NT-VI-1

Cập nhật 14/11/2026. Người dùng xác nhận bản sửa giao diện mới nhất đã ổn và yêu cầu gom hồ sơ. Code và kiểm tra tự động đã hoàn thành; **Terra chưa nghiệm thu độc lập**. File này thay thế 13 kế hoạch, prompt và báo cáo trung gian của đợt Nối từ.

## Hành vi hiện tại

- Chơi realtime 2–6 người, dùng chung phòng, mã tham gia, public/private, ready, host/kick và reconnect với UNO. Server quyết định luật và kết quả; phòng nằm trong RAM.
- Server chọn người mở đầu và từ mồi. Tiếng cuối được khóa làm prefix; người chơi nhập một tiếng để ghép từ hai tiếng. Chuẩn hóa NFC, giữ dấu; không dùng lại từ đã nhận hoặc từ vừa bị bác trong lượt.
- Từ hợp lệ trong bộ từ được nhận ngay. Từ ngoài bộ từ được nhóm vote 15 giây; người gửi không tự vote, cần quá nửa toàn bộ người có quyền. Hòa/hết giờ thiếu đa số thì bác; tối đa hai đề xuất lạ mỗi lượt. Bác không đổi lượt hoặc reset thời gian còn lại.
- Lượt 30 giây; chịu thua/hết giờ bị loại, người cuối thắng. Mất kết nối tạm dừng; quá 90 giây hoặc có người rời/kick thì hủy ván. Host có thể chơi lại.
- Luật đầy đủ và có thẩm quyền: [NT-VI-1](../../noitu-rules.md). UNO giữ [BB-UNO-1](../../uno-rules.md); bản sửa UUID cho HTTP LAN vẫn được giữ.

## UI và motion cần giữ

- Dải người chơi ở trên, timeline bubble ở giữa, dock nhập/vote ở dưới; tiếng Việt và input native hỗ trợ composition/IME. Chịu thua dùng dialog web có quản lý focus, Escape và chặn gửi lặp.
- **Một active row theo `gameId + turnId`** xuyên suốt nhập → vote → bác → nhập lại. Không dùng proposal ID làm key hàng, không thêm hàng rejected hoặc hẹn giờ xóa bubble. History chỉ nhận theo snapshot server.
- Ô chữ tách theo grapheme, giữ dấu và ID qua sửa chữ. Chữ mới nảy nhẹ, xóa có mảnh rơi; khi bác chỉ suffix vỡ đồng thời tại chỗ. Prefix/bubble giữ nguyên, nhập mới không bị cleanup cũ xóa.
- Mảnh suffix nằm ngoài flow và ngoài vùng cuộn chữ, tối đa 18 ô mỗi đợt; cleanup theo rejection ID. Nếu vote/reject tới nhanh, dùng dữ liệu proposal để đo vị trí dự phòng thay vì yêu cầu proposal đã kịp xuất hiện trong DOM. Accept, reconnect/rematch không replay hiệu ứng.
- Hàng active rộng tối đa 640 px trên desktop. Chữ nhập/vote giữ một dòng, dài thì cuộn ngang trong bubble; toàn trang không tràn ngang. Dock giữ chiều cao ổn định giữa nhập/vote. Reduced motion bỏ hiệu ứng.
- Timeline cuộn riêng bằng scrollTop, theo đáy khi đang chơi; cuộn lên chủ động giữ vị trí đọc và có nút về lượt hiện tại. ResizeObserver/visualViewport hỗ trợ bàn phím mobile. Không scrollIntoView kéo trang ngoài.

## Bản đồ source

| Phần | File chính |
|---|---|
| Engine thuần TS, projection | `packages/noitu/src/index.ts` và test cùng thư mục |
| Catalog, payload runtime, types | `packages/shared/src/index.ts` |
| Phòng/session, timer và Socket.IO | `server/src/rooms.ts`, `server/src/index.ts` và các test room/realtime |
| Nạp dictionary, kiểm tra manifest/hash | `server/src/noitu-dictionary.ts`, `scripts/build-playable-dictionary.py` |
| Route, snapshot/draft/rejection coordinator | `src/App.tsx` |
| Bàn, dialog, scroll và IME | `src/noitu/NoituTable.tsx`, `interaction-state.ts` |
| Grapheme, diff và fragment | `src/noitu/AnimatedWordTiles.tsx`, `word-tiles.ts` và test |
| Responsive, motion | `src/styles/app.css` |
| Kiểm tra DOM bằng Chrome | `tests/noitu-dom.html`, `scripts/test-noitu-dom.mjs` |

Không thêm thư viện motion. Đã tra Lucian nhưng không port component không phù hợp; tái sử dụng input/dialog và token hiện có.

## Bằng chứng kiểm tra đã ghi nhận

Đây là kết quả các lượt triển khai trước khi gom tài liệu, không phải chạy mới trong lượt gom.

| Kiểm tra | Kết quả gần nhất |
|---|---|
| `npm run typecheck` | Đạt client và server, 14/11/2026 |
| `npm test` | **112/112 test, 11 file**, 14/11/2026; socket tests cần quyền bind loopback |
| `npm run build` | Đạt, 164 modules; hai cảnh báo annotation Zod/Rollup không làm build thất bại |
| `node scripts/test-noitu-dom.mjs` | Đạt Chrome headless 1440/390/360 px và 390 px reduced motion |
| Dictionary build | 47.877 playable; hash/count tái tạo ổn định, đã chạy ngày 13/11/2026 |
| Production smoke | Ngày 13/11/2026, cổng 3002: `/`, `/health`, `/api/games`, `/api/rooms` trả đúng; hai game available |

DOM harness dùng snapshot fixture: kiểm tra một active li và cùng DOM node/bubble/prefix qua vote/reject/cleanup, mảnh đúng vị trí và có CSS animation trong vùng nhìn thấy, nhập lại/bác tiếp không mất chữ mới, chữ dài không wrap, fallback khi vote bị gộp, pause/resume, chuyển lượt và không tràn ngang. Đây không phải hai browser chơi qua server thật.

Suite server có hai Socket.IO client độc lập: create/join/ready/start, draft, vote accept, thắng/rematch, chặn action chéo game và hồi quy UNO. Engine/service tests cover 2–6 người, vote/quorum/timeout, deny/trùng/quota, deadline, pause/resume, privacy và session cleanup. Số test cũ 101/103/106/113 đã được thay bằng kết quả gần nhất; không cộng các số này.

## Giới hạn và phần Terra còn kiểm tra

- CUA browser host không khả dụng; Chrome headless chạy được. Chưa có nghiệm thu của agent bằng hai browser độc lập với server thật, iOS Safari/Android Chrome và bàn phím IME thật. Phản hồi mới nhất của người dùng là “đã ổn”, không thay thế kết luận Terra.
- Terra chạy hai phiên: known/unknown → accept/reject/vote timeout → nhập lại ngay khi mảnh rơi → thắng/rematch; thử 2–6 người, mất mạng/resume, đọc lịch sử, mobile 360/390 px, keyboard/focus và reduced motion. Smoke UNO và HTTP LAN trên hai thiết bị.
- Dictionary là thử nghiệm: 51.898 ứng viên, 4.021 quarantine, 47.877 playable, 29 seed. Mẫu semantic review 200 mục vẫn pending; quyền phân phối từng nguồn chưa xác minh. Không coi heuristic là kiểm định nghĩa. `lọc cọc` có trong bộ từ, không dùng nó làm mẫu unknown. Nguồn, manifest, hash, giấy phép và hàng đợi duyệt được giữ tại [hồ sơ dữ liệu](../../../data/word-chain/README.md).
