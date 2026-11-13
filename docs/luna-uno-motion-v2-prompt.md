# Prompt Luna — motion UNO v2 và mobile hand

Trạng thái: đã thực hiện; xem [báo cáo triển khai và bàn giao Terra](./uno-motion-v2-report.md).

Bạn là Luna, frontend engineer tiếp tục repo Bàn Bạn. Hãy trực tiếp triển khai [uno-motion-v2-plan.md](./uno-motion-v2-plan.md) theo từng chặng. Chức năng hiện tại đã được người dùng chơi thử và thấy ổn; mục tiêu lượt này là lực đánh, đường bay bài, vùng thông báo và bố cục mobile.

## Đọc đầy đủ trước khi sửa

- `AGENTS.md`, `docs/uno-motion-v2-plan.md`.
- `docs/uno-motion-plan.md`, `docs/uno-motion-prompt.md`, `docs/uno-motion-report.md` (lịch sử v1; v2 ưu tiên khi khác quyết định).
- `docs/uno-rules.md`, `docs/architecture.md`, `docs/ui-ux.md`.
- `docs/sol-uno-fix-report.md`, `docs/join-room-fix-plan.md`, `docs/test-plan.md`.
- `~/.agents/skills/SKILLS_GUIDE.md`, `ui-ux-pro-max/SKILL.md`, `lucian-uxui/SKILL.md` tại cùng kho skill.

Đọc code thực tế: `src/App.tsx`, `src/game-effects.ts`, styles, shared event schema, server emitter và test liên quan. Không giả định trạng thái source chỉ từ báo cáo.

Dùng Pro Max cho motion/accessibility/mobile; Lucian cho thành phần tương tác thật sự phù hợp. Search catalog trước khi chọn, chỉ port mã từ get và giữ MIT; đọc porting nếu có port. Không lấy collapsing alert làm tray nhảy chiều cao. Nếu không có ứng viên khớp, dùng component scoped của dự án và ghi lý do.

## Những thay đổi bắt buộc

1. **Tray cố định trên tay bài:** chuyển thông báo UNO/bắt UNO/nhận N, tổng phạt và các thao tác nhận/giữ/hô/bắt khỏi felt. Dành chỗ từ trạng thái chờ, không làm mặt bàn thay kích thước khi thông báo đến. Giữ tất cả thao tác hợp lệ kể cả phạt và UNO cùng tồn tại. Transient callout có thể ẩn; action từ snapshot không được mất vì timer animation. Không để overlay che hand.
2. **Bàn mobile gọn:** bỏ min-height/padding trống quá lớn; thử felt khoảng 250–300px và tinh chỉnh theo viewport. Ưu tiên thấy tray và hàng bài đầu ở 390×844; 360×640 vẫn dùng được bằng cuộn dọc. Không scale cả UI hoặc khóa zoom.
3. **Hand mobile chồng theo hàng:** không horizontal scroll. Phần lộ của mỗi lá đủ chạm, mốc khoảng 44px; 6–7 lá/hàng tùy chiều rộng, thêm hàng cho nhiều lá. Số/ký hiệu/màu vẫn đọc được. Chạm chọn nâng lá, tên đầy đủ và nút xác nhận đánh. Wild qua dialog hiện tại. Selection cardId được reset đúng lúc. Không gửi play ngay từ pointerdown hoặc thao tác cuộn.
4. **Lá bay thật từ actor đến discard:** local cache rect trước khi lá bị snapshot xóa; đối thủ lấy ghế/avatar. Chỉ animate sau event server hợp lệ. Dùng mặt lá công khai, không lấy hand đối thủ. Đo rect một lần, overlay không cản focus/chạm; fallback điểm neo hoặc bỏ effect khi không đo được. Lá số 220–300ms, tiếp đất nhẹ.
5. **Slam và rung theo tổng phạt:** bay → tiếp đất → rung lớp hình ảnh felt thật, không chỉ nét viền. Tổng 2/4/8/12/16 có các mức tăng rõ (tham chiếu plan: 4/6/9/12/14px desktop); trần 14px và 320ms, mobile trần khoảng 8px. Dùng `penaltyTotal` server xác nhận. +4 có slam rõ; Skip có impact riêng; nhận phạt nhẹ hơn cú cộng. Tay bài/tray/nút/dialog không rung. Có clipping/margin chống tràn. Không hàng đợi rung dài hoặc cộng transform vô hạn.
6. **An toàn realtime và reduced motion:** snapshot vẫn là nguồn thật, không chờ animation để chuyển lượt. Giữ dedupe/revision gate của v1. Clear overlay/selection/timer/WAAPI khi disconnect, tab nền, rematch, leave, room close, resize/orientation/unmount. Cả app setting và OS reduced motion có hiệu lực theo yêu cầu giảm mạnh hơn.

Trước khi sửa event, ghi hợp đồng cuối vào plan: có cần thêm actionId công khai để match pending local rect không, schema strict ra sao, test correlation nào. Nếu thêm, chỉ lấy actionId đã validate; không thêm credential, tay bài hoặc bài rút vào payload. Tái sử dụng game:effect; không dựng framework animation hay event bus mới.

## Giữ nguyên

Luật BB-UNO-1, bộ bài/turn/stacking/win/UNO window, server validation, session/reconnect, action ID UUID HTTP LAN fallback, số đen và radius 6px. Không thêm âm thanh, vibration API, database, thư viện nặng hoặc game mới. Không sửa luật để dễ dựng animation.

## Cách thực hiện và kiểm chứng

Báo ngắn source finding, file dự kiến và skill đã chọn. Làm tuần tự theo chặng 1–6 trong plan, mỗi chặng báo kết quả và vấn đề thực tế; không hỏi lại lựa chọn đã được plan chốt.

Thêm test có nghĩa cho intensity tăng/cap/mobile và correlation/dedupe/reset khi thay logic, không test chỉ chuỗi class. Chạy regression engine/session/socket, HTTP LAN test, typecheck và build. Ghi lệnh thật và kết quả thật; không ghi lại số test của report cũ như kết quả mới.

Nếu browser khả dụng, dùng hai session độc lập để kiểm tra số bay từ cả hai người, cộng phạt tăng lực, nhận phạt, Wild/Skip/Reverse, UNO/bắt, reconnect/rematch. Kiểm tra 1440px, 360×640, 390×844, 2/4/6 ghế, 1/7/14/25/40 lá, keyboard, zoom, reduced motion và Safari/mobile nếu có. Chụp tray trước/sau để xác minh không shift; quay video ngắn chứng minh đường bay và rung. Fixture được dùng để dựng tình huống nhưng phải ghi nhãn, không tuyên bố là ván production. Browser không có phải thử truy cập rồi ghi BLOCKED, tiếp tục phần kiểm chứng khác.

Trước bàn giao tự rà: không có label/nút mới trong felt làm nó cao lên; không chỉ rung viền như v1; lực tổng 12 lớn hơn tổng 4; hand không ép nhỏ đến mức không chạm; nhận phạt không làm UI xếp hàng animation từng lá; action stale/invalid không có cú đập thành công.

## Bàn giao Terra

Tạo `docs/uno-motion-v2-report.md` gồm:

- File và thay đổi cụ thể; thông số motion/viewport thật đã dùng.
- Cấu trúc DOM tray/visual scene, chính sách hand selection và xử lý nhiều lá.
- Luồng server event/correlation/privacy, cách chống trùng/cũ và cleanup.
- Test/lệnh/kết quả thực chạy; browser/thiết bị và bằng chứng ảnh/video thật; BLOCKED nếu thiếu.
- Hạng mục chưa đạt, lỗi đã biết và checklist Terra tái hiện/expected.

Cập nhật link/trạng thái trong plan, architecture/UI/test docs phù hợp, giữ báo cáo v1 làm lịch sử. Không tự ghi Terra approve. Cuối lượt báo gọn đã làm gì, đã kiểm tra gì, còn gì Terra phải nghiệm thu.
