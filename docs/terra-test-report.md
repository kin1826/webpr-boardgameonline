# Kiểm thử độc lập Terra

Kết luận: **CHƯA ĐỦ BẰNG CHỨNG** để nghiệm thu hai người chơi trọn ván qua giao diện.

Môi trường: macOS, Node v26.4.0, npm 11.17.0; workspace không có Git nên không có commit để đối chiếu. Công cụ browser báo `The browser access host is unavailable`. Đã đọc hướng dẫn repo và hồ sơ Luna; dùng `ui-ux-pro-max` tra hướng dẫn focus dialog. Chưa thực hiện kiểm tra trực quan tương ứng.

## Kết quả thực chạy

| Kiểm tra | Trạng thái | Bằng chứng/phạm vi |
|---|---|---|
| `npm run typecheck` | PASS | Exit 0, frontend và server. |
| `npm run build` | PASS | Exit 0, Vite build hoàn tất. |
| `npm test` | PASS | 31/31 test, 3 file; chạy với quyền mở socket loopback. |
| Engine | PASS một phần | Test hiện có kiểm tra 108 lá, chia/bảo toàn 2–6, Wild mở đầu, lượt, Reverse 2 người, Draw Two, rút, challenge, UNO, projection và thắng. Không suy rộng ra mọi trường hợp trong test plan. |
| Room service | PASS một phần | Test hiện có kiểm tra start 2–6, public/private, ready, kick, reconnect/takeover và dọn ghế offline. Đây là test service, không phải 6 browser. |
| Hai Socket.IO client | PASS một phần | Integration tạo/join/ready/start, projection riêng, action lặp và kết thúc bằng fixture test-only. Không phải ván shuffle production qua UI. |
| Hai browser độc lập, ván production và rematch | BLOCKED | Browser access host không khả dụng. |
| UI desktop/mobile, bàn phím, focus, reduced motion | BLOCKED | Không mở được browser; chưa có ảnh hoặc phép đo. |
| Điện thoại thật/LAN | NOT RUN | Không có kiểm chứng thiết bị thật trong lần này. |
| `npm ci` | NOT RUN | Dùng dependency hiện có; chưa xác minh cài sạch theo lockfile. |
| Dev/production HTTP smoke | NOT RUN | Chưa chạy độc lập trong lần kiểm thử này; kết quả Luna nằm trong verification-report, không tính là kết quả Terra. |
| Các boundary rate limit/cache, mọi trường hợp luật và race | NOT RUN | Bộ test hiện tại chưa chứng minh đầy đủ ma trận trong test-plan. |

## Lỗi và thay đổi

Chưa xác nhận lỗi sản phẩm có bước tái hiện trong lần chạy này. Không có nghĩa là toàn bộ tính năng đã đạt. Không sửa production hoặc thêm test; chỉ thêm báo cáo này. Không có số lượng test UI/E2E đạt để báo cáo.

## Công việc chặn nghiệm thu

Khôi phục browser automation, dùng hai context tách localStorage để tạo/join, ready/start, chơi ván shuffle production đến kết quả và rematch; kiểm tra các viewport, bàn phím và trạng thái mạng. Chạy cài sạch, smoke dev/production và bổ sung ma trận luật, quyền, privacy, reconnect, boundary và thiết bị LAN còn thiếu. Không coi fixture integration là bằng chứng hoàn thành hành trình production.
