# Bắn tàu — checklist QA/Terra cho đợt polish

Ngày 16/11/2026. **Trạng thái: chờ QA độc lập; chưa được Terra nghiệm thu.** Dùng server/frontend đúng cùng phiên bản. Không dùng kết quả dưới đây thay cho bước chưa chạy.

## Bằng chứng đã có

| Kiểm tra | Kết quả |
|---|---|
| `npm test` trong môi trường cho phép loopback | Đạt: 17 file, 183/183 test |
| `npm run typecheck` | Đạt |
| `npm run build` | Đạt; còn cảnh báo Zod annotation và JS chunk >500 KB |
| `git diff --check` | Đạt |
| Engine + schema Bắn tàu riêng | Đạt: 12/12 |
| Chrome + Safari độc lập | Tạo phòng, vào bằng mã, ready, bắt đầu, khóa đội hình, vào combat, aim→bắn và thấy lượt đổi; UI giữ biển địch lớn/bàn mình nhỏ ổn định |

Trong sandbox thường, 12 test HTTP/Socket.IO không thể mở listener (`listen EPERM 127.0.0.1`); lần đầy đủ được chạy lại với quyền loopback và đạt 183/183. Browser test là local, không phải production hosting.

## Chạy nghiệm thu thủ công

1. Chạy `npm run dev:lan` theo README hoặc chạy backend/frontend dev bằng các lệnh trong `package.json`. Mở URL frontend trên hai browser/profile độc lập; một người tạo phòng Bắn tàu, người kia tham gia bằng mã.
2. Chuyển từng người qua thao tác xếp đội hình. Kéo tàu bằng mũi/giữa/đuôi theo cả ngang và dọc; kiểm tra footprint bám đúng ô đang nắm, không nhảy neo.
3. Thử thả hợp lệ, chồng tàu, chạm tàu khi tắt/bật tùy chọn, ra ngoài bàn, nhả pointer rồi huỷ, Escape và mất kết nối. Chỉ ACK server mới thay đội hình đã lưu; lỗi phải giữ đội hình cũ và lý do dễ hiểu.
4. Khóa đội hình ở cả hai phía. Xác nhận tàu mình liền khối, đúng hình 2/3/3/4/5 ô; xoay dọc/ngang không cắt cell; sau lock không thể di chuyển.
5. Khi bắn, chọn A rồi B rồi B: aim chuyển tới B, lần đầu chỉ tạo aim, lần sau mới bắn. Aim đang chờ ACK không được bắn; đối thủ không thấy aim riêng. Dùng keyboard để xác nhận focus không tự đổi aim.
6. Thử phát trượt, trúng giữa tàu, trúng ô cuối làm chìm và timeout có/không có aim ACK. Kiểm tra rơi → splash hoặc nổ → lửa theo đúng ô, rung/sound tại impact, miss trở lại ô chưa bắn sau hiệu ứng.
7. Reload từng session sau khi một tàu đối thủ đã chìm. Chỉ tàu đã chìm được vẽ lại; mọi tàu chưa chìm phải tiếp tục kín. Kiểm tra snapshot/API, không chỉ DOM.
8. Quan sát đổi lượt nhiều lần: biển địch luôn lớn và cùng vị trí; hạm đội mình luôn nhỏ/cùng vị trí. Đổi lượt chỉ đổi nhãn/viền trạng thái, không đổi thứ tự/kích thước; mọi cell của bàn địch đủ lớn để bắn.
9. Lặp trên desktop 1440 px, tablet 768 px, viewport 390/360 px. Kiểm tra không tràn ngang, zoom/pan và bấm ô chính xác. Sau đó nếu có, thử trên điện thoại thật để kiểm tra kéo cảm ứng/safe area.
10. Bật reduced motion, tắt tiếng, thay volume, nghe bằng loa/tai nghe; xác nhận cue không lặp khi reconnect/snapshot và game vẫn chạy khi browser chặn AudioContext. Trên iOS, tương tác trước để mở audio.
11. Hoàn tất một ván thắng; xác nhận kết quả/điểm +10 một lần, tự đếm 3–2–1 sang ván mới nếu dưới mục tiêu, và quy tắc target trận khi đạt điểm.
12. Chạy lại `npm test`, `npm run typecheck`, `npm run build`; kiểm tra regression UNO, Nối từ, Caro, HTTP LAN/reconnect.

## Chưa kiểm chứng trong lượt triển khai

- Kéo thả trực tiếp qua browser/touch và các rollback lỗi ở bước 2–3.
- Hoàn tất một ván thắng và xác nhận chuỗi điểm/countdown trên hai client.
- Viewport mobile thật; nghe chất lượng/đồng bộ sound trên iOS hoặc loa điện thoại.
- Hành vi khi asset SVG lỗi tải; hiện chưa có fallback asset riêng.
- Trải nghiệm mạng hosted/HTTPS/WSS hoặc tải đồng thời.

Terra ghi từng mục Đạt/Không đạt/Không kiểm tra, trình duyệt/thiết bị, bước tái hiện, ảnh hoặc log tối thiểu. Chỉ chuyển trạng thái QA sau khi thực sự chạy; không đánh dấu thay người kiểm thử.
