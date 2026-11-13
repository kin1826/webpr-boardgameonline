# Kế hoạch motion v2 — lực đánh và bàn mobile

Phản hồi sau khi người dùng chơi v2: motion chưa đạt, thao tác mobile cần bỏ nút xác nhận. Đợt v3 đã triển khai; kiểm thử tự động qua nhưng xem trực quan đang BLOCKED: [plan v3](./uno-motion-v3-plan.md), [prompt v3](./uno-motion-v3-prompt.md), [report v3 cho Terra](./uno-motion-v3-report.md).

Trạng thái: đã triển khai; nghiệm thu trực quan browser/thiết bị đang BLOCKED. Kết quả thực chạy và checklist Terra trong [uno-motion-v2-report.md](./uno-motion-v2-report.md). Prompt: [luna-uno-motion-v2-prompt.md](./luna-uno-motion-v2-prompt.md).

## 1. Hiện trạng và quyết định thay thế

Người dùng xác nhận chức năng đang ổn nhưng cảm giác đánh bài yếu. Ảnh điện thoại cho thấy khoảng trống trong felt lớn, tay bài nằm thấp. Rà source thấy mobile `.felt-table` có min-height 430px; các prompt nhận phạt/UNO đang nằm bên trong felt; số chỉ chạy `card-place` tại chồng bỏ; WAAPI rung `.felt-impact-layer` là viền trang trí, với lực chỉ phụ thuộc loại lá, chưa phụ thuộc tổng phạt.

V2 thay các quyết định tương ứng ở [plan cũ](./uno-motion-plan.md): rung lớp hình ảnh mặt bàn thật thay cho chỉ rung viền; tổng phạt càng lớn lực càng lớn trong giới hạn; thông báo nằm ngoài mặt bàn; mobile dùng tay bài chồng theo hàng. Báo cáo cũ là lịch sử, không sửa thành bằng chứng v2 đã hoàn tất.

Giữ BB-UNO-1, số đen/radius 6px, legal actions từ server, HTTP LAN action ID fallback, reconnect và privacy. Không thay luật, cộng phạt, cửa sổ UNO hoặc cách xác định thắng.

## 2. Mục tiêu nhìn thấy được

- Lá số xuất phát từ đúng người đánh, bay đến lá bỏ, tiếp đất nhẹ; không chỉ nhảy tại giữa bàn.
- +2/+4 bay vào rồi đập, rung mặt bàn ngay tại thời điểm tiếp đất. Chuỗi tổng 2 → 4 → 8 → 12 → 16 phải cảm thấy tăng lực rõ, sau đó giữ trần.
- Tay bài, thông báo, nút và dialog đứng yên trong lúc mặt bàn rung.
- UNO, bắt UNO, tổng phạt và nhận bài xuất hiện trong khu vực phía dưới mặt bàn, ngay trên tay bài. Khi xuất hiện/biến mất không đổi chiều cao mặt bàn hoặc đẩy tay bài.
- Mobile giảm khoảng trống ở bàn, ưu tiên thấy được mặt bàn, vùng hành động và ít nhất hàng bài đầu trong viewport thông dụng. Không bảo đảm nhét toàn bộ 20–40 lá vào một màn hình.

## 3. Bố cục đề xuất

Thứ tự DOM/hiển thị:

1. Thanh phòng và đối thủ.
2. Mặt bàn gọn: lượt, chồng rút/bỏ, màu và chiều.
3. Vùng thông báo/hành động dành sẵn diện tích.
4. Tiêu đề tay bài, các hàng bài chồng nhau.

Desktop giữ đối thủ quanh bàn. Mobile giữ đối thủ ở vùng trên, giảm padding/ring trống và bỏ các min-height quá lớn đang ép bàn dài. Mốc thử felt 250–300px ở mobile cao thông thường; điều chỉnh bằng viewport height/safe-area và kiểm chứng 360×640, 390×844, landscape. Đây là mốc thiết kế, không phải con số cố định bất chấp nội dung hoặc zoom. Với sáu người, vùng ghế có thể thêm hàng ngoài felt.

Không thu nhỏ cả trang bằng transform, không khóa body/zoom. Trình duyệt điện thoại có thanh địa chỉ nên dùng `svh`/`dvh` với fallback nếu cần; cho phép cuộn dọc khi màn hình thấp hoặc nhiều bài.

## 4. Bài bay từ người đánh ra bàn

- Một overlay trình bày riêng, `pointer-events:none`, `aria-hidden`, không nằm trong document flow. CSS transform/opacity hoặc WAAPI, không thêm thư viện nặng.
- Với mình: lưu rect của lá trước khi gửi intent vì snapshot hợp lệ sẽ xóa lá khỏi tay. Chỉ bắt đầu bay sau event server xác nhận, không phát thành công khi bị từ chối.
- Với đối thủ: lấy rect ghế/avatar `actorId`. Chỉ dùng mặt lá đã được công khai qua event đánh; không cần biết ID/mặt các lá còn lại của đối thủ.
- Lấy đích từ rect chồng bỏ. Dùng cùng hệ tọa độ viewport, đo đầu/cuối mỗi effect một lần; không đo layout mỗi frame. Resize/scroll/đổi orientation giữa chừng thì hủy overlay và hiện snapshot mới nhất.
- Lá số khoảng 220–300ms, xoay nhẹ 2–6 độ rồi tiếp đất. Lá chức năng có nhịp bay → nhấc/scale nhẹ → đập 300–400ms. Không làm rung với lá số.
- Snapshot luôn hiển thị trạng thái mới ngay; không trì hoãn đổi lượt hoặc mở hành động để chờ animation. Không che lá bỏ quá lâu để cố giấu việc snapshot đã cập nhật.
- Khi không tìm được source rect, dùng ghế hoặc điểm neo tay bài; nếu không có đích thì bỏ animation. Không dựng tọa độ ngẫu nhiên.

### Tương quan intent và event

Event hiện có actor/game/revision và mặt lá công khai nhưng chưa có actionId. Khi cần ghép chính xác rect của lá local đã biến mất, ưu tiên bổ sung **actionId công khai từ payload đã validate** vào `game:effect` (schema strict, optional để không phá consumer cũ); lưu rect theo actionId local. Không dùng nickname, suy đoán số/màu hoặc gửi toàn bộ hand.

Luna phải khảo sát rồi ghi hợp đồng cuối trước khi thay event. Nếu có cách ghép chắc chắn bằng dữ liệu hiện tại thì giải thích và giữ schema. Event không chứa credential/token, bài rút hoặc thứ tự deck. Cần test correlation nếu thay giao thức.

## 5. Rung tăng theo tổng phạt

`penaltyTotal` từ event xác nhận là đầu vào, không tự cộng lại trên client. Các mốc khởi đầu để tinh chỉnh trực quan:

| Tổng phạt sau nước đánh | Biên độ desktop | Thời gian rung |
|---|---:|---:|
| 2 | 4px | 170ms |
| 4 | 6px | 210ms |
| 6–8 | 9px | 250ms |
| 10–14 | 12px | 290ms |
| Từ 16 | 14px, giữ trần | 320ms, giữ trần |

Có thể nội suy đơn điệu giữa mốc; mobile khoảng 55–65% biên độ desktop, trần 8px. Thêm xoay rất nhỏ tối đa khoảng 0.4 độ nếu cần, không zoom toàn màn hình. Không random không kiểm soát; keyframe giảm dần về 0. +4 có cú slam rõ hơn +2, nhưng không làm lực giảm khi tổng phạt tăng.

Rung **lớp cảnh felt** chứa nền/ring và hình chồng bài, có clipping/margin đủ để không hở mép hoặc gây scroll ngang; header, ghế, tray, tay bài, nút rút có thể bấm và modal không dịch chuyển. Tách hit target chồng rút khỏi hình trang trí nếu cần. Không chỉ rung một nét viền. Mỗi cú đập một pulse, effect mới thay/cancel effect cũ, không cộng transform hoặc xếp hàng rung kéo dài.

Bỏ lượt vẫn slam/rung mức trung bình riêng. Nhận N lá có phản hồi ngắn nhẹ hơn cú cộng cùng N; không kích hoạt lại full shake như có người vừa đánh cộng. Reduced motion trong app hoặc OS bỏ bay/scale/rung, giữ nội dung và trạng thái cuối.

## 6. Vùng thông báo và hành động cố định

Tách các khối `drawn-card-prompt`, `penalty-summary`, `penalty-card`, `uno-catch-prompt` và callout UNO/nhận phạt ra khỏi felt vào tray nằm giữa felt và tay bài. Không dùng toast giữa chồng rút/bỏ cho các nội dung này.

- Dành diện tích từ đầu, kể cả khi chỉ đang chờ: thử 132px desktop / 156px mobile, tinh chỉnh sau khi đo nội dung. Các phase thông thường dùng cùng chiều cao; nhãn ngắn tối đa hai dòng và nút tối thiểu 44px.
- Phân biệt thông báo transient với hành động đang chờ: UNO đã hô/đã nhận bài có thể tự ẩn; nút nhận phạt, giữ lá, hô/bắt UNO không được hết hạn do timer UI. Quyền hiển thị chỉ theo snapshot/allowedActions.
- Nếu cùng có phạt và cửa sổ UNO, trình bày hai hàng gọn, vẫn có đủ cả thao tác hợp lệ. Không thay nút đang focus chỉ để hiện callout mới. Xác nhận hành động stale vẫn do server quyết định.
- Nội dung gồm ai vừa hô/bị bắt/nhận bao nhiêu lá; không dựng thông báo dựa vào cardCount. `aria-live=polite` có kiểm soát, một event chỉ đọc một lần.
- Không absolute đè lên lá bài. Không animate height/margin. Ở zoom/font lớn được phép vùng tăng chiều cao hoặc trang cuộn dọc để không cắt nội dung; mục tiêu không nhảy bố cục áp dụng ở cỡ chữ chuẩn, không hy sinh accessibility.
- Giữ nhãn màu/chiều trong felt. Result dialog và cảnh báo mất kết nối vẫn có ngữ nghĩa riêng; không nhồi toàn bộ lỗi phòng vào tray.

## 7. Tay bài mobile xếp chồng, không kéo ngang

Dùng các hàng bài chồng nhẹ. Tính số lá mỗi hàng theo chiều rộng thực, giữ phần lộ của mỗi lá khoảng 44px để chạm được. Mốc 360px khoảng 6 lá/hàng, 390px khoảng 7 nếu khoảng trống thực cho phép. Lá rộng khoảng 62–70px; phần số/ký hiệu/màu ở góc trên luôn lộ, không đặt label dài dưới từng lá bị đè nhau.

Nhiều hơn số lá một hàng thì xuống hàng tiếp, có thể chồng dọc nhẹ nhưng giữ vùng chạm và góc nhận diện. Thử 1/7/14/25/40 lá. Cho phép trang cuộn dọc với nhiều bài; không ép hàng vô hạn khiến mỗi lá chỉ còn 5–10px, không ẩn lá hoặc bắt cuộn ngang để tìm lá hợp lệ.

Mobile: chạm lá hợp lệ để nâng nó lên phía trước, hiện tên đầy đủ trong vùng chọn và nút “Đánh lá …”; chạm lá khác đổi chọn. Chỉ nút xác nhận mới gửi play; với Wild mở dialog chọn màu rồi gửi như hiện tại. Lá sai vẫn tối/disabled. Desktop có thể giữ click-to-play hiện tại. Không tự đánh do hover, pointerdown hoặc lần tap bị lẫn với thao tác cuộn.

Selection lưu theo cardId, reset khi lá mất/quyền thay đổi/đổi game. Nâng lá chỉ bằng transform/z-index, không đổi kích thước hàng. Hỗ trợ focus bàn phím, focus-visible, accessible name màu/loại/số; kiểm tra lá không bị lớp hitbox của lá sau che mất.

## 8. Thứ tự thực hiện

1. Đọc hồ sơ, khảo sát source và báo file dự kiến. Ghi lại lựa chọn event/correlation và sơ đồ DOM.
2. Làm tray và giảm felt mobile trước; xác minh tray không gây layout shift ở các phase và không mất action.
3. Làm tay bài chồng theo hàng và chọn/xác nhận trên mobile; giữ legal actions, Wild, UNO.
4. Làm overlay bay từ source tới discard cho mình/đối thủ; dùng xác nhận server, xử lý fallback và cleanup.
5. Làm slam + lực rung theo tổng phạt, đồng bộ thời điểm tiếp đất; reduced motion và mobile amplitude.
6. Chạy kiểm chứng, sửa phát hiện trong phạm vi rồi bàn giao report riêng cho Terra.

Không đánh dấu v2 xong chỉ từ test/typecheck/build; nghiệm thu motion cần mở UI hoặc ghi rõ BLOCKED.

## 9. Kiểm chứng và bàn giao

- Unit test hữu ích cho intensity: tăng đơn điệu, trần, mobile, dữ liệu thiếu; correlation/dedupe/stale/game reset nếu thay logic. Không thêm test chỉ so tên class CSS.
- Chạy test engine/session/Socket.IO regression, typecheck/build; giữ HTTP LAN test. Nếu sandbox cấm loopback, chạy với quyền phù hợp và ghi rõ.
- Hai phiên browser thật độc lập: số từ mỗi phía, chuỗi 2→4→8→12→16+, nhận phạt, Skip/Reverse/Wild, UNO/bắt, rematch/reconnect/tab nền. Test fixture có thể dùng để dựng chuỗi khó nhưng phải tách với ván shuffle production.
- Desktop 1440; mobile 360×640 và 390×844, 2/4/6 người, nhiều lá, portrait/landscape, Safari nếu có, reduced motion/app/OS, keyboard/focus/zoom 200%.
- Bằng chứng: video ngắn bay/đập/rung (ảnh tĩnh không chứng minh được), ảnh tray ở các phase; đo chiều cao/vị trí felt và tay bài trước/sau thông báo ở cỡ chữ chuẩn. Không claim cảm giác đã đạt bằng build xanh.
- Report `docs/uno-motion-v2-report.md`: file thay đổi, thông số thật, event/correlation, cleanup/privacy, tests thật chạy, browser/thiết bị đã thử, ảnh/video nếu có, hạn chế và checklist Terra. Không tự ghi Terra approve.

## 10. Skill

Đã đọc guide và hai skill. Tra Pro Max `motion reduced motion` trả hướng dẫn tôn trọng OS và giới hạn 1–2 điểm chuyển động nổi bật. Thông số lực/radius/hand ở trên là quyết định riêng cho sản phẩm, không phải chuẩn lấy từ skill.

Lucian search `inline notification status` từ cache trả #072 Collapsing inline alerts, #070 Stacking toasts, #253 Recent purchase notification. Không chọn port trong giai đoạn tài liệu: collapse height/stack toasts không khớp tray cố định, purchase không đúng ngữ nghĩa game. Luna tra lại khi triển khai; chỉ `get` ứng viên thật sự phù hợp, không bịa ID hoặc bê motion làm nhảy layout.
