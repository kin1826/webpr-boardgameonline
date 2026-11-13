# Bàn Bạn — đặc tả nâng cấp trang chủ

Ngày: 13/11/2026. Trạng thái: **đã triển khai UI trang chủ**.

## 1. Phạm vi và code đã khảo sát

Stack thực tế: React 19 + TypeScript + Vite, CSS thuần và CSS custom properties; không có Tailwind. Đã đọc `AGENTS.md`, `src/App.tsx`, `src/styles/app.css`, `src/styles/theme.css` và tài liệu UI/UX hiện có.

Giữ hành vi đổi tên, lưu biệt danh, nhập mã, tham gia phòng và chọn UNO. Giữ trang giới thiệu UNO, phòng chờ, bàn demo và luật. Không đổi game engine hoặc mở rộng multiplayer. Dữ liệu mẫu luôn được nhận diện là “Bản xem thử”.

Các file đã sửa:

| File | Phạm vi dự kiến |
|---|---|
| `src/App.tsx` | JSX trang chủ, trang trí hero, bố cục game, trạng thái đánh dấu quan tâm cục bộ; nối CTA tạo phòng vào handler `createRoom` hiện có |
| `src/styles/app.css` | Style trang chủ: footer thẻ, hero, grid, responsive, hover và motion; scope màu CTA để không đổi trang phòng/bàn |
| `src/styles/theme.css` | Token chữ phụ, CTA, bo góc, bóng và motion riêng cho trang chủ |
| `docs/ui-ux.md` và tài liệu này | Ghi đặc tả và trạng thái triển khai |

Không đổi tên hoặc nghĩa của các handler nghiệp vụ. CTA “Tạo phòng UNO” trên trang chủ gọi hành vi tạo phòng mẫu hiện có; “Chơi UNO” trên thẻ vẫn dẫn đến giới thiệu UNO. Đây là thêm lối truy cập tới hành vi có sẵn, không tự tạo phòng realtime.

## 2. Ý tưởng chủ đạo: Đêm tím câu lạc bộ

Trang chủ giống một tấm poster mời cả hội vào bàn, kết hợp một bàn bày trò chơi. Cá tính đến từ tỷ lệ, typography và minh họa có chủ đích, thay vì thêm nhiều hiệu ứng độc lập.

- Nền tím mực, bề mặt hơi có hạt; chữ trắng ngà thay cho trắng chói.
- Headline đậm, hai dòng, ưu tiên nhịp tiếng Việt. Chỉ một cụm từ nhấn màu tím sáng, không phủ gradient lên cả tiêu đề.
- Minh họa cùng một ngôn ngữ hình học: nét dày, góc bài rõ, bóng có hướng, hình khối dễ nhận diện. Tự vẽ mặt bài; không dùng logo hoặc oval nhận diện của UNO làm artwork trang chủ.
- Một vài chi tiết riêng: nhãn game dạng thẻ gài góc, đường viền kép gợi mép bàn, đường nối hình học giữa các từ. Không biến mọi panel thành một hộp bo tròn giống nhau.
- Nội dung ngắn, gần gũi; tránh nhãn tiếng Anh và thông số hoạt động giả. Chỉ báo trạng thái “Bản xem thử” không dùng chấm xanh gây hiểu là phòng đang online.

Không chọn mặc định glassmorphism, dãy pill dày đặc, gradient trên mọi card, hiệu ứng đánh máy, hoặc scroll reveal che nội dung trước khi người dùng cuộn.

## 3. Bước 1 — sửa lỗi và khả năng đọc

### Footer thẻ UNO

Hiện tại `.game-play` dùng `position: absolute` và mô tả chừa `padding-right: 74px`; cách này không bảo đảm đủ chỗ khi chữ xuống dòng.

Footer mới có hai cột flex: vùng tên/mô tả `flex: 1; min-width: 0`, nút `flex-shrink: 0`, gap 16 px. Bỏ đặt tuyệt đối cho nút và bỏ phần đệm giả của mô tả. Footer nằm trong luồng bố cục; vùng minh họa và footer không đè nhau. Ở màn quá hẹp, chuyển footer thành hai hàng và giữ nút cao tối thiểu 44 px.

### Chữ và form

- Chữ phụ trang chủ dùng `#B4B0CF`; nội dung phụ 14 px, nhãn nhỏ không dưới 13 px. Mô tả 14–16 px, line-height 1.5–1.6.
- Headline: letter-spacing `-0.02em`, line-height 1.12–1.16; tăng lên khoảng 1.18 trên mobile nếu dấu cần thêm khoảng. Không dùng chiều cao cố định hoặc overflow cắt dấu.
- Bỏ toàn bộ khối “Biệt danh của bạn / Đổi tên ở góc trên” trong form. Header tiếp tục hiển thị biệt danh và nút “Đổi tên”.
- Mã phòng có nhãn nhìn thấy được, không chỉ placeholder; Enter tiếp tục tham gia như hiện tại. Giữ phản hồi lỗi hiện có, không tự nhận mã là hợp lệ trên server.

Kết quả cần báo sau bước này: footer không chồng chữ/nút, chữ phụ đọc rõ, dấu tiếng Việt đủ khoảng, form hết phần biệt danh lặp.

## 4. Bước 2 — phân cấp hành động

Desktop đặt nhóm hành động ở giữa, theo thứ tự đọc:

1. Nút chính **“Tạo phòng UNO”**, cao khoảng 52–56 px, độ rộng đủ làm điểm neo thị giác.
2. Chữ “hoặc”, màu phụ, không đóng vai trò đường phân cách quá nổi bật.
3. Nhóm nhập mã viền mảnh, gồm nhãn **“Nhập mã phòng”**, ô nhập và nút ghost **“Vào”**, cao tương đương vùng nhập.

Trong hero chỉ nút tạo phòng có nền đặc/gradient. Nút “Vào” không tự chuyển thành một CTA tím thứ hai. Bên dưới nhóm nhập giữ câu “Có mã từ bạn bè? Nhập vào để tham gia.”

CTA dùng gradient `#A78BFA → #7C5CF0`, shadow tím tập trung, không nhấp nháy. Cần đo tương phản chữ trên toàn vùng gradient; không mặc định chữ trắng sẽ đạt. Chọn chữ tím đen gần `#080611` nếu đạt kiểm chứng, hoặc điều chỉnh độ sáng stop để đạt 4.5:1 trước khi nghiệm thu.

Dưới nhóm hành động đặt ba tín hiệu ngắn: “Không cần tài khoản”, “Chỉ cần một mã phòng”, “Chơi ngay trên trình duyệt”. Trình bày như dòng lợi ích có ký hiệu nhỏ hoặc chip ít viền, không như ba nút chức năng. Bỏ dòng lợi ích trùng ở chân trang.

Kết quả cần báo: một CTA chính rõ, tham gia bằng mã vẫn dễ tìm, tất cả handler có sẵn còn hoạt động.

## 5. Bước 3 — hero có chiều sâu

Giữ câu **“Bạn bè đủ mặt, vào bàn thôi.”**. Hero đủ gọn để đầu lưới trò chơi xuất hiện ngay ở desktop 1440×900; ưu tiên giảm khoảng đệm trước khi giảm chữ hoặc giấu game.

- Một radial glow tím sau headline; blur khoảng 60 px, độ sáng thấp, không kéo theo con trỏ và không nằm trước chữ.
- Ba lá bài đỏ 5, xanh dương ↺, vàng 7 phân bố hai bên headline; không chạm chữ, form hoặc focus ring. Lá bài có nét và tỷ lệ nhất quán với minh họa trong thẻ game.
- Float chu kỳ 6 giây, lệch pha; biên độ khoảng 4–8 px, chỉ transform. Không thêm parallax đồng thời.
- Noise SVG tĩnh phủ nền ở opacity khoảng 0.04, `pointer-events: none`; giới hạn trong bề mặt trang chủ. Không dùng texture tải từ ngoài.
- Ở mobile chỉ giữ tối đa một lá nhỏ ở góc trống, hoặc ẩn hoàn toàn nếu ảnh hưởng thao tác. Không thu nhỏ toàn bộ cụm desktop.
- Trang trí có `aria-hidden`, không vào thứ tự Tab. Reduced motion tắt float và dịch chuyển, giữ lá ở vị trí tĩnh.

Kết quả cần báo: hero có chiều sâu, không cản đọc và nhập mã, reduced motion có trạng thái tĩnh đầy đủ.

## 6. Bước 4 — lưới game có cá tính

### Desktop từ khoảng 1100 px

Grid ba cột tỷ lệ `1.5fr / 1fr / 1fr`, hai hàng. UNO chiếm cột một, hai hàng, min-height khoảng 440 px. Caro ở cột hai hàng một, Gián điệp ở cột ba hàng một; Nối từ trải hai cột ở hàng hai. Cách này giải quyết đủ bốn game mà không để lại một ô rỗng vô nghĩa.

Thứ tự nội dung trong DOM: UNO → Caro → Nối từ → Gián điệp. Không dùng `tabindex` dương để ép thứ tự; kiểm tra focus đi qua các vùng có sắp xếp thị giác khác nhau và điều chỉnh grid nếu gây khó theo dõi.

| Game | Bản sắc minh họa | Nội dung/thao tác |
|---|---|---|
| UNO | Ba lá tự vẽ lớn, có khoảng âm rõ; xòe nhẹ khi hover/focus | “2–6 người”, mô tả, “Chơi UNO”; trạng thái “Bản xem thử” |
| Caro | Nét ×/○ sáng, bàn cờ gọn, một nước được nhấn | “Sắp ra mắt” ở góc, nút quan tâm nhỏ |
| Nối từ | Thẻ từ và nét nối, ví dụ đúng cách nối “bạn bè → bè bạn” | “Sắp ra mắt” ở góc, nút quan tâm nhỏ |
| Gián điệp | Những thẻ giống nhau với một dấu hiệu lệch nhẹ, gợi suy luận | “Sắp ra mắt” ở góc, nút quan tâm nhỏ |

Game chưa ra mắt có minh họa rõ, không giảm opacity toàn thẻ. Badge góc là nơi duy nhất ghi “Sắp ra mắt”; chân thẻ không lặp nhãn. Những số người ở game tương lai, nếu giữ, phải được coi là dự kiến; có thể bỏ để tránh cam kết luật chưa thiết kế.

Nút “Báo tôi khi ra mắt” chỉ đánh dấu sự quan tâm tại trình duyệt, có thể bấm bỏ. Phản hồi rõ: **“Đã đánh dấu trên máy này. Bản xem thử chưa gửi thông báo.”** Không xin quyền notification hoặc hiển thị “Đã đăng ký nhận tin”. Không bắt người dùng nhập email khi chưa có hệ thống nhận và xử lý.

### Hover và focus

- Card nâng tối đa 8 px, border tím sáng và shadow tím vừa phải; transition khoảng 220–280 ms, easing `cubic-bezier(.2,.8,.2,1)`.
- Lá UNO xòe trong vùng minh họa, không lấn sang nút hoặc card bên cạnh. Focus trong thẻ cũng kích hoạt trạng thái nhấn phù hợp.
- Radial sáng theo con trỏ là phần bổ sung cuối cùng, chỉ cho thiết bị `hover: hover` và `pointer: fine`. Giới hạn cập nhật `--mx`, `--my`, không dùng React state mỗi lần pointermove, không cài thư viện.
- Khi giảm chuyển động: không nâng/xòe/chạy sáng; vẫn đổi viền hoặc màu để có phản hồi. Touch không phụ thuộc hover.
- Card chứa một nút rõ ràng, không lồng button trong button và không tạo vùng click lớn có nhiều thao tác xung đột.

Kết quả cần báo: UNO nổi bật, cả ba trò tương lai có minh họa riêng, trạng thái quan tâm trung thực và không có hành động giả.

## 7. Token và responsive

Token đề xuất cho trang chủ, chưa ghi vào CSS:

| Vai trò | Giá trị/hướng |
|---|---|
| Nền / bề mặt / bề mặt nâng | `#12101D` / `#1A1728` / `#211D33` |
| Chữ chính / phụ | `#F6F2FF` / `#B4B0CF` |
| Accent hiện có | `#B9A2FF` |
| Gradient CTA | `#A78BFA → #7C5CF0`, cần đo cặp chữ |
| Focus | Viền 2 px màu lavender, offset 3–4 px |
| Bo góc | Card 20–24 px; input/button 10–14 px; nhãn có một góc riêng |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 / 48 px |
| Motion | 240 ms cho hover; 6 s cho float; reduced motion tĩnh |
| Bóng | Tách token bóng vật thể, card hover và CTA; không dùng chung glow cho mọi thứ |

Giữ system sans stack hiện có ở bản đầu; cân nhắc Be Vietnam Pro tự lưu trữ cho headline ở vòng thiết kế sau, chỉ chọn sau khi so sánh chữ có dấu và chi phí tải. Không thêm font từ mạng chỉ để có hiệu ứng khác lạ.

- **Desktop:** max-width khoảng 1280 px, gutter 32–48 px; hero khoảng 330–380 px tính cả padding, phần đầu game grid thấy được ở màn 1440×900. Ở màn thấp, chấp nhận cuộn để xem hết thẻ, không ép toàn trang vào một khung.
- **Tablet 768–1099 px:** grid hai cột; UNO trải hai cột, các thẻ còn lại xếp theo nội dung. Nhóm hành động xuống dòng khi thiếu chỗ.
- **Mobile 360–767 px:** header gọn vẫn thấy tên và “Đổi tên”; nội dung → CTA tạo phòng → “hoặc” → nhập mã → tín hiệu ngắn → game grid một cột. UNO cao theo nội dung, không giữ min-height desktop. Gutter 16–20 px, không có scroll ngang của toàn trang.
- Chữ không bị cắt khi zoom 200%, input có `min-width: 0`, form và grid cho phép co thực. Không che lỗi overflow bằng cách chỉ thêm `overflow-x: hidden` vào body.

## 8. Skill và thành phần

Đã đọc `SKILLS_GUIDE.md`, `ui-ux-pro-max/SKILL.md` và `lucian-uxui/SKILL.md` trong `/Users/admin/.agents/skills/`.

- `ui-ux-pro-max`: tra `board game lounge tactile dark --design-system` trả về 3D/showcase và xanh felt, không phù hợp màu đã chọn, không áp dụng WebGL, CTA lặp hoặc social proof. Tra riêng `editorial tactile asymmetry --domain style` có kết quả Editorial Grid / Magazine và Bauhaus; lấy nguyên tắc tỷ lệ bất đối xứng và hình học rõ, không sao chép phong cách báo chí, font serif, motion hoặc toàn bảng màu.
- `lucian-uxui`: tiếp tục dùng thành phần chỉnh tên đã port từ [#033 Inline title editing](https://lucianlabs.dev/uxui-prompt/#033). Thành phần copy [#008](https://lucianlabs.dev/uxui-prompt/#008) vẫn ở phòng chờ, ngoài phạm vi sửa trang chủ.
- Đã tra catalog `notification button`; CLI dùng cache ngày 07/11/2026 vì mạng nguồn không khả dụng. Kết quả #290 xin quyền notification, #070 stacking toasts và #253 thông báo mua hàng đều không khớp nút quan tâm cục bộ; chưa chọn hoặc port phần tử mới. Không dùng social proof giả hoặc luồng xin quyền notification.
- Khi triển khai, tìm đúng phần tương tác cần thiết; chỉ lấy và chuyển mã từ `get` sau khi chọn phần tử phù hợp. Ánh xạ token, giữ ghi công/giấy phép. Không buộc đưa một mẫu thư viện vào nếu nó làm lệch thiết kế.

## 9. Kiểm chứng và giới hạn

`npm run build` đã chạy thành công sau thay đổi. Đã tính tương phản chữ màu `#06040A` trên gradient CTA; điểm thấp nhất trên màu tím cuối `#7C5CF0` là khoảng 4.51:1. Chưa xác minh trực quan bằng browser: CUA báo host truy cập trình duyệt không khả dụng trong lượt này. Vì vậy không tuyên bố đã kiểm tra ở các viewport, thao tác bàn phím hay flow bằng trình duyệt.

Các bước 1 → 4 đã được làm trong code. Cần kiểm tra trực quan ở 360, 390, 768, 1024 và 1440 px; bàn phím, tên dài, mã phòng dài, zoom 200%, reduced motion và focus ring. So sánh luồng đổi tên, nhập mã/Enter, vào phòng, chọn UNO và tạo phòng. Kiểm tra phòng chờ và bàn demo không bị CSS dùng chung ảnh hưởng.

Những phần cần backend sau này: tạo/join phòng thật, xác nhận mã phòng, trạng thái người chơi và gửi thông báo ra mắt. Lượt nâng cấp UI này chỉ dùng hành vi demo có sẵn và sự quan tâm cục bộ. Không bổ sung số phòng, người online, bảng xếp hạng hoặc cam kết gửi tin.
