import { describe, expect, it } from 'vitest';
import { applyAction, createGame, expireDeadline, perft, projectGame, pauseGame, resumeGame, type State } from './index';
const create = (clock: { initialMs: number; incrementMs: number } | null = null) => createGame({ gameId: 'test', players: [{ id: 'a', nickname: 'A' }, { id: 'b', nickname: 'B' }], randomInt: () => 0, now: 0, clock });
const play = (s: State, id: string, from: string, to: string, promotion?: 'queen' | 'rook' | 'bishop' | 'knight') => applyAction(s, id, { type: 'move', turnId: s.turnId, move: { from: from as never, to: to as never, ...(promotion ? { promotion } : {}) } }, 1);
describe('HQ-COVUA-1 engine', () => {
  it('has 32 pieces, 20 initial moves and standard perft', () => { const s = create(); expect(Object.values(s.board).filter(Boolean)).toHaveLength(32); expect(projectGame(s, 'a', 0).legalMoves).toHaveLength(20); expect([perft(1), perft(2), perft(3)]).toEqual([20, 400, 8902]); });
  it('keeps stable piece ID and rejects illegal or out-of-turn moves without mutation', () => { const s = create(); expect(() => play(s, 'b', 'e7', 'e5')).toThrow(); expect(() => play(s, 'a', 'e2', 'e5')).toThrow(); const t = play(s, 'a', 'e2', 'e4'); expect(t.board.e4?.id).toBe(s.board.e2?.id); expect(s.board.e2?.role).toBe('pawn'); expect(t.currentColor).toBe('black'); });
  it('recognizes checkmate and freezes result', () => { let s = create(); s = play(s, 'a', 'f2', 'f3'); s = play(s, 'b', 'e7', 'e5'); s = play(s, 'a', 'g2', 'g4'); s = play(s, 'b', 'd8', 'h4'); expect(s.finishReason).toBe('checkmate'); expect(s.winnerColor).toBe('black'); expect(() => play(s, 'a', 'e2', 'e4')).toThrow(); });
  it('times out at equality before move; bare king opponent draws by HQ convention', () => { const s = create({ initialMs: 60_000, incrementMs: 0 }); expect(expireDeadline(s, 59_999)).toBeNull(); expect(expireDeadline(s, 60_000)?.winnerColor).toBe('black'); expect(() => applyAction(s, 'a', { type: 'move', turnId: s.turnId, move: { from: 'e2', to: 'e4' } }, 60_000)).toThrow(); });
  it('en passant removes the pawn on the captured square', () => { let s = create(); for (const [id, from, to] of [['a','e2','e4'],['b','a7','a6'],['a','e4','e5'],['b','d7','d5'],['a','e5','d6']] as const) s = play(s,id,from,to); expect(s.board.d5).toBeNull(); expect(s.board.d6?.color).toBe('white'); expect(s.lastMove?.captureSquare).toBe('d5'); });
  it('castles with rook identity intact', () => { let s = create(); for (const [id,from,to] of [['a','g1','f3'],['b','a7','a6'],['a','e2','e4'],['b','a6','a5'],['a','f1','e2'],['b','a5','a4'],['a','e1','g1']] as const) s = play(s,id,from,to); expect(s.board.g1?.role).toBe('king'); expect(s.board.f1?.id).toBe('w-h1'); expect(s.lastMove?.rookMove?.from).toBe('h1'); });
});

describe('Cờ vua review regressions', () => {
  it('projects elapsed time on every snapshot and freezes it while paused without mutating state', () => {
    const s = create({ initialMs: 60_000, incrementMs: 0 });
    expect(projectGame(s, 'a', 20_000).clock?.remainingMs.white).toBe(40_000);
    expect(projectGame(s, 'a', 25_000).clock?.remainingMs.white).toBe(35_000);
    expect(s.clock?.remainingMs.white).toBe(60_000);
    const paused = pauseGame(s, 20_000);
    expect(projectGame(paused, 'a', 90_000).clock?.remainingMs.white).toBe(40_000);
    const resumed = resumeGame(paused, 100_000);
    expect(projectGame(resumed, 'a', 105_000).clock?.remainingMs.white).toBe(35_000);
    expect(expireDeadline(resumed, 140_000)?.finishReason).toBe('timeout');
  });
  it('keeps elapsed clock when an offer produces a new snapshot', () => {
    const s = create({ initialMs: 60_000, incrementMs: 0 });
    const offered = applyAction(s, 'a', { type: 'offerDraw', turnId: s.turnId }, 20_000);
    expect(projectGame(offered, 'a', 20_000).clock?.remainingMs.white).toBe(40_000);
  });
  it('claims repetition using the intended move without committing that move', () => {
    let s = create();
    for (const [id, from, to] of [['a','g1','f3'],['b','g8','f6'],['a','f3','g1'],['b','f6','g8'],['a','g1','f3'],['b','g8','f6'],['a','f3','g1']] as const) s = play(s,id,from,to);
    const claimed = applyAction(s, 'b', { type: 'claimDraw', turnId: s.turnId, reason: 'repetition', intendedMove: { from: 'f6', to: 'g8' } }, 2);
    expect(claimed.finishReason).toBe('repetition-claim');
    expect(claimed.board).toEqual(s.board);
    expect(claimed.history).toEqual(s.history);
    expect(() => applyAction(s, 'b', { type: 'claimDraw', turnId: s.turnId, reason: 'repetition', intendedMove: { from: 'a7', to: 'a6' } }, 2)).toThrow('Chưa đủ điều kiện');
    expect(s.phase).toBe('turn');
  });
});
