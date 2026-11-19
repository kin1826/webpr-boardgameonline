import { Chess, SQUARES, type Move, type Square } from 'chess.js';

export const COVUA_RULES_VERSION = 'HQ-COVUA-1';
export type Color = 'white' | 'black';
export type Role = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type Piece = { id: string; color: Color; role: Role };
export type Player = { id: string; nickname: string; color: Color };
export type ChessMove = { from: Square; to: Square; promotion?: 'queen' | 'rook' | 'bishop' | 'knight' };
export type FinishReason = 'checkmate' | 'stalemate' | 'repetition-claim' | 'fifty-move-claim' | 'fivefold' | 'seventy-five-move' | 'insufficient-material' | 'timeout' | 'timeout-draw' | 'resign' | 'resign-draw' | 'draw-agreement';
export type Intent = { type: 'move'; turnId: string; move: ChessMove } | { type: 'offerDraw'; turnId: string } | { type: 'respondDraw'; offerId: string; accept: boolean } | { type: 'claimDraw'; turnId: string; reason: 'repetition' | 'fifty-move'; intendedMove?: ChessMove } | { type: 'resign' };
export type LastMove = { id: string; ply: number; actorId: string; pieceId: string; from: Square; to: Square; capturedPieceId?: string; captureSquare?: Square; promotion?: Role; rookMove?: { pieceId: string; from: Square; to: Square }; san: string; gaveCheck: boolean };
export type State = { rulesVersion: typeof COVUA_RULES_VERSION; gameId: string; revision: number; fen: string; history: ChessMove[]; positionKeys: string[]; board: Record<Square, Piece | null>; players: Player[]; currentColor: Color; turnId: string; phase: 'turn' | 'finished'; lastMove: LastMove | null; historySan: string[]; drawOffer: null | { id: string; offeredBy: Color; ply: number }; lastOfferPly: Record<Color, number>; clock: null | { initialMs: number; incrementMs: number; remainingMs: Record<Color, number>; deadlineAt: number | null; pausedRemainingMs: number | null }; winnerColor: Color | null; finishReason: FinishReason | null; notice: string | null };
export class RuleError extends Error { constructor(readonly code: string, message: string) { super(message); this.name = 'CovuaRuleError'; } }
const roles: Record<string, Role> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const symbols: Record<string, string> = { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' };
const colorOf = (symbol: string): Color => symbol === 'w' ? 'white' : 'black';
const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
const squareOk = (square: string): square is Square => /^[a-h][1-8]$/.test(square);
const clone = (state: State): State => structuredClone(state);
const engine = (state: State): Chess => { const chess = new Chess(); for (const move of state.history) chess.move({ from: move.from, to: move.to, promotion: move.promotion ? symbols[move.promotion] : undefined }); return chess; };
function positionKey(chess: Chess): string { const fields = chess.fen().split(' '); const ep = fields[3] === '-' ? '-' : chess.moves({ verbose: true }).some((move) => move.isEnPassant()) ? fields[3] : '-'; return `${fields[0]} ${fields[1]} ${fields[2]} ${ep}`; }
function dead(board: Record<Square, Piece | null>): boolean {
  const pieces = Object.entries(board).filter((entry): entry is [Square, Piece] => !!entry[1] && entry[1].role !== 'king');
  if (!pieces.length) return true;
  if (pieces.length === 1 && ['bishop', 'knight'].includes(pieces[0]![1].role)) return true;
  if (pieces.every(([, piece]) => piece.role === 'bishop')) return new Set(pieces.map(([square]) => (square.charCodeAt(0) + Number(square[1])) % 2)).size === 1;
  return false;
}
function end(state: State, winnerColor: Color | null, reason: FinishReason, notice: string) { state.phase = 'finished'; state.winnerColor = winnerColor; state.finishReason = reason; state.notice = notice; state.drawOffer = null; if (state.clock) state.clock.deadlineAt = null; }
function materialForTimeout(state: State, winner: Color): boolean { return Object.values(state.board).some((piece) => piece?.color === winner && piece.role !== 'king') && !dead(state.board); }
export function createGame(input: { gameId: string; players: Array<{ id: string; nickname: string }>; randomInt: (max: number) => number; now: number; whitePlayerId?: string; clock?: { initialMs: number; incrementMs: number } | null }): State {
  if (input.players.length !== 2 || input.players[0]?.id === input.players[1]?.id) throw new RuleError('PLAYER_COUNT', 'Cờ vua cần đúng hai người.');
  const whiteIndex = input.whitePlayerId === undefined ? input.randomInt(2) : input.players.findIndex((p) => p.id === input.whitePlayerId);
  if (whiteIndex < 0 || whiteIndex > 1) throw new RuleError('INVALID_WHITE_PLAYER', 'Không xác định người cầm Trắng.');
  const config = input.clock === undefined ? { initialMs: 600_000, incrementMs: 3_000 } : input.clock;
  if (config && (!Number.isInteger(config.initialMs) || config.initialMs < 60_000 || !Number.isInteger(config.incrementMs) || config.incrementMs < 0)) throw new RuleError('INVALID_CLOCK', 'Đồng hồ không hợp lệ.');
  const chess = new Chess(); const board = {} as Record<Square, Piece | null>;
  for (const square of SQUARES) { const piece = chess.get(square); board[square] = piece ? { id: `${piece.color}-${square}`, color: colorOf(piece.color), role: roles[piece.type]! } : null; }
  return { rulesVersion: COVUA_RULES_VERSION, gameId: input.gameId, revision: 0, fen: chess.fen(), history: [], positionKeys: [positionKey(chess)], board, players: [{ ...input.players[whiteIndex]!, color: 'white' }, { ...input.players[1 - whiteIndex]!, color: 'black' }], currentColor: 'white', turnId: `${input.gameId}:turn:0`, phase: 'turn', lastMove: null, historySan: [], drawOffer: null, lastOfferPly: { white: -10, black: -10 }, clock: config ? { initialMs: config.initialMs, incrementMs: config.incrementMs, remainingMs: { white: config.initialMs, black: config.initialMs }, deadlineAt: input.now + config.initialMs, pausedRemainingMs: null } : null, winnerColor: null, finishReason: null, notice: 'Trắng đi trước.' };
}
export function expireDeadline(state: State, now: number): State | null { if (state.phase !== 'turn' || !state.clock || state.clock.deadlineAt === null || now < state.clock.deadlineAt) return null; const next = clone(state); const winner = opposite(state.currentColor); end(next, materialForTimeout(next, winner) ? winner : null, materialForTimeout(next, winner) ? 'timeout' : 'timeout-draw', 'Hết giờ.'); next.revision++; return next; }
export function pauseGame(state: State, now: number): State { const next = clone(state); if (next.phase === 'turn' && next.clock?.deadlineAt !== null && next.clock) { next.clock.pausedRemainingMs = Math.max(0, next.clock.deadlineAt - now); next.clock.deadlineAt = null; } return next; }
export function resumeGame(state: State, now: number): State { const next = clone(state); if (next.phase === 'turn' && next.clock && next.clock.pausedRemainingMs !== null) { next.clock.deadlineAt = now + next.clock.pausedRemainingMs; next.clock.pausedRemainingMs = null; } return next; }
function validateMove(chess: Chess, move: ChessMove): Move { if (!squareOk(move.from) || !squareOk(move.to)) throw new RuleError('INVALID_SQUARE', 'Ô cờ không hợp lệ.'); const candidates = chess.moves({ verbose: true }).filter((item) => item.from === move.from && item.to === move.to); if (!candidates.length) throw new RuleError('ILLEGAL_MOVE', 'Nước đi không hợp lệ.'); const promotion = candidates.some((item) => item.isPromotion()); if (promotion && !move.promotion) throw new RuleError('PROMOTION_REQUIRED', 'Hãy chọn quân phong cấp.'); if (!promotion && move.promotion) throw new RuleError('INVALID_PROMOTION', 'Nước này không phong cấp.'); const selected = candidates.find((item) => (item.promotion ? roles[item.promotion] : undefined) === move.promotion); if (!selected) throw new RuleError('INVALID_PROMOTION', 'Quân phong cấp không hợp lệ.'); return selected; }
function applyMove(state: State, chess: Chess, move: ChessMove, now: number): void {
  const checked = validateMove(chess, move); const actor = state.currentColor; const piece = state.board[move.from]!; const captureSquare: Square = checked.isEnPassant() ? `${move.to[0]}${Number(move.to[1]) + (actor === 'white' ? -1 : 1)}` as Square : move.to; const captured = state.board[captureSquare];
  const rookFrom: Square | null = checked.isKingsideCastle() ? (actor === 'white' ? 'h1' : 'h8') : checked.isQueensideCastle() ? (actor === 'white' ? 'a1' : 'a8') : null;
  const rookTo: Square | null = checked.isKingsideCastle() ? (actor === 'white' ? 'f1' : 'f8') : checked.isQueensideCastle() ? (actor === 'white' ? 'd1' : 'd8') : null;
  chess.move({ from: move.from, to: move.to, promotion: move.promotion ? symbols[move.promotion] : undefined });
  state.board[move.from] = null; state.board[move.to] = { ...piece, role: move.promotion ?? piece.role }; if (checked.isEnPassant()) state.board[captureSquare] = null;
  const rook = rookFrom ? state.board[rookFrom] : null; if (rookFrom && rookTo && rook) { state.board[rookFrom] = null; state.board[rookTo] = rook; }
  state.history.push(move); state.historySan.push(checked.san); state.fen = chess.fen(); state.positionKeys.push(positionKey(chess)); state.currentColor = opposite(actor); state.turnId = `${state.gameId}:turn:${state.history.length}`;
  state.lastMove = { id: `${state.gameId}:move:${state.history.length}`, ply: state.history.length, actorId: state.players.find((player) => player.color === actor)!.id, pieceId: piece.id, from: move.from, to: move.to, ...(captured ? { capturedPieceId: captured.id, captureSquare } : {}), ...(move.promotion ? { promotion: move.promotion } : {}), ...(rookFrom && rookTo && rook ? { rookMove: { pieceId: rook.id, from: rookFrom, to: rookTo } } : {}), san: checked.san, gaveCheck: chess.isCheck() };
  state.drawOffer = null;
  if (state.clock && state.clock.deadlineAt !== null) { const left = Math.max(0, state.clock.deadlineAt - now); state.clock.remainingMs[actor] = left + state.clock.incrementMs; state.clock.deadlineAt = now + state.clock.remainingMs[state.currentColor]; }
  if (chess.isCheckmate()) end(state, actor, 'checkmate', `${actor === 'white' ? 'Trắng' : 'Đen'} chiếu bí và thắng ván.`);
  else if (chess.isStalemate()) end(state, null, 'stalemate', 'Hòa do hết nước đi hợp lệ.');
  else if (dead(state.board)) end(state, null, 'insufficient-material', 'Hòa do không đủ quân để chiếu bí.');
  else if (state.positionKeys.filter((key) => key === state.positionKeys.at(-1)).length >= 5) end(state, null, 'fivefold', 'Hòa do cùng thế cờ lặp năm lần.');
  else if (Number(chess.fen().split(' ')[4]) >= 150) end(state, null, 'seventy-five-move', 'Hòa sau 75 nước mỗi bên không đi Tốt hoặc bắt quân.');
  else state.notice = chess.isCheck() ? `${state.currentColor === 'white' ? 'Trắng' : 'Đen'} đang bị chiếu.` : `${state.currentColor === 'white' ? 'Trắng' : 'Đen'} tới lượt.`;
}
export function applyAction(state: State, actorId: string, intent: Intent, now: number): State {
  if (state.phase !== 'turn') throw new RuleError('GAME_FINISHED', 'Ván đã kết thúc.');
  if (state.clock && state.clock.deadlineAt === null && state.clock.pausedRemainingMs !== null) throw new RuleError('GAME_PAUSED', 'Ván đang tạm dừng.');
  if (expireDeadline(state, now)) throw new RuleError('TURN_EXPIRED', 'Lượt đã hết giờ.');
  const player = state.players.find((item) => item.id === actorId); if (!player) throw new RuleError('NOT_PLAYER', 'Bạn không ở trong ván.');
  const next = clone(state); const chess = engine(next); const isTurn = player.color === next.currentColor;
  if (intent.type === 'move') { if (!isTurn) throw new RuleError('NOT_YOUR_TURN', 'Chưa tới lượt bạn.'); if (intent.turnId !== next.turnId) throw new RuleError('STALE_TURN', 'Lượt đã thay đổi.'); applyMove(next, chess, intent.move, now); }
  else if (intent.type === 'offerDraw') { if (!isTurn) throw new RuleError('NOT_YOUR_TURN', 'Chưa tới lượt bạn.'); if (intent.turnId !== next.turnId) throw new RuleError('STALE_TURN', 'Lượt đã thay đổi.'); if (next.history.length - next.lastOfferPly[player.color] < 10) throw new RuleError('DRAW_OFFER_COOLDOWN', 'Vui lòng chờ trước khi đề nghị hòa tiếp.'); next.drawOffer = { id: `${next.gameId}:offer:${next.revision + 1}`, offeredBy: player.color, ply: next.history.length }; next.lastOfferPly[player.color] = next.history.length; next.notice = `${player.nickname} đề nghị hòa.`; }
  else if (intent.type === 'respondDraw') { if (!next.drawOffer || next.drawOffer.id !== intent.offerId || next.drawOffer.offeredBy === player.color) throw new RuleError('DRAW_OFFER_EXPIRED', 'Đề nghị hòa không còn hiệu lực.'); if (intent.accept) end(next, null, 'draw-agreement', 'Hai bên đồng ý hòa.'); else { next.drawOffer = null; next.notice = 'Đề nghị hòa đã bị từ chối.'; } }
  else if (intent.type === 'claimDraw') { if (!isTurn) throw new RuleError('NOT_YOUR_TURN', 'Chưa tới lượt bạn.'); if (intent.turnId !== next.turnId) throw new RuleError('STALE_TURN', 'Lượt đã thay đổi.'); let key = next.positionKeys.at(-1)!; let halfmove = Number(chess.fen().split(' ')[4]); if (intent.intendedMove) { validateMove(chess, intent.intendedMove); const probe = engine(next); probe.move({ from: intent.intendedMove.from, to: intent.intendedMove.to, promotion: intent.intendedMove.promotion ? symbols[intent.intendedMove.promotion] : undefined }); key = positionKey(probe); halfmove = Number(probe.fen().split(' ')[4]); } const valid = intent.reason === 'repetition' ? next.positionKeys.filter((item) => item === key).length + Number(Boolean(intent.intendedMove)) >= 3 : halfmove >= 100; if (!valid) throw new RuleError('DRAW_CLAIM_INVALID', 'Chưa đủ điều kiện yêu cầu hòa.'); end(next, null, intent.reason === 'repetition' ? 'repetition-claim' : 'fifty-move-claim', 'Hòa theo yêu cầu hợp lệ.'); }
  else { const winner = opposite(player.color); end(next, materialForTimeout(next, winner) ? winner : null, materialForTimeout(next, winner) ? 'resign' : 'resign-draw', `${player.nickname} xin thua.`); }
  next.revision++; return next;
}
export function projectGame(state: State, viewerId: string | null, now: number, local = false) {
  const viewerColor = state.players.find((player) => player.id === viewerId)?.color ?? null; const canMove = state.phase === 'turn' && (local || viewerColor === state.currentColor) && (!state.clock || state.clock.pausedRemainingMs === null);
  const clock = state.clock ? { ...state.clock, remainingMs: { ...state.clock.remainingMs }, serverNow: now } : null;
  if (clock && state.phase === 'turn') clock.remainingMs[state.currentColor] = Math.max(0, clock.deadlineAt !== null ? clock.deadlineAt - now : clock.pausedRemainingMs ?? clock.remainingMs[state.currentColor]);
  const chess = engine(state); const moves = canMove ? chess.moves({ verbose: true }) : [];
  const legalMoves = moves.map((move) => ({ from: move.from, to: move.to, ...(move.promotion ? { promotion: roles[move.promotion] as 'queen' | 'rook' | 'bishop' | 'knight' } : {}) }));
  const currentKey = state.positionKeys.at(-1)!; const count = state.positionKeys.filter((key) => key === currentKey).length; const halfmove = Number(chess.fen().split(' ')[4]);
  return { rulesVersion: state.rulesVersion, gameId: state.gameId, revision: state.revision, board: state.board, players: state.players, currentColor: state.phase === 'turn' ? state.currentColor : null, turnId: state.turnId, phase: state.phase, lastMove: state.lastMove, history: state.historySan.slice(-100), historyCount: state.historySan.length, checkedColor: chess.isCheck() ? state.currentColor : null, drawOffer: state.drawOffer, repetitionCount: count, halfmovePlies: halfmove, clock, winnerColor: state.winnerColor, finishReason: state.finishReason, notice: state.notice, viewerColor, legalMoves, capabilities: { canMove, canOfferDraw: canMove && state.history.length - state.lastOfferPly[state.currentColor] >= 10, canRespondDraw: state.phase === 'turn' && !!state.drawOffer && (local || viewerColor !== state.drawOffer.offeredBy), canResign: state.phase === 'turn' && (local || viewerColor !== null), canClaimDrawNow: canMove && (count >= 3 || halfmove >= 100) }, claimReasons: (canMove ? [...(count >= 3 ? ['repetition'] : []), ...(halfmove >= 100 ? ['fifty-move'] : [])] : []) as Array<'repetition' | 'fifty-move'> };
}
export const perft = (depth: number): number => { const chess = new Chess(); const visit = (remaining: number): number => { if (!remaining) return 1; let total = 0; for (const move of chess.moves({ verbose: true })) { chess.move(move); total += visit(remaining - 1); chess.undo(); } return total; }; return visit(depth); };
