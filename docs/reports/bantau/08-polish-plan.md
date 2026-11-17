# Bắn tàu — kế hoạch hoàn thiện hình ảnh và tương tác

Ngày 16/11/2026. **Đã triển khai trong working tree; chờ Terra QA độc lập.** Phạm vi chốt: asset vector tự vẽ cho 2–5 ô, kéo thả có server ACK, dấu aim/focus dễ thấy, sprite bom/nước/nổ/cháy theo từng ô, âm thanh theo timeline; biển địch luôn lớn, hạm đội mình nhỏ chỉ xem. Không đổi luật HQ-BANTAU-1. Kết quả và bằng chứng ở [báo cáo triển khai](./09-polish-implementation.md) và [checklist QA](./10-polish-qa.md).

**Điều chỉnh đã chốt:** biển địch luôn lớn hơn để thao tác nhắm/bắn; hạm đội mình nhỏ, chỉ để theo dõi trong pha chiến đấu. Đổi lượt chỉ đổi viền/nhãn, không đổi kích thước hoặc vị trí hai bàn. Phần cài đặt được hoàn tất theo phạm vi đã duyệt; còn kiểm thử thiết bị thật và duyệt độc lập.

Liên quan: [luật HQ-BANTAU-1](../../bantau-rules.md), [kế hoạch tích hợp ban đầu](./01-plan.md), [thiết kế ban đầu](./03-ui-ux.md), [hợp đồng](./04-data-contract.md), [báo cáo code](./06-implementation.md), [QA còn mở](./07-qa.md).

## 1. Mục tiêu và phạm vi

Hoàn thiện cảm giác chơi bằng tàu liền khối có hình dáng riêng, kéo thả trực tiếp, dấu ngắm rõ, thủy lôi rơi và nổ theo sprite, cháy tại ô trúng, âm thanh có nhịp và bố cục theo lượt. Giữ skin Hội Quậy: nền tối, accent đỏ hiện có, font/avatar/token hiện tại, góc gọn; không đổi toàn trang thành skin pixel/naval khác.

Không thay HQ-BANTAU-1: đúng 2 người, server quyết định placement/aim/fire/timeout/kết quả/điểm, hai lần kích hoạt nhắm→bắn, timeout bắn aim ACK hoặc random, miss không lưu dấu, +10 và tự nối ván sau 3 giây. Giữ UNO/Nối từ/Caro, HTTP LAN, reconnect và Fix 1.1. Người dùng đã duyệt hướng polish; các kết quả triển khai và phần còn cần QA ghi ở cuối tài liệu.

## 2. Hiện trạng đọc từ source

| Vùng | Phát hiện | Việc cần làm |
|---|---|---|
| `src/bantau/BantauTable.tsx`, `Grid` | `shipAt` chỉ dựng khi `kind === 'setup'`; thân tàu chỉ render trong setup. Snapshot đã có `ownFleet.ships` ở chiến đấu | Sửa hiển thị tàu riêng ở cả setup/combat, không cần mở thêm dữ liệu đối thủ |
| Xếp tàu | Chọn tàu rồi chạm ô neo; chưa có kéo thả | Kéo trực tiếp thân tàu là thao tác chính; giữ đường bàn phím/thao tác thay thế |
| Nhắm | Đã có `.is-aimed`, crosshair và `aria-selected` theo aim server | Cải thiện độ rõ và phân biệt preview/pending/ACK; không bắn khi ACK chưa đến |
| `src/styles/bantau.css` | Các đoạn tàu rời, hit bằng chấm; cùng lớp `.bantau-impact-mark` vừa rơi vừa nổ; lưới `overflow:hidden` | Render tàu liền; tách lớp bay, impact, cháy; tránh cắt hiệu ứng bởi ô/lưới |
| Bố cục | Desktop biển đối thủ lớn, mình nhỏ; dưới 900 px xếp dọc; chưa có viền ngữ nghĩa xanh/đỏ theo lượt | Hai biển đồng thời, giữ vị trí ổn định, có trạng thái lượt rõ |
| `src/audio/soundEffects.ts`, `src/App.tsx` | Có `water`, `impact`, `ship-sunk` bằng Web Audio; sound phát ngay khi nhận event | Tách cue rơi/va chạm/chìm, đồng bộ cue với timeline trình bày thay vì phát nổ khi bom còn ở trên |
| Snapshot/event | `ownFleet.hitCells`, `targetBoard`, event `sunkCells`, `shotId`, `serverTime`, `presentationExpiresAt` đã có | Tận dụng dữ liệu sẵn; làm rõ khả năng dựng lại hình tàu địch đã chìm sau reload |

Đây là khảo sát tĩnh; không khẳng định đã tái hiện bằng browser trong lượt lập kế hoạch.

## 3. Asset tàu: liền khối, đẹp nhưng rõ ô

### Hướng mỹ thuật đề xuất

- Tàu nhìn từ trên xuống, vector 2.5D nhẹ: mũi/đuôi rõ, boong, tháp pháo hoặc khoang lái, bóng cạnh ngắn. Không photorealistic, logo hoặc artwork sao chép.
- Thân kim loại xanh xám, boong sáng vừa đủ trên biển tối; vài chi tiết đỏ Hội Quậy. Không tô thân tàu bằng màu lượt vì màu lượt thuộc viền panel.
- Tự tạo **5 hình tàu**: tuần tra 2 ô, khu trục 3 ô, tàu ngầm 3 ô, thiết giáp 4 ô, hàng không mẫu hạm 5 ô. Hai tàu 3 ô khác hình nhưng giữ shipId hiện tại; asset là lựa chọn hiển thị theo slot/preset, không tạo luật hoặc ID mới.
- SVG liền khối làm nguồn gốc cho thân tàu; một hướng gốc, xoay 90° cho hướng còn lại. Cùng tỉ lệ bề ngang, đầu/đuôi và padding trong từng ô. Không kéo giãn cùng một hình 2 ô thành tàu 5 ô.
- Kiểu cháy: giữ thân gốc dưới overlay hư hại/lửa từng ô. Chìm: thân sẫm/cháy, biểu tượng chìm; vẫn đọc được các ô trúng.

### Đầu ra asset dự kiến

| Nhóm | Nội dung | Yêu cầu |
|---|---|---|
| Tàu | 5 SVG chiều dài 2/3/3/4/5 | Nền trong suốt, viewBox nhất quán, tự vẽ, scale rõ ở fit/zoom |
| Thủy lôi | Hình bom/thủy lôi + vệt rơi 4–6 frame | Hình quả rơi phải nhìn thấy, không dùng một đốm sáng thay thế |
| Trượt | Splash 8–12 frame | Có cột nước và vòng gợn; kết thúc trả ô về unknown |
| Trúng | Nổ lửa 10–12 frame | Tâm nổ đúng ô, có flash ngắn và mảnh lửa |
| Cháy | Loop lửa/khói 6–8 frame | Nền trong suốt, giới hạn trong vùng ô trúng, không che cả tàu |
| Chìm | Burst/khói tận dụng atlas + thân cháy | Không cần thêm atlas lớn nếu dùng lại được |

Triển khai dùng sprite sheet SVG trong suốt do dự án tự vẽ, có manifest `frameWidth`/`frameHeight`/`frameCount`/`fps`; tàu là các SVG riêng để giữ nét khi zoom. Không dùng artwork ngoài hoặc công cụ AI. Asset runtime nằm trong `public/assets/bantau/`; chưa có pipeline xuất atlas tự động.

Asset được đặt tại `public/assets/bantau/ships/` và `public/assets/bantau/fx/`. Tổng kích thước file SVG dưới 14 KB trước nén. Không có fallback riêng khi file asset tải lỗi; cần kiểm tra phần này nếu QA phát hiện lỗi tải asset.

## 4. Kéo thả tàu — thao tác chính

1. Nắm trực tiếp bất kỳ đoạn nào trên thân tàu, kéo tới vị trí mới. Giữ offset ô đang nắm so với neo để tàu không nhảy mũi vào ngón tay.
2. Khi kéo, hiện ghost bán trong suốt và footprint bám lưới. Không xóa fleet server đã lưu khi pointer đang di chuyển.
3. Thả: gửi **một** intent `moveShip` bằng API hiện có, kèm gameId/setupId/expectedFleetRevision. Không phát socket theo từng pointermove.
4. Trong ACK: ghost ghi đang xác nhận; không nhận lần kéo/xoay/khóa thứ hai đua với lần đang gửi. ACK thành công mới dùng vị trí server; bị từ chối thì ghost trở về vị trí đã xác nhận và hiện lý do ngắn.
5. Thả ra ngoài, `pointercancel`, Esc, mất mạng, hết setup hoặc server khóa: hủy drag an toàn. ACK muộn của setup/game cũ không dựng lại ghost/tàu cũ.
6. Nút Xoay giữ lại cạnh bàn; desktop có phím R khi tàu được chọn. Không dùng một chạm vào thân để tự xoay vì dễ nhầm với thao tác kéo trên điện thoại.
7. Không bắt người dùng đi qua chuỗi chọn tàu→chọn ô cho thao tác thông thường. Giữ chế độ bàn phím/tap-to-move như lựa chọn trợ năng, không làm luồng mặc định rườm rà.

Dùng Pointer Events chung chuột/cảm ứng/bút, pointer capture và ngưỡng bắt đầu drag khoảng 6–8 CSS px để phân biệt tap/drag. Scope `touch-action` ở vùng kéo cần thiết; vùng ngoài tàu vẫn cuộn trang bình thường. Có hint nhỏ tọa độ/ghost lệch lên trên ngón tay. Tọa độ tính từ bounding box thực, scroll và zoom; không chia theo kích thước CSS giả định.

Frontend chỉ tính vị trí preview/snapping, không quyết định placement hợp lệ. Có thể báo ra ngoài biên về mặt trình bày, nhưng màu xanh “hợp lệ” chỉ sau ACK; chồng/chạm/khóa/timer đều do server xác nhận. Không đưa luật placement/engine vào bundle UI để tô xanh chắc chắn trước ACK.

## 5. Bố cục hai biển và lượt — cần chốt phương án mobile

### Desktop/tablet rộng

- Hai panel cạnh nhau, **hạm đội mình bên trái, biển đối thủ bên phải**, không hoán đổi DOM/vị trí theo lượt.
- Biển địch luôn là vùng chính, hạm đội mình là vùng xem nhỏ: phân bổ dự kiến **địch khoảng 65%, mình khoảng 35%**. Tỉ lệ cụ thể co giãn theo viewport nhưng địch luôn lớn hơn và ưu tiên kích thước ô dễ bấm.
- Tới lượt mình: panel tên/avatar mình viền xanh mint kèm nhãn “Lượt bạn”; biển địch mở thao tác nhắm/bắn, có crosshair rõ.
- Tới lượt địch: panel địch viền đỏ kèm “Lượt đối thủ”; biển địch khóa thao tác bắn của mình. Hạm đội mình vẫn hiện thân tàu và cháy tại ô bị trúng, tuyệt đối không hiện ô đối thủ đang aim.
- **Giữ cố định kích thước, vị trí và thứ tự hai bàn suốt pha chiến đấu.** Đổi lượt chỉ cập nhật viền/nhãn/quyền thao tác; không resize, hoán đổi bàn hoặc tự cuộn. Hạm đội mình không phải vùng nhập nước bắn.
- Setup vẫn ưu tiên một bàn mình và khay tàu; không dành nửa màn hình cho biển địch chưa dùng được.

### Mobile 360/390 px — đề xuất khác tỉ lệ desktop

Không ép hai bảng 12×12 cạnh nhau: mỗi ô sẽ quá nhỏ để bấm chính xác. Đề xuất **hai biển cùng hiện, một bảng chính + một bảng mini phía dưới hoặc cùng hàng status**, không ẩn sau tab và không phủ bảng chính:

- Lượt mình: biển địch là bảng chính để bắn; hạm đội mình thu nhỏ luôn hiện và có viền xanh/nhãn lượt ở panel mình.
- Lượt địch: biển địch vẫn lớn và các vùng giữ nguyên vị trí; panel địch có viền đỏ, mình thấy cháy trên mini. Hạm đội mình chỉ để xem; không yêu cầu chạm hoặc đổi chế độ để theo dõi.
- Trường hợp muốn cả hai bảng luôn cạnh nhau trên mobile: phải chấp nhận zoom trước khi bắn hoặc kích thước ô rất nhỏ. **Không khuyến nghị** cho bản này.
- Bàn có fit/zoom/pan riêng; không tràn ngang toàn trang. Tối thiểu khoảng 24 CSS px/ô ở fit khi có thể; bàn 12 ô trên màn hẹp cần zoom rõ ràng. Nhóm điều khiển chính >=44 px; safe area không che lưới.

Màu xanh/đỏ biểu thị người đang hành động, không thay kết quả hit/miss và không dựa vào màu đơn thuần. Resolving giữ viền theo người vừa bắn tới khi server mở lượt tiếp; pause/finished dùng trạng thái trung tính và nhãn rõ.

## 6. Dấu chọn ô / focus

- Hover desktop: sáng nhẹ ô; chưa tạo aim.
- Lần đầu kích hoạt: preview crosshair ngay, trạng thái chờ ACK có nét đứt/độ mờ; aim đã ACK có viền rõ khoảng 2 px và crosshair gọn, nhãn tọa độ ngoài bàn.
- Chỉ một ô được chọn. Chạm ô khác đổi aim; chạm lại cùng ô đã ACK mới bắn. Không yêu cầu double-click nhanh.
- Keyboard focus và aim là hai trạng thái riêng: mũi tên đổi focus không âm thầm đổi aim. `focus-visible` gọn nằm trong ô, không thêm vòng dày quanh cả bàn.
- Mất lượt, game mới, disconnect hoặc server từ chối phải xóa preview đúng lúc; không để viền chọn giả trên ô miss cũ. Đối thủ không thấy crosshair hoặc tọa độ aim riêng.

## 7. Timeline thủy lôi, impact và cháy

**Không dùng animation để quyết định game.** Giữ server resolving hiện tại 900 ms và TTL effect 1200 ms; thiết kế timeline dưới đây phải vừa thời gian đó, chưa đề xuất tăng thời gian chờ.

| Mốc tương đối dự kiến | Hình ảnh | Sound / tác động |
|---|---|---|
| 0–280 ms | Quả thủy lôi rõ hình rơi từ mép trên viewport bàn tới tâm ô | Rít ngắn tăng tốc |
| 280–600 ms, miss | Atlas nước bung rồi vòng sóng tắt | Tõm + splash, không rung cả màn hình |
| 280–650 ms, hit | Flash nhỏ → nổ lửa → đặt lớp cháy đúng ô | Impact trầm + tiếng kim loại; rung bảng bị trúng 2–4 px |
| 280–800 ms, sunk | Burst mạnh hơn, khói, thân tàu đã được phép lộ sẫm lại | Boom sâu, rung bảng 4–6 px; không tăng âm lượng đột biến |
| Sau impact, hit còn trên snapshot | Lửa loop nhỏ theo ô trúng; dấu hư hại tĩnh luôn có | Không loop tiếng cháy cho từng ô |

Mốc là hướng điều chỉnh cảm giác, không cam kết timing vật lý trước khi thử. Không để bomb sprite và explosion cùng rơi từ trên xuống như lớp CSS hiện tại.

- Vẽ ship/effect thành các layer riêng trong một hệ tọa độ: biển/cell → thân tàu → hit/fire → crosshair/focus → projectile/impact. Overlay không ăn pointer events và `aria-hidden`.
- Đường rơi nằm trên overlay của viewport bàn, không bị `overflow:hidden` của từng cell cắt. Zoom/pan vẫn phải map đúng tâm ô, scale sprite theo cell; không bay từ tọa độ cũ khi đổi size.
- Event đã đến trễ: tính progress theo server timestamp tương ứng, bỏ phần quá hạn; không phát lại trọn quả rơi/nổ sau reconnect. Không giữ hàng đợi vô hạn.
- Nếu snapshot hit đến trước impact: dùng lớp trình bày để tránh lửa xuất hiện trước bom; không sửa snapshot và không chờ animation xong mới mở lượt. Event mất vẫn render hit tĩnh từ snapshot.
- Miss: hết effect thì dọn lớp, label, tọa độ tạm; unknown trong DOM/ARIA như ô chưa bắn. Không lưu lịch sử miss hoặc dùng nó để gợi ý.
- Rời trang/đổi ván/hủy effect: dọn rAF/timer/listener/audio voice. Tab ẩn không chạy loop; trở lại chỉ hiện tình trạng hiện tại, không phát lại tiếng nổ cũ.

## 8. Tàu mình, ô trúng và tàu địch chìm

- Tàu mình luôn hiển thị đúng vị trí ngang/dọc trên `ownFleet.ships`, kể cả combat. Mỗi ô thuộc `ownFleet.hitCells` được gắn cháy độc lập: trúng mũi chỉ cháy mũi, chưa làm cháy toàn thân.
- Trúng bên địch: chỉ hiện điểm trúng/lửa trong ô. Không vẽ trước thân, chiều dài, hướng hay tháp tàu chưa chìm.
- Chìm bên địch: event `sunkCells` cho phép vẽ hình tàu vừa chìm; không dựng các tàu khác. `targetBoard` hiện chỉ phân biệt unknown/hit/sunk, không giữ nhóm từng tàu chìm để reload chính xác khi tàu chạm nhau.
- Server projection thêm `revealedSunkShips` chỉ gồm `displayId` chung, `length` và `cells` của tàu đã chìm. Không đưa ID nội bộ hay raw fleet địch ra client. Runtime schema và privacy test chứng minh chỉ footprint đã chìm được gửi.
- Nếu không bổ sung projection, sau reload chỉ có thể hiện dấu sunk từng ô, không hứa phục dựng hình từng tàu từ cụm ô kề nhau. Không dùng flood-fill để suy ra nhóm vì cấu hình được phép chạm tàu.
- Giới hạn loop lửa khoảng 8 ô đang thấy trên mobile, ưu tiên ô vừa trúng; các ô trúng khác có frame cháy tĩnh. Desktop có thể nâng sau đo; tất cả ô vẫn thể hiện hư hại. Reduced motion: chỉ frame tĩnh, không rung, không đường rơi, không flash nhấp nháy.

## 9. Âm thanh sống động nhưng có kiểm soát

| Hành động | Cue đề xuất |
|---|---|
| Cầm/đặt tàu | Click kim loại nhỏ, đặt xong có tiếng chốt |
| Xoay / khóa đội hình | Cạch ngắn / khóa chắc |
| Aim ACK | Tick/sonar ngắn, không loop sonar nền |
| Thủy lôi rơi | Whoosh 180–280 ms |
| Miss | Tõm + nước vỡ |
| Hit | Impact + kim loại + crackle ngắn |
| Sunk | Impact sâu hơn + âm chìm kết thúc |
| Tới lượt / gần hết giờ | Cue ngắn; cảnh báo 3 giây cuối một lần mỗi turnId |

Ưu tiên cue riêng `bantau-*` trên bus/master gain hiện có; không chỉnh tiếng UNO/Nối từ/Caro. Có thể tự tổng hợp Web Audio nhiều lớp để chủ động nguồn, hoặc dùng sample tự tạo có manifest nguồn; không lấy âm thanh thiếu giấy phép. Không thêm thư viện âm thanh lớn hoặc nhạc nền.

Phát tiếng nổ tại mốc impact trong cùng timeline hình ảnh; không đồng thời phát `playSound` cũ trong `App.tsx`. Dedup theo gameId/shotId/cue; snapshot lặp/resume không phát lại. Giới hạn số voice, envelope tránh clipping, ưu tiên tiếng shot hơn click. Thử bằng tai nghe và loa điện thoại; chưa cố định tăng master volume toàn dự án.

Sound mặc định bật theo tùy chọn hiện có, tôn trọng mute/volume đã lưu. AudioContext chỉ unlock/resume sau tương tác được trình duyệt cho phép; nếu bị chặn thì game vẫn hoạt động và có cách bật tiếng. Không hứa phát sound trước gesture trên iPhone.

## 10. Trình tự triển khai và kết quả

| Chặng | Công việc | Điều kiện sang chặng tiếp |
|---|---|---|
| 0 — Chốt thiết kế | Hoàn tất: cập nhật UI/contract/privacy projection, khảo sát working tree và ghi baseline thật | Không đổi luật; test baseline ban đầu bị giới hạn loopback trong sandbox |
| 1 — Tàu và layer | Hoàn tất: asset tàu 2/3/3/4/5; hiển thị hạm đội mình; schema/projection tàu chìm | Unit/schema tests xác nhận chỉ footprint tàu đã chìm được công bố |
| 2 — Kéo thả | Hoàn tất trong source: pointer capture/snapping/ghost, một intent lúc thả, chờ ACK, cancel và đường tap/keyboard | Chưa kéo trực tiếp bằng browser/điện thoại trong lượt QA này; xem checklist Terra |
| 3 — Hai bàn và aim | Hoàn tất: bàn địch lớn và bàn mình nhỏ; thứ tự ổn định, chỉ đổi viền/nhãn theo lượt; preview/pending/ACK của aim | Hai session browser xác nhận bố cục và đổi lượt; chưa thử mobile viewport thực |
| 4 — Sprite và sound | Hoàn tất: SVG sprite thủy lôi/nước/nổ/cháy, fire theo ô, rung bảng cục bộ, cue hit/miss/sunk theo mốc 280 ms | Chưa đo độ trễ âm thanh giữa các thiết bị hoặc kiểm thử nghe trên iOS; không có fallback riêng khi asset tải lỗi |
| 5 — Kiểm chứng/bàn giao | Hoàn tất kiểm thử code, typecheck/build và luồng hai session tới phát bắn; báo cáo/ch checklist Terra đã ghi | Chưa hoàn thành ván thắng trên browser; chờ Terra duyệt, không đánh dấu nghiệm thu |

Không chạy một lượt thay mọi thứ rồi mới kiểm tra. Chặng 1 kiểm tra data/layer trước, chặng 2 ổn tọa độ mới làm sprite; tránh chữa hiệu ứng trên nền bố cục sai.

## 11. Bản đồ file dự kiến

- `src/bantau/BantauTable.tsx`: tách vừa đủ board/ship/placement/effect để dọn lifecycle; không tạo game framework dùng chung.
- Component/helper riêng dưới `src/bantau/` khi cần: board geometry, ship layer, drag controller, shot timeline; tên cuối theo implementation.
- `src/styles/bantau.css`: cell sizing, token nước/viền lượt, layer, focus, drag, responsive/reduced motion; không sửa global `.button` hoặc layout game khác.
- `src/audio/soundEffects.ts`: cue Bắn tàu, voice budget; `src/App.tsx`: subscription/dedup và gỡ phát sound cũ bị trùng.
- `public/assets/bantau/`, `assets/bantau/`: asset runtime, source gốc, metadata/quyền nguồn; không đưa raster lớn vào bundle JS.
- Nếu duyệt revealed-sunk projection: `packages/bantau/src/index.ts`, shared schema Bắn tàu, test engine/room/realtime liên quan; `src/api/` chỉ sửa nếu contract yêu cầu.
- Docs trong cùng `docs/reports/bantau/`: tiếp tục báo cáo code/QA sau khi được triển khai; giữ hồ sơ đang mở. Chưa gom/xóa tài liệu cũ.

## 12. Checklist nghiệm thu

- Asset: đủ 5 hình tàu, xoay đúng, không cắt thân, hit nằm đúng segment; tàu 3 ô không trùng danh tính.
- Setup: kéo giữa thân vẫn giữ đúng offset; thả biên/chồng/chạm sai bị server từ chối; cancel/mất mạng/hết 90 giây/ACK muộn an toàn; khóa không còn kéo được.
- Aim: A→B→B; aim pending không bắn; kéo/pan không thành shot; keyboard focus độc lập aim; hai session không nhìn aim nhau.
- Combat: ownFleet luôn thấy; hit cháy đúng ô; miss sạch sau hiệu ứng; sunk chỉ lộ tàu được phép, reload không lộ tàu khác; allowTouch bật không nhập nhầm hai thân.
- Event: manual/timeout, hit-continue bật/tắt, shot cuối thắng, countdown/new setup, event trễ/trùng/mất, reload/resume giữa rơi/nổ, tab ẩn.
- Browser desktop 1440, tablet 768 và mobile 390/360; bàn 8/10/12, preset 3/4/5; ít nhất hai session/localStorage độc lập. Điện thoại thật nếu có mới ghi đã thử.
- Hiệu năng: sprite tải lỗi có fallback; fire loop giới hạn, không DOM/rAF/timer/audio leak; đo network và dropped frames trên máy thử, không tự tuyên bố 60 fps.
- Mute/volume, gesture audio iOS, reduced motion, bàn phím, ARIA không tiết lộ miss/ship ẩn; test hồi quy game cũ và HTTP LAN.
- Chạy `npm run typecheck`, `npm test`, `npm run build`; ghi kết quả mới và giới hạn loopback nếu có. Terra nghiệm thu độc lập vẫn để mở.

## 13. Quyết định đã chốt và kết quả

1. Mỹ thuật: tàu vector 2.5D xanh xám/chi tiết đỏ và sprite SVG tự vẽ, kế thừa Hội Quậy.
2. Biển địch luôn lớn, hạm đội mình nhỏ chỉ để xem; đổi lượt không đổi kích thước/vị trí. Desktop mình trái khoảng 35%, địch phải khoảng 65%; chỉ đổi viền xanh/đỏ và nhãn lượt.
3. Mobile giữ cả hai biển: biển địch là vùng chính, hạm đội mình là mini chỉ xem. Thứ tự target trước, own sau ổn định.
4. Kéo thả là chính; giữ Xoay và đường bàn phím/tap-to-move trợ năng.
5. Cháy từng ô; projection chỉ công bố nguyên hình tàu địch đã chìm.
6. Sound nhiều lớp riêng Bắn tàu, giữ master mute/volume và không nhạc nền.

Không có thay đổi luật đang chờ duyệt. Chờ Terra kiểm tra phần kéo thả trực tiếp, mobile, nghe âm thanh và hoàn tất một ván.

## 14. Nguồn kỹ thuật và skill đã tra

- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events): pointer capture, pointercancel và touch-action cho thao tác chuột/cảm ứng. Dùng để thiết kế kéo thả, không phải bằng chứng game đã được test.
- [MDN animation-timing-function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timing-function): `steps()` phù hợp chuyển frame sprite; số frame/duration cần thử trên asset thực.
- [MDN Autoplay/Web Audio](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay): giới hạn phát âm thanh tự động và mở audio qua tương tác.
- UI Pro Max: đã tra `dragging touch alternative` và `reduced motion animation`, áp dụng nguyên tắc có thao tác thay thế, touch target và giảm chuyển động. Không sinh palette mới.
- Lucian UX/UI: search `drag` trả catalog cache EN 12/11/2026 và KO 07/11 do mạng CLI không khả dụng; các kết quả file upload/flip card/slider không phù hợp kéo tàu trong grid. Chưa chọn, chưa `get` hoặc port phần tử nào; không tự bịa ID. Khi triển khai thành phần mới phải tra lại catalog theo AGENTS.
