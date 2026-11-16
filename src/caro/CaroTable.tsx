import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { RoomSnapshot } from '@banban/shared';
import PlayerAvatar from '../components/PlayerAvatar';
import type { CaroActionIntent, RoomCommandInput } from '../api/realtime';
import { playSound } from '../audio/soundEffects';

type CaroSnapshot = Extract<RoomSnapshot, { gameKey: 'caro' }>;
type Props = {
  snapshot: CaroSnapshot;
  playerId: string;
  connected: boolean;
  busy: boolean;
  onAction: (action: CaroActionIntent) => Promise<{ ok: boolean; message?: string }>;
  onCommand: (command: RoomCommandInput) => Promise<{ ok: boolean; message?: string }>;
  onLeave: () => void;
  onRules: () => void;
};

const indexAt = (row: number, col: number, size: number) => row * size + col;

export default function CaroTable({ snapshot, playerId, connected, busy, onAction, onCommand, onLeave, onRules }: Props) {
  const game = snapshot.game;
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [keyboardCell, setKeyboardCell] = useState(112);
  const [confirmResign, setConfirmResign] = useState(false);
  const [timerNow, setTimerNow] = useState(Date.now());
  const resignRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const serverOffsetRef = useRef(0);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const suppressClickRef = useRef(false);
  const lastMoveSoundRef = useRef<string | null>(null);

  useEffect(() => {
    if (!game || game.phase !== 'turn' || snapshot.paused) return;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [game?.gameId, game?.turnId, game?.phase, game?.deadlineAt, snapshot.paused]);
  useEffect(() => { if (game) serverOffsetRef.current = game.serverNow - Date.now(); }, [game?.gameId, game?.revision, game?.serverNow]);
  useEffect(() => {
    if (!game?.lastMove) { lastMoveSoundRef.current = null; return; }
    const moveKey = `${game.gameId}:${game.lastMove.row}:${game.lastMove.col}:${game.lastMove.symbol}`;
    if (lastMoveSoundRef.current !== null && lastMoveSoundRef.current !== moveKey) playSound('mark');
    lastMoveSoundRef.current = moveKey;
  }, [game?.gameId, game?.lastMove?.row, game?.lastMove?.col, game?.lastMove?.symbol]);
  useEffect(() => {
    if (!confirmResign) return;
    cancelRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setConfirmResign(false); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); resignRef.current?.focus(); };
  }, [confirmResign]);
  useEffect(() => { setSelected(null); setZoom(1); cellRefs.current = []; }, [game?.gameId, game?.turnId, game?.boardSize, connected, snapshot.paused]);

  const size = game?.boardSize ?? 15;
  const center = (size - 1) / 2;
  const winningIndexes = useMemo(() => new Set(game?.winningLines.flatMap((line) => line.map(({ row, col }) => indexAt(row, col, size))) ?? []), [game?.winningLines, size]);
  const focusCell = game?.legalCellIndexes.includes(keyboardCell) ? keyboardCell : game?.legalCellIndexes.reduce((nearest, index) => {
    const distance = Math.abs(Math.floor(index / size) - center) + Math.abs(index % size - center);
    const bestDistance = Math.abs(Math.floor(nearest / size) - center) + Math.abs(nearest % size - center);
    return distance < bestDistance ? index : nearest;
  }, game.legalCellIndexes[0] ?? Math.floor(size * size / 2)) ?? Math.floor(size * size / 2);
  const currentPlayer = game?.players.find((player) => player.id === game.currentPlayerId);
  const me = snapshot.players.find((player) => player.id === playerId);
  const winner = game?.players.find((player) => player.id === game.winnerId);
  const remainingMs = game?.deadlineAt !== null && game?.deadlineAt !== undefined
    ? Math.max(0, game.deadlineAt - (timerNow + serverOffsetRef.current))
    : game?.remainingMs ?? null;
  const timeRatio = game && remainingMs !== null ? Math.max(0, Math.min(1, remainingMs / game.turnDurationMs)) : 0;
  const yourTurn = Boolean(game?.canPlace && connected && !snapshot.paused && !busy);

  async function submitMove(index: number) {
    if (!game || !yourTurn || !game.legalCellIndexes.includes(index)) return;
    if (selected !== index) { playSound('tap'); setSelected(index); return; }
    const reply = await onAction({ type: 'place', row: Math.floor(index / size), col: index % size, turnId: game.turnId });
    if (reply.ok) setSelected(null);
  }
  function navigateBoard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Escape' && selected !== null) { event.preventDefault(); setSelected(null); return; }
    const delta = event.key === 'ArrowUp' ? [-1, 0] : event.key === 'ArrowDown' ? [1, 0] : event.key === 'ArrowLeft' ? [0, -1] : event.key === 'ArrowRight' ? [0, 1] : null;
    if (!delta || !game) return;
    event.preventDefault();
    let row = Math.floor(index / size) + delta[0]!;
    let col = index % size + delta[1]!;
    while (row >= 0 && row < size && col >= 0 && col < size) {
      const nextIndex = indexAt(row, col, size);
      if (game.legalCellIndexes.includes(nextIndex)) {
        setKeyboardCell(nextIndex);
        window.requestAnimationFrame(() => cellRefs.current[nextIndex]?.focus());
        return;
      }
      row += delta[0]!; col += delta[1]!;
    }
  }
  function trackPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || activePointersRef.current.size > 0) {
      suppressClickRef.current = true; activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); setSelected(null); return;
    }
    suppressClickRef.current = false;
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }
  function trackPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = activePointersRef.current.get(event.pointerId);
    if (!start || suppressClickRef.current) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 9) { suppressClickRef.current = true; setSelected(null); }
  }
  function trackPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(event.pointerId);
  }
  function activateCell(index: number) {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    setKeyboardCell(index);
    void submitMove(index);
  }
  async function resign() {
    if (!game || !game.canResign || busy || !connected) return;
    const reply = await onAction({ type: 'resign' });
    if (reply.ok) { setConfirmResign(false); setSelected(null); }
  }

  function containDialogFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')];
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  if (!game) return <div className="page caro-page"><div className="caro-loading" role="status">Đang chờ máy chủ mở bàn Caro…</div></div>;

  return <div className="page caro-page">
    <div className="caro-topline">
      <button className="back-link" type="button" onClick={onLeave}>← Rời bàn</button>
      <div className="caro-room-title"><strong>CARO</strong><span>PHÒNG {snapshot.code}</span><button type="button" onClick={onRules}>Luật chơi</button></div>
      <span className={`caro-connection${connected ? '' : ' is-offline'}`}><i />{connected ? 'Đã kết nối' : 'Đang kết nối lại'}</span>
    </div>
    {snapshot.notice && <div className="room-notice caro-room-notice" role="status">{snapshot.notice}</div>}
    {(!connected || snapshot.paused) && <div className="caro-pause-banner" role="status"><strong>{connected ? 'Ván đang tạm dừng' : 'Mất kết nối'}</strong><span>{connected ? 'Đang chờ người chơi kết nối lại; thời gian lượt được giữ.' : 'Đang thử kết nối lại với phòng…'}</span></div>}
    <section className="caro-match-card" aria-label="Trận Caro">
      <div className="caro-player-strip">
        {game.players.map((player) => {
          const seat = snapshot.players.find((item) => item.id === player.id);
          return <div key={player.id} className={`caro-player${game.currentPlayerId === player.id && game.phase === 'turn' ? ' is-current' : ''}${seat?.online ? '' : ' is-offline'}`}>
            <PlayerAvatar id={seat?.avatarId ?? 0} />
            <div className="caro-player-copy"><strong>{player.nickname}{player.id === playerId ? ' · Bạn' : ''}</strong><small>{seat?.online ? player.id === game.currentPlayerId && game.phase === 'turn' ? 'Đang tới lượt' : 'Đang chơi' : 'Mất kết nối'}</small></div>
            <span className={`caro-symbol-badge symbol-${player.symbol.toLowerCase()}`}>{player.symbol}</span>
          </div>;
        })}
      </div>
      <div className="caro-status-row">
        {game.phase === 'finished' ? <div className="caro-result" aria-live="polite"><span>VÁN ĐÃ KẾT THÚC</span><strong>{winner ? <><b>{winner.nickname}</b> thắng ván này!</> : 'Ván hòa'}</strong><small>{game.finishReason === 'five' ? `Nối đúng ${game.winLength} quân còn đầu mở.` : game.finishReason === 'timeout' ? 'Hết thời gian lượt.' : game.finishReason === 'resign' ? 'Một người chơi đã chịu thua.' : 'Bàn cờ đã kín.'}</small>{snapshot.match?.status === 'finished' && me?.isHost && <button className="button button-primary" type="button" disabled={busy || !connected} onClick={() => void onCommand({ event: 'room:rematch' })}>Trận mới</button>}</div> : <>
          <div className="caro-turn-state" aria-live="polite"><i />{snapshot.paused ? 'Đang chờ kết nối lại' : currentPlayer ? `Đang tới lượt ${currentPlayer.nickname}${currentPlayer.id === playerId ? ' · Bạn' : ''}` : 'Đang chơi'}</div>
          <div className={`caro-clock${remainingMs !== null && remainingMs <= 5_000 ? ' is-urgent' : ''}`} role="timer" aria-live="off" aria-label={`Còn ${Math.ceil((remainingMs ?? 0) / 1000)} giây`}><span>{Math.ceil((remainingMs ?? 0) / 1000)}s</span><div><i style={{ transform: `scaleX(${timeRatio})` }} /></div></div>
        </>}
      </div>
      <div className="caro-board-toolbar">
        <span>{`Nối ${game.winLength} · Bàn ${size} × ${size}`}{me?.isYou ? ` · Bạn cầm ${game.players.find((player) => player.id === playerId)?.symbol ?? '—'}` : ''}</span>
        <div className="caro-zoom-controls" role="group" aria-label="Thu phóng bàn cờ">
          <button type="button" aria-label="Thu nhỏ bàn cờ" disabled={zoom === 1} onClick={() => setZoom(1)}>−</button>
          <span>{zoom}×</span>
          <button type="button" aria-label="Phóng to bàn cờ" disabled={zoom === 2} onClick={() => setZoom(2)}>＋</button>
          {zoom === 2 && <button type="button" className="caro-reset-zoom" onClick={(event) => { setZoom(1); event.currentTarget.blur(); }}>Toàn bàn</button>}
        </div>
      </div>
      <div className={`caro-board-viewport${zoom === 2 ? ' is-zoomed' : ''}`} role="region" tabIndex={0} aria-label={zoom === 2 ? 'Bàn cờ phóng to; kéo để di chuyển' : `Bàn cờ Caro ${size} nhân ${size}`} onPointerDown={trackPointerDown} onPointerMove={trackPointerMove} onPointerUp={trackPointerEnd} onPointerCancel={(event) => { trackPointerEnd(event); suppressClickRef.current = true; setSelected(null); }}>
        <div className={`caro-grid${zoom === 2 ? ' is-zoomed' : ''}`} style={{ '--caro-size': size, '--caro-grid-zoom': `${Math.max(660, size * 42)}px` } as React.CSSProperties} role="group" aria-label={`Bàn cờ ${size} hàng, ${size} cột`} aria-describedby="caro-keyboard-help">
          <span id="caro-keyboard-help" className="sr-only">Dùng phím mũi tên để chuyển giữa các ô trống. Kích hoạt ô một lần để chọn, kích hoạt lại cùng ô để đánh. Nhấn Escape để hủy chọn.</span>
          {game.board.map((symbol, index) => {
            const row = Math.floor(index / size); const col = index % size;
            const isLegal = game.legalCellIndexes.includes(index);
            const isSelected = selected === index;
            const isLast = game.lastMove?.row === row && game.lastMove.col === col;
            const isWinning = winningIndexes.has(index);
            const mark = symbol ?? (isSelected ? game.yourSymbol : null);
            return <button
              key={index}
              ref={(element) => { cellRefs.current[index] = element; }}
              type="button"
              className={`caro-cell${symbol ? ' has-mark' : ''}${isLast ? ' is-last' : ''}${isWinning ? ' is-winning' : ''}${isSelected ? ' is-selected' : ''}${isLegal && yourTurn && !symbol ? ' is-playable' : ''}`}
              aria-label={`Hàng ${row + 1}, cột ${col + 1}, ${symbol ? `quân ${symbol}` : isSelected ? `đang chọn quân ${game.yourSymbol}` : 'ô trống'}`}
              aria-pressed={isSelected}
              tabIndex={isLegal && yourTurn && index !== focusCell ? -1 : undefined}
              disabled={!isLegal || !yourTurn || Boolean(symbol)}
              onFocus={() => setKeyboardCell(index)}
              onKeyDown={(event) => navigateBoard(event, index)}
              onClick={() => activateCell(index)}
            >{mark && <span className={`caro-mark mark-${mark.toLowerCase()}`}>{mark}</span>}</button>;
          })}
        </div>
      </div>
      <div className="caro-action-dock">
        <div className="caro-move-hint" role="status">{!connected ? 'Đang nối lại…' : snapshot.paused ? 'Chờ người chơi quay lại.' : game.phase === 'finished' ? 'Ván đã kết thúc.' : game.canPlace ? selected === null ? `Chọn ô trống một lần, chạm lại cùng ô để đánh quân ${game.yourSymbol}.` : `Đã chọn hàng ${Math.floor(selected / size) + 1}, cột ${selected % size}. Chạm lại để xác nhận.` : `Đang chờ ${currentPlayer?.nickname ?? 'đối thủ'} đánh.`}</div>
        {game.phase === 'turn' && <div className="caro-action-buttons">
          {game.canResign && <button ref={resignRef} className="button button-quiet caro-resign" type="button" disabled={busy || !connected || snapshot.paused} onClick={() => setConfirmResign(true)}>Chịu thua</button>}
        </div>}
      </div>
    </section>
    {confirmResign && <div className="modal-backdrop caro-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmResign(false); }}>
      <section className="modal-card caro-resign-dialog" role="dialog" aria-modal="true" aria-labelledby="caro-resign-title" onKeyDown={containDialogFocus}>
        <p className="eyebrow">KẾT THÚC VÁN</p><h2 id="caro-resign-title">Chịu thua ván này?</h2><p>Đối thủ sẽ được tính là người thắng. Bạn không thể hoàn tác sau khi xác nhận.</p>
        <div className="caro-dialog-actions"><button ref={cancelRef} className="button button-secondary" type="button" onClick={() => setConfirmResign(false)}>Tiếp tục chơi</button><button className="button caro-resign-confirm" type="button" disabled={busy} onClick={() => void resign()}>Xác nhận chịu thua</button></div>
      </section>
    </div>}
  </div>;
}
