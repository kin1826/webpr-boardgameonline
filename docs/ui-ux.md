# Định hướng UI/UX và sử dụng skill

## Sửa bàn chơi BB-UNO-1 — đã triển khai, chờ Terra nghiệm thu

Theo `uno-rules.md` và `uno-fix-plan.md`: lá sai tối nhưng đọc được và disabled; không có lá hợp lệ highlight Rút; đang phạt chỉ cho cộng phù hợp hoặc Nhận N lá; không challenge. Viền bàn + chữ/ký hiệu theo màu hiện tại, dialog chọn màu có focus rõ. Phòng đóng thông báo và đưa người chơi về sảnh; offline tạm thời có trạng thái riêng. Bàn live, bản xem thử và màn luật đã được cập nhật. Test và giới hạn xác minh ở [sol-uno-fix-report.md](./sol-uno-fix-report.md).

## Motion UNO — đã triển khai, chờ kiểm tra trực quan

Lá cơ sở dùng radius 6px. Lá số/rút nhẹ, +2/+4/Bỏ lượt đập và nhấn viền bàn, Reverse xoay ký hiệu, chia bài/rút bài/UNO/kết quả có phản hồi ngắn. Tùy chọn “Giảm hiệu ứng” lưu localStorage; `prefers-reduced-motion` tắt animation và rung. Server phát `game:effect` sau snapshot; client kiểm tra eventId/revision và bỏ trùng/cũ. Chi tiết test và giới hạn browser trong [uno-motion-report.md](./uno-motion-report.md).

## Motion UNO v2 — đã code, chờ Terra kiểm tra trực quan

Rung scene felt theo tổng phạt, lá đánh bay từ người chơi, tray action dưới felt và tay bài mobile xếp hàng chồng với xác nhận tap. Code/test/build và giới hạn browser được ghi trong [uno-motion-v2-report.md](./uno-motion-v2-report.md).

## Điều chỉnh trang chủ ngày 13/11/2026 — đã triển khai

Đặc tả và kết quả: [Nâng cấp trang chủ — Đêm tím câu lạc bộ](./homepage-redesign.md). Phần trang chủ trong code đã được cập nhật; các mô tả trang chủ và token cũ bên dưới chỉ lưu lịch sử quyết định, còn đặc tả mới là hiện trạng.

Hướng thị giác: một bàn chơi mang chất poster câu lạc bộ, bố cục bất đối xứng, minh họa bài riêng, tím mực và chữ sáng. Giữ phân cấp thao tác rõ; glow, noise và float chỉ hỗ trợ không khí. Không dùng bố cục landing quảng cáo kéo dài hoặc dữ liệu hoạt động giả.

Trạng thái: palette B đã chọn và giao diện prototype đã dựng; chưa đo tương phản tự động hoặc thử trên điện thoại vật lý.

## Cơ sở lựa chọn

Đã đọc guide tại `/Users/admin/.agents/skills/SKILLS_GUIDE.md`, hai `SKILL.md` và `lucian-uxui/references/porting.md`.

- **ui-ux-pro-max**: tra `multiplayer card game dark --design-system`; dữ liệu trả về hướng nền tối và bàn xanh nhưng không khớp palette B. Đề xuất showcase/3D/WebGL không phù hợp luồng vào chơi nhanh và yêu cầu không WebGL nên không áp dụng. Người dùng chọn palette B. Tra bổ sung `game interface minimal --domain style` có kết quả minimalism; chỉ lấy phân cấp gọn và motion nhẹ, không bê bố cục doanh nghiệp vào bàn chơi.
- Tra UX `touch target keyboard focus` trả về hướng dẫn vùng chạm và focus. Chọn mục tiêu nút 44×44 CSS px cho sản phẩm, không gọi đó là mức WCAG bắt buộc cho mọi trường hợp.
- Tra React `state rendering accessibility`, rồi thử lại `state`, đều không có kết quả. Hướng dẫn React trong kế hoạch là lựa chọn kỹ thuật thông thường; không tuyên bố được xác minh bởi dữ liệu skill.
- **lucian-uxui**: cung cấp hành vi thành phần cụ thể, giữ hình dáng/motion và ánh xạ màu vào token tổng thể. Không giao engine hoặc luật cho skill UI.
- Chưa dùng `find-skills`: hai skill đã đủ cho tài liệu UI, công việc backend/kiểm thử dùng năng lực lập trình chung. Không cài skill mới.

## Palette đã chọn: B — Đêm tím

Người dùng chọn palette B ngày 12/11/2026 sau khi xem ba đề xuất. Prototype áp dụng nền `#12101D`, bàn `#29213F`, accent `#B9A2FF`; màu lá đỏ/vàng/xanh lá/xanh dương giữ riêng để nhận diện bài. Bề mặt, chữ, viền, mint và coral được ánh xạ qua custom properties trong `src/styles/theme.css`.

## Thiết kế tổng thể

Phong cách game night, trọng tâm là bàn và tay bài. Trang chủ chỉ giới thiệu ngắn cùng UNO và form; không cần social proof, bảng giá hoặc nhiều CTA.

| Vai trò | Giá trị đề xuất |
|---|---|
| Nền trang | `#12101D` |
| Surface/panel | `#1A1728` / `#211D33` |
| Bàn | `#29213F` |
| Chữ chính/phụ | `#F6F2FF` / `#AAA3BC` |
| CTA | `#B9A2FF`, chữ tím than |
| Màu lá | Đỏ, vàng, xanh lá, xanh dương; có tên màu/ký hiệu |
| Font | Inter có Vietnamese subset hoặc system sans fallback |
| Khoảng cách | Thang 4/8/12/16/24/32 px |

Palette được đưa vào prototype; cần đo cặp chữ/nền và trạng thái focus/disabled trước nghiệm thu sản phẩm. Font đang dùng system stack Inter fallback để tránh phụ thuộc mạng.

## Màn hình và trạng thái

1. **Trang chủ:** UNO, tên, Tạo phòng, Tham gia bằng mã; link mời điền mã sẵn; lỗi dưới field; Luật chơi và tuyên bố không chính thức.
2. **Phòng chờ:** mã/link, copy feedback, 2–6 ghế, host, online/offline và ready. Nút Bắt đầu chỉ dành host, ghi điều kiện thiếu bằng lời.
3. **Bàn desktop:** bài mình ở dưới; đối thủ quanh bàn, tên và số lá; giữa là chồng rút, lá bỏ trên cùng, màu bằng chữ, chiều bằng biểu tượng kèm nhãn; lượt nổi bật.
4. **Bàn mobile:** đối thủ xếp vùng trên; bàn trung tâm gọn; hand trong vùng cuộn ngang riêng có chỉ dẫn, trang không tràn ngang. Không ép toàn bộ hand thành lá quá nhỏ khi bị phạt nhiều.
5. **Hành động:** chạm lá hợp lệ; Wild mở chọn màu trước khi gửi. Có nút rút/giữ lá, hô UNO, bắt UNO và nhận/cộng phạt đúng phase. Không có challenge +4 trong BB-UNO-1. Không chỉ dùng hover hoặc kéo thả.
6. **Mất mạng:** banner bền vững, phân biệt đang kết nối/đang nối lại/phiên bị thay/phòng đã mất. Khi pause vô hiệu hóa hành động và nêu hạn nối lại từ server.
7. **Kết quả:** tên người thắng hoặc lý do hủy/bế tắc; host về chờ chơi lại, người khác thấy trạng thái chờ host.
8. **Luật chơi:** bản tóm tắt Việt từ hồ sơ luật đã chốt, khác biệt số hóa và nguồn; đọc được cả ngoài phòng.

## Thành phần Lucian đã port vào prototype

Catalog CLI dùng cache ngày 07/11/2026 do mạng nguồn không khả dụng ngày khảo sát. `get` đã được chạy sau khi cấp quyền mạng cho lệnh CLI và mã/giấy phép được xem trước khi port.

| Ứng viên | Vị trí dự kiến | Điều kiện lựa chọn |
|---|---|---|
| [#008 Copy button that turns into a check](https://lucianlabs.dev/uxui-prompt/#008) | Chọn link/mã/cả hai rồi sao chép trong phòng chờ | Đã port vào `src/components/CopyInviteCard.tsx`; nội dung Việt; có clipboard fallback |
| [#033 Inline title editing](https://lucianlabs.dev/uxui-prompt/#033) | Sửa biệt danh trong hộp thoại | Đã port vào `src/components/InlineNicknameEdit.tsx`; Enter lưu, Escape hủy, lưu localStorage qua component cha |

Tra `loading reconnect` không có ứng viên phù hợp: kết quả là nút liquid glass và thẻ đăng nhập. Prototype tự thiết kế banner reconnect theo token cho bàn mẫu.

Khi tiếp tục UI: search theo từng phần → chọn ID → get đúng ID → tokens một lần → rà mã → port JSX/plain scoped CSS → kết nối handler thật. Các phần tử đã dùng giữ comment MIT đầu file và chuyển động CSS gốc. Copy timer được cleanup khi unmount; thử build chạy với React StrictMode.

## Tiêu chí tương tác

- Body 16 px, label rõ; biểu tượng SVG có tên truy cập. Mỗi lá đọc được loại/số/màu qua accessible name.
- Nút khoảng 44×44 px trở lên; khoảng cách đủ chạm; lá trong hand không bị lớp khác che điểm chạm. Nếu cần mô hình chạm để chọn rồi xác nhận, phải kiểm tra tốc độ và không thêm trì hoãn vào cửa sổ UNO.
- Focus rõ, không bị thanh tay bài che; dialog có quản lý focus, Escape theo trạng thái hợp lệ, trả focus về vị trí cũ. Không bẫy người dùng trong dialog mạng.
- `aria-live` thông báo lượt/lỗi có kiểm soát; không đọc lại toàn bộ tay bài mỗi snapshot.
- Hiệu ứng lá tự vẽ ngắn, ưu tiên transform/opacity; reduced motion vẫn có trạng thái cuối đầy đủ. Animation không quyết định hợp lệ hoặc thời gian bắt UNO.
- Ghi chú lịch sử của prototype trước realtime: đã mở Chrome ở desktop và viewport 390×844 để kiểm tra bàn không tràn ngang, tay bài cuộn riêng. Đợt Sol không mở được browser vì browser host unavailable; giao diện hiện hành vẫn cần kiểm tra lại theo [báo cáo kiểm chứng](./verification-report.md), gồm 360/375/768/1280/1440 px, safe area, zoom và tương phản định lượng.
