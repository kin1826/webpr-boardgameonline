# Hội Quậy — UNO, Nối từ và Caro trực tuyến

Phiên bản **Fix 1.1 (`v1.1.0`)** — bản cập nhật dành cho CLB chơi thử. Xem [đánh giá, thay đổi và kiểm chứng phát hành](docs/reports/fix-1.1/summary.md).

Bản MVP chơi UNO tùy chỉnh **BB-UNO-1**, Nối từ **NT-VI-1** và Caro **HQ-CARO-1** cùng bạn bè bằng mã phòng. Caro chơi đúng 2 người; UNO/Nối từ chơi 2–6 người. Giao diện và thông báo bằng tiếng Việt. Đây là dự án không chính thức, không liên kết với Mattel. Xem [luật UNO](docs/uno-rules.md), [luật Nối từ](docs/noitu-rules.md) và [luật Caro](docs/caro-rules.md).

## Công nghệ

- Frontend: React, TypeScript, Vite và CSS tokens.
- Realtime: Node.js, TypeScript và Socket.IO.
- Logic game tách riêng trong `packages/uno`, `packages/noitu` và `packages/caro`; schema và catalog trong `packages/shared`.
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
4. Tạo phòng trên một thiết bị. Người chơi khác có thể vào bằng mã hoặc chọn thẳng phòng công khai trong sảnh.

Dev server và backend mặc định bind `0.0.0.0`; không cần đưa cổng backend trực tiếp ra Internet. Link mời giữ origin mà người tạo đang mở và chỉ điền sẵn mã; người nhận vẫn bấm “Vào phòng”.

## Kiểm tra và build

```sh
npm run typecheck
npm test
npm run build:client
npm run build
npm start
```

`npm start` chạy backend ở cổng `3001`, phục vụ `dist/`, `/health`, `/api/rooms`, `/api/games` và Socket.IO trên cùng origin. Mở `http://localhost:3001`. Có thể đổi `HOST` và `PORT` qua biến môi trường.

Để giới hạn truy cập browser trong production, đặt `ALLOWED_ORIGINS` ở backend thành danh sách origin cách nhau bằng dấu phẩy, ví dụ `https://game.example.com`. Cấu hình này dùng chung cho HTTP API và Socket.IO. Không mở nhiều replica: trạng thái phòng chỉ có trong RAM của một process.

## Deploy frontend Vercel và backend Node riêng

Repo đã có `vercel.json`. Tạo project Vercel từ **root repo** và dùng:

- Install: `npm ci`
- Build: `npm run build:client`
- Output: `dist`
- Environment variable khi build: `VITE_BACKEND_URL=https://<domain-backend>`

`VITE_BACKEND_URL` là cấu hình public được nhúng vào JavaScript lúc build, không đặt token hoặc secret vào biến này. Khi đổi URL phải build lại frontend. Với deploy Vercel, đặt URL HTTPS của backend; không để trống vì Vercel không có API/Socket.IO backend của dự án. `vercel.json` không rewrite `/api` hay `/socket.io`.

Deploy backend từ **cùng root repo** lên một dịch vụ Node.js có WebSocket và giữ cả workspace cùng `data/word-chain/`. Cài bằng `npm ci`, chạy `npm start`, đặt `NODE_ENV=production`, `HOST=0.0.0.0`, dùng `PORT` do host cấp và đặt `ALLOWED_ORIGINS=https://<domain-frontend>` (thêm custom domain nếu có). Không đưa domain preview vào allowlist production trừ khi chủ động muốn cho preview truy cập backend. Backend hiện cần một process chạy liên tục; restart làm mất phòng và phiên.

Vercel chỉ host static frontend trong cấu hình này. Backend phải phục vụ HTTPS/WSS; host cần giữ WebSocket upgrade cho `/socket.io`. Không bật nhiều instance/replica và không cần database cho MVP RAM hiện tại. Health check backend: `/health`.

## Luồng chơi

- Trang chủ có thẻ UNO, Nối từ, Caro, ô nhập mã và danh sách phòng công khai đang chờ. Chọn một phòng công khai để vào trực tiếp; phòng riêng chỉ vào bằng mã/link.
- Khi tạo phòng, panel cài đặt cho chọn công khai/riêng tư, mục tiêu trận, thời gian mỗi lượt và tùy chọn riêng của game. Chủ phòng có thể chỉnh trước khi bắt đầu; khách cần sẵn sàng lại sau khi cấu hình đổi.
- UNO/Nối từ hỗ trợ 2–6 người. Caro yêu cầu đúng 2 người. Khách bấm “Sẵn sàng”; chủ phòng bắt đầu khi đủ người, mọi khách đang kết nối và đã sẵn sàng.
- Chủ phòng có thể mời người chơi ra. Nếu trận đã bắt đầu, thay đổi roster sẽ hủy trận đang chạy.
- Reload/mất mạng ngắn dùng token nối lại trong localStorage để về đúng ghế. Ghế offline được giữ 90 giây; hết hạn thì áp dụng xử lý disconnect/timeout của game. Server khởi động lại làm mất toàn bộ phòng và phiên.
- Mỗi ván thắng cộng 10 điểm vào trận. Nếu chưa đạt mục tiêu, server tự bắt đầu ván tiếp theo sau 3 giây; không cần sẵn sàng lại. Người chơi có thể rời trong countdown, khi đó trận/countdown bị hủy.
- Hiệu ứng âm thanh bật sau tương tác đầu tiên, có công tắc và âm lượng riêng trên thiết bị; tùy chọn lưu cục bộ.

## Luật UNO

Bộ 108 lá tham khảo UNO W2085 của Mattel. Luật đang chạy là BB-UNO-1, có thể bật/tắt cộng dồn +2/+4 theo cài đặt phòng; +4 tự do không challenge, Reverse hai người như Skip. Bàn bắt đầu trống; đánh hợp lệ lá cuối là thắng ngay, kể cả +2/+4. Không jump-in hoặc đánh nhiều lá. Hết giờ thì người chơi bị loại khỏi ván và chờ ván sau. Bàn không gợi ý lá hợp lệ; server vẫn xác thực mọi nước đi. Xem [hồ sơ luật](docs/uno-rules.md).

## Nối từ

NT-VI-1 dùng từ mồi được server chọn, tiếng cuối khóa ở input, thời gian lượt theo cài đặt phòng (mặc định 30 giây), người chịu thua/hết giờ bị loại và người cuối thắng. Từ chưa có trong playable list được đưa ra vote nhóm 15 giây; giới hạn hai đề xuất lạ mỗi lượt. Người bị loại chờ ván tiếp theo; những người còn active tiếp tục. Chi tiết ở [docs/noitu-rules.md](docs/noitu-rules.md).

## Caro

HQ-CARO-1 chơi đúng 2 người. Chủ phòng chọn bàn 9×9, 15×15 hoặc 19×19, mục tiêu nối đúng 4, 5 hoặc 6 quân và thời gian lượt. Chọn một ô rồi kích hoạt cùng ô lần nữa để đánh; server xác nhận nước đi và thắng/thua theo luật hiện hành. Chi tiết ở [docs/caro-rules.md](docs/caro-rules.md).

Từ điển đang là snapshot thử nghiệm 47.877 mục. Bộ nguồn chưa được rà nghĩa toàn tập và quyền phân phối dữ liệu chưa được xác minh theo từng nguồn; không nên phân phối bộ từ này công khai trước khi giải quyết. Nếu nạp/hash dữ liệu lỗi, Nối từ bị tắt riêng, UNO vẫn hoạt động. Dữ liệu, provenance và cách tái tạo nằm ở `data/word-chain/`.

## Tài liệu

[Mục lục docs](docs/README.md) · [Bản Fix 1.1 và kiểm chứng](docs/reports/fix-1.1/summary.md)

- [Tóm tắt dự án, lịch sử và kết quả kiểm chứng](docs/reports/project-summary.md)
- [Tổng kết Fix 1.1 và bàn giao Terra](docs/reports/fix-1.1/summary.md)
- [Luật BB-UNO-1 và nguồn tham khảo](docs/uno-rules.md)
- [Luật NT-VI-1](docs/noitu-rules.md)
- [Luật HQ-CARO-1](docs/caro-rules.md)
- [Dữ liệu từ điển Nối từ và giới hạn giấy phép](data/word-chain/README.md)
- [Báo cáo triển khai Nối từ cho Terra](docs/reports/noitu/summary.md)
- [Báo cáo triển khai Caro](docs/reports/caro/summary.md)
- [Đặc tả sản phẩm](docs/product-spec.md)
- [Kiến trúc](docs/architecture.md)
- [Phòng chơi và tái sử dụng](docs/rooms-and-reuse.md)
- [UI/UX hiện hành](docs/ui-ux.md)
- [Vận hành và triển khai](docs/operations.md)
- [Kế hoạch kiểm thử](docs/test-plan.md)

Bắt đầu tính năng mới thì tạo hồ sơ riêng trong `docs/reports/<ten-tinh-nang>/`, ví dụ `docs/reports/noitu/`. Trong lúc làm, lưu kế hoạch, báo cáo code và QA theo từng chặng ở đó; khi hoàn tất mới hợp nhất thành một `summary.md`, dọn các file trung gian và cập nhật liên kết từ bản tóm tắt dự án. Quy trình chi tiết nằm trong `AGENTS.md`.

## Giới hạn

Đây là MVP một process, trạng thái chỉ trong RAM. Khi process dừng hoặc deploy lại, phòng đang chơi mất. Chưa có database, tài khoản, spectate, bot hoặc hệ thống nhiều backend. Bản Fix 1.1 cần Terra nghiệm thu độc lập; xem [tổng kết và checklist](docs/reports/fix-1.1/summary.md) để biết kiểm tra nào đã chạy, phần nào còn thiếu.
