import { expect, it } from 'vitest';
import { createGame, projectGame } from '@banban/uno';
import { createNoituGame, applyNoituAction, projectNoituGame } from '@banban/noitu';
import { unoPublicGameSchema, noituPublicGameSchema } from './public-game-schemas';

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
