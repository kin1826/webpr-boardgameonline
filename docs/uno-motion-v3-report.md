# Báo cáo UNO motion v3 — bàn giao Terra

Bản sửa sau phản hồi: điều kiện che lá bỏ đã được đổi để yêu cầu flight và event thực sự tồn tại, tránh `undefined === undefined` ẩn lá khi không có hiệu ứng. Lá bỏ mặc định luôn hiển thị. `npm run build` đã chạy lại và đạt; chưa xác nhận lại trên thiết bị thật.

Ngày: 13/11/2026. Trạng thái: **đã sửa source và qua kiểm thử tự động; chưa nghiệm thu trực quan**. Không đánh dấu Terra approve.

## Đã làm

- Trên mobile, chạm lá hợp lệ lần đầu để nâng lá khoảng 15px; chạm lại đúng lá mới gửi hành động. Chạm lá khác chuyển lựa chọn. Wild/+4 vẫn mở chọn màu ở lần chạm xác nhận. Bỏ nút “Đánh lá” trong khay; hướng dẫn ngắn nằm dưới tay bài. Cuộn tay bài hủy lựa chọn để cuộn không trở thành lần đánh.
- Desktop vẫn đánh ngay bằng click. Server `allowedActions` và request/action lock tiếp tục quyết định hành động có hợp lệ hay không.
- Focus ring trang trí nhiều lớp trên lá playable/selected và halo dày của “Rút bài” đã bỏ. Lá hợp lệ phân biệt bằng độ sáng; lá chọn phân biệt bằng vị trí nâng. Pointer không giữ vòng focus; bàn phím vẫn có outline 2px rõ.
- Thay flight cố định 65×96 bằng rect đo ở lá nguồn và mặt lá bỏ. Flight dùng cùng tọa độ viewport, neo theo tâm và scale theo kích thước đích. Lá bỏ được che trong lúc overlay bay; overlay giữ opacity 1 khi tiếp đất, sau đó mới chuyển sang lá bỏ trong snapshot. Bỏ CSS animation riêng chạy đồng thời ở chồng bỏ.
- Bài số bay 265ms; lá hành động bay 280ms rồi tiếp đất thêm 70ms (Bỏ lượt) hoặc 96ms (+2/+4). Đường bay có vòng cung nhẹ; hiệu ứng chỉ chạy theo event server đã khớp room/game revision. Đối thủ bắt đầu từ avatar; người đánh cục bộ bắt đầu từ mặt lá đã chọn.
- +2/+4 rung sau khi tiếp đất. Rung lớp nền/viền bàn và hình lá chồng rút; nút rút, tay bài, tray, đối thủ và header không bị transform. Cường độ dùng `penaltyTotal` từ event: desktop theo các mốc tổng 2/4/8/12/16 là 4/6/9/12/14px; mobile dùng 60%, trần 8px. Thời lượng theo các mốc là 170/210/250/290/320ms và giữ trần từ tổng 16. Bỏ lượt có cú rung nhẹ cố định; lá số không rung.
- Khi một lá rời tay, các lá còn lại chạy FLIP theo `cardId` và cả X/Y trong 215ms, gồm trường hợp chuyển hàng trên mobile. Nếu snapshot mới tới giữa animation, vị trí đang nhìn thấy được dùng làm điểm xuất phát mới. Resize, cuộn, xoay màn hình, đổi ván, tab nền và unmount dọn animation/baseline.
- Tùy chọn “Giảm hiệu ứng” và `prefers-reduced-motion` tắt flight, impact và FLIP. Event đã trình bày không chạy lại khi đổi tùy chọn.

## File thay đổi

| File | Nội dung |
|---|---|
| `src/App.tsx` | Chọn lá mobile hai lần, điều phối flight/landing/impact, quản lý nguồn/đích/correlation và FLIP tay bài. |
| `src/styles/app.css` | Bỏ ring trang trí, tạo mặt bàn và visual chồng rút tách khỏi hit target, focus-visible và touch-action. |
| `src/game-effects.ts` | Thêm phép tính vector/scale bay theo rect hai đầu. |
| `src/game-effects.test.ts` | Test tâm, hướng và tỉ lệ scale của đường bay; giữ test cường độ rung và gate event. |
| `docs/uno-motion-v3-plan.md`, `docs/uno-motion-v3-prompt.md` | Cập nhật trạng thái triển khai. |
| `docs/uno-motion-v2-plan.md`, `docs/implementation-plan.md`, `docs/test-plan.md` | Liên kết báo cáo và kết quả đợt v3. |

## Event, luật và riêng tư

- Không đổi `game:effect`, schema, game engine, BB-UNO-1, quyền của `allowedActions`, HTTP LAN fallback hay xử lý phiên. Không thêm dependency.
- Rect nguồn chỉ lưu cục bộ trong component và gắn với game revision kế tiếp; không gửi vị trí, bài riêng, token hay dữ liệu mới lên server. Mặt bài bay lấy từ event công khai đã validate.
- Nước đi bị server từ chối không nhận event thành công nên không bay/rung; rect chờ được xóa khi request lỗi, đóng dialog màu, mất kết nối, resize/cuộn hoặc rời component.
- Animation chỉ trình bày snapshot; không quyết định lượt, phạt, thắng hay thời điểm gửi hành động.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt. |
| `npm run build` | Đạt; Rollup hiện báo hai chú thích `@__PURE__` trong dependency Zod sẽ bị bỏ, không làm build thất bại. |
| `npm test -- --reporter=dot src/game-effects.test.ts` | Đạt: 5/5 test. |
| `npm test -- --reporter=dot` | Đạt: 59/59 test trên 7 file. Cần loopback cho Socket.IO; lần mặc định trong sandbox gặp `listen EPERM`, chạy lại với quyền loopback thì đạt. Ván production shuffle hoàn tất ở 21 hành động trong lần chạy cuối; số bước phụ thuộc shuffle. |
| `git diff --check` | Đạt với các file đang được Git theo dõi. Workspace hiện hiển thị các dự án/tài liệu là untracked nên lệnh này không quét nội dung untracked. |
| Browser tích hợp | **BLOCKED**: `cua.getState()` báo “The browser access host is unavailable”. Không có video/ảnh mới; chưa xác nhận trực quan desktop/mobile hoặc thiết bị thật. |

Lucian catalog được tìm với từ khóa thao tác chọn lá bài; không có thành phần phù hợp hơn điều khiển lá UNO gốc của dự án nên không port element nào. UI Pro Max được dùng để giữ focus-visible, reduced motion, touch-action và thời lượng theo ngữ cảnh.

## Terra cần kiểm tra trực quan

1. 360×640, 390×844 và desktop 1440px: chạm A nâng A; chạm B đổi chọn; chạm lại B đánh; xác nhận không có nút “Đánh lá”. Thử cuộn, Wild/+4, vừa rút và lượt cộng phạt.
2. Local và đối thủ cùng thấy bài bay từ đúng nguồn vào đúng lá bỏ, không lóe lá trùng hoặc mất lá ở đích; thử lá số, +2, +4, Bỏ lượt và lượt đánh thật nhanh kế tiếp.
3. Chuỗi tổng phạt 2→4→8→12→16: rung tăng rồi chạm trần; nút rút và tray đứng yên. Đối chiếu app “Giảm hiệu ứng” và OS reduced motion.
4. Đánh lá ở đầu/giữa/cuối tay bài với 7/14/25/40 lá; các lá bù cả X/Y khi đổi hàng, không tràn ngang hoặc nhảy ngược khi action nối tiếp.
5. Keyboard: Tab/Enter/Space, chọn màu và đóng dialog; xác nhận focus ring mảnh chỉ khi cần và vẫn thấy rõ.

Phạm vi nghiệm thu còn lại là xem motion thật trên browser/điện thoại. Build/test xanh chưa chứng minh cảm giác rung, độ mượt hay layout mobile đạt.
