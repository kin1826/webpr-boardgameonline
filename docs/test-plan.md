# Kế hoạch kiểm thử và bằng chứng

Luật có thẩm quyền là [BB-UNO-1](./uno-rules.md); ma trận bắt buộc ở [uno-fix-plan.md](./uno-fix-plan.md). Kết quả thực chạy trong [sol-uno-fix-report.md](./sol-uno-fix-report.md). Hồ sơ test Classic cũ đã được thay thế, không dùng các expected về challenge/no stacking để nghiệm thu bản hiện tại.

Trạng thái kiểm thử Sol: `npm test -- --reporter=verbose` đạt 53/53 test trên 6 file; `npm run typecheck` và `npm run build` đạt. Hai client Socket.IO hoàn tất một ván production shuffle trong lần chạy cuối với 126 hành động (số bước thay đổi theo shuffle). Browser/mobile còn cần nghiệm thu thủ công; xem [gói Terra](./sol-handoff.md).

Đợt motion: `npm run typecheck` đạt; `npm test -- --reporter=dot` đạt 57/57 test trên 7 file khi cho phép loopback. Bổ sung schema/privacy cho `game:effect`, xác nhận event dedupe và chỉ chạy với snapshot trùng revision; production shuffle hai socket kết thúc sau 22 hành động ở lần chạy cuối (số bước đổi theo shuffle). Browser access host không khả dụng, chưa kiểm tra trình duyệt/thiết bị thật; report tại [uno-motion-report.md](./uno-motion-report.md).

Đợt motion v2: typecheck/build đạt; 58/58 test trên 7 file với loopback, gồm kiểm tra intensity tăng theo penalty và capped; ván hai socket kết thúc sau 12 hành động ở lần chạy này. Chưa kiểm tra UI trực quan do browser access host unavailable; xem [uno-motion-v2-report.md](./uno-motion-v2-report.md).

Đợt motion v3: `npm run typecheck`, `npm run build`, toàn bộ 59/59 test (7 file) và test mục tiêu `src/game-effects.test.ts` (5/5) đạt. Ba test realtime cần quyền loopback; chạy mặc định trong sandbox bị `listen EPERM`, chạy lại với loopback thì đạt. Trình duyệt tích hợp vẫn báo browser access host unavailable; UI desktop/mobile, thao tác chạm và video chuyển động chưa được kiểm tra trực quan. Chi tiết ở [uno-motion-v3-report.md](./uno-motion-v3-report.md).

## Test tự động đã có

- `packages/uno/src/index.test.ts`: bộ 108 lá, setup/chia, dealer, Wild mở đầu, lượt/rút, Reverse 2 người, Wild và UNO.
- `packages/uno/src/custom-rules.test.ts`: màu theo lá vừa đánh, số/ký hiệu match, sai màu không đổi state, Reverse 2–6, cộng 2→2→4→4, +4 tự do, từ chối +4→+2, nhận dù có lá cộng, lá cuối +2/+4, recycle/cạn bài.
- `packages/shared/src/index.test.ts`: payload có gameId, validation strict, loại intent challenge cũ, schema room-close.
- `server/src/rooms.test.ts`: start 2–6, public/private, ready/kick/reconnect và event room changed/closed.
- `server/src/realtime.test.ts`: hai socket join/ready/start, privacy/idempotency, illegal color/revision, cộng/nhận, host reload/resume, rematch/gameId mới, thông báo shutdown; một ván production shuffle kết thúc qua hai socket và bảo toàn 108 ID mỗi nước.
- `src/action-id.test.ts`: hồi quy UUID cho HTTP LAN.

## Browser và thiết bị

Browser access host báo unavailable trong phiên Sol; chưa kiểm tra bằng hai browser profile, chưa chụp UI 360/390/1440px và chưa thao tác keyboard/reduced motion trực quan. Chưa thử điện thoại thật/LAN. Socket test hai client chứng minh backend hành trình thật, nhưng không thay thế nghiệm thu giao diện.

## Lệnh

```sh
npm run typecheck
npm test
npm run build
```

Chạy lệnh trong đúng workspace. Socket.IO integration cần quyền mở loopback ở một số sandbox. Ghi trạng thái `BLOCKED` khi browser/thiết bị không có, không ghi nhận hoàn tất từ code review.
