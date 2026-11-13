import { describe, expect, it } from 'vitest';
import { applyNoituAction, createNoituGame, expireNoituDeadline, normalizeNoituText, normalizeNoituWord, pauseNoituGame, projectNoituGame, resumeNoituGame, type NoituDictionary, type NoituState } from './index.ts';

const wordSet = new Set(['nấu cơm', 'cơm nước', 'nước lọc', 'lọc cọc', 'nước cơm', 'cơm cá', 'cá kho', 'kho tàng', 'tàng hình', 'hình ảnh']);
const denied = new Set(['cơm cấm']);
const dictionary: NoituDictionary = { version: 'fixture-1', has: (word) => wordSet.has(word), isDenied: (word) => denied.has(word) };
const seeds = ['nấu cơm'];
const players = [{ id: 'a', nickname: 'An' }, { id: 'b', nickname: 'Bình' }, { id: 'c', nickname: 'Chi' }, { id: 'd', nickname: 'Dũng' }, { id: 'e', nickname: 'Em' }, { id: 'f', nickname: 'Phúc' }];
const create = (count = 3, now = 0) => createNoituGame({ gameId: 'game-1', players: players.slice(0, count), dictionary, seedWords: seeds, randomInt: () => 0, now });
const act = (state: NoituState, actorId: string, intent: Parameters<typeof applyNoituAction>[2], now: number) => applyNoituAction(state, actorId, intent, dictionary, now);

describe('Nối từ engine — NT-VI-1', () => {
  it('chuẩn hóa NFC, chữ thường, khoảng trắng nhưng giữ nguyên dấu và i/y', () => {
    expect(normalizeNoituText('  NA\u0302́U   CƠM  ')).toBe('nấu cơm');
    expect(normalizeNoituWord('nấu cơm')).toBe('nấu cơm');
    expect(normalizeNoituWord('náu cơm')).toBe('náu cơm');
    expect(normalizeNoituWord('nấu cơm nhà')).toBeNull();
    expect(normalizeNoituWord('nấu-cơm')).toBeNull();
  });

  it.each([2, 3, 4, 5, 6])('tạo ván với %i người, seed dùng một lần và người đi đầu được chọn ngẫu nhiên qua RNG', (count) => {
    const game = createNoituGame({ gameId: `g${count}`, players: Array.from({ length: count }, (_, i) => ({ id: `p${i}`, nickname: `P${i}` })), dictionary, seedWords: seeds, randomInt: (max) => max - 1, now: 123 });
    expect(game.players).toHaveLength(count);
    expect(game.currentPlayerId).toBe(`p${count - 1}`);
    expect(game.currentWord).toBe('nấu cơm');
    expect(game.requiredSyllable).toBe('cơm');
    expect(game.usedWords).toEqual(new Set(['nấu cơm']));
    expect(game.turnDeadlineAt).toBe(30_123);
  });

  it('server tự gắn tiếng đầu, từ biết được commit ngay và chuyển lượt/lịch sử', () => {
    const initial = create();
    const next = act(initial, 'a', { type: 'submit', turnId: initial.turnId, suffix: ' NƯỚC ' }, 200);
    expect(next.phase).toBe('turn');
    expect(next.currentWord).toBe('cơm nước');
    expect(next.requiredSyllable).toBe('nước');
    expect(next.currentPlayerId).toBe('b');
    expect(next.history.at(-1)?.word).toBe('cơm nước');
    expect(next.usedWords.has('cơm nước')).toBe(true);
    expect(next.turnDeadlineAt).toBe(30_200);
  });

  it('từ sai cấu trúc, lặp hoặc denylist bị từ chối ngay và không reset hạn lượt', () => {
    const initial = create();
    for (const [suffix, code] of [['hai từ', 'INVALID_SYLLABLE'], ['cấm', 'WORD_BLOCKED']] as const) {
      expect(() => act(initial, 'a', { type: 'submit', turnId: initial.turnId, suffix }, 100)).toThrowError(expect.objectContaining({ code }));
    }
    expect(initial.turnDeadlineAt).toBe(30_000);
    const word = act(initial, 'a', { type: 'submit', turnId: initial.turnId, suffix: 'nước' }, 100);
    const next = act(word, 'b', { type: 'submit', turnId: word.turnId, suffix: 'lọc' }, 200);
    expect(() => act(next, 'c', { type: 'submit', turnId: next.turnId, suffix: 'cọc' }, 300)).not.toThrow();
  });

  it('unknown mở proposal, đóng băng thời gian lượt; strict majority chấp nhận và commit đúng một lần', () => {
    const unknownDictionary: NoituDictionary = { ...dictionary, has: (word) => word !== 'cơm xylophone' && wordSet.has(word) };
    const initial = create();
    const proposalState = applyNoituAction(initial, 'a', { type: 'submit', turnId: initial.turnId, suffix: 'xylophone' }, unknownDictionary, 5_000);
    expect(proposalState.phase).toBe('voting');
    expect(proposalState.currentWord).toBe('nấu cơm');
    expect(proposalState.usedWords.has('cơm xylophone')).toBe(false);
    expect(proposalState.proposal?.eligibleVoterIds).toEqual(['b', 'c']);
    expect(proposalState.proposal?.frozenTurnRemainingMs).toBe(25_000);
    const proposalId = proposalState.proposal!.id;
    const oneVote = act(proposalState, 'b', { type: 'vote', turnId: proposalState.turnId, proposalId, decision: 'accept' }, 6_000);
    expect(oneVote.phase).toBe('voting');
    const accepted = act(oneVote, 'c', { type: 'vote', turnId: oneVote.turnId, proposalId, decision: 'accept' }, 7_000);
    expect(accepted.phase).toBe('turn');
    expect(accepted.currentWord).toBe('cơm xylophone');
    expect(accepted.currentPlayerId).toBe('b');
    expect(accepted.history.at(-1)?.acceptedByGroup).toBe(true);
    expect(accepted.usedWords.has('cơm xylophone')).toBe(true);
    expect(accepted.dictionaryVersion).toBe('fixture-1');
  });

  it('hai người: lá phiếu duy nhất quyết định; voter sai, sender và phiếu lặp không được tính', () => {
    const unknownDictionary: NoituDictionary = { ...dictionary, has: (word) => word !== 'cơm lạ' && wordSet.has(word) };
    const initial = create(2);
    const proposal = applyNoituAction(initial, 'a', { type: 'submit', turnId: initial.turnId, suffix: 'lạ' }, unknownDictionary, 100);
    const proposalId = proposal.proposal!.id;
    expect(() => act(proposal, 'a', { type: 'vote', turnId: proposal.turnId, proposalId, decision: 'accept' }, 200)).toThrowError(expect.objectContaining({ code: 'NOT_ELIGIBLE_VOTER' }));
    const accepted = act(proposal, 'b', { type: 'vote', turnId: proposal.turnId, proposalId, decision: 'accept' }, 200);
    expect(accepted.phase).toBe('turn');
    expect(() => act(accepted, 'b', { type: 'vote', turnId: accepted.turnId, proposalId, decision: 'accept' }, 300)).toThrowError(expect.objectContaining({ code: 'NO_PROPOSAL' }));
  });

  it('proposal bị bác, giữ từ khóa, bỏ suffix khỏi state công khai và người đó thử từ mới', () => {
    const unknownDictionary: NoituDictionary = { ...dictionary, has: (word) => !word.startsWith('cơm ') && wordSet.has(word) };
    const initial = create();
    const proposal = applyNoituAction(initial, 'a', { type: 'submit', turnId: initial.turnId, suffix: 'lạ' }, unknownDictionary, 4_000);
    const proposalId = proposal.proposal!.id;
    const first = applyNoituAction(proposal, 'b', { type: 'vote', turnId: proposal.turnId, proposalId, decision: 'reject' }, unknownDictionary, 5_000);
    const rejected = applyNoituAction(first, 'c', { type: 'vote', turnId: first.turnId, proposalId, decision: 'reject' }, unknownDictionary, 6_000);
    expect(rejected.phase).toBe('turn');
    expect(rejected.currentPlayerId).toBe('a');
    expect(rejected.currentWord).toBe('nấu cơm');
    expect(rejected.requiredSyllable).toBe('cơm');
    expect(rejected.usedWords.has('cơm lạ')).toBe(false);
    expect(rejected.history.some((row) => row.word === 'cơm lạ')).toBe(false);
    expect(rejected.turnDeadlineAt).toBe(32_000);
    expect(() => act(rejected, 'a', { type: 'submit', turnId: rejected.turnId, suffix: 'lạ' }, 7_000)).toThrowError(expect.objectContaining({ code: 'WORD_REJECTED' }));
    expect(() => act(rejected, 'a', { type: 'submit', turnId: rejected.turnId, suffix: 'cá' }, 7_000)).not.toThrow();
  });

  it('vote timeout/tie bác bỏ; proposal thứ hai được tạo nhưng quota thứ ba bị chặn', () => {
    const unknownDictionary: NoituDictionary = { ...dictionary, has: (word) => wordSet.has(word) };
    const initial = create();
    const p1 = applyNoituAction(initial, 'a', { type: 'submit', turnId: initial.turnId, suffix: 'lạ' }, unknownDictionary, 1_000);
    const voted = act(p1, 'b', { type: 'vote', turnId: p1.turnId, proposalId: p1.proposal!.id, decision: 'accept' }, 2_000);
    const rejected = expireNoituDeadline(voted, 16_000)!;
    expect(rejected.phase).toBe('turn');
    expect(rejected.turnDeadlineAt).toBe(45_000);
    const p2 = applyNoituAction(rejected, 'a', { type: 'submit', turnId: rejected.turnId, suffix: 'xylophone' }, unknownDictionary, 17_000);
    const rejectId = p2.proposal!.id;
    const second = act(p2, 'b', { type: 'vote', turnId: p2.turnId, proposalId: rejectId, decision: 'reject' }, 18_000);
    const rejected2 = act(second, 'c', { type: 'vote', turnId: second.turnId, proposalId: rejectId, decision: 'reject' }, 19_000);
    expect(rejected2.proposalsThisTurn).toBe(2);
    expect(() => act(rejected2, 'a', { type: 'submit', turnId: rejected2.turnId, suffix: 'kho' }, 20_000)).toThrowError(expect.objectContaining({ code: 'PROPOSAL_LIMIT' }));
    expect(() => act(rejected2, 'a', { type: 'submit', turnId: rejected2.turnId, suffix: 'nước' }, 20_000)).not.toThrow();
  });

  it('bỏ phiếu không đủ eligible majority thì chưa quyết định; voter/eliminated ngoài eligible bị chặn', () => {
    const initial = create(4);
    const unknownDictionary: NoituDictionary = { ...dictionary, has: (word) => wordSet.has(word) };
    const proposal = applyNoituAction(initial, 'a', { type: 'submit', turnId: initial.turnId, suffix: 'lạ' }, unknownDictionary, 100);
    expect(proposal.proposal?.eligibleVoterIds).toEqual(['b', 'c', 'd']);
    const one = act(proposal, 'b', { type: 'vote', turnId: proposal.turnId, proposalId: proposal.proposal!.id, decision: 'accept' }, 200);
    expect(one.phase).toBe('voting');
    expect(() => act(one, 'b', { type: 'vote', turnId: one.turnId, proposalId: one.proposal!.id, decision: 'reject' }, 300)).toThrowError(expect.objectContaining({ code: 'ALREADY_VOTED' }));
  });

  it('timeout tại now >= deadline loại người đang lượt một lần; giveUp chốt người cuối thắng ngay', () => {
    const initial = create(2);
    expect(expireNoituDeadline(initial, 29_999)).toBeNull();
    const expired = expireNoituDeadline(initial, 30_000)!;
    expect(expired.phase).toBe('finished');
    expect(expired.winnerId).toBe('b');
    expect(expired.players.find((player) => player.id === 'a')?.status).toBe('eliminated');
    expect(expireNoituDeadline(expired, 99_000)).toBeNull();
    const resigned = act(initial, 'a', { type: 'giveUp', turnId: initial.turnId }, 2_000);
    expect(resigned.phase).toBe('finished');
    expect(resigned.winnerId).toBe('b');
  });

  it('pause/resume giữ đúng thời gian còn lại của lượt và biểu quyết', () => {
    const initial = create(2);
    const pausedTurn = pauseNoituGame(initial, 8_000);
    expect(pausedTurn.turnDeadlineAt).toBeNull();
    expect(pausedTurn.turnRemainingMs).toBe(22_000);
    const resumedTurn = resumeNoituGame(pausedTurn, 100_000);
    expect(resumedTurn.turnDeadlineAt).toBe(122_000);
    const unknownDictionary: NoituDictionary = { ...dictionary, has: (word) => wordSet.has(word) };
    const proposal = applyNoituAction(initial, 'a', { type: 'submit', turnId: initial.turnId, suffix: 'lạ' }, unknownDictionary, 5_000);
    const pausedVote = pauseNoituGame(proposal, 7_000);
    expect(pausedVote.proposal?.deadlineAt).toBeNull();
    expect(pausedVote.proposal?.remainingMs).toBe(13_000);
    const resumedVote = resumeNoituGame(pausedVote, 50_000);
    expect(resumedVote.proposal?.deadlineAt).toBe(63_000);
    expect(resumedVote.proposal?.remainingMs).toBeNull();
  });

  it('projection không lộ usedWords hoặc dictionary, chỉ gửi public state/quyền vote', () => {
    const initial = create();
    const publicState = projectNoituGame(initial, 'a', 0, false);
    expect(publicState.canSubmit).toBe(true);
    expect(publicState.currentWord).toBe('nấu cơm');
    expect(JSON.stringify(publicState)).not.toContain('usedWords');
    expect(JSON.stringify(publicState)).not.toContain('lọc cọc');
    expect((publicState as unknown as Record<string, unknown>).dictionaryVersion).toBe('fixture-1');
  });
});
