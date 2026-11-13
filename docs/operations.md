# Cài đặt và vận hành

Trạng thái: đã cấu hình và chạy build/production smoke test cục bộ.

## Môi trường

- Đã thử với Node `v26.4.0`, npm `11.7.0`; dự án yêu cầu Node 20.19+ hoặc 22.12+.
- npm workspaces dùng một `package-lock.json` ở root.
- Các biến mẫu nằm ở `.env.example`. File không tự được nạp; export biến trong shell trước khi chạy, hoặc dùng cơ chế env file của hệ thống deploy.

| Biến | Mặc định | Tác dụng |
|---|---:|---|
| `HOST` | `0.0.0.0` | Địa chỉ backend bind |
| `PORT` | `3001` | Cổng backend/production |
| `ALLOWED_ORIGINS` | rỗng | Danh sách origin production cách nhau bằng dấu phẩy |
| `RECONNECT_GRACE_MS` | `90000` | Thời gian giữ ghế offline |
| `WAITING_ROOM_TTL_MS` | `1800000` | Thời gian tối đa giữ phòng chờ không hoạt động |
| `MAX_ROOMS` | `2000` | Số phòng RAM tối đa |

Socket.IO event limit là 100 event/10 giây/socket; payload tối đa 16 KiB. Public directory trả tối đa 100 phòng chờ; action/request cache có trần 5.000 bản ghi và thời hạn 5 phút.

## Dev và LAN

`npm run dev` chạy Vite `0.0.0.0:5173` và backend `0.0.0.0:3001`. Vite proxy chuyển Socket.IO/WebSocket, `/api` và `/health`. Điện thoại trong cùng Wi-Fi mở `http://<IP-LAN>:5173`; firewall hoặc client isolation có thể chặn truy cập.

Link mời lấy origin từ trình duyệt hiện hành. Trên LAN, link sẽ mang IP LAN đang mở; không hardcode `localhost`. Link chỉ điền sẵn mã, người nhận cần xác nhận bấm vào phòng.

## Production một process

```sh
npm run build
npm start
```

Backend chạy tại `http://localhost:3001`, phục vụ `dist/`, `/health`, `/api/rooms`, `/api/games` và Socket.IO cùng origin. Khi khởi động, server nạp snapshot Nối từ từ `data/word-chain/`, xác minh version/hash/count/seed và dựng Set một lần. Lỗi data làm `available:false` cho Nối từ, không dừng UNO. Production cần giữ các file data này cạnh repo; không chạy nhiều replica/cluster vì state nằm trong RAM của process này.

Server restart, crash hoặc deploy mất phòng và token. localStorage chỉ giữ thông tin nối lại, không khôi phục được phòng đã mất. Không có persistence, Redis, database hay log bàn bài.

## Xác minh còn lại

- Browser access host không khả dụng trong phiên làm việc; chưa kiểm tra trực tiếp giao diện hai browser context hoặc ảnh desktop/mobile.
- Chưa có thiết bị điện thoại thật để xác nhận LAN.
- Xem [tóm tắt kiểm chứng](./reports/project-summary.md) để biết các kiểm tra đã chạy và giới hạn còn lại.
