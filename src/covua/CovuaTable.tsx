import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CovuaPublicGame } from '@banban/shared';
import PlayerAvatar from '../components/PlayerAvatar';
import { playSound } from '../audio/soundEffects';
import './covua.css';

export type CovuaIntent =
  | { type: 'move'; turnId: string; move: { from: string; to: string; promotion?: 'queen' | 'rook' | 'bishop' | 'knight' } }
  | { type: 'offerDraw'; turnId: string }
  | { type: 'respondDraw'; offerId: string; accept: boolean }
  | { type: 'claimDraw'; turnId: string; reason: 'repetition' | 'fifty-move'; intendedMove?: { from: string; to: string; promotion?: 'queen' | 'rook' | 'bishop' | 'knight' } }
  | { type: 'resign' };
type Color = 'white' | 'black';
type CaptureGhost = { id: string; src: string; left: number; top: number; width: number; height: number };
type Props = { game: CovuaPublicGame; avatars: Record<Color, number>; local?: boolean; roomCode?: string; connected: boolean; busy: boolean; onAction: (intent: CovuaIntent) => void; onLeave: () => void; onRematch?: () => void };
const roles: Record<string, string> = { king: 'Vua', queen: 'Hậu', rook: 'Xe', bishop: 'Tượng', knight: 'Mã', pawn: 'Tốt' };
const reasons: Record<string, string> = { checkmate: 'Chiếu bí', stalemate: 'Hòa do hết nước', 'repetition-claim': 'Hòa do lặp thế', 'fifty-move-claim': 'Hòa theo quy tắc 50 nước', fivefold: 'Hòa do lặp thế năm lần', 'seventy-five-move': 'Hòa theo quy tắc 75 nước', 'insufficient-material': 'Hòa do không đủ quân', timeout: 'Hết giờ', 'timeout-draw': 'Hết giờ nhưng không đủ quân để chiếu bí', resign: 'Xin thua', 'resign-draw': 'Xin thua nhưng không đủ quân để chiếu bí', 'draw-agreement': 'Hai bên đồng ý hòa' };
const title = (color: Color) => color === 'white' ? 'Trắng' : 'Đen';
const files = 'abcdefgh';
export default function CovuaTable({ game, avatars, local = false, roomCode, connected, busy, onAction, onLeave, onRematch }: Props) {
  const [claimMode, setClaimMode] = useState<'repetition' | 'fifty-move' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [now, setNow] = useState(() => performance.now());
  const [feedback, setFeedback] = useState('');
  const [captureImpact, setCaptureImpact] = useState(false);
  const [captureGhost, setCaptureGhost] = useState<CaptureGhost | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const priorVisuals = useRef(new Map<string, string>());
  const priorMove = useRef(game.lastMove?.id);
  const priorGameId = useRef(game.gameId);
  const impactTimer = useRef<number | null>(null);
  const cueTimer = useRef<number | null>(null);
  const checkTimer = useRef<number | null>(null);
  const ghostTimer = useRef<number | null>(null);
  const anchor = useRef({ server: game.clock?.serverNow ?? 0, perf: performance.now() });
  useEffect(() => { const timer = window.setInterval(() => setNow(performance.now()), 200); return () => window.clearInterval(timer); }, []);
  useEffect(() => { anchor.current = { server: game.clock?.serverNow ?? 0, perf: performance.now() }; }, [game.clock?.serverNow]);
  useEffect(() => { setSelected(null); setPromotion(null); setClaimMode(null); setConfirmResign(false); setFeedback(''); }, [game.gameId, game.revision]);
  useLayoutEffect(() => {
    const visuals = new Map<string, string>();
    boardRef.current?.querySelectorAll<HTMLElement>('[data-piece-id]').forEach((element) => {
      const id = element.dataset.pieceId;
      if (!id) return;
      const src = element.querySelector('img')?.getAttribute('src');
      if (src) visuals.set(id, src);
    });
    const move = game.lastMove;
    if (move && priorMove.current !== move.id) {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const board = boardRef.current;
      animations.current.forEach((animation) => animation.cancel());
      animations.current = [];
      const animatePiece = (pieceId: string, fromSquare: string) => {
        const element = board?.querySelector<HTMLElement>(`[data-piece-id="${CSS.escape(pieceId)}"]`);
        const from = board?.querySelector<HTMLElement>(`[data-square="${CSS.escape(fromSquare)}"]`)?.getBoundingClientRect();
        const to = element?.getBoundingClientRect();
        if (!element || !from || !to || reduce) return false;
        animations.current.push(element.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: 'translate(0,0)' }], { duration: 210, easing: 'cubic-bezier(.2,.8,.2,1)' }));
        return true;
      };
      const animated = animatePiece(move.pieceId, move.from);
      if (move.rookMove) animatePiece(move.rookMove.pieceId, move.rookMove.from);
      if (cueTimer.current !== null) window.clearTimeout(cueTimer.current);
      if (impactTimer.current !== null) window.clearTimeout(impactTimer.current);
      if (checkTimer.current !== null) window.clearTimeout(checkTimer.current);
      if (ghostTimer.current !== null) window.clearTimeout(ghostTimer.current);
      setCaptureImpact(false);
      setCaptureGhost(null);
      if (!reduce && move.capturedPieceId) {
        const capturedSrc = priorVisuals.current.get(move.capturedPieceId);
        const captureCell = board?.querySelector<HTMLElement>(`[data-square="${CSS.escape(move.captureSquare ?? move.to)}"]`);
        if (capturedSrc && captureCell && board) {
          const cellRect = captureCell.getBoundingClientRect(); const boardRect = board.getBoundingClientRect();
          setCaptureGhost({ id: move.id, src: capturedSrc, left: cellRect.left - boardRect.left - board.clientLeft, top: cellRect.top - boardRect.top - board.clientTop, width: cellRect.width, height: cellRect.height });
          ghostTimer.current = window.setTimeout(() => setCaptureGhost(null), 205);
        }
      }
      const impact = () => {
        if (move.capturedPieceId) { setCaptureImpact(true); impactTimer.current = window.setTimeout(() => setCaptureImpact(false), 165); }
        playSound(move.capturedPieceId ? 'covua-capture' : 'covua-move');
        if (game.checkedColor) {
          if (move.capturedPieceId) checkTimer.current = window.setTimeout(() => playSound('covua-check'), 125);
          else playSound('covua-check');
        }
      };
      if (animated) cueTimer.current = window.setTimeout(impact, 205);
      else impact();
    }
    priorMove.current = move?.id; priorVisuals.current = visuals;
  }, [game.lastMove?.id, game.board]);
  useEffect(() => {
    if (priorGameId.current === game.gameId) return;
    priorGameId.current = game.gameId;
    for (const timer of [impactTimer.current, cueTimer.current, checkTimer.current, ghostTimer.current]) {
      if (timer !== null) window.clearTimeout(timer);
    }
    impactTimer.current = cueTimer.current = checkTimer.current = ghostTimer.current = null;
    setCaptureImpact(false); setCaptureGhost(null);
  }, [game.gameId]);
  useEffect(() => () => {
    if (impactTimer.current !== null) window.clearTimeout(impactTimer.current);
    if (cueTimer.current !== null) window.clearTimeout(cueTimer.current);
    if (checkTimer.current !== null) window.clearTimeout(checkTimer.current);
    if (ghostTimer.current !== null) window.clearTimeout(ghostTimer.current);
  }, []);
  const orientation: Color = local ? (flipped ? 'black' : 'white') : (game.viewerColor ?? 'white');
  useLayoutEffect(() => {
    const cancelVisuals = () => {
      animations.current.forEach((animation) => animation.cancel());
      animations.current = [];
      if (ghostTimer.current !== null) window.clearTimeout(ghostTimer.current);
      setCaptureGhost(null);
    };
    cancelVisuals();
    const observer = new ResizeObserver(cancelVisuals);
    if (boardRef.current) observer.observe(boardRef.current);
    return () => { observer.disconnect(); cancelVisuals(); };
  }, [orientation, game.gameId]);
  const ranks = orientation === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const columns = orientation === 'white' ? [...files] : [...files].reverse();
  const available = game.capabilities.canMove && connected && !busy;
  const legalTargets = selected ? game.legalMoves.filter((item) => item.from === selected).map((item) => item.to) : [];
  const act = (from: string, to: string, promote?: 'queen'|'rook'|'bishop'|'knight') => {
    const move = { from, to, ...(promote ? { promotion: promote } : {}) };
    if (claimMode) onAction({ type: 'claimDraw', turnId: game.turnId, reason: claimMode, intendedMove: move });
    else onAction({ type: 'move', turnId: game.turnId, move });
  };
  const choose = (square: string) => {
    if (!available) return;
    const piece = game.board[square]; const own = piece?.color === game.currentColor;
    if (selected && legalTargets.includes(square)) {
      const options = game.legalMoves.filter((item) => item.from === selected && item.to === square);
      if (options.some((item) => item.promotion)) setPromotion({ from: selected, to: square }); else act(selected, square);
      return;
    }
    if (own) { setSelected(square); setFeedback(''); return; }
    setSelected(null); setFeedback('Chọn quân rồi chọn ô được phép đi.');
  };
  const elapsed = game.clock ? Math.max(0, now - anchor.current.perf) : 0;
  const remaining = (color: Color) => { if (!game.clock) return '∞'; const value = game.clock.remainingMs[color] - (game.phase === 'turn' && game.currentColor === color && game.clock.deadlineAt !== null ? elapsed : 0); const total = Math.max(0, Math.ceil(value / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2,'0')}`; };
  return <div className="covua-page">
    <div className="covua-header"><button className="back-link" type="button" onClick={onLeave}>← Rời bàn</button><strong>{local ? 'Cờ vua · 2P' : `Cờ vua · Phòng ${roomCode ?? ''}`}</strong><div className="covua-header-actions">{local && <button className="button button-secondary button-small" type="button" onClick={() => { setFlipped((value) => !value); setSelected(null); }}>Xoay bàn</button>}<span>{connected ? 'Đã kết nối' : 'Đang nối lại…'}</span></div></div>
    <div className="covua-players">{(['white','black'] as const).map((color) => { const player = game.players.find((item) => item.color === color)!; return <div className={`covua-player ${game.currentColor === color ? 'is-turn' : ''}`} key={color}><PlayerAvatar id={avatars[color]} /><div><strong>{player.nickname}{!local && game.viewerColor === color ? <em> · Bạn</em> : null}</strong><small>Quân {title(color)}{game.checkedColor === color ? ' · Đang bị chiếu' : ''}</small></div><time>{remaining(color)}</time></div>; })}</div>
    <div className="covua-status" role="status">{game.phase === 'finished' ? game.notice : game.notice ?? `${title(game.currentColor ?? 'white')} đi`}</div>
    <div className={`covua-board${captureImpact ? ' is-capture-impact' : ''}`} ref={boardRef} role="grid" aria-label="Bàn Cờ vua 8 nhân 8">{ranks.flatMap((rank, row) => columns.map((file, col) => { const square = `${file}${rank}`; const piece = game.board[square]; const target = legalTargets.includes(square); return <button key={square} data-square={square} type="button" role="gridcell" className={`covua-cell ${(row+col)%2 ? 'is-dark' : 'is-light'}${selected === square ? ' is-selected' : ''}${target ? ' is-target' : ''}${game.lastMove?.from === square || game.lastMove?.to === square ? ' is-last' : ''}${game.checkedColor && piece?.role === 'king' && piece.color === game.checkedColor ? ' is-check' : ''}`} aria-label={`${square.toUpperCase()}${piece ? `, ${roles[piece.role]} ${title(piece.color)}` : ', trống'}${target ? ', có thể đi' : ''}`} aria-selected={selected === square} disabled={!available} onClick={() => choose(square)}>{piece && <span data-piece-id={piece.id} className="covua-piece"><img src={`/assets/covua/pieces/${piece.color}-${piece.role}.svg`} alt="" draggable={false} /></span>}{target && <i aria-hidden="true" />}</button>; }))}{captureGhost && <span key={captureGhost.id} className="covua-capture-ghost" style={{ left: captureGhost.left, top: captureGhost.top, width: captureGhost.width, height: captureGhost.height }} aria-hidden="true"><img src={captureGhost.src} alt="" /></span>}</div>
    {available && <div className="covua-actions" role="group" aria-label="Yêu cầu hòa bằng nước dự định">{claimMode ? <><span role="status">Chọn quân và ô đến để yêu cầu hòa ({claimMode === 'repetition' ? 'lặp thế' : '50 nước'}). Nước chưa được đánh.</span><button type="button" className="button button-secondary" onClick={() => { setClaimMode(null); setSelected(null); setPromotion(null); }}>Hủy yêu cầu</button></> : <>{(['repetition', 'fifty-move'] as const).map((reason) => <button key={reason} type="button" className="button button-quiet" onClick={() => { setClaimMode(reason); setSelected(null); }}>Hòa bằng nước dự định: {reason === 'repetition' ? 'lặp thế' : '50 nước'}</button>)}</>}</div>}
    {feedback && <p className="covua-feedback" role="status">{feedback}</p>}
    <div className="covua-actions">{game.capabilities.canOfferDraw && <button type="button" className="button button-secondary" onClick={() => onAction({ type: 'offerDraw', turnId: game.turnId })}>Đề nghị hòa</button>}{game.capabilities.canClaimDrawNow && game.claimReasons.map((reason) => <button key={reason} type="button" className="button button-secondary" onClick={() => onAction({ type: 'claimDraw', turnId: game.turnId, reason })}>Yêu cầu hòa: {reason === 'repetition' ? 'lặp thế' : '50 nước'}</button>)}{game.capabilities.canResign && <button type="button" className="button button-quiet" onClick={() => setConfirmResign(true)}>Xin thua</button>}</div>
    <div className="covua-history" aria-label="Lịch sử nước đi">{game.history.map((san, index) => <span key={`${index}-${san}`}>{index % 2 === 0 ? `${Math.floor(index/2)+1}. ` : ''}{san}</span>)}</div>
    {game.drawOffer && game.capabilities.canRespondDraw && <div className="covua-overlay"><section className="modal-card"><h2>Đối thủ đề nghị hòa</h2><p>Bạn có đồng ý kết thúc ván hòa?</p><div className="covua-dialog-actions"><button className="button button-secondary" type="button" onClick={() => onAction({ type:'respondDraw', offerId: game.drawOffer!.id, accept: false })}>Từ chối</button><button className="button button-primary" type="button" onClick={() => onAction({ type:'respondDraw', offerId: game.drawOffer!.id, accept: true })}>Đồng ý</button></div></section></div>}
    {promotion && <div className="covua-overlay"><section className="modal-card" role="dialog" aria-modal="true" aria-label="Chọn quân phong cấp"><h2>Phong cấp Tốt</h2><div className="covua-promotion">{(['queen','rook','bishop','knight'] as const).map((role) => <button type="button" key={role} onClick={() => { act(promotion.from,promotion.to,role); setPromotion(null); }}><img src={`/assets/covua/pieces/${game.currentColor}-${role}.svg`} alt="" />{roles[role]}</button>)}</div><button className="button button-quiet" type="button" onClick={() => setPromotion(null)}>Hủy</button></section></div>}
    {confirmResign && <div className="covua-overlay"><section className="modal-card" role="dialog" aria-modal="true" aria-label="Xác nhận xin thua"><h2>Xin thua ván này?</h2><div className="covua-dialog-actions"><button type="button" className="button button-secondary" onClick={() => setConfirmResign(false)}>Chơi tiếp</button><button type="button" className="button button-primary" onClick={() => { setConfirmResign(false); onAction({ type:'resign' }); }}>Xin thua</button></div></section></div>}
    {game.phase === 'finished' && <div className="covua-overlay"><section className="modal-card" role="dialog" aria-modal="true" aria-label="Kết quả ván"><p className="eyebrow">VÁN ĐÃ KẾT THÚC</p><h2>{game.winnerColor ? `${game.players.find((item) => item.color === game.winnerColor)?.nickname} thắng ván!` : 'Ván hòa'}</h2><p>{reasons[game.finishReason ?? ''] ?? game.notice}</p>{local && onRematch && <button className="button button-primary" type="button" onClick={onRematch}>Ván mới</button>}{!local && <p>Ván kế tiếp sẽ tự bắt đầu nếu chưa đủ điểm.</p>}<button className="button button-quiet" type="button" onClick={onLeave}>Rời bàn</button></section></div>}
  </div>;
}
