# Bàn Bạn — UNO trực tuyến

Bản MVP chơi UNO tùy chỉnh **BB-UNO-1** cùng bạn bè bằng mã phòng. Giao diện và thông báo bằng tiếng Việt. Đây là dự án không chính thức, tự vẽ lá bài, không liên kết với Mattel. Bộ bài 108 lá tham khảo W2085; luật cộng dồn, +4 tự do và Reverse hai người là lựa chọn riêng của Bàn Bạn. Đặc tả tại [docs/uno-rules.md](docs/uno-rules.md).

## Công nghệ

- Frontend: React, TypeScript, Vite và CSS tokens.
- Realtime: Node.js, TypeScript và Socket.IO.
- Logic UNO thuần TypeScript trong `packages/uno`; schema và kiểu chia sẻ trong `packages/shared`.
- Phòng và phiên nằm trong RAM backend. Không tài khoản, database, bot, chat hoặc lịch sử lâu dài.

Yêu cầu Node.js **20.19+** hoặc **22.12+**. Đã chạy với Node `v26.4.0` và npm `11.7.0`.

## Cài đặt và chạy dev

```sh
npm ci
npm run dev
```

Mở `http://localhost:5173`. Vite phục vụ giao diện, chuyển `/socket.io`, `/api` và `/health` đến backend ở cổng `3001`.

`.env.example` liệt kê cấu hình backend. Muốn dùng file, chạy `cp .env.example .env`, rồi nạp bằng `set -a; source .env; set +a` trên macOS/Linux trước lệnh dev/start. File `.env` không được tự nạp. Trên Windows, đặt các biến môi trường trong PowerShell.

## Thử trên điện thoại cùng Wi-Fi

1. Cho phép kết nối qua firewall của máy chạy web.
2. Tìm IP LAN của máy đó (macOS thường dùng `ipconfig getifaddr en0`; Windows dùng `ipconfig`).
3. Trên điện thoại mở `http://<IP-LAN>:5173`. Điện thoại và máy tính cần cùng mạng Wi-Fi; một số mạng khách chặn thiết bị nhìn thấy nhau.
4. Tạo phòng công khai hoặc riêng tư trên một thiết bị, rồi nhập mã 6 ký tự trên thiết bị kia.

Dev server và backend mặc định bind `0.0.0.0`; không cần đưa cổng backend trực tiếp ra Internet. Link mời giữ origin mà người tạo đang mở và chỉ điền sẵn mã; người nhận vẫn bấm “Vào phòng”.

## Kiểm tra và build

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm start` chạy backend ở cổng `3001`, phục vụ `dist/`, `/health`, `/api/rooms` và Socket.IO trên cùng origin. Mở `http://localhost:3001`. Có thể đổi `HOST` và `PORT` qua biến môi trường.

Để thử thêm quyền origin trong production, đặt `ALLOWED_ORIGINS` thành danh sách origin cách nhau bằng dấu phẩy, ví dụ `https://game.example.com`. Không mở nhiều replica: trạng thái phòng chỉ có trong RAM của một process.

## Luồng chơi

- Trang chủ có thẻ UNO và ô nhập mã; chọn UNO để tạo phòng, chọn công khai/riêng tư.
- Phòng công khai hiện trong danh sách để người chơi chép mã; không tự ghép trận hoặc vào thẳng phòng. Phòng riêng tư không hiện trong danh sách.
- Phòng cần ít nhất 2 người và có tối đa 6. Khách bấm “Sẵn sàng”; chủ phòng bắt đầu khi mọi khách đang kết nối và sẵn sàng. Không cần đủ 6 ghế.
- Chủ phòng có thể mời người chơi ra. Nếu ván đang diễn ra, hành động đó hủy ván và đưa người còn lại về phòng chờ.
- Reload/mất mạng ngắn dùng token nối lại trong localStorage để về đúng ghế. Ghế offline được giữ 90 giây; hết hạn thì hủy ván đang chơi. Server khởi động lại làm mất toàn bộ phòng và phiên.
- Kết thúc ván, chủ phòng có thể bắt đầu lượt chơi mới trong cùng phòng.

## Luật UNO

Bộ 108 lá tham khảo UNO W2085 của Mattel. Luật đang chạy là BB-UNO-1, có cộng dồn +2/+4, +4 tự do không challenge, Reverse hai người như Skip và kết thúc phạt cuối. Không jump-in hoặc đánh nhiều lá. Xem [hồ sơ luật](docs/uno-rules.md).

## Tài liệu

- [Hồ sơ luật và nguồn](docs/uno-rules.md)
- [Đặc tả sản phẩm](docs/product-spec.md)
- [Kiến trúc hiện tại](docs/architecture.md)
- [Phòng và phần dùng lại](docs/rooms-and-reuse.md)
- [Thiết kế UI/UX](docs/ui-ux.md)
- [Báo cáo kiểm chứng](docs/verification-report.md)
- [Báo cáo Sol và gói bàn giao cho Terra](docs/sol-uno-fix-report.md)
- [Kiến trúc và checklist nghiệm thu Sol](docs/sol-handoff.md)
- [Kế hoạch motion UNO](docs/uno-motion-plan.md)
- [Prompt triển khai motion UNO](docs/uno-motion-prompt.md)
- [Báo cáo triển khai và checklist cho Terra](docs/uno-motion-report.md)
- [Kế hoạch motion v2](docs/uno-motion-v2-plan.md)
- [Prompt Luna motion v2](docs/luna-uno-motion-v2-prompt.md)
- [Báo cáo Terra motion v2](docs/uno-motion-v2-report.md)

## Giới hạn

Đây là MVP một process, trạng thái chỉ trong RAM. Khi process dừng hoặc deploy lại, phòng đang chơi mất. Chưa có hosting công khai, database, tài khoản, spectate, bot hoặc hệ thống nhiều backend. Báo cáo kiểm chứng ghi rõ những gì đã chạy và phần chưa kiểm tra bằng trình duyệt/điện thoại thật.
