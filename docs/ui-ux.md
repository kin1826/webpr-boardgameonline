# UI/UX hiện hành

Đây là đặc tả giao diện đang dùng; lịch sử các lần thay đổi và giới hạn kiểm chứng được gom trong [tóm tắt dự án](./reports/project-summary.md). Luật thực thi theo [BB-UNO-1](./uno-rules.md), [NT-VI-1](./noitu-rules.md) và [HQ-CARO-1](./caro-rules.md).

## Hướng thiết kế

- Thương hiệu **Hội Quậy**, theme “Đêm đỏ”: nền `#151112`, bàn `#342326`, accent `#FF8275`; token thực tế nằm trong `src/styles/theme.css`. Màu lá đỏ/vàng/xanh lá/xanh dương được giữ riêng để nhận diện.
- Phong cách đêm chơi cùng bạn bè, bố cục gọn, minh họa tự vẽ. Trang chủ thấy ngay danh sách game, biệt danh ở header, ô nhập mã ở giữa; không có hero quảng cáo lớn hoặc số người online giả.
- UNO, Nối từ và Caro là game chơi được; Gián điệp vẫn là thẻ sắp ra mắt. Caro đúng 2 người. Tạo phòng sau khi chọn game, không có nút tạo phòng trực tiếp trong hero. Không đăng nhập/đăng ký.
- Toàn bộ giao diện tiếng Việt. Dùng font hỗ trợ dấu và system fallback, không phụ thuộc font mạng. Footer ghi dự án không chính thức, không liên kết Mattel.

## Màn hình

| Màn hình | Nội dung chính |
|---|---|
| Sảnh | Trò chơi, đổi biệt danh, nhập mã/vào phòng, Luật chơi |
| Giới thiệu UNO | Tạo phòng public/private, luật và bàn xem thử có nhãn demo |
| Giới thiệu Nối từ | Tạo phòng public/private, luật NT-VI-1 và phòng công khai đúng game |
| Giới thiệu Caro | Tạo phòng public/private, luật HQ-CARO-1 và phòng công khai đúng game |
| Phòng chờ | Mã/link sao chép, ghế, host, kết nối, ready; chỉ host bắt đầu khi đủ điều kiện |
| Bàn desktop | Bài mình dưới, đối thủ quanh bàn chỉ hiện tên/số lá, pile và màu/chiều/lượt giữa bàn |
| Bàn mobile | Đối thủ gọn phía trên, felt gọn, tray trên tay bài; hand chồng theo hàng, cuộn dọc khi dài |
| Kết quả | Hiện thắng ngay sau lá cuối hợp lệ, host chọn chơi lại trong phòng |
| Bàn Nối từ | Dải người chơi ngang, timeline ô chữ theo lượt, draft/vote inline và dock nhập ở đáy; lịch sử tối đa theo snapshot |
| Bàn Caro | Hai người với avatar/tên/ký hiệu, bàn 15×15, lượt/thời gian server, nước cuối/dãy thắng; mobile có chọn rồi xác nhận, zoom/pan riêng và dialog chịu thua |

Bàn ban đầu chưa có lá bỏ, hiện “Chờ lá đầu” và “Chưa mở bàn”. Sau khi đánh, lá bỏ nằm lại theo snapshot server.

## Thao tác và trạng thái

- Desktop click lá hợp lệ để đánh. Mobile chạm lần đầu nâng lá, chạm lại cùng lá để đánh; không cần double-tap nhanh hoặc nút xác nhận riêng. Chạm lá khác đổi lựa chọn; cuộn tay bài hủy lựa chọn.
- Wild/+4 mở dialog chọn màu trước khi gửi intent; chọn màu chưa phải một lượt riêng. Không challenge +4.
- Lá sai tối và disabled; lá hợp lệ sáng. Lá chọn nâng khoảng 15px trên mobile; không dùng ring trang trí dày. Khi không có lá phù hợp, nhấn nút Rút bằng nền/viền nhẹ và lời chỉ dẫn.
- Tray giữ chỗ cho UNO, bắt UNO, phạt, nhận bài và giữ lá; chỉ hiển thị thao tác phù hợp. Thông báo không đẩy chiều cao bàn hoặc che hand.
- Màu hiện tại có cả chữ và viền; chiều có mũi tên kèm chữ, lượt có nhãn rõ. Mất mạng hiện trạng thái/pause và hạn chờ; phòng đóng đưa về sảnh với lý do.
- Giữ nút và vùng chạm dễ bấm; không chỉ dùng hover/kéo thả. Không để toàn trang tràn ngang hoặc thu nhỏ cả bàn desktop lên mobile.

## Motion

- Lá tự vẽ, số đen, radius cơ sở 6px. Lá số bay nhẹ; +2/+4/Skip bay rồi đập/rung, tăng lực theo tổng phạt có trần. Reverse nhấn chiều mới.
- Overlay bay và FLIP hand chỉ trình bày sự kiện server xác nhận. `game:effect` phải khớp room/game revision, chống trùng và bỏ event cũ; animation không khóa lượt hay quyết định luật.
- Rung lớp hình ảnh bàn và chồng rút; hit target, tray, hand, header và dialog đứng yên. Dọn overlay/WAAPI khi đổi event, resize/cuộn, tab nền, disconnect, rematch hoặc unmount.
- Checkbox “Giảm hiệu ứng” lưu localStorage, kết hợp OS reduced motion. Giữ trạng thái cuối rõ ràng khi tắt motion; không replay hiệu ứng khi đổi preference. Thông số và giới hạn xem trong báo cáo hợp nhất.
- Nối từ dùng chuyển cảnh nhẹ; countdown không đọc liên tục và không dùng animation quyết định lượt. Draft có nhãn “Đang nhập”, không trộn với lịch sử. Proposal đang chờ vote được phân biệt bằng chữ/viền ngoài màu.

## Nối từ

- Bàn dùng dòng diễn biến dọc: từ mồi/lịch sử được trình bày thành bubble, lượt mình bên phải và lượt người khác bên trái; player strip ngang có thể cuộn riêng khi 5–6 ghế. Dock nhập ở dưới timeline.
- Các tiếng trình bày thành nhóm ô chữ nhỏ, bo 4px; mỗi grapheme tiếng Việt đã NFC là một ô, giữ nguyên dấu. Tiếng cuối nổi bật bằng nền/nhãn, không chỉ bằng màu. Input vẫn là một ô văn bản thật hỗ trợ IME; không có input từng chữ.
- Khi lượt người khác, có thể thấy draft tạm thời với nhãn rõ; draft không được trình bày như từ đã chốt. Người bị loại vẫn xem tiếp nhưng không có ô gửi/vote.
- Khi server tạo proposal, hiện từ đề xuất inline với trạng thái chưa chấp nhận, tally/thời gian và chỉ nút phù hợp cho người có quyền. Một hàng active có key theo game/lượt xuyên suốt nhập → vote → bác → nhập lại. Khi bị bác, chỉ grapheme tiếng thứ hai vỡ đồng thời ngoài flow tại vị trí cũ; prefix, bubble và hàng vẫn tồn tại để nhập lại ngay. Không tạo thêm hàng pending/rejected hoặc xóa bubble sau effect. Dock giữ footprint ổn định giữa vote và nhập để hàng không dịch trên mobile. Lịch sử chỉ nhận từ server. Đã kiểm tra DOM headless; Terra còn thử hai browser và thiết bị thật. Tổng kết tại [hồ sơ Nối từ](./reports/noitu/summary.md).
- Hàng active rộng tối đa 640 px trên desktop; chữ đang nhập/vote không xuống dòng, cuộn ngang trong bubble khi dài. Fragment bác bỏ ở ngoài vùng cuộn để không bị cắt. Snapshot vote/reject tới liền nhau vẫn tạo hiệu ứng từ dữ liệu proposal; reduced motion vẫn tắt hiệu ứng. Chi tiết kiểm tra ở [tổng kết Nối từ](./reports/noitu/summary.md).
- Timeline cuộn độc lập bằng `scrollTop` của chính timeline; mặc định bám cuối, giữ chế độ bám qua resize/bàn phím và draft. Chỉ thao tác cuộn lên chủ động mới dừng bám; nút “Về lượt hiện tại” đưa về cuối. Gửi thành công và lượt người đang chơi trở lại sau bác bỏ bật bám lại; lỗi gửi giữ input/caret.
- Theo dõi thay đổi timeline bằng `ResizeObserver` và `visualViewport`, gom cập nhật theo animation frame, dọn observer/listener/RAF. Không dùng `scrollIntoView` để dịch trang bên ngoài hoặc cuộn mượt mỗi phím/countdown.
- Tôn trọng vùng an toàn/bàn phím động trên mobile; không để dock che input hoặc focus. Nút gửi/vote/chịu thua có hit target dễ chạm và focus-visible. Chịu thua dùng dialog trong web, focus mặc định “Tiếp tục chơi”, hỗ trợ Tab/Escape/backdrop, kiểm tra lại lượt/kết nối và khóa gửi lặp.
- Mọi thông tin về từ điển ghi “Từ điển thử nghiệm”; không tự dựng nghĩa hoặc quảng bá dữ liệu đã được duyệt.

## Caro HQ-CARO-1

- Phòng chờ có lựa chọn 4/5/6 quân để thắng; chỉ host chỉnh. Đổi mục tiêu yêu cầu khách sẵn sàng lại. Bàn/kết quả hiển thị mục tiêu từ server.

- Hai người nhìn thấy bàn 15×15 và ký hiệu X/O; dấu nước cuối cùng và dãy thắng được nhấn mạnh bằng hình dạng/viền, không chỉ bằng màu.
- Desktop đặt quân bằng một lần bấm. Thiết bị cảm ứng chọn ô rồi xác nhận nước để tránh đặt nhầm khi phóng/di chuyển bàn; client chỉ gửi action, server xác thực ô, lượt và deadline.
- Bàn có chế độ vừa khung và phóng 2×; vùng phóng hỗ trợ pan, có nút thu về toàn bàn. Layout mobile không kéo rộng toàn trang.
- Thanh lượt/thời gian lấy từ snapshot server, tạm dừng khi room pause. UI chỉ trình bày countdown; hết giờ và người thắng do server quyết định.
- Khi ván kết thúc, hiện người thắng hoặc hòa, lý do, dãy thắng và nút chơi lại cho host. Chịu thua qua dialog web có focus management; mất kết nối hiển thị trạng thái tạm dừng.
- Hỗ trợ bàn phím, tên ô theo hàng/cột, vùng bàn focusable và reduced motion. Trạng thái thắng vẫn rõ khi giảm/tắt animation.

## Accessibility và skill

- Lá có accessible name gồm màu/số/loại; số/ký hiệu bổ sung cho màu. Focus-visible bàn phím mảnh, rõ; pointer/touch không giữ halo.
- Dialog có quản lý focus và trả focus; Escape theo trạng thái hợp lệ. Thông báo dùng live region có kiểm soát, không đọc lại cả hand mỗi snapshot.
- Kiểm tra contrast, zoom, safe area, keyboard và reduced motion trên browser thật trước nghiệm thu. Build không chứng minh UI đạt.
- Dùng ui-ux-pro-max cho phân cấp, responsive, focus và motion. Lucian cần search catalog/get trước khi port; giữ MIT và ánh xạ token vào theme.
- Đã port [Lucian #008 Copy button](https://lucianlabs.dev/uxui-prompt/#008) tại `src/components/CopyInviteCard.tsx` và [#033 Inline title editing](https://lucianlabs.dev/uxui-prompt/#033) tại `src/components/InlineNicknameEdit.tsx`. Không dùng thành phần catalog không khớp chỉ để thêm hiệu ứng.

## Nhận diện Hội Quậy

Icon vector tự vẽ gồm hai lá bài lệch nhau và dấu sét trắng; dùng chung `public/favicon.svg` cho header/favicon. Không dùng logo UNO/Mattel. Đỏ là màu thương hiệu, màu bốn loại bài và màu trạng thái giữ ý nghĩa riêng. Namespace `@banban`, khóa localStorage và mã luật giữ nguyên để không làm mất phiên hay đổi hợp đồng kỹ thuật.

Hồ sơ mới nhận tên và hình ngẫu nhiên từ 12 lựa chọn tự vẽ. Hộp đổi tên có lưới chọn hình, nhãn tên từng hình, trạng thái đã chọn và focus rõ. Hình được đồng bộ theo ghế khi tạo/tham gia phòng và khi nối lại; sửa tên/hình trong phòng áp dụng cho phòng tiếp theo.

Header mobile hiển thị avatar và biệt danh trong cùng một nút; chạm vào nút mở hộp đổi tên/hình. Tên dài được cắt bằng dấu ba chấm, không che các mục điều hướng.

Nối từ: ô nhập của người đang lượt có thanh thời gian phía trên. Thanh dùng thời lượng do server công bố và cùng số giây đang hiển thị; đổi màu khi còn 5 giây, giữ nguyên lúc ván tạm dừng. Không hiển thị câu chú thích từ điển ở cuối timeline.

Trang giới thiệu game giữ tên, số người, chọn riêng tư/công khai, tạo phòng và luật chơi. Danh sách phòng công khai cho vào trực tiếp bằng cách bấm cả hàng. Trong phòng chờ, mã phòng có thao tác sao chép mã và chia sẻ link ở sát bên; share sheet hệ thống được dùng khi có, còn lại sao chép link.

Mỗi hàng phòng công khai hiển thị avatar và tên của chủ phòng từ dữ liệu server; hình dùng chung bộ SVG người chơi, không dùng icon minh họa cố định.

Bàn UNO hiển thị mã phòng và tên game nổi rõ ở dòng trên. Nhãn dưới lá bài được ẩn, tên truy cập vẫn nằm ở nút. Trên mobile, sau khi chọn lá chỉ có trạng thái lá nâng lên, không hiện câu hướng dẫn lặp; bàn pha màu hiện tại nhẹ hơn viền. Bảng kết quả bỏ biểu tượng trang trí và nhấn tên người thắng bằng màu thương hiệu.
