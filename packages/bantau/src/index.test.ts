import { describe, expect, it } from 'vitest';
import {
  BANTAU_BOARD_SIZES, BANTAU_SHIP_COUNTS, advanceBantauResolution, applyBantauPlacement,
  cellsForShip, createBantauGame, expireBantauSetup, expireBantauTurn, fireBantau,
  generateBantauFleet, lockBantauFleet, pauseBantauGame, projectBantauGame,
  resumeBantauGame, setBantauAim, validateBantauFleet,
} from './index';

function rng(seed = 1) {
  let value = seed >>> 0;
  return (max: number) => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return Math.floor(value / 0x1_0000_0000 * max);
  };
}
const options = (extra: Partial<Parameters<typeof createBantauGame>[0]['options']> = {}) => ({ boardSize: 8 as const, shipCount: 3 as const, turnDurationMs: 15_000, hitContinues: true, allowTouch: false, ...extra });
function game(overrides: Partial<Parameters<typeof createBantauGame>[0]> = {}) {
  return createBantauGame({ gameId: 'g1', players: [{ id: 'a', nickname: 'An' }, { id: 'b', nickname: 'Bình' }], options: options(), firstPlayerId: 'a', randomInt: rng(17), now: 0, ...overrides });
}
function start(before = game(), now = 1) {
  let state = lockBantauFleet(before, 'a', before.players[0].fleetRevision, now);
  state = lockBantauFleet(state, 'b', state.players[1].fleetRevision, now);
  return state;
}
function firstWaterCell(state: ReturnType<typeof game>, owner: string) {
  const occupied = new Set(state.players.find((p) => p.id === owner)!.fleet.flatMap(cellsForShip).map((cell) => `${cell.row}:${cell.col}`));
  for (let row = 0; row < state.boardSize; row++) for (let col = 0; col < state.boardSize; col++) if (!occupied.has(`${row}:${col}`)) return { row, col };
  throw new Error('No water cell');
}

describe('Bắn tàu — đội hình', () => {
  it('sinh đủ chín tổ hợp bàn/số tàu, có đúng preset và không chạm khi cấm', () => {
    for (const boardSize of BANTAU_BOARD_SIZES) for (const shipCount of BANTAU_SHIP_COUNTS) {
      const fleet = generateBantauFleet({ boardSize, shipCount, allowTouch: false, randomInt: rng(boardSize * 10 + shipCount) });
      const expected = shipCount === 3 ? [3, 3, 2] : shipCount === 4 ? [4, 3, 3, 2] : [5, 4, 3, 3, 2];
      expect(fleet.map((ship) => ship.length).sort((a, b) => b - a)).toEqual(expected);
      expect(validateBantauFleet(boardSize, expected, fleet, false).valid).toBe(true);
      expect(new Set(fleet.flatMap(cellsForShip).map((cell) => `${cell.row}:${cell.col}`)).size).toBe(expected.reduce((sum, n) => sum + n, 0));
    }
  });

  it('từ chối chồng, ra biên và kề chéo khi chế độ chạm tắt', () => {
    const lengths = [3, 3, 2];
    const base = [
      { id: 'ship-1', length: 3, anchor: { row: 0, col: 0 }, orientation: 'horizontal' as const },
      { id: 'ship-2', length: 3, anchor: { row: 3, col: 0 }, orientation: 'horizontal' as const },
      { id: 'ship-3', length: 2, anchor: { row: 6, col: 0 }, orientation: 'horizontal' as const },
    ];
    expect(validateBantauFleet(8, lengths, base, false).valid).toBe(true);
    expect(validateBantauFleet(8, lengths, [{ ...base[0]!, anchor: { row: 0, col: 6 } }, ...base.slice(1)], false).code).toBe('OUT_OF_BOUNDS');
    expect(validateBantauFleet(8, lengths, [{ ...base[0]!, anchor: { row: 3, col: 0 } }, ...base.slice(1)], false).code).toBe('SHIP_OVERLAP');
    expect(validateBantauFleet(8, lengths, [{ ...base[0]!, anchor: { row: 2, col: 0 } }, ...base.slice(1)], false).code).toBe('SHIPS_TOUCHING');
    expect(validateBantauFleet(8, lengths, [{ ...base[0]!, anchor: { row: 2, col: 0 } }, ...base.slice(1)], true).valid).toBe(true);
  });

  it('sửa tàu theo revision cá nhân, lỗi không đổi đội hình và khóa ngăn chỉnh tiếp', () => {
    const before = game();
    const ship = before.players[0].fleet[0]!;
    expect(() => applyBantauPlacement(before, 'a', 0, { type: 'moveShip', shipId: ship.id, anchor: { row: 99, col: 0 } }, rng(), 1)).toThrow(/nằm trọn/u);
    expect(before.players[0].fleet[0]!.anchor).toEqual(ship.anchor);
    const validMove = Array.from({ length: before.boardSize }, (_, row) => Array.from({ length: before.boardSize }, (_, col) => ({ row, col })))
      .flat().find((anchor) => {
        const fleet = before.players[0].fleet.map((item) => item.id === ship.id ? { ...item, anchor } : item);
        return validateBantauFleet(before.boardSize, before.fleetLengths, fleet, before.allowTouch).valid;
      });
    expect(validMove).toBeDefined();
    const moved = applyBantauPlacement(before, 'a', 0, { type: 'moveShip', shipId: ship.id, anchor: validMove! }, rng(4), 1);
    expect(moved.players[0].fleetRevision).toBe(1);
    expect(() => applyBantauPlacement(moved, 'a', 0, { type: 'rotateShip', shipId: ship.id }, rng(), 2)).toThrow(/Đội hình vừa đổi/u);
    const locked = lockBantauFleet(moved, 'a', 1, 3);
    expect(() => applyBantauPlacement(locked, 'a', 1, { type: 'replaceFleetRandom' }, rng(), 4)).toThrow(/đã khóa/u);
  });

  it('hết setup tự khóa hai đội hình và chỉ mở một lượt', () => {
    const before = game();
    const next = expireBantauSetup(before, before.setupDeadlineAt!);
    expect(next?.phase).toBe('turn');
    expect(next?.players.every((player) => player.placementLocked)).toBe(true);
    expect(next?.currentPlayerId).toBe('a');
    expect(expireBantauSetup(next!, before.setupDeadlineAt! + 1)).toBeNull();
  });
});

describe('Bắn tàu — lượt, bắn và projection', () => {
  it('chỉ nhận aim hiện tại đã ACK; aim cũ, sai ô và sai lượt bị chặn', () => {
    const state = start();
    const target = state.players[1].fleet[0]!.anchor;
    const aimA = setBantauAim(state, 'a', state.turnId, 1, target, 2);
    const aimB = setBantauAim(aimA.state, 'a', state.turnId, 2, { row: 0, col: 0 }, 3);
    expect(aimB.aim?.sequence).toBe(2);
    expect(() => fireBantau(aimB.state, 'a', state.turnId, 1, target, rng(), 4)).toThrow(/chưa được máy chủ xác nhận/u);
    expect(() => setBantauAim(aimB.state, 'b', state.turnId, 1, target, 4)).toThrow(/Chưa tới lượt/u);
  });

  it('timeout dùng aim đã xác nhận; miss không lưu dấu và ô miss vẫn có thể bắn lại', () => {
    const started = start(game({ options: options({ hitContinues: false }) }));
    const miss = firstWaterCell(started, 'b');
    const aimed = setBantauAim(started, 'a', started.turnId, 1, miss, 2).state;
    const timeout = expireBantauTurn(aimed, rng(), started.turnDeadlineAt!);
    expect(timeout?.effect).toMatchObject({ source: 'timeout', result: 'miss', row: miss.row, col: miss.col });
    expect(timeout?.state.players[1].hitCells).toEqual([]);
    expect(projectBantauGame(timeout!.state, 'a', started.turnDeadlineAt! + 900, false).targetBoard[miss.row * 8 + miss.col]).toBe('unknown');
    const afterTimeout = advanceBantauResolution(timeout!.state, timeout!.state.resolveDeadlineAt!)!;
    const bMiss = firstWaterCell(afterTimeout, 'a');
    const bAim = setBantauAim(afterTimeout, 'b', afterTimeout.turnId, 1, bMiss, afterTimeout.turnDeadlineAt! - 10).state;
    const bShot = fireBantau(bAim, 'b', bAim.turnId, 1, bMiss, rng(), afterTimeout.turnDeadlineAt! - 9);
    const aNext = advanceBantauResolution(bShot.state, bShot.state.resolveDeadlineAt!);
    const aAimAgain = setBantauAim(aNext!, 'a', aNext!.turnId, 2, miss, aNext!.turnDeadlineAt! - 1).state;
    const repeat = fireBantau(aAimAgain, 'a', aAimAgain.turnId, 2, miss, rng(), aAimAgain.turnDeadlineAt! - 1);
    expect(repeat.effect.result).toBe('miss');
    expect(repeat.state.players[1].hitCells).toEqual([]);
  });

  it('hit giữ lượt tùy cấu hình, sunk reveal đúng tàu, chìm hạm đội chốt thắng ngay', () => {
    let state = start(game({ options: options({ shipCount: 3, hitContinues: true, allowTouch: true }) }));
    const target = state.players[1];
    const ship = target.fleet.find((candidate) => candidate.length === 2)!;
    const cells = cellsForShip(ship);
    for (let index = 0; index < cells.length; index++) {
      const aim = setBantauAim(state, 'a', state.turnId, index + 1, cells[index]!, state.turnDeadlineAt! - 10).state;
      const shot = fireBantau(aim, 'a', aim.turnId, index + 1, cells[index]!, rng(), aim.turnDeadlineAt! - 9);
      expect(shot.effect.result).toBe(index === cells.length - 1 ? 'sunk' : 'hit');
      if (index === cells.length - 1) {
        expect(shot.effect.sunkCells).toEqual(cells);
        expect(shot.state.phase).toBe('resolving');
        const view = projectBantauGame(shot.state, 'a', shot.state.resolveDeadlineAt! - 1, false);
        expect(view.targetBoard.filter((cell) => cell === 'sunk')).toHaveLength(cells.length);
        expect(view.revealedSunkShips).toHaveLength(1);
        expect(view.revealedSunkShips[0]).toMatchObject({ length: cells.length, cells });
        expect(JSON.stringify(view.revealedSunkShips)).not.toContain(shot.state.players[1].fleet[0]!.id);
      }
      state = advanceBantauResolution(shot.state, shot.state.resolveDeadlineAt!)!;
      expect(state.currentPlayerId).toBe('a');
    }
  });

  it('pause/resume giữ nguyên thời gian setup/lượt/resolving', () => {
    const setup = game();
    const pausedSetup = pauseBantauGame(setup, 10_000);
    expect(pausedSetup.setupDeadlineAt).toBeNull();
    expect(pausedSetup.setupRemainingMs).toBe(setup.setupDeadlineAt! - 10_000);
    expect(resumeBantauGame(pausedSetup, 100_000).setupDeadlineAt).toBe(100_000 + setup.setupDeadlineAt! - 10_000);
    const turn = start(game());
    const pausedTurn = pauseBantauGame(turn, 2_000);
    expect(resumeBantauGame(pausedTurn, 50_000).turnDeadlineAt).toBe(50_000 + turn.turnDeadlineAt! - 2_000);
  });

  it('snapshot hai phía chỉ có đội hình của người xem, không có miss hay tàu đối thủ', () => {
    const state = start();
    const aView = projectBantauGame(state, 'a', 10, false);
    const bView = projectBantauGame(state, 'b', 10, false);
    expect(aView.ownFleet.ships).toEqual(state.players[0].fleet.map((ship) => ({ ...ship, cells: cellsForShip(ship) })));
    expect(aView).not.toHaveProperty('opponentFleet');
    expect(JSON.stringify(aView)).not.toContain(state.players[1].fleet[0]!.id);
    expect(aView.ownFleet.ships.every((ship) => ship.id.startsWith('a:'))).toBe(true);
    expect(aView.targetBoard.every((cell) => cell === 'unknown')).toBe(true);
    expect(aView.revealedSunkShips).toEqual([]);
    const changedOpponent = structuredClone(state);
    changedOpponent.players[1].fleet = generateBantauFleet({ boardSize: 8, shipCount: 3, allowTouch: true, randomInt: rng(909) });
    expect(projectBantauGame(changedOpponent, 'a', 10, false)).toEqual(aView);
    expect(JSON.stringify(bView)).not.toContain(state.players[0].fleet[0]!.id);
  });
});
