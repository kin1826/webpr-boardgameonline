import { describe, expect, it } from 'vitest';
import { applyCaroAction, CARO_CELL_COUNT, createCaroGame, expireCaroDeadline, pauseCaroGame, projectCaroGame, resumeCaroGame, type CaroState } from './index.ts';

const create = (now = 0) => createCaroGame({ gameId: 'caro-1', players: [{ id: 'a', nickname: 'An' }, { id: 'b', nickname: 'Bình' }], randomInt: () => 0, now });
const place = (state: CaroState, playerId: string, row: number, col: number, now: number) => applyCaroAction(state, playerId, { type: 'place', row, col, turnId: state.turnId }, now);
function fixture(row: number, cols: number[], blockers: Array<[number, number]> = [], symbol: 'X' | 'O' = 'X') {
  const state = create();
  const actor = state.players.find((player) => player.symbol === symbol)!;
  state.currentPlayerId = actor.id;
  for (const col of cols) state.board[row * 15 + col] = symbol;
  for (const [r, c] of blockers) state.board[r * 15 + c] = symbol === 'X' ? 'O' : 'X';
  return state;
}

describe('Caro engine — HQ-CARO-1', () => {
  it('khởi tạo bàn 15×15, 225 ô trống, đúng 2 người; X được chọn qua RNG và đi trước', () => {
    const state = create(100);
    expect(state.board).toHaveLength(CARO_CELL_COUNT);
    expect(state.board.every((cell) => cell === null)).toBe(true);
    expect(state.players.map((player) => player.symbol)).toEqual(['X', 'O']);
    expect(state.currentPlayerId).toBe('a');
    expect(state.turnDeadlineAt).toBe(30_100);
    expect(() => createCaroGame({ gameId: 'bad', players: [{ id: 'a', nickname: 'A' }], randomInt: () => 0, now: 0 })).toThrowError(expect.objectContaining({ code: 'PLAYER_COUNT' }));
    expect(() => createCaroGame({ gameId: 'bad', players: [{ id: 'a', nickname: 'A' }, { id: 'a', nickname: 'A2' }], randomInt: () => 0, now: 0 })).toThrowError(expect.objectContaining({ code: 'DUPLICATE_PLAYER' }));
  });

  it('đặt một quân rồi đổi lượt, không mutate state gốc; sai lượt, turn cũ và ô bận bị chặn', () => {
    const state = create();
    const next = place(state, 'a', 7, 7, 100);
    expect(state.board[112]).toBeNull();
    expect(next.board[112]).toBe('X');
    expect(next.currentPlayerId).toBe('b');
    expect(next.lastMove).toEqual({ row: 7, col: 7, playerId: 'a', symbol: 'X' });
    expect(() => place(next, 'a', 7, 8, 200)).toThrowError(expect.objectContaining({ code: 'NOT_YOUR_TURN' }));
    expect(() => applyCaroAction(next, 'b', { type: 'place', row: 7, col: 8, turnId: state.turnId }, 200)).toThrowError(expect.objectContaining({ code: 'STALE_TURN' }));
    const afterB = place(next, 'b', 7, 8, 200);
    expect(() => place(afterB, 'a', 7, 8, 300)).toThrowError(expect.objectContaining({ code: 'CELL_OCCUPIED' }));
    expect(() => place(afterB, 'a', 15, 0, 300)).toThrowError(expect.objectContaining({ code: 'INVALID_CELL' }));
    expect(() => place(afterB, 'a', 1.5, 0, 300)).toThrowError(expect.objectContaining({ code: 'INVALID_CELL' }));
  });

  it.each([
    ['ngang', 7, [3, 4, 5, 6], [7, 7]],
    ['dọc', 3, [7, 8, 9, 10], [11, 7]],
    ['chéo xuống', 2, [2, 3, 4, 5], [6, 6]],
    ['chéo lên', 8, [2, 3, 4, 5], [6, 6]],
  ] as const)('đúng 5 quân theo trục %s thắng nếu còn đầu trống', (_name, fixed, values, move) => {
    const state = create();
    const actor = state.players[0]!;
    if (_name === 'ngang') values.forEach((col) => { state.board[fixed * 15 + col] = 'X'; });
    else if (_name === 'dọc') values.forEach((row) => { state.board[row * 15 + fixed] = 'X'; });
    else if (_name === 'chéo xuống') values.forEach((offset) => { state.board[offset * 15 + offset] = 'X'; });
    else values.forEach((offset) => { state.board[offset * 15 + (14 - offset)] = 'X'; });
    state.currentPlayerId = actor.id;
    const row = _name === 'ngang' ? move[0] : move[0];
    const col = _name === 'ngang' ? move[1] : _name === 'dọc' ? fixed : _name === 'chéo xuống' ? move[0] : 14 - move[0];
    const won = place(state, actor.id, row, col, 100);
    expect(won.phase).toBe('finished');
    expect(won.winnerId).toBe(actor.id);
    expect(won.finishReason).toBe('five');
    expect(won.winningLines).toHaveLength(1);
    expect(won.winningLines[0]).toHaveLength(5);
  });

  it('đầu bàn hoặc hai đầu bị chặn không thắng; dãy 6/7 không bị cắt thành cửa sổ 5', () => {
    const blockedEdge = fixture(0, [0, 1, 2, 3], [[0, 5]]);
    expect(place(blockedEdge, 'a', 0, 4, 100).phase).toBe('turn');
    const blockedBoth = fixture(7, [3, 4, 5, 6], [[7, 1], [7, 7]]);
    expect(place(blockedBoth, 'a', 7, 2, 100).phase).toBe('turn');
    const six = fixture(7, [2, 3, 4, 5, 6]);
    expect(place(six, 'a', 7, 7, 100).phase).toBe('turn');
    const seven = fixture(7, [1, 2, 3, 4, 5, 6]);
    const after = place(seven, 'a', 7, 7, 100);
    expect(after.phase).toBe('turn');
    expect(after.winningLines).toEqual([]);
  });

  it('trả nhiều dãy thắng cùng một nước và thắng được xét trước hòa bàn', () => {
    const state = create();
    for (const col of [3, 4, 5, 6]) state.board[7 * 15 + col] = 'X';
    for (const row of [3, 4, 5, 6]) state.board[row * 15 + 7] = 'X';
    state.currentPlayerId = 'a';
    const won = place(state, 'a', 7, 7, 100);
    expect(won.winningLines).toHaveLength(2);
    expect(won.finishReason).toBe('five');

    const nearlyFull = create();
    nearlyFull.board.fill('O');
    nearlyFull.board[7 * 15 + 3] = 'X'; nearlyFull.board[7 * 15 + 4] = 'X'; nearlyFull.board[7 * 15 + 5] = 'X'; nearlyFull.board[7 * 15 + 6] = 'X';
    nearlyFull.board[7 * 15 + 2] = null; nearlyFull.board[7 * 15 + 7] = null;
    nearlyFull.currentPlayerId = 'a';
    const last = place(nearlyFull, 'a', 7, 7, 100);
    expect(last.finishReason).toBe('five');
  });

  it('hòa khi kín bàn mà nước cuối không thắng', () => {
    const state = create();
    state.board.fill('O');
    state.board[0] = null;
    state.currentPlayerId = 'a';
    const draw = place(state, 'a', 0, 0, 100);
    expect(draw.phase).toBe('finished');
    expect(draw.winnerId).toBeNull();
    expect(draw.finishReason).toBe('board-full');
  });

  it('đúng biên deadline, timeout thắng race với action; chịu thua trao ván cho đối thủ', () => {
    const state = create();
    expect(expireCaroDeadline(state, 29_999)).toBeNull();
    const timeout = expireCaroDeadline(state, 30_000)!;
    expect(timeout.finishReason).toBe('timeout');
    expect(timeout.winnerId).toBe('b');
    expect(() => place(state, 'a', 7, 7, 30_000)).toThrowError(expect.objectContaining({ code: 'TURN_EXPIRED' }));
    const resigned = applyCaroAction(state, 'a', { type: 'resign' }, 100);
    expect(resigned.finishReason).toBe('resign');
    expect(resigned.winnerId).toBe('b');
    expect(() => applyCaroAction(resigned, 'b', { type: 'resign' }, 200)).toThrowError(expect.objectContaining({ code: 'GAME_FINISHED' }));
  });

  it('pause/resume giữ thời gian còn lại và projection chỉ cấp capability cho người tới lượt', () => {
    const state = create(0);
    const paused = pauseCaroGame(state, 8_000);
    expect(paused.turnDeadlineAt).toBeNull();
    expect(paused.turnRemainingMs).toBe(22_000);
    const resumed = resumeCaroGame(paused, 100_000);
    expect(resumed.turnDeadlineAt).toBe(122_000);
    expect(resumed.turnRemainingMs).toBeNull();
    const yourView = projectCaroGame(resumed, 'a', 100_000, false);
    const otherView = projectCaroGame(resumed, 'b', 100_000, false);
    expect(yourView.canPlace).toBe(true);
    expect(yourView.canResign).toBe(true);
    expect(yourView.yourSymbol).toBe('X');
    expect(yourView.legalCellIndexes).toHaveLength(225);
    expect(otherView.canPlace).toBe(false);
    expect(otherView.legalCellIndexes).toEqual([]);
    expect(JSON.stringify(yourView)).not.toContain('token');
  });
});

describe('Số quân để thắng tùy chọn', () => {
  it.each([4, 5, 6] as const)('đúng %i quân có đầu mở thắng, chặn hai đầu hoặc vượt số không thắng', (winLength) => {
    const make = () => createCaroGame({ gameId: 'custom', players: [{ id: 'a', nickname: 'An' }, { id: 'b', nickname: 'Bình' }], randomInt: () => 0, now: 0, winLength });
    const state = make();
    for (let col = 3; col < 3 + winLength - 1; col++) state.board[7 * 15 + col] = 'X';
    const won = place(state, 'a', 7, 3 + winLength - 1, 100);
    expect(won.winnerId).toBe('a'); expect(won.winningLines[0]).toHaveLength(winLength);
    expect(projectCaroGame(won, 'a', 100, false).winLength).toBe(winLength);
    state.board[7 * 15 + 2] = 'O'; state.board[7 * 15 + 3 + winLength] = 'O';
    expect(place(state, 'a', 7, 3 + winLength - 1, 100).phase).toBe('turn');
    const overline = make();
    for (let col = 3; col < 3 + winLength; col++) overline.board[7 * 15 + col] = 'X';
    expect(place(overline, 'a', 7, 3 + winLength, 100).phase).toBe('turn');
  });
  it('mặc định là 5 và từ chối cấu hình ngoài 4/5/6', () => {
    expect(create().winLength).toBe(5);
    expect(() => createCaroGame({ gameId: 'bad', players: [{ id: 'a', nickname: 'A' }, { id: 'b', nickname: 'B' }], randomInt: () => 0, now: 0, winLength: 7 as 5 })).toThrowError(expect.objectContaining({ code: 'INVALID_WIN_LENGTH' }));
  });
});
