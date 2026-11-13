# Prompt triển khai hiệu ứng UNO

Trạng thái: prompt này đã được thực hiện. Xem [báo cáo triển khai](./uno-motion-report.md) và checklist nghiệm thu trong báo cáo.

---

Bạn là senior frontend engineer phụ trách tiếp tục Bàn Bạn. Triển khai hiệu ứng UNO và giảm bo góc lá bài theo `docs/uno-motion-plan.md`. Người dùng muốn lá số animation bình thường; +2/+4, các lá cộng tiếp và Bỏ lượt phải có cảm giác đập xuống/rung rõ hơn. Không thay luật BB-UNO-1.

## Đọc trước khi sửa

Đọc đầy đủ AGENTS.md, docs/uno-motion-plan.md, docs/uno-rules.md, docs/architecture.md, docs/ui-ux.md, docs/sol-uno-fix-report.md, docs/verification-report.md và docs/join-room-fix-plan.md. Khảo sát source hiện tại, không giả định cấu trúc từ báo cáo cũ.

Đọc skill guide tại ~/.agents/skills/SKILLS_GUIDE.md. Dùng ui-ux-pro-max cho motion/accessibility/responsive. Đọc lucian-uxui cho thành phần tương tác phù hợp, tra catalog trước khi chọn; không bịa ID hoặc thêm dependency chỉ để tạo shake. Nếu không có thành phần phù hợp, dùng control hiện tại và CSS của dự án. Báo ngắn skill đã áp dụng và lý do.

## Phạm vi bắt buộc

1. Giảm góc bo lá cơ sở về khoảng 5–6px, dùng token và scale theo kích thước. Áp dụng cả CardArt, hero-card và preview. Giữ số đen, viền rõ và khả năng đọc của lá disabled.
2. Lá số trượt/chạm nhẹ, không shake. Wild thường đổi màu nhẹ. +2/+4 có cú đập và shake; +4 mạnh hơn có giới hạn. Chuỗi cộng cập nhật tổng phạt. Bỏ lượt có cú đập/rung và nhãn ở người bị bỏ. Reverse hiển thị hướng mới đúng, không dựng animation gây hiểu nhầm lượt.
3. Thêm chia/rút/nhận N lá/UNO/kết quả theo ma trận kế hoạch. Nhận nhiều lá dùng số ít vật thể đại diện kèm N; không chạy từng lá kéo dài.
4. Chỉ rung lớp hình ảnh bàn; tay bài, controls và dialog ổn định. Có Giảm hiệu ứng lưu cục bộ, kết hợp prefers-reduced-motion theo yêu cầu chặt hơn. Mobile rung nhẹ hơn, không tràn ngang.
5. Hiệu ứng được kích hoạt bởi hành động server xác nhận. Rà payload hiện tại; nếu cần metadata công khai, nêu cấu trúc và luồng chống trùng trước khi sửa rồi triển khai trong phạm vi đó. Snapshot luôn quyết định trạng thái; animation không khóa luật/lượt hoặc cửa sổ UNO.
6. Chống phát lặp ack/broadcast, bỏ event cũ/out-of-order, không diễn lịch sử sau resume; reset theo gameId khi rematch. Không suy luận đầy đủ chỉ từ topCard hoặc cardCount. Dọn effect/timer khi leave, reconnect, room close, unmount và tab quay lại foreground.
7. Không lộ mặt lá nhận của đối thủ. Overlay không chặn chạm/focus. Không WebGL, âm thanh, vibration API, game mới hoặc thư viện nặng. Giữ HTTP LAN UUID fallback, reconnect/session và luật hiện có.

## Cách thực hiện

- Bắt đầu bằng nhận xét source và danh sách file dự kiến sửa. Ghi quyết định metadata/event trong docs/uno-motion-plan.md nếu cần, trước khi code phần đó.
- Thực hiện tuần tự: radius/tokens → điều phối sự kiện + lá số/rút → chức năng đập/rung → reduced motion/mobile → kiểm chứng/bàn giao. Mỗi chặng báo ngắn thay đổi và kết quả.
- Tách phần effect khỏi luật; chỉ trích component/hook cần thiết, không dựng framework animation hoặc game framework mới.
- Ưu tiên CSS transform/opacity và Web Animations API nếu cần. Tránh đọc/ghi layout liên tục; giới hạn phần tử động và dừng effect cũ khi không còn phù hợp với state.

## Kiểm chứng

- Chạy typecheck/build. Nếu thay event/server hoặc thêm bộ điều phối có logic, thêm test có ý nghĩa cho privacy, event identity, duplicate/out-of-order, baseline resume và reset game. Chạy regression engine/Socket.IO liên quan; không thêm test chỉ kiểm tra chuỗi class CSS.
- Nếu browser dùng được, thử ít nhất hai phiên độc lập: join/ready/start, đánh số, +2/+4 cộng/nhận, Bỏ lượt, Reverse, Wild, UNO và rematch; thử disconnect/resume không diễn lại hiệu ứng.
- Xem 1440/390/360px, bàn 2 và 6 người, tay nhiều lá, keyboard/focus, OS reduced motion và tùy chọn trong app. Có ảnh/video ngắn nếu công cụ hỗ trợ.
- Ghi đúng kiểm tra thực chạy. Browser thiếu ghi BLOCKED; không gọi build xanh là nghiệm thu giao diện. Không cần hỏi lại các lựa chọn đã có trong plan.

## Bàn giao cho Terra

Tạo docs/uno-motion-report.md: thay đổi/file, thiết kế event và privacy, cách chống lặp/cleanup, bảng hiệu ứng đã làm, kết quả kiểm tra thực chạy, bằng chứng và giới hạn. Ghi rõ phần chưa đạt hoặc chưa thử. Cập nhật ui-ux.md, architecture/test-plan nếu có thay đổi tương ứng; liên kết report mới, giữ báo cáo cũ như lịch sử và không tự ghi Terra approve.

Cuối cùng tóm tắt cho người dùng những gì đã làm, đã kiểm tra và còn cần Terra nghiệm thu.
