# Cờ vua — tổng kết triển khai và bàn giao

Cập nhật 19/11/2026. **Đã triển khai Online và 2P, polish và sửa ba lỗi review; kiểm tra tự động đạt. Chưa được Terra nghiệm thu, chưa xác nhận UI trên browser/điện thoại hoặc cảm giác âm thanh.** Hồ sơ này thay thế 11 tài liệu plan/contract/prompt/implementation/review trước đó theo yêu cầu gom tài liệu. Luật và nguồn tham khảo vẫn ở [HQ-COVUA-1](../../covua-rules.md).

## Hành vi cuối và quyết định

- Đúng 2 người. Online dùng phòng public/private, mã/link, ready/host/kick, reconnect. 2P cho hai người lần lượt trên cùng thiết bị qua backend, mặc định không đồng hồ; không phải offline.
- Online: 5/10/15 phút mỗi bên, increment 0/3/5 giây; mặc định 10+3. Thắng +10, hòa +0; target 10–500 bội 10, mặc định 50. Đổi màu giữa các ván, điểm gắn playerId; online tự nối ván sau 3 giây khi chưa đủ điểm; 2P ván mới thủ công.
- Engine bọc `chess.js` 1.4.0 ở backend, giấy phép BSD-2-Clause. Server xác thực nước đi, nhập thành, en passant, bốn lựa chọn phong cấp, chiếu/bí, clock và kết quả. Không dùng tổng hợp `isDraw()` để áp hòa ba lần/50 nước tự động trái luật đã chọn.
- Yêu cầu hòa tại thế hiện tại hoặc bằng nước dự định; lặp 3 lần/100 ply là claim, 5 lần/150 ply tự hòa; chiếu bí cùng nước được ưu tiên. UI claim dự định: chọn lý do → chọn quân/ô → chọn phong cấp nếu có → gửi server. Claim đúng kết thúc hòa mà không commit nước dự định; sai trả lỗi. Có hủy chế độ claim.
- Thiếu vật chất/dead position/timeout/xin thua theo tập giản lược HQ-COVUA-1 đã công bố, không chứng nhận phân xử đầy đủ mọi thế FIDE. Tự hòa K–K, K+B–K, K+N–K và chỉ Vua/Tượng với tất cả Tượng cùng màu ô. Không solver dead-position tổng quát.
- Phòng/phiên/điểm/lịch sử trong RAM một backend process; restart/deploy mất dữ liệu. Giữ năm game cũ và HTTP LAN UUID fallback.

## Hợp đồng và file chính

| Phần | Source và trách nhiệm |
|---|---|
| Engine | `packages/covua/src/index.ts`: state/FEN/history/position keys, stable pieceId, luật/clock/projection; clock và random truyền từ ngoài |
| Shared | `packages/shared/src/index.ts`, `covua-public-game-schema.ts`: catalog/settings/DTO/schema strict, square a1–h8, role/color và envelope |
| Online | `server/src/rooms.ts`, `server/src/index.ts`: room/session/action validation, timer, điểm/countdown và socket ACK |
| 2P | `server/src/covua-local.ts`: credential namespace riêng, token ngẫu nhiên lưu digest, socket ownership, pause/resume, TTL/cap, new-game đổi màu giữ tên/avatar |
| API và UI | `src/api/http.ts`, `src/api/realtime.ts`, `src/App.tsx`, `src/components/RoomSettingsDialog.tsx`, `src/covua/`: catalog, Online/2P, settings, render và ý định người chơi |
| Hình và âm | `public/assets/covua/pieces/` (12 SVG tự vẽ, không artwork bên thứ ba), `src/audio/soundEffects.ts`: cue riêng Cờ vua |
| Kiểm thử | `packages/covua/src/index.test.ts`, `server/src/covua-local.test.ts`, `server/src/rooms.test.ts` và suite chung |

- State có gameId/revision/turnId/phase, players/board, history/position keys, lastMove, clock, drawOffer và result. Snapshot DTO có board công khai, viewerColor, legalMoves của phía được điều khiển, capabilities, claimReasons, SAN 100 ply cuối/historyCount và clock/serverNow; không đưa token, socket ID, cache action hay engine instance vào broadcast.
- `lastMove` chứa pieceId/from/to, captureSquare/capturedPieceId, promotion và rookMove cho nhập thành. UI xoay chỉ góc nhìn; luôn gửi ô chuẩn.
- `covua:action`: move/offerDraw/respondDraw/claimDraw/resign cùng actionId, roomId, expectedRevision, gameId và turnId khi cần. Claim có intendedMove tùy chọn. Server xác thực actor từ phiên. 2P dùng create/resume/action/new-game/leave riêng, có actingColor cho hành động phù hợp.
- Action/timer nhận đúng deadline thì timeout trước; callback cũ theo game/turn/deadline phải bị bỏ qua. Settings/roster/countdown dùng lifecycle phòng hiện có. Các chi tiết dedupe/race/credential cần Terra kiểm chứng độc lập theo checklist dưới.
- Contract đề xuất cũ có `controlledColors`, `sideToMove`, `promotionOptions`, `claimReasonsAfter`, `promotedFrom`; không coi các trường đó là API hiện hành. Schema/source là hợp đồng thực tế: currentColor, legalMoves có promotion và viewerColor/local flag; server kiểm claim dự định khi submit.

## Polish và sửa lỗi cuối

- Khóa grid đủ 8 hàng/cột `minmax(0,1fr)`, board vuông, quân absolute không ảnh hưởng kích thước ô. Override disabled trong scope Cờ vua để bàn/quân không tối theo lượt. Crop SVG viewBox, bóng đổ và nhô nhẹ 3%, hitbox giữ theo ô.
- Lướt quân sau server xác nhận; nhập thành lướt cả Xe, capture ghost tại ô bắt thường/en passant rồi tắt; rung cục bộ bàn khi impact. Cue `covua-move/capture/check` riêng, capture mạnh hơn move, check nối tiếp; giữ master/mute, reduced motion bỏ lướt/rung.
- Review phát hiện clock snapshot/reset anchor hiển thị dư thời gian: probe game 60s sau 20s từng trả 60s dù deadline còn 40s. Đã sửa projection trả remainingMs tại serverNow từ deadline hoặc pausedRemainingMs, clone dữ liệu không mutate state.
- Đã bỏ cache rect cũ sau flip/resize: motion lấy ô from/to theo geometry hiện tại; ResizeObserver/orientation cleanup hủy animation/ghost. Đã thêm UI claim bằng nước dự định và reset dialog/claim theo revision/game.

## Kiểm chứng và bằng chứng

Các số dưới là kết quả lịch sử đã chạy, **không chạy lại test khi chỉ gom Markdown**.

| Lần kiểm tra | Kết quả thật |
|---|---|
| Baseline trước Cờ vua | Typecheck/build đạt; 208 test/21 file khi cho phép loopback |
| Sau triển khai và polish | Typecheck/build đạt; 216 test/23 file; test engine/local/room 47 test/3 file |
| Sau sửa ba lỗi review 19/11 | `npm run typecheck` đạt; test engine/local/room 50/50 trong 3 file; `npm test` 219/219 trong 23 file; `npm run build` đạt; `git diff --check` đạt |
| Build cuối | JS 606.17 kB minified / 174.94 kB gzip; còn cảnh báo chunk >500 kB và annotation Zod |

Test bao gồm perft đầu 20/400/8902, 32 quân, stable ID, từ chối nước sai/lượt sai, Fool’s mate, deadline, en passant, nhập thành giữ ID Xe, room Online hai ghế/nước đi/resign/điểm, 2P resume/new-game/avatar, snapshot/pause/resume/offer giữ clock và claim dự định đúng/sai không commit.

Môi trường: test HTTP/realtime cần bind loopback; chạy sandbox mặc định từng timeout rồi bị dừng, khi cho phép loopback thì suite đạt. Browser CUA báo host unavailable; Chrome headless thoát 134. Lần thử dev cũ backend cổng 3001 đã bị dùng và tiến trình dev đã dừng. Không có số đo geometry/browser, bằng chứng nghe audio hoặc điện thoại thật. Service tests không thay hai browser/profile độc lập chơi trọn ván tới mate. Production health/catalog/assets, HTTPS/WSS, tải nhiều phòng và clean install vẫn cần kiểm tra.

## Checklist Terra còn mở

Các ô dưới là QA độc lập chưa được chạy/đánh dấu bởi Terra; kết quả tự động của Luna nằm ở bảng trên. Ghi Đạt/Lỗi/Chưa kiểm tra, môi trường, bước tái hiện và bằng chứng, không chứa token.

### Kiểm tra tự động

- [ ] `npm run typecheck` — kết quả: ____
- [ ] `npm test` — kết quả: ____
- [ ] `npm run build` — kết quả/cảnh báo: ____
- [ ] Xác nhận `chess.js` không bị bundle vào frontend runtime.
- [ ] Production health/catalog/12 SVG trả kết quả thành công.

## Engine và luật

- [ ] 32 quân, 20 nước đầu và perft 20/400/8902.
- [ ] Nước sai/lượt sai/ô sai bị từ chối; state/clock không mutate.
- [ ] Chiếu, giải chiếu, ghim, Vua kề nhau, không bắt Vua; bí nước là hòa.
- [ ] Nhập thành hai phía/màu, đường bị chiếu, quyền mất không phục hồi, Xe bị bắt.
- [ ] En passant đúng ô bắt, chỉ một lượt hiệu lực, không tự lộ chiếu.
- [ ] Phong Hậu/Xe/Tượng/Mã, cả ăn quân và không ăn quân; dialog stale khi timeout/đổi game.
- [ ] Claim hòa đúng/sai ở vị trí hiện tại và nước dự định; repetition/50-move claim; auto 5-fold/75-move; mate ở ngưỡng ưu tiên.
- [ ] Thiếu vật chất, timeout, xin thua và hòa theo đúng trường hợp đã liệt kê trong luật HQ-COVUA-1.
- [ ] Đồng hồ: deadline, increment, 2P không đồng hồ, race nước đi/claim/timeout; không dùng giờ client.

## Phòng Online và điểm trận

- [ ] Hai browser/profile độc lập: tạo private/public → join → ready → start; ghế thứ ba bị từ chối.
- [ ] Trắng/Đen và nhãn “Bạn” đúng identity; mỗi người nhận snapshot phía mình, nước đi đồng bộ.
- [ ] Nước hợp lệ → ăn quân → chiếu → chiếu bí, hiển thị đúng người thắng/lý do.
- [ ] Sai lượt, revision/game/turn cũ, action lặp/ID reuse, payload thừa và quyền phiên cũ bị từ chối.
- [ ] Điểm +10 đúng một lần; đổi bên giữa ván không làm lệch người nhận điểm; hòa +0.
- [ ] Countdown 3 giây; rời phòng/hủy countdown; reconnect/pause/resume và callback cũ.
- [ ] Offer/accept/decline hòa đúng màu/quyền và không settle hai lần.

## 2P cùng thiết bị

- [ ] Tạo phiên hai tên/avatar; đi được cả hai bên; nhãn và màu quân không đổi nhầm.
- [ ] Token sai/hết hạn/revoke/socket cũ bị chặn; token local không dùng chéo với Online/Cờ tướng.
- [ ] Mất kết nối/resume giữ đúng phần clock; reload không tạo bản sao phiên.
- [ ] New game giữ người và avatar, đổi màu quân; resign/draw/leave và TTL cleanup.
- [ ] Xác nhận rõ tính năng này cần backend và không phải offline.

## UI, thiết bị và hồi quy

- [ ] Viewports 1440×900, 1366×768, 768px, 390×844, 360×640; không tràn/cắt bàn hoặc controls.
- [ ] Xoay bàn chỉ đổi góc nhìn; tọa độ, hitbox, nhãn hàng/cột và move đúng.
- [ ] 12 SVG rõ nét/đọc được ở cỡ nhỏ, tải offline từ local assets; không phụ thuộc font CJK.
- [ ] Keyboard arrows/Enter/Space/Escape; focus/return focus của promotion; thông báo lượt/kết quả có accessibility.
- [ ] Reduced motion, âm thanh/mute/audio unlock/iOS; không double cue hoặc replay khi reconnect.
- [ ] Motion: quân lướt sau ACK, capture/check/result; nhập thành hai quân cùng sự kiện, en passant đúng ô, promotion đúng thời điểm.
- [ ] Polish 19/11: board có đủ 8 hàng × 8 cột bằng nhau; đo sai lệch không quá 1 CSS px tại desktop và mobile.
- [ ] Polish 19/11: quân nhô nhẹ nhưng không che quân kề/ô chọn; nhập thành lướt cả Xe; capture ghost đúng ô thường/en passant rồi tắt trước impact.
- [ ] Polish 19/11: tiếng move/capture/check phân biệt rõ, impact rung đúng lúc; không phát cue cũ sau rematch/reconnect; mute, master volume và reduced motion đúng.
- [ ] Hồi quy UNO, Nối từ, Caro, Bắn tàu, Cờ tướng; HTTP LAN/reconnect/join.
- [ ] Thử HTTPS/WSS trên hosting và ít nhất một điện thoại thật; đây chưa được Luna chạy.

## Ghi kết quả

- Người kiểm thử / ngày: ____
- OS, trình duyệt, thiết bị, viewport: ____
- Kết quả tổng thể: Chưa nghiệm thu / Đạt / Cần sửa: ____
- Lỗi và bước tái hiện: ____
- Ảnh/video/log (không chứa token): ____

### Bổ sung sau review và các biên cần giữ

- [ ] Snapshot/offer/reload/reconnect không tăng giờ; pause giữ remaining; resume đúng deadline ở Online và 2P.
- [ ] Xoay/resize trước nước đầu hoặc giữa animation không làm quân bay sai/để ghost; cả hai orientation/busy/disabled.
- [ ] Claim dự định đúng/sai, promotion trong claim, hủy claim; không commit nước hoặc reset deadline khi claim sai.
- [ ] Lặp thế phân biệt quyền nhập thành/EP hợp lệ; auto 5-fold/150 ply và mate tại ngưỡng; claim hiện tại/dự định ở đúng biên.
- [ ] Local create retry/dedupe, callback cũ, deadline ±1ms, race move/claim/accept/resign, schema bounds và privacy.
- [ ] Clean install/build và kiểm backend dependency không vào frontend; không coi bộ test hiện tại đã phủ toàn bộ checklist.

## Quy trình tiếp theo

Terra chạy checks độc lập và UI theo checklist, ghi kết quả thực trong hồ sơ Cờ vua. Nếu mở đợt sửa mới, giữ summary này và thêm báo cáo theo thứ tự trong cùng thư mục. Chỉ cập nhật trạng thái đạt khi có bằng chứng; không tự tăng version/commit/push/deploy.

## Rà lại trước develop — 19/11/2026

Lượt này chỉ rà soát và chạy kiểm tra mới, không sửa source. Không phát hiện lỗi chặn mới trong phần code đã kiểm tra: clock projection, tọa độ motion, claim dự định, shared schema/transport, workspace/dependency backend.

- `npm run typecheck`: đạt.
- `npx vitest run packages/covua/src/index.test.ts server/src/covua-local.test.ts server/src/rooms.test.ts`: 50/50 trong 3 file đạt.
- `npm test`: chạy lại đạt 219/219 trong 23 file khi cho phép loopback. Lần yêu cầu quyền đầu hết thời gian xét duyệt tự động; retry thành công.
- `npm run build`: đạt; JS 606.17 kB / gzip 174.94 kB, còn cảnh báo Zod/chunk đã biết.
- `git diff --check`: đạt; kiểm liên kết README/docs index/luật/project summary/tổng kết không có target bị mất; đủ 12 SVG quân. Frontend source không import runtime chess.js/@banban/covua; tra dấu hiệu engine trong bundle không thấy kết quả, chưa dùng bundle analyzer.
- Không chạy mới browser/mobile/audio/hai session UI; các gate Terra bên trên vẫn mở. Kết luận: có thể đưa lên develop để tích hợp/test, chưa coi đây là nghiệm thu production.
- Working tree còn source mới untracked: phải đưa đầy đủ packages/covua, shared schema, server local/test, src/covua, assets và docs vào cùng commit với thay đổi tích hợp. Không commit/push/deploy trong lượt kiểm tra này.
