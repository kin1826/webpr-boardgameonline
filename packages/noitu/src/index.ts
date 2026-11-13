export const NOITU_MIN_PLAYERS = 2;
export const NOITU_MAX_PLAYERS = 6;
export const NOITU_TURN_MS = 30_000;
export const NOITU_VOTE_MS = 15_000;
export const NOITU_MAX_PROPOSALS_PER_TURN = 2;
export const NOITU_HISTORY_LIMIT = 100;

export type NoituDictionary = {
  version: string;
  has(word: string): boolean;
  isDenied(word: string): boolean;
};
export type NoituPlayer = { id: string; nickname: string; status: 'active' | 'eliminated' };
export type NoituVote = 'accept' | 'reject';
export type NoituHistoryEntry = {
  word: string; playerId: string | null; nickname: string; kind: 'seed' | 'accepted'; acceptedByGroup: boolean;
};
export type NoituProposal = {
  id: string;
  word: string;
  proposerId: string;
  eligibleVoterIds: string[];
  votes: Record<string, NoituVote>;
  deadlineAt: number | null;
  remainingMs: number | null;
  frozenTurnRemainingMs: number;
};
export type NoituState = {
  gameId: string;
  revision: number;
  players: NoituPlayer[];
  order: string[];
  phase: 'turn' | 'voting' | 'finished';
  currentPlayerId: string | null;
  turnId: string;
  seedWord: string;
  currentWord: string;
  requiredSyllable: string;
  turnDeadlineAt: number | null;
  turnRemainingMs: number | null;
  proposalsThisTurn: number;
  rejectedThisTurn: string[];
  usedWords: Set<string>;
  history: NoituHistoryEntry[];
  proposal: NoituProposal | null;
  winnerId: string | null;
  notice: string | null;
  dictionaryVersion: string;
};
export type NoituIntent =
  | { type: 'submit'; suffix: string; turnId: string }
  | { type: 'giveUp'; turnId: string }
  | { type: 'vote'; turnId: string; proposalId: string; decision: NoituVote };
export type NoituPublicGame = {
  gameId: string;
  revision: number;
  phase: NoituState['phase'];
  players: Array<Pick<NoituPlayer, 'id' | 'nickname' | 'status'>>;
  order: string[];
  currentPlayerId: string | null;
  turnId: string;
  seedWord: string;
  currentWord: string;
  requiredSyllable: string;
  deadlineAt: number | null;
  remainingMs: number | null;
  serverNow: number;
  proposalsThisTurn: number;
  proposal: null | {
    id: string;
    word: string;
    proposerId: string;
    eligibleVoterIds: string[];
    votes: Record<string, NoituVote>;
    acceptCount: number;
    rejectCount: number;
    deadlineAt: number | null;
    remainingMs: number | null;
    canVote: boolean;
  };
  history: NoituHistoryEntry[];
  historyCount: number;
  usedCount: number;
  winnerId: string | null;
  notice: string | null;
  dictionaryVersion: string;
  canSubmit: boolean;
  canGiveUp: boolean;
};

export class NoituRuleError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'NoituRuleError'; }
}

const LETTERS = new Set(Array.from('abcdefghijklmnopqrstuvwxyzđàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ'));

export function normalizeNoituText(value: string): string {
  return value.normalize('NFC').toLowerCase().trim().replace(/\s+/gu, ' ');
}

export function isNoituSyllable(value: string): boolean {
  const normalized = normalizeNoituText(value);
  return normalized.length > 0 && Array.from(normalized).every((char) => LETTERS.has(char));
}

export function normalizeNoituWord(value: string): string | null {
  const normalized = normalizeNoituText(value);
  const parts = normalized.split(' ');
  return parts.length === 2 && parts.every(isNoituSyllable) ? normalized : null;
}

function assertRandomIndex(randomInt: (max: number) => number, max: number): number {
  const index = randomInt(max);
  if (!Number.isInteger(index) || index < 0 || index >= max) throw new Error('RNG trả chỉ số ngoài phạm vi.');
  return index;
}

export function createNoituGame(input: {
  gameId: string;
  players: Array<{ id: string; nickname: string }>;
  dictionary: NoituDictionary;
  seedWords: readonly string[];
  randomInt: (max: number) => number;
  now: number;
}): NoituState {
  if (input.players.length < NOITU_MIN_PLAYERS || input.players.length > NOITU_MAX_PLAYERS) throw new NoituRuleError('PLAYER_COUNT', 'Nối từ cần từ 2 đến 6 người chơi.');
  if (new Set(input.players.map((player) => player.id)).size !== input.players.length) throw new NoituRuleError('DUPLICATE_PLAYER', 'Danh sách người chơi bị trùng.');
  const seeds = input.seedWords.map(normalizeNoituWord).filter((word): word is string => Boolean(word) && input.dictionary.has(word!) && !input.dictionary.isDenied(word!));
  if (!seeds.length) throw new NoituRuleError('DICTIONARY_NOT_READY', 'Chưa có từ mồi hợp lệ. Nối từ hiện chưa thể bắt đầu.');
  const seedWord = seeds[assertRandomIndex(input.randomInt, seeds.length)]!;
  const requiredSyllable = seedWord.split(' ')[1]!;
  const currentPlayerId = input.players[assertRandomIndex(input.randomInt, input.players.length)]!.id;
  return {
    gameId: input.gameId, revision: 0,
    players: input.players.map((player) => ({ ...player, status: 'active' })),
    order: input.players.map((player) => player.id), phase: 'turn', currentPlayerId,
    turnId: `${input.gameId}:turn:0`, seedWord, currentWord: seedWord, requiredSyllable,
    turnDeadlineAt: input.now + NOITU_TURN_MS, turnRemainingMs: null,
    proposalsThisTurn: 0, rejectedThisTurn: [], usedWords: new Set([seedWord]),
    history: [{ word: seedWord, playerId: null, nickname: 'Từ mồi', kind: 'seed', acceptedByGroup: false }],
    proposal: null, winnerId: null, notice: null, dictionaryVersion: input.dictionary.version,
  };
}

function activePlayer(state: NoituState, playerId: string) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || player.status !== 'active') throw new NoituRuleError('PLAYER_ELIMINATED', 'Bạn không còn trong lượt chơi.');
  return player;
}

function assertTurn(state: NoituState, actorId: string, turnId: string) {
  if (state.phase === 'finished') throw new NoituRuleError('GAME_FINISHED', 'Ván đã kết thúc.');
  if (state.phase !== 'turn') throw new NoituRuleError('NOT_TURN_PHASE', 'Đang chờ nhóm biểu quyết từ hiện tại.');
  if (turnId !== state.turnId) throw new NoituRuleError('STALE_TURN', 'Lượt đã thay đổi. Bàn chơi đang được cập nhật.');
  if (state.currentPlayerId !== actorId) throw new NoituRuleError('NOT_YOUR_TURN', 'Chưa tới lượt bạn.');
  return activePlayer(state, actorId);
}

function nextActivePlayer(state: NoituState, afterPlayerId: string): string | null {
  const start = state.order.indexOf(afterPlayerId);
  for (let offset = 1; offset <= state.order.length; offset++) {
    const id = state.order[(start + offset) % state.order.length]!;
    if (state.players.find((player) => player.id === id)?.status === 'active') return id;
  }
  return null;
}

function finishIfLast(state: NoituState) {
  const remaining = state.players.filter((player) => player.status === 'active');
  if (remaining.length <= 1) {
    state.phase = 'finished'; state.winnerId = remaining[0]?.id ?? null;
    state.currentPlayerId = null; state.turnDeadlineAt = null; state.turnRemainingMs = null; state.proposal = null;
    return true;
  }
  return false;
}

function commitAccepted(before: NoituState, word: string, playerId: string, now: number, acceptedByGroup: boolean): NoituState {
  const state = structuredClone(before);
  const actor = activePlayer(state, playerId);
  state.usedWords.add(word);
  state.currentWord = word; state.requiredSyllable = word.split(' ')[1]!;
  state.history.push({ word, playerId, nickname: actor.nickname, kind: 'accepted', acceptedByGroup });
  state.currentPlayerId = nextActivePlayer(state, playerId);
  state.phase = 'turn'; state.turnId = `${state.gameId}:turn:${state.revision + 1}`;
  state.turnDeadlineAt = now + NOITU_TURN_MS; state.turnRemainingMs = null;
  state.proposalsThisTurn = 0; state.rejectedThisTurn = []; state.proposal = null;
  state.notice = acceptedByGroup ? `“${word}” được nhóm chấp nhận.` : `Đã chấp nhận “${word}”.`;
  state.revision++;
  return state;
}

function rejectProposal(before: NoituState, now: number, reason: 'vote' | 'timeout'): NoituState {
  const state = structuredClone(before);
  const proposal = state.proposal!;
  state.phase = 'turn'; state.turnDeadlineAt = now + proposal.frozenTurnRemainingMs; state.turnRemainingMs = null;
  state.currentPlayerId = proposal.proposerId; state.rejectedThisTurn.push(proposal.word);
  state.proposal = null;
  state.notice = reason === 'timeout' ? `Không đủ phiếu chấp nhận “${proposal.word}”. Hãy nghĩ từ khác.` : `“${proposal.word}” chưa được nhóm chấp nhận. Hãy nghĩ từ khác.`;
  state.revision++;
  return state;
}

function counts(votes: Record<string, NoituVote>) {
  let acceptCount = 0; let rejectCount = 0;
  for (const vote of Object.values(votes)) vote === 'accept' ? acceptCount++ : rejectCount++;
  return { acceptCount, rejectCount };
}

export function applyNoituAction(before: NoituState, actorId: string, intent: NoituIntent, dictionary: NoituDictionary, now: number): NoituState {
  if (intent.type === 'submit') {
    const actor = assertTurn(before, actorId, intent.turnId);
    if (before.turnDeadlineAt === null || now >= before.turnDeadlineAt) throw new NoituRuleError('TURN_EXPIRED', 'Đã hết thời gian lượt.');
    const suffix = normalizeNoituText(intent.suffix);
    if (!isNoituSyllable(suffix) || suffix.includes(' ')) throw new NoituRuleError('INVALID_SYLLABLE', 'Nhập một tiếng hợp lệ, không có khoảng trắng hoặc ký hiệu.');
    const word = `${before.requiredSyllable} ${suffix}`;
    if (before.usedWords.has(word)) throw new NoituRuleError('WORD_ALREADY_USED', 'Từ này đã được dùng trong ván. Hãy nghĩ từ khác.');
    if (dictionary.isDenied(word)) throw new NoituRuleError('WORD_BLOCKED', 'Từ này không được phép dùng. Hãy nghĩ từ khác.');
    if (dictionary.has(word)) return commitAccepted(before, word, actor.id, now, false);
    if (before.proposalsThisTurn >= NOITU_MAX_PROPOSALS_PER_TURN) throw new NoituRuleError('PROPOSAL_LIMIT', 'Bạn đã dùng hết 2 lượt đề xuất trong lượt này. Hãy dùng từ có trong từ điển hoặc chịu thua.');
    if (before.rejectedThisTurn.includes(word)) throw new NoituRuleError('WORD_REJECTED', 'Từ này vừa bị nhóm bác bỏ. Hãy nghĩ từ khác.');
    if (!before.players.some((player) => player.id !== actor.id && player.status === 'active')) throw new NoituRuleError('NO_ELIGIBLE_VOTERS', 'Không còn người chơi khác để biểu quyết.');
    const state = structuredClone(before);
    const eligibleVoterIds = state.players.filter((player) => player.id !== actor.id && player.status === 'active').map((player) => player.id);
    state.phase = 'voting'; state.turnRemainingMs = null; state.turnDeadlineAt = null;
    state.proposalsThisTurn++;
    state.proposal = {
      id: `${state.gameId}:proposal:${state.revision + 1}`, word, proposerId: actor.id,
      eligibleVoterIds, votes: {}, deadlineAt: now + NOITU_VOTE_MS, remainingMs: null,
      frozenTurnRemainingMs: Math.max(0, before.turnDeadlineAt! - now),
    };
    state.notice = `“${word}” chưa có trong từ điển thử nghiệm. Cả nhóm có 15 giây để biểu quyết.`;
    state.revision++;
    return state;
  }

  if (intent.type === 'giveUp') {
    assertTurn(before, actorId, intent.turnId);
    if (before.turnDeadlineAt === null || now >= before.turnDeadlineAt) throw new NoituRuleError('TURN_EXPIRED', 'Đã hết thời gian lượt.');
    const state = structuredClone(before);
    state.players.find((player) => player.id === actorId)!.status = 'eliminated';
    if (finishIfLast(state)) state.notice = `${state.players.find((player) => player.id === state.winnerId)?.nickname ?? 'Người chơi'} thắng ván này.`;
    else {
      state.currentPlayerId = nextActivePlayer(state, actorId);
      state.phase = 'turn'; state.turnId = `${state.gameId}:turn:${state.revision + 1}`;
      state.turnDeadlineAt = now + NOITU_TURN_MS; state.turnRemainingMs = null;
      state.proposalsThisTurn = 0; state.rejectedThisTurn = []; state.notice = `${activePlayer(state, state.currentPlayerId!).nickname} tiếp tục lượt.`;
    }
    state.revision++;
    return state;
  }

  if (before.phase !== 'voting' || !before.proposal) throw new NoituRuleError('NO_PROPOSAL', 'Không có từ nào đang chờ biểu quyết.');
  if (intent.turnId !== before.turnId) throw new NoituRuleError('STALE_TURN', 'Lượt đã thay đổi. Bàn chơi đang được cập nhật.');
  const proposal = before.proposal;
  if (intent.proposalId !== proposal.id) throw new NoituRuleError('STALE_PROPOSAL', 'Cuộc biểu quyết này đã kết thúc.');
  if (proposal.deadlineAt === null || now >= proposal.deadlineAt) throw new NoituRuleError('VOTE_EXPIRED', 'Đã hết thời gian biểu quyết.');
  if (!proposal.eligibleVoterIds.includes(actorId)) throw new NoituRuleError('NOT_ELIGIBLE_VOTER', 'Bạn không có quyền biểu quyết từ này.');
  if (proposal.votes[actorId]) throw new NoituRuleError('ALREADY_VOTED', 'Bạn đã bỏ phiếu cho từ này.');
  const state = structuredClone(before);
  state.proposal!.votes[actorId] = intent.decision;
  const tally = counts(state.proposal!.votes);
  const majority = state.proposal!.eligibleVoterIds.length / 2;
  if (tally.acceptCount > majority) return commitAccepted(state, proposal.word, proposal.proposerId, now, true);
  if (tally.rejectCount > majority) return rejectProposal(state, now, 'vote');
  state.notice = `Đã ghi nhận ${tally.acceptCount} phiếu chấp nhận, ${tally.rejectCount} phiếu bác bỏ.`;
  state.revision++;
  return state;
}

export function expireNoituDeadline(before: NoituState, now: number): NoituState | null {
  if (before.phase === 'voting' && before.proposal?.deadlineAt !== null && before.proposal?.deadlineAt !== undefined && now >= before.proposal.deadlineAt) return rejectProposal(before, now, 'timeout');
  if (before.phase !== 'turn' || before.turnDeadlineAt === null || now < before.turnDeadlineAt || !before.currentPlayerId) return null;
  const state = structuredClone(before);
  const expiredId = before.currentPlayerId;
  if (!expiredId) return null;
  const expiredPlayer = activePlayer(state, expiredId);
  expiredPlayer.status = 'eliminated';
  if (finishIfLast(state)) state.notice = `Hết giờ — ${expiredPlayer.nickname} bị loại. ${state.players.find((player) => player.id === state.winnerId)?.nickname ?? 'Người chơi'} thắng ván này.`;
  else {
    const nextId = nextActivePlayer(state, expiredId);
    if (!nextId) throw new Error('Không tìm thấy người chơi còn lại sau khi loại lượt hết giờ.');
    state.currentPlayerId = nextId;
    state.phase = 'turn'; state.turnId = `${state.gameId}:turn:${state.revision + 1}`;
    state.turnDeadlineAt = now + NOITU_TURN_MS; state.turnRemainingMs = null;
    state.proposalsThisTurn = 0; state.rejectedThisTurn = [];
    state.notice = `Hết giờ — ${expiredPlayer.nickname} bị loại. ${activePlayer(state, state.currentPlayerId!).nickname} tới lượt.`;
  }
  state.revision++;
  return state;
}

export function pauseNoituGame(before: NoituState, now: number): NoituState {
  const state = structuredClone(before);
  if (state.phase === 'turn' && state.turnDeadlineAt !== null) {
    state.turnRemainingMs = Math.max(0, state.turnDeadlineAt - now); state.turnDeadlineAt = null;
  } else if (state.phase === 'voting' && state.proposal && state.proposal.deadlineAt !== null) {
    state.proposal.remainingMs = Math.max(0, state.proposal.deadlineAt - now); state.proposal.deadlineAt = null;
  }
  state.revision++;
  return state;
}

export function resumeNoituGame(before: NoituState, now: number): NoituState {
  const state = structuredClone(before);
  if (state.phase === 'turn' && state.turnDeadlineAt === null && state.turnRemainingMs !== null) {
    state.turnDeadlineAt = now + state.turnRemainingMs; state.turnRemainingMs = null;
  } else if (state.phase === 'voting' && state.proposal && state.proposal.deadlineAt === null && state.proposal.remainingMs !== null) {
    state.proposal.deadlineAt = now + state.proposal.remainingMs; state.proposal.remainingMs = null;
  }
  state.revision++;
  return state;
}

export function projectNoituGame(state: NoituState, viewerId: string, now: number, paused: boolean): NoituPublicGame {
  const proposal = state.proposal;
  const eligible = proposal?.eligibleVoterIds.includes(viewerId) ?? false;
  const activeTurn = state.phase === 'turn' && state.currentPlayerId === viewerId && !paused;
  const projectedProposal = proposal ? {
    id: proposal.id, word: proposal.word, proposerId: proposal.proposerId,
    eligibleVoterIds: [...proposal.eligibleVoterIds], votes: { ...proposal.votes },
    ...counts(proposal.votes), deadlineAt: proposal.deadlineAt,
    remainingMs: proposal.remainingMs, canVote: eligible && !proposal.votes[viewerId] && !paused,
  } : null;
  return {
    gameId: state.gameId, revision: state.revision, phase: state.phase,
    players: state.players.map(({ id, nickname, status }) => ({ id, nickname, status })), order: [...state.order],
    currentPlayerId: state.currentPlayerId, turnId: state.turnId, seedWord: state.seedWord,
    currentWord: state.currentWord, requiredSyllable: state.requiredSyllable,
    deadlineAt: state.phase === 'voting' ? proposal?.deadlineAt ?? null : state.turnDeadlineAt,
    remainingMs: state.phase === 'voting' ? proposal?.remainingMs ?? null : state.turnRemainingMs,
    serverNow: now, proposalsThisTurn: state.proposalsThisTurn, proposal: projectedProposal,
    history: state.history.slice(-NOITU_HISTORY_LIMIT), historyCount: state.history.length,
    usedCount: state.usedWords.size, winnerId: state.winnerId, notice: state.notice,
    dictionaryVersion: state.dictionaryVersion, canSubmit: activeTurn, canGiveUp: activeTurn,
  };
}
