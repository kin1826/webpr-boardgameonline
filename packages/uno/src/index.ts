export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';
export type CardType = 'number' | 'drawTwo' | 'reverse' | 'skip' | 'wild' | 'wildDrawFour';
export type UnoCard = { id: string; color: CardColor; type: CardType; value?: number };
export type UnoPlayer = { id: string; nickname: string; hand: UnoCard[] };
export type UnoState = {
  gameId: string; players: UnoPlayer[]; drawPile: UnoCard[]; discardPile: UnoCard[];
  currentColor: Exclude<CardColor, 'wild'> | null; direction: 1 | -1; currentPlayerId: string; dealerId: string;
  phase: 'chooseColor' | 'turn' | 'drawn' | 'penalty' | 'finished'; drawnCardId: string | null;
  pendingPenalty: null | { total: number; lastType: 'drawTwo' | 'wildDrawFour'; targetId: string; pendingWinnerId: string | null };
  unoWindow: null | { playerId: string; nextPlayerId: string };
  winnerId: string | null; finishReason: 'winner' | 'stalemate' | null; revision: number;
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
  const index = state.players.findIndex((player) => player.id === playerId);
  if (index < 0) throw new UnoRuleError('PLAYER_NOT_FOUND', 'Không tìm thấy người chơi trong ván.');
  const n = state.players.length;
  return state.players[(index + state.direction * steps % n + n) % n]!.id;
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
  state.pendingPenalty = null; state.unoWindow = null; state.drawnCardId = null;
  return true;
}
export function createGame(input: { gameId: string; players: Array<{ id: string; nickname: string }>; randomInt: (max: number) => number }): UnoState {
  const { gameId, randomInt } = input;
  if (input.players.length < 2 || input.players.length > 6) throw new UnoRuleError('PLAYER_COUNT', 'UNO cần từ 2 đến 6 người chơi.');
  if (new Set(input.players.map((p) => p.id)).size !== input.players.length) throw new UnoRuleError('DUPLICATE_PLAYER', 'Danh sách người chơi bị trùng.');
  const players = input.players.map((p) => ({ ...p, hand: [] as UnoCard[] }));
  const dealerId = pickDealer(players, gameId, randomInt);
  let drawPile = shuffle(createDeck(gameId), randomInt);
  for (let i = 0; i < 7; i++) for (const player of players) player.hand.push(drawPile.pop()!);
  const state: UnoState = {
    gameId, players, drawPile, discardPile: [], currentColor: null,
    direction: 1, currentPlayerId: players[(players.findIndex((p) => p.id === dealerId) + 1) % players.length]!.id,
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
function turn(state: UnoState, id: string): UnoPlayer {
  if (state.phase === 'finished') throw new UnoRuleError('GAME_FINISHED', 'Ván này đã kết thúc.');
  if (state.currentPlayerId !== id) throw new UnoRuleError('NOT_YOUR_TURN', 'Chưa tới lượt của bạn.');
  return player(state, id);
}
function finish(state: UnoState, winner: string | null, reason: 'winner' | 'stalemate') {
  state.phase = 'finished'; state.winnerId = winner; state.finishReason = reason;
  state.pendingPenalty = null; state.drawnCardId = null; state.unoWindow = null;
}
function nextTurn(state: UnoState, id: string) { state.currentPlayerId = id; state.phase = 'turn'; state.drawnCardId = null; }
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
    return Boolean(pending && !pending.pendingWinnerId &&
      (card.type === 'wildDrawFour' || (pending.lastType === 'drawTwo' && card.type === 'drawTwo')));
  }
  if (state.phase !== 'turn' && state.phase !== 'drawn') return false;
  return (state.phase !== 'drawn' || state.drawnCardId === card.id) && playable(card, state.discardPile.at(-1)!, state.currentColor);
}
function requireColor(color: unknown): asserts color is Exclude<CardColor, 'wild'> {
  if (!COLORS.includes(color as Exclude<CardColor, 'wild'>)) throw new UnoRuleError('COLOR_REQUIRED', 'Hãy chọn một trong bốn màu hợp lệ.');
}
export function applyGameAction(before: UnoState, actorId: string, intent: UnoIntent, randomInt: (max: number) => number): UnoState {
  if (before.phase === 'finished') throw new UnoRuleError('GAME_FINISHED', 'Ván này đã kết thúc.');
  const state = structuredClone(before);
  if (state.phase === 'chooseColor') {
    if (intent.type !== 'chooseColor') throw new UnoRuleError('COLOR_REQUIRED', 'Người đi trước cần chọn màu cho lá Wild mở đầu.');
    if (state.currentPlayerId !== actorId) throw new UnoRuleError('NOT_YOUR_TURN', 'Chưa tới lượt bạn chọn màu.');
    requireColor(intent.color);
    state.currentColor = intent.color; state.phase = 'turn'; state.revision++; return state;
  }
  if (intent.type === 'chooseColor') throw new UnoRuleError('COLOR_NOT_ALLOWED', 'Hiện không cần chọn màu mở đầu.');
  if (intent.type === 'catchUno') {
    player(state, actorId);
    const window = state.unoWindow;
    if (!window || window.playerId !== intent.targetPlayerId || actorId === window.playerId || state.currentPlayerId !== window.nextPlayerId) throw new UnoRuleError('UNO_WINDOW_CLOSED', 'Không còn lượt nào để bắt lỗi UNO.');
    const cards = takeCards(state, 2, randomInt); player(state, window.playerId).hand.push(...cards);
    if (!stalemate(state, 2, cards.length)) state.unoWindow = null;
    state.revision++; return state;
  }
  if (intent.type === 'declareUno') {
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
      else nextTurn(state, nextPlayerId(state, actorId));
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
      else nextTurn(state, nextPlayerId(state, actorId));
    }
    state.revision++; return state;
  }
  if (intent.type === 'keep') {
    if (state.unoWindow?.nextPlayerId === actorId) state.unoWindow = null;
    turn(state, actorId);
    if (state.phase !== 'drawn' || !state.drawnCardId) throw new UnoRuleError('NO_DRAWN_CARD', 'Bạn chưa rút lá nào trong lượt này.');
    nextTurn(state, nextPlayerId(state, actorId)); state.revision++; return state;
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
    const next = card.type === 'skip' || (card.type === 'reverse' && state.players.length === 2) ? nextPlayerId(state, actorId, 2) : nextPlayerId(state, actorId);
    if (actor.hand.length === 0) finish(state, actorId, 'winner');
    else if (card.type === 'drawTwo' || card.type === 'wildDrawFour') {
      state.pendingPenalty = { total: (state.pendingPenalty?.total ?? 0) + (card.type === 'drawTwo' ? 2 : 4), lastType: card.type, targetId: next, pendingWinnerId: actor.hand.length === 0 ? actorId : null };
      state.phase = 'penalty'; state.currentPlayerId = next;
    } else nextTurn(state, next);
    if (actor.hand.length === 1 && !intent.declareUno) state.unoWindow = { playerId: actorId, nextPlayerId: next };
    state.revision++; return state;
  }
  throw new UnoRuleError('UNKNOWN_ACTION', 'Thao tác này không hợp lệ.');
}
export function projectGame(state: UnoState, playerId: string) {
  const you = state.players.find((p) => p.id === playerId);
  if (!you) throw new UnoRuleError('PLAYER_NOT_FOUND', 'Bạn không còn ghế trong ván này.');
  return {
    gameId: state.gameId, revision: state.revision, phase: state.phase,
    players: state.players.map(({ id, nickname, hand }) => ({ id, nickname, cardCount: hand.length })),
    hand: you.hand, topCard: state.discardPile.at(-1) ?? null, drawCount: state.drawPile.length,
    currentColor: state.currentColor, direction: state.direction, currentPlayerId: state.currentPlayerId,
    dealerId: state.dealerId, drawnCardId: state.drawnCardId,
    pendingPenalty: state.pendingPenalty ? { ...state.pendingPenalty } : null,
    allowedActions: {
      playableCardIds: state.currentPlayerId === playerId ? you.hand.filter(card => canPlay(state, card)).map(card => card.id) : [],
      canDraw: state.currentPlayerId === playerId && state.phase === 'turn',
      canKeep: state.currentPlayerId === playerId && state.phase === 'drawn',
      canAcceptPenalty: state.currentPlayerId === playerId && state.phase === 'penalty',
      canChooseColor: state.currentPlayerId === playerId && state.phase === 'chooseColor',
      canDeclareUno: state.unoWindow?.playerId === playerId,
      catchUnoPlayerId: state.unoWindow && state.unoWindow.playerId !== playerId && state.currentPlayerId === state.unoWindow.nextPlayerId ? state.unoWindow.playerId : null,
    },
    unoWindow: state.unoWindow, winnerId: state.winnerId, finishReason: state.finishReason,
  };
}

export type UnoPublicGame = ReturnType<typeof projectGame>;

