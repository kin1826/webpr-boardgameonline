import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { gameEffectSchema, roomClosedSchema, type GameEffectEvent, type PublicRoomSummary, type RoomSnapshot, type RoomVisibility, type SessionCredentials } from '@banban/shared';
import type { UnoCard, projectGame } from '@banban/uno';
import CopyInviteCard from './components/CopyInviteCard';
import InlineNicknameEdit from './components/InlineNicknameEdit';
import { createActionId } from './action-id';
import { flightTransform, penaltyImpact, shouldPlayGameEffect, type FlightRect } from './game-effects';

type Page = 'home' | 'uno' | 'lobby' | 'table' | 'preview';
type DemoState = 'your-turn' | 'waiting' | 'drawn' | 'choose-color' | 'uno-window' | 'catch-uno' | 'wild-four' | 'disconnected' | 'finished';
type UnoColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';
type CardInfo = { id: string; face: string; color: UnoColor; label: string; playable: boolean };

const demoCards: CardInfo[] = [
  { id: 'red-4', face: '4', color: 'red', label: 'Đỏ 4', playable: false },
  { id: 'blue-skip', face: '⊘', color: 'blue', label: 'Xanh dương · Bỏ lượt', playable: true },
  { id: 'yellow-7', face: '7', color: 'yellow', label: 'Vàng 7', playable: true },
  { id: 'green-2', face: '2', color: 'green', label: 'Xanh lá 2', playable: false },
  { id: 'wild', face: '✦', color: 'wild', label: 'Đổi màu', playable: true },
  { id: 'red-8', face: '8', color: 'red', label: 'Đỏ 8', playable: false },
  { id: 'yellow-reverse', face: '↶', color: 'yellow', label: 'Vàng · Đảo chiều', playable: true },
];

const demoNames = ['Khoa', 'Linh', 'Tú', 'An', 'Bảo'];

function Icon({ name, size = 20 }: { name: 'arrow' | 'back' | 'check' | 'copy' | 'info' | 'spark' | 'plus' | 'close' | 'rules' | 'link' | 'chevron' | 'volume'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    arrow: <><path d="M4 12h15"/><path d="m13 5 7 7-7 7"/></>,
    back: <><path d="m15 18-6-6 6-6"/><path d="M20 12H9"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    spark: <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    rules: <><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h5M10 13h6M10 17h6"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 1 0 12 20.1l1.1-1.1"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    volume: <><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Brand() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

function DemoTag({ children = 'BẢN XEM THỬ' }: { children?: string }) {
  return <span className="demo-tag"><span />{children}</span>;
}

function CardArt({ face, color, tilt = '' }: { face: string; color: UnoColor; tilt?: string }) {
  return <div className={`card-art card-${color} ${tilt}`} aria-hidden="true"><span className="card-corner">{face}</span><span className="card-oval"><b>{face}</b></span><span className="card-corner card-corner-bottom">{face}</span></div>;
}

function HeroCard({ face, color, className }: { face: string; color: 'red' | 'blue' | 'yellow'; className: string }) {
  const mark = color === 'red' ? '05' : color === 'blue' ? '↻' : '07';
  return <span className={`hero-card hero-card-${color} ${className}`} aria-hidden="true"><i>{face}</i><b>{face}</b><small>{mark}</small></span>;
}

function App() {
  const [page, setPage] = useState<Page>('home');
  const [nickname, setNickname] = useState(() => localStorage.getItem('banban-nickname') || 'Mây');
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState(new URLSearchParams(window.location.search).get('room') || '');
  const [roomSnapshot, setRoomSnapshot] = useState<RoomSnapshot | null>(null);
  const roomSnapshotRef = useRef<RoomSnapshot | null>(roomSnapshot);
  const [gameEffect, setGameEffect] = useState<GameEffectEvent | null>(null);
  const seenEffectsRef = useRef(new Set<string>());
  const commitSnapshot = (snapshot: RoomSnapshot | null) => {
    const current = roomSnapshotRef.current;
    if (snapshot && current?.roomId === snapshot.roomId && snapshot.revision < current.revision) return;
    roomSnapshotRef.current = snapshot; setRoomSnapshot(snapshot);
  };
  const [session, setSession] = useState<SessionCredentials | null>(() => {
    try { const value = localStorage.getItem('banban-session'); return value ? JSON.parse(value) as SessionCredentials : null; }
    catch { return null; }
  });
  const sessionRef = useRef<SessionCredentials | null>(session);
  const socketRef = useRef<Socket | null>(null);
  const requestLockRef = useRef(false);
  const roomEpochRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [demoState, setDemoState] = useState<DemoState>('your-turn');
  const [playerCount, setPlayerCount] = useState(4);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const nicknameTriggerRef = useRef<HTMLButtonElement>(null);
  const rulesTriggerRef = useRef<HTMLElement | null>(null);
  const rulesDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('banban-nickname', nickname);
  }, [nickname]);

  useEffect(() => {
    sessionRef.current = session;
    if (session) localStorage.setItem('banban-session', JSON.stringify(session));
    else localStorage.removeItem('banban-session');
  }, [session]);

  useEffect(() => {
    const socket = io({ path: '/socket.io', reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 4000, timeout: 8000 });
    socketRef.current = socket;
    const clearRoom = (message: string) => {
      roomEpochRef.current++;
      sessionRef.current = null; setSession(null); localStorage.removeItem('banban-session');
      commitSnapshot(null); setGameEffect(null); seenEffectsRef.current.clear(); setPage('home'); setBusy(false); requestLockRef.current = false;
      setNicknameOpen(false); setRulesOpen(false); setSelectedCard(null); setToast(message);
    };
    socket.on('room:closed', (raw: unknown) => {
      const parsed = roomClosedSchema.safeParse(raw);
      if (parsed.success && parsed.data.roomId === sessionRef.current?.roomId) clearRoom(parsed.data.message);
    });
    socket.on('connect', () => {
      setConnected(true);
      setGameEffect(null);
      const saved = sessionRef.current;
      if (!saved) return;
      const epoch = roomEpochRef.current;
      socket.emit('session:resume', saved, (reply: { ok: boolean; snapshot?: RoomSnapshot; credentials?: SessionCredentials; message?: string }) => {
        if (epoch !== roomEpochRef.current) return;
        if (!reply.ok || !reply.snapshot || !reply.credentials) {
          clearRoom(reply.message || 'Phòng đã hết hạn. Hãy tạo hoặc tham gia phòng khác.');
          return;
        }
        sessionRef.current = reply.credentials; setSession(reply.credentials); commitSnapshot(reply.snapshot); setGameEffect(null); seenEffectsRef.current.clear();
        setPage(reply.snapshot.phase === 'waiting' ? 'lobby' : 'table');
      });
    });
    socket.on('disconnect', () => { setConnected(false); setGameEffect(null); });
    socket.on('connect_error', () => { setConnected(false); setGameEffect(null); });
    socket.on('room:snapshot', (snapshot: RoomSnapshot) => {
      if (snapshot.roomId !== sessionRef.current?.roomId) return;
      const previous = roomSnapshotRef.current;
      if (previous?.game && (!snapshot.game || (previous.game as ProjectedUnoGame).gameId !== (snapshot.game as ProjectedUnoGame).gameId)) { setGameEffect(null); seenEffectsRef.current.clear(); }
      commitSnapshot(snapshot);
      setPage(snapshot.phase === 'waiting' ? 'lobby' : 'table');
    });
    socket.on('game:effect', (raw: unknown) => {
      const parsed = gameEffectSchema.safeParse(raw); if (!parsed.success) return;
      const event = parsed.data; const current = roomSnapshotRef.current;
      if (!shouldPlayGameEffect(event, current, seenEffectsRef.current)) return;
      seenEffectsRef.current.add(event.eventId); if (seenEffectsRef.current.size > 128) seenEffectsRef.current.delete(seenEffectsRef.current.values().next().value!);
      setGameEffect(event);
    });
    socket.on('session:revoked', (message: { message?: string }) => {
      clearRoom(message?.message || 'Phiên phòng này đã kết thúc.');
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  useEffect(() => {
    if (roomSnapshot?.phase === 'waiting') setPage('lobby');
    if (roomSnapshot && (roomSnapshot.phase === 'playing' || roomSnapshot.phase === 'finished')) setPage('table');
  }, [roomSnapshot]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNicknameOpen(false);
        setRulesOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (rulesOpen) rulesDialogRef.current?.focus();
    else rulesTriggerRef.current?.focus();
  }, [rulesOpen]);

  useEffect(() => {
    if (!nicknameOpen) return;
    document.querySelector<HTMLElement>('.nickname-modal .modal-close')?.focus();
    return () => { requestAnimationFrame(() => nicknameTriggerRef.current?.focus()); };
  }, [nicknameOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const clearVisualEffect = () => { if (document.visibilityState === 'hidden') setGameEffect(null); };
    document.addEventListener('visibilitychange', clearVisualEffect);
    return () => document.removeEventListener('visibilitychange', clearVisualEffect);
  }, []);

  useEffect(() => {
    if (!gameEffect) return;
    const eventId = gameEffect.eventId;
    const timer = window.setTimeout(() => setGameEffect((current) => current?.eventId === eventId ? null : current), 900);
    return () => window.clearTimeout(timer);
  }, [gameEffect]);

  function saveNickname(name: string) {
    setNickname(name);
    setNicknameOpen(false);
  }

  function openRules() {
    rulesTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRulesOpen(true);
  }

  function emitAck<T extends { ok: boolean; code?: string; message?: string; credentials?: SessionCredentials; snapshot?: RoomSnapshot }>(event: string, payload: unknown): Promise<T> {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket?.connected) { resolve({ ok: false, code: 'DISCONNECTED', message: 'Đang kết nối lại. Thử lại sau nhé.' } as T); return; }
      socket.timeout(7000).emit(event, payload, (error: Error | null, response: T) => {
        resolve(error ? ({ ok: false, code: 'TIMEOUT', message: 'Máy chủ chưa phản hồi. Hãy thử lại.' } as T) : response);
      });
    });
  }

  async function createRoom(visibility: RoomVisibility) {
    if (requestLockRef.current) return;
    requestLockRef.current = true; setBusy(true);
    const epoch = roomEpochRef.current;
    try {
      const reply = await emitAck('room:create', { actionId: createActionId(), nickname, visibility });
      if (epoch !== roomEpochRef.current) return;
      if (!reply.ok || !reply.credentials || !reply.snapshot) { setToast(reply.message || 'Chưa tạo được phòng.'); return; }
      sessionRef.current = reply.credentials; setSession(reply.credentials); commitSnapshot(reply.snapshot); setGameEffect(null); seenEffectsRef.current.clear(); setPage('lobby');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Chưa tạo được phòng. Hãy thử lại.');
    } finally { if (epoch === roomEpochRef.current) { requestLockRef.current = false; setBusy(false); } }
  }

  async function joinRoom(codeOverride?: string) {
    if (requestLockRef.current) return;
    const code = roomCodeInput.trim().toUpperCase();
    const roomCodeToJoin = (codeOverride ?? code).trim().toUpperCase();
    if (!roomCodeToJoin) { setToast('Nhập mã phòng để tham gia.'); return; }
    requestLockRef.current = true; setBusy(true);
    const epoch = roomEpochRef.current;
    try {
      const reply = await emitAck('room:join', { actionId: createActionId(), code: roomCodeToJoin, nickname });
      if (epoch !== roomEpochRef.current) return;
      if (!reply.ok || !reply.credentials || !reply.snapshot) { setToast(reply.message || 'Chưa vào được phòng.'); return; }
      setRoomCodeInput(roomCodeToJoin); sessionRef.current = reply.credentials; setSession(reply.credentials); commitSnapshot(reply.snapshot); setGameEffect(null); seenEffectsRef.current.clear(); setPage('lobby');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Chưa vào được phòng. Hãy thử lại.');
    } finally { if (epoch === roomEpochRef.current) { requestLockRef.current = false; setBusy(false); } }
  }

  async function roomCommand(event: string, body: Record<string, unknown> = {}) {
    if (!session || !roomSnapshot) return { ok: false, message: 'Phiên phòng chưa sẵn sàng.' };
    if (requestLockRef.current) return { ok: false, message: 'Đang xử lý thao tác trước đó.' };
    requestLockRef.current = true; setBusy(true);
    const epoch = roomEpochRef.current;
    try {
      const reply = await emitAck<{ ok: boolean; message?: string; snapshot?: RoomSnapshot }>(event, {
        actionId: createActionId(), roomId: session.roomId, expectedRevision: roomSnapshot.revision, ...body,
      });
      if (epoch !== roomEpochRef.current) return { ok: false, message: 'Phiên phòng đã kết thúc.' };
      if (reply.snapshot) commitSnapshot(reply.snapshot);
      if (!reply.ok) setToast(reply.message || 'Thao tác chưa thực hiện được.');
      return reply;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Thao tác chưa thực hiện được. Hãy thử lại.';
      setToast(message);
      return { ok: false, message };
    } finally { if (epoch === roomEpochRef.current) { requestLockRef.current = false; setBusy(false); } }
  }

  async function leaveRoom(nextPage: Page = 'home') {
    if (!session || !roomSnapshot) { setPage(nextPage); return; }
    const reply = await roomCommand('room:leave');
    if (!reply.ok) return;
    sessionRef.current = null; roomEpochRef.current++;
    setSession(null); commitSnapshot(null); setGameEffect(null); seenEffectsRef.current.clear(); setPage(nextPage);
  }

  async function sendGameAction(action: Record<string, unknown>) {
    const game = roomSnapshot?.game as ProjectedUnoGame | null;
    if (!game) return { ok: false, message: 'Ván chưa sẵn sàng.' };
    return roomCommand('game:action', { ...action, gameId: game.gameId });
  }

  function openTable() {
    setDemoState('your-turn');
    setPlayerCount(4);
    setPage('preview');
  }

  function playCard(card: CardInfo) {
    if (card.id === 'wild') {
      setSelectedCard(card.id);
      setDemoState('choose-color');
      return;
    }
    setSelectedCard(card.id);
    setToast(`Bản xem thử: đã chọn ${card.label}.`);
    setDemoState('waiting');
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" type="button" onClick={() => { if (session && roomSnapshot) void leaveRoom('home'); else setPage('home'); }} aria-label="Về trang chủ Bàn Bạn">
          <Brand /><span>Bàn Bạn</span>
        </button>
        <nav className="top-nav" aria-label="Điều hướng chính">
          <button className={page === 'home' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => { if (session && roomSnapshot) void leaveRoom('home'); else setPage('home'); }}>Trò chơi</button>
          <button className="nav-link" type="button" onClick={openRules}>Luật chơi</button>
        </nav>
        <div className="top-user">
          <span className="avatar avatar-you">{nickname.slice(0, 1).toUpperCase()}</span>
          <span className="top-user-name">{nickname}</span>
          <button ref={nicknameTriggerRef} className="button button-quiet button-small" type="button" onClick={() => setNicknameOpen(true)}>Đổi tên</button>
        </div>
      </header>

      <main id="main-content">
        {page === 'home' && <HomePage code={roomCodeInput} onCode={setRoomCodeInput} onJoin={joinRoom} onChooseUno={() => setPage('uno')} onToast={setToast} />}
        {page === 'uno' && <UnoIntro rooms={rooms} connected={connected} busy={busy} onRefresh={async () => { try { const response = await fetch('/api/rooms', { cache: 'no-store' }); if (response.ok) setRooms(await response.json() as PublicRoomSummary[]); } catch { /* danh sách công khai không ảnh hưởng việc nhập mã */ } }} onUseCode={(code) => { setRoomCodeInput(code); setPage('home'); }} onBack={() => setPage('home')} onCreate={createRoom} onRules={openRules} onPreview={openTable} />}
        {page === 'lobby' && roomSnapshot && <LobbyPage snapshot={roomSnapshot} connected={connected} busy={busy} onCommand={roomCommand} onLeave={() => void leaveRoom('uno')} onStart={() => void roomCommand('room:start')} onToast={setToast} />}
        {page === 'table' && roomSnapshot && session && <LiveTablePage snapshot={roomSnapshot} effect={gameEffect} playerId={session.playerId} nickname={nickname} connected={connected} busy={busy} onAction={sendGameAction} onCommand={roomCommand} onLeave={() => void leaveRoom('home')} onRules={openRules} onToast={setToast} />}
        {page === 'preview' && <PreviewTablePage nickname={nickname} demoState={demoState} setDemoState={setDemoState} playerCount={playerCount} setPlayerCount={setPlayerCount} selectedCard={selectedCard} onCard={playCard} onToast={setToast} onBack={() => setPage('uno')} onRules={openRules} />}
      </main>

      {page !== 'table' && <footer className="site-footer"><span>© 2026 Bàn Bạn</span><span>Dự án không chính thức, không liên kết với Mattel.</span><a href="https://service.mattel.com/instruction_sheets/W2085-Eng.pdf" target="_blank" rel="noreferrer">Nguồn bộ bài <Icon name="chevron" size={14} /></a></footer>}

      {nicknameOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setNicknameOpen(false); }}>
        <section className="modal-card nickname-modal" role="dialog" aria-modal="true" aria-labelledby="nickname-title" onKeyDown={keepFocusInside}>
          <button className="icon-button modal-close" type="button" aria-label="Đóng" onClick={() => setNicknameOpen(false)}><Icon name="close" /></button>
          <p className="eyebrow">HỒ SƠ CỦA BẠN</p>
          <h2 id="nickname-title">Đổi biệt danh</h2>
          <p className="modal-intro">Tên này chỉ được lưu trên thiết bị của bạn.</p>
          <InlineNicknameEdit name={nickname} onSave={saveNickname} />
        </section>
      </div>}

      {rulesOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setRulesOpen(false); }}>
        <section ref={rulesDialogRef} className="modal-card rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" tabIndex={-1} onKeyDown={keepFocusInside}>
          <button className="icon-button modal-close" type="button" aria-label="Đóng luật chơi" onClick={() => setRulesOpen(false)}><Icon name="close" /></button>
          <p className="eyebrow">UNO · BB-UNO-1</p>
          <h2 id="rules-title">Luật chơi tóm tắt</h2>
          <p className="modal-intro">Ván trực tuyến dùng luật tùy chỉnh Bàn Bạn BB-UNO-1, bộ 108 lá. Mỗi nước đi được máy chủ kiểm tra.</p>
          <ul className="rules-list">
            <li><b>Mục tiêu:</b> đánh hết bài trên tay trước những người chơi khác.</li>
            <li><b>Bắt đầu:</b> mỗi người nhận 7 lá. Lá số cao nhất khi rút chọn người chia; người bên trái họ đi trước. Ghép lá theo màu, số hoặc ký hiệu.</li>
            <li><b>Mở bàn:</b> không lật bài sẵn. Người đi đầu đánh bất kỳ lá nào để mở màu và số/ký hiệu; lá chức năng có hiệu lực ngay.</li>
            <li><b>Rút bài:</b> nếu muốn hoặc không có lá để đánh, rút một lá. Nếu lá vừa rút đánh được, có thể đánh lá đó ngay hoặc giữ để kết thúc lượt.</li>
            <li><b>Lá chức năng:</b> Bỏ lượt khiến người kế tiếp mất lượt; Đảo chiều đổi hướng; Rút hai tạo khoản phạt 2 lá. Người kế chọn cộng hoặc nhận phạt và mất lượt.</li>
            <li><b>Đổi màu:</b> chọn màu tiếp tục. +4 đánh được tự do và không thách thức. Sau +2 được cộng +2/+4, sau +4 chỉ cộng +4; +2 cộng tiếp không cần cùng màu. Có lá cộng vẫn được chọn nhận toàn bộ số phạt.</li>
            <li><b>UNO:</b> khi còn một lá, hô “UNO”. Nếu bị bắt trước khi người kế tiếp bắt đầu lượt, phải rút 2 lá.</li>
            <li><b>Hai người:</b> Đảo chiều như Bỏ lượt, người đánh được đi tiếp. Từ 3 người, đổi hướng rồi tới người kế theo hướng mới.</li>
          </ul>
          <p className="rules-note">Luật cộng dồn là tùy chỉnh Bàn Bạn, không phải luật Mattel. Đánh hợp lệ lá cuối là thắng ngay, kể cả +2/+4 hoặc lá chức năng; người kế không cần nhận phạt. Wild/+4 vẫn chọn màu. Không nhảy lượt hoặc đánh nhiều lá cùng lúc. Khi chồng rút cạn, server xáo lại chồng bỏ còn lại và giữ lá trên cùng.</p>
          <a className="source-link" href="https://service.mattel.com/instruction_sheets/W2085-Eng.pdf" target="_blank" rel="noreferrer">Mở nguồn chính thức của Mattel <Icon name="arrow" size={17} /></a>
        </section>
      </div>}

      {toast && <div className="toast-message" role="status"><Icon name="info" size={18} />{toast}</div>}
    </div>
  );
}

function keepFocusInside(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return;
  const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).opacity !== '0');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function HomePage({ code, onCode, onJoin, onChooseUno, onToast }: { code: string; onCode: (value: string) => void; onJoin: () => void; onChooseUno: () => void; onToast: (message: string) => void }) {
  const [interestedGames, setInterestedGames] = useState<string[]>([]);
  const updatePointerLight = (event: React.PointerEvent<HTMLElement>) => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty('--my', `${event.clientY - bounds.top}px`);
  };
  const toggleInterest = (gameName: string) => {
    const alreadyInterested = interestedGames.includes(gameName);
    setInterestedGames((current) => alreadyInterested ? current.filter((name) => name !== gameName) : [...current, gameName]);
    onToast(alreadyInterested ? `Đã bỏ đánh dấu ${gameName} trên máy này.` : 'Đã đánh dấu trên máy này. Bản xem thử chưa gửi thông báo.');
  };
  const games = [
    { name: 'UNO', players: '2–6 người', description: 'Ra lá thật nhanh, giữ nhịp vui cùng cả nhóm.', status: 'ĐANG MỞ', color: 'game-uno', action: onChooseUno },
    { name: 'Caro', description: 'Một bàn cờ nhỏ, một nước đi chiến lược.', status: 'SẮP RA MẮT', color: 'game-caro' },
    { name: 'Nối từ', description: 'Nối thật nhanh, xem ai giữ được mạch chơi.', status: 'SẮP RA MẮT', color: 'game-word' },
    { name: 'Gián điệp', description: 'Tìm người đang nắm bí mật khác biệt.', status: 'SẮP RA MẮT', color: 'game-spy' },
  ];

  return <div className="page home-page">
    <div className="home-intro">
      <div className="hero-wash" aria-hidden="true" />
      <div className="hero-stage">
        <div className="hero-card-orbit hero-card-orbit-left" aria-hidden="true"><HeroCard face="5" color="red" className="hero-card-one" /></div>
        <div className="hero-copy-block">
          <p className="eyebrow">MỘT CHIẾC BÀN · CẢ HỘI BẠN</p>
          <h1>Bạn bè đủ mặt,<br /><span>vào bàn thôi.</span></h1>
          <p className="hero-copy">Gọi hội bạn. Chọn trò. Hẹn nhau quanh một chiếc bàn.</p>
        </div>
        <div className="hero-card-orbit hero-card-orbit-right" aria-hidden="true">
          <HeroCard face="↻" color="blue" className="hero-card-two" />
          <HeroCard face="7" color="yellow" className="hero-card-three" />
        </div>
      </div>
      <div className="join-divider-label" aria-hidden="true"><span />VÀO PHÒNG<span /></div>
      <form className="join-form" onSubmit={(event) => { event.preventDefault(); onJoin(); }}>
        <label htmlFor="room-code">Nhập mã phòng</label>
        <div className="join-control"><input id="room-code" value={code} onChange={(event) => onCode(event.target.value)} placeholder="VD: ABC123" maxLength={12} autoComplete="off" /><button className="button button-join-ghost" type="submit">Vào <Icon name="arrow" size={17} /></button></div>
        <p>Có mã từ bạn bè? Nhập vào để tham gia.</p>
      </form>
      <div className="home-benefits" aria-label="Thông tin cách chơi">
        <span><i aria-hidden="true">✳</i>Không cần tài khoản</span>
        <span><i aria-hidden="true">⌁</i>Chỉ cần một mã phòng</span>
        <span><i aria-hidden="true">↗</i>Chơi ngay trên trình duyệt</span>
      </div>
    </div>
    <section className="game-section" aria-labelledby="games-title">
      <div className="section-heading"><div><p className="eyebrow">MỞ HỘI TRÊN MỘT CHIẾC BÀN</p><h2 id="games-title">Chọn trò chơi</h2></div><span className="section-count">01 <span>/ 04 trò chơi</span></span></div>
      <div className="game-grid">
        {games.map((game, index) => <article key={game.name} className={`game-card ${game.color} ${index === 0 ? 'featured' : 'coming-soon'}`} onPointerMove={updatePointerLight} onPointerLeave={(event) => { event.currentTarget.style.removeProperty('--mx'); event.currentTarget.style.removeProperty('--my'); }}>
          <div className="game-card-top"><span className={index === 0 ? 'game-state-live' : 'game-state-soon'}><i />{game.status}</span>{game.players && <span className="game-players">{game.players}</span>}</div>
          <div className="game-art-area">
            {game.name === 'UNO' ? <div className="uno-card-stack" aria-hidden="true"><CardArt face="5" color="red" tilt="card-tilt-left" /><CardArt face="↻" color="blue" tilt="card-tilt-back" /><CardArt face="7" color="yellow" tilt="card-tilt-front" /></div> : <GamePlaceholder kind={game.name} />}
          </div>
          <div className="game-card-bottom"><div className="game-card-copy"><h3>{game.name}</h3><p>{game.description}</p></div>{index === 0 ? <button className="button button-primary game-play" type="button" onClick={game.action}>Chơi UNO <Icon name="arrow" size={17} /></button> : <button className={`button interest-button${interestedGames.includes(game.name) ? ' is-marked' : ''}`} type="button" aria-pressed={interestedGames.includes(game.name)} onClick={() => toggleInterest(game.name)}>{interestedGames.includes(game.name) ? 'Đã đánh dấu' : 'Báo tôi khi ra mắt'}</button>}</div>
        </article>)}
      </div>
    </section>
  </div>;
}

function GamePlaceholder({ kind }: { kind: string }) {
  if (kind === 'Caro') return <div className="board-art" aria-hidden="true"><span>×</span><i /><b>○</b><i /><span>×</span><i /><b>○</b><i /><span>×</span></div>;
  if (kind === 'Nối từ') return <div className="word-art" aria-hidden="true"><span>bạn bè</span><b>→</b><span>bè bạn</span></div>;
  return <div className="spy-art" aria-hidden="true"><span>?</span><i /><span>?</span><i /><span>?</span></div>;
}

function UnoIntro({ rooms, connected, busy, onRefresh, onUseCode, onBack, onCreate, onRules, onPreview }: { rooms: PublicRoomSummary[]; connected: boolean; busy: boolean; onRefresh: () => void; onUseCode: (code: string) => void; onBack: () => void; onCreate: (visibility: RoomVisibility) => void; onRules: () => void; onPreview: () => void }) {
  const [visibility, setVisibility] = useState<RoomVisibility>('private');
  useEffect(() => { onRefresh(); const timer = window.setInterval(onRefresh, 12000); return () => window.clearInterval(timer); }, []);
  return <div className="page subpage">
    <button className="back-link" type="button" onClick={onBack}><Icon name="back" size={18} />Tất cả trò chơi</button>
    <section className="uno-intro-card">
      <div className="uno-intro-copy"><p className="eyebrow">TRÒ CHƠI ĐANG CÓ</p><h1>UNO<span> · 2–6 người</span></h1><p>Thêm bạn vào bàn, chia bài và bắt đầu một ván chơi thật vui.</p><div className="room-visibility-picker" role="group" aria-label="Chế độ phòng"><button type="button" className={visibility === 'private' ? 'selected' : ''} aria-pressed={visibility === 'private'} onClick={() => setVisibility('private')}>Riêng tư <small>Chỉ vào bằng mã</small></button><button type="button" className={visibility === 'public' ? 'selected' : ''} aria-pressed={visibility === 'public'} onClick={() => setVisibility('public')}>Công khai <small>Hiện trong danh sách</small></button></div><div className="intro-actions"><button className="button button-primary button-large" type="button" disabled={busy || !connected} onClick={() => onCreate(visibility)}><Icon name="plus" size={19} />{busy ? 'Đang tạo…' : 'Tạo phòng UNO'}</button><button className="button button-secondary button-large" type="button" onClick={onRules}><Icon name="rules" size={18} />Luật chơi</button></div><button className="text-link" type="button" onClick={onPreview}>Xem thử bàn chơi <span>(bản demo)</span><Icon name="arrow" size={16} /></button></div>
      <div className="uno-intro-art" aria-hidden="true"><div className="intro-halo" /><CardArt face="2" color="green" tilt="card-intro-left" /><CardArt face="↶" color="yellow" tilt="card-intro-back" /><CardArt face="7" color="blue" tilt="card-intro-front" /></div>
    </section>
    <section className="public-rooms-panel"><div className="public-rooms-heading"><div><p className="eyebrow">PHÒNG CÔNG KHAI</p><h2>Tìm hội đang chờ</h2></div><button type="button" className="button button-quiet button-small" onClick={onRefresh}>Làm mới</button></div>{!connected ? <p className="public-room-empty">Đang kết nối máy chủ…</p> : rooms.length === 0 ? <p className="public-room-empty">Chưa có phòng công khai đang chờ. Bạn vẫn có thể vào bằng mã bạn bè.</p> : <div className="public-room-list">{rooms.map((room) => <article className="public-room-row" key={room.code}><span className="public-room-icon"><Icon name="spark" size={18} /></span><div className="public-room-info"><strong>{room.hostName}</strong><small>{room.playerCount}/{room.maxPlayers} người · đang chờ</small></div><code>{room.code}</code><button className="button button-secondary button-small" type="button" onClick={() => onUseCode(room.code)}>Dùng mã</button></article>)}</div>}</section>
    <div className="intro-note"><Icon name="info" size={18} /><p>Danh sách chỉ hiện phòng công khai còn chỗ. Bạn vẫn xác nhận tham gia bằng mã phòng.</p></div>
  </div>;
}

function LobbyPage({ snapshot, connected, busy, onCommand, onLeave, onStart, onToast }: { snapshot: RoomSnapshot; connected: boolean; busy: boolean; onCommand: (event: string, body?: Record<string, unknown>) => Promise<{ ok: boolean; message?: string }>; onLeave: () => void; onStart: () => void; onToast: (message: string) => void }) {
  const me = snapshot.players.find((player) => player.isYou);
  const isHost = me?.isHost ?? false;
  const shareLink = `${window.location.origin}/?room=${snapshot.code}`;
  const changeVisibility = (visibility: RoomVisibility) => void onCommand('room:visibility', { visibility });
  const kick = (playerId: string, nickname: string) => { if (window.confirm(`Mời ${nickname} ra khỏi phòng?`)) void onCommand('room:kick', { targetPlayerId: playerId }); };
  return <div className="page subpage lobby-page">
    <button className="back-link" type="button" onClick={onLeave}><Icon name="back" size={18} />Rời phòng</button>
    <div className="lobby-layout">
      <section className="lobby-main">
        <div className="lobby-title-row"><div><p className="eyebrow">UNO · PHÒNG {snapshot.visibility === 'private' ? 'RIÊNG TƯ' : 'CÔNG KHAI'}</p><h1>Phòng chờ</h1></div><span className="player-limit">{snapshot.players.length} / {snapshot.maxPlayers} người</span></div>
        <div className="room-share-panel"><div><span className="mini-label">MÃ PHÒNG</span><strong className="room-code-display">{snapshot.code}</strong></div><span className="room-share-note"><Icon name="link" size={17} />Gửi mã này cho bạn bè</span><CopyInviteCard roomCode={snapshot.code} /></div>
        <div className="lobby-roster"><div className="roster-heading"><h2>Người chơi</h2><span>{snapshot.players.length} / {snapshot.maxPlayers} ghế</span></div>
          {snapshot.players.map((seat, index) => <div key={seat.id} className={`roster-seat${seat.isYou ? ' is-you' : ''}${!seat.online ? ' is-empty' : ''}`}>
            <span className={`avatar avatar-${index % 4}`}>{seat.nickname.slice(0, 1).toUpperCase()}</span><span className="roster-name">{seat.nickname}<small>{seat.isHost ? 'Chủ phòng' : seat.isYou ? 'Bạn' : seat.online ? 'Đã vào phòng' : 'Mất kết nối'}</small></span><span className={`seat-status ${!seat.online ? 'status-offline' : seat.isHost || seat.ready ? 'status-ready' : 'status-wait'}`}>{!seat.online ? 'Mất kết nối' : seat.isHost ? 'Chủ phòng' : seat.ready ? 'Sẵn sàng' : 'Chưa sẵn sàng'}</span>{isHost && !seat.isYou && <button className="button button-quiet button-small kick-button" type="button" onClick={() => kick(seat.id, seat.nickname)}>Mời ra</button>}
          </div>)}
        </div>
        {snapshot.notice && <div className="room-notice" role="status"><Icon name="info" size={18} />{snapshot.notice}</div>}
        <div className="lobby-actions">{isHost ? <button className="button button-primary button-large" type="button" disabled={!snapshot.canStart || busy || !connected} title={snapshot.startReason ?? 'Bắt đầu ván UNO'} onClick={onStart}>Bắt đầu UNO <Icon name="arrow" size={17} /></button> : <button className={`button ${me?.ready ? 'button-secondary' : 'button-primary'} button-large`} type="button" disabled={busy || !connected} onClick={() => void onCommand('room:ready', { ready: !me?.ready })}>{me?.ready ? <><Icon name="check" />Đã sẵn sàng</> : 'Sẵn sàng'}</button>}<button className="button button-quiet button-large" type="button" disabled={busy} onClick={onLeave}>Rời phòng</button></div>
      </section>
      <aside className="lobby-side"><div className="lobby-side-icon"><Icon name="spark" size={22} /></div><p className="eyebrow">{connected ? 'ĐANG KẾT NỐI' : 'ĐANG NỐI LẠI'}</p><h2>Mời hội bạn vào bàn</h2><p>Gửi mã phòng cho bạn bè. Chỉ người chơi đã sẵn sàng mới được chủ phòng đưa vào ván.</p><div className="lobby-side-divider" /><label className="visibility-toggle"><span><b>Phòng công khai</b><small>Hiện với người đang tìm phòng</small></span><input type="checkbox" checked={snapshot.visibility === 'public'} disabled={!isHost || busy || !connected} onChange={(event) => changeVisibility(event.target.checked ? 'public' : 'private')} /></label><div className="lobby-side-divider" /><button className="button button-secondary copy-link-button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(shareLink); onToast('Đã sao chép link phòng.'); } catch { onToast(`Mã phòng: ${snapshot.code}`); } }}><Icon name="copy" size={17} />Sao chép link mời</button><button className="text-link" type="button" onClick={() => onToast(snapshot.startReason ?? 'Đã đủ điều kiện để bắt đầu.')}>Điều kiện bắt đầu <Icon name="chevron" size={16} /></button>{isHost && snapshot.startReason && <small className="start-reason">{snapshot.startReason}</small>}</aside>
    </div>
  </div>;
}

function PreviewTablePage({ nickname, demoState, setDemoState, playerCount, setPlayerCount, selectedCard, onCard, onToast, onBack, onRules }: { nickname: string; demoState: DemoState; setDemoState: (state: DemoState) => void; playerCount: number; setPlayerCount: (count: number) => void; selectedCard: string | null; onCard: (card: CardInfo) => void; onToast: (message: string) => void; onBack: () => void; onRules: () => void }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const opponents = demoNames.filter((_, index) => index < playerCount - 1);
  const positions = playerCount === 2 ? ['pos-top'] : playerCount === 4 ? ['pos-left', 'pos-top', 'pos-right'] : ['pos-left', 'pos-top-left', 'pos-top', 'pos-top-right', 'pos-right'];
  const stateLabels: Record<DemoState, string> = {
    'your-turn': 'Tới lượt bạn', waiting: 'Chờ đối thủ', drawn: 'Vừa rút bài', 'choose-color': 'Chọn màu', 'uno-window': 'Gọi UNO', 'catch-uno': 'Bắt lỗi UNO', 'wild-four': 'Cộng hoặc nhận +4', disconnected: 'Mất kết nối', finished: 'Kết thúc ván',
  };
  const stateMessage: Record<DemoState, string> = {
    'your-turn': 'Lượt của bạn', waiting: 'Đang chờ Khoa chơi…', drawn: 'Bạn vừa rút được một lá có thể đánh.', 'choose-color': 'Chọn màu tiếp theo', 'uno-window': 'Bạn còn một lá trên tay. Đừng quên hô UNO!', 'catch-uno': 'Khoa còn một lá nhưng chưa hô UNO.', 'wild-four': 'Khoa vừa đánh lá Đổi màu Rút bốn.', disconnected: 'Mất kết nối với phòng mẫu.', finished: 'Khoa đã hết bài. Ván chơi kết thúc!',
  };

  useEffect(() => {
    if (demoState === 'choose-color') setShowColorPicker(true);
    else setShowColorPicker(false);
  }, [demoState]);

  return <div className="table-page">
    <div className="table-topline"><button className="back-link" type="button" onClick={onBack}><Icon name="back" size={18} />Phòng chờ</button><div className="table-room-meta"><DemoTag /> <span>PHÒNG MẪU</span><i /> <button type="button" onClick={onRules}>Luật chơi <Icon name="chevron" size={15} /></button></div><button className="icon-button table-sound" type="button" aria-label="Âm thanh minh họa"><Icon name="volume" /></button></div>
    <div className="demo-controls" aria-label="Điều khiển bản xem thử"><div className="demo-control-label"><span className="demo-pulse" />Điều khiển bản xem thử</div><label className="preview-player-count">Bố cục <select value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value))}><option value={2}>2 người</option><option value={4}>4 người</option><option value={6}>6 người</option></select></label><div className="demo-state-tabs" aria-label="Chọn trạng thái bàn"><StateTab active={demoState === 'your-turn'} onClick={() => setDemoState('your-turn')}>Tới lượt</StateTab><StateTab active={demoState === 'waiting'} onClick={() => setDemoState('waiting')}>Chờ</StateTab><StateTab active={demoState === 'drawn'} onClick={() => setDemoState('drawn')}>Vừa rút</StateTab><StateTab active={demoState === 'uno-window'} onClick={() => setDemoState('uno-window')}>UNO</StateTab><StateTab active={demoState === 'catch-uno'} onClick={() => setDemoState('catch-uno')}>Bắt UNO</StateTab><StateTab active={demoState === 'wild-four'} onClick={() => setDemoState('wild-four')}>+4</StateTab><StateTab active={demoState === 'disconnected'} onClick={() => setDemoState('disconnected')}>Mất mạng</StateTab><StateTab active={demoState === 'finished'} onClick={() => setDemoState('finished')}>Kết thúc</StateTab></div></div>
    <div className="table-layout">
      <section className={`game-table state-${demoState}`} aria-label="Bàn UNO bản xem thử">
        {demoState === 'disconnected' && <div className="connection-banner"><span className="connection-indicator" /><div><strong>Mất kết nối</strong><small>Đang thử kết nối lại với phòng mẫu…</small></div><button className="button button-secondary button-small" type="button" onClick={() => { setDemoState('waiting'); onToast('Đã kết nối lại trong bản xem thử.'); }}>Thử lại</button></div>}
        <div className="opponent-seats">{opponents.map((name, index) => <div className={`opponent-seat ${positions[index]}${demoState === 'catch-uno' && name === 'Khoa' ? ' seat-alert' : ''}`} key={name}>
          <span className={`avatar avatar-${index}`}>{name.slice(0, 1)}</span><span className="opponent-meta"><strong>{name}</strong><small>{demoState === 'waiting' && index === 0 ? 'Đang suy nghĩ…' : `${6 - (index % 3)} lá`}</small></span>{demoState === 'catch-uno' && name === 'Khoa' && <span className="uno-alert">UNO?</span>}
        </div>)}</div>
        <div className="felt-table">
          <span className="felt-ring ring-one" /><span className="felt-ring ring-two" />
          <div className="turn-banner"><span className={demoState === 'disconnected' ? 'turn-dot offline' : 'turn-dot'} />{stateMessage[demoState]}</div>
          <div className="pile-row">
            <div className="pile-column"><span className="pile-caption">CHỒNG RÚT</span><button className="card-back" type="button" aria-label="Chồng rút bài" onClick={() => demoState === 'your-turn' && setDemoState('drawn')}><span className="card-back-oval"><b>B</b></span></button><span className="pile-count">30 lá</span></div>
            <span className="pile-arrow" aria-label="Chiều kim đồng hồ">↻</span>
            <div className="pile-column"><span className="pile-caption">LÁ BỎ</span><CardArt face={demoState === 'wild-four' ? '+4' : '7'} color={demoState === 'wild-four' ? 'wild' : 'blue'} /><span className="pile-count">Màu hiện tại: <b className="current-color">{demoState === 'wild-four' ? 'đỏ' : 'xanh dương'}</b></span></div>
          </div>
          <div className="turn-direction"><span>↻</span><b>Chiều kim đồng hồ</b></div>
          {demoState === 'choose-color' && <div className="color-picker-card" role="dialog" aria-label="Chọn màu tiếp theo"><p>Chọn màu tiếp theo</p><div className="color-picker-options">{(['red', 'yellow', 'green', 'blue'] as const).map((color) => <button className={`color-choice color-${color}`} key={color} type="button" aria-label={colorNames[color]} onClick={() => { setShowColorPicker(false); setDemoState('waiting'); onToast(`Bản xem thử: đã chọn màu ${colorNames[color].toLowerCase()}.`); }} />)}</div></div>}
          {demoState === 'wild-four' && <div className="action-status-card"><span className="action-status-icon">+4</span><div><strong>Đổi màu Rút bốn</strong><small>Chọn cách xử lý trong bản demo</small></div><button className="button button-quiet button-small" type="button" onClick={() => { setDemoState('waiting'); onToast('Bản xem thử: bạn đã chấp nhận rút bốn lá.'); }}>Nhận 4 lá</button><button className="button button-primary button-small" type="button" onClick={() => { setDemoState('waiting'); onToast('Bản xem thử: cộng +4, tổng phạt 8 lá; màu đã chọn: xanh dương.'); }}>Cộng +4</button></div>}
          {demoState === 'catch-uno' && <button className="button button-coral catch-button" type="button" onClick={() => { setDemoState('waiting'); onToast('Bản xem thử: đã chọn bắt lỗi UNO.'); }}>Bắt lỗi UNO <Icon name="arrow" size={16} /></button>}
          {demoState === 'finished' && <div className="result-card"><span className="result-spark"><Icon name="spark" size={26} /></span><p className="eyebrow">VÁN MẪU ĐÃ KẾT THÚC</p><h2>Khoa thắng ván này!</h2><p>Không có điểm tích lũy. Đây chỉ là kết quả minh họa.</p><button className="button button-primary button-small" type="button" onClick={onBack}>Về phòng chờ</button></div>}
        </div>
        <section className="my-hand" aria-label="Bài của bạn">
          <div className="hand-heading"><div><span className="avatar avatar-you hand-avatar">{nickname.slice(0, 1).toUpperCase()}</span><strong>{nickname}</strong><span className="your-hand-label">BÀI CỦA BẠN</span></div><span className="hand-count">{demoState === 'uno-window' ? 1 : 7} lá</span></div>
          <div className="hand-cards">{demoCards.map((card) => {
            const justDrawn = demoState === 'drawn' && card.id === 'yellow-7';
            const canPlay = demoState === 'your-turn' && card.playable;
            const disabled = !canPlay && !justDrawn;
            return <button data-card-id={card.id} key={card.id} className={`hand-card ${canPlay || justDrawn ? 'is-playable' : ''}${selectedCard === card.id || justDrawn ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`} type="button" aria-label={`${card.label}${canPlay ? ', có thể đánh' : ''}`} disabled={disabled} onClick={() => !disabled && onCard(card)}><CardArt face={card.face} color={card.color} /><span className="card-label">{card.label}</span></button>;
          })}</div>
          <div className="hand-actions">{demoState === 'your-turn' && <><button className="button button-secondary" type="button" onClick={() => setDemoState('drawn')}>Rút bài</button><span className="turn-hint">Chọn lá sáng để đánh</span></>}{demoState === 'drawn' && <><button className="button button-primary" type="button" onClick={() => { setDemoState('waiting'); onToast('Bản xem thử: bạn đã đánh lá vừa rút.'); }}>Đánh lá vừa rút</button><button className="button button-quiet" type="button" onClick={() => setDemoState('waiting')}>Giữ lá</button></>}{demoState === 'uno-window' && <><button className="button button-coral" type="button" onClick={() => { setDemoState('waiting'); onToast('UNO! Bạn đã hô UNO trong bản xem thử.'); }}>UNO!</button><span className="turn-hint">Còn một lá trên tay</span></>}{demoState === 'waiting' && <span className="turn-hint"><span className="waiting-dots"><i /><i /><i /></span>Đang chờ tới lượt bạn</span>}{demoState === 'catch-uno' && <span className="turn-hint">Chọn “Bắt lỗi UNO” nếu muốn bắt người chơi quên hô</span>}{demoState === 'wild-four' && <span className="turn-hint">Bản xem thử: sau +4 chỉ được cộng +4, hoặc nhận 4 lá.</span>}{demoState === 'disconnected' && <span className="turn-hint">Các thao tác đang tạm dừng.</span>}{demoState === 'finished' && <button className="button button-secondary" type="button" onClick={onBack}>Về phòng chờ</button>}</div>
        </section>
      </section>
      <aside className="table-aside"><div className="aside-panel"><p className="eyebrow">TRẠNG THÁI</p><div className="aside-state"><span className={`aside-state-icon state-icon-${demoState}`}><Icon name={demoState === 'finished' ? 'spark' : 'info'} size={18} /></span><div><strong>{stateLabels[demoState]}</strong><small>{demoState === 'your-turn' ? 'Bạn có thể đánh hoặc rút' : demoState === 'waiting' ? 'Lượt đang ở người khác' : demoState === 'disconnected' ? 'Hành động tạm dừng' : 'Đang xem một trạng thái mẫu'}</small></div></div><div className="aside-divider" /><p className="eyebrow">MÀU HIỆN TẠI</p><div className="active-color"><span className={`color-dot ${demoState === 'wild-four' ? 'dot-red' : 'dot-blue'}`} />{demoState === 'wild-four' ? 'Đỏ' : 'Xanh dương'}</div><div className="aside-divider" /><button className="rules-mini" type="button" onClick={onRules}><span className="rules-mini-icon"><Icon name="rules" size={17} /></span><span><strong>Luật UNO</strong><small>Mở bản tóm tắt</small></span><Icon name="chevron" size={16} /></button></div><p className="aside-demo-note">Đây là bàn mẫu để xem bố cục. Số bài và trạng thái không được đồng bộ với người chơi khác.</p></aside>
    </div>
    {showColorPicker && <span className="sr-only" role="status">Hộp thoại chọn màu đã mở</span>}
  </div>;
}

type ProjectedUnoGame = ReturnType<typeof projectGame>;

function liveCardFace(card: UnoCard) {
  if (card.type === 'number') return String(card.value);
  return ({ drawTwo: '+2', reverse: '↶', skip: '⊘', wild: '✦', wildDrawFour: '+4' } as const)[card.type];
}
function liveCardName(card: UnoCard) {
  const color = card.color === 'wild' ? 'Đổi màu' : colorNames[card.color];
  const value = card.type === 'number' ? String(card.value) : ({ drawTwo: 'Rút hai', reverse: 'Đảo chiều', skip: 'Bỏ lượt', wild: 'Đổi màu', wildDrawFour: 'Đổi màu Rút bốn' } as const)[card.type];
  return `${color} ${value}`;
}
type PlayedFlight = { face: string; color: UnoColor; from: FlightRect; to: FlightRect; key: string; impactType: string | null; penaltyTotal: number };
type LandedImpact = { key: string; cardType: 'drawTwo' | 'wildDrawFour' | 'skip'; penaltyTotal: number };
function plainRect(rect: DOMRect): FlightRect { return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }; }
function centeredCardRect(anchor: DOMRect, width: number, height: number): FlightRect {
  return { left: anchor.left + anchor.width / 2 - width / 2, top: anchor.top + anchor.height / 2 - height / 2, width, height };
}
function LiveTablePage({ snapshot, effect, playerId, nickname, connected, busy, onAction, onCommand, onLeave, onRules, onToast }: { snapshot: RoomSnapshot; effect: GameEffectEvent | null; playerId: string; nickname: string; connected: boolean; busy: boolean; onAction: (action: Record<string, unknown>) => Promise<{ ok: boolean; message?: string }>; onCommand: (event: string, body?: Record<string, unknown>) => Promise<{ ok: boolean; message?: string }>; onLeave: () => void; onRules: () => void; onToast: (message: string) => void }) {
  const [wildCard, setWildCard] = useState<UnoCard | null>(null);
  const [reduceEffects, setReduceEffects] = useState(() => localStorage.getItem('banban-reduce-effects') === 'true');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [flight, setFlight] = useState<PlayedFlight | null>(null);
  const [landedImpact, setLandedImpact] = useState<LandedImpact | null>(null);
  const [selectedMobileCardId, setSelectedMobileCardId] = useState<string | null>(null);
  const colorDialogRef = useRef<HTMLElement>(null);
  const feltSurfaceRef = useRef<HTMLSpanElement>(null);
  const drawVisualRef = useRef<HTMLSpanElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const handCardsRef = useRef<HTMLDivElement>(null);
  const pendingOrigin = useRef<{ rect: FlightRect; revision: number } | null>(null);
  const flightRef = useRef<HTMLDivElement>(null);
  const handRects = useRef(new Map<string, DOMRect>());
  const handAnimations = useRef(new Map<string, Animation>());
  const handBaselineFrame = useRef<number | null>(null);
  const handBaselineGameId = useRef<string | null>(null);
  const handBaselineMobile = useRef(isMobile);
  const presentedEventId = useRef<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const colorDialogWasOpen = useRef(false);
  const game = snapshot.game as ProjectedUnoGame | null;
  const selectedGameId = useRef<string | null>(game?.gameId ?? null);
  const latestGameId = useRef<string | null>(game?.gameId ?? null);
  const latestMobile = useRef(isMobile);
  latestGameId.current = game?.gameId ?? null;
  latestMobile.current = isMobile;
  const visibleEffect = game && effect?.gameId === game.gameId && effect.revision === snapshot.revision && effect.gameRevision === game.revision ? effect : null;
  const motionAllowed = !reduceEffects && !prefersReducedMotion;
  const cancelHandAnimations = () => { for (const animation of handAnimations.current.values()) animation.cancel(); handAnimations.current.clear(); };
  const recordHandBaseline = () => {
    const next = new Map<string, DOMRect>();
    handCardsRef.current?.querySelectorAll<HTMLElement>('[data-card-id]').forEach((card) => {
      const id = card.dataset.cardId;
      if (id) next.set(id, card.getBoundingClientRect());
    });
    handRects.current = next;
    handBaselineGameId.current = latestGameId.current;
    handBaselineMobile.current = latestMobile.current;
    handBaselineFrame.current = null;
  };
  const resetHandBaseline = () => {
    cancelHandAnimations();
    handRects.current.clear();
    if (handBaselineFrame.current !== null) cancelAnimationFrame(handBaselineFrame.current);
    handBaselineFrame.current = requestAnimationFrame(recordHandBaseline);
  };
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 760px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMobile = () => { setIsMobile(mobile.matches); setSelectedMobileCardId(null); resetHandBaseline(); };
    const updateReduced = () => setPrefersReducedMotion(reduced.matches);
    mobile.addEventListener('change', updateMobile);
    reduced.addEventListener('change', updateReduced);
    return () => { mobile.removeEventListener('change', updateMobile); reduced.removeEventListener('change', updateReduced); };
  }, []);
  useLayoutEffect(() => {
    if (!visibleEffect) {
      if (flight) setFlight(null);
      setLandedImpact(null);
      return;
    }
    if (presentedEventId.current === visibleEffect.eventId) {
      if (!motionAllowed || document.visibilityState === 'hidden') { setFlight(null); setLandedImpact(null); }
      return;
    }
    presentedEventId.current = visibleEffect.eventId;
    setLandedImpact(null);
    if (visibleEffect.actionType !== 'play' || !visibleEffect.card) {
      if (flight) setFlight(null);
      return;
    }
    const targetElement = discardRef.current?.querySelector<HTMLElement>('.card-art');
    if (!targetElement) { setFlight(null); pendingOrigin.current = null; return; }
    const target = plainRect(targetElement.getBoundingClientRect());
    const local = visibleEffect.actorId === playerId && pendingOrigin.current?.revision === visibleEffect.gameRevision ? pendingOrigin.current.rect : null;
    const actor = document.querySelector<HTMLElement>(`[data-player-id="${CSS.escape(visibleEffect.actorId)}"]`);
    const actorAnchor = actor?.querySelector<HTMLElement>('.avatar') ?? actor;
    let from = local;
    if (!from && actorAnchor) {
      const anchor = actorAnchor.getBoundingClientRect();
      from = centeredCardRect(anchor, target.width * .72, target.height * .72);
    }
    pendingOrigin.current = null;
    if (!motionAllowed || document.visibilityState === 'hidden' || !from) {
      setFlight(null);
      const type = visibleEffect.card.type;
      if (motionAllowed && document.visibilityState !== 'hidden' && ['drawTwo', 'wildDrawFour', 'skip'].includes(type)) setLandedImpact({ key: visibleEffect.eventId, cardType: type as LandedImpact['cardType'], penaltyTotal: visibleEffect.penaltyTotal ?? (type === 'wildDrawFour' ? 4 : type === 'drawTwo' ? 2 : 0) });
      return;
    }
    const type = visibleEffect.card.type;
    setFlight({
      face: type === 'number' ? String(visibleEffect.card.value ?? '') : ({ drawTwo: '+2', reverse: '↶', skip: '⊘', wild: '✦', wildDrawFour: '+4' } as const)[type],
      color: visibleEffect.card.color,
      from,
      to: target,
      key: visibleEffect.eventId,
      impactType: ['drawTwo', 'wildDrawFour', 'skip'].includes(type) ? type : null,
      penaltyTotal: visibleEffect.penaltyTotal ?? (type === 'wildDrawFour' ? 4 : type === 'drawTwo' ? 2 : 0),
    });
  }, [visibleEffect?.eventId, motionAllowed, isMobile]);
  useLayoutEffect(() => {
    if (!flight || !flightRef.current) return;
    const node = flightRef.current;
    const vector = flightTransform(flight.from, flight.to);
    const dx = vector.translateX;
    const dy = vector.translateY;
    const sx = vector.scaleX;
    const sy = vector.scaleY;
    const finalTransform = `translate3d(${dx}px,${dy}px,0) rotate(0deg) scale(${sx},${sy})`;
    const special = flight.impactType !== null;
    const flightAnimation = node.animate([
      { transform: 'translate3d(0,0,0) rotate(-3deg) scale(1,1)', opacity: 1, offset: 0 },
      { transform: `translate3d(${dx * .74}px,${dy * .74 - (isMobile ? 12 : 22)}px,0) rotate(4deg) scale(${sx * 1.03},${sy * 1.03})`, opacity: 1, offset: .76 },
      { transform: finalTransform, opacity: 1, offset: 1 },
    ], { duration: special ? 280 : 265, easing: 'cubic-bezier(.18,.72,.24,1)', fill: 'forwards' });
    let landingAnimation: Animation | null = null;
    let cancelled = false;
    const complete = async () => {
      try {
        await flightAnimation.finished;
        if (cancelled) return;
        if (special) {
          const slam = flight.impactType === 'wildDrawFour' ? 1.1 : flight.impactType === 'drawTwo' ? 1.055 : 1.025;
          const drop = flight.impactType === 'skip' ? 2 : flight.impactType === 'wildDrawFour' ? 7 : 4;
          landingAnimation = node.animate([
            { transform: finalTransform, offset: 0 },
            { transform: `translate3d(${dx}px,${dy + drop}px,0) rotate(${flight.impactType === 'skip' ? 1 : -1.6}deg) scale(${sx * slam},${sy * slam})`, offset: .46 },
            { transform: finalTransform, offset: 1 },
          ], { duration: flight.impactType === 'skip' ? 70 : 96, easing: 'cubic-bezier(.18,.8,.25,1.18)', fill: 'forwards' });
          await landingAnimation.finished;
          if (cancelled) return;
          setLandedImpact({ key: flight.key, cardType: flight.impactType as LandedImpact['cardType'], penaltyTotal: flight.penaltyTotal });
        }
        setFlight((current) => current?.key === flight.key ? null : current);
      } catch { /* A newer event, resize, or hidden tab cancels visual motion only. */ }
    };
    void complete();
    return () => { cancelled = true; flightAnimation.cancel(); landingAnimation?.cancel(); };
  }, [flight?.key, motionAllowed, isMobile]);
  useLayoutEffect(() => {
    if (!landedImpact || !motionAllowed) return;
    const { amplitude, duration } = penaltyImpact(landedImpact.penaltyTotal, isMobile);
    const isSkip = landedImpact.cardType === 'skip';
    const distance = isSkip ? (isMobile ? 1.8 : 3.2) : amplitude;
    const surface = feltSurfaceRef.current?.animate([
      { transform: 'translate3d(0,0,0) rotate(0deg)' },
      { transform: `translate3d(${-distance}px,${distance * .22}px,0) rotate(-.3deg)` },
      { transform: `translate3d(${distance}px,${-distance * .18}px,0) rotate(.3deg)` },
      { transform: `translate3d(${-distance * .62}px,${distance * .12}px,0) rotate(-.14deg)` },
      { transform: `translate3d(${distance * .28}px,0,0) rotate(.06deg)` },
      { transform: 'translate3d(0,0,0) rotate(0deg)' },
    ], { duration, easing: 'cubic-bezier(.36,.07,.19,.97)' });
    const deck = drawVisualRef.current?.animate([
      { transform: 'translate3d(0,0,0) rotate(-5deg)' },
      { transform: `translate3d(${-distance * .62}px,0,0) rotate(-8deg) scale(1.04)` },
      { transform: `translate3d(${distance * .72}px,0,0) rotate(-2deg) scale(.98)` },
      { transform: `translate3d(${-distance * .34}px,0,0) rotate(-6deg)` },
      { transform: 'translate3d(0,0,0) rotate(-5deg)' },
    ], { duration: Math.min(260, duration), easing: 'cubic-bezier(.36,.07,.19,.97)' });
    return () => { surface?.cancel(); deck?.cancel(); };
  }, [landedImpact?.key, motionAllowed, isMobile]);
  useLayoutEffect(() => {
    if (!game || !handCardsRef.current) return;
    const currentGameId = game.gameId;
    const sameGame = handBaselineGameId.current === currentGameId;
    const sameLayout = handBaselineMobile.current === isMobile;
    const previous = handRects.current;
    const cards = Array.from(handCardsRef.current.querySelectorAll<HTMLElement>('[data-card-id]'));
    const starts = new Map<string, DOMRect>();
    for (const card of cards) {
      const id = card.dataset.cardId;
      if (!id || !previous.has(id)) continue;
      starts.set(id, handAnimations.current.has(id) ? card.getBoundingClientRect() : previous.get(id)!);
    }
    cancelHandAnimations();
    const next = new Map<string, DOMRect>();
    for (const card of cards) {
      const id = card.dataset.cardId;
      if (!id) continue;
      const rect = card.getBoundingClientRect();
      next.set(id, rect);
      const before = starts.get(id);
      if (!motionAllowed || !sameGame || !sameLayout || !before) continue;
      const dx = before.left - rect.left;
      const dy = before.top - rect.top;
      if (Math.abs(dx) < .5 && Math.abs(dy) < .5) continue;
      const animation = card.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], { duration: 215, easing: 'cubic-bezier(.2,.8,.2,1)' });
      handAnimations.current.set(id, animation);
      animation.onfinish = () => { if (handAnimations.current.get(id) === animation) handAnimations.current.delete(id); };
    }
    handRects.current = next;
    handBaselineGameId.current = currentGameId;
    handBaselineMobile.current = isMobile;
  }, [game?.gameId, game?.hand.map((card) => card.id).join('|'), isMobile, motionAllowed]);
  useEffect(() => {
    const cancelFlight = () => { setFlight(null); setLandedImpact(null); pendingOrigin.current = null; resetHandBaseline(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') cancelFlight(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', cancelFlight);
    window.addEventListener('orientationchange', cancelFlight);
    window.addEventListener('scroll', cancelFlight, { passive: true });
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', cancelFlight);
      window.removeEventListener('orientationchange', cancelFlight);
      window.removeEventListener('scroll', cancelFlight);
    };
  }, []);
  useEffect(() => () => {
    cancelHandAnimations();
    if (handBaselineFrame.current !== null) cancelAnimationFrame(handBaselineFrame.current);
  }, []);
  const me = snapshot.players.find((player) => player.isYou);
  const openingColorChoice = game?.phase === 'chooseColor' && game.currentPlayerId === playerId;
  const colorDialogOpen = Boolean(wildCard) || Boolean(openingColorChoice);
  useEffect(() => {
    if (colorDialogOpen) {
      colorDialogWasOpen.current = true;
      requestAnimationFrame(() => colorDialogRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus());
    } else if (colorDialogWasOpen.current) {
      colorDialogWasOpen.current = false;
      requestAnimationFrame(() => {
        const origin = returnFocusRef.current;
        if (origin?.isConnected && !origin.matches(':disabled')) origin.focus();
        else document.querySelector<HTMLElement>('.live-game-table .turn-banner')?.focus();
        returnFocusRef.current = null;
      });
    }
  }, [colorDialogOpen]);
  useEffect(() => {
    if (wildCard && (!connected || snapshot.paused || !game?.allowedActions.playableCardIds.includes(wildCard.id))) {
      setWildCard(null);
      pendingOrigin.current = null;
    }
  }, [wildCard, connected, snapshot.paused, game]);
  useEffect(() => {
    const gameId = game?.gameId ?? null;
    if (selectedGameId.current !== gameId) {
      selectedGameId.current = gameId;
      setSelectedMobileCardId(null);
      resetHandBaseline();
    }
  }, [game?.gameId]);
  useEffect(() => {
    if (!connected || snapshot.paused) {
      pendingOrigin.current = null;
      setFlight(null);
      setLandedImpact(null);
      setSelectedMobileCardId(null);
    }
  }, [connected, snapshot.paused]);
  useEffect(() => {
    if (selectedMobileCardId && (!game?.hand.some((card) => card.id === selectedMobileCardId) || !game.allowedActions.playableCardIds.includes(selectedMobileCardId) || game.currentPlayerId !== playerId || !connected || snapshot.paused)) setSelectedMobileCardId(null);
  }, [selectedMobileCardId, game, playerId, connected, snapshot.paused]);
  if (!game) return <div className="page subpage"><div className="room-notice">Đang đồng bộ trạng thái ván chơi…</div></div>;
  const myTurn = !snapshot.paused && game.currentPlayerId === playerId && (game.phase === 'turn' || game.phase === 'drawn' || game.phase === 'penalty');
  const mustAccept = myTurn && game.allowedActions.canAcceptPenalty;
  const noPlayableCards = game.allowedActions.playableCardIds.length === 0;
  const canCatch = game.unoWindow && game.unoWindow.playerId !== playerId && game.currentPlayerId === game.unoWindow.nextPlayerId;
  const isHost = me?.isHost ?? false;
  const opponents = snapshot.players.filter((player) => !player.isYou);
  const positions = opponents.length === 1 ? ['pos-top'] : opponents.length === 2 ? ['pos-left', 'pos-right'] : opponents.length === 3 ? ['pos-left', 'pos-top', 'pos-right'] : opponents.length === 4 ? ['pos-left', 'pos-top-left', 'pos-top-right', 'pos-right'] : ['pos-left', 'pos-top-left', 'pos-top', 'pos-top-right', 'pos-right'];
  const sendPlay = (card: UnoCard, color?: 'red' | 'yellow' | 'green' | 'blue') => {
    setWildCard(null);
    const originRevision = pendingOrigin.current?.revision;
    void onAction({ type: 'play', cardId: card.id, ...(color ? { color } : {}) }).then((result) => {
      if (!result.ok && originRevision !== undefined && pendingOrigin.current?.revision === originRevision) pendingOrigin.current = null;
    }).catch(() => { if (originRevision !== undefined && pendingOrigin.current?.revision === originRevision) pendingOrigin.current = null; });
  };
  const cancelWildChoice = () => { setWildCard(null); pendingOrigin.current = null; setSelectedMobileCardId(null); };
  const chooseCard = (card: UnoCard) => {
    if (!myTurn || busy || !connected) return;
    if (!game.allowedActions.playableCardIds.includes(card.id)) { onToast('Lá này không hợp lệ trong lượt hiện tại.'); return; }
    if (game.phase === 'drawn' && card.id !== game.drawnCardId) { onToast('Sau khi rút, bạn chỉ có thể đánh lá vừa rút hoặc giữ lá.'); return; }
    if (isMobile) {
      if (selectedMobileCardId === card.id) playSelectedCard(card);
      else setSelectedMobileCardId(card.id);
      return;
    }
    playSelectedCard(card);
  };
  const playSelectedCard = (card: UnoCard) => {
    if (!myTurn || busy || !connected || !game.allowedActions.playableCardIds.includes(card.id)) return;
    const source = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(card.id)}"]`);
    const face = source?.querySelector<HTMLElement>('.card-art');
    if (face) pendingOrigin.current = { rect: plainRect(face.getBoundingClientRect()), revision: game.revision + 1 };
    if (card.type === 'wild' || card.type === 'wildDrawFour') {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setWildCard(card);
    }
    else sendPlay(card);
    setSelectedMobileCardId(null);
  };
  const startLabel = game.players.find((player) => player.id === game.currentPlayerId)?.nickname ?? 'Đang chờ';

  const setting = <label className="motion-setting"><input type="checkbox" checked={reduceEffects} onChange={(event) => { setReduceEffects(event.target.checked); localStorage.setItem('banban-reduce-effects', String(event.target.checked)); }} /><span>Giảm hiệu ứng</span></label>;
  const effectLabel = visibleEffect?.actionType === 'play' && visibleEffect.card?.type === 'skip' ? 'BỎ LƯỢT' : visibleEffect?.actionType === 'play' && visibleEffect.card?.type === 'drawTwo' ? `+2 · ${visibleEffect.penaltyTotal ?? 2} LÁ` : visibleEffect?.actionType === 'play' && visibleEffect.card?.type === 'wildDrawFour' ? `+4 · ${visibleEffect.penaltyTotal ?? 4} LÁ` : visibleEffect?.actionType === 'acceptPenalty' ? `NHẬN ${visibleEffect.drawnCount ?? 0} LÁ` : visibleEffect?.actionType === 'declareUno' ? 'UNO!' : visibleEffect?.actionType === 'catchUno' ? 'BẮT LỖI UNO' : null;
  return <div className={`table-page live-table-page${reduceEffects ? ' reduce-effects' : ''}`}>
    <div className="table-topline"><button className="back-link" type="button" onClick={onLeave}><Icon name="back" size={18} />Rời bàn</button><div className="table-room-meta"><span className="live-indicator" />PHÒNG {snapshot.code}<i /> <button type="button" onClick={onRules}>Luật chơi <Icon name="chevron" size={15} /></button></div><span className={`connection-state ${connected ? 'is-connected' : 'is-offline'}`}>{connected ? 'Đã kết nối' : 'Đang nối lại'}</span></div>
    {(!connected || snapshot.paused) && <div className="connection-banner" role="status"><span className="connection-indicator" /><div><strong>{snapshot.paused ? 'Ván tạm dừng' : 'Đang kết nối lại'}</strong><small>{snapshot.paused ? `Chờ ${snapshot.players.filter((player) => !player.online).map((player) => player.nickname).join(', ') || 'người chơi'} kết nối lại. Hết 90 giây, ván bị hủy.` : 'Bàn tạm khóa cho tới khi kết nối lại.'}</small></div></div>}
    {snapshot.notice && <div className="room-notice" role="status"><Icon name="info" size={18} />{snapshot.notice}</div>}
    <div className="table-layout live-table-layout">
      <section className={`game-table live-game-table${game.phase === 'finished' ? ' state-finished' : ''}`} aria-label="Bàn UNO">
        <div className={`opponent-seats${visibleEffect?.actionType === 'start' ? ' deal-opponents' : ''}`}>{opponents.map((player, index) => <div data-player-id={player.id} className={`opponent-seat ${positions[index]}${visibleEffect?.actionType === 'start' ? ' deal-seat' : ''}${player.id === game.currentPlayerId ? ' is-current' : ''}${!player.online ? ' seat-offline' : ''}`} key={player.id} style={{ '--deal-index': index } as React.CSSProperties}>
          <span className={`avatar avatar-${index % 4}`}>{player.nickname.slice(0, 1).toUpperCase()}</span><span className="opponent-meta"><strong>{player.nickname}</strong><small>{player.cardCount} lá · {player.online ? 'Đã kết nối' : 'Mất kết nối'}</small></span>{player.id === game.currentPlayerId && <span className="current-turn-badge">Đang lượt</span>}{visibleEffect?.card?.type === 'skip' && visibleEffect.targetId === player.id && <span className="skip-callout" aria-hidden="true">Bỏ lượt</span>}{isHost && <button className="kick-opponent" type="button" aria-label={`Mời ${player.nickname} ra khỏi phòng`} onClick={() => { const warning = snapshot.phase === 'playing' ? `Mời ${player.nickname} ra sẽ hủy ván hiện tại. Tiếp tục?` : `Mời ${player.nickname} ra khỏi phòng?`; if (window.confirm(warning)) void onCommand('room:kick', { targetPlayerId: player.id }); }}>×</button>}
        </div>)}</div>
        <div className={`felt-table table-color-${game.currentColor ?? "wild"}`}>
          <span ref={feltSurfaceRef} className="felt-surface-art" aria-hidden="true"><span className="felt-ring ring-one" /><span className="felt-ring ring-two" /></span>
          <div className="felt-scene-impact">
          <div className="turn-banner" tabIndex={-1}><span className={`turn-dot${!connected || snapshot.paused ? ' offline' : ''}`} />{game.phase === 'finished' ? 'Ván đã kết thúc' : snapshot.paused ? 'Chờ người chơi kết nối lại' : game.phase === 'chooseColor' ? `${startLabel} chọn màu mở đầu` : myTurn ? 'Tới lượt bạn' : game.phase === 'penalty' ? `${startLabel} đang xử lý phạt` : `Đang tới lượt ${startLabel}`}</div>
          <div className="pile-row">
            <div className="pile-column"><span className="pile-caption">CHỒNG RÚT</span><button className={`card-back${myTurn && game.allowedActions.canDraw && noPlayableCards ? " draw-attention" : ""}`} type="button" aria-label="Rút một lá" disabled={!myTurn || game.phase !== 'turn' || busy || !connected} onClick={() => void onAction({ type: 'draw' })}><span ref={drawVisualRef} className="card-back-visual" aria-hidden="true"><span className="card-back-oval"><b>B</b></span></span></button><span className="pile-count">{game.drawCount} lá</span></div>
            <span className="pile-arrow" aria-label={game.direction === 1 ? 'Chiều kim đồng hồ' : 'Ngược chiều kim đồng hồ'}>{game.direction === 1 ? '↻' : '↺'}</span>
            <div className="pile-column"><span className="pile-caption">LÁ BỎ</span><div ref={discardRef} className="played-card-shell" style={{ visibility: flight && visibleEffect && flight.key === visibleEffect.eventId ? 'hidden' : 'visible' }}><>{game.topCard ? <CardArt face={liveCardFace(game.topCard)} color={game.topCard.color} /> : <span className="empty-discard">Chờ lá đầu</span>}</></div><span className="pile-count">Màu hiện tại: <b className={`current-color${game.currentColor ? ` color-text-${game.currentColor}` : ''}`}>{game.currentColor ? colorNames[game.currentColor] : 'Chưa mở bàn'}</b></span></div>
          </div>
          <div className={`turn-direction${visibleEffect?.card?.type === 'reverse' ? ' direction-change' : ''}`}><span>{game.direction === 1 ? '↻' : '↺'}</span><b>{game.direction === 1 ? 'Chiều kim đồng hồ' : 'Ngược chiều kim đồng hồ'}</b></div>
          </div>
          <div className="action-tray" aria-live="polite">
            {effectLabel && <span key={visibleEffect?.eventId} className="tray-event">{effectLabel}{(visibleEffect?.drawnCount ?? 0) > 1 ? ` · ${visibleEffect!.drawnCount} lá` : ''}</span>}
            {game.pendingPenalty && <div className="tray-summary">Tổng phạt <b>{game.pendingPenalty.total} lá</b> · {game.pendingPenalty.lastType === 'drawTwo' ? 'Cộng +2 hoặc +4' : 'Chỉ cộng +4'}</div>}
            <div className="tray-actions">
              {game.phase === 'drawn' && myTurn && <><span>Bạn vừa rút một lá · Có thể đánh hoặc giữ</span><button className="button button-secondary button-small" disabled={busy || !connected} onClick={() => void onAction({ type: 'keep' })}>Giữ lá</button></>}
              {mustAccept && <><span>{noPlayableCards ? 'Không có lá cộng phù hợp.' : 'Cộng tiếp hoặc nhận phạt'} Nhận {game.pendingPenalty!.total} lá</span><button className="button button-primary button-small" disabled={busy || !connected || snapshot.paused} onClick={() => void onAction({ type: 'acceptPenalty' })}>Nhận bài</button></>}
              {canCatch && <><span>Có người quên hô UNO.</span><button className="button button-coral button-small" disabled={busy || !connected || snapshot.paused} onClick={() => void onAction({ type: 'catchUno', targetPlayerId: game.unoWindow!.playerId })}>Bắt UNO</button></>}
              {game.unoWindow?.playerId === playerId && <><span>Còn một lá trên tay. Hãy hô UNO.</span><button className="button button-coral button-small" disabled={busy || !connected || snapshot.paused} onClick={() => void onAction({ type: 'declareUno' })}>UNO!</button></>}
              {!mustAccept && !canCatch && game.unoWindow?.playerId !== playerId && game.phase !== 'drawn' && <span className="tray-idle">{myTurn ? 'Chọn một lá hoặc rút bài' : connected ? `Đang chờ lượt ${startLabel}` : 'Đang kết nối lại…'}</span>}
            </div>
          </div>
          {game.phase === 'drawn' && myTurn && <div className="action-status-card drawn-card-prompt"><span className="action-status-icon">+1</span><div><strong>Bạn vừa rút một lá</strong><small>Đánh lá vừa rút nếu muốn, hoặc giữ để kết thúc lượt.</small></div><button className="button button-secondary button-small" type="button" disabled={busy} onClick={() => void onAction({ type: 'keep' })}>Giữ lá</button></div>}
          {game.pendingPenalty && <div className="penalty-summary" role="status">Tổng phạt: <b>{game.pendingPenalty.total} lá</b> · {game.pendingPenalty.pendingWinnerId ? 'Lá cuối: không cộng tiếp' : game.pendingPenalty.lastType === 'drawTwo' ? 'Được cộng +2 hoặc +4' : 'Chỉ được cộng +4'}</div>}
          {mustAccept && <div className="action-status-card penalty-card"><span className="action-status-icon">+{game.pendingPenalty!.total}</span><div><strong>{noPlayableCards ? 'Bạn cần nhận phạt' : 'Cộng tiếp hoặc nhận phạt'}</strong><small>{game.pendingPenalty!.pendingWinnerId ? 'Nhận đủ bài để kết thúc ván.' : noPlayableCards ? 'Không có lá cộng phù hợp.' : 'Chọn lá sáng hoặc nhận toàn bộ khoản phạt.'}</small></div><button className="button button-primary button-small" type="button" disabled={busy || !connected || snapshot.paused} onClick={() => void onAction({ type: 'acceptPenalty' })}>Nhận {game.pendingPenalty!.total} lá</button></div>}
          {canCatch && <div className="uno-catch-prompt"><span><b>UNO?</b> Có người quên hô UNO.</span><button className="button button-coral button-small" type="button" disabled={busy || !connected || snapshot.paused} onClick={() => void onAction({ type: 'catchUno', targetPlayerId: game.unoWindow!.playerId })}>Bắt lỗi UNO</button></div>}
          {game.unoWindow?.playerId === playerId && <div className="uno-catch-prompt"><span><b>Còn một lá!</b> Hãy hô UNO trước khi lượt kế tiếp bắt đầu.</span><button className="button button-coral button-small" type="button" disabled={busy || !connected || snapshot.paused} onClick={() => void onAction({ type: 'declareUno' })}>UNO!</button></div>}
          {game.phase === 'finished' && <div className={`result-card${visibleEffect?.winnerId ? ' effect-finish' : ''}`}><span className="result-spark"><Icon name="spark" size={26} /></span><p className="eyebrow">VÁN ĐÃ KẾT THÚC</p><h2>{game.winnerId ? `${game.players.find((player) => player.id === game.winnerId)?.nickname ?? 'Người chơi'} thắng ván này!` : 'Ván kết thúc vì không còn đủ bài để rút.'}</h2><p>{game.finishReason === 'stalemate' ? 'Không xác định người thắng theo trạng thái bài còn lại.' : 'Chơi lại trong cùng phòng khi mọi người đã sẵn sàng.'}</p>{me?.isHost ? <button className="button button-primary button-small" type="button" disabled={busy || !connected || snapshot.paused} onClick={() => void onCommand('room:rematch')}>Chơi lại</button> : <span className="turn-hint">Chờ chủ phòng chọn chơi lại.</span>}</div>}
        </div>
        <section className={`my-hand${visibleEffect?.actionType === 'start' ? ' deal-hand' : ''}`} aria-label="Bài của bạn">
          <div className="hand-heading" data-player-id={playerId}><div><span className="avatar avatar-you hand-avatar">{nickname.slice(0, 1).toUpperCase()}</span><strong>{nickname}</strong><span className="your-hand-label">BÀI CỦA BẠN</span></div><span className="hand-count">{game.hand.length} lá</span></div>
          <div ref={handCardsRef} className="hand-cards" onScroll={() => { if (isMobile) { setSelectedMobileCardId(null); resetHandBaseline(); } }}>{game.hand.map((card) => {
            const isDrawn = game.drawnCardId === card.id;
            const interactable = myTurn && game.allowedActions.playableCardIds.includes(card.id) && !busy && connected;
            const highlight = interactable;
            const selected = selectedMobileCardId === card.id && interactable;
            const raised = selected || (!isMobile && isDrawn);
            return <button data-card-id={card.id} key={card.id} className={`hand-card${highlight ? ' is-playable' : ''}${raised ? ' is-selected' : ''}${isDrawn ? ' is-drawn-card' : ''}${isDrawn && visibleEffect?.actionType === 'draw' && visibleEffect.actorId === playerId ? ' card-drawn-in' : ''}${!interactable ? ' is-disabled' : ''}`} type="button" aria-pressed={isMobile ? selected : undefined} aria-label={`Đánh ${liveCardName(card)}${highlight ? ', có thể đánh' : ', chưa thể đánh'}${isDrawn ? ', vừa rút' : ''}${isMobile && selected ? ', đã chọn, chạm lần nữa để đánh' : ''}`} disabled={!interactable} onClick={() => chooseCard(card)}><CardArt face={liveCardFace(card)} color={card.color} /><span className="card-label">{liveCardName(card)}</span></button>;
          })}</div>
          <div className="hand-actions">{game.phase === 'turn' && myTurn && <><span className="turn-hint">{selectedMobileCardId ? `Đã chọn ${liveCardName(game.hand.find((card) => card.id === selectedMobileCardId)!)} · chạm lần nữa để đánh` : noPlayableCards ? 'Không có lá phù hợp — hãy rút bài' : isMobile ? 'Chạm một lá để chọn' : 'Chọn lá phù hợp để đánh'}</span><button className={`button button-secondary${noPlayableCards ? " draw-attention" : ""}`} type="button" disabled={busy || !connected || snapshot.paused} onClick={() => void onAction({ type: 'draw' })}>Rút bài</button></>}{game.phase === 'drawn' && myTurn && <span className="turn-hint">{selectedMobileCardId ? 'Chạm lại lá đang nâng để đánh' : 'Đánh lá vừa rút hoặc giữ lượt'}</span>}{game.phase === 'penalty' && myTurn && <span className="turn-hint">{selectedMobileCardId ? 'Chạm lại lá đang nâng để đánh' : 'Chạm lá cộng phù hợp để chọn'}</span>}{!myTurn && game.phase !== 'finished' && <span className="turn-hint"><span className="waiting-dots"><i /><i /><i /></span>{connected ? 'Đang chờ tới lượt bạn' : 'Đang kết nối lại…'}</span>}{game.phase === 'finished' && <button className="button button-quiet" type="button" onClick={onLeave}>Rời phòng</button>}</div>
        </section>
      </section>
      {flight && <div ref={flightRef} key={flight.key} className="flying-played-card" aria-hidden="true" style={{ left: flight.from.left, top: flight.from.top, width: flight.from.width, height: flight.from.height }}><CardArt face={flight.face} color={flight.color} /></div>}
      <aside className="table-aside"><div className="aside-panel"><p className="eyebrow">TRẠNG THÁI</p><div className="aside-state"><span className={`aside-state-icon ${game.phase === 'finished' ? 'state-icon-finished' : ''}`}><Icon name={game.phase === 'finished' ? 'spark' : 'info'} size={18} /></span><div><strong>{game.phase === 'finished' ? 'Kết thúc ván' : game.phase === 'chooseColor' ? `Chọn màu · ${startLabel}` : myTurn ? 'Tới lượt bạn' : `Lượt ${startLabel}`}</strong><small>{game.phase === 'drawn' ? 'Đánh lá vừa rút hoặc giữ' : game.phase === 'penalty' ? `Đang phạt ${game.pendingPenalty?.total ?? 0} lá` : game.phase === 'chooseColor' ? 'Lá Wild mở đầu' : 'Nước đi được máy chủ xác thực'}</small></div></div><div className="aside-divider" /><p className="eyebrow">MÀU HIỆN TẠI</p><div className="active-color"><span className={`color-dot ${game.currentColor ? `dot-${game.currentColor}` : 'dot-wild'}`} />{game.currentColor ? colorNames[game.currentColor] : 'Chưa mở bàn'}</div><div className="aside-divider" />{setting}<div className="aside-divider" /><button className="rules-mini" type="button" onClick={onRules}><span className="rules-mini-icon"><Icon name="rules" size={17} /></span><span><strong>Luật UNO</strong><small>Mở bản tóm tắt</small></span><Icon name="chevron" size={16} /></button></div></aside>
    </div>
    {(wildCard || openingColorChoice) && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && wildCard) cancelWildChoice(); }}><section ref={colorDialogRef} className="modal-card color-modal" role="dialog" aria-modal="true" aria-labelledby="choose-color-title" onKeyDown={(event) => { keepFocusInside(event); if (event.key === 'Escape' && wildCard) cancelWildChoice(); }}>{wildCard && <button className="icon-button modal-close" type="button" aria-label="Đóng" onClick={cancelWildChoice}><Icon name="close" /></button>}<p className="eyebrow">{wildCard ? `LÁ ${liveCardName(wildCard).toUpperCase()}` : 'LÁ WILD MỞ ĐẦU'}</p><h2 id="choose-color-title">{wildCard ? 'Chọn màu tiếp theo' : 'Người đi trước chọn màu'}</h2><div className="color-picker-options">{(['red', 'yellow', 'green', 'blue'] as const).map((color) => <button className={`color-choice color-${color}`} key={color} type="button" disabled={busy || !connected || snapshot.paused} aria-label={colorNames[color]} onClick={() => wildCard ? sendPlay(wildCard, color) : void onAction({ type: 'chooseColor', color })}><span>{colorNames[color]}</span></button>)}</div></section></div>}
  </div>;
}

const colorNames: Record<Exclude<UnoColor, 'wild'>, string> = { red: 'Đỏ', yellow: 'Vàng', green: 'Xanh lá', blue: 'Xanh dương' };

function StateTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button className={`state-tab${active ? ' active' : ''}`} type="button" aria-pressed={active} onClick={onClick}>{children}</button>;
}

export default App;
