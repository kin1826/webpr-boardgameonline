import { z } from 'zod';
import type { UnoPublicGame } from '@banban/uno';
import type { NoituPublicGame } from '@banban/noitu';

const id = z.string().min(1).max(160);
const count = z.number().int().nonnegative();
const milliseconds = z.number().finite().nonnegative().nullable();
const color = z.enum(['red', 'yellow', 'green', 'blue']);
const card = z.object({ id, color: z.enum(['red', 'yellow', 'green', 'blue', 'wild']), type: z.enum(['number', 'drawTwo', 'reverse', 'skip', 'wild', 'wildDrawFour']), value: z.number().int().min(0).max(9).optional() }).strict();
const unoWindow = z.object({ playerId: id, nextPlayerId: id }).strict().nullable();

// Only the requesting player's hand is part of this DTO. Unknown fields fail closed.
export const unoPublicGameSchema = z.object({
  gameId: id, revision: count, phase: z.enum(['chooseColor', 'turn', 'drawn', 'penalty', 'finished']),
  players: z.array(z.object({ id, nickname: z.string().min(1).max(24), cardCount: count, status: z.enum(['active', 'eliminated']), eliminatedReason: z.literal('timeout').nullable() }).strict()).min(2).max(6),
  hand: z.array(card).max(108), topCard: card.nullable(), drawCount: count,
  currentColor: color.nullable(), direction: z.union([z.literal(1), z.literal(-1)]), currentPlayerId: id,
  dealerId: id, drawnCardId: id.nullable(),
  pendingPenalty: z.object({ total: z.number().int().positive(), lastType: z.enum(['drawTwo', 'wildDrawFour']), targetId: id, pendingWinnerId: id.nullable() }).strict().nullable(),
  allowedActions: z.object({ playableCardIds: z.array(id).max(108), canDraw: z.boolean(), canKeep: z.boolean(), canAcceptPenalty: z.boolean(), canChooseColor: z.boolean(), canDeclareUno: z.boolean(), catchUnoPlayerId: id.nullable() }).strict(),
  unoWindow, winnerId: id.nullable(), finishReason: z.enum(['winner', 'lastActive', 'stalemate']).nullable(),
  turnId: id, deadlineAt: milliseconds, remainingMs: milliseconds, turnDurationMs: z.number().int().positive(), serverNow: z.number().finite(),
}).strict() satisfies z.ZodType<UnoPublicGame>;

export const noituPublicGameSchema = z.object({
  gameId: id, revision: count, phase: z.enum(['turn', 'voting', 'finished']),
  players: z.array(z.object({ id, nickname: z.string().min(1).max(24), status: z.enum(['active', 'eliminated']) }).strict()).min(2).max(6),
  order: z.array(id).min(2).max(6), currentPlayerId: id.nullable(), turnId: id,
  seedWord: z.string().min(1), currentWord: z.string().min(1), requiredSyllable: z.string().min(1),
  deadlineAt: milliseconds, remainingMs: milliseconds, serverNow: z.number().finite(), turnDurationMs: z.number().int().positive(), proposalsThisTurn: count,
  proposal: z.object({ id, word: z.string().min(1), proposerId: id, eligibleVoterIds: z.array(id).max(5), votes: z.record(id, z.enum(['accept', 'reject'])), acceptCount: count, rejectCount: count, deadlineAt: milliseconds, remainingMs: milliseconds, canVote: z.boolean() }).strict().nullable(),
  history: z.array(z.object({ word: z.string().min(1), playerId: id.nullable(), nickname: z.string(), kind: z.enum(['seed', 'accepted']), acceptedByGroup: z.boolean() }).strict()).max(100),
  historyCount: count, usedCount: count, winnerId: id.nullable(), notice: z.string().nullable(), dictionaryVersion: z.string().min(1), canSubmit: z.boolean(), canGiveUp: z.boolean(),
}).strict() satisfies z.ZodType<NoituPublicGame>;
