export const BANTAU_BOARD_SIZES = [8, 10, 12] as const;
export const BANTAU_SHIP_COUNTS = [3, 4, 5] as const;
export const BANTAU_SETUP_MS = 90_000;
export const BANTAU_RESOLVE_MS = 900;
export const BANTAU_ROUND_LIMIT_MS = 30 * 60_000;

export type BantauBoardSize = typeof BANTAU_BOARD_SIZES[number];
export type BantauShipCount = typeof BANTAU_SHIP_COUNTS[number];
export type BantauPosition = { row: number; col: number };
export type BantauOrientation = 'horizontal' | 'vertical';
export type BantauShip = { id: string; length: number; anchor: BantauPosition; orientation: BantauOrientation };
export type BantauPlacement = BantauShip & { cells: BantauPosition[] };
export type BantauTargetCell = 'unknown' | 'hit' | 'sunk';
export type BantauFinishReason = 'fleet-sunk' | 'resign';
export type BantauOptions = {
  boardSize: BantauBoardSize;
  shipCount: BantauShipCount;
  turnDurationMs: number;
  hitContinues: boolean;
  allowTouch: boolean;
  setupDurationMs?: number;
  resolveMs?: number;
};
export type BantauPlayerState = {
  id: string;
  nickname: string;
  fleet: BantauShip[];
  hitCells: BantauPosition[];
  fleetRevision: number;
  placementLocked: boolean;
};
export type BantauAim = { turnId: string; sequence: number; cell: BantauPosition };
export type BantauState = {
  gameId: string;
  revision: number;
  boardSize: BantauBoardSize;
  shipCount: BantauShipCount;
  fleetLengths: number[];
  turnDurationMs: number;
  setupDurationMs: number;
  resolveMs: number;
  hitContinues: boolean;
  allowTouch: boolean;
  players: [BantauPlayerState, BantauPlayerState];
  phase: 'setup' | 'turn' | 'resolving' | 'finished';
  setupId: string;
  firstPlayerId: string;
  setupDeadlineAt: number | null;
  setupRemainingMs: number | null;
  currentPlayerId: string | null;
  turnId: string;
  turnDeadlineAt: number | null;
  turnRemainingMs: number | null;
  resolvingId: string | null;
  resolveDeadlineAt: number | null;
  resolveRemainingMs: number | null;
  pendingNextPlayerId: string | null;
  aims: Record<string, BantauAim | null>;
  aimSequences: Record<string, number>;
  winnerId: string | null;
  finishReason: BantauFinishReason | null;
  notice: string | null;
};
export type BantauEffect = {
  eventId: string;
  shotId: string;
  gameId: string;
  revision: number;
  turnId: string;
  actorId: string;
  targetId: string;
  row: number;
  col: number;
  result: 'miss' | 'hit' | 'sunk';
  source: 'manual' | 'timeout';
  serverTime: number;
  presentationExpiresAt: number;
  sunkCells?: BantauPosition[];
};
export type BantauPlayerSnapshot = {
  gameId: string;
  revision: number;
  boardSize: BantauBoardSize;
  shipCount: BantauShipCount;
  fleetLengths: number[];
  hitContinues: boolean;
  allowTouch: boolean;
  phase: BantauState['phase'];
  setupId: string;
  setupDeadlineAt: number | null;
  setupRemainingMs: number | null;
  players: Array<{ id: string; nickname: string; placementLocked: boolean; sunkCount: number }>;
  currentPlayerId: string | null;
  turnId: string;
  deadlineAt: number | null;
  remainingMs: number | null;
  serverNow: number;
  turnDurationMs: number;
  resolvingDeadlineAt: number | null;
  winnerId: string | null;
  finishReason: BantauFinishReason | null;
  notice: string | null;
  ownFleet: { revision: number; ships: BantauPlacement[]; hitCells: BantauPosition[] };
  targetBoard: BantauTargetCell[];
  revealedSunkShips: Array<{ displayId: string; length: number; cells: BantauPosition[] }>;
  ownAim: BantauAim | null;
  capabilities: {
    canEditFleet: boolean;
    canRandomize: boolean;
    canLock: boolean;
    canAim: boolean;
    canFire: boolean;
    canResign: boolean;
  };
};
export type BantauPlacementIntent =
  | { type: 'moveShip'; shipId: string; anchor: BantauPosition }
  | { type: 'rotateShip'; shipId: string }
  | { type: 'replaceFleetRandom' };
export type BantauAimResult = { state: BantauState; aim: BantauAim | null };
export type BantauShotResult = { state: BantauState; effect: BantauEffect };

const PRESETS: Record<BantauShipCount, number[]> = {
  3: [3, 3, 2],
  4: [4, 3, 3, 2],
  5: [5, 4, 3, 3, 2],
};

export class BantauRuleError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'BantauRuleError'; }
}

function validRandomIndex(randomInt: (max: number) => number, max: number) {
  const value = randomInt(max);
  if (!Number.isInteger(value) || value < 0 || value >= max) throw new Error('RNG trả chỉ số ngoài phạm vi.');
  return value;
}
function shuffle<T>(values: T[], randomInt: (max: number) => number) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = validRandomIndex(randomInt, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
function inBounds(size: number, { row, col }: BantauPosition) { return row >= 0 && col >= 0 && row < size && col < size; }
function sameCell(a: BantauPosition, b: BantauPosition) { return a.row === b.row && a.col === b.col; }
function positionKey({ row, col }: BantauPosition) { return `${row}:${col}`; }
export function cellsForShip(ship: BantauShip): BantauPosition[] {
  return Array.from({ length: ship.length }, (_, index) => ({
    row: ship.anchor.row + (ship.orientation === 'vertical' ? index : 0),
    col: ship.anchor.col + (ship.orientation === 'horizontal' ? index : 0),
  }));
}
function allCandidates(size: number, length: number): BantauShip[] {
  const result: BantauShip[] = [];
  for (const orientation of ['horizontal', 'vertical'] as const) {
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const ship = { id: '', length, anchor: { row, col }, orientation };
      if (cellsForShip(ship).every((cell) => inBounds(size, cell))) result.push(ship);
    }
  }
  return result;
}
function shipsConflict(size: number, a: BantauShip, b: BantauShip, allowTouch: boolean) {
  const aCells = cellsForShip(a);
  const bKeys = new Set(cellsForShip(b).map(positionKey));
  for (const cell of aCells) {
    for (let row = Math.max(0, cell.row - 1); row <= Math.min(size - 1, cell.row + 1); row++) {
      for (let col = Math.max(0, cell.col - 1); col <= Math.min(size - 1, cell.col + 1); col++) {
        const key = `${row}:${col}`;
        if (bKeys.has(key) && (!allowTouch || (row === cell.row && col === cell.col))) return true;
      }
    }
  }
  return false;
}
export function validateBantauFleet(size: BantauBoardSize, lengths: readonly number[], fleet: readonly BantauShip[], allowTouch: boolean) {
  if (fleet.length !== lengths.length) return { valid: false, code: 'INVALID_FLEET', message: 'Thiếu hoặc thừa tàu trong đội hình.' } as const;
  for (let i = 0; i < fleet.length; i++) {
    const ship = fleet[i]!;
    if (ship.length !== lengths[i] || !Number.isInteger(ship.anchor.row) || !Number.isInteger(ship.anchor.col) || !['horizontal', 'vertical'].includes(ship.orientation)) return { valid: false, code: 'INVALID_FLEET', message: 'Thông tin tàu không khớp đội hình.' } as const;
    if (!cellsForShip(ship).every((cell) => inBounds(size, cell))) return { valid: false, code: 'OUT_OF_BOUNDS', message: 'Tàu phải nằm trọn trong bàn.' } as const;
  }
  for (let i = 0; i < fleet.length; i++) for (let j = i + 1; j < fleet.length; j++) {
    if (shipsConflict(size, fleet[i]!, fleet[j]!, true)) return { valid: false, code: 'SHIP_OVERLAP', message: 'Hai tàu không thể chiếm cùng một ô.' } as const;
    if (!allowTouch && shipsConflict(size, fleet[i]!, fleet[j]!, false)) return { valid: false, code: 'SHIPS_TOUCHING', message: 'Khi tắt cho chạm, giữa hai tàu cần cách ít nhất một ô.' } as const;
  }
  return { valid: true, code: null, message: null } as const;
}

export function generateBantauFleet(input: { boardSize: BantauBoardSize; shipCount: BantauShipCount; allowTouch: boolean; randomInt: (max: number) => number }): BantauShip[] {
  const lengths = PRESETS[input.shipCount];
  const byLength = new Map<number, BantauShip[]>();
  for (const length of [...new Set(lengths)]) byLength.set(length, shuffle(allCandidates(input.boardSize, length), input.randomInt));
  const ordered = lengths.map((length, index) => ({ id: `ship-${index + 1}`, length, index })).sort((a, b) => (byLength.get(a.length)!.length - byLength.get(b.length)!.length) || a.index - b.index);
  let attempts = 0;
  const placed: BantauShip[] = [];
  const search = (at: number): boolean => {
    if (at === ordered.length) return true;
    if (++attempts > 250_000) return false;
    const item = ordered[at]!;
    for (const candidate of byLength.get(item.length)!) {
      const ship = { ...candidate, id: item.id };
      if (placed.some((other) => shipsConflict(input.boardSize, ship, other, input.allowTouch))) continue;
      placed.push(ship);
      if (search(at + 1)) return true;
      placed.pop();
    }
    return false;
  };
  if (!search(0)) throw new BantauRuleError('FLEET_GENERATION_FAILED', 'Chưa tạo được đội hình hợp lệ. Hãy thử lại.');
  return placed.sort((a, b) => Number(a.id.slice(5)) - Number(b.id.slice(5)));
}

export function createBantauGame(input: {
  gameId: string;
  players: [{ id: string; nickname: string }, { id: string; nickname: string }];
  options: BantauOptions;
  firstPlayerId: string;
  randomInt: (max: number) => number;
  now: number;
}): BantauState {
  const { options } = input;
  if (!(BANTAU_BOARD_SIZES as readonly number[]).includes(options.boardSize)) throw new BantauRuleError('INVALID_BOARD_SIZE', 'Kích thước bàn không hợp lệ.');
  if (!(BANTAU_SHIP_COUNTS as readonly number[]).includes(options.shipCount)) throw new BantauRuleError('INVALID_SHIP_COUNT', 'Số lượng tàu không hợp lệ.');
  if (!Number.isInteger(options.turnDurationMs) || options.turnDurationMs < 1_000 || options.turnDurationMs > 300_000) throw new BantauRuleError('INVALID_TURN_DURATION', 'Thời gian mỗi lượt không hợp lệ.');
  if (input.players.length !== 2 || new Set(input.players.map((p) => p.id)).size !== 2) throw new BantauRuleError('PLAYER_COUNT', 'Bắn tàu cần đúng hai người chơi khác nhau.');
  if (!input.players.some((p) => p.id === input.firstPlayerId)) throw new BantauRuleError('INVALID_FIRST_PLAYER', 'Người đi trước không có trong phòng.');
  const setupDurationMs = options.setupDurationMs ?? BANTAU_SETUP_MS;
  const resolveMs = options.resolveMs ?? BANTAU_RESOLVE_MS;
  if (!Number.isInteger(setupDurationMs) || setupDurationMs < 1_000 || !Number.isInteger(resolveMs) || resolveMs < 0) throw new BantauRuleError('INVALID_TIMING', 'Thời gian cấu hình ván không hợp lệ.');
  const fleetLengths = [...PRESETS[options.shipCount]];
  const createPlayer = (player: { id: string; nickname: string }): BantauPlayerState => {
    const fleet = generateBantauFleet({ boardSize: options.boardSize, shipCount: options.shipCount, allowTouch: options.allowTouch, randomInt: input.randomInt })
      .map((ship) => ({ ...ship, id: `${player.id}:${ship.id}` }));
    return { ...player, fleet, hitCells: [], fleetRevision: 0, placementLocked: false };
  };
  const players: BantauState['players'] = [createPlayer(input.players[0]), createPlayer(input.players[1])];
  return {
    gameId: input.gameId, revision: 0, boardSize: options.boardSize, shipCount: options.shipCount, fleetLengths,
    turnDurationMs: options.turnDurationMs, setupDurationMs, resolveMs, hitContinues: options.hitContinues, allowTouch: options.allowTouch,
    players, phase: 'setup', setupId: `${input.gameId}:setup:0`, firstPlayerId: input.firstPlayerId, setupDeadlineAt: input.now + setupDurationMs, setupRemainingMs: null,
    currentPlayerId: null, turnId: `${input.gameId}:turn:0`, turnDeadlineAt: null, turnRemainingMs: null,
    resolvingId: null, resolveDeadlineAt: null, resolveRemainingMs: null, pendingNextPlayerId: null,
    aims: Object.fromEntries(players.map((player) => [player.id, null])), aimSequences: Object.fromEntries(players.map((player) => [player.id, 0])),
    winnerId: null, finishReason: null, notice: 'Xếp tàu của bạn. Đối thủ không thấy vị trí này.',
  };
}

function playerFor(state: BantauState, playerId: string) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) throw new BantauRuleError('PLAYER_NOT_IN_GAME', 'Bạn không còn trong ván này.');
  return player;
}
function opponentFor(state: BantauState, playerId: string) { return state.players.find((item) => item.id !== playerId)!; }
function copy(state: BantauState) { return structuredClone(state); }
function startCombat(state: BantauState, firstPlayerId: string, now: number) {
  state.phase = 'turn'; state.currentPlayerId = firstPlayerId; state.setupDeadlineAt = null; state.setupRemainingMs = null;
  state.turnId = `${state.gameId}:turn:0`; state.turnDeadlineAt = now + state.turnDurationMs; state.turnRemainingMs = null;
  state.notice = `${state.players.find((p) => p.id === firstPlayerId)?.nickname ?? 'Người chơi'} bắn trước.`;
}
function setupFirstPlayer(state: BantauState) {
  return state.firstPlayerId;
}

export function applyBantauPlacement(before: BantauState, actorId: string, expectedFleetRevision: number, intent: BantauPlacementIntent, randomInt: (max: number) => number, now: number): BantauState {
  if (before.phase !== 'setup') throw new BantauRuleError('WRONG_PHASE', 'Không còn ở pha xếp tàu.');
  if (before.setupDeadlineAt === null || now >= before.setupDeadlineAt) throw new BantauRuleError('ACTION_EXPIRED', 'Đã hết thời gian xếp tàu.');
  const actor = playerFor(before, actorId);
  if (actor.placementLocked) throw new BantauRuleError('FLEET_LOCKED', 'Đội hình của bạn đã khóa.');
  if (actor.fleetRevision !== expectedFleetRevision) throw new BantauRuleError('STALE_FLEET', 'Đội hình vừa đổi. Hãy đồng bộ rồi thử lại.');
  const next = copy(before);
  const player = playerFor(next, actorId);
  if (intent.type === 'replaceFleetRandom') player.fleet = generateBantauFleet({ boardSize: next.boardSize, shipCount: next.shipCount, allowTouch: next.allowTouch, randomInt });
  else {
    const ship = player.fleet.find((item) => item.id === intent.shipId);
    if (!ship) throw new BantauRuleError('UNKNOWN_SHIP', 'Không tìm thấy tàu trong đội hình.');
    if (intent.type === 'moveShip') ship.anchor = { ...intent.anchor };
    else ship.orientation = ship.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    const validation = validateBantauFleet(next.boardSize, next.fleetLengths, player.fleet, next.allowTouch);
    if (!validation.valid) throw new BantauRuleError(validation.code!, validation.message!);
  }
  player.fleetRevision++;
  next.revision++;
  next.notice = 'Đội hình đã được cập nhật.';
  return next;
}

export function lockBantauFleet(before: BantauState, actorId: string, expectedFleetRevision: number, now: number): BantauState {
  if (before.phase !== 'setup') throw new BantauRuleError('WRONG_PHASE', 'Không còn ở pha xếp tàu.');
  if (before.setupDeadlineAt === null || now >= before.setupDeadlineAt) throw new BantauRuleError('ACTION_EXPIRED', 'Đã hết thời gian xếp tàu.');
  const actor = playerFor(before, actorId);
  if (actor.placementLocked) throw new BantauRuleError('FLEET_LOCKED', 'Đội hình của bạn đã khóa.');
  if (actor.fleetRevision !== expectedFleetRevision) throw new BantauRuleError('STALE_FLEET', 'Đội hình vừa đổi. Hãy đồng bộ rồi thử lại.');
  const validation = validateBantauFleet(before.boardSize, before.fleetLengths, actor.fleet, before.allowTouch);
  if (!validation.valid) throw new BantauRuleError(validation.code!, validation.message!);
  const next = copy(before);
  playerFor(next, actorId).placementLocked = true;
  next.revision++;
  if (next.players.every((player) => player.placementLocked)) startCombat(next, setupFirstPlayer(next), now);
  else next.notice = `${actor.nickname} đã xếp xong. Đang chờ người chơi còn lại.`;
  return next;
}

export function expireBantauSetup(before: BantauState, now: number): BantauState | null {
  if (before.phase !== 'setup' || before.setupDeadlineAt === null || now < before.setupDeadlineAt) return null;
  const next = copy(before);
  for (const player of next.players) player.placementLocked = true;
  startCombat(next, setupFirstPlayer(next), now);
  next.revision++;
  next.notice = 'Hết giờ xếp tàu. Bắt đầu lượt bắn.';
  return next;
}

export function setBantauAim(before: BantauState, actorId: string, turnId: string, sequence: number, cell: BantauPosition | null, now: number): BantauAimResult {
  if (before.phase !== 'turn' || before.currentPlayerId !== actorId) throw new BantauRuleError('NOT_YOUR_TURN', 'Chưa tới lượt bạn bắn.');
  if (before.turnDeadlineAt === null || now >= before.turnDeadlineAt) throw new BantauRuleError('ACTION_EXPIRED', 'Đã hết thời gian lượt.');
  if (turnId !== before.turnId) throw new BantauRuleError('STALE_TURN', 'Lượt đã đổi. Hãy chọn lại mục tiêu.');
  if (!Number.isSafeInteger(sequence) || sequence <= (before.aimSequences[actorId] ?? 0)) throw new BantauRuleError('STALE_AIM', 'Lệnh nhắm cũ đã bị bỏ qua.');
  if (cell && (!Number.isInteger(cell.row) || !Number.isInteger(cell.col) || !inBounds(before.boardSize, cell))) throw new BantauRuleError('OUT_OF_BOUNDS', 'Ô nhắm nằm ngoài bàn.');
  if (cell) {
    const target = opponentFor(before, actorId);
    if (target.hitCells.some((hit) => sameCell(hit, cell))) throw new BantauRuleError('CELL_ALREADY_HIT', 'Ô này đã trúng tàu rồi.');
  }
  const next = copy(before);
  next.aimSequences[actorId] = sequence;
  next.aims[actorId] = cell ? { turnId, sequence, cell: { ...cell } } : null;
  return { state: next, aim: next.aims[actorId] ? structuredClone(next.aims[actorId]) : null };
}

function resolveShot(before: BantauState, actorId: string, cell: BantauPosition, source: 'manual' | 'timeout', now: number, randomInt: (max: number) => number): BantauShotResult {
  const actor = playerFor(before, actorId);
  const target = opponentFor(before, actorId);
  const ship = target.fleet.find((candidate) => cellsForShip(candidate).some((part) => sameCell(part, cell)));
  const next = copy(before);
  const targetNext = playerFor(next, target.id);
  let result: BantauEffect['result'] = 'miss';
  let sunkCells: BantauPosition[] | undefined;
  if (ship) {
    if (target.hitCells.some((hit) => sameCell(hit, cell))) throw new BantauRuleError('CELL_ALREADY_HIT', 'Ô này đã trúng tàu rồi.');
    targetNext.hitCells.push({ ...cell });
    const shipCells = cellsForShip(ship);
    if (shipCells.every((part) => targetNext.hitCells.some((hit) => sameCell(hit, part)))) {
      result = 'sunk'; sunkCells = shipCells;
    } else result = 'hit';
  }
  const shotId = `${before.gameId}:shot:${before.revision + 1}`;
  next.revision++;
  next.aims[actorId] = null;
  next.turnDeadlineAt = null; next.turnRemainingMs = null;
  let nextPlayerId: string;
  const allSunk = targetNext.fleet.every((candidate) => cellsForShip(candidate).every((part) => targetNext.hitCells.some((hit) => sameCell(hit, part))));
  if (allSunk) {
    next.phase = 'finished'; next.currentPlayerId = null; next.pendingNextPlayerId = null;
    next.resolvingId = null; next.resolveDeadlineAt = null; next.resolveRemainingMs = null;
    next.winnerId = actorId; next.finishReason = 'fleet-sunk'; next.notice = `${actor.nickname} đã đánh chìm toàn bộ hạm đội!`;
  } else {
    nextPlayerId = next.hitContinues && result !== 'miss' ? actorId : target.id;
    next.phase = 'resolving'; next.currentPlayerId = actorId; next.pendingNextPlayerId = nextPlayerId;
    next.resolvingId = `${before.gameId}:resolve:${next.revision}`; next.resolveDeadlineAt = now + next.resolveMs; next.resolveRemainingMs = null;
    next.notice = result === 'miss' ? 'Trượt. Đang chuyển lượt.' : result === 'sunk' ? 'Đã đánh chìm một tàu.' : 'Trúng tàu. Bạn được bắn tiếp.';
  }
  const effect: BantauEffect = {
    eventId: `bantau:${shotId}`, shotId, gameId: before.gameId, revision: next.revision, turnId: before.turnId,
    actorId, targetId: target.id, row: cell.row, col: cell.col, result, source, serverTime: now,
    presentationExpiresAt: now + 1_200, ...(sunkCells ? { sunkCells } : {}),
  };
  // randomInt is accepted here to keep timeout/fire transitions injectable and aligned; the shot itself is already selected.
  void randomInt;
  return { state: next, effect };
}

export function fireBantau(before: BantauState, actorId: string, turnId: string, aimSequence: number, cell: BantauPosition, randomInt: (max: number) => number, now: number): BantauShotResult {
  if (before.phase !== 'turn' || before.currentPlayerId !== actorId) throw new BantauRuleError('NOT_YOUR_TURN', 'Chưa tới lượt bạn bắn.');
  if (before.turnDeadlineAt === null || now >= before.turnDeadlineAt) throw new BantauRuleError('ACTION_EXPIRED', 'Đã hết thời gian lượt.');
  if (turnId !== before.turnId) throw new BantauRuleError('STALE_TURN', 'Lượt đã thay đổi. Hãy đồng bộ bàn chơi.');
  const aim = before.aims[actorId];
  if (!aim || aim.turnId !== turnId || aim.sequence !== aimSequence || !sameCell(aim.cell, cell)) throw new BantauRuleError('NO_CONFIRMED_AIM', 'Mục tiêu chưa được máy chủ xác nhận. Hãy nhắm lại.');
  if (!inBounds(before.boardSize, cell)) throw new BantauRuleError('OUT_OF_BOUNDS', 'Ô bắn nằm ngoài bàn.');
  return resolveShot(before, actorId, cell, 'manual', now, randomInt);
}

export function expireBantauTurn(before: BantauState, randomInt: (max: number) => number, now: number): BantauShotResult | null {
  if (before.phase !== 'turn' || before.currentPlayerId === null || before.turnDeadlineAt === null || now < before.turnDeadlineAt) return null;
  const actorId = before.currentPlayerId;
  const target = opponentFor(before, actorId);
  const aim = before.aims[actorId];
  let cell = aim && aim.turnId === before.turnId && !target.hitCells.some((hit) => sameCell(hit, aim.cell)) ? aim.cell : null;
  if (!cell) {
    const hitKeys = new Set(target.hitCells.map(positionKey));
    const eligible: BantauPosition[] = [];
    for (let row = 0; row < before.boardSize; row++) for (let col = 0; col < before.boardSize; col++) if (!hitKeys.has(`${row}:${col}`)) eligible.push({ row, col });
    if (!eligible.length) return null;
    cell = eligible[validRandomIndex(randomInt, eligible.length)]!;
  }
  return resolveShot(before, actorId, cell, 'timeout', now, randomInt);
}

export function advanceBantauResolution(before: BantauState, now: number): BantauState | null {
  if (before.phase !== 'resolving' || before.resolveDeadlineAt === null || now < before.resolveDeadlineAt || !before.pendingNextPlayerId) return null;
  const next = copy(before);
  next.phase = 'turn'; next.currentPlayerId = next.pendingNextPlayerId; next.pendingNextPlayerId = null;
  next.turnId = `${next.gameId}:turn:${next.revision}`; next.turnDeadlineAt = now + next.turnDurationMs; next.turnRemainingMs = null;
  next.resolvingId = null; next.resolveDeadlineAt = null; next.resolveRemainingMs = null;
  next.aims = Object.fromEntries(next.players.map((player) => [player.id, null]));
  next.notice = `${next.players.find((player) => player.id === next.currentPlayerId)?.nickname ?? 'Người chơi'} tới lượt.`;
  next.revision++;
  return next;
}

export function resignBantau(before: BantauState, actorId: string): BantauState {
  if (before.phase === 'finished') throw new BantauRuleError('GAME_FINISHED', 'Ván đã kết thúc.');
  const actor = playerFor(before, actorId);
  const next = copy(before);
  next.phase = 'finished'; next.currentPlayerId = null; next.turnDeadlineAt = null; next.turnRemainingMs = null;
  next.setupDeadlineAt = null; next.setupRemainingMs = null; next.resolveDeadlineAt = null; next.resolveRemainingMs = null;
  next.resolvingId = null; next.pendingNextPlayerId = null; next.winnerId = opponentFor(next, actorId).id; next.finishReason = 'resign';
  next.aims[actorId] = null; next.notice = `${actor.nickname} đã chịu thua.`; next.revision++;
  return next;
}

export function pauseBantauGame(before: BantauState, now: number): BantauState {
  if (before.phase === 'finished') return copy(before);
  const next = copy(before);
  if (next.phase === 'setup' && next.setupDeadlineAt !== null) { next.setupRemainingMs = Math.max(0, next.setupDeadlineAt - now); next.setupDeadlineAt = null; }
  if (next.phase === 'turn' && next.turnDeadlineAt !== null) { next.turnRemainingMs = Math.max(0, next.turnDeadlineAt - now); next.turnDeadlineAt = null; }
  if (next.phase === 'resolving' && next.resolveDeadlineAt !== null) { next.resolveRemainingMs = Math.max(0, next.resolveDeadlineAt - now); next.resolveDeadlineAt = null; }
  next.revision++;
  return next;
}
export function resumeBantauGame(before: BantauState, now: number): BantauState {
  const next = copy(before);
  if (next.phase === 'setup' && next.setupDeadlineAt === null && next.setupRemainingMs !== null) { next.setupDeadlineAt = now + next.setupRemainingMs; next.setupRemainingMs = null; }
  if (next.phase === 'turn' && next.turnDeadlineAt === null && next.turnRemainingMs !== null) { next.turnDeadlineAt = now + next.turnRemainingMs; next.turnRemainingMs = null; }
  if (next.phase === 'resolving' && next.resolveDeadlineAt === null && next.resolveRemainingMs !== null) { next.resolveDeadlineAt = now + next.resolveRemainingMs; next.resolveRemainingMs = null; }
  next.revision++;
  return next;
}

function sunkShip(player: BantauPlayerState, ship: BantauShip) {
  const cells = cellsForShip(ship);
  return cells.every((cell) => player.hitCells.some((hit) => sameCell(hit, cell)));
}
export function projectBantauGame(state: BantauState, viewerId: string, now: number, paused: boolean): BantauPlayerSnapshot {
  const viewer = playerFor(state, viewerId);
  const target = opponentFor(state, viewerId);
  const targetBoard: BantauTargetCell[] = Array.from({ length: state.boardSize * state.boardSize }, () => 'unknown');
  for (const ship of target.fleet) {
    const isSunk = sunkShip(target, ship);
    if (isSunk) for (const cell of cellsForShip(ship)) targetBoard[cell.row * state.boardSize + cell.col] = 'sunk';
    else for (const hit of target.hitCells) if (cellsForShip(ship).some((cell) => sameCell(cell, hit))) targetBoard[hit.row * state.boardSize + hit.col] = 'hit';
  }
  const ownFleet = {
    revision: viewer.fleetRevision,
    ships: viewer.fleet.map((ship) => ({ ...structuredClone(ship), cells: cellsForShip(ship) })),
    hitCells: viewer.hitCells.map((cell) => ({ ...cell })),
  };
  // Reveal only the exact wrecks already public as sunk. Never expose the
  // opponent's live fleet or its internal ship IDs in the viewer projection.
  const revealedSunkShips = target.fleet.flatMap((ship, index) => sunkShip(target, ship)
    ? [{ displayId: `wreck-${index + 1}`, length: ship.length, cells: cellsForShip(ship) }]
    : []);
  const canEditFleet = !paused && state.phase === 'setup' && state.setupDeadlineAt !== null && !viewer.placementLocked;
  const canAim = !paused && state.phase === 'turn' && state.currentPlayerId === viewerId && state.turnDeadlineAt !== null;
  const ownAim = state.aims[viewerId]?.turnId === state.turnId ? structuredClone(state.aims[viewerId]) : null;
  return {
    gameId: state.gameId, revision: state.revision, boardSize: state.boardSize, shipCount: state.shipCount,
    fleetLengths: [...state.fleetLengths], hitContinues: state.hitContinues, allowTouch: state.allowTouch,
    phase: state.phase, setupId: state.setupId, setupDeadlineAt: state.setupDeadlineAt,
    setupRemainingMs: paused ? state.setupRemainingMs : state.setupDeadlineAt === null ? null : Math.max(0, state.setupDeadlineAt - now),
    players: state.players.map((player) => ({ id: player.id, nickname: player.nickname, placementLocked: player.placementLocked, sunkCount: player.fleet.filter((ship) => sunkShip(player, ship)).length })),
    currentPlayerId: state.currentPlayerId, turnId: state.turnId, deadlineAt: state.turnDeadlineAt,
    remainingMs: paused ? state.turnRemainingMs ?? state.resolveRemainingMs : state.turnDeadlineAt === null ? null : Math.max(0, state.turnDeadlineAt - now),
    serverNow: now, turnDurationMs: state.turnDurationMs, resolvingDeadlineAt: state.resolveDeadlineAt,
    winnerId: state.winnerId, finishReason: state.finishReason, notice: state.notice,
    ownFleet, targetBoard, revealedSunkShips, ownAim,
    capabilities: {
      canEditFleet, canRandomize: canEditFleet, canLock: canEditFleet,
      canAim, canFire: canAim && Boolean(ownAim), canResign: !paused && state.phase !== 'finished',
    },
  };
}

export function getBantauShipPresets() { return structuredClone(PRESETS); }
