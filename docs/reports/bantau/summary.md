# Bắn tàu — tổng kết triển khai và polish

Cập nhật hồ sơ 18/11/2026. Đã có engine/backend/UI và các bản sửa motion 1.2. **Chờ Terra QA độc lập.** Hồ sơ hợp nhất thay kế hoạch/prompt/báo cáo trung gian; không coi gom tài liệu là nghiệm thu.

## Hành vi và quyết định

- [HQ-BANTAU-1](../../bantau-rules.md) là luật hiện hành: đúng 2 người; bàn 8/10/12 (mặc định 10); 3/4/5 tàu tương ứng độ dài 3/3/2, 4/3/3/2, 5/4/3/3/2. Không overlap; khi cấm chạm thì cấm cạnh và chéo. Server sinh đội hình hữu hạn, kiểm placement và khóa sau setup 90 giây.
- Lần đầu nhắm, lần hai cùng ô sau ACK mới bắn. Timeout bắn aim đã xác nhận hoặc random ô trừ hit/sunk. Aim không reset giờ. Miss không lưu dấu/history, có thể bắn lại; hit/sunk chặn bắn lặp. Trúng bắn tiếp tùy settings.
- Setup → turn/resolving → finished. Resolving 900ms do server quyết định; giới hạn ván active 30 phút hủy không điểm. Thắng +10, target mặc định 50; dưới target tự nối setup sau 3 giây, luân phiên người bắn trước. Disconnect pause; leave/kick/grace hủy trận.
- Frontend chỉ API/render; placement, aim, fire, timeout, điểm và kết quả ở server. Không database/nhiều replica; restart mất phòng/phiên.

## Contract và privacy

State có gameId/setupId/turnId/shotId, shipId ổn định, public revision và private fleetRevision/aimSequence. RoomService quản timer/session/điểm, engine thuần nhận RNG/now; API kiểm strict payload/session/generation/actionId và version.

- Placement gửi một intent khi thả, expectedFleetRevision riêng, ACK owner; không gửi pointermove liên tục. Lock/fire/resign dùng public envelope; fire phải khớp aim/sequence đã xác nhận.
- Snapshot riêng mỗi ghế gồm ownFleet/ownIncomingHits, aim riêng và targetBoard unknown/hit/sunk. `revealedSunkShips` chỉ footprint tàu đã chìm, displayId chung/length/cells; không lộ tàu chưa chìm, seed hoặc ID nội bộ. Không full reveal khi kết thúc.
- Effect shot chứa event/shot/game ID, actor/target/tọa độ/result/source/serverTime/TTL; miss chỉ live event tạm, không hydrate history qua snapshot/ACK replay. Client dedupe, bỏ event cũ/hết hạn, không replay reconnect.
- Timer/action giải overdue trước commit; tại deadline một shot/finish/score duy nhất. Callback stale/context cũ bỏ qua. Pause/resume bao setup/turn/resolving/intermission/round limit.
- Luật/schema thực tế ở source là hợp đồng hiện hành; các mã lỗi từ server được hiển thị tiếng Việt và không chứa dữ liệu tàu địch.

## Giao diện, asset và motion

- Theme Hội Quậy, không chép skin ảnh tham khảo. Hạm đội mình nhỏ để xem, biển địch luôn lớn để bắn; desktop mình trái/địch phải, mobile địch chính/mình mini; đổi lượt không đảo bảng/kích thước.
- Năm SVG tàu liền khối tự vẽ 2–5 ô và sprite SVG thủy lôi/nước/nổ/lửa; manifest tại `public/assets/bantau/`. Tổng asset đợt polish dưới 14 KB trước nén.
- Pointer drag giữ offset đoạn tàu nắm, snapping/preview, pointer capture; một intent lúc thả và rollback về snapshot nếu ACK lỗi; cancel ngoài bàn/Escape/pointercancel. Có fallback chọn/chạm/xoay và keyboard.
- Aim pending/confirmed phân biệt, không bắn trước ACK. Trượt chỉ có splash tạm rồi sạch; thân tàu địch chỉ lộ khi chìm. Cháy bản thân chỉ ở bảng nhỏ; không tô ownHits lên biển địch.
- Chuỗi rơi 280ms → chạm/thủy lôi biến mất → nổ 420ms hoặc 520ms → lửa. Sprite dùng steps chuyển background-position và đúng hàng/cột. Mute/volume/reduced motion dùng thiết lập chung; sound đồng bộ impact.
- Timeline monotonic neo serverNow vào performance.now; event quy đổi một lần, snapshot muộn không kéo dài/restart effect; reconnect/đổi game reset neo. Không dùng giờ hệ thống thiết bị để quyết định TTL/motion.
- Đã dùng ui-ux-pro-max; Lucian catalog không có drag-grid phù hợp nên không port/thêm thư viện.

## File chính

`packages/bantau/src/index.ts`, `packages/shared/src/bantau-public-game-schema.ts`, `public-game-schemas.test.ts`, `server/src/rooms.ts`, `server/src/index.ts`, `src/api/*`, `src/App.tsx`, `src/components/RoomSettingsDialog.tsx`, `src/bantau/BantauTable.tsx`, `src/bantau/presentation-clock.ts`, `src/styles/bantau.css`, `src/audio/soundEffects.ts`, `public/assets/bantau/`.

## Bằng chứng lịch sử

| Mốc | Kết quả thật được ghi khi thực hiện |
|---|---|
| Baseline | Typecheck/build đạt, full suite 169/169 trong 16 file khi cho loopback |
| Triển khai ban đầu | 182/182, 17 file; typecheck/build đạt; engine 9 test, RoomService 39/39, realtime+engine 16/16 |
| Polish | 183/183, 17 file; engine/schema Bắn tàu 12/12; typecheck/build/diff check đạt |
| Sửa hai lỗi 1.2 | 188/188, 18 file; 5 test clock mới, typecheck/build/diff check đạt. Chi tiết phát hành ở [review 1.2](../release-1.2/01-review.md) |

Sandbox chặn listener 127.0.0.1 gây EPERM/timeouts; các full suite trên chạy khi được phép loopback. Đây là số lịch sử, không phải lần chạy mới khi gom MD. Kết quả toàn dự án hiện tại nằm ở [project summary](../project-summary.md).

Browser ban đầu: Chrome thường/Incognito, session riêng tạo/join mã/ready/start/khóa đội hình/combat; một phát trượt và một phát trúng được quan sát ở hai phía. Polish: Chrome/Safari độc lập tạo/join/ready/lock/aim/fire/trượt/đổi lượt, bảng địch lớn/bảng mình nhỏ ổn định. Không hoàn tất ván thắng UI, không kéo pointer thực trong đợt polish, không device/audio thật; không lưu ảnh evidence trong repo. Không coi hai socket test là hai browser.

Production local 1.2 trả HTTP 200 cho health/catalog/trang chính/asset carrier/explosion; bốn game thời điểm đó available=true. Chưa npm ci trên clean checkout, chưa hosting/HTTPS/WSS/load QA. Sau hotfix sprite/clock chưa thử lại animation bằng browser. Phản hồi người dùng “khá ổn” là bằng chứng riêng, không Terra approval.

## Checklist Terra còn mở

- [ ] Public/private/mã phòng, hai ghế/ready/host, catalog/settings, timeout setup và cấu hình bàn 8/10/12, 3/4/5 tàu.
- [ ] Kéo mũi/giữa/đuôi ngang/dọc; biên/chồng/chạm cạnh/chéo; ngoài bàn/cancel/Escape/mất mạng; ACK rollback; sau lock không sửa được.
- [ ] Aim A→B→B, pending ACK/stale/double click, keyboard; aim kín, không reset timer. Fire/timeout race một shot.
- [ ] Hit/miss/sunk, timeout có/không aim; ô miss sạch và bắn lại được; snapshot/ACK/DOM không lộ fleet chưa chìm hoặc miss history.
- [ ] Rơi → chạm → nổ tắt → cháy đúng cell, thủy lôi biến mất, ownHits chỉ trên bảng nhỏ; reload sau sunk; sound impact/mute/volume/reduced motion.
- [ ] Win +10 một lần, target/countdown3s/round mới; resign/round limit; leave/kick/grace hủy trận.
- [ ] Reload/reconnect setup/aim/turn/resolving/countdown, đúng ghế/giờ/fleet/aim, socket cũ bị chặn.
- [ ] Desktop1440/tablet768/mobile390/360 và điện thoại thật: kéo/chạm, không tràn ngang, zoom/pan không bắn nhầm, safe area; bố cục hai bảng giữ cố định.
- [ ] iOS audio gesture/loa/tai nghe, lệch đồng hồ máy ±2 phút, event đến muộn và tab ẩn/hiện.
- [ ] Asset lỗi tải (chưa có fallback riêng), hồi quy game cũ/HTTP LAN và môi trường hosting thật/tải đồng thời.

Terra ghi từng mục Đạt/Không đạt/Chưa kiểm tra, thiết bị/browser, tình huống và bằng chứng; không đánh dấu thay người nghiệm thu.
