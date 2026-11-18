import { describe, expect, it } from 'vitest';
import { applyCotuongAction, createCotuongGame, expireCotuongDeadline, legalCotuongMoves, pauseCotuongGame, projectCotuongGame, resumeCotuongGame, type CotuongPiece, type CotuongState } from './index';

const fixture = (options: { clock?: { initialMs: number; incrementMs: number } | null; redPlayerId?: string } = {}) => createCotuongGame({ gameId: 'game-a', players: [{ id: 'red-player', nickname: 'Đỏ' }, { id: 'black-player', nickname: 'Đen' }], randomInt: () => 0, now: 1_000, ...options });
const play = (state: CotuongState, actor: string, from: [number, number], to: [number, number], now = 1_001) => applyCotuongAction(state, actor, { type: 'move', turnId: state.turnId, from: { row: from[0], col: from[1] }, to: { row: to[0], col: to[1] } }, now);
const clearBoard = (state: CotuongState, pieces: Array<[number, number, CotuongPiece]>, currentSide: 'red' | 'black' = 'red') => {
  state.board = Array.from({ length: 90 }, () => null);
  for (const [row, col, piece] of pieces) state.board[row * 9 + col] = piece;
  state.currentSide = currentSide; state.turnId = `${state.gameId}:turn:${state.historyCount}`; state.phase = 'turn'; state.winnerSide = null; state.finishReason = null; state.checkedSide = null; state.drawOffer = null;
  state.positionHistory = [{ key: `${currentSide}:test-${state.historyCount}`, ply: state.historyCount, side: currentSide }];
  return state;
};
const piece = (id: string, side: 'red' | 'black', role: CotuongPiece['role']): CotuongPiece => ({ id, side, role });

describe('HQ-COTUONG-1 engine', () => {
  it('creates a 9×10 board with 32 stable pieces and Red to move', () => {
    const game = fixture();
    expect(game.board).toHaveLength(90);
    expect(game.board.filter(Boolean)).toHaveLength(32);
    expect(game.currentSide).toBe('red');
    expect(game.players.map((player) => player.side)).toEqual(['red', 'black']);
    expect(game.board[4]?.role).toBe('general');
    expect(game.board[85]?.role).toBe('general');
  });

  it('moves the horse only when its leg is clear and forbids own capture', () => {
    const game = clearBoard(fixture(), [[9, 4, piece('rg', 'red', 'general')], [0, 4, piece('bg', 'black', 'general')], [9, 1, piece('rh', 'red', 'horse')], [8, 1, piece('block', 'red', 'soldier')]]);
    const redHorseMoves = legalCotuongMoves(game).filter((move) => move.from.row === 9 && move.from.col === 1);
    expect(redHorseMoves).toEqual([]); // the soldier on the horse leg blocks both outward moves
    expect(() => play(game, 'red-player', [9, 1], [7, 2])).toThrow(/không đúng luật/);
    expect(() => play(game, 'red-player', [8, 1], [9, 1])).toThrow(/quân cùng phe/);
  });

  it('moves a horse when its leg is open and observes elephant eye and river', () => {
    const game = clearBoard(fixture(), [[9, 4, piece('rg', 'red', 'general')], [0, 3, piece('bg', 'black', 'general')], [7, 4, piece('rh', 'red', 'horse')], [7, 5, piece('re', 'red', 'elephant')], [6, 6, piece('block', 'red', 'soldier')]]);
    expect(legalCotuongMoves(game).some((move) => move.from.row === 7 && move.from.col === 4 && move.to.row === 5 && move.to.col === 5)).toBe(true);
    expect(legalCotuongMoves(game).some((move) => move.from.row === 7 && move.from.col === 5 && move.to.row === 5 && move.to.col === 7)).toBe(false); // elephant eye occupied
    expect(legalCotuongMoves(game).some((move) => move.from.row === 7 && move.from.col === 5 && move.to.row === 5 && move.to.col === 3)).toBe(true);
    expect(legalCotuongMoves(game).some((move) => move.from.row === 7 && move.from.col === 5 && move.to.row === 4 && move.to.col === 4)).toBe(false); // elephant cannot cross the river
  });

  it('uses exactly one cannon screen for capture and blocks a general-facing move', () => {
    const game = clearBoard(fixture({ clock: null }), [[9, 4, piece('rg', 'red', 'general')], [0, 3, piece('bg', 'black', 'general')], [7, 0, piece('rc', 'red', 'cannon')], [7, 2, piece('screen', 'black', 'soldier')], [7, 5, piece('target', 'black', 'soldier')]]);
    const cannonMoves = legalCotuongMoves(game).filter((move) => move.from.row === 7 && move.from.col === 0);
    expect(cannonMoves.some((move) => move.to.row === 7 && move.to.col === 5)).toBe(true);
    expect(cannonMoves.some((move) => move.to.row === 7 && move.to.col === 6)).toBe(false);
    const facing = clearBoard(fixture({ clock: null }), [[9, 4, piece('rg', 'red', 'general')], [0, 4, piece('bg', 'black', 'general')], [6, 3, piece('rs', 'red', 'soldier')]]);
    expect(legalCotuongMoves(facing).some((move) => move.from.row === 6 && move.from.col === 3 && move.to.row === 6 && move.to.col === 4)).toBe(false);
  });

  it('alternates turns, applies Fischer increment, exposes last move, and does not leak private repetition state', () => {
    const start = fixture({ clock: { initialMs: 60_000, incrementMs: 3_000 } });
    const next = play(start, 'red-player', [6, 0], [5, 0], 5_000);
    expect(next.currentSide).toBe('black');
    expect(next.clock?.remainingMs.red).toBe(63_000);
    expect(next.lastMove?.notation).toContain('soldier');
    const view = projectCotuongGame(next, 'red-player', 5_000, false) as unknown as Record<string, unknown>;
    expect(view.clock).toMatchObject({ initialMs: 60_000, incrementMs: 3_000 });
    expect(view.legalMoves).toEqual([]);
    expect(view).not.toHaveProperty('positionHistory');
    expect(view).not.toHaveProperty('lastOfferPly');
    expect(view.repetitionCount).toBe(1);
    expect(view.repetitionWarning).toBe(false);
  });

  it('rejects wrong turn, stale turn and self-check', () => {
    const game = fixture({ clock: null });
    expect(() => play(game, 'black-player', [3, 0], [4, 0])).toThrow(/Chưa tới lượt/);
    expect(() => applyCotuongAction(game, 'red-player', { type: 'move', turnId: 'old', from: { row: 6, col: 0 }, to: { row: 5, col: 0 } }, 1_001)).toThrow(/Lượt đã thay đổi/);
    const pin = clearBoard(fixture({ clock: null }), [[9, 4, piece('rg', 'red', 'general')], [0, 3, piece('bg', 'black', 'general')], [0, 4, piece('bc', 'black', 'chariot')], [8, 4, piece('rs', 'red', 'soldier')]]);
    expect(() => play(pin, 'red-player', [8, 4], [8, 3])).toThrow(/Tướng của bạn bị chiếu/);
  });

  it('ends when the side to move is checkmated or stalemated rather than capturing a General', () => {
    const game = clearBoard(fixture({ clock: null }), [[9, 4, piece('rg', 'red', 'general')], [0, 4, piece('bg', 'black', 'general')], [6, 3, piece('rs', 'red', 'soldier')], [1, 3, piece('bc', 'black', 'chariot')], [2, 4, piece('bs', 'black', 'soldier')]], 'red');
    const result = play(game, 'red-player', [6, 3], [5, 3]);
    expect(result.board.find((item) => item?.role === 'general' && item.side === 'black')).toBeTruthy();
    expect(result.finishReason === 'checkmate' || result.finishReason === 'stalemate' || result.phase === 'turn').toBe(true);
  });

  it('handles draw offers, rejection cooldown, acceptance and resignation', () => {
    const game = fixture({ clock: null });
    const offer = applyCotuongAction(game, 'red-player', { type: 'offerDraw', turnId: game.turnId }, 1_001);
    expect(offer.drawOffer?.offeredBy).toBe('red');
    const declined = applyCotuongAction(offer, 'black-player', { type: 'respondDraw', offerId: offer.drawOffer!.id, accept: false }, 1_002);
    expect(declined.phase).toBe('turn');
    expect(() => applyCotuongAction(declined, 'red-player', { type: 'offerDraw', turnId: declined.turnId }, 1_003)).toThrow(/10 nước/);
    const offeredAgain = { ...game, revision: 1, lastOfferPly: { red: 0, black: -10 }, drawOffer: { id: 'offer-2', offeredBy: 'red' as const, ply: 0 } };
    expect(applyCotuongAction(offeredAgain, 'black-player', { type: 'respondDraw', offerId: 'offer-2', accept: true }, 1_002).finishReason).toBe('draw-agreement');
    expect(applyCotuongAction(game, 'black-player', { type: 'resign' }, 1_001).winnerSide).toBe('red');
  });

  it('resolves timeout at equality and preserves the clock through reconnect pause/resume', () => {
    const game = fixture({ clock: { initialMs: 60_000, incrementMs: 0 } });
    expect(expireCotuongDeadline(game, 60_999)).toBeNull();
    expect(expireCotuongDeadline(game, 61_000)?.finishReason).toBe('timeout');
    const paused = pauseCotuongGame(game, 21_000);
    expect(paused.clock?.deadlineAt).toBeNull(); expect(paused.clock?.pausedRemainingMs).toBe(40_000);
    const resumed = resumeCotuongGame(paused, 50_000);
    expect(resumed.clock?.deadlineAt).toBe(90_000);
  });

  it('does not allow invalid player count or corrupted board coordinate actions', () => {
    expect(() => createCotuongGame({ gameId: 'x', players: [{ id: 'a', nickname: 'A' }], randomInt: () => 0, now: 0 })).toThrow(/đúng hai/);
    const game = fixture({ clock: null });
    expect(() => applyCotuongAction(game, 'red-player', { type: 'move', turnId: game.turnId, from: { row: -1, col: 0 }, to: { row: 0, col: 0 } }, 1)).toThrow(/Vị trí/);
  });

  it('warns at the third position occurrence and adjudicates the fourth repetition', () => {
    let game = fixture({ clock: null });
    const cycle: Array<[string, [number, number], [number, number]]> = [
      ['red-player', [9, 1], [7, 2]], ['black-player', [0, 1], [2, 2]],
      ['red-player', [7, 2], [9, 1]], ['black-player', [2, 2], [0, 1]],
    ];
    for (let repetition = 0; repetition < 2; repetition++) for (const [playerId, from, to] of cycle) game = play(game, playerId, from, to);
    const third = projectCotuongGame(game, 'red-player', 2_000, false);
    expect(third.repetitionCount).toBe(3);
    expect(third.repetitionWarning).toBe(true);
    expect(game.phase).toBe('turn');
    for (const [playerId, from, to] of cycle) game = play(game, playerId, from, to);
    expect(game.phase).toBe('finished');
    expect(game.finishReason).toBe('repetition');
  });

  it('compares full piece roles in position keys so chariots and cannons cannot collide', () => {
    const make = (roleAtA: 'chariot' | 'cannon') => {
      const otherRole = roleAtA === 'chariot' ? 'cannon' : 'chariot';
      return clearBoard(fixture({ clock: null }), [
        [9, 4, piece('rg', 'red', 'general')], [0, 3, piece('bg', 'black', 'general')],
        [5, 0, piece(`ra-${roleAtA}`, 'red', roleAtA)], [4, 1, piece(`rb-${otherRole}`, 'red', otherRole)],
      ]);
    };
    const chariotMoved = play(make('chariot'), 'red-player', [5, 0], [5, 1]);
    const cannonMoved = play(make('cannon'), 'red-player', [5, 0], [5, 1]);
    expect(chariotMoved.positionHistory.at(-1)?.key).not.toBe(cannonMoved.positionHistory.at(-1)?.key);
  });

  it('warns at 100 quiet plies, draws at 120, and resets the counter on capture', () => {
    const warning = fixture({ clock: null });
    warning.noCapturePlies = 99;
    const at100 = play(warning, 'red-player', [6, 0], [5, 0]);
    expect(at100.noCapturePlies).toBe(100);
    expect(at100.notice).toContain('100 nước');

    const limit = fixture({ clock: null });
    limit.noCapturePlies = 119;
    const at120 = play(limit, 'red-player', [6, 0], [5, 0]);
    expect(at120.noCapturePlies).toBe(120);
    expect(at120.finishReason).toBe('no-capture-limit');

    const capture = clearBoard(fixture({ clock: null }), [
      [9, 4, piece('rg', 'red', 'general')], [0, 3, piece('bg', 'black', 'general')],
      [5, 0, piece('rc', 'red', 'chariot')], [5, 1, piece('bs', 'black', 'soldier')],
    ]);
    capture.noCapturePlies = 119;
    expect(play(capture, 'red-player', [5, 0], [5, 1]).noCapturePlies).toBe(0);
  });
});
