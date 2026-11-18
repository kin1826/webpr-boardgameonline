# Cờ tướng — tổng kết triển khai

Cập nhật 18/11/2026. Đã có engine, Online, 2P, polish và thông báo kết quả. **Chờ Terra nghiệm thu; chưa xác minh browser/mobile/audio trong đợt Cờ tướng.** Việc gom hồ sơ không thay trạng thái QA hoặc phiên bản phần mềm.

## Hành vi hiện tại

- [HQ-COTUONG-1](../../cotuong-rules.md) là đặc tả hiện hành: đúng hai người, bàn 90 giao điểm/32 quân, Đỏ đi trước. Backend kiểm nước hợp lệ, chiếu, chiếu bí/bí nước, hòa, xin thua và hết giờ.
- Xử lặp lần thứ tư, chỉ một bên chiếu liên tục thì bên đó thua; các trường hợp còn lại hòa. Hòa sau 120 ply không bắt quân hoặc chỉ còn Tướng/Sĩ/Tượng. Đây là lựa chọn Hội Quậy, chưa đủ bộ luật đuổi quân dai WXF.
- Online dùng phòng public/private, ready/host và reconnect; đồng hồ Fischer 5/10/15 phút, cộng 0/3/5 giây, mặc định 10 phút +3. Thắng +10, target mặc định 50; tự nối ván sau 3 giây và đổi bên theo cơ chế trận. Rời/kick/hết grace hủy trận.
- 2P là hai người trên cùng thiết bị, dùng phiên riêng trên backend; mặc định không clock, có handover khi phản hồi hòa và nút ván mới đổi bên. Không phải offline, không xuất hiện trong phòng công khai.

## Kiến trúc và file chính

| Phần | File |
|---|---|
| Engine thuần, projection và test | `packages/cotuong/src/index.ts`, `index.test.ts` |
| Contract runtime/catalog | `packages/shared/src/cotuong-public-game-schema.ts`, `packages/shared/src/index.ts` |
| Phòng/phiên/timer | `server/src/rooms.ts`, `index.ts`, `cotuong-local.ts` |
| Test integration/phiên | `server/src/realtime.test.ts`, `cotuong-local.test.ts` |
| Transport | `src/api/http.ts`, `src/api/realtime.ts` |
| UI/geometry | `src/cotuong/`, `src/App.tsx`, `src/components/RoomSettingsDialog.tsx` |
| Âm/asset | `src/audio/soundEffects.ts`, `public/assets/cotuong/pieces/` |

Engine nhận RNG/clock qua tham số, không phụ thuộc React/Socket.IO/timer hệ thống. Action kiểm phiên, actionId, game/turn/revision; server quyết định luật, deadline và kết quả. Phiên 2P lưu token digest, thay socket thu hồi generation cũ, có TTL và resume. RAM mất khi restart.

Snapshot gồm bàn công khai, ID quân ổn định, lastMove, lịch sử giới hạn/cảnh báo lặp, viewerSide, clock và capabilities/legalMoves của người xem. Không gửi token hoặc lịch sử phân xử nội bộ. `clock.initialMs` được bổ sung cho mẫu số timeline; client chỉ ước lượng hiển thị từ serverNow/deadline.

## UI, motion và asset cuối

- Nguyên nhân lệch quân: global `button:disabled` xóa translate định vị và làm mờ ảnh. Đã tách 90 hitbox cố định khỏi visual keyed theo pieceId, dùng chung geometry với SVG; disabled không dịch tâm/mờ quân. Test kiểm đủ 90 điểm và bốn góc.
- Bàn desktop tối đa 620px, fit ngang mobile. Hướng bàn hiện cố định Đen trên/Đỏ dưới; không có tự lật/zoom-pan trong bản này. Cần kiểm kích thước chạm ở màn nhỏ.
- Quân truyền thống thay chibi: 14 SVG đĩa ngà tự vẽ; Đỏ `帥仕相車馬炮兵`, Đen `將士象俥傌砲卒`. Nguồn và glyph ở [manifest](../../../public/assets/cotuong/pieces/manifest.json). Xe/Mã có nhiều biến thể; lựa chọn này không đổi luật. Font CJK chưa nhúng, còn phụ thuộc font thiết bị.
- Online có “· Bạn” vàng theo viewerSide, không so nickname; 2P có Người 1/Người 2. Thanh lượt ở cạnh tương ứng bên Đỏ/Đen, timeline dùng đồng hồ server; không clock chỉ báo tĩnh.
- Quân lướt WAAPI 180–280ms sau snapshot xác nhận; quân bị ăn fade khi quân tấn công tới. Dedupe gameId/ply, cleanup animation/timer; reduced motion bỏ lướt/rung. Bắt quân có shake bàn và cue đanh hơn; đi thường tiếng nhẹ, chiếu cue riêng. Web Audio tự tổng hợp, không sample bên ngoài; giữ mute/volume/gesture/hidden-tab.
- Kết thúc hiện bảng “VÁN ĐÃ KẾT THÚC”, tên/avatar/bên thắng, lý do; nhãn “Bạn thắng” chỉ đúng viewer Online; hòa hiện riêng. Nút chơi lại/ván mới giữ ở khu vực thao tác.
- Dùng ui-ux-pro-max để rà tương tác/motion; Lucian catalog được tra nhưng không có thành phần phù hợp bàn/turn rail, không port hoặc thêm thư viện.

## Kiểm chứng đã chạy

| Mốc | Kết quả thật |
|---|---|
| Trước thêm Cờ | Typecheck/build đạt; full suite có loopback đạt 188/188, 18 file |
| Sau thêm Cờ | 206/206, 20 file; typecheck/build đạt; production local cổng 3197 trả 200 cho health/catalog/trang chính/hai SVG, catalog Cờ available=true |
| Sau polish và thông báo kết quả | **208/208, 21 file**, typecheck/build và diff check đạt; gồm 15 test engine/geometry trong 2 file |
| Asset manifest | JSON hợp lệ, đủ 14 glyph trong SVG tương ứng |
| Socket integration | Có hai socket độc lập trong test; không phải hai browser |
| Browser/device/audio | Chưa thử; CUA báo browser access host unavailable |

Trong sandbox, các test HTTP/realtime gặp `listen EPERM` hoặc timeout; full suite đạt khi cho phép bind loopback. Build cuối JS 577.88 kB minified/169.86 kB gzip, còn cảnh báo chunk >500 kB và chú thích pure của Zod. Không coi test/build đạt là bằng chứng UI đã mượt. Chưa kiểm clean checkout/npm ci trong đợt này.

## Checklist Terra còn mở

- [ ] Online hai browser/profile riêng: create/join/ready/start; đúng hai ghế; người thứ ba bị từ chối; trùng tên vẫn gắn Bạn đúng bên.
- [ ] Bảy loại quân: cản chân Mã/mắt Tượng/ngòi Pháo, cung/sông, tự chiếu/tướng đối mặt; sai lượt/stale/duplicate không đổi state.
- [ ] Chiếu bí, bí nước, xin thua/hết giờ, hòa; kết quả giống ở hai client, +10 một lần, target/countdown/đổi bên và rời countdown.
- [ ] Clock 5/10/15 +0/3/5, pause/resume, reload/grace/session cũ. 2P clock tắt/bật, hai tên/avatar, handover hòa, new-game/đổi bên và TTL.
- [ ] Lặp lần 3 cảnh báo/lần 4 phân xử; 100/120 ply; bắt quân reset counter; không ghi đè kết quả chiếu bí bằng hòa.
- [ ] Desktop 1440×900/1366×768, tablet 768, mobile 390×844/360×640: không tràn/cắt quân; tâm đủ 90 điểm không lệch khi busy/disabled/resize; vùng chạm/bàn phím/focus/dialog.
- [ ] Đủ glyph CJK 28–56px trên Windows/macOS/Android/iOS; không ô vuông; phân biệt Đỏ/Đen.
- [ ] Nước thường lướt một lần; bắt quân tới đích rồi fade/shake; snapshot/ACK/reconnect không replay; reduced motion và âm mute/volume/gesture/ẩn tab.
- [ ] Bảng kết quả rõ trên mobile/desktop: đúng tên/avatar/bên/lý do; hòa riêng; screen reader thông báo; nút chơi lại không bị che.
- [ ] Hồi quy bốn game cũ, HTTP LAN, hai thiết bị trên HTTPS/WSS hosting và tải thật.

Ghi kết quả từng mục, OS/browser/viewport, bước tái hiện và ảnh/video. Người dùng đã test và gửi feedback là bằng chứng lịch sử, không thay Terra approval.

## Nguồn và giới hạn

[WXF 2018](https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf), [nhập môn do WXF lưu trữ](https://www.wxf-xiangqi.org/images/free_download_books/xiangqi_introduction_chessplayers_20150323.pdf), [quân/cách đi](https://www.xiangqi.com/help/pieces-and-moves), [bàn/xếp quân](https://www.xiangqi.com/help/board-and-set-up), [nghiên cứu xử luật WXF](https://arxiv.org/html/2412.17334v1). Luật đầy đủ và lựa chọn sản phẩm giữ ở docs/cotuong-rules.md. Không thêm bot, offline, đi lại hoặc khẳng định đầy đủ WXF. Chưa Terra approve, chưa tăng version hoặc commit/push/deploy trong đợt này.
