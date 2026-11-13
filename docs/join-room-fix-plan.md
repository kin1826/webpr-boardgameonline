# Xử lý lỗi không tham gia được phòng

> Trạng thái hiện tại: người dùng xác nhận join bằng mã hoạt động trên desktop, cửa sổ ẩn danh và điện thoại trong LAN. Ghi chú bên dưới mô tả nguyên nhân và bản sửa lịch sử; không còn là lỗi đang chờ xử lý.

## Báo cáo người dùng

Trình duyệt chính tạo được phòng; cửa sổ ẩn danh và điện thoại mở được web nhưng chưa tham gia được bằng mã.

## Kế hoạch và trạng thái

1. Đã rà luồng form → action ID → Socket.IO → schema → room lookup; rà proxy dev và mã phòng.
2. Đã xác định lỗi tương thích HTTP LAN: frontend gọi trực tiếp `crypto.randomUUID()`, API bị giới hạn secure context. Lỗi trước khi gửi Socket.IO còn giữ request lock, làm các lần thử sau bị bỏ qua. Đây là lỗi source xác định được; chưa có console của người dùng để khẳng định toàn bộ hiện tượng cùng nguyên nhân.
3. Đã thêm `src/action-id.ts`: ưu tiên randomUUID, fallback UUID v4 từ getRandomValues (khả dụng HTTP LAN). Không dùng Math.random và không thay cơ chế token server.
4. Đã áp dụng cho create/join và room/game commands. Thêm catch/finally để báo lỗi và nhả busy/lock khi exception.
5. Đã chạy 33/33 test và production build (bao gồm typecheck) đạt. Hai test mới kiểm tra nhánh fallback và nhánh native. Test socket cũ kiểm tra hai client join độc lập. Chưa kiểm tra browser/điện thoại với bản sửa.
6. Cần xác nhận thực tế: máy tính tạo phòng mới, cửa sổ ẩn danh và điện thoại vào bằng cùng mã; ready/start và đánh/rút; tải lại quay đúng ghế.

## Cách xác nhận trên máy người dùng

Giữ một backend chạy. Nếu dùng dev, chạy `npm run dev`, tải lại mọi trình duyệt để nhận bản sửa; không cần restart backend nếu nó vẫn chạy. Nếu restart server, tạo phòng mới vì phòng cũ ở RAM đã mất. Nếu dùng production, build rồi restart server và tạo phòng mới.

Trên ẩn danh dùng localhost để kiểm tra phiên riêng, sau đó dùng cùng địa chỉ IP LAN như điện thoại để kiểm tra HTTP LAN. Nhập mã phòng còn tồn tại. Ghi nguyên văn thông báo nếu lỗi: không tìm thấy phòng, dữ liệu không hợp lệ, đang kết nối lại hay timeout. Không coi tải được HTML là bằng chứng đã kết nối Socket.IO.
