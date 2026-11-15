export const CARO_BOARD_SIZE = 15;
export const CARO_CELL_COUNT = CARO_BOARD_SIZE * CARO_BOARD_SIZE;
export const CARO_TURN_MS = 30_000;

export type CaroWinLength = 4 | 5 | 6;
export type CaroSymbol = 'X' | 'O';
export type CaroPosition = { row: number; col: number };
export type CaroPlayer = { id: string; nickname: string; symbol: CaroSymbol };
export type CaroFinishReason = 'five' | 'timeout' | 'resign' | 'board-full';
export type CaroState = {
  gameId: string;
  revision: number;
  winLength: CaroWinLength;
  players: CaroPlayer[];
  board: Array<CaroSymbol | null>;
  phase: 'turn' | 'finished';
  currentPlayerId: string | null;
  turnId: string;
  lastMove: (CaroPosition & { playerId: string; symbol: CaroSymbol }) | null;
  winningLines: CaroPosition[][];
  turnDeadlineAt: number | null;
  turnRemainingMs: number | null;
  winnerId: string | null;
  finishReason: CaroFinishReason | null;
  notice: string | null;
};
export type CaroIntent =
  | { type: 'place'; row: number; col: number; turnId: string }
  | { type: 'resign' };
export type CaroPublicGame = {
  gameId: string;
  revision: number;
  winLength: CaroWinLength;
  players: CaroPlayer[];
  board: Array<CaroSymbol | null>;
  phase: CaroState['phase'];
  currentPlayerId: string | null;
  turnId: string;
  lastMove: CaroState['lastMove'];
  winningLines: CaroPosition[][];
  deadlineAt: number | null;
  remainingMs: number | null;
  serverNow: number;
  turnDurationMs: number;
  winnerId: string | null;
  finishReason: CaroFinishReason | null;
  notice: string | null;
  canPlace: boolean;
  canResign: boolean;
  yourSymbol: CaroSymbol | null;
  legalCellIndexes: number[];
};

export class CaroRuleError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'CaroRuleError'; }
}

function randomIndex(randomInt: (max: number) => number, max: number): number {
  const index = randomInt(max);
  if (!Number.isInteger(index) || index < 0 || index >= max) throw new Error('RNG trả chỉ số ngoài phạm vi.');
  return index;
}

export function createCaroGame(input: {
  gameId: string;
  players: Array<{ id: string; nickname: string }>;
  randomInt: (max: number) => number;
  now: number;
  xPlayerId?: string;
  winLength?: CaroWinLength;
}): CaroState {
  const winLength = input.winLength ?? 5;
  if (![4, 5, 6].includes(winLength)) throw new CaroRuleError('INVALID_WIN_LENGTH', 'Chỉ chọn 4, 5 hoặc 6 quân để thắng.');
  if (input.players.length !== 2) throw new CaroRuleError('PLAYER_COUNT', 'Caro cần đúng 2 người chơi.');
  if (new Set(input.players.map((player) => player.id)).size !== 2) throw new CaroRuleError('DUPLICATE_PLAYER', 'Danh sách người chơi bị trùng.');
  const xIndex = input.xPlayerId === undefined ? randomIndex(input.randomInt, 2) : input.players.findIndex((player) => player.id === input.xPlayerId);
  if (xIndex < 0) throw new CaroRuleError('INVALID_X_PLAYER', 'Không tìm thấy người được chọn cầm X.');
  return {
    gameId: input.gameId,
    revision: 0,
    winLength,
    players: input.players.map((player, index) => ({ ...player, symbol: index === xIndex ? 'X' : 'O' })),
    board: Array.from({ length: CARO_CELL_COUNT }, () => null),
    phase: 'turn',
    currentPlayerId: input.players[xIndex]!.id,
    turnId: `${input.gameId}:turn:0`,
    lastMove: null,
    winningLines: [],
    turnDeadlineAt: input.now + CARO_TURN_MS,
    turnRemainingMs: null,
    winnerId: null,
    finishReason: null,
    notice: null,
  };
}

function indexOf(row: number, col: number) { return row * CARO_BOARD_SIZE + col; }
function inBounds(row: number, col: number) { return row >= 0 && row < CARO_BOARD_SIZE && col >= 0 && col < CARO_BOARD_SIZE; }
function playerFor(state: CaroState, playerId: string) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) throw new CaroRuleError('PLAYER_NOT_IN_GAME', 'Bạn không còn trong ván này.');
  return player;
}

function maximalLine(state: CaroState, row: number, col: number, symbol: CaroSymbol, dr: number, dc: number): CaroPosition[] {
  const backwards: CaroPosition[] = [];
  for (let step = 1; inBounds(row - dr * step, col - dc * step) && state.board[indexOf(row - dr * step, col - dc * step)] === symbol; step++) {
    backwards.unshift({ row: row - dr * step, col: col - dc * step });
  }
  const forwards: CaroPosition[] = [];
  for (let step = 1; inBounds(row + dr * step, col + dc * step) && state.board[indexOf(row + dr * step, col + dc * step)] === symbol; step++) {
    forwards.push({ row: row + dr * step, col: col + dc * step });
  }
  return [...backwards, { row, col }, ...forwards];
}

function hasOpenEnd(state: CaroState, line: CaroPosition[], dr: number, dc: number): boolean {
  const first = line[0]!;
  const last = line.at(-1)!;
  const before = { row: first.row - dr, col: first.col - dc };
  const after = { row: last.row + dr, col: last.col + dc };
  return [before, after].some((point) => inBounds(point.row, point.col) && state.board[indexOf(point.row, point.col)] === null);
}

function finish(state: CaroState, winnerId: string | null, reason: CaroFinishReason, notice: string) {
  state.phase = 'finished';
  state.currentPlayerId = null;
  state.turnDeadlineAt = null;
  state.turnRemainingMs = null;
  state.winnerId = winnerId;
  state.finishReason = reason;
  state.notice = notice;
}

export function applyCaroAction(before: CaroState, actorId: string, intent: CaroIntent, now: number): CaroState {
  if (before.phase !== 'turn') throw new CaroRuleError('GAME_FINISHED', 'Ván Caro đã kết thúc.');
  const actor = playerFor(before, actorId);
  if (intent.type === 'resign') {
    if (before.turnDeadlineAt === null || now >= before.turnDeadlineAt) throw new CaroRuleError('TURN_EXPIRED', 'Đã hết thời gian lượt.');
    const state = structuredClone(before);
    finish(state, state.players.find((player) => player.id !== actorId)!.id, 'resign', `${actor.nickname} đã chịu thua.`);
    state.revision++;
    return state;
  }
  if (before.turnDeadlineAt === null || now >= before.turnDeadlineAt) throw new CaroRuleError('TURN_EXPIRED', 'Đã hết thời gian lượt.');
  if (intent.turnId !== before.turnId) throw new CaroRuleError('STALE_TURN', 'Lượt đã thay đổi. Bàn chơi đang được cập nhật.');
  if (before.currentPlayerId !== actorId) throw new CaroRuleError('NOT_YOUR_TURN', 'Chưa tới lượt bạn.');
  if (!Number.isInteger(intent.row) || !Number.isInteger(intent.col) || !inBounds(intent.row, intent.col)) throw new CaroRuleError('INVALID_CELL', 'Ô cờ không hợp lệ.');
  const cellIndex = indexOf(intent.row, intent.col);
  if (before.board[cellIndex] !== null) throw new CaroRuleError('CELL_OCCUPIED', 'Ô này đã có quân.');

  const state = structuredClone(before);
  state.board[cellIndex] = actor.symbol;
  state.lastMove = { row: intent.row, col: intent.col, playerId: actorId, symbol: actor.symbol };
  const axes: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const winningLines = axes.flatMap(([dr, dc]) => {
    const line = maximalLine(state, intent.row, intent.col, actor.symbol, dr, dc);
    return line.length === state.winLength && hasOpenEnd(state, line, dr, dc) ? [line] : [];
  });
  state.winningLines = winningLines;
  if (winningLines.length) finish(state, actorId, 'five', `${actor.nickname} nối đúng ${state.winLength} quân và thắng ván này!`);
  else if (state.board.every((cell) => cell !== null)) finish(state, null, 'board-full', 'Bàn cờ đã kín. Ván hòa!');
  else {
    const next = state.players.find((player) => player.id !== actorId)!;
    state.currentPlayerId = next.id;
    state.turnId = `${state.gameId}:turn:${state.revision + 1}`;
    state.turnDeadlineAt = now + CARO_TURN_MS;
    state.turnRemainingMs = null;
    state.notice = `${next.nickname} tới lượt.`;
  }
  state.revision++;
  return state;
}

export function expireCaroDeadline(before: CaroState, now: number): CaroState | null {
  if (before.phase !== 'turn' || before.turnDeadlineAt === null || now < before.turnDeadlineAt) return null;
  const state = structuredClone(before);
  const loser = state.players.find((player) => player.id === state.currentPlayerId)!;
  const winner = state.players.find((player) => player.id !== loser.id)!;
  finish(state, winner.id, 'timeout', `Hết giờ. ${winner.nickname} thắng ván này!`);
  state.revision++;
  return state;
}

export function pauseCaroGame(before: CaroState, now: number): CaroState {
  if (before.phase !== 'turn' || before.turnDeadlineAt === null) return structuredClone(before);
  const state = structuredClone(before);
  state.turnRemainingMs = Math.max(0, state.turnDeadlineAt! - now);
  state.turnDeadlineAt = null;
  state.revision++;
  return state;
}

export function resumeCaroGame(before: CaroState, now: number): CaroState {
  if (before.phase !== 'turn' || before.turnDeadlineAt !== null || before.turnRemainingMs === null) return structuredClone(before);
  const state = structuredClone(before);
  state.turnDeadlineAt = now + state.turnRemainingMs!;
  state.turnRemainingMs = null;
  state.revision++;
  return state;
}

export function projectCaroGame(state: CaroState, viewerId: string, now: number, paused: boolean): CaroPublicGame {
  const viewer = state.players.find((player) => player.id === viewerId);
  const yourTurn = !paused && state.phase === 'turn' && state.currentPlayerId === viewerId;
  return {
    gameId: state.gameId,
    revision: state.revision,
    winLength: state.winLength,
    players: structuredClone(state.players),
    board: [...state.board],
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    turnId: state.turnId,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    winningLines: state.winningLines.map((line) => line.map((point) => ({ ...point }))),
    deadlineAt: state.turnDeadlineAt,
    remainingMs: paused ? state.turnRemainingMs : state.turnDeadlineAt === null ? null : Math.max(0, state.turnDeadlineAt - now),
    serverNow: now,
    turnDurationMs: CARO_TURN_MS,
    winnerId: state.winnerId,
    finishReason: state.finishReason,
    notice: state.notice,
    canPlace: yourTurn,
    canResign: !paused && state.phase === 'turn' && Boolean(viewer),
    yourSymbol: viewer?.symbol ?? null,
    legalCellIndexes: yourTurn ? state.board.flatMap((cell, index) => cell === null ? [index] : []) : [],
  };
}
