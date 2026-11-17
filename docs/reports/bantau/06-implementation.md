# Bắn tàu — báo cáo triển khai

Cập nhật 16/11/2026. Thực hiện các phiên 0→5 theo `01-plan.md`, theo hướng dẫn `02-luna-prompts.md` và quyết định HQ-BANTAU-1. Người dùng cho phép chạy liên tục các phiên. Trạng thái: code và kiểm tra tự động hoàn tất; đã thử một phần luồng chơi với hai session độc lập trên Chrome; chờ Terra nghiệm thu. Không commit, push hoặc deploy.

## Kết quả theo chặng

| Chặng | Kết quả |
|---|---|
| 0 — Khảo sát/baseline | Đọc hướng dẫn, luật, hợp đồng, kiến trúc và source. Working tree có sẵn thay đổi tài liệu Fix 1.1; không revert. Baseline mới được ghi ở [05-baseline.md](./05-baseline.md). |
| 1 — Engine | Thêm engine thuần, preset đội hình 3/4/5 tàu, sinh đội hình hữu hạn, kiểm tra đặt tàu, khóa, aim, bắn tay/timeout, resolving, điểm kết thúc và projection riêng. RNG/clock truyền vào; engine không phụ thuộc UI hay Socket.IO. 9 test engine mới đạt. |
| 2 — Shared/backend/API | Thêm `bantau` vào catalog, settings, snapshot/schema, room lifecycle, socket intent và HTTP API. Server xác nhận mọi nước đi và quản lý setup/turn/resolving timers, privacy, reconnect/pause, điểm +10 và countdown ván tiếp. Room/realtime test kiểm tra hai client độc lập, quyền phiên, kết quả và giữ kín fleet/aim. |
| 3 — Sảnh/cấu hình/xếp tàu | Bắn tàu xuất hiện trong sảnh và bộ lọc phòng; panel cài đặt chọn visibility, target, thời gian lượt, kích thước bàn, số tàu, hit-continue và chạm tàu. Màn xếp đội hình cho chọn tàu, xoay, đổi ngẫu nhiên, khóa; board chỉ chứa fleet của người đó. |
| 4 — Bàn đấu/hiệu ứng | Thêm hai bảng riêng, hai lần kích hoạt cùng ô để aim rồi fire sau ACK, timer, kết quả hit/miss/sunk, dialog chịu thua, status điểm/trận, âm thanh và hiệu ứng tự vẽ. Miss không được lưu trong state/snapshot, vẫn chọn bắn lại được. Không dùng animation để điều khiển luật. |
| 5 — Hồi quy/bàn giao | `npm test`, typecheck, build đều đạt. Hai profile Chrome độc lập đã tạo phòng, join, ready, khóa đội hình, vào combat và bắn trượt/trúng. Đã cập nhật README, mục lục docs, test plan, luật HQ-BANTAU-1, project summary; checklist Terra ở [07-qa.md](./07-qa.md). |

## File chính

- Engine: `packages/bantau/src/index.ts`, `packages/bantau/src/index.test.ts`, `packages/bantau/package.json`.
- Protocol/runtime: `packages/shared/src/index.ts`, `packages/shared/src/bantau-public-game-schema.ts`.
- Backend: `server/src/rooms.ts`, `server/src/index.ts`; test tại `server/src/rooms.test.ts` và `server/src/realtime.test.ts`.
- UI: `src/bantau/BantauTable.tsx`, `src/styles/bantau.css`, `src/components/RoomSettingsDialog.tsx`, `src/App.tsx`, `src/main.tsx`.
- API/sound: `src/api/http.ts`, `src/api/realtime.ts`, `src/audio/soundEffects.ts`.
- Đặc tả/bàn giao: `docs/bantau-rules.md`, `docs/test-plan.md`, `README.md`, `docs/reports/project-summary.md`.

## Cách chạy và tự thử

Theo lệnh repo trong [README](../../../README.md): `npm ci`, `npm run dev`, sau đó mở `http://localhost:5173` trên hai profile hoặc hai thiết bị. Tạo phòng Bắn tàu, chia sẻ mã; người thứ hai nhập mã, sẵn sàng; host bắt đầu. Mỗi bên xếp/đổi đội hình rồi khóa. Trong combat, nhấn một ô biển đối thủ để ngắm, nhấn lại cùng ô sau khi server xác nhận để bắn. Thử cả miss (ô trở lại trạng thái chưa bắn), hit, đổi aim sang ô khác, chờ timeout và mất/kết nối lại.

Server local có trạng thái RAM, chỉ một process; restart sẽ đóng phòng và mất ván. Chưa deploy.

## Giới hạn còn mở

- Follow-up 16/11/2026: sửa trạng thái availability trên trang chủ để phân biệt lỗi kết nối, backend chưa có Bắn tàu và game bị backend tắt. Khi API lỗi, người chơi có thể bấm **Thử kết nối lại**. Typecheck/build đạt; 170 test không cần mở listener đạt. `http-api.test.ts`/`realtime.test.ts` không chạy được trong sandbox do hạn chế mở listener; cần chạy lại toàn suite với loopback trước QA.
- Chưa hoàn tất một ván thắng và rematch qua giao diện browser; các đường thắng, cộng điểm, timeout và tự mở round được kiểm tra bằng engine/room/realtime tests.
- Chưa thử màn hình 360/390 px, 1440 px bằng device emulation hoặc điện thoại thật trong lần này. Chưa nghiệm thu cảm giác animation/sound.
- Browser run thử phòng riêng và bắn tay ở desktop; chưa browser-test phòng public, hết giờ thật, reconnect thật, resign hoặc mọi tổ hợp setting.
- Chưa thử production HTTPS/WSS, hosting, tải đồng thời hoặc restart thông báo trên thiết bị.
- Chưa có Terra approval. Fix 1.1 vẫn là nền chưa phát hành; Bắn tàu được thêm vào working tree mà không tăng version.
