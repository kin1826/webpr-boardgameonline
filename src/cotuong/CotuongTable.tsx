import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CotuongFinishReason, CotuongPiece, CotuongPoint, CotuongPublicGame, CotuongRole, CotuongSide } from '@banban/cotuong';
import PlayerAvatar from '../components/PlayerAvatar';
import { playSound, unlockSoundEffects } from '../audio/soundEffects';
import { getCotuongBoardGeometry } from './boardGeometry';
import './cotuong.css';

const roleNames: Record<CotuongRole, string> = { general: 'Tướng', advisor: 'Sĩ', elephant: 'Tượng', chariot: 'Xe', horse: 'Mã', cannon: 'Pháo', soldier: 'Tốt' };
const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const finishReasonLabels: Record<CotuongFinishReason, string> = {
  checkmate: 'Chiếu bí',
  stalemate: 'Hết nước đi hợp lệ',
  'perpetual-check': 'Thua do lặp chiếu',
  repetition: 'Hòa do lặp thế cờ',
  'no-attacking-material': 'Hòa do không còn quân tấn công',
  'no-capture-limit': 'Hòa sau 120 nước không bắt quân',
  timeout: 'Hết giờ',
  resign: 'Xin thua',
  'draw-agreement': 'Hai bên đồng ý hòa',
};

function TraditionalPiece({ piece, selected = false }: { piece: CotuongPiece; selected?: boolean }) {
  return <img className={`cotuong-piece-art ${piece.side}${selected ? ' is-selected' : ''}`} src={`/assets/cotuong/pieces/${piece.side}-${piece.role}.svg`} alt="" draggable={false} />;
}

export type CotuongActionIntent =
  | { type: 'move'; from: CotuongPoint; to: CotuongPoint; turnId: string }
  | { type: 'offerDraw'; turnId: string }
  | { type: 'respondDraw'; offerId: string; accept: boolean }
  | { type: 'resign' };

type Props = {
  game: CotuongPublicGame;
  avatars: Record<CotuongSide, number>;
  local?: boolean;
  roomCode?: string;
  connected: boolean;
  busy: boolean;
  onAction: (action: CotuongActionIntent) => void;
  onLeave: () => void;
  onRematch?: () => void;
  onBackHome?: () => void;
};

export default function CotuongTable({ game, avatars, local = false, roomCode, connected, busy, onAction, onLeave, onRematch }: Props) {
  const [selected, setSelected] = useState<CotuongPoint | null>(null);
  const [message, setMessage] = useState('Chọn quân của bạn rồi chọn điểm đến.');
  const [confirmResign, setConfirmResign] = useState(false);
  const [now, setNow] = useState(() => performance.now());
  const [localResponseReady, setLocalResponseReady] = useState(false);
  const [capturedVisual, setCapturedVisual] = useState<null | { moveKey: string; piece: CotuongPiece; row: number; col: number; fading: boolean }>(null);
  const [captureImpact, setCaptureImpact] = useState(false);
  const clockAnchorRef = useRef({ serverNow: game.clock?.serverNow ?? 0, performanceNow: performance.now() });
  const boardRef = useRef<HTMLDivElement | null>(null);
  const previousBoardRef = useRef(game.board);
  const previousMoveKeyRef = useRef(`${game.gameId}:${game.lastMove?.ply ?? 0}`);
  const currentMoveKeyRef = useRef(previousMoveKeyRef.current);
  const previousPieceRectsRef = useRef(new Map<string, DOMRect>());
  const animationsRef = useRef(new Set<Animation>());
  const captureTimersRef = useRef<number[]>([]);
  currentMoveKeyRef.current = `${game.gameId}:${game.lastMove?.ply ?? 0}`;
  const previousPhaseRef = useRef(game.phase);
  useEffect(() => { const timer = window.setInterval(() => setNow(performance.now()), 200); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (game.clock) clockAnchorRef.current = { serverNow: game.clock.serverNow, performanceNow: performance.now() };
  }, [game.clock?.serverNow, game.gameId]);
  useEffect(() => { setSelected(null); setMessage(game.notice || 'Chọn quân của bạn rồi chọn điểm đến.'); }, [game.gameId, game.revision, game.currentSide, game.phase]);
  useLayoutEffect(() => {
    const moveKey = `${game.gameId}:${game.lastMove?.ply ?? 0}`;
    const previousMoveKey = previousMoveKeyRef.current;
    const previousGameId = previousMoveKey.slice(0, previousMoveKey.lastIndexOf(':'));
    const hasConfirmedMove = previousGameId === game.gameId && Boolean(game.lastMove) && previousMoveKey !== moveKey;
    const previousBoard = previousBoardRef.current;
    const currentPieces = boardRef.current?.querySelectorAll<HTMLElement>('[data-piece-id]') ?? [];
    const rects = new Map<string, DOMRect>();
    currentPieces.forEach((element) => {
      const id = element.dataset.pieceId;
      if (id) rects.set(id, element.getBoundingClientRect());
    });

    if (hasConfirmedMove && game.lastMove) {
      const movingPiece = game.board[game.lastMove.to.row * 9 + game.lastMove.to.col];
      const capturedPiece = game.lastMove.captured ? previousBoard[game.lastMove.to.row * 9 + game.lastMove.to.col] : null;
      const movingElement = movingPiece ? [...currentPieces].find((element) => element.dataset.pieceId === movingPiece.id) ?? null : null;
      const fromRect = movingPiece ? previousPieceRectsRef.current.get(movingPiece.id) : null;
      const toRect = movingPiece ? rects.get(movingPiece.id) : null;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

      if (capturedPiece && !reduceMotion) setCapturedVisual({ moveKey, piece: capturedPiece, row: game.lastMove.to.row, col: game.lastMove.to.col, fading: false });
      else setCapturedVisual(null);

      const finishMovePresentation = () => {
        if (currentMoveKeyRef.current !== moveKey) return;
        if (capturedPiece) {
          playSound('cotuong-capture');
          if (!reduceMotion) {
            setCapturedVisual((current) => current?.moveKey === moveKey ? { ...current, fading: true } : current);
            const fadeTimer = window.setTimeout(() => setCapturedVisual((current) => current?.moveKey === moveKey ? null : current), 130);
            captureTimersRef.current.push(fadeTimer);
            setCaptureImpact(true);
            const impactTimer = window.setTimeout(() => setCaptureImpact(false), 190);
            captureTimersRef.current.push(impactTimer);
          }
        } else playSound('cotuong-move');
        if (game.phase === 'turn' && game.checkedSide) playSound('cotuong-check');
      };

      if (movingElement && fromRect && toRect && !reduceMotion && typeof movingElement.animate === 'function') {
        const deltaX = fromRect.left - toRect.left;
        const deltaY = fromRect.top - toRect.top;
        const distance = Math.hypot(deltaX, deltaY);
        const duration = Math.max(180, Math.min(280, 180 + distance * .08));
        const animation = movingElement.animate(
          [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: 'translate(0, 0)' }],
          { duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
        );
        animationsRef.current.add(animation);
        animation.onfinish = () => {
          animationsRef.current.delete(animation);
          animation.cancel();
          finishMovePresentation();
        };
        animation.oncancel = () => animationsRef.current.delete(animation);
      } else finishMovePresentation();
    } else if (previousGameId !== game.gameId) {
      setCapturedVisual(null);
      setCaptureImpact(false);
      previousPieceRectsRef.current.clear();
    }

    previousPieceRectsRef.current = rects;
    previousBoardRef.current = game.board;
    previousMoveKeyRef.current = moveKey;
  }, [game, game.board, game.gameId, game.lastMove?.ply]);

  useEffect(() => () => {
    animationsRef.current.forEach((animation) => animation.cancel());
    animationsRef.current.clear();
    captureTimersRef.current.forEach(window.clearTimeout);
    captureTimersRef.current = [];
  }, []);
  useEffect(() => {
    if (previousPhaseRef.current === 'turn' && game.phase === 'finished' && game.winnerSide) playSound('win');
    previousPhaseRef.current = game.phase;
  }, [game.phase, game.winnerSide]);
  useEffect(() => { setLocalResponseReady(false); }, [game.drawOffer?.id]);
  const legalTargets = useMemo(() => game.legalMoves.filter((move) => selected && move.from.row === selected.row && move.from.col === selected.col), [game.legalMoves, selected]);
  const playerBySide = useMemo(() => Object.fromEntries(game.players.map((player) => [player.side, player])) as Record<CotuongSide, CotuongPublicGame['players'][number]>, [game.players]);
  const activeSide = game.currentSide;
  const remaining = (side: CotuongSide) => {
    if (!game.clock) return null;
    if (game.clock.deadlineAt !== null && game.currentSide === side) {
      const estimatedServerNow = clockAnchorRef.current.serverNow + (now - clockAnchorRef.current.performanceNow);
      return Math.max(0, game.clock.deadlineAt - estimatedServerNow);
    }
    return game.clock.remainingMs[side];
  };
  const prettyTime = (value: number | null) => value === null ? 'Không giới hạn' : `${Math.floor(value / 60_000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}`;
  const geometry = getCotuongBoardGeometry();
  const gridStyle = { left: `${geometry.leftPercent}%`, top: `${geometry.topPercent}%`, width: `${geometry.widthPercent}%`, height: `${geometry.heightPercent}%` };
  const turnProgress = (side: CotuongSide) => game.clock ? Math.max(0, Math.min(100, (remaining(side) ?? 0) / game.clock.initialMs * 100)) : 100;
  const act = (action: CotuongActionIntent) => { setSelected(null); onAction(action); };
  const losingSide = game.winnerSide ? game.winnerSide === 'red' ? 'black' : 'red' : null;
  const losingName = losingSide ? playerBySide[losingSide]?.nickname ?? 'Đối thủ' : 'Đối thủ';
  const finishDetail = game.finishReason === 'checkmate' ? `${losingName} bị chiếu bí.`
    : game.finishReason === 'stalemate' ? `${losingName} hết nước đi hợp lệ.`
      : game.finishReason === 'perpetual-check' ? `${losingName} thua do lặp chiếu.`
        : game.finishReason === 'timeout' ? `${losingName} hết giờ.`
          : game.finishReason === 'resign' ? `${losingName} xin thua.`
            : game.finishReason ? finishReasonLabels[game.finishReason] : 'Ván cờ đã kết thúc.';

  const renderTurnEdge = (side: CotuongSide) => {
    const active = game.phase === 'turn' && game.currentSide === side;
    const paused = active && game.clock !== null && game.clock.deadlineAt === null;
    const sideName = side === 'red' ? 'Đỏ' : 'Đen';
    return <div className={`cotuong-turn-edge ${side}${active ? ' is-active' : ''}${paused ? ' is-paused' : ''}`} aria-label={`Phía quân ${sideName}${active ? ' đang tới lượt' : ''}`}>
      <span className="cotuong-turn-edge-label"><i aria-hidden="true" />{game.phase === 'finished' ? `Quân ${sideName}` : paused ? `Đồng hồ tạm dừng · ${sideName}` : active ? `Quân ${sideName} đang đi` : `Quân ${sideName}`}</span>
      <span className="cotuong-turn-track" aria-hidden="true"><span style={{ width: active ? `${turnProgress(side)}%` : '0%' }} /></span>
      {active && game.clock && <span className="sr-only">Còn {prettyTime(remaining(side))}</span>}
    </div>;
  };

  const clickPoint = (row: number, col: number) => {
    unlockSoundEffects();
    if (!game.capabilities.canMove || busy || !connected) return;
    const piece = game.board[row * 9 + col];
    if (selected && legalTargets.some((move) => move.to.row === row && move.to.col === col)) {
      act({ type: 'move', from: selected, to: { row, col }, turnId: game.turnId });
      setMessage('Đang gửi nước đi…');
      return;
    }
    if (piece?.side === activeSide) { setSelected({ row, col }); setMessage(`${roleNames[piece.role]} đã chọn. Chọn ô đến được đánh dấu.`); return; }
    setSelected(null); setMessage(piece ? 'Không thể chọn quân đối phương.' : 'Ô đó không phải nước đi hợp lệ.');
  };

  return <div className={`cotuong-page${local ? ' is-local' : ''}`}>
    <header className="cotuong-topbar">
      <button className="cotuong-back" type="button" onClick={onLeave}>← {local ? 'Thoát ván 2P' : 'Rời bàn'}</button>
      <div className="cotuong-room-label"><span className={connected ? 'connection-dot is-online' : 'connection-dot'} />{local ? 'CỜ TƯỚNG · 2P' : `CỜ TƯỚNG · ONLINE · ${roomCode ?? ''}`}</div>
      <span className={`cotuong-connection ${connected ? '' : 'is-offline'}`}>{connected ? 'Đã kết nối' : 'Đang nối lại…'}</span>
    </header>
    <section className="cotuong-players" aria-label="Người chơi và đồng hồ">
      {(['black', 'red'] as const).map((side) => {
        const player = playerBySide[side]; const clock = remaining(side);
        return <article key={side} className={`cotuong-player-card ${side === activeSide ? 'is-active' : ''} ${side}`}>
          <PlayerAvatar id={avatars[side] ?? 0} className="cotuong-player-avatar" />
          <div><strong>{player.nickname}{!local && game.viewerSide === side && <span className="cotuong-you"> · Bạn</span>}</strong><small>{local ? `${side === 'red' ? 'Người 1' : 'Người 2'} · ` : ''}{side === 'red' ? 'Quân Đỏ' : 'Quân Đen'}{side === activeSide ? ' · Đang đi' : ''}</small></div>
          <time>{prettyTime(clock)}</time>
        </article>;
      })}
    </section>
    {game.phase === 'finished' ? <section className="cotuong-finish-announcement" role="status" aria-live="assertive" aria-atomic="true">
      <p className="cotuong-finish-kicker">VÁN ĐÃ KẾT THÚC</p>
      {game.winnerSide ? <div className="cotuong-finish-winner">
        <PlayerAvatar id={avatars[game.winnerSide] ?? 0} className="cotuong-finish-avatar" />
        <div className="cotuong-finish-copy">
          <h1>{playerBySide[game.winnerSide]?.nickname ?? 'Người chơi'} thắng ván này!</h1>
          <span>Quân {game.winnerSide === 'red' ? 'Đỏ' : 'Đen'}</span>
        </div>
        {!local && game.viewerSide === game.winnerSide && <strong className="cotuong-finish-you">Bạn thắng</strong>}
      </div> : <h1 className="cotuong-finish-draw">Ván cờ hòa</h1>}
      <p className="cotuong-finish-detail">{finishDetail}</p>
    </section> : <div className="cotuong-status" aria-live="polite">{game.drawOffer ? `${playerBySide[game.drawOffer.offeredBy].nickname} đề nghị hòa` : game.checkedSide ? `${playerBySide[game.checkedSide].nickname} đang bị chiếu` : activeSide ? `Tới lượt ${playerBySide[activeSide].nickname}` : message}</div>}
    {(game.repetitionWarning || game.noCapturePlies >= 100) && game.phase === 'turn' && <p className="cotuong-rule-notice" role="status">{game.noCapturePlies >= 100 ? `Đã ${game.noCapturePlies} nước liên tiếp không bắt quân; hòa ở mốc 120.` : `Thế cờ đã lặp ${game.repetitionCount} lần; lần thứ tư sẽ được phân xử.`}</p>}
    {!connected && !local && <p className="cotuong-reconnect" role="status">Mất kết nối. Bàn cờ tạm dừng; đang thử nối lại phiên của bạn.</p>}
    <section className="cotuong-board-stage" aria-label="Bàn cờ tướng">
      {renderTurnEdge('black')}
      <div className="cotuong-board-wrap">
      <div ref={boardRef} className={`cotuong-board${captureImpact ? ' is-capture-impact' : ''}`} data-active-side={activeSide ?? 'none'}>
        <svg className="cotuong-lines" viewBox="0 0 800 900" preserveAspectRatio="none" aria-hidden="true">
          {[...Array(9)].map((_, col) => <path key={`v${col}`} d={col === 0 || col === 8 ? `M${50 + col * 87.5} 50V850` : `M${50 + col * 87.5} 50V405 M${50 + col * 87.5} 495V850`} />)}
          {[...Array(10)].map((_, row) => <path key={`h${row}`} d={`M50 ${50 + row * (800 / 9)}H750`} />)}
          <path d="M312.5 50l175 177 M487.5 50l-175 177 M312.5 673l175 177 M487.5 673l-175 177" />
          <rect x="50" y="50" width="700" height="800" />
        </svg>
        <div className="cotuong-river" aria-hidden="true"><span>SỞ HÀ</span><i /> <span>HÁN GIỚI</span></div>
        <div className="cotuong-coordinate top" aria-hidden="true">{files.map((file) => <span key={file}>{file}</span>)}</div>
        <div className="cotuong-coordinate bottom" aria-hidden="true">{files.map((file) => <span key={file}>{file}</span>)}</div>
        <div className="cotuong-hit-grid" style={gridStyle}>
        {game.board.map((piece, index) => {
          const row = Math.floor(index / 9); const col = index % 9;
          const isSelected = selected?.row === row && selected.col === col;
          const target = legalTargets.some((move) => move.to.row === row && move.to.col === col);
          const last = game.lastMove?.to.row === row && game.lastMove.to.col === col;
          return <button key={`${row}-${col}`} type="button" className={`cotuong-point${isSelected ? ' is-selected' : ''}${target ? ' is-target' : ''}${last ? ' is-last-move' : ''}`} style={{ gridRow: row + 1, gridColumn: col + 1 }} onClick={() => clickPoint(row, col)} disabled={!game.capabilities.canMove || busy || !connected} aria-pressed={isSelected} aria-label={`Ô ${files[col]}${10 - row}${piece ? `, ${roleNames[piece.role]} ${piece.side === 'red' ? 'Đỏ' : 'Đen'}` : ''}${target ? ', nước đi hợp lệ' : ''}`}>
            {target && <span className={piece ? 'cotuong-target-ring' : 'cotuong-target-dot'} aria-hidden="true" />}
            {!target && last && <span className="cotuong-last-mark" aria-hidden="true" />}
          </button>;
        })}
        </div>
        <div className="cotuong-piece-grid" style={gridStyle} aria-hidden="true">
          {game.board.map((piece, index) => {
            if (!piece) return null;
            const row = Math.floor(index / 9); const col = index % 9;
            const isSelected = selected?.row === row && selected.col === col;
            return <div key={piece.id} className="cotuong-piece-slot" data-piece-id={piece.id} style={{ gridRow: row + 1, gridColumn: col + 1 }}>
              <TraditionalPiece piece={piece} selected={isSelected} />
            </div>;
          })}
          {capturedVisual && <div className={`cotuong-piece-slot cotuong-captured-ghost${capturedVisual.fading ? ' is-fading' : ''}`} style={{ gridRow: capturedVisual.row + 1, gridColumn: capturedVisual.col + 1 }}><TraditionalPiece piece={capturedVisual.piece} /></div>}
        </div>
      </div>
      </div>
      {renderTurnEdge('red')}
    </section>
    <div className="cotuong-hint" role="status">{message}</div>
    <section className="cotuong-controls" aria-label="Thao tác ván cờ">
      {game.drawOffer && game.capabilities.canRespondDraw ? local && !localResponseReady
        ? <div className="cotuong-local-handover"><span>Chuyển thiết bị cho {playerBySide[game.drawOffer.offeredBy === 'red' ? 'black' : 'red'].nickname} để trả lời đề nghị hòa.</span><button className="button button-secondary" disabled={busy || !connected} onClick={() => setLocalResponseReady(true)}>Đã chuyển thiết bị</button></div>
        : <><button className="button button-primary" disabled={busy || !connected} onClick={() => act({ type: 'respondDraw', offerId: game.drawOffer!.id, accept: true })}>Đồng ý hòa</button><button className="button button-secondary" disabled={busy || !connected} onClick={() => act({ type: 'respondDraw', offerId: game.drawOffer!.id, accept: false })}>Từ chối</button></>
        : <button className="button button-secondary" disabled={!game.capabilities.canOfferDraw || busy || !connected} onClick={() => game.currentSide && act({ type: 'offerDraw', turnId: game.turnId })}>Đề nghị hòa</button>}
      {game.phase === 'turn' && <button className="button button-quiet" disabled={!game.capabilities.canResign || busy || !connected} onClick={() => setConfirmResign(true)}>Xin thua</button>}
      {game.phase === 'finished' && (local ? <button className="button button-primary" disabled={busy || !connected} onClick={onRematch}>Ván mới · đổi bên</button> : onRematch ? <button className="button button-primary" disabled={busy || !connected} onClick={onRematch}>Chơi lại trong phòng</button> : null)}
    </section>
    {confirmResign && <div className="cotuong-confirm-backdrop" role="presentation"><section className="cotuong-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cotuong-resign-title"><h2 id="cotuong-resign-title">Xin thua ván này?</h2><p>Đối thủ sẽ thắng ván hiện tại.</p><div><button className="button button-quiet" onClick={() => setConfirmResign(false)}>Tiếp tục chơi</button><button className="button button-danger" onClick={() => { setConfirmResign(false); act({ type: 'resign' }); }}>Xin thua</button></div></section></div>}
  </div>;
}
