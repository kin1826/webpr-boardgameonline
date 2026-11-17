# Prompt giao Luna theo từng phiên — Bắn tàu

**Prompt mẫu theo chặng.** Trong lượt triển khai 16/11/2026, người dùng đã ủy quyền chạy liên tục phiên 0→5 và dùng các quyết định trong hồ sơ làm đặc tả; kết quả thực tế nằm trong [06-implementation.md](./06-implementation.md) và [07-qa.md](./07-qa.md). Các prompt dưới đây chỉ là hồ sơ quy trình đã dùng, không phải chỉ dẫn rằng phần code còn chưa làm.

## Quy tắc chung áp dụng mọi phiên

Đọc `AGENTS.md`, `docs/reports/project-summary.md`, `docs/bantau-rules.md` và đủ bốn tài liệu trong `docs/reports/bantau/` (01-plan, prompt này, 03-ui-ux, 04-data-contract). Sau phiên 0 đọc thêm `05-baseline.md`; sau phiên 1 đọc báo cáo `06-implementation.md` đang có. Đọc luật ba game cũ, architecture, rooms-and-reuse, test-plan và source thực tế liên quan trước sửa.

Không ghi đè/revert thay đổi sẵn có, không commit/push/deploy. Giữ BB-UNO-1, NT-VI-1, HQ-CARO-1, HTTP LAN, privacy/reconnect, match/score/countdown và motion/layout Fix 1.1. Server quyết định nghiệp vụ; frontend chỉ typed API + render/UX. Không tự thêm luật ngoài HQ-BANTAU-1 đã được chốt. Nếu cần thay quyết định, ghi lý do và sửa đặc tả trước code.

Mỗi phiên báo tiến độ ngắn; cuối phiên ghi file chính, hành vi đã làm, lệnh/kết quả thật, lỗi/giới hạn và việc tiếp theo trong hồ sơ Bắn tàu. Không lấy test count cũ làm kết quả mới, không tuyên bố browser/thiết bị thật nếu chưa chạy. Sau hoàn thành phạm vi, **dừng ở phiên được giao**.

## Phiên 0 — chỉ khảo sát và baseline

```text
Bạn là Luna, tiếp tục Hội Quậy. Chỉ làm PHIÊN 0 của
docs/reports/bantau/01-plan.md. Đọc đầy đủ quy tắc chung trong
docs/reports/bantau/02-luna-prompts.md và các tài liệu bắt buộc.

Kiểm tra git status/branch, source shared/engine/server/API/App/settings/audio,
workspace/TypeScript/build và test engine/HTTP/rooms/realtime.
Chạy npm run typecheck, npm test, npm run build; ghi baseline mới và phân biệt
lỗi môi trường loopback với lỗi dự án. Không sửa/thêm test trong phiên này.

Đối chiếu HQ-BANTAU-1 và 04-data-contract.md với source. Chốt bản đồ tích hợp,
enum/else còn mặc định game cũ, private placement revision, aim sequence/ACK,
deadline/race, resolving 900 ms, không lưu dấu miss và restart/reconnect.
Ghi mọi quyết định chưa rõ, không tự coi đề xuất là đã được người dùng duyệt.

Chỉ sửa tài liệu, báo cáo docs/reports/bantau/05-baseline.md.
Chưa tạo packages/bantau hoặc src/bantau, chưa sửa source/config/dependency.
Báo ngắn kết quả và dừng để người dùng giao phiên 1.
```

## Phiên 1 — engine thuần và luật

```text
Bạn là Luna. Chỉ triển khai PHIÊN 1 Bắn tàu theo 01-plan.md, rules và hợp đồng
đã chốt ở 05-baseline.md; áp dụng quy tắc chung của 02-luna-prompts.md.

Tạo packages/bantau theo quy ước repo: fleet presets, state, placement
validation, transition setup/turn/resolving/finished, aim và private versions,
fire/timeout/pause/resume, thắng/thua và projection riêng từng người.
Inject RNG/clock, không React/Socket.IO/timer hệ thống, không import shared
tạo vòng dependency. Random placement hữu hạn có backtracking.

Viết/chạy test meaningful: 8/10/12 x 3/4/5 tàu, chạm bật/tắt, biên/đè/chéo,
lock/expiry, aim A→B, fire/timeout tại deadline, miss được bắn lại, hit cũ
bị chặn, hit-continue, sunk/last ship, resolving và pause/resume.
Test privacy hai chiều: hidden fleet không thay target snapshot/capabilities.
Giữ immutable state khi intent lỗi; không trả miss history trong projection.

Chưa mở game trên sảnh hoặc sửa UI/backend transport. Chỉ sửa config/package
tối thiểu cần engine chạy. Báo cáo vào 06-implementation.md mục phiên 1,
ghi lệnh/kết quả mới và dừng sau engine gate.
```

## Phiên 2 — backend, shared và API

```text
Bạn là Luna. Chỉ triển khai PHIÊN 2 theo hồ sơ Bắn tàu và quy tắc chung;
đọc engine/report phiên 1 trước khi nối multiplayer.

Mở rộng GameKey/catalog/settings/RoomSnapshot/runtime schemas, room/session,
startRound setup, private placement/aim, shot/resolving timer, pause/resume,
cleanup và score/countdown hiện tại. Thêm typed API methods/subscriptions.
Không để bantau đi vào nhánh else UNO/Nối từ/Caro; chưa bật entrypoint
người dùng nếu bàn UI chưa đầy đủ.

Mọi payload strict, socket generation hiện tại, version public/private đúng
contract; dedup ACK/effect và action ID; cache/private-state chỉ đúng owner.
Không phát raw fleet, miss history hoặc aim đối thủ. Deadline server thắng
race bắn tay/timeout, đủ hai fleet khóa chỉ start một lần.

Chạy engine/shared/integration liên quan trước nối UI. Test hai socket độc lập
setup→aim→fire→win→+10→3s→setup mới; target reached; reconnect aim/fleet,
old session, duplicate/stale, leave/countdown và privacy của mọi kênh.
Typecheck/build và regression ba game cũ. Ghi 06-implementation.md phiên 2,
test thật/giới hạn và dừng, chưa làm UI bàn chiến đấu.
```

## Phiên 3 — UI chung và xếp tàu

```text
Bạn là Luna. Chỉ triển khai PHIÊN 3 theo 01-plan/03-ui-ux, đọc đủ quy tắc
chung và báo cáo backend trước sửa.

Tái dùng Hội Quậy header/avatar/theme đỏ/font/tokens, public/private lobby,
settings dialog và scoreboard. Thêm setting đúng options API, help text
timeout riêng Bắn tàu; tránh mô tả “hết giờ bị loại” sai game này.

Làm màn setup: fleet riêng từ server, timer90s, chọn/di chuyển/xoay,
ngẫu nhiên và khóa sẵn sàng qua API. Có cách tap không cần kéo; preview lỗi
không ghi đè fleet đã ACK. Không hiển thị vị trí tàu đối thủ. Hỗ trợ ACK stale,
pause/reconnect, đặt tàu đồng thời và auto-lock bằng state server.

Dùng ui-ux-pro-max cho rà bố cục và lucian-uxui cho thành phần phù hợp:
tra catalog lại trước chọn, get trước port, giữ MIT/ghi công và map token.
Không chép font pixel/skin xanh hoặc artwork từ ảnh.

Kiểm 1440/768/390/360px, keyboard, zoom/pan, touch, reduced motion và hồi quy
lobby game cũ. Entry public chỉ mở khi cả chiến đấu đã hoàn chỉnh; chưa
tuyên bố chơi end-to-end ở phiên này. Ghi báo cáo phiên 3 và dừng.
```

## Phiên 4 — nhắm/bắn, hiệu ứng và hoàn thiện luồng

```text
Bạn là Luna. Chỉ triển khai PHIÊN 4 theo toàn bộ hồ sơ Bắn tàu và quy tắc chung.
Đọc contract/event/engine/API hiện tại trước nối bàn chiến đấu.

Hai bảng theo 03-ui-ux, mobile ưu tiên target grid. Click/tap lần đầu aim,
lần hai cùng ô sau ACK mới fire; đổi ô chỉ đổi aim. Không nút Bắn bổ sung.
Aim server-sequenced, stale ACK không đổi target, reload khôi phục aim.
Timer client chỉ hiển thị: hết giờ server bắn aim hoặc random; không loại ghế.

Tạo SVG/CSS thủy lôi rơi vào đúng ô, nổ nước khi miss, nổ lửa khi hit,
hiện đúng tàu sunk; sound dùng audio service/mute/volume hiện có.
Miss xong ô y như unknown, vẫn bắn lại được, không history/tooltip/aria dấu cũ.
Không full fleet đối thủ trong DOM/JSON; hit chưa chìm không lộ thân/loại tàu.

Dedup shotId, gate effect theo game/revision/thời hạn, cleanup khi đổi ván,
tab background/resume không replay. Reduced motion bỏ rơi/rung, không đổi
resolve900ms hoặc kết quả. Không đợi animationEnd để mở lượt/ghi điểm.
Thêm resign dialog, result, target score/countdown về setup mới, rules screen,
availability và thẻ sảnh khi luồng hoàn chỉnh.

Thử browser thật hai context độc lập nếu có, mobile viewport/keyboard/pan,
event trễ/lặp, timeout, hit/miss/sunk và đối chiếu server state. Báo phiên 4,
phân biệt fixture/device thật, dừng trước nghiệm thu cuối.
```

## Phiên 5 — hồi quy và bàn giao Terra

```text
Bạn là Luna. Chỉ làm PHIÊN 5 kiểm chứng/bàn giao Bắn tàu theo hồ sơ và quy tắc
chung. Đọc mọi report trước đó; hoàn tất phần thiếu trong phạm vi đã chốt.

Chạy npm run typecheck, npm test, npm run build mới; smoke production local
health/games/rooms/static và Socket.IO. Kiểm hai session/localStorage độc lập
đặt tàu→nhắm→bắn→win; target10 và target20 để xác minh +10/3s/ván mới/đổi
người đi đầu. Phân biệt production random với test fleet có kiểm soát.

Theo checklist hợp đồng: matrix board/fleet/touch/hit-continue, hết giờ có/
không aim, aim stale/reload, duplicate/deadline/resolution races, miss repeat,
privacy ACK/cache/private-state/effect/DOM, disconnect mọi pha, leave/kick
countdown và round-limit. Regression UNO/Nối từ/Caro, HTTP LAN và motion.

Kiểm desktop1440/768/mobile390/360, hit target và zoom/pan, keyboard, mute/
volume/reduced motion; không ghi thiết bị thật nếu chỉ emulation. Cập nhật
README, docs/architecture, rooms, test-plan, product/UI, AGENTS và
project-summary đúng trạng thái. Không tự bump version, commit/push/deploy.

Ghi 06-implementation.md phần bàn giao: file, lệnh/kết quả, bằng chứng, lỗi,
giới hạn, cách chạy và checklist cho Terra tại 07-qa.md (Terra tự ghi kết quả).
Không tự đánh dấu QA approve, không xóa/gom hồ sơ trước khi được yêu cầu.
Báo cáo trong chat và dừng.
```
