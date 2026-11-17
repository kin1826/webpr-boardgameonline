# Bắn tàu — báo cáo triển khai polish

Ngày 16/11/2026. Trạng thái: **đã triển khai trong working tree, chờ Terra QA**. Không commit, push hoặc deploy. Không thay luật HQ-BANTAU-1.

## Phạm vi đã làm

- Tạo năm asset SVG tàu tự vẽ: tuần tra 2 ô, khu trục 3 ô, tàu ngầm 3 ô, thiết giáp 4 ô và hàng không mẫu hạm 5 ô. Tạo các sprite SVG thủy lôi, nước, nổ và lửa; tổng dung lượng file asset dưới 14 KB trước nén.
- Tàu của mình được vẽ trong cả xếp tàu lẫn chiến đấu. Ở biển đối thủ, chỉ các ô đánh trúng được hiển thị cho tới khi server công bố tàu chìm; khi chìm, client nhận projection `revealedSunkShips` chỉ chứa mã hiển thị chung, độ dài và footprint đã chìm.
- Kéo tàu qua Pointer Events: giữ offset của đoạn đang nắm, preview/snapping, pointer capture, một intent sau khi thả, chờ ACK server, trả lại vị trí đã xác nhận nếu bị từ chối. Có huỷ khi thả ngoài bàn, pointercancel hoặc Escape; giữ đường chọn tàu/chạm ô, nút xoay và bàn phím hiện có.
- Aim phân biệt preview đang chờ ACK và aim đã xác nhận. Không cho bắn trước ACK; lần kích hoạt thứ hai vào cùng ô đã xác nhận mới gửi ý định bắn. Aim riêng không phát sang đối thủ.
- Trong chiến đấu, biển đối thủ luôn lớn để thao tác và hạm đội mình nhỏ hơn để xem. Desktop giữ mình bên trái/đối thủ bên phải; mobile giữ biển địch là mục tiêu lớn, hạm đội mình là bản xem nhỏ. Đổi lượt chỉ đổi nhãn/viền đỏ-xanh, không đổi kích thước hay thứ tự.
- Thêm timeline trình bày theo `serverTime`: thủy lôi rơi, splash khi trượt, nổ/cháy theo từng ô khi trúng, lớp cháy tồn tại theo snapshot. Cue Bắn tàu được phát theo thời điểm impact, không để animation quyết định transition game. Có rung cục bộ bảng và reduced-motion.

## File chính

- `packages/bantau/src/index.ts` — projection tàu chìm đã được server xác nhận.
- `packages/shared/src/bantau-public-game-schema.ts` và `packages/shared/src/public-game-schemas.test.ts` — schema runtime và kiểm tra privacy của projection.
- `src/bantau/BantauTable.tsx`, `src/styles/bantau.css` — lưới, bố cục, kéo thả/aim, lớp tàu và hiệu ứng.
- `src/audio/soundEffects.ts` — cue riêng cho Bắn tàu.
- `public/assets/bantau/ships/`, `public/assets/bantau/fx/` — asset SVG tự vẽ và manifest.
- `docs/bantau-rules.md`, `docs/reports/bantau/04-data-contract.md`, `docs/reports/bantau/08-polish-plan.md` — trạng thái luật, projection và kết quả kế hoạch.

Các file UNO/Nối từ/Caro, HTTP LAN, server reconnect và Fix 1.1 đang có thay đổi trong working tree từ phạm vi trước; đợt này giữ nguyên, không hoàn nguyên.

## Kiểm chứng và kết quả

- Baseline trước khi sửa: `npm run typecheck` và `npm run build` đạt. `npm test` có 170/182 test đạt; 12 test tích hợp không mở listener được do `listen EPERM 127.0.0.1` trong sandbox.
- Sau sửa: `npm test` đầy đủ đạt **183/183 test trong 17 file** khi cho phép loopback. Lần chạy mặc định trong sandbox vẫn gặp cùng giới hạn loopback (171/183 đạt, 12 lỗi listener/timeouts); không phải assertion lỗi của game.
- `npm run typecheck`: đạt.
- `npm run build`: đạt. Build ghi nhận 177 modules; CSS 146.03 KB, JS 543.18 KB (gzip 160.50 KB). Vẫn có cảnh báo hiện hữu về annotation Zod và chunk JavaScript lớn hơn 500 KB.
- Test engine/schema Bắn tàu chạy riêng: 12/12 đạt, gồm projection an toàn cho tàu chìm.
- Hai phiên browser độc lập, Chrome và Safari, mở ứng dụng local với storage/session tách biệt: tạo phòng riêng, tham gia bằng mã, sẵn sàng, bắt đầu, khoá đội hình, vào combat, chọn aim, kích hoạt bắn và quan sát event trượt cùng lượt đổi. Quan sát UI xác nhận biển đối thủ lớn hơn, hạm đội mình nhỏ hơn và bố cục không đảo khi đổi lượt.
- `git diff --check`: sạch tại lần kiểm tra cuối.

Không hoàn thành ván thắng trong browser; không kéo tàu trực tiếp bằng pointer trong lượt này; không kiểm thử viewport trên điện thoại thật, nghe cue bằng thiết bị thật/iOS hoặc đo độ trễ âm thanh giữa hai máy. Không có ảnh chụp kiểm chứng được lưu làm artifact trong repo. Đây là các mục Terra cần tự kiểm tra, không được xem là đã nghiệm thu.

## Skill và thư viện tương tác

Đã đọc và áp dụng hướng dẫn `ui-ux-pro-max` cho touch, trạng thái, responsive và reduced motion. Đã đọc `lucian-uxui` và tra catalog cho thao tác kéo; catalog khả dụng chỉ đưa ra các thành phần không phù hợp kéo tàu trên lưới. Không chọn hoặc port thành phần Lucian, không bịa ID. Tương tác kéo được viết theo UI riêng của game và Pointer Events; không thêm thư viện nặng.

## Trạng thái bàn giao

Chặng 0–5 đã được triển khai/kiểm tra theo [kế hoạch polish](./08-polish-plan.md). Luật HQ-BANTAU-1 được giữ nguyên. Terra chưa duyệt; dùng [checklist QA](./10-polish-qa.md) để nghiệm thu các trường hợp chưa được kiểm tra trực tiếp.
