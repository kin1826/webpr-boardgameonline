# Bắn tàu — kế hoạch tích hợp vào Hội Quậy

**Hồ sơ kế hoạch ban đầu — đã triển khai theo ủy quyền tiếp theo.** Ngày 16/11/2026. Người dùng sau đó cho phép chạy liên tục phiên 0→5 và dùng các quyết định đề xuất trong hồ sơ làm đặc tả. Bắn tàu hiện đã có engine, backend, API, UI và test; trạng thái kiểm chứng trong [06-implementation.md](./06-implementation.md), checklist còn lại trong [07-qa.md](./07-qa.md). Chưa Terra approve hoặc deploy.

## 1. Bộ hồ sơ và thẩm quyền

- [HQ-BANTAU-1 dự thảo và nguồn Hasbro](../../bantau-rules.md): luật, cấu hình, ngoại lệ timeout và biến thể trí nhớ.
- [UI/UX](./03-ui-ux.md): kế thừa Hội Quậy, layout/touch/đặt tàu, thủy lôi/nước/lửa và reduced motion.
- [Hợp đồng đề xuất](./04-data-contract.md): privacy, schema/intent/snapshot, aim trên server, timer/race.
- [Prompt từng phiên Luna](./02-luna-prompts.md): giới hạn phạm vi và điều kiện dừng.
- Khi thực hiện: ghi baseline vào `05-baseline.md`, cập nhật code theo chặng trong `06-implementation.md`, Terra ghi `07-qa.md`. Chỉ tạo khi thật sự thực hiện, không ghi kết quả dự kiến thành kết quả đạt.
- Chốt xong hoặc được yêu cầu gom: giữ `summary.md` và bằng chứng cần thiết; cập nhật project-summary rồi xóa tài liệu trung gian đã thay thế. Không gom lúc đang mở nếu chưa được giao.

## 2. Ý tưởng sản phẩm

Bắn tàu là game thứ tư, đúng hai người, trận nhiều ván như các game hiện tại. Nhịp chơi: tạo phòng/cấu hình → chờ bạn/ready → xếp tàu kín → nhắm/bắn → phản hồi nước/lửa → thắng ván/+10 → countdown 3 giây → xếp đội hình mới. UI gọn theo Hội Quậy, không mang nguyên phong cách pixel/blue của ảnh tham khảo sang sản phẩm.

Điểm riêng: bắn trượt không để dấu, người chơi phải nhớ; chạm lần đầu nhắm, lần hai cùng ô bắn; hết giờ bắn ô aim đã được server ACK, chưa nhắm random. Âm thanh/hiệu ứng gắn event server. Không làm bot, chat, đội nhiều người, xếp hạng, power-up, Salvo hoặc mở Gián điệp.

## 3. Quyết định được dùng làm đặc tả

Các yêu cầu trực tiếp gồm hai lần nhắm/bắn, thủy lôi rơi/nổ, hit lửa/miss trở lại bình thường, timeout bắn aim hoặc random, chọn số tàu và kế thừa UI hiện tại. Khi giao triển khai, người dùng cho phép dùng các phương án dưới đây làm đặc tả.

Các mặc định dưới đây là đề xuất thêm để luật đầy đủ, chưa coi đã duyệt:

| Điểm cần chốt | Đề xuất |
|---|---|
| Số người/bàn | Đúng 2; 8/10/12, mặc định 10 |
| Đội hình | 3 tàu 3/3/2; 4 tàu 4/3/3/2; 5 tàu 5/4/3/3/2; mặc định 5 |
| Trúng bắn tiếp | Tùy chọn, mặc định bật; miss đổi người |
| Chạm tàu | Tùy chọn, mặc định cấm cả cạnh/chéo; đè ô luôn cấm |
| Xếp tàu | 90 giây, có fleet hợp lệ do server tạo sẵn; hết giờ khóa fleet hợp lệ cuối |
| Bắn lặp | Cho bắn lại miss vì không giữ dấu; chỉ cấm hit/sunk; không gợi ý ô từng trượt |
| Tiết lộ | Hit chưa chìm không lộ loại tàu; sunk chỉ lộ đúng tàu chìm; không reveal toàn đội hình cuối ván |
| Nhịp hiệu ứng | Server resolving 900 ms; không chờ animation client; deadline phát mới bắt đầu sau resolving |
| Trận | Thắng +10, mặc định target50; 3 giây tự sang pha xếp tàu ván mới, settings khóa cả trận |
| Chống treo | 30 phút thời gian active/ván thì hủy trận không điểm; pause không tính; aim không gia hạn TTL |

Những mục này cùng định nghĩa HQ-BANTAU-1; Luna không tự gọi chúng là luật Hasbro. Sau khi người dùng sửa quyết định, cập nhật rules/contract/UI trước code. Riêng timeout tự bắn là ngoại lệ của game này, không đổi timeout loại người ở UNO/Nối từ/Caro.

## 4. Khảo sát source hiện tại

Repo Fix 1.1 đã có catalog/settings, room/session, public listing, private projection UNO, match score/countdown, HTTP LAN và các hiệu ứng. Working tree khi khảo sát sạch theo `git status --short` ở đầu lượt lập kế hoạch. Kết quả 169 test/build là mốc **lượt kiểm định Fix 1.1 trước**, không chạy lại trong phiên chỉ viết tài liệu này.

| Vùng | Mở rộng dự kiến và lý do |
|---|---|
| `packages/bantau/` (chưa tạo) | Engine, fleet presets, placement/shot/timeout, projection, test RNG/clock |
| `packages/shared/src/index.ts` | GAME_CATALOG/GameKey/defaults/settings/RoomSnapshot union; intent/event types, session routing và schema strict |
| `packages/shared/src/public-game-schemas.ts` hoặc file Bắn tàu riêng | Validate player snapshot với ownFleet/targetBoard, không cho raw opponent fleet đi qua |
| `server/src/rooms.ts` | bantau state/timer; startRound vào setup, projection từng seat, placement/private aim, resolution/timeout, pause/resume/cleanup và settleRound |
| `server/src/index.ts` | Sự kiện Bắn tàu, schema/session/ACK/idempotency/rate limit, owner-private update và effect an toàn; API availability/options |
| `src/api/http.ts` | Enum ba game hiện đang hardcode; thêm game và schema options/settings mới |
| `src/api/realtime.ts`, `client.ts` | Typed methods/subscriptions/cleanup cho intent/private-state/effect; không gọi socket từ component |
| `src/App.tsx` | Page/route, thẻ game, GameIntro art, room settings summary, bảng Luật chơi, render bàn đúng game; hiện nhánh else bàn/intro mặc định Caro, nhánh else Luật mặc định UNO |
| `src/components/RoomSettingsDialog.tsx` | Setting theo game và help text timeout. Submit hiện else mặc định Nối từ; không để Bắn tàu rơi vào đó |
| `src/bantau/` (chưa tạo), `src/styles/` | Component board/setup/table/effects, CSS scope, tokens Hội Quậy, responsive/keyboard/reduced motion |
| `src/audio/soundEffects.ts` | Cue rơi/nước/hit/sunk theo volume/mute hiện có; không thay cue game cũ |
| Workspace/config | package manifest/lock, server TypeScript include, package exports và test discovery; giữ Vite proxy/LAN và deploy scripts |
| Test/docs | engine/shared/rooms/HTTP/realtime/client utilities + luật/kiến trúc/phòng/test plan/README/AGENTS khi thực sự tích hợp |

Tìm tất cả enum/ternary/switch theo gameKey trước sửa; sau thêm nhánh tường minh hoặc exhaustive check. Không chỉ thêm thẻ sảnh và để game mới nhận logic Caro/Nối từ.

## 5. Quy trình sáu phiên

### Phiên 0 — khảo sát, baseline và khóa hợp đồng

Đọc tài liệu đầy đủ, git status, xác nhận branch và thay đổi đang có. Chạy typecheck/test/build bằng lệnh repo; integration cần loopback thì dùng đúng quyền và ghi kết quả. Chỉ chỉnh docs: xác nhận nguồn, presets, semantics miss/repeat, setup/private aim/version, race và privacy. Viết bản đồ file/API chính xác trong `05-baseline.md`. Không tạo engine hoặc UI; dừng để người dùng giao phiên 1.

### Phiên 1 — engine và kiểm thử luật

Tạo package thuần và test fleet/placement/aim/fire/timeout/resolving/projection/finish; chưa mở game cho người dùng. RNG/clock tiêm vào, không thêm timer hệ thống vào engine. Kiểm tất cả tổ hợp settings và bảo toàn tàu/hits, privacy hai chiều, random hữu hạn. Chỉ tiến tiếp khi test engine và kiểm tra typecheck phù hợp đạt; ghi báo cáo.

### Phiên 2 — shared, backend, API và multiplayer

Nối catalog/schema/union/room/events/API client, lifecycle và score/countdown hiện tại. Đầu ra là hai client socket độc lập xếp tàu → nhắm/bắn → thắng → tự mở setup ván kế; privacy/timeout/reconnect/dedup được test. Có thể giữ availability false/ẩn thẻ cho tới UI hoàn thiện bằng cơ chế nhỏ theo pattern repo, không tạo hệ feature flag phức tạp. Giữ game cũ compile/chạy; chưa thêm UI Bắn tàu nửa vời lên sảnh.

### Phiên 3 — sảnh/cấu hình/xếp tàu

Tái dùng settings dialog/lobby và skin; xây xếp tàu qua typed API. Cả desktop/mobile có cách chọn→di chuyển→xoay không phụ thuộc kéo. Chưa mở entrypoint công khai khi chưa có bàn chiến đấu; có đường QA riêng rõ ràng chỉ dùng dev nếu cần. Kiểm browser 1440/768/390/360, trạng thái setup/private ACK/error/ready/timeout và hồi quy lobby game cũ.

### Phiên 4 — bàn chiến đấu, motion và sound

Hoàn thiện hai lần chọn/bắn, aim ACK/sequence, hai bảng, timer/status, hit/miss/sunk và tự động bắn. Hiệu ứng thủy lôi→nước/lửa theo shotId; xóa dấu miss ở DOM/ARIA; modal resign, result/match/countdown. Bật game trên sảnh khi flow đầy đủ và qua kiểm tra. Không đổi state theo animation hoặc tạo gợi ý vị trí trượt. Test reduced motion, late/duplicate event, tab background/reload và zoom/pan.

### Phiên 5 — hồi quy và bàn giao Terra

Chạy suite/typecheck/build mới; production local HTTP/Socket.IO; browser hai context/localStorage độc lập. Test cả target10 (một ván) và target20 (ít nhất hai ván để kiểm tự nối). Desktop/mobile, bàn8/10/12, preset3/4/5, chạm bật/tắt, trúng bắn tiếp bật/tắt; case risk bắt buộc trong hợp đồng. Ghi rõ test fixture/deterministic và production random. Chưa thử thiết bị thật phải để pending. Cập nhật README/docs/AGENTS theo kết quả thật, không tự tăng version Fix 1.1 hoặc deploy.

## 6. Gate chất lượng

- Không bí mật tàu đối thủ trong JSON, ACK/cache/lỗi/effect/DOM. Kiểm server projection bằng assertions, không chỉ screenshot.
- Hai context độc lập nhận dữ liệu của chính mình, kết quả/điểm thống nhất, khôi phục fleet/aim đúng sau resume; socket cũ không sửa được.
- Bắn/timeout/resolve/lock setup cạnh deadline cho đúng một transition; không phát hai shot/điểm/round.
- Miss cũ nhìn và tương tác giống unknown, bắn lại được; random không âm thầm tránh miss cũ. Snapshot không lưu lịch sử miss.
- Tất cả preset sinh fleet hợp lệ hữu hạn; false allowTouch cấm cả đường chéo; lỗi đặt không thay state hợp lệ.
- Không giật layout do status, không tràn ngang trang ở 360 px; zoom/pan không bắn nhầm, bàn phím có focus rõ; motion/audio cleanup đủ.
- UNO BB-UNO-1, Nối từ NT-VI-1, Caro HQ-CARO-1, HTTP LAN, privacy/reconnect, score/countdown và Fix 1.1 layout/motion không hồi quy.

## 7. Bàn giao và ước lượng phạm vi

Đây là game thông tin kín có ba pha và nhiều timer, lớn hơn việc vẽ thêm một bàn Caro. Chia thành sáu phiên để mỗi phiên có điểm kiểm chứng rõ; không ước lượng giờ/token cố định trước baseline. Nếu một phiên quá rộng, chia nhỏ trong cùng hồ sơ và giữ gate, không tự bỏ privacy/timer tests để chạy hết prompt.

Phần trên ghi kế hoạch và baseline ban đầu; kết quả code và kiểm chứng thực tế ở `06-implementation.md`/`07-qa.md`. Hồ sơ này không phải bằng chứng Terra đã nghiệm thu.
