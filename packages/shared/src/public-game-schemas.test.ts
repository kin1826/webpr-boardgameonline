import { expect, it } from 'vitest';
import { createGame, projectGame } from '@banban/uno';
import { createNoituGame, applyNoituAction, projectNoituGame } from '@banban/noitu';
import { advanceBantauResolution, cellsForShip, createBantauGame, fireBantau, lockBantauFleet, projectBantauGame, setBantauAim } from '@banban/bantau';
import { unoPublicGameSchema, noituPublicGameSchema } from './public-game-schemas';
import { bantauPublicGameSchema } from './bantau-public-game-schema';

it('UNO nhận DTO server thật và từ chối thiếu capability, bài sai hoặc dữ liệu kín', () => {
  const state = createGame({ gameId: 'schema-uno', players: [{ id: 'a', nickname: 'An' }, { id: 'b', nickname: 'Bình' }], randomInt: () => 0 });
  const game = projectGame(state, 'a');
  expect(unoPublicGameSchema.safeParse(game).success).toBe(true);
  expect(unoPublicGameSchema.safeParse({ ...game, drawPile: state.drawPile }).success).toBe(false);
  expect(unoPublicGameSchema.safeParse({ ...game, players: [{ ...game.players[0], hand: state.players[0]!.hand }, game.players[1]] }).success).toBe(false);
  expect(unoPublicGameSchema.safeParse({ ...game, hand: [{ ...game.hand[0], value: 99 }] }).success).toBe(false);
  expect(unoPublicGameSchema.safeParse({ ...game, allowedActions: {} }).success).toBe(false);
});

it('Nối từ nhận lượt/vote/kết thúc thật, từ chối dictionary/usedWords và phiếu không hợp lệ', () => {
  const dictionary = { version: 'test-schema', has: (word: string) => word === 'nấu cơm', isDenied: () => false };
  const state = createNoituGame({ gameId: 'schema-noitu', players: [{ id: 'a', nickname: 'An' }, { id: 'b', nickname: 'Bình' }], randomInt: () => 0, dictionary, seedWords: ['nấu cơm'], now: 0 });
  const game = projectNoituGame(state, 'a', 0, false);
  expect(noituPublicGameSchema.safeParse(game).success).toBe(true);
  const voting = applyNoituAction(state, state.currentPlayerId!, { type: 'submit', suffix: 'lạ', turnId: state.turnId }, dictionary, 100);
  const voteGame = projectNoituGame(voting, 'b', 100, false);
  expect(noituPublicGameSchema.safeParse(voteGame).success).toBe(true);
  expect(noituPublicGameSchema.safeParse({ ...voteGame, proposal: { ...voteGame.proposal, votes: { a: 'maybe' } } }).success).toBe(false);
  expect(noituPublicGameSchema.safeParse({ ...game, usedWords: [] }).success).toBe(false);
  expect(noituPublicGameSchema.safeParse({ ...game, dictionary: [] }).success).toBe(false);
  const finished = applyNoituAction(state, state.currentPlayerId!, { type: 'giveUp', turnId: state.turnId }, dictionary, 100);
  expect(noituPublicGameSchema.safeParse(projectNoituGame(finished, 'a', 100, false)).success).toBe(true);
});

it('Bắn tàu chỉ công bố vị trí thân tàu sau khi chìm và schema từ chối cell bị lộ sớm', () => {
  let state = createBantauGame({
    gameId: 'schema-bantau', players: [{ id: 'a', nickname: 'An' }, { id: 'b', nickname: 'Bình' }],
    options: { boardSize: 8, shipCount: 3, turnDurationMs: 30_000, hitContinues: true, allowTouch: true },
    firstPlayerId: 'a', randomInt: () => 0, now: 0,
  });
  expect(bantauPublicGameSchema.safeParse(projectBantauGame(state, 'a', 0, false)).success).toBe(true);
  state = lockBantauFleet(state, 'a', 0, 1);
  state = lockBantauFleet(state, 'b', 0, 2);
  const targetShip = state.players[1].fleet.find((ship) => ship.length === 2)!;
  for (const [index, cell] of cellsForShip(targetShip).entries()) {
    const now = state.turnDeadlineAt! - 5;
    state = setBantauAim(state, 'a', state.turnId, index + 1, cell, now).state;
    state = fireBantau(state, 'a', state.turnId, index + 1, cell, () => 0, now + 1).state;
    if (state.phase === 'resolving') state = advanceBantauResolution(state, state.resolveDeadlineAt!)!;
  }
  const projection = projectBantauGame(state, 'a', state.turnDeadlineAt ?? 0, false);
  expect(bantauPublicGameSchema.safeParse(projection).success).toBe(true);
  expect(JSON.stringify(projection.revealedSunkShips)).not.toContain(targetShip.id);
  const hiddenCell = projection.revealedSunkShips[0]!.cells[0]!;
  const targetBoard = [...projection.targetBoard];
  targetBoard[hiddenCell.row * projection.boardSize + hiddenCell.col] = 'hit';
  expect(bantauPublicGameSchema.safeParse({ ...projection, targetBoard }).success).toBe(false);
});
