# Bàn giao từ Luna cho Terra

> Bản bàn giao lịch sử trước thay đổi BB-UNO-1. Sol đã triển khai luật mới và cập nhật source; Terra chưa nghiệm thu đợt đó. Xem kết quả hiện hành trong `sol-uno-fix-report.md` và checklist tại `sol-handoff.md`. Không dùng các xác nhận Classic/challenge bên dưới để nghiệm thu luật mới.

Trạng thái: Luna đã triển khai MVP UNO realtime. Tài liệu này giúp Terra đọc source và nghiệm thu độc lập; không phải xác nhận Terra đã review hoặc approve.

## Đã triển khai

- UNO Classic W2085-0629: bộ bài 108 lá, setup và luật action/challenge/UNO trong `packages/uno`.
- Server là nguồn sự thật: tạo mã, public/private, ready/start, kick/leave/rematch, phiên reconnect, revision, idempotency, xác thực game action và projection riêng từng người.
- Frontend có nhập mã, tạo phòng sau khi chọn UNO, directory công khai, lobby và bàn lấy state qua Socket.IO. Bàn “Xem thử” là luồng tách biệt, không giả làm multiplayer.
- Mọi phòng ở RAM. Restart server mất phòng. Host kick trong ván hủy ván.

## Đọc source theo thứ tự

1. `docs/uno-rules.md` — nguồn Mattel, luật được chọn và các quyết định số hóa.
2. `packages/uno/src/index.ts` — engine, validation, projection riêng tư.
3. `packages/shared/src/index.ts` — DTO và schema Zod.
4. `server/src/rooms.ts` — trạng thái room/session và quyền host.
5. `server/src/index.ts` — Socket.IO, auth từng hành động, ack, revision và broadcast.
6. `src/App.tsx` cùng `src/styles/` — tạo/join, lobby, bàn live, bàn preview và giao diện.
7. `docs/verification-report.md` — lệnh đã chạy và giới hạn.

## Chạy và xem kiểm tra

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm start
```

Vào `http://localhost:5173` khi dev hoặc `http://localhost:3001` sau build. Test Socket.IO mở loopback nên một số sandbox cần quyền mạng cục bộ; xem kết quả chạy thật trong verification report.

## Checklist nghiệm thu cho Terra

- Kiểm tra mọi intent server-side: sai lượt, stale revision, action ID trùng, socket/generation cũ, host-only, target kick và payload sai.
- Đối chiếu từng case W2085 ở `uno-rules.md`, nhất là WDF chỉ đánh khi không giữ màu hiện hành, challenge, UNO trước lượt kế, lá cuối +2/+4 và cách tính 2 người.
- Duyệt packet/event để chắc chắn không có tay bài đối thủ, thứ tự chồng rút hoặc dữ liệu bí mật challenge.
- Mở hai browser profile/localStorage tách biệt; chạy tạo → nhập mã → ready → start → đánh/rút/chọn màu → UNO/challenge → hết bài → rematch.
- Thử kick/reconnect/disconnect, public-private, host leave, 2/3/4/5/6 người, browser resize 1440×900/390×844, keyboard và reduced motion.
- Đọc giới hạn dưới đây trước khi đánh dấu nghiệm thu.

## Giới hạn đã biết

- Socket integration dùng hai client thật và fixture test-only để ván kết thúc nhanh; chưa chạy một ván production shuffle thật qua giao diện.
- Browser access host không khả dụng khi Luna kiểm tra; chưa xác minh ảnh, hai browser context hoặc điện thoại thật/LAN.
- Chưa có hosting public. Một process và RAM-only; deploy/restart xóa toàn bộ phòng.
- Ma trận timeout, rate-limit/cache boundary và nhiều lỗi reconnect chưa bao phủ hết.
- Thư mục này không có `.git`; không có commit hash để đối chiếu. Chưa có review/approval của Terra.

Kết quả chi tiết: [verification-report.md](./verification-report.md). Quyết định luật: [uno-rules.md](./uno-rules.md). Vận hành: [README.md](../README.md).
