# Tách frontend/backend — tổng kết

Cập nhật 14/11/2026. Hợp nhất kế hoạch, prompt và báo cáo triển khai ngày 15/11/2026; các kết quả dưới đây là bằng chứng từ đợt 14/11, không phải kiểm thử mới khi gom tài liệu. Không đổi luật BB-UNO-1/NT-VI-1, giao thức phòng, HTTP LAN, session/revision hoặc motion. **Chưa deploy thật lên Vercel/hosting và chưa có nghiệm thu Terra.**

## Chặng 1 — Audit và baseline

### Phân luồng hiện trạng

| Tác vụ | Giao tiếp hiện tại | Nguồn quyết định / dữ liệu hiển thị |
|---|---|---|
| Tạo/tham gia/nối lại phòng | Socket.IO ACK | Backend cấp mã, ghế, token, snapshot; client lưu token phiên của mình |
| Ready, đổi visibility, start, kick, leave, rematch | Socket.IO ACK + snapshot | Backend kiểm tra host, phase, revision và điều kiện phòng |
| UNO | `game:action` | Engine server kiểm tra luật; `allowedActions` trong projection quyết định khả năng thao tác trên UI |
| Nối từ submit/vote/give-up | `noitu:action` | Engine server kiểm tra từ điển, lượt, vote, timeout, kết quả; UI đọc `canSubmit/canVote/canGiveUp` |
| Draft Nối từ | `noitu:draft` và sự kiện draft | Server kiểm tra phiên, game/lượt/sequence/deadline và chỉ phát draft trong phòng |
| Motion UNO | `game:effect` sau snapshot | Server phát event sau nước hợp lệ; client chỉ lọc/dedupe và trình bày |
| Danh sách trò/phòng công khai | HTTP GET `/api/games`, `/api/rooms` | Backend lọc availability và chỉ trả phòng public đang chờ |

Không tìm thấy engine hoặc bộ từ điển được gọi runtime từ các component. Vấn đề chính là `src/App.tsx` vừa điều phối giao diện/phiên vừa gọi `fetch`/`io`/`emit`; HTTP chỉ same-origin; API HTTP chưa áp CORS như Socket.IO. Một số quyền UNO đang được UI suy ra từ state công khai dù projection đã có `canDeclareUno` và `catchUnoPlayerId`; sẽ chuyển các affordance đó sang capability server, giữ phần phase/current player dùng để trình bày.

## Ranh giới cuối

```text
React pages/components
  → src/api/client.ts
      → src/api/http.ts       → GET /api/games, GET /api/rooms
      → src/api/realtime.ts   → Socket.IO intent/events
  → Node server
      → RoomService/session → UNO/Noitu engines + dictionary
      → per-player RoomSnapshot, lifecycle/draft/effect events
```

Component không gọi `fetch`, `io` hoặc `socket.emit`; `src/App.tsx` điều phối snapshot/session và UI, API client sở hữu transport, action UUID, ACK timeout và event subscription. Snapshot vẫn đi qua revision/room epoch gate; request game/room vẫn có chung busy lock và `finally` unlock. Cleanup unsubscribe/disconnect khi App unmount. Token nối lại vẫn do server cấp, localStorage chỉ giữ phiên người dùng hiện hành.

| Dữ liệu/hành động | API | Nguồn sự thật / bảo vệ |
|---|---|---|
| Availability/danh sách phòng public | HTTP GET `/api/games`, `/api/rooms` | Server trả projection; client kiểm tra response schema trước render |
| Tạo/join/resume/ready/visibility/start/kick/leave/rematch | Socket.IO typed wrapper + ACK | Zod payload, session/socket generation, host, phase, expectedRevision, idempotency do server kiểm tra |
| UNO play/draw/keep/color/penalty/UNO | Socket.IO `game:action` | `allowedActions` chỉ điều khiển affordance; engine server quyết định và xác thực lại |
| Nối từ submit/vote/give-up/draft | Socket.IO `noitu:action` / `noitu:draft` | Engine/server quyết định từ điển, lượt, vote, deadline và winner; UI đọc `canSubmit/canVote/canGiveUp` |
| Motion UNO | Socket.IO `game:effect` | Chỉ snapshot/event server xác nhận mới kích hoạt; client lọc revision, dedupe và phát animation |

UNO UI dùng capabilities của server cho `canDraw`, `canKeep`, `canAcceptPenalty`, `canDeclareUno`, `catchUnoPlayerId`, `canChooseColor` và `playableCardIds`. Phase/current player còn dùng để mô tả trạng thái bàn. Noitu UI tiếp tục dùng capabilities server và giữ input/IME, draft tạm, đồng hồ hiển thị, timeline, active row/motion cục bộ. Bàn demo vẫn tách khỏi session online và ghi rõ xem thử.

### Cấu hình hai origin

- `src/api/config.ts` chuẩn hóa `VITE_BACKEND_URL` thành HTTP(S) origin; chấp nhận dấu `/` cuối, từ chối path/query/hash/credentials/protocol khác và từ chối HTTP backend khi trang đang HTTPS. Giá trị trống giữ same-origin cho dev/LAN và single-process production.
- `src/api/http.ts` và `src/api/realtime.ts` dùng chung origin; HTTP gọi trực tiếp `/api`, Socket.IO giữ `/socket.io`. Client không phụ thuộc rewrite Vercel.
- `ALLOWED_ORIGINS` được dùng chung bởi HTTP API và Socket.IO. HTTP trả `Vary: Origin`, chỉ phản chiếu origin được phép, hỗ trợ `GET, OPTIONS` cho API đọc, không bật credentials; origin ngoài allowlist bị 403. Session/token validation của Socket.IO vẫn hoạt động độc lập với CORS.
- `vercel.json` chỉ cấu hình static build: `npm ci`, `npm run build:client`, output `dist`; không rewrite API/Socket.IO vào SPA.

### Hướng dẫn vận hành cuối

Frontend Vercel: root repo, Production `VITE_BACKEND_URL=https://<domain-backend>`, rebuild khi URL đổi. Không đặt token/secret trong biến `VITE_*`; Preview chỉ được gọi backend nếu chủ động thêm origin của preview vào allowlist.

Backend: Node service chạy từ root repo để có npm workspaces và `data/word-chain/`; `npm ci`, `npm start`, `HOST=0.0.0.0`, `PORT` do host cấp, `ALLOWED_ORIGINS=https://<domain-frontend>` và custom domain chính thức nếu có. Host cần HTTPS/WSS, WebSocket upgrade và một process liên tục. `/health` dành cho health check. State phòng vẫn ở RAM; restart/deploy làm mất phiên/phòng; không thêm database, Redis hoặc nhiều replica.

### File chính

- `src/api/config.ts`, `http.ts`, `realtime.ts`, `client.ts`: config và client typed.
- `src/App.tsx`, `src/noitu/NoituTable.tsx`: dùng client/capabilities server; không tự sở hữu luật.
- `server/src/index.ts`: cùng allowlist cho HTTP CORS/OPTIONS và Socket.IO.
- `server/src/http-api.test.ts`, `src/api/config.test.ts`: kiểm thử origin/API config và flow hai origin.
- `package.json`, `vercel.json`, `.env.example`, `README.md`, `docs/architecture.md`, `docs/operations.md`: build/deploy.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả mới nhất |
|---|---|
| Baseline trước sửa: `npm run typecheck` | Đạt |
| Baseline trước sửa: `npm run build` | Đạt; 164 modules; có hai cảnh báo annotation Zod/Rollup |
| Baseline `npm test` không quyền loopback | 108 đạt; 4 integration test bị `listen EPERM`; đã chạy lại đầy đủ với loopback |
| `npm run typecheck` sau sửa | Đạt client và server |
| `npm test` sau sửa | **124/124 test, 13 file**, gồm CORS allow/deny/preflight, hai socket có Origin frontend, create/join/ready/start và nước UNO/Nối từ qua hai origin |
| `npm run build` | Đạt; 168 modules; hai cảnh báo annotation Zod/Rollup không làm build thất bại |
| `npm run build:client` | Đạt; 168 modules; script Vercel đã chạy |
| Bundle scan | Không thấy runtime identifier của engine/server hoặc đường dẫn dictionary. Các phụ thuộc engine còn lại trong UI/shared là `import type`, bị xóa khỏi JavaScript build |
| `node scripts/test-noitu-dom.mjs` | Đạt 1440, 390, 360 px và 390 px reduced motion; giữ một active row/identity/motion |
| Production smoke (`PORT=3183 npm start`) | Đạt `/health`, `/api/games`, `/api/rooms` và static `/`; server dùng dictionary và báo hai game available. Cổng mặc định 3001 đang được tiến trình khác dùng nên không tác động tiến trình đó |
| `git diff --check` | Đạt |

Test cần bind loopback trong môi trường này; lần không escalation thất bại vì sandbox, còn lần chạy cho phép loopback đạt đầy đủ. Production smoke chạy cục bộ và đã dừng server tạm. Cổng 3001 hiện không thuộc lượt smoke này.

## Chưa kiểm chứng / checklist Terra

- Chưa deploy Vercel hoặc backend công khai; chưa có domain thật để kiểm tra HTTPS/WSS, provider proxy hoặc deploy preview. Integration hai origin dùng hai Socket.IO client độc lập mang `Origin` frontend đã khai báo, không phải hai browser/device thật.
- Chưa dùng trình duyệt/điện thoại thật để kiểm tra đăng nhập phòng, animation sau refactor, IME, CORS preflight trên Safari/Chrome. DOM harness là Chrome headless với fixture.
- Terra kiểm tra: Vercel domain → backend Node domain; console/network không có CORS/mixed-content; tạo/join public/private, ready/start/kick; UNO play/draw/color/penalty/UNO/win/rematch; Nối từ draft/known/unknown vote/reject/timeout/rematch; reload/reconnect và server-origin error. Thử HTTPS/WSS thật, mobile/desktop, reduced motion.
- Giữ nguyên giới hạn sản phẩm: backend một process/RAM, restart mất phòng; dataset Nối từ còn giới hạn semantic review/giấy phép như trong [summary Nối từ](../noitu/summary.md).


## Quyết định cần giữ khi sửa tiếp

Frontend chỉ gọi typed HTTP/Socket.IO API và hiển thị snapshot/capabilities; backend giữ luật, thời gian, quyền và kết quả. Không đưa engine runtime/dataset vào bundle; import type được phép. Giữ shared busy lock, ACK timeout/finally, epoch/revision, cleanup và UUID fallback HTTP LAN. Không thêm REST mutation song song, DB/Redis hoặc nhiều replica. Cấu hình chạy thực tế tiếp tục theo README/operations; không chạy lại prompt tách backend cũ.

Các cập nhật UI sau đợt này đã bỏ lối vào demo, cho bấm phòng công khai để join trực tiếp và thêm avatar chủ phòng trong danh sách; xem [giao diện phòng](../lobby-ux/summary.md). Không coi mô tả baseline ở trên là đặc tả UI mới nhất.
