# Bắn tàu — bố cục và tương tác đề xuất

Trạng thái: phần polish hiện hành theo [08-polish-plan.md](./08-polish-plan.md), được người dùng duyệt và đang triển khai. Ảnh tham khảo không phải bản thiết kế để chép lại.

Theo dõi 16/11/2026: UI ban đầu đã triển khai một phần theo [báo cáo code](./06-implementation.md). Người dùng đã duyệt polish gồm tàu vector liền khối, kéo thả trực tiếp, bố cục hai bảng cố định, sprite và sound đồng bộ. Trạng thái đã làm/đã kiểm tra được ghi trong [báo cáo polish](./09-polish-implementation.md) và QA.

## 1. Kế thừa Hội Quậy

- Dùng nguyên header/brand/avatar/tên, footer nguồn, font `--font-body`, nền charcoal, accent đỏ `--accent`, panel/border và bo góc 4–8 px hiện tại. Không thêm font pixel, nền xanh toàn trang, nút vàng/purple hoặc theme game độc lập.
- Biển dùng xanh xám tối cục bộ (đề xuất token semantic `--bantau-water`, `--bantau-grid` ánh xạ surface + blue hiện có); đỏ Hội Quậy cho thao tác chính. Hit có biểu tượng/tình trạng đọc được ngoài màu; mục tiêu có crosshair và tọa độ.
- Tàu nhìn từ trên xuống, vector đơn giản, 2–3 sắc độ, không artwork/logo sao chép. Cùng hình học đầu/đuôi để nhận diện hướng; không dùng mô hình 3D hoặc sprite nặng.
- Tạo CSS scope `.bantau-*`; không sửa `.game-table`/`.button` toàn cục để phục vụ riêng game này. Giữ bản sửa gap/ghế UNO trong Fix 1.1.

## 2. Sảnh và tạo phòng

- Thêm thẻ “Bắn tàu · 2 người”, minh họa tàu vector tự vẽ. Mở intro gọn và public list hiện tại; giới thiệu không đẩy phòng xuống quá sâu trên điện thoại.
- Nút “Tạo phòng Bắn tàu” mở `RoomSettingsDialog` dùng chung; thêm size, ship count, hit-continue, allow-touch. Fleet preview chỉ liệt kê chiều dài 5/4/3/3/2 theo preset, không có tọa độ.
- Visibility, target và turnSeconds giữ điều khiển hiện có. Help text game-specific: “Hết giờ tự bắn ô đang nhắm; chưa nhắm thì ngẫu nhiên”, không tiếp tục hiện “bị loại khỏi ván”. Setup 90 giây là dòng thông tin ngắn.
- Có nhiều cài đặt: bố trí hai cột desktop, một/hai cột mobile tùy chiều rộng; dialog cuộn phần nội dung, tiêu đề và nhóm xác nhận luôn tiếp cận được. Không thêm “Chơi nhanh” hoặc matchmaking theo ảnh.
- Room listing hiển thị tên/avatar host, 1/2 người, mục tiêu/thời gian theo mẫu hiện tại. Ready/start của phòng giữ nguyên.

## 3. Pha xếp tàu

Desktop: strip hai người + đồng hồ chung → bàn mình chính ở trái → panel đội hình ở phải, hiển thị số ô, tàu đang chọn, Xoay, Ngẫu nhiên, Sẵn sàng. Không dựng biển đối phương rỗng thật lớn trong pha này.

Mobile: strip người chơi gọn → timeline 90 giây → bàn mình → hàng chọn tàu và nhóm Xoay/Ngẫu nhiên/Sẵn sàng. Giữ nhóm thao tác trong flow/safe-area, không phủ lưới.

Kéo trực tiếp thân tàu là luồng chính: giữ nguyên offset đoạn tàu đang nắm, hiện ghost theo ô lưới, thả để gửi đúng một intent placement. Server ACK mới xác nhận vị trí; từ chối/mất kết nối để nguyên snapshot đã xác nhận và báo lý do. Chọn tàu rồi chạm ô neo vẫn là fallback bàn phím/chạm; xoay bằng nút hoặc phím R. Client không khẳng định placement hợp lệ thay server.

Sẵn sàng khóa đội hình sau ACK. Chờ người kia: chỉ hiện badge “Đã xếp xong”, không vị trí/tên tàu họ đang thao tác. Timeout báo “Đã dùng đội hình hợp lệ hiện tại”. Không native confirm/alert.

## 4. Pha chiến đấu

Desktop >=1100 px: status/điểm/timer gọn trên cùng. Hạm đội mình ở trái khoảng 35%, biển đối thủ ở phải khoảng 65% để dễ ngắm/bắn. Cả hai bảng cùng hiện và giữ nguyên vị trí/kích thước giữa các lượt. Khi tới lượt mình, panel mình có viền xanh mint và nhãn rõ; khi đối thủ tới lượt, panel đối thủ có viền đỏ và nhãn rõ. 768–1099 px có thể xếp dọc theo kích thước viewport.

Mobile 360/390 px: biển đối thủ là bảng chính, hạm đội mình là bảng mini luôn hiện để xem. Không yêu cầu nút phóng to hoặc chạm để đổi chế độ; không đổi kích thước/vị trí giữa các lượt. Đổi lượt không tự cuộn giật trang.

- Click/chạm một lần: crosshair mảnh, ô nâng sáng nhẹ, dòng “Đang nhắm D4” trong status dành sẵn. Lần hai cùng ô: gửi bắn, khóa thao tác đang ACK. Không thêm nút Bắn và không hiện hướng dẫn dài mỗi lượt.
- Chọn A rồi B: chỉ B được nhắm. Double-tap nhanh khi aim chưa ACK: không gửi fire thiếu điều kiện; không tự bắn sau ACK muộn. Có feedback đang xác nhận mục tiêu, người chơi kích hoạt lại khi đã xác nhận.
- Hết giờ: server event là nguồn hiệu ứng, có nhãn “Tự bắn”; client không gọi random hoặc tự coi đã bắn vì timer về 0.
- Bảng chỉ hiển thị hit/sunk lâu dài. Sau miss, DOM/aria/style y hệt unknown; không chấm đánh dấu, không tooltip lịch sử, không bộ lọc ô cũ. Last-shot tọa độ chỉ ở hiệu ứng tạm, không lịch sử cuộn.
- Status có chiều cao tối thiểu đủ thông báo “Trúng”, “Chìm”, “Trượt”, không thêm row mới làm xê dịch lưới. Khoảng hở status/grid/panel tối thiểu 12–16 px, kiểm tra tên dài.

## 5. Motion và âm thanh

| Trạng thái | Đề xuất hiển thị | Âm thanh |
|---|---|---|
| Nhắm | crosshair/outline đỏ mảnh, 100–140 ms | click nhẹ theo setting |
| Bắn | thủy lôi CSS/SVG rơi từ mép trên vùng bàn tới tâm ô, khoảng 260–320 ms | tiếng rít ngắn |
| Trượt | chớp nước/vòng sóng trong ô, 220–320 ms; dọn sạch | “tõm”/nước |
| Trúng | flash + tia lửa giới hạn trong ô, 300–400 ms; sau đó dấu cháy tĩnh | impact trầm + crackle ngắn |
| Chìm | pulse một thân tàu đã lộ, rung nhẹ riêng bảng, 400–500 ms | impact sâu hơn, không âm lượng đột biến |

Tổng hiệu ứng một phát tối đa ~850 ms, vừa khoảng resolving 900 ms của server. Chỉ 1–2 lớp chuyển động; tránh fire loop/blur phủ trang. Giảm chuyển động: bỏ đường rơi/rung, hiện kết quả tại ô; luật/timer không thay đổi. Mute độc lập reduced motion, dùng master volume hiện tại. Không thêm âm thanh web tải ngoài hoặc phát trước gesture.

Event hiệu ứng gồm shotId, gameId, board owner, tọa độ, hit/miss/sunk, source manual/timeout và serverTime; render từ event đã xác thực. Dedup theo shotId; bỏ event ván cũ/hết hạn, không phát lại sau resume. Chuyển ván hoặc rời trang dọn WAAPI/rAF/listener/audio. State update không phụ thuộc onAnimationEnd. Nếu event mất thì snapshot hit/sunk vẫn đúng; miss không cần dựng lại.

## 6. Khả năng chạm và bàn phím

- Bàn 12×12 trên 360 px không thể có 44 px mỗi ô trong toàn chiều rộng. Không hứa mọi ô luôn đạt 44 px: giữ ít nhất khoảng 24 CSS px/ô ở fit, có zoom 125/150/200%, pan trong viewport lưới riêng; nút thao tác chính >=44 px.
- Pointer down/up phải cùng ô; kéo/pan/pinch/pointer cancel hủy activation. Mục tiêu chỉ sau click hợp lệ, không bắn khi kết thúc một lần kéo. Mobile zoom/pan không làm tràn trang.
- Roving tabindex/role grid, mũi tên chuyển ô, Enter/Space lần đầu nhắm/lần sau bắn; nhãn tọa độ + unknown/hit/sunk đúng thông tin được thấy, không tiết lộ miss cũ.
- Focus-visible rõ khi dùng bàn phím, pointer không tạo vòng dày; không bỏ focus toàn cục. Live region cho lượt/kết quả, không đọc timeline mỗi frame.
- Trình đọc màn hình/DOM của đối thủ không chứa tàu chưa lộ trong aria-label, title, CSS vars, dataset, SVG, canvas texture hay hidden nodes.

## 7. Skill và thành phần

Đã dùng UI Pro Max để tra dragging alternative/touch target, spacing và reduced motion; tiếp tục kế thừa design system hiện tại, không tạo palette mới.

Lucian CLI search 16/11/2026 dùng catalog cache EN 12/11 và KO 07/11 do mạng không khả dụng. Candidate xác minh qua search: **013 — Stretchy switch** cho hit-continue/allow-touch; chưa `get` và chưa chọn port. Search dialog trả các phần tử chia sẻ/thương mại/xác nhận xóa không hợp ngữ cảnh, nên ưu tiên dialog sẵn có của repo. Trong đợt polish, catalog được tra lại. Kết quả phù hợp nhất về drag chỉ là upload/kanban, không hợp thao tác kéo tàu trên lưới; không có phần tử Lucian được port. Giữ input/board hiện có và dùng Pointer Events theo thiết kế riêng. Không thêm ID hoặc dòng ghi công không sử dụng.

## 8. Bộ trạng thái cần duyệt bằng browser

1440/768/390/360 px: tạo phòng, đặt tàu hợp lệ/lỗi biên/đè/chạm, đã khóa, chờ đối thủ, nhắm, ACK pending/stale, hit/miss/sunk, automatic shot, resolving, offline/resume, chịu thua, kết thúc ván/countdown/match. Thử cả size 8/10/12 và reduced motion. Screenshot tham khảo không phải bằng chứng UI mới đã chạy.
