# Prompt cho GPT-6.1 Sol · High — sửa luật và giao diện UNO

> Prompt này đã được thực hiện. Kết quả, test và giới hạn ghi tại [sol-uno-fix-report.md](./sol-uno-fix-report.md); checklist nghiệm thu Terra tại [sol-handoff.md](./sol-handoff.md).

Thiết lập trong bộ chọn model: **GPT-6.1 Sol**, reasoning **High**. Việc ghi tên trong prompt không tự đổi model.

Trạng thái tài liệu: prompt được chuẩn bị trước; hiện chỉ cập nhật Markdown, **CHƯA CODE**. Chỉ thực hiện phần bên dưới khi người dùng gửi prompt này để yêu cầu bắt đầu triển khai.

---

Bạn là senior engineer tiếp tục repo Bàn Bạn hiện tại, chạy bằng GPT-6.1 Sol ở mức High. Người dùng giao bạn triển khai bộ luật tùy chỉnh BB-UNO-1 đã chốt và sửa các lỗi được liệt kê. Đọc source, xác minh nguyên nhân, sửa, kiểm thử và bàn giao cho Terra. Không cần hỏi lại các điều luật đã được xác nhận. Không tuyên bố đã sửa chỉ dựa vào số test xanh của bản cũ.

## 1. Đọc trước khi sửa

- Đọc AGENTS.md, ~/.agents/skills/SKILLS_GUIDE.md, README và cấu trúc code hiện tại.
- Đọc docs/uno-rules.md, docs/uno-fix-plan.md, docs/implementation-plan.md, docs/architecture.md, docs/rooms-and-reuse.md, docs/verification-report.md, docs/terra-test-report.md và docs/join-room-fix-plan.md.
- `docs/uno-rules.md` là đặc tả đích BB-UNO-1 đã được người dùng duyệt. `docs/uno-classic-reference.md` chỉ lưu lịch sử; code/test Classic cũ có thể cần thay đổi.
- Dùng ui-ux-pro-max cho rà UI/accessibility; đọc lucian-uxui nếu cần sửa/thêm thành phần tương tác, tra catalog trước khi chọn và không bịa ID. Giữ token tím/dark và thành phần đang có nếu phù hợp.
- Báo ngắn gọn file dự kiến sửa và thứ tự, rồi triển khai. Không thêm backend framework, game mới, account/database/chat/bot hoặc bộ chọn nhiều chế độ luật.

## 2. Bối cảnh cần giữ

React/TypeScript/Vite, Node/TypeScript/Socket.IO, Zod, Vitest. Phòng RAM, 2–6 người, public/private theo mã, khách ready trước khi host start, host kick. Server tạo bài, xác thực mọi ý định, quản lý lượt và chiếu state riêng. Không gửi tay đối thủ hoặc thứ tự draw pile.

Người dùng đã thử và xác nhận join + sync đánh bài hoạt động sau bản sửa HTTP LAN. Giữ `src/action-id.ts` (fallback getRandomValues khi randomUUID không có) và catch/finally nhả lock. Không đưa lại lỗi này.

## 3. Trình tự và bằng chứng trước khi sửa

Làm tuần tự qua ba chặng, không dừng xin duyệt lại giữa chặng trong phạm vi đã giao:

1. Engine/shared: lập bảng phase, intent, điều kiện hợp lệ và transition trước khi sửa; viết test tái hiện, rồi triển khai luật mới. Chạy test engine/schema trước khi nối UI.
2. Room/session: trace host reload và lifecycle; sửa event/thông báo/phục hồi cùng test service/socket.
3. UI: nối với state đã được server xác thực; sau đó kiểm tra tổng thể và cập nhật tài liệu.

Nếu một lỗi người dùng báo không tái hiện được, giữ nguyên sự thật đó, kiểm tra projection/phase/game ID và thêm regression test phù hợp; không bịa nguyên nhân. Trace chẩn đoán chỉ ghi room/game/action ID, phase, revision và public state cần thiết; không ghi token, raw hand hoặc draw pile. Phân biệt lỗi do luật Classic cũ với bug thực thi và bug hiển thị.

### Những tình huống cần tái hiện

- Báo cáo: Đỏ 5 nhưng đối thủ đánh được Xanh 9; màu/Reverse chưa đúng. Tạo test failing ở tầng thích hợp, kiểm tra request thực tế và snapshot để phân biệt lỗi engine với hiển thị. Không chỉ khóa nút client.
- Đỏ 5→Xanh 9 phải bị server từ chối mà state/revision không đổi. Đỏ 5→Xanh 5 hợp lệ, màu thành xanh. Tương tự khi khớp ký hiệu khác màu.
- Reverse với chiều 1→2→3: 2 đánh thì tới 1. Với 2 người, Reverse như Skip, người đánh được đi tiếp.

## 4. Chuyển engine sang BB-UNO-1

- Giữ bộ 108 lá, setup, rút thường, UNO và recycle theo tài liệu mới.
- +4 tự do dù có cùng màu; bỏ challenge và dữ liệu bí mật dành riêng cho challenge. Xóa phase/intent/UI challenge cũ hoặc từ chối payload cũ bằng lỗi phù hợp; không để nhánh cũ còn chạy.
- Wild/+4 chọn màu hợp lệ trước khi chuyển lượt; có thể chọn ở client rồi gửi play + color nguyên tử. Chỉ mở dialog không làm đổi state server. Wild mở đầu do đúng người đi trước chọn.
- Khoản phạt phải có state rõ: tổng N, loại phạt gần nhất, người nhận và trạng thái chờ chốt thắng khi cần. Đặt kiểu dữ liệu rõ ràng; đừng dùng nhiều boolean mâu thuẫn.
- +2 cho cộng +2/+4; +4 chỉ cho cộng +4. Khi cộng +2 không cần trùng màu. Lá +2 đầu chuỗi vẫn phải hợp lệ theo lượt thường.
- +2→+2→+4→+4=12. Không được đáp +4 bằng +2, không dùng số/Skip/Reverse/Wild thường để né phạt.
- Người chịu phạt có thể cộng hoặc bấm Nhận N lá, kể cả có lá cộng. Không có lá cộng chỉ được nhận. Không tự rút phạt khi lá + được đánh.
- Nhận tổng một lần, xóa khoản phạt, mất lượt; không đánh lá vừa nhận. Dedupe/revision vẫn chặn nhận hai lần. Tái tạo draw pile khi cần, bảo toàn lá.
- Lá cuối +2/+4: cấm cộng tiếp, bắt người kế nhận tổng rồi mới chốt thắng. Nếu đang cộng, tổng gồm cả phần trước. +4 cuối vẫn chọn màu. Cạn bài áp dụng chính sách hòa trong docs, không tạo bài.
- +2 mở đầu tạo khoản phạt 2 cho người trái dealer, được cộng/nhận; +4 mở đầu vẫn trả lại deck và lật lại.
- Hô/bắt UNO phải hoạt động trong chuỗi phạt và khi lượt đổi hướng/skip. Hai lá phạt UNO riêng không cộng vào tổng phạt. Đóng window ở hành động đầu của lượt tiếp theo theo docs.
- Dùng engine thuần, không cho React/Socket/timer quyết định luật. Nếu chia sẻ predicate để UI highlight, giữ module an toàn cho bundle client; server vẫn xác thực độc lập. Tối ưu để UI và server không có hai bản luật lệch nhau.

## 5. Sửa lifecycle phòng

Người dùng báo host reload khiến phòng mất mà khách không được báo. Trace disconnect/resume/leave/expiry/delete trước khi sửa; không giả định unload là leave.

- Reload bình thường: reconnect token khôi phục đúng ghế nếu room tồn tại; không tạo trùng, socket cũ mất quyền. Offline tạm thời giữ theo grace hiện có, không lập tức xóa room.
- Room thực sự đóng: thông báo lý do đến mọi thành viên liên quan trước khi xóa mappings; client xóa session/snapshot/action/dialog cũ, về sảnh và báo rõ.
- Server restart: không thể gửi event trước crash; khi connect/resume thất bại phải thoát state cũ và báo phòng không còn.
- Giữ host leave chuyển quyền và kick giữa ván hủy ván về chờ. Không đổi thành chính sách host offline đóng tất cả. Timeout không để phòng/guest treo vô hạn.
- DTO/event dùng chung có kiểu, xác thực runtime, xử lý race disconnect/resume/close. Không lộ token trong log.

## 6. UI cần sửa

- Lá không thể đánh: tối vừa phải, vẫn đọc được số/ký hiệu, disabled và không gửi intent. Lá hợp lệ nổi bật vừa phải; chỉ tương tác khi đúng lượt/phase.
- Tới lượt thường nhưng không có lá hợp lệ: highlight Rút bài. Vẫn được rút tự nguyện khi có lá hợp lệ.
- Đang phạt: tổng rõ ràng, chỉ các lá cộng phù hợp tương tác; nút Nhận N lá luôn có cho đúng người. Cấm hiển thị Rút thường/Challenge/giữ lượt không phù hợp.
- Màu hiện tại có chữ/ký hiệu và viền bàn theo màu; cập nhật cùng snapshot, không chờ animation. Chọn màu hỗ trợ keyboard, focus trap/restore và mobile.
- Cập nhật màn Luật chơi, preview và copy kết quả theo BB-UNO-1. Gắn nhãn luật tùy chỉnh, giữ footer dự án không chính thức.
- Giữ homepage không có nút Tạo phòng UNO ở hero. Không redesign ngoài phạm vi. Không thêm thư viện nặng.

## 7. Kiểm thử và bằng chứng

Thực hiện ma trận docs/uno-fix-plan.md. Viết test có ý nghĩa cho lỗi tái hiện và luồng mới, không chỉ đổi expected để bộ test xanh. Ít nhất:

- Màu/số/ký hiệu hợp lệ và sai, cả khi gửi trực tiếp từ socket.
- Reverse hai/ba người và cả hướng; chọn màu/Wild mở đầu.
- Chuỗi +2/+4, cộng trái phép, chọn nhận dù có lá cộng, số phạt chính xác, nhận lặp và recycle.
- Lá cuối trong chuỗi, chờ nhận rồi winner, cấm cộng/challenge cũ; UNO/catch đúng window.
- Projection riêng tư, wrong turn, stale revision/socket, action ID trùng.
- Host reload/resume, đóng room thông báo tới khách, server mất room, leave/kick/timeout.
- Hồi quy 2–6 người, ready/public/private và HTTP LAN UUID fallback.

Chạy typecheck, test, build; smoke dev/production. Nếu có browser, mở hai context độc lập localStorage, chơi ván shuffle production qua UI tới kết quả rồi rematch. Kiểm tra 1440px, 390px và 360px; không tràn ngang, bàn phím và reduced motion. Thiết bị thật/LAN chỉ báo đã thử nếu thực chạy. Browser không khả dụng thì ghi BLOCKED và tiếp tục source/service/socket; fixture không chứng minh ván production qua UI.

## 8. Bàn giao cho Terra

Cập nhật docs/verification-report.md, README, architecture, rooms và test plan; tạo docs/sol-handoff.md cho đợt này, giữ docs/luna-handoff.md làm lịch sử. Cập nhật các tài liệu để phân biệt code thực đã làm với dự kiến; dọn các mô tả Classic/challenge trái luật mới trong tài liệu hiện hành. Giữ file Classic lịch sử. Không sửa báo cáo Terra cũ thành kết quả mới hoặc tự ghi Terra approve.

Tạo docs/sol-uno-fix-report.md gồm:
- File thay đổi và vai trò; mô hình state/intent mới, transition phạt và màu.
- Mỗi báo cáo người dùng: đã tái hiện hay chưa, nguyên nhân/bằng chứng, cách sửa và test bảo vệ.
- Nguồn sự thật của legal actions và cách tránh lệch UI/server.
- Lệnh/kết quả thực chạy, test count và đường dẫn bằng chứng đã che token.
- Hành trình browser/thiết bị thật hoặc phần bị chặn, không suy đoán.
- Rủi ro/giới hạn, những việc Terra cần nghiệm thu tiếp, commit nếu có Git.

Cuối cùng trả lời ngắn gọn đã sửa gì, đã kiểm tra gì, còn phần nào chưa xác minh và cách người dùng thử lại. Không gọi hoàn tất nghiệm thu nếu còn thiếu bằng chứng hai người qua UI.
