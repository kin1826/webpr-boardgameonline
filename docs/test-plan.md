# Kế hoạch kiểm thử hiện hành

Expected theo [BB-UNO-1](./uno-rules.md), [NT-VI-1](./noitu-rules.md) và [HQ-CARO-1](./caro-rules.md), vòng đời theo [đặc tả phòng](./rooms-and-reuse.md). Kết quả đã chạy và giới hạn ở [báo cáo hợp nhất](./reports/project-summary.md), [báo cáo Nối từ](./reports/noitu/summary.md) và [báo cáo Caro](./reports/caro/summary.md); báo cáo kiểm thử mới phải nằm trong `docs/reports/`.

## Tự động

| Vùng | Trường hợp cần giữ |
|---|---|
| Engine / bộ bài | 108 ID duy nhất, chia 7 lá/người cho 2–6 ghế, bảo toàn qua đánh/rút/tái tạo |
| Mở bàn | Không lật bài sẵn, topCard null, đúng người đi đầu được đánh mọi loại lá; rút rồi giữ vẫn để bàn trống cho người kế |
| Hợp lệ / màu | Sai lượt/sai bài không đổi state/revision; cùng số/ký hiệu khác màu đổi màu bàn; Wild bắt buộc màu hợp lệ |
| Hành động | Skip, Reverse hai hướng/wrap và 2–6 ghế; Reverse hai người đi tiếp; rút chỉ đánh lá mới hoặc giữ |
| Cộng / nhận | 2→2→4→4; sau +4 cấm +2/Wild; có lá cộng vẫn nhận được; đúng tổng, mất lượt, idempotency và recycle |
| UNO | Hô/bắt đúng cửa sổ; action người kế đóng cửa sổ; Skip/Reverse/chuỗi phạt không để cửa sổ treo |
| Kết thúc | Sáu loại lá cuối thắng ngay; +2/+4 cuối trong chuỗi xóa phạt, không đợi nhận; chồng rút trống không cản thắng; sau finished từ chối action |
| Room/session | Public/private, ready/start 2–6, host-only, kick/leave, chuyển host, resume đúng ghế, socket/generation cũ mất quyền, timeout/cleanup/room-close |
| Shared/server | Payload strict, gameId/revision, action ID trùng/cũ, không lộ bài đối thủ hoặc chồng rút; hai socket độc lập chơi ván shuffle production và rematch |
| Client utilities | UUID fallback HTTP LAN; gate/dedupe game:effect; hình học nguồn/đích và intensity tăng có trần desktop/mobile |
| Nối từ engine | NFC/tiếng, nối đúng prefix, trùng/deny, dictionary known/unknown, 2–6 người, timeout đúng biên, giveUp/winner, pause/resume |
| Nối từ proposal | Eligible voters, strict majority toàn mẫu, vote lặp/stale/không eligible, accept/reject/timeout, deadline lượt đóng băng, quota hai proposal, không lưu từ nhóm nhận vào dictionary |
| Nối từ phòng | Data hash/loader, source root path, draft sequence/privacy/no revision, noitu:action chống game/session/turn cũ, cleanup/rematch và giữ UNO |
| Caro engine | Bàn 15×15; lượt/tọa độ/ô bận; đúng mục tiêu 4/5/6 có đầu mở theo 4 trục; vượt mục tiêu không thắng; biên/chặn hai đầu; nhiều trục; hòa; timeout/resign; pause/resume; capabilities |
| Caro phòng/API | min=max=2, người thứ ba bị từ chối; ready/start; schema strict; action ID/revision/game/turn/session cũ; deadline race/timer cleanup; disconnect pause/grace expiry; leave/kick hủy ván; rematch cùng cặp đổi X/O |
| Caro realtime/privacy | Hai Socket.IO client độc lập create→join→ready/start→place→win→rematch; action chéo game, packet sai và duplicate; snapshot chỉ có state công khai/capabilities, không có token |

File test nằm trong `packages/uno/src/`, `packages/noitu/src/`, `packages/caro/src/`, `packages/shared/src/`, `server/src/`, `src/action-id.test.ts` và `src/game-effects.test.ts`. Chạy `npm test`, `npm run typecheck`, `npm run build` theo README. Socket tests cần bind loopback; nếu sandbox chặn, rerun có quyền loopback rồi ghi rõ. Không thêm test chỉ kiểm tra tên class hoặc sao chép logic triển khai.

## Browser / thiết bị và nghiệm thu Terra

1. Hai profile/localStorage độc lập: tạo → nhập mã → ready/start → mở bàn trống → đánh/rút/chọn màu/UNO/cộng/nhận → thắng ngay bằng lá cuối → rematch. Không dùng hai tab cùng session làm hai người.
2. Thử 2/3/4/5/6 người; host reload/resume, thu hồi socket cũ, drop/reconnect, kick/leave và offline timeout. Phòng mất sau restart phải có thông báo khi resume thất bại.
3. Đánh số và chức năng từ local/đối thủ: bay đúng tâm, lá nằm lại chồng bỏ, không lá kép; + chạm rồi rung theo tổng 2/4/8/12/16; hit target/tray/hand không rung.
4. 360×640, 390×844 và 1440px; hand 1/7/14/25/40 lá, chạm A→B→B, cuộn/rotate, dồn bài qua hàng; không tràn ngang hoặc đánh nhầm do cuộn.
5. Keyboard/Tab/Enter/Space, focus dialog, zoom và contrast; reduced motion app/OS, tab nền và resume không replay effect.
6. Cài sạch theo lockfile, chạy production HTTP/Socket.IO, rồi thử URL HTTPS thật bằng hai mạng. Hosting một process/replica, proxy WebSocket đúng; không coi HTML tải được là multiplayer đã hoạt động.
7. Hai session Nối từ độc lập: tạo/join bằng mã, ready/start, đúng người/seed, prefix khóa, draft realtime, từ known, từ lạ + vote accept/reject/timeout, sai/lặp, hết giờ/chịu thua, reconnect/pause, winner/rematch; sau đó vào UNO để xác nhận route và game không lẫn state.
8. Hai session Caro độc lập: đúng hai ghế, start với X/O, đặt nước luân phiên, ô bận/sai lượt/tọa độ ngoài biên bị chặn, dãy đúng mục tiêu 4/5/6 có đầu mở thắng, vượt mục tiêu không thắng, timeout/resign/pause/reconnect/rematch đổi ký hiệu. Thử desktop 1440px và mobile 390/360px: zoom/pan/chọn→xác nhận không làm tràn ngang hoặc đánh nhầm.

Ghi đúng môi trường, lệnh/kết quả, fixture hay production shuffle, bằng chứng ảnh/video đã che token, lỗi và phần bị chặn. Chưa xem browser ghi BLOCKED; không dùng test xanh thay nghiệm thu cảm giác motion hoặc điện thoại thật.
