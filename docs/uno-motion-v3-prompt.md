# Prompt triển khai UNO motion v3

Trạng thái: **đã thực hiện** theo plan. Báo cáo và phần còn cần Terra kiểm tra: [uno-motion-v3-report.md](./uno-motion-v3-report.md).

Bạn phụ trách hoàn thiện UI/motion Bàn Bạn theo `docs/uno-motion-v3-plan.md`. Người dùng chơi thật và chưa hài lòng với đường bay, rung và dồn bài của v2. Hãy khảo sát rồi trực tiếp sửa tuần tự, kiểm thử và bàn giao Terra.

## Đọc đầy đủ trước khi sửa

`AGENTS.md`, `docs/uno-motion-v3-plan.md`, `docs/uno-motion-v2-plan.md`, `docs/uno-motion-v2-report.md`, `docs/uno-rules.md`, `docs/architecture.md`, `docs/ui-ux.md`, `docs/join-room-fix-plan.md`, `docs/test-plan.md`; skill guide `~/.agents/skills/SKILLS_GUIDE.md` và SKILL.md của ui-ux-pro-max/lucian-uxui. V3 ưu tiên với quyết định UI khác v2.

Rà source App/LiveTable, game-effects, CSS và shared/server game:effect. Dùng ui-ux-pro-max cho motion/focus/performance. Tra Lucian khi cần thành phần, không bịa ID hay port motion không phù hợp với game. Báo file dự kiến sửa và nguyên nhân thực tế trước khi sửa.

## Yêu cầu bắt buộc

1. **Mobile hai lần chạm cùng lá:** lần đầu nâng thêm 12–16px, lần sau đánh. Không cần tap nhanh, không nút Đánh lá riêng. Chạm lá khác đổi chọn; Wild lần hai mở màu. Đưa selectedMobileCardId vào presentation nâng lá đúng, reset khi quyền/state/game thay đổi. Scroll không đánh nhầm, action không gửi lặp. Desktop giữ hành vi hiện tại.
2. **Viền:** bỏ draw-attention halo dày và các ring trang trí playable/selected khi pointer/touch. Lá chọn thể hiện bằng nâng lên, legal card bằng độ sáng. Giữ focus-visible bàn phím gọn, không xóa focus toàn site; giữ viền lá và màu bàn.
3. **Flight liền mạch:** sửa sai khác điểm neo nguồn và overlay; đo tâm nguồn/đích cùng hệ tọa độ, scale đúng kích thước. Không giảm opacity về 0 trước khi tới đích. Hợp nhất flight → landing → shake, bỏ animation discard tự chạy song song gây nhảy/lá kép. Snapshot/turn cập nhật ngay, animation không khóa action.
4. **Rung thực tế tại landing:** tăng theo tổng phạt, có trần. Rung nền/viền/ring và hình pile đủ nhận ra; hit target, hand/tray/dialog/header đứng yên. Kiểm tra preference reduced motion và clipping, không chỉ tăng con số intensity. Lá số không rung, +4 slam rõ hơn +2.
5. **Hand dồn mượt:** FLIP/WAAPI theo cardId cho cả X/Y, kể cả qua hàng mobile. Tách transform reflow khỏi transform nâng lá. Hủy animation cũ khi state mới đến; reset baseline trên resize/scroll/game mới và cleanup. Không dùng key index hoặc remount hand.

Giữ BB-UNO-1, allowedActions server, session/privacy, HTTP LAN UUID fallback, tiếng Việt và radius/số đen. Không thêm dependency nặng, audio, vibration API hoặc game.

Trước khi đổi shared/server event, ghi hợp đồng vào plan và giải thích correlation cần thiết. Chỉ metadata công khai đã validate, không lộ hand/bài rút/token. Giữ event dedupe/revision, không replay lịch sử sau resume. Hành động sai không có animation thành công. Cleanup phải luôn khôi phục discard authoritative nếu overlay bị hủy.

## Thực hiện và kiểm chứng

Theo chặng 1–6 trong plan, báo ngắn sau mỗi chặng. Hoàn thiện phần đã được giao trước khi kết thúc lượt. Không tuyên bố mượt bằng suy đoán từ source hoặc build.

Chạy typecheck/build, tests liên quan intensity/gate/correlation nếu sửa và regression luật/socket/HTTP LAN. Chỉ thêm test cho logic có ý nghĩa. Browser hai session độc lập: local/remote flight, phạt tăng, Skip/Wild/UNO, mobile tap hai lần, hand dồn qua hàng, reconnect/rematch; reduced motion app/OS; keyboard focus; 360/390/1440px và hand nhiều lá. Chụp/quay bằng chứng thực nếu có công cụ. Browser thiếu thì thử truy cập và ghi BLOCKED; tiếp tục kiểm tra khác, không gọi đó là UI đã đạt.

Tạo `docs/uno-motion-v3-report.md`: file thay đổi, DOM/event/correlation, thông số thật, cleanup/privacy, kiểm tra/lệnh/kết quả thật, video/ảnh, lỗi hoặc giới hạn còn lại và checklist Terra. Cập nhật trạng thái/link trong docs liên quan; giữ report v2 như lịch sử. Không tự ghi Terra approve.
