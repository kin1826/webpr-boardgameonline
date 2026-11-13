# Gói bàn giao Terra — BB-UNO-1

Đợt triển khai Sol đã hoàn tất phần source và tự kiểm tra. Đây là handoff để Terra nghiệm thu độc lập; **không phải xác nhận đã được Terra approve**. Luật đích là [BB-UNO-1](./uno-rules.md). Xem kết quả lệnh thực chạy trong [báo cáo Sol](./sol-uno-fix-report.md).

## Thứ tự đọc source

1. `packages/uno/src/index.ts` — bộ bài, setup, lượt, legality, penalty state, transition, projection riêng tư.
2. `packages/uno/src/index.test.ts` và `custom-rules.test.ts` — luật nền và regression BB-UNO-1.
3. `packages/shared/src/index.ts` — Zod payload strict, DTO, `gameId`, intent hiện hành.
4. `server/src/rooms.ts` — ghế, host, reconnect/expiry, kick, room lifecycle.
5. `server/src/index.ts` — Socket.IO auth/session, idempotency/revision/game ID, per-player broadcast, close event.
6. `server/src/rooms.test.ts`, `server/src/realtime.test.ts`, `packages/shared/src/index.test.ts` — service, hai-client integration và privacy/lifecycle.
7. `src/App.tsx`, `src/styles/app.css`, `src/styles/theme.css` — thao tác bàn/UI; server `allowedActions` quyết định lá có thể bấm.
8. `README.md`, `docs/uno-rules.md`, `docs/verification-report.md` — chạy app, luật và bằng chứng/giới hạn.

## Lệnh đã dùng

```sh
npm run typecheck
npm test -- --reporter=verbose
npm run build
HOST=127.0.0.1 PORT=4315 npm start
```

Test suite yêu cầu cho phép bind socket loopback cục bộ. Production smoke trên cổng 4315 đã gọi `/`, `/health`, `/api/rooms`, `/socket.io/?EIO=4&transport=polling` và xác nhận HTTP 200.

## Checklist nghiệm thu độc lập

- [ ] Đối chiếu từng chuyển trạng thái với `uno-rules.md`; đặc biệt +2→+2/+4, +4→chỉ +4, có thể nhận dù có lá cộng, lá cuối phạt chờ nhận rồi mới thắng.
- [ ] Kiểm tra đỏ 5→xanh 9 bị từ chối và không đổi state; đỏ 5→xanh 5 hợp lệ, bàn chuyển xanh.
- [ ] Kiểm tra Reverse với 2, 3 và 4+ người; server đổi hướng trước khi chọn ghế kế.
- [ ] Kiểm tra Wild bắt buộc chọn màu và mọi client nhận cùng snapshot; kiểm tra stale `gameId`, revision và action lặp.
- [ ] Xác nhận host reload/resume giữ đúng ghế/game, socket cũ mất quyền; expiry/room close báo cho thành viên còn online.
- [ ] Soát projection/event để xác nhận không có tay bài đối thủ hoặc thứ tự chồng rút; kiểm tra client không tự quyết định lá hợp lệ.
- [ ] Chạy app trên hai browser profile độc lập: tạo phòng → join bằng mã → ready → start → đánh/rút/chọn màu → nhận/cộng phạt → hết ván → rematch.
- [ ] Kiểm tra UI 1440 px và 390 px, không tràn ngang; thử keyboard/focus, reduced motion, nút/chạm trên mobile.
- [ ] Thử điện thoại cùng Wi-Fi vào phòng bằng mã nếu thiết bị sẵn có.

## Giới hạn và lưu ý

- Browser access host không khả dụng khi Sol làm việc; vì vậy các checklist browser/mobile còn mở. Socket integration xác nhận server chứ không thay nghiệm thu UI.
- Production-shuffle round tự động chạy qua hai Socket.IO client; lần chạy cuối kết thúc trong 126 hành động (một lần trước là 39), winner được xác định; tổng bài và privacy được assert trong từng bước.
- Dữ liệu phòng chỉ trong RAM của một process; restart server mất phòng. Không có persistence hoặc multi-process adapter.
- Đọc kết quả Terra cũ trong `terra-test-report.md` như báo cáo độc lập ở thời điểm trước BB-UNO-1, không dùng làm kết luận cho bản này.
