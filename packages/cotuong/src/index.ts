export const COTUONG_RULES_VERSION = 'HQ-COTUONG-1';
export const COTUONG_ROWS = 10;
export const COTUONG_COLS = 9;
export const COTUONG_CELLS = COTUONG_ROWS * COTUONG_COLS;
export const COTUONG_DEFAULT_CLOCK_MS = 10 * 60_000;
export const COTUONG_DEFAULT_INCREMENT_MS = 3_000;
export const COTUONG_TURN_MS = 30_000;
export type CotuongSide = 'red' | 'black';
export type CotuongRole = 'general' | 'advisor' | 'elephant' | 'chariot' | 'horse' | 'cannon' | 'soldier';
export type CotuongPiece = { id: string; side: CotuongSide; role: CotuongRole };
export type CotuongPoint = { row: number; col: number };
export type CotuongMove = { from: CotuongPoint; to: CotuongPoint };
export type CotuongFinishReason = 'checkmate' | 'stalemate' | 'perpetual-check' | 'repetition' | 'no-attacking-material' | 'no-capture-limit' | 'timeout' | 'resign' | 'draw-agreement';
export type CotuongPlayer = { id: string; nickname: string; side: CotuongSide };
export type CotuongHistoryEntry = CotuongMove & { ply: number; side: CotuongSide; piece: CotuongRole; captured: CotuongRole | null; gaveCheck: boolean; notation: string };
export type CotuongState = {
  rulesVersion: typeof COTUONG_RULES_VERSION;
  gameId: string;
  revision: number;
  board: Array<CotuongPiece | null>;
  players: CotuongPlayer[];
  currentSide: CotuongSide;
  turnId: string;
  phase: 'turn' | 'finished';
  lastMove: CotuongHistoryEntry | null;
  checkedSide: CotuongSide | null;
  checkHistory: Array<{ ply: number; side: CotuongSide }>;
  history: CotuongHistoryEntry[];
  historyCount: number;
  noCapturePlies: number;
  positionHistory: Array<{ key: string; ply: number; side: CotuongSide }>;
  lastOfferPly: Record<CotuongSide, number>;
  drawOffer: null | { id: string; offeredBy: CotuongSide; ply: number };
  clock: null | { initialMs: number; incrementMs: number; remainingMs: Record<CotuongSide, number>; deadlineAt: number | null; pausedRemainingMs: number | null };
  winnerSide: CotuongSide | null;
  finishReason: CotuongFinishReason | null;
  notice: string | null;
};
export type CotuongIntent =
  | { type: 'move'; from: CotuongPoint; to: CotuongPoint; turnId: string }
  | { type: 'offerDraw'; turnId: string }
  | { type: 'respondDraw'; offerId: string; accept: boolean }
  | { type: 'resign' };
export type CotuongPublicGame = {
  rulesVersion: typeof COTUONG_RULES_VERSION;
  gameId: string;
  revision: number;
  board: Array<CotuongPiece | null>;
  players: CotuongPlayer[];
  currentSide: CotuongSide | null;
  turnId: string;
  phase: 'turn' | 'finished';
  lastMove: CotuongHistoryEntry | null;
  checkedSide: CotuongSide | null;
  checkHistory: Array<{ ply: number; side: CotuongSide }>;
  history: CotuongHistoryEntry[];
  historyCount: number;
  noCapturePlies: number;
  repetitionCount: number;
  repetitionWarning: boolean;
  drawOffer: CotuongState['drawOffer'];
  clock: null | { initialMs: number; remainingMs: Record<CotuongSide, number>; deadlineAt: number | null; serverNow: number; pausedRemainingMs: number | null; incrementMs: number };
  winnerSide: CotuongSide | null;
  finishReason: CotuongFinishReason | null;
  notice: string | null;
  viewerSide: CotuongSide | null;
  legalMoves: CotuongMove[];
  capabilities: { canMove: boolean; canOfferDraw: boolean; canRespondDraw: boolean; canResign: boolean };
};

export class CotuongRuleError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'CotuongRuleError'; }
}

const other = (side: CotuongSide): CotuongSide => side === 'red' ? 'black' : 'red';
const indexOf = (row: number, col: number) => row * COTUONG_COLS + col;
const inside = (row: number, col: number) => row >= 0 && row < COTUONG_ROWS && col >= 0 && col < COTUONG_COLS;
const inPalace = (side: CotuongSide, row: number, col: number) => col >= 3 && col <= 5 && (side === 'red' ? row >= 7 && row <= 9 : row >= 0 && row <= 2);
const crossedRiver = (side: CotuongSide, row: number) => side === 'red' ? row <= 4 : row >= 5;
const sideGlyph: Record<CotuongSide, string> = { red: 'Đỏ', black: 'Đen' };

function initialBoard(): Array<CotuongPiece | null> {
  const board: Array<CotuongPiece | null> = Array.from({ length: COTUONG_CELLS }, () => null);
  const back: CotuongRole[] = ['chariot', 'horse', 'elephant', 'advisor', 'general', 'advisor', 'elephant', 'horse', 'chariot'];
  for (let col = 0; col < COTUONG_COLS; col++) {
    board[indexOf(0, col)] = { id: `black-${back[col]}-${col}`, side: 'black', role: back[col]! };
    board[indexOf(9, col)] = { id: `red-${back[col]}-${col}`, side: 'red', role: back[col]! };
  }
  for (const col of [1, 7]) {
    board[indexOf(2, col)] = { id: `black-cannon-${col}`, side: 'black', role: 'cannon' };
    board[indexOf(7, col)] = { id: `red-cannon-${col}`, side: 'red', role: 'cannon' };
  }
  for (const col of [0, 2, 4, 6, 8]) {
    board[indexOf(3, col)] = { id: `black-soldier-${col}`, side: 'black', role: 'soldier' };
    board[indexOf(6, col)] = { id: `red-soldier-${col}`, side: 'red', role: 'soldier' };
  }
  return board;
}

function positionKey(board: Array<CotuongPiece | null>, currentSide: CotuongSide): string {
  return currentSide + ':' + board.map((piece) => piece ? `${piece.side === 'red' ? 'r' : 'b'}:${piece.role}` : '.').join('|');
}

function generalPosition(board: Array<CotuongPiece | null>, side: CotuongSide): CotuongPoint | null {
  const index = board.findIndex((piece) => piece?.side === side && piece.role === 'general');
  return index < 0 ? null : { row: Math.floor(index / COTUONG_COLS), col: index % COTUONG_COLS };
}

function pseudoMoves(board: Array<CotuongPiece | null>, side: CotuongSide): CotuongMove[] {
  const moves: CotuongMove[] = [];
  const add = (from: CotuongPoint, row: number, col: number) => {
    if (!inside(row, col)) return false;
    const target = board[indexOf(row, col)];
    if (target?.side === side) return false;
    moves.push({ from, to: { row, col } });
    return target === null;
  };
  for (let start = 0; start < board.length; start++) {
    const piece = board[start];
    if (!piece || piece.side !== side) continue;
    const from = { row: Math.floor(start / COTUONG_COLS), col: start % COTUONG_COLS };
    const { row, col } = from;
    if (piece.role === 'general') {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (inPalace(side, row + dr, col + dc)) add(from, row + dr, col + dc);
      const enemyGeneral = generalPosition(board, other(side));
      if (enemyGeneral?.col === col) {
        const step = Math.sign(enemyGeneral.row - row);
        let clear = true;
        for (let r = row + step; r !== enemyGeneral.row; r += step) if (board[indexOf(r, col)]) { clear = false; break; }
        if (clear) moves.push({ from, to: enemyGeneral });
      }
    } else if (piece.role === 'advisor') {
      for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) if (inPalace(side, row + dr, col + dc)) add(from, row + dr, col + dc);
    } else if (piece.role === 'elephant') {
      for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]] as const) {
        const toRow = row + dr; const toCol = col + dc; const eyeRow = row + dr / 2; const eyeCol = col + dc / 2;
        const ownHalf = side === 'red' ? toRow >= 5 : toRow <= 4;
        if (inside(toRow, toCol) && ownHalf && !board[indexOf(eyeRow, eyeCol)]) add(from, toRow, toCol);
      }
    } else if (piece.role === 'horse') {
      for (const [dr, dc, lr, lc] of [[2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0], [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1]] as const) {
        if (!board[indexOf(row + lr, col + lc)]) add(from, row + dr, col + dc);
      }
    } else if (piece.role === 'chariot' || piece.role === 'cannon') {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        let screened = false;
        for (let r = row + dr, c = col + dc; inside(r, c); r += dr, c += dc) {
          const occupant = board[indexOf(r, c)];
          if (piece.role === 'chariot') {
            if (occupant) { if (occupant.side !== side) moves.push({ from, to: { row: r, col: c } }); break; }
            moves.push({ from, to: { row: r, col: c } });
          } else if (!screened) {
            if (!occupant) moves.push({ from, to: { row: r, col: c } });
            else screened = true;
          } else if (occupant) {
            if (occupant.side !== side) moves.push({ from, to: { row: r, col: c } });
            break;
          }
        }
      }
    } else {
      const forward = side === 'red' ? -1 : 1;
      add(from, row + forward, col);
      if (crossedRiver(side, row)) { add(from, row, col - 1); add(from, row, col + 1); }
    }
  }
  return moves;
}

function movedBoard(board: Array<CotuongPiece | null>, move: CotuongMove): Array<CotuongPiece | null> {
  const next = board.slice();
  const from = indexOf(move.from.row, move.from.col); const to = indexOf(move.to.row, move.to.col);
  next[to] = next[from]!; next[from] = null;
  return next;
}

function isInCheck(board: Array<CotuongPiece | null>, side: CotuongSide): boolean {
  const general = generalPosition(board, side);
  if (!general) return true;
  return pseudoMoves(board, other(side)).some((move) => move.to.row === general.row && move.to.col === general.col);
}

function legalMovesFor(board: Array<CotuongPiece | null>, side: CotuongSide): CotuongMove[] {
  return pseudoMoves(board, side).filter((move) => {
    const target = board[indexOf(move.to.row, move.to.col)];
    if (target?.role === 'general') return false;
    return !isInCheck(movedBoard(board, move), side);
  });
}

function onlyMinorGenerals(board: Array<CotuongPiece | null>): boolean {
  return board.every((piece) => !piece || piece.role === 'general' || piece.role === 'advisor' || piece.role === 'elephant');
}

function notation(piece: CotuongPiece, move: CotuongMove): string {
  const files = piece.side === 'red' ? '一二三四五六七八九' : '１２３４５６７８９';
  return `${sideGlyph[piece.side]}${piece.role} ${files[move.from.col]}${move.from.row + 1}→${files[move.to.col]}${move.to.row + 1}`;
}

function finish(state: CotuongState, winnerSide: CotuongSide | null, reason: CotuongFinishReason, message: string) {
  state.phase = 'finished'; state.currentSide = state.currentSide; state.winnerSide = winnerSide; state.finishReason = reason; state.notice = message;
  if (state.clock) state.clock.deadlineAt = null;
  state.drawOffer = null;
}

function adjudicate(state: CotuongState, ply: number): void {
  const side = state.currentSide;
  const legal = legalMovesFor(state.board, side);
  if (legal.length === 0) {
    finish(state, other(side), state.checkedSide === side ? 'checkmate' : 'stalemate', state.checkedSide === side ? `${sideGlyph[side]} bị chiếu bí. ${sideGlyph[other(side)]} thắng.` : `${sideGlyph[side]} hết nước đi hợp lệ. ${sideGlyph[other(side)]} thắng.`);
    return;
  }
  const occurrences = state.positionHistory.filter((entry) => entry.key === positionKey(state.board, side));
  if (occurrences.length >= 4) {
    const first = occurrences[occurrences.length - 4]!.ply; const fourth = occurrences[occurrences.length - 1]!.ply;
    const interval = state.history.filter((entry) => entry.ply > first && entry.ply <= fourth);
    const redMoves = interval.filter((entry) => entry.side === 'red'); const blackMoves = interval.filter((entry) => entry.side === 'black');
    const redChecks = redMoves.length > 0 && redMoves.every((entry) => entry.gaveCheck);
    const blackChecks = blackMoves.length > 0 && blackMoves.every((entry) => entry.gaveCheck);
    if (redChecks !== blackChecks) {
      const loser: CotuongSide = redChecks ? 'red' : 'black';
      finish(state, other(loser), 'perpetual-check', `${sideGlyph[loser]} lặp chiếu liên tục và thua theo HQ-COTUONG-1.`);
    } else finish(state, null, 'repetition', 'Ván hòa do lặp thế bốn lần.');
    return;
  }
  if (onlyMinorGenerals(state.board)) { finish(state, null, 'no-attacking-material', 'Ván hòa do hai bên chỉ còn Tướng, Sĩ và Tượng.'); return; }
  if (state.noCapturePlies >= 120) { finish(state, null, 'no-capture-limit', 'Ván hòa sau 120 nước liên tiếp không có quân bị bắt.'); return; }
  if (state.noCapturePlies >= 100) state.notice = 'Cảnh báo: đã 100 nước liên tiếp không bắt quân; mốc hòa là 120.';
  else if (occurrences.length === 3) state.notice = 'Cảnh báo: thế cờ hiện tại đã lặp ba lần; lần lặp thứ tư sẽ được phân xử theo luật Hội Quậy.';
  else state.notice = state.checkedSide ? `${sideGlyph[side]} đang bị chiếu.` : `${sideGlyph[side]} tới lượt.`;
  void ply;
}

export function createCotuongGame(input: {
  gameId: string;
  players: Array<{ id: string; nickname: string }>;
  randomInt: (max: number) => number;
  now: number;
  redPlayerId?: string;
  clock?: { initialMs: number; incrementMs: number } | null;
}): CotuongState {
  if (input.players.length !== 2 || new Set(input.players.map((p) => p.id)).size !== 2) throw new CotuongRuleError('PLAYER_COUNT', 'Cờ tướng cần đúng hai người chơi khác nhau.');
  const redIndex = input.redPlayerId === undefined ? input.randomInt(2) : input.players.findIndex((p) => p.id === input.redPlayerId);
  if (redIndex < 0 || redIndex > 1) throw new CotuongRuleError('INVALID_RED_PLAYER', 'Không xác định được người cầm Đỏ.');
  const clockConfig = input.clock === undefined ? { initialMs: COTUONG_DEFAULT_CLOCK_MS, incrementMs: COTUONG_DEFAULT_INCREMENT_MS } : input.clock;
  if (clockConfig && (!Number.isInteger(clockConfig.initialMs) || clockConfig.initialMs < 60_000 || clockConfig.initialMs > 60 * 60_000 || !Number.isInteger(clockConfig.incrementMs) || clockConfig.incrementMs < 0 || clockConfig.incrementMs > 30_000)) throw new CotuongRuleError('INVALID_CLOCK', 'Cấu hình đồng hồ Cờ tướng không hợp lệ.');
  const redPlayer = input.players[redIndex]!; const blackPlayer = input.players[1 - redIndex]!;
  const state: CotuongState = {
    rulesVersion: COTUONG_RULES_VERSION, gameId: input.gameId, revision: 0, board: initialBoard(),
    players: [{ ...redPlayer, side: 'red' }, { ...blackPlayer, side: 'black' }], currentSide: 'red', turnId: `${input.gameId}:turn:0`, phase: 'turn', lastMove: null, checkedSide: null,
    checkHistory: [], history: [], historyCount: 0, noCapturePlies: 0, positionHistory: [], lastOfferPly: { red: -10, black: -10 }, drawOffer: null,
    clock: clockConfig ? { initialMs: clockConfig.initialMs, incrementMs: clockConfig.incrementMs, remainingMs: { red: clockConfig.initialMs, black: clockConfig.initialMs }, deadlineAt: input.now + clockConfig.initialMs, pausedRemainingMs: null } : null,
    winnerSide: null, finishReason: null, notice: 'Đỏ đi trước.',
  };
  state.positionHistory.push({ key: positionKey(state.board, state.currentSide), ply: 0, side: state.currentSide });
  return state;
}

function assertPoint(point: CotuongPoint): boolean { return Number.isInteger(point.row) && Number.isInteger(point.col) && inside(point.row, point.col); }
function requirePlayer(state: CotuongState, playerId: string): CotuongPlayer {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) throw new CotuongRuleError('PLAYER_NOT_IN_GAME', 'Bạn không còn trong ván này.');
  return player;
}

export function legalCotuongMoves(state: CotuongState, side: CotuongSide = state.currentSide): CotuongMove[] {
  if (state.phase !== 'turn') return [];
  return legalMovesFor(state.board, side);
}

export function applyCotuongAction(before: CotuongState, actorId: string, intent: CotuongIntent, now: number): CotuongState {
  if (before.phase !== 'turn') throw new CotuongRuleError('GAME_FINISHED', 'Ván Cờ tướng đã kết thúc.');
  const actor = requirePlayer(before, actorId);
  if (before.clock?.deadlineAt !== null && before.clock && now >= before.clock.deadlineAt) throw new CotuongRuleError('TURN_EXPIRED', 'Đồng hồ đã hết. Bàn cờ đang cập nhật kết quả.');
  if (intent.type === 'resign') {
    const state = structuredClone(before); finish(state, other(actor.side), 'resign', `${actor.nickname} xin thua. ${sideGlyph[other(actor.side)]} thắng.`); state.revision++; return state;
  }
  if (intent.type === 'respondDraw') {
    if (!before.drawOffer || before.drawOffer.id !== intent.offerId) throw new CotuongRuleError('STALE_OFFER', 'Lời đề nghị hòa đã hết hiệu lực.');
    if (actor.side === before.drawOffer.offeredBy) throw new CotuongRuleError('OWN_OFFER', 'Người đề nghị không thể tự trả lời lời đề nghị hòa.');
    const state = structuredClone(before); state.drawOffer = null;
    if (intent.accept) finish(state, null, 'draw-agreement', 'Hai bên đồng ý hòa.');
    else { state.lastOfferPly[before.drawOffer.offeredBy] = before.drawOffer.ply; state.notice = 'Đề nghị hòa đã bị từ chối.'; }
    state.revision++; return state;
  }
  if (intent.turnId !== before.turnId) throw new CotuongRuleError('STALE_TURN', 'Lượt đã thay đổi. Bàn cờ đang được cập nhật.');
  if (actor.side !== before.currentSide) throw new CotuongRuleError('NOT_YOUR_TURN', 'Chưa tới lượt bạn.');
  if (intent.type === 'offerDraw') {
    const ply = before.historyCount;
    if (before.drawOffer) throw new CotuongRuleError('OFFER_PENDING', 'Đang chờ đối thủ trả lời đề nghị hòa.');
    if (ply - before.lastOfferPly[actor.side] < 10) throw new CotuongRuleError('OFFER_COOLDOWN', 'Mỗi bên chỉ đề nghị hòa một lần trong 10 nước.');
    const state = structuredClone(before); state.drawOffer = { id: `${before.gameId}:draw:${before.revision + 1}`, offeredBy: actor.side, ply }; state.lastOfferPly[actor.side] = ply; state.notice = `${actor.nickname} đề nghị hòa.`; state.revision++; return state;
  }
  if (!assertPoint(intent.from) || !assertPoint(intent.to) || (intent.from.row === intent.to.row && intent.from.col === intent.to.col)) throw new CotuongRuleError('INVALID_MOVE', 'Vị trí nước đi không hợp lệ.');
  const piece = before.board[indexOf(intent.from.row, intent.from.col)];
  if (!piece || piece.side !== actor.side) throw new CotuongRuleError('NO_OWN_PIECE', 'Ô xuất phát không có quân của bạn.');
  const target = before.board[indexOf(intent.to.row, intent.to.col)];
  if (target?.side === actor.side) throw new CotuongRuleError('FRIENDLY_OCCUPIED', 'Không thể ăn quân cùng phe.');
  if (target?.role === 'general') throw new CotuongRuleError('GENERAL_CAPTURE', 'Không bắt Tướng; ván kết thúc khi chiếu bí hoặc đối thủ hết nước.');
  const legal = legalMovesFor(before.board, actor.side);
  if (!legal.some((move) => move.from.row === intent.from.row && move.from.col === intent.from.col && move.to.row === intent.to.row && move.to.col === intent.to.col)) throw new CotuongRuleError('ILLEGAL_MOVE', 'Nước đi không đúng luật hoặc khiến Tướng của bạn bị chiếu.');
  const state = structuredClone(before);
  const captured = state.board[indexOf(intent.to.row, intent.to.col)];
  state.board = movedBoard(state.board, intent);
  const ply = state.historyCount + 1; const nextSide = other(actor.side);
  state.currentSide = nextSide; state.turnId = `${state.gameId}:turn:${ply}`; state.lastMove = null; state.drawOffer = null;
  state.noCapturePlies = captured ? 0 : state.noCapturePlies + 1;
  if (captured) state.positionHistory = [];
  const givesCheck = isInCheck(state.board, nextSide);
  const entry: CotuongHistoryEntry = { from: { ...intent.from }, to: { ...intent.to }, ply, side: actor.side, piece: piece.role, captured: captured?.role ?? null, gaveCheck: givesCheck, notation: notation(piece, intent) };
  // Keep the full per-game history on the authoritative server. It is needed to
  // classify a long repetition interval; only the public projection is bounded.
  state.history.push(entry); state.historyCount = ply; state.lastMove = entry;
  state.checkedSide = givesCheck ? nextSide : null;
  if (givesCheck) state.checkHistory.push({ ply, side: actor.side });
  if (state.checkHistory.length > 100) state.checkHistory.shift();
  state.positionHistory.push({ key: positionKey(state.board, nextSide), ply, side: nextSide });
  if (state.clock) {
    state.clock.remainingMs[actor.side] += state.clock.incrementMs;
    state.clock.deadlineAt = now + state.clock.remainingMs[nextSide]!;
    state.clock.pausedRemainingMs = null;
  }
  adjudicate(state, ply);
  state.revision++;
  return state;
}

export function expireCotuongDeadline(before: CotuongState, now: number): CotuongState | null {
  if (before.phase !== 'turn' || !before.clock || before.clock.deadlineAt === null || now < before.clock.deadlineAt) return null;
  const state = structuredClone(before); const loser = state.currentSide;
  state.clock!.remainingMs[loser] = 0; finish(state, other(loser), 'timeout', `${sideGlyph[loser]} hết giờ. ${sideGlyph[other(loser)]} thắng.`); state.revision++;
  return state;
}

export function pauseCotuongGame(before: CotuongState, now: number): CotuongState {
  if (before.phase !== 'turn' || !before.clock || before.clock.deadlineAt === null) return structuredClone(before);
  const state = structuredClone(before); state.clock!.pausedRemainingMs = Math.max(0, state.clock!.deadlineAt! - now); state.clock!.remainingMs[state.currentSide] = state.clock!.pausedRemainingMs!; state.clock!.deadlineAt = null; state.revision++; return state;
}

export function resumeCotuongGame(before: CotuongState, now: number): CotuongState {
  if (before.phase !== 'turn' || !before.clock || before.clock.deadlineAt !== null || before.clock.pausedRemainingMs === null) return structuredClone(before);
  const state = structuredClone(before); state.clock!.deadlineAt = now + state.clock!.pausedRemainingMs!; state.clock!.remainingMs[state.currentSide] = state.clock!.pausedRemainingMs!; state.clock!.pausedRemainingMs = null; state.revision++; return state;
}

export function projectCotuongGame(state: CotuongState, viewerId: string, now: number, paused: boolean): CotuongPublicGame {
  const viewer = state.players.find((player) => player.id === viewerId); const viewerSide = viewer?.side ?? null;
  const currentPositionKey = positionKey(state.board, state.currentSide);
  const repetitionCount = state.positionHistory.filter((entry) => entry.key === currentPositionKey).length;
  const canMove = !paused && state.phase === 'turn' && state.currentSide === viewerSide && (!state.clock || state.clock.deadlineAt !== null && now < state.clock.deadlineAt);
  const canRespondDraw = !paused && state.phase === 'turn' && Boolean(state.drawOffer && viewerSide !== state.drawOffer.offeredBy);
  const ownOfferCooldownReady = viewerSide !== null && state.historyCount - state.lastOfferPly[viewerSide] >= 10;
  return {
    rulesVersion: state.rulesVersion, gameId: state.gameId, revision: state.revision, board: state.board.map((piece) => piece ? { ...piece } : null), players: state.players.map((player) => ({ ...player })), currentSide: state.phase === 'turn' ? state.currentSide : null,
    turnId: state.turnId, phase: state.phase, lastMove: state.lastMove ? structuredClone(state.lastMove) : null, checkedSide: state.checkedSide,
    checkHistory: state.checkHistory.slice(-100).map((entry) => ({ ...entry })), history: state.history.slice(-100).map((entry) => ({ ...entry })), historyCount: state.historyCount, noCapturePlies: state.noCapturePlies,
    repetitionCount, repetitionWarning: repetitionCount >= 3,
    drawOffer: state.drawOffer ? { ...state.drawOffer } : null,
    clock: state.clock ? { initialMs: state.clock.initialMs, remainingMs: { red: state.clock.remainingMs.red, black: state.clock.remainingMs.black }, deadlineAt: paused ? null : state.clock.deadlineAt, serverNow: now, pausedRemainingMs: state.clock.pausedRemainingMs, incrementMs: state.clock.incrementMs } : null,
    winnerSide: state.winnerSide, finishReason: state.finishReason, notice: state.notice, viewerSide,
    legalMoves: canMove ? legalMovesFor(state.board, state.currentSide) : [],
    capabilities: { canMove, canOfferDraw: canMove && !state.drawOffer && ownOfferCooldownReady, canRespondDraw, canResign: !paused && state.phase === 'turn' && viewerSide !== null && (!state.clock || state.clock.deadlineAt !== null && now < state.clock.deadlineAt) },
  };
}
