export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';
export type CardType = 'number' | 'drawTwo' | 'reverse' | 'skip' | 'wild' | 'wildDrawFour';
export type UnoCard = { id: string; color: CardColor; type: CardType; value?: number };
export type UnoPlayer = { id: string; nickname: string; hand: UnoCard[]; status: 'active' | 'eliminated'; eliminatedReason: 'timeout' | null };
export type UnoState = {
  gameId: string; players: UnoPlayer[]; drawPile: UnoCard[]; discardPile: UnoCard[]; stacking: boolean;
  currentColor: Exclude<CardColor, 'wild'> | null; direction: 1 | -1; currentPlayerId: string; dealerId: string;
  turnId: string; turnDurationMs: number; turnDeadlineAt: number | null; turnRemainingMs: number | null;
  phase: 'chooseColor' | 'turn' | 'drawn' | 'penalty' | 'finished'; drawnCardId: string | null;
  pendingPenalty: null | { total: number; lastType: 'drawTwo' | 'wildDrawFour'; targetId: string; pendingWinnerId: string | null };
  unoWindow: null | { playerId: string; nextPlayerId: string };
  winnerId: string | null; finishReason: 'winner' | 'lastActive' | 'stalemate' | null; revision: number;
};
export type UnoIntent =
  | { type: 'play'; cardId: string; color?: Exclude<CardColor, 'wild'>; declareUno?: boolean }
  | { type: 'chooseColor'; color: Exclude<CardColor, 'wild'> }
  | { type: 'draw' } | { type: 'keep' } | { type: 'declareUno' }
  | { type: 'catchUno'; targetPlayerId: string }
  | { type: 'acceptPenalty' };
export class UnoRuleError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'UnoRuleError'; }
}
const COLORS: Exclude<CardColor, 'wild'>[] = ['red', 'yellow', 'green', 'blue'];
export const UNO_MIN_PLAYERS = 2;
export const UNO_MAX_PLAYERS = 6;
export const UNO_TURN_MS = 30_000;

function shuffle<T>(items: T[], randomInt: (max: number) => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new Error('RNG trả chỉ số ngoài phạm vi.');
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
export function createDeck(gameId: string): UnoCard[] {
  const deck: UnoCard[] = [];
  for (const color of COLORS) {
    deck.push({ id: gameId + ':card:' + deck.length, color, type: 'number', value: 0 });
    for (let n = 1; n <= 9; n++) for (let copy = 0; copy < 2; copy++) deck.push({ id: gameId + ':card:' + deck.length, color, type: 'number', value: n });
    for (const type of ['drawTwo', 'reverse', 'skip'] as const) for (let copy = 0; copy < 2; copy++) deck.push({ id: gameId + ':card:' + deck.length, color, type });
  }
  for (let i = 0; i < 4; i++) deck.push({ id: gameId + ':card:' + deck.length, color: 'wild', type: 'wild' });
  for (let i = 0; i < 4; i++) deck.push({ id: gameId + ':card:' + deck.length, color: 'wild', type: 'wildDrawFour' });
  return deck;
}
export function pickDealer(players: Array<{ id: string }>, gameId: string, randomInt: (max: number) => number): string {
  let candidates = [...players];
  let cards = createDeck(gameId + ':dealer-selection');
  for (let round = 0; candidates.length > 1 && round < 108; round++) {
    const values = candidates.map(() => {
      if (cards.length === 0) cards = createDeck(gameId + ':dealer-selection:' + round);
      const index = randomInt(cards.length);
      if (!Number.isInteger(index) || index < 0 || index >= cards.length) throw new Error('RNG trả chỉ số ngoài phạm vi.');
      const [drawn] = cards.splice(index, 1);
      return drawn?.type === 'number' ? drawn.value! : 0;
    });
    const highest = Math.max(...values);
    candidates = candidates.filter((_, i) => values[i] === highest);
  }
  if (candidates.length > 1) return candidates[randomInt(candidates.length)]!.id;
  return candidates[0]!.id;
}
export function nextPlayerId(state: Pick<UnoState, 'players' | 'direction'>, playerId: string, steps = 1): string {
  const active = state.players.filter((player) => player.status === 'active');
  const index = active.findIndex((player) => player.id === playerId);
  if (index < 0) throw new UnoRuleError('PLAYER_NOT_FOUND', 'Không tìm thấy người chơi trong ván.');
  const n = active.length;
  if (n === 0) throw new UnoRuleError('NO_ACTIVE_PLAYERS', 'Không còn người chơi đang thi đấu.');
  return active[(index + state.direction * steps % n + n) % n]!.id;
}
function takeCards(state: UnoState, count: number, randomInt: (max: number) => number): UnoCard[] {
  const drawn: UnoCard[] = [];
  while (drawn.length < count) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length <= 1) break;
      const top = state.discardPile.pop()!;
      state.drawPile = shuffle(state.discardPile.splice(0), randomInt);
      state.discardPile.push(top);
    }
    if (state.drawPile.length) drawn.push(state.drawPile.pop()!);
  }
  return drawn;
}
function stalemate(state: UnoState, wanted: number, got: number) {
  if (got >= wanted) return false;
  state.phase = 'finished'; state.finishReason = 'stalemate'; state.winnerId = null;
  state.pendingPenalty = null; state.unoWindow = null; state.drawnCardId = null; state.turnDeadlineAt = null; state.turnRemainingMs = null;
  return true;
}
export function createGame(input: { gameId: string; players: Array<{ id: string; nickname: string }>; randomInt: (max: number) => number; now?: number; turnDurationMs?: number; stacking?: boolean }): UnoState {
  const { gameId, randomInt } = input;
  if (input.players.length < 2 || input.players.length > 6) throw new UnoRuleError('PLAYER_COUNT', 'UNO cần từ 2 đến 6 người chơi.');
  if (new Set(input.players.map((p) => p.id)).size !== input.players.length) throw new UnoRuleError('DUPLICATE_PLAYER', 'Danh sách người chơi bị trùng.');
  const turnDurationMs = input.turnDurationMs ?? UNO_TURN_MS;
  if (!Number.isInteger(turnDurationMs) || turnDurationMs < 1_000 || turnDurationMs > 300_000) throw new UnoRuleError('INVALID_TURN_DURATION', 'Thời gian lượt không hợp lệ.');
  const now = input.now ?? 0;
  const players = input.players.map((p) => ({ ...p, hand: [] as UnoCard[], status: 'active' as const, eliminatedReason: null }));
  const dealerId = pickDealer(players, gameId, randomInt);
  let drawPile = shuffle(createDeck(gameId), randomInt);
  for (let i = 0; i < 7; i++) for (const player of players) player.hand.push(drawPile.pop()!);
  const state: UnoState = {
    gameId, players, drawPile, discardPile: [], stacking: input.stacking ?? true, currentColor: null,
    direction: 1, currentPlayerId: players[(players.findIndex((p) => p.id === dealerId) + 1) % players.length]!.id,
    turnId: `${gameId}:turn:0`, turnDurationMs, turnDeadlineAt: now + turnDurationMs, turnRemainingMs: null,
    dealerId, phase: 'turn', drawnCardId: null, pendingPenalty: null, unoWindow: null,
    winnerId: null, finishReason: null, revision: 0,
  };
  return state;
}
function player(state: UnoState, id: string): UnoPlayer {
  const found = state.players.find((p) => p.id === id);
  if (!found) throw new UnoRuleError('PLAYER_NOT_FOUND', 'Không tìm thấy người chơi trong ván.');
  return found;
}
function activeCount(state: UnoState) { return state.players.reduce((count, item) => count + Number(item.status === 'active'), 0); }
function turn(state: UnoState, id: string): UnoPlayer {
  if (state.phase === 'finished') throw new UnoRuleError('GAME_FINISHED', 'Ván này đã kết thúc.');
  if (state.currentPlayerId !== id) throw new UnoRuleError('NOT_YOUR_TURN', 'Chưa tới lượt của bạn.');
  const found = player(state, id);
  if (found.status !== 'active') throw new UnoRuleError('PLAYER_ELIMINATED', 'Bạn đã hết giờ và phải chờ ván sau.');
  return found;
}
function finish(state: UnoState, winner: string | null, reason: 'winner' | 'lastActive' | 'stalemate') {
  state.phase = 'finished'; state.winnerId = winner; state.finishReason = reason;
  state.pendingPenalty = null; state.drawnCardId = null; state.unoWindow = null; state.turnDeadlineAt = null; state.turnRemainingMs = null;
}
function nextTurn(state: UnoState, id: string, now: number) {
  state.currentPlayerId = id; state.phase = 'turn'; state.drawnCardId = null;
  state.turnId = `${state.gameId}:turn:${state.revision + 1}`;
  state.turnDeadlineAt = now + state.turnDurationMs; state.turnRemainingMs = null;
}
function playable(card: UnoCard, top: UnoCard | undefined, color: UnoState['currentColor']) {
  return !top || card.type === 'wild' || card.type === 'wildDrawFour' || card.color === color ||
    (card.type === 'number' && top.type === 'number' && card.value === top.value) ||
    (card.type === top.type && card.type !== 'number');
}
function applyPenalty(state: UnoState, target: UnoPlayer, amount: number, randomInt: (max: number) => number) {
  const drawn = takeCards(state, amount, randomInt); target.hand.push(...drawn);
  return !stalemate(state, amount, drawn.length);
}
// One predicate serves validation and the per-viewer legal-action projection.
function canPlay(state: UnoState, card: UnoCard): boolean {
  if (state.phase === 'penalty') {
    const pending = state.pendingPenalty;
    return Boolean(state.stacking && pending && !pending.pendingWinnerId &&
      (card.type === 'wildDrawFour' || (pending.lastType === 'drawTwo' && card.type === 'drawTwo')));
  }
  if (state.phase !== 'turn' && state.phase !== 'drawn') return false;
  return (state.phase !== 'drawn' || state.drawnCardId === card.id) && playable(card, state.discardPile.at(-1)!, state.currentColor);
}
function requireColor(color: unknown): asserts color is Exclude<CardColor, 'wild'> {
  if (!COLORS.includes(color as Exclude<CardColor, 'wild'>)) throw new UnoRuleError('COLOR_REQUIRED', 'Hãy chọn một trong bốn màu hợp lệ.');
}
export function applyGameAction(before: UnoState, actorId: string, intent: UnoIntent, randomInt: (max: number) => number, now = before.turnDeadlineAt === null ? 0 : before.turnDeadlineAt - before.turnDurationMs): UnoState {
  if (before.phase === 'finished') throw new UnoRuleError('GAME_FINISHED', 'Ván này đã kết thúc.');
  if (before.turnDeadlineAt !== null && now >= before.turnDeadlineAt) throw new UnoRuleError('TURN_EXPIRED', 'Đã hết thời gian lượt.');
  const state = structuredClone(before);
  if (state.phase === 'chooseColor') {
    if (intent.type !== 'chooseColor') throw new UnoRuleError('COLOR_REQUIRED', 'Người đi trước cần chọn màu cho lá Wild mở đầu.');
    if (state.currentPlayerId !== actorId) throw new UnoRuleError('NOT_YOUR_TURN', 'Chưa tới lượt bạn chọn màu.');
    requireColor(intent.color);
    state.currentColor = intent.color; state.phase = 'turn'; state.revision++; return state;
  }
  if (intent.type === 'chooseColor') throw new UnoRuleError('COLOR_NOT_ALLOWED', 'Hiện không cần chọn màu mở đầu.');
  if (intent.type === 'catchUno') {
    if (player(state, actorId).status !== 'active') throw new UnoRuleError('PLAYER_ELIMINATED', 'Bạn đã hết giờ và phải chờ ván sau.');
    const window = state.unoWindow;
    if (!window || window.playerId !== intent.targetPlayerId || actorId === window.playerId || state.currentPlayerId !== window.nextPlayerId) throw new UnoRuleError('UNO_WINDOW_CLOSED', 'Không còn lượt nào để bắt lỗi UNO.');
    const cards = takeCards(state, 2, randomInt); player(state, window.playerId).hand.push(...cards);
    if (!stalemate(state, 2, cards.length)) state.unoWindow = null;
    state.revision++; return state;
  }
  if (intent.type === 'declareUno') {
    if (player(state, actorId).status !== 'active') throw new UnoRuleError('PLAYER_ELIMINATED', 'Bạn đã hết giờ và phải chờ ván sau.');
    if (!state.unoWindow || state.unoWindow.playerId !== actorId) throw new UnoRuleError('UNO_NOT_NEEDED', 'Hiện bạn không cần hô UNO.');
    state.unoWindow = null; state.revision++; return state;
  }
  if (intent.type === 'acceptPenalty') {
    turn(state, actorId);
    const pending = state.pendingPenalty;
    if (state.phase !== 'penalty' || !pending || pending.targetId !== actorId) throw new UnoRuleError('NO_PENALTY', 'Bạn không có khoản phạt cần nhận.');
    if (state.unoWindow?.nextPlayerId === actorId) state.unoWindow = null;
    if (applyPenalty(state, player(state, actorId), pending.total, randomInt)) {
      state.pendingPenalty = null;
      if (pending.pendingWinnerId) finish(state, pending.pendingWinnerId, 'winner');
      else nextTurn(state, nextPlayerId(state, actorId), now);
    }
    state.revision++; return state;
  }
  if (intent.type === 'draw') {
    if (state.unoWindow?.nextPlayerId === actorId) state.unoWindow = null;
    turn(state, actorId);
    if (state.phase !== 'turn') throw new UnoRuleError('CANNOT_DRAW_NOW', 'Bạn chỉ có thể rút một lá trong lượt này.');
    const cards = takeCards(state, 1, randomInt);
    if (cards.length === 0) stalemate(state, 1, 0);
    else {
      const card = cards[0]!; player(state, actorId).hand.push(card);
      if (playable(card, state.discardPile.at(-1)!, state.currentColor)) { state.phase = 'drawn'; state.drawnCardId = card.id; }
      else nextTurn(state, nextPlayerId(state, actorId), now);
    }
    state.revision++; return state;
  }
  if (intent.type === 'keep') {
    if (state.unoWindow?.nextPlayerId === actorId) state.unoWindow = null;
    turn(state, actorId);
    if (state.phase !== 'drawn' || !state.drawnCardId) throw new UnoRuleError('NO_DRAWN_CARD', 'Bạn chưa rút lá nào trong lượt này.');
    nextTurn(state, nextPlayerId(state, actorId), now); state.revision++; return state;
  }
  if (intent.type === 'play') {
    const actor = turn(state, actorId);
    const index = actor.hand.findIndex((card) => card.id === intent.cardId);
    if (index < 0) throw new UnoRuleError('CARD_NOT_OWNED', 'Lá này không có trong tay bạn.');
    if (state.phase === 'drawn' && state.drawnCardId !== intent.cardId) throw new UnoRuleError('MUST_PLAY_DRAWN_CARD', 'Sau khi rút, bạn chỉ được đánh lá vừa rút.');
    const card = actor.hand[index]!;
    if (!canPlay(state, card)) throw new UnoRuleError('CARD_DOES_NOT_MATCH', state.phase === 'penalty' ? 'Lá này không được cộng vào khoản phạt. Hãy chọn lá phù hợp hoặc nhận phạt.' : 'Lá này không khớp màu, số hoặc ký hiệu hiện tại.');
    const wild = card.type === 'wild' || card.type === 'wildDrawFour';
    if (wild) requireColor(intent.color);
    else if (intent.color !== undefined) throw new UnoRuleError('COLOR_NOT_ALLOWED', 'Lá này không đổi màu.');
    if (state.unoWindow?.nextPlayerId === actorId) state.unoWindow = null;
    actor.hand.splice(index, 1);
    state.currentColor = wild ? intent.color! : card.color as Exclude<CardColor, 'wild'>;
    state.discardPile.push(card); state.drawnCardId = null;
    if (card.type === 'reverse') state.direction = state.direction === 1 ? -1 : 1;
    const next = card.type === 'skip' || (card.type === 'reverse' && activeCount(state) === 2) ? nextPlayerId(state, actorId, 2) : nextPlayerId(state, actorId);
    if (actor.hand.length === 0) finish(state, actorId, 'winner');
    else if (card.type === 'drawTwo' || card.type === 'wildDrawFour') {
      state.pendingPenalty = { total: (state.pendingPenalty?.total ?? 0) + (card.type === 'drawTwo' ? 2 : 4), lastType: card.type, targetId: next, pendingWinnerId: actor.hand.length === 0 ? actorId : null };
      state.phase = 'penalty'; state.currentPlayerId = next;
      state.turnId = `${state.gameId}:turn:${state.revision + 1}`;
      state.turnDeadlineAt = now + state.turnDurationMs; state.turnRemainingMs = null;
    } else nextTurn(state, next, now);
    if (actor.hand.length === 1 && !intent.declareUno) state.unoWindow = { playerId: actorId, nextPlayerId: next };
    state.revision++; return state;
  }
  throw new UnoRuleError('UNKNOWN_ACTION', 'Thao tác này không hợp lệ.');
}
export function expireUnoDeadline(before: UnoState, now: number): UnoState | null {
  if (before.phase === 'finished' || before.turnDeadlineAt === null || now < before.turnDeadlineAt) return null;
  const state = structuredClone(before);
  const expiredId = state.currentPlayerId;
  const expired = player(state, expiredId);
  if (expired.status !== 'active') return null;
  const nextId = activeCount(state) > 1 ? nextPlayerId(state, expiredId) : null;
  expired.status = 'eliminated'; expired.eliminatedReason = 'timeout';
  state.pendingPenalty = null;
  state.drawnCardId = null;
  if (state.unoWindow?.playerId === expiredId || state.unoWindow?.nextPlayerId === expiredId) state.unoWindow = null;
  if (activeCount(state) <= 1) {
    const winnerId = state.players.find((item) => item.status === 'active')?.id ?? null;
    if (winnerId) state.currentPlayerId = winnerId;
    finish(state, winnerId, winnerId ? 'lastActive' : 'stalemate');
  } else {
    state.currentPlayerId = nextId!;
    state.phase = 'turn';
    state.turnId = `${state.gameId}:turn:${state.revision + 1}`;
    state.turnDeadlineAt = now + state.turnDurationMs;
    state.turnRemainingMs = null;
  }
  state.revision++;
  return state;
}
export function pauseUnoGame(before: UnoState, now: number): UnoState {
  if (before.phase === 'finished' || before.turnDeadlineAt === null) return structuredClone(before);
  const state = structuredClone(before);
  state.turnRemainingMs = Math.max(0, before.turnDeadlineAt - now);
  state.turnDeadlineAt = null;
  state.revision++;
  return state;
}
export function resumeUnoGame(before: UnoState, now: number): UnoState {
  if (before.phase === 'finished' || before.turnDeadlineAt !== null || before.turnRemainingMs === null) return structuredClone(before);
  const state = structuredClone(before);
  state.turnDeadlineAt = now + before.turnRemainingMs;
  state.turnRemainingMs = null;
  state.revision++;
  return state;
}
export function projectGame(state: UnoState, playerId: string, now = 0, paused = false) {
  const you = state.players.find((p) => p.id === playerId);
  if (!you) throw new UnoRuleError('PLAYER_NOT_FOUND', 'Bạn không còn ghế trong ván này.');
  return {
    gameId: state.gameId, revision: state.revision, phase: state.phase,
    players: state.players.map(({ id, nickname, hand, status, eliminatedReason }) => ({ id, nickname, cardCount: hand.length, status, eliminatedReason })),
    hand: you.hand, topCard: state.discardPile.at(-1) ?? null, drawCount: state.drawPile.length,
    currentColor: state.currentColor, direction: state.direction, currentPlayerId: state.currentPlayerId,
    dealerId: state.dealerId, drawnCardId: state.drawnCardId,
    pendingPenalty: state.pendingPenalty ? { ...state.pendingPenalty } : null,
    allowedActions: {
      playableCardIds: you.status === 'active' && state.currentPlayerId === playerId ? you.hand.filter(card => canPlay(state, card)).map(card => card.id) : [],
      canDraw: you.status === 'active' && state.currentPlayerId === playerId && state.phase === 'turn',
      canKeep: you.status === 'active' && state.currentPlayerId === playerId && state.phase === 'drawn',
      canAcceptPenalty: you.status === 'active' && state.currentPlayerId === playerId && state.phase === 'penalty',
      canChooseColor: you.status === 'active' && state.currentPlayerId === playerId && state.phase === 'chooseColor',
      canDeclareUno: you.status === 'active' && state.unoWindow?.playerId === playerId,
      catchUnoPlayerId: you.status === 'active' && state.unoWindow && state.unoWindow.playerId !== playerId && state.currentPlayerId === state.unoWindow.nextPlayerId ? state.unoWindow.playerId : null,
    },
    unoWindow: state.unoWindow, winnerId: state.winnerId, finishReason: state.finishReason,
    turnId: state.turnId, deadlineAt: state.turnDeadlineAt,
    remainingMs: paused ? state.turnRemainingMs : state.turnDeadlineAt === null ? null : Math.max(0, state.turnDeadlineAt - now),
    turnDurationMs: state.turnDurationMs, serverNow: now,
  };
}

export type UnoPublicGame = ReturnType<typeof projectGame>;

