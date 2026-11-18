import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { BantauPublicGame, RoomSnapshot } from '@banban/shared';
import type { BantauPresentationEffect } from './presentation-clock';
import type { ApiReply, BantauActionIntent, BantauAimIntent, BantauPlacementIntent } from '../api/realtime';
import PlayerAvatar from '../components/PlayerAvatar';
import { playSound } from '../audio/soundEffects';

type Snapshot = Extract<RoomSnapshot, { gameKey: 'bantau' }>;
type PlacementDraft =
  | { type: 'moveShip'; shipId: string; anchor: { row: number; col: number } }
  | { type: 'rotateShip'; shipId: string }
  | { type: 'replaceFleetRandom' };
type Props = {
  snapshot: Snapshot;
  playerId: string;
  connected: boolean;
  busy: boolean;
  effect: BantauPresentationEffect | null;
  onPlacement: (intent: BantauPlacementIntent) => Promise<ApiReply>;
  onAim: (intent: BantauAimIntent) => Promise<ApiReply>;
  onAction: (intent: BantauActionIntent) => Promise<ApiReply>;
  onLeave: () => void;
  onRules: () => void;
  onRematch: () => void;
};

function formatCell(index: number, size: number) {
  return `${String.fromCharCode(65 + Math.floor(index / size))}${(index % size) + 1}`;
}

function remainingSeconds(game: BantauPublicGame, paused: boolean, elapsedMs: number) {
  const remaining = game.phase === 'setup' ? game.setupRemainingMs : game.remainingMs;
  return remaining === null ? null : Math.max(0, Math.ceil((remaining - (paused ? 0 : elapsedMs)) / 1000));
}

type ShipShape = { id: string; length: number; anchor: { row: number; col: number }; orientation: 'horizontal' | 'vertical'; cells: { row: number; col: number }[] };
type DragPreview = { shipId: string; anchor: { row: number; col: number }; moved: boolean };

function shipAsset(length: number, id: string) {
  if (length === 2) return 'patrol-2.svg';
  if (length === 4) return 'battleship-4.svg';
  if (length === 5) return 'carrier-5.svg';
  const slot = Number(id.match(/(?:ship-|wreck-)(\d+)$/)?.[1] ?? 1);
  return slot === 2 || slot === 4 ? 'submarine-3.svg' : 'destroyer-3.svg';
}

function Grid({
  game, kind, playerId, effect, selectedShipId, onCell, cellScale, interactive = false,
  aim, aimPending = false, turnState = 'idle', canDrag = false, placementPending = false, onShipDrop, onShipPick, onRotateShip,
}: {
  game: BantauPublicGame;
  kind: 'setup' | 'target' | 'own';
  playerId: string;
  effect: BantauPresentationEffect | null;
  selectedShipId?: string | null;
  onCell?: (index: number) => void;
  cellScale: number;
  interactive?: boolean;
  aim?: BantauPublicGame['ownAim'];
  aimPending?: boolean;
  turnState?: 'idle' | 'mine' | 'opponent';
  canDrag?: boolean;
  placementPending?: boolean;
  onShipDrop?: (shipId: string, anchor: { row: number; col: number }) => void;
  onShipPick?: (shipId: string) => void;
  onRotateShip?: () => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [drag, setDrag] = useState<DragPreview | null>(null);
  const dragRef = useRef<{ pointerId: number; shipId: string; segment: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => { const resize = () => setViewportWidth(window.innerWidth); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  const shipAt = useMemo(() => {
    const cells = new Map<number, string>();
    if (kind === 'setup' || kind === 'own') for (const ship of game.ownFleet.ships) for (const cell of ship.cells) cells.set(cell.row * game.boardSize + cell.col, ship.id);
    if (kind === 'target') for (const wreck of game.revealedSunkShips) for (const cell of wreck.cells) cells.set(cell.row * game.boardSize + cell.col, wreck.displayId);
    return cells;
  }, [game.ownFleet.ships, game.revealedSunkShips, game.boardSize, kind]);
  const ships = useMemo<ShipShape[]>(() => {
    if (kind === 'setup' || kind === 'own') return game.ownFleet.ships;
    if (kind !== 'target') return [];
    return game.revealedSunkShips.map((wreck) => {
      const row = Math.min(...wreck.cells.map((cell) => cell.row));
      const col = Math.min(...wreck.cells.map((cell) => cell.col));
      const orientation = wreck.cells.every((cell) => cell.row === row) ? 'horizontal' : 'vertical';
      return { id: wreck.displayId, length: wreck.length, anchor: { row, col }, orientation, cells: wreck.cells };
    });
  }, [kind, game.ownFleet.ships, game.revealedSunkShips]);
  const ownHits = useMemo(() => new Set(game.ownFleet.hitCells.map((cell) => cell.row * game.boardSize + cell.col)), [game.ownFleet.hitCells, game.boardSize]);
  const effectIsHere = effect && (kind === 'target' ? effect.actorId === playerId : kind === 'own' ? effect.targetId === playerId : false) ? effect : null;

  useEffect(() => {
    if (!canDrag || !interactive || !dragRef.current) {
      dragRef.current = null;
      setDrag(null);
    }
  }, [canDrag, interactive, game.gameId, game.setupId, game.phase, game.ownFleet.revision]);

  const cellAtPoint = (clientX: number, clientY: number) => {
    const bounds = gridRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    const col = Math.floor((clientX - bounds.left) / (bounds.width / game.boardSize));
    const row = Math.floor((clientY - bounds.top) / (bounds.height / game.boardSize));
    return row < 0 || col < 0 || row >= game.boardSize || col >= game.boardSize ? null : { row, col };
  };

  const startDrag = (event: PointerEvent<HTMLButtonElement>, index: number, shipId: string) => {
    if (!canDrag || !interactive || placementPending || event.button !== 0) return;
    const ship = ships.find((item) => item.id === shipId);
    if (!ship) return;
    const row = Math.floor(index / game.boardSize); const col = index % game.boardSize;
    const segment = ship.orientation === 'horizontal' ? col - ship.anchor.col : row - ship.anchor.row;
    onShipPick?.(shipId);
    dragRef.current = { pointerId: event.pointerId, shipId, segment, startX: event.clientX, startY: event.clientY, moved: false };
    setDrag({ shipId, anchor: ship.anchor, moved: false });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX; const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < 7) return;
    current.moved = true;
    const point = cellAtPoint(event.clientX, event.clientY);
    const ship = ships.find((item) => item.id === current.shipId);
    if (!point || !ship) { setDrag((value) => value ? { ...value, moved: true } : value); return; }
    const anchor = ship.orientation === 'horizontal'
      ? { row: point.row, col: point.col - current.segment }
      : { row: point.row - current.segment, col: point.col };
    setDrag({ shipId: current.shipId, anchor, moved: true });
  };

  const finishDrag = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (!cancelled && current.moved) {
      suppressClickRef.current = true;
      const point = cellAtPoint(event.clientX, event.clientY);
      const ship = ships.find((item) => item.id === current.shipId);
      if (point && ship) {
        const anchor = ship.orientation === 'horizontal'
          ? { row: point.row, col: point.col - current.segment }
          : { row: point.row - current.segment, col: point.col };
        if (anchor.row !== ship.anchor.row || anchor.col !== ship.anchor.col) onShipDrop?.(current.shipId, anchor);
      }
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const row = Math.floor(index / game.boardSize); const col = index % game.boardSize;
    let nextRow = row; let nextCol = col;
    if (event.key === 'Escape' && dragRef.current) { event.preventDefault(); dragRef.current = null; setDrag(null); return; }
    if (event.key === 'r' || event.key === 'R') { if (kind === 'setup' && selectedShipId && canDrag && !placementPending) { event.preventDefault(); onRotateShip?.(); } return; }
    if (event.key === 'ArrowUp') nextRow = Math.max(0, row - 1);
    else if (event.key === 'ArrowDown') nextRow = Math.min(game.boardSize - 1, row + 1);
    else if (event.key === 'ArrowLeft') nextCol = Math.max(0, col - 1);
    else if (event.key === 'ArrowRight') nextCol = Math.min(game.boardSize - 1, col + 1);
    else return;
    event.preventDefault();
    const next = nextRow * game.boardSize + nextCol;
    setFocusIndex(next);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell-index="${next}"]`)?.focus();
  };

  const boardFactor = kind === 'own' ? 0.54 : 1;
  const baseCell = Math.max(23, Math.min(viewportWidth <= 600 ? (viewportWidth - 58) / game.boardSize : 42, 42));
  const cellPixels = baseCell * cellScale * boardFactor;
  const effectAge = effectIsHere ? Math.max(0, performance.now() - effectIsHere.startedAt) : 0;
  const shipRect = (ship: ShipShape, anchor = ship.anchor): CSSProperties => {
    const vertical = ship.orientation === 'vertical';
    return {
      '--ship-col': anchor.col, '--ship-row': anchor.row, '--ship-len': ship.length,
      left: `${anchor.col * cellPixels}px`, top: `${anchor.row * cellPixels}px`,
      width: `${vertical ? cellPixels : cellPixels * ship.length}px`, height: `${vertical ? cellPixels * ship.length : cellPixels}px`,
    } as CSSProperties;
  };
  return <div className={`bantau-grid-scroll ${cellScale > 1 ? 'is-zoomed' : ''}`}>
    <div ref={gridRef} className={`bantau-grid bantau-grid-${kind}${turnState !== 'idle' ? ` is-${turnState}-turn` : ''}${placementPending ? ' is-placement-pending' : ''}${effectIsHere && effectAge < 900 ? ` is-striking result-${effectIsHere.result}` : ''}`} role="grid" aria-label={kind === 'target' ? 'Biển đối thủ, chọn ô để ngắm và bắn' : kind === 'own' ? 'Hạm đội của bạn, chỉ xem vị trí tàu và các ô trúng' : 'Đội hình tàu riêng của bạn, kéo thân tàu để di chuyển'} style={{ '--board-size': game.boardSize, '--cell-size': `${cellPixels}px`, '--cell': `${cellPixels}px` } as CSSProperties}>
      {Array.from({ length: game.boardSize * game.boardSize }, (_, index) => {
        const target = game.targetBoard[index] ?? 'unknown';
        const shipId = shipAt.get(index);
        const isOwnHit = ownHits.has(index);
        const cellRow = Math.floor(index / game.boardSize);
        const cellCol = index % game.boardSize;
        const isAim = kind === 'target' && aim?.cell.row === Math.floor(index / game.boardSize) && aim?.cell.col === index % game.boardSize;
        const isImpactFireCell = effectIsHere && effectIsHere.result !== 'miss' && (
          kind === 'target' && effectIsHere.result === 'sunk'
            ? effectIsHere.sunkCells?.some((cell) => cell.row === cellRow && cell.col === cellCol) ?? (effectIsHere.row === cellRow && effectIsHere.col === cellCol)
            : effectIsHere.row === cellRow && effectIsHere.col === cellCol
        );
        const disabled = kind === 'target' ? target !== 'unknown' || !interactive : kind === 'setup' ? !interactive : true;
        const status = kind === 'target' ? target === 'unknown' ? 'chưa bắn' : target === 'hit' ? 'trúng tàu' : 'tàu đã chìm' : kind === 'own' ? isOwnHit ? 'tàu của bạn bị trúng' : shipAt.has(index) ? 'tàu của bạn' : 'biển trống' : shipId ? 'tàu của bạn' : 'biển trống';
        const label = `${formatCell(index, game.boardSize)}, ${status}${isAim ? aimPending ? ', đang xác nhận ngắm' : ', đang ngắm' : ''}`;
        return <button
          key={index}
          type="button"
          role="gridcell"
          data-cell-index={index}
          className={`bantau-cell${shipId && !(drag?.moved && drag.shipId === shipId) ? ' has-ship' : ''}${shipId && shipId === selectedShipId && !(drag?.moved && drag.shipId === shipId) ? ' is-selected-ship' : ''}${kind === 'own' && isOwnHit ? ' is-hit' : ''}${kind === 'target' && target === 'hit' ? ' is-hit' : ''}${kind === 'target' && target === 'sunk' ? ' is-sunk' : ''}${isAim ? ` is-aimed${aimPending ? ' is-aim-pending' : ''}` : ''}`}
          aria-label={label}
          aria-selected={isAim || (Boolean(shipId) && shipId === selectedShipId)}
          aria-disabled={disabled}
          tabIndex={focusIndex === index ? 0 : -1}
          onFocus={() => setFocusIndex(index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onPointerDown={(event) => shipId && kind === 'setup' ? startDrag(event, index, shipId) : undefined}
          onPointerMove={moveDrag}
          onPointerUp={(event) => finishDrag(event)}
          onPointerCancel={(event) => finishDrag(event, true)}
          onClick={() => { if (suppressClickRef.current) return; onCell?.(index); }}
          disabled={disabled}
        >
          {(kind === 'own' && isOwnHit || kind === 'target' && target !== 'unknown') && <span className={`bantau-hit-mark${kind === 'own' ? ' own-fire-cell' : ' target-fire-cell'}${isImpactFireCell ? ' is-impact-active' : ''}`} style={isImpactFireCell && effectIsHere ? { '--fire-reveal-delay': `calc(${effectIsHere.result === 'sunk' ? 800 : 700}ms - ${effectAge}ms)` } as CSSProperties : undefined} aria-hidden="true">{target === 'sunk' && kind === 'target' ? '×' : '•'}</span>}
          {isAim && <span className="bantau-crosshair" aria-hidden="true" />}
        </button>;
      })}
      {ships.map((ship) => {
        const previewAnchor = drag?.shipId === ship.id && drag.moved ? drag.anchor : ship.anchor;
        const hiddenOriginal = drag?.shipId === ship.id && drag.moved;
        return <div key={ship.id} className={`bantau-ship-art${ship.orientation === 'vertical' ? ' is-vertical' : ''}${kind === 'target' ? ' is-wreck' : ''}${hiddenOriginal ? ' is-drag-source' : ''}`} style={shipRect(ship, previewAnchor)} aria-hidden="true">
          <img src={`/assets/bantau/ships/${shipAsset(ship.length, ship.id)}`} alt="" draggable="false" />
          {kind === 'setup' && hiddenOriginal && <span className="bantau-ship-ghost-label">Thả để đặt</span>}
        </div>;
      })}
      {effectIsHere && effectAge < 1200 && <div key={effectIsHere.shotId} className={`bantau-strike-fx result-${effectIsHere.result}`} style={{ left: `${effectIsHere.col * cellPixels}px`, '--cell': `${cellPixels}px`, '--fall-distance': `${(effectIsHere.row + .5) * cellPixels}px`, '--impact-offset': `${effectIsHere.row * cellPixels}px`, '--effect-age': `${effectAge}ms` } as CSSProperties} aria-hidden="true">
        <img className="bantau-torpedo-sprite" src="/assets/bantau/fx/torpedo.svg" alt="" />
        <span className={`bantau-impact-sprite ${effectIsHere.result === 'miss' ? 'is-splash' : effectIsHere.result === 'sunk' ? 'is-explosion is-heavy' : 'is-explosion'}`} />
      </div>}
    </div>
  </div>;
}

export default function BantauTable({ snapshot, playerId, connected, busy, effect, onPlacement, onAim, onAction, onLeave, onRules, onRematch }: Props) {
  const game = snapshot.game;
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [localAim, setLocalAim] = useState<BantauPublicGame['ownAim']>(game?.ownAim ?? null);
  const [aimPending, setAimPending] = useState(false);
  const [placementPending, setPlacementPending] = useState(false);
  const [placementMessage, setPlacementMessage] = useState('');
  const [cellScale, setCellScale] = useState(1);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [effectClock, setEffectClock] = useState(() => performance.now());
  const [resignOpen, setResignOpen] = useState(false);
  const aimSequenceRef = useRef(game?.ownAim?.sequence ?? 0);
  const turnRef = useRef('');
  const gameContextRef = useRef({ gameId: game?.gameId ?? '', setupId: game?.setupId ?? '', turnId: game?.turnId ?? '', phase: game?.phase ?? 'setup' });
  const strikeSoundTimerRef = useRef<number | null>(null);
  const clockAnchor = useRef({ at: Date.now(), remaining: 0 });
  const ownPlayer = game?.players.find((player) => player.id === playerId);
  const otherPlayer = game?.players.find((player) => player.id !== playerId);
  const turnSeconds = game ? remainingSeconds(game, snapshot.paused, elapsedMs) : null;
  gameContextRef.current = { gameId: game?.gameId ?? '', setupId: game?.setupId ?? '', turnId: game?.turnId ?? '', phase: game?.phase ?? 'setup' };

  useEffect(() => {
    setEffectClock(performance.now());
    if (!effect || effect.expiresAt <= performance.now()) return;
    if (strikeSoundTimerRef.current !== null) window.clearTimeout(strikeSoundTimerRef.current);
    const flightMs = 280;
    const ageMs = Math.max(0, performance.now() - effect.startedAt);
    const impactCue = effect.result === 'miss' ? 'water' : effect.result === 'sunk' ? 'ship-sunk' : 'impact';
    const expiryTimer = window.setTimeout(() => setEffectClock(performance.now()), Math.max(0, effect.expiresAt - performance.now()));
    if (ageMs < flightMs) {
      playSound('bantau-launch');
      strikeSoundTimerRef.current = window.setTimeout(() => playSound(impactCue), flightMs - ageMs);
    } else playSound(impactCue);
    return () => { window.clearTimeout(expiryTimer); if (strikeSoundTimerRef.current !== null) window.clearTimeout(strikeSoundTimerRef.current); strikeSoundTimerRef.current = null; };
  }, [effect?.shotId]);

  useEffect(() => {
    if (!game) return;
    const turnKey = `${game.gameId}:${game.turnId}:${game.phase}`;
    if (turnRef.current !== turnKey) {
      turnRef.current = turnKey;
      setLocalAim(game.ownAim);
      setAimPending(false);
      setSelectedShipId(null);
      setPlacementPending(false);
      setPlacementMessage('');
    } else if (game.ownAim && (!localAim || game.ownAim.sequence >= localAim.sequence)) setLocalAim(game.ownAim);
    aimSequenceRef.current = Math.max(aimSequenceRef.current, game.ownAim?.sequence ?? 0);
  }, [game?.gameId, game?.turnId, game?.phase, game?.ownAim?.sequence]);

  useEffect(() => {
    if (!game) return;
    const remaining = game.phase === 'setup' ? game.setupRemainingMs : game.remainingMs;
    clockAnchor.current = { at: Date.now(), remaining: remaining ?? 0 };
    setElapsedMs(0);
    if (snapshot.paused || game.phase === 'finished' || remaining === null) return;
    const interval = window.setInterval(() => setElapsedMs(Date.now() - clockAnchor.current.at), 200);
    return () => window.clearInterval(interval);
  }, [game?.gameId, game?.phase, game?.turnId, game?.setupRemainingMs, game?.remainingMs, snapshot.paused]);

  if (!game) return <section className="bantau-page"><p className="bantau-status">Đang chờ máy chủ mở bàn Bắn tàu…</p></section>;
  const players = snapshot.players;
  const me = players.find((player) => player.id === playerId);
  const isMyTurn = game.currentPlayerId === playerId;
  const myAim = localAim?.turnId === game.turnId ? localAim : null;
  const liveEffect = effect && effect.gameId === game.gameId && effect.expiresAt > effectClock ? effect : null;
  const fleet = game.ownFleet.ships;
  const selectedShip = fleet.find((ship) => ship.id === selectedShipId) ?? null;

  const place = async (intent: PlacementDraft) => {
    if (!game.capabilities.canEditFleet || busy || placementPending || !connected) return;
    const context = { gameId: game.gameId, setupId: game.setupId, expectedFleetRevision: game.ownFleet.revision };
    setPlacementPending(true);
    setPlacementMessage('Đang chờ máy chủ xác nhận đội hình…');
    let reply: ApiReply;
    try { reply = await onPlacement({ ...intent, ...context } as BantauPlacementIntent); }
    catch { reply = { ok: false, message: 'Mất kết nối khi xác nhận. Hãy chờ đồng bộ đội hình rồi thử lại.' }; }
    const current = gameContextRef.current;
    if (current.gameId === context.gameId && current.setupId === context.setupId && current.phase === 'setup') {
      setPlacementMessage(reply.ok ? 'Máy chủ đã xác nhận vị trí tàu.' : reply.message || 'Máy chủ chưa nhận vị trí này. Đội hình đã trở về vị trí đã xác nhận.');
      setPlacementPending(false);
    }
  };
  const onSetupCell = (index: number) => {
    if (!game.capabilities.canEditFleet || busy) return;
    const row = Math.floor(index / game.boardSize); const col = index % game.boardSize;
    const ship = fleet.find((candidate) => candidate.cells.some((cell) => cell.row === row && cell.col === col));
    if (ship) { setSelectedShipId(ship.id); return; }
    if (selectedShip) void place({ type: 'moveShip', shipId: selectedShip.id, anchor: { row, col } });
  };

  const chooseTarget = async (index: number) => {
    if (!game.capabilities.canAim || busy || aimPending) return;
    const cell = { row: Math.floor(index / game.boardSize), col: index % game.boardSize };
    if (myAim?.turnId === game.turnId && myAim.cell.row === cell.row && myAim.cell.col === cell.col) {
      setAimPending(true);
      const context = { gameId: game.gameId, turnId: game.turnId };
      const result = await onAction({ type: 'fire', gameId: game.gameId, turnId: game.turnId, aimSequence: myAim.sequence, ...cell });
      const current = gameContextRef.current;
      if (current.gameId !== context.gameId || current.turnId !== context.turnId) return;
      setAimPending(false);
      if (result.ok) setLocalAim(null);
      return;
    }
    setAimPending(true);
    const sequence = ++aimSequenceRef.current;
    const context = { gameId: game.gameId, turnId: game.turnId };
    setLocalAim({ turnId: game.turnId, sequence, cell });
    const result = await onAim({ gameId: game.gameId, turnId: game.turnId, sequence, cell });
    const current = gameContextRef.current;
    if (current.gameId !== context.gameId || current.turnId !== context.turnId) return;
    setAimPending(false);
    if (result.ok) setLocalAim(result.aim ?? { turnId: game.turnId, sequence: result.sequence ?? sequence, cell });
    else setLocalAim(game.ownAim?.turnId === game.turnId ? game.ownAim : null);
  };

  const lockFleet = () => void onAction({ type: 'lockFleet', gameId: game.gameId, setupId: game.setupId, expectedFleetRevision: game.ownFleet.revision });
  const turnLabel = snapshot.paused || !connected ? 'Đang chờ kết nối lại' : game.phase === 'setup' ? `Xếp tàu · còn ${turnSeconds ?? 0}s` : game.phase === 'resolving' ? 'Đang xử lý phát bắn…' : game.phase === 'finished' ? 'Ván đã kết thúc' : isMyTurn ? 'Tới lượt bạn' : `Đang tới lượt ${otherPlayer?.nickname ?? 'đối thủ'}`;
  const effectTargetName = liveEffect?.targetId === playerId ? 'Hạm đội của bạn' : liveEffect?.actorId === playerId ? 'Biển đối thủ' : '';
  const effectMessage = liveEffect ? `${liveEffect.source === 'timeout' ? 'Tự bắn hết giờ · ' : ''}${liveEffect.result === 'miss' ? 'Trượt xuống nước' : liveEffect.result === 'sunk' ? 'Đã đánh chìm một tàu' : 'Trúng tàu'} tại ${formatCell(liveEffect.row * game.boardSize + liveEffect.col, game.boardSize)} · ${effectTargetName}` : null;

  return <div className="bantau-page">
    <div className="bantau-topline">
      <button className="back-link" type="button" onClick={onLeave}>← Rời bàn</button>
      <div className="bantau-room-meta"><span className={`bantau-connection-dot${connected ? '' : ' is-offline'}`} />BẮN TÀU · PHÒNG {snapshot.code}<span>·</span><button type="button" onClick={onRules}>Luật chơi</button></div>
      <span className={`bantau-connection-label${connected ? '' : ' is-offline'}`}>{connected ? 'Đã kết nối' : 'Đang kết nối lại'}</span>
    </div>

    {snapshot.paused && <div className="bantau-connection-banner" role="status">Đang chờ người chơi kết nối lại. Đồng hồ đã tạm dừng.</div>}
    <section className="bantau-player-strip" aria-label="Người chơi">
      {players.map((player, index) => {
        const gamePlayer = game.players.find((candidate) => candidate.id === player.id);
        return <div key={player.id} className={`bantau-player-chip${player.id === playerId ? ' is-you' : ''}${player.id === game.currentPlayerId ? player.id === playerId ? ' is-turn is-my-turn' : ' is-turn is-opponent-turn' : ''}`}>
        <PlayerAvatar id={snapshot.players.find((seat) => seat.id === player.id)?.avatarId ?? index} />
        <span><strong>{player.nickname}{player.id === playerId ? ' · Bạn' : ''}</strong><small>{player.id === game.currentPlayerId ? game.phase === 'setup' ? 'Đang xếp tàu' : 'Đang lượt' : `${gamePlayer?.sunkCount ?? 0}/${game.shipCount} tàu chìm`}</small></span>
        {game.phase === 'setup' && <b className={`bantau-lock-indicator${gamePlayer?.placementLocked ? ' is-locked' : ''}`}>{gamePlayer?.placementLocked ? 'Đã sẵn sàng' : 'Đang xếp'}</b>}
      </div>;})}
    </section>

    <div className="bantau-status-line" aria-live="polite"><span className={`bantau-status-pip${isMyTurn && game.phase === 'turn' ? ' is-active' : ''}`} />{turnLabel}{game.phase === 'turn' && turnSeconds !== null && <b className="bantau-clock">{turnSeconds}s</b>}</div>

    {game.phase === 'setup' ? <section className="bantau-setup-layout">
      <div className="bantau-board-panel">
        <div className="bantau-panel-heading"><div><p className="eyebrow">ĐỘI HÌNH KÍN</p><h2>Hạm đội của bạn</h2></div><span>{fleet.length} tàu · {fleet.reduce((sum, ship) => sum + ship.length, 0)} ô</span></div>
        <Grid game={game} kind="setup" playerId={playerId} effect={liveEffect} selectedShipId={selectedShipId} onCell={onSetupCell} cellScale={cellScale} interactive={game.capabilities.canEditFleet && !busy && !placementPending} canDrag={game.capabilities.canEditFleet} placementPending={placementPending} onShipPick={setSelectedShipId} onShipDrop={(shipId, anchor) => { setSelectedShipId(shipId); void place({ type: 'moveShip', shipId, anchor }); }} onRotateShip={() => selectedShip && void place({ type: 'rotateShip', shipId: selectedShip.id })} />
      </div>
      <aside className="bantau-controls-panel">
        <p className="eyebrow">SẮP XẾP TÀU</p>
        <p className="bantau-help">Kéo trực tiếp thân tàu tới vị trí mới. Thả tàu để máy chủ xác nhận.</p>
        <div className="bantau-fleet-list" aria-label="Chọn tàu để sắp xếp">{fleet.map((ship, index) => <button key={ship.id} type="button" className={`bantau-fleet-item${ship.id === selectedShipId ? ' is-selected' : ''}`} disabled={!game.capabilities.canEditFleet || busy} aria-pressed={ship.id === selectedShipId} onClick={() => setSelectedShipId(ship.id)}><span className="bantau-mini-ship" aria-hidden="true">{Array.from({ length: ship.length }, (_, part) => <i key={part} />)}</span><strong>Tàu {index + 1}</strong><small>{ship.length} ô</small></button>)}</div>
        <div className="bantau-setup-actions">
          <button className="button button-secondary" type="button" disabled={!selectedShip || !game.capabilities.canEditFleet || busy || placementPending} onClick={() => selectedShip && void place({ type: 'rotateShip', shipId: selectedShip.id })}>Xoay tàu <kbd>R</kbd></button>
          <button className="button button-secondary" type="button" disabled={!game.capabilities.canRandomize || busy || placementPending} onClick={() => void place({ type: 'replaceFleetRandom' })}>Ngẫu nhiên</button>
          {game.capabilities.canLock ? <button className="button button-primary button-large" type="button" disabled={busy || placementPending || !connected} onClick={lockFleet}>Khóa đội hình</button> : <p className="bantau-wait-note">Bạn đã sẵn sàng. Đang chờ đối thủ khóa đội hình…</p>}
        </div>
        <p className={`bantau-placement-status${placementMessage.includes('chưa nhận') ? ' is-error' : ''}`} aria-live="polite">{placementMessage}</p>
        <p className="bantau-private-note">Vị trí tàu này chỉ bạn nhìn thấy.</p>
      </aside>
    </section> : <section className={`bantau-combat-layout${isMyTurn ? ' is-player-turn' : ' is-opponent-turn'}`}>
      <div className={`bantau-own-column${isMyTurn ? ' is-turn-mine' : ''}`}>
        <div className="bantau-board-panel bantau-own-panel">
          <div className="bantau-panel-heading"><div><p className="eyebrow">HẠM ĐỘI CỦA BẠN · CHỈ XEM</p><h2>{ownPlayer?.nickname ?? 'Bạn'}</h2></div><span>{game.ownFleet.hitCells.length} ô bị trúng</span></div>
          <Grid game={game} kind="own" playerId={playerId} effect={liveEffect} cellScale={cellScale} turnState={isMyTurn ? 'mine' : 'idle'} />
        </div>
        <div className="bantau-side-status"><span className="bantau-status-pip" />{effectMessage ?? (game.notice || (isMyTurn ? 'Chọn ô trên biển đối thủ.' : 'Đang chờ nước đi.'))}</div>
        {game.phase !== 'finished' && <button className="button button-quiet bantau-resign-trigger" type="button" disabled={busy || !connected || !game.capabilities.canResign} onClick={() => setResignOpen(true)}>Chịu thua</button>}
        {game.phase === 'finished' && snapshot.match?.status === 'finished' && me?.isHost && <button className="button button-primary" type="button" disabled={busy || !connected} onClick={onRematch}>Chơi trận mới</button>}
      </div>
      <div className={`bantau-board-panel bantau-target-panel${!isMyTurn && game.phase === 'turn' ? ' is-turn-opponent' : ''}`}>
        <div className="bantau-panel-heading"><div><p className="eyebrow">BIỂN ĐỐI THỦ</p><h2>{otherPlayer?.nickname ?? 'Đối thủ'}</h2></div><span>{game.players.find((player) => player.id !== playerId)?.sunkCount ?? 0}/{game.shipCount} tàu chìm</span></div>
        <Grid game={game} kind="target" playerId={playerId} effect={liveEffect} aim={myAim} aimPending={aimPending} turnState={!isMyTurn && game.phase === 'turn' ? 'opponent' : 'idle'} onCell={chooseTarget} cellScale={cellScale} interactive={game.capabilities.canAim && !busy && !aimPending} />
        <p className="bantau-target-hint">{game.phase === 'turn' && isMyTurn ? myAim ? aimPending ? `Đang xác nhận ${formatCell(myAim.cell.row * game.boardSize + myAim.cell.col, game.boardSize)}…` : `Đang nhắm ${formatCell(myAim.cell.row * game.boardSize + myAim.cell.col, game.boardSize)} · chạm lại để bắn` : 'Chạm một ô để ngắm' : game.phase === 'resolving' ? 'Đang xử lý kết quả nước bắn' : game.phase === 'finished' ? 'Ván đã kết thúc' : 'Đang chờ đối thủ bắn'}</p>
      </div>
    </section>}

    <div className="bantau-bottom-tools" aria-label="Điều chỉnh bàn"><span>Thu phóng bàn</span><button type="button" aria-label="Thu nhỏ bàn" disabled={cellScale <= 0.8} onClick={() => setCellScale((scale) => Math.max(0.8, Number((scale - 0.2).toFixed(1))))}>−</button><output>{Math.round(cellScale * 100)}%</output><button type="button" aria-label="Phóng to bàn" disabled={cellScale >= 1.6} onClick={() => setCellScale((scale) => Math.min(1.6, Number((scale + 0.2).toFixed(1))))}>+</button></div>

    {resignOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setResignOpen(false); }}><section className="modal-card bantau-resign-dialog" role="dialog" aria-modal="true" aria-labelledby="bantau-resign-title"><button className="icon-button modal-close" type="button" aria-label="Đóng" onClick={() => setResignOpen(false)}>×</button><p className="eyebrow">KẾT THÚC VÁN</p><h2 id="bantau-resign-title">Chịu thua ván này?</h2><p className="modal-intro">Đối thủ sẽ thắng ván và nhận 10 điểm. Trận sẽ tự sang ván tiếp nếu chưa đạt điểm mục tiêu.</p><div className="settings-dialog-actions"><button className="button button-quiet" type="button" onClick={() => setResignOpen(false)}>Tiếp tục chơi</button><button className="button button-primary" type="button" disabled={busy || !connected} onClick={() => { setResignOpen(false); void onAction({ type: 'resign', gameId: game.gameId }); }}>Chịu thua</button></div></section></div>}
    <button className="bantau-rules-link" type="button" onClick={onRules}>Luật và nguồn tham khảo</button>
  </div>;
}
