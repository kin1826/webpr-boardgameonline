import { z } from 'zod';

const pointSchema = z.object({ row: z.number().int().min(0).max(9), col: z.number().int().min(0).max(8) }).strict();
const sideSchema = z.enum(['red', 'black']);
const roleSchema = z.enum(['general', 'advisor', 'elephant', 'chariot', 'horse', 'cannon', 'soldier']);
const moveSchema = z.object({ from: pointSchema, to: pointSchema }).strict();
const pieceSchema = z.object({ id: z.string().min(1).max(80), side: sideSchema, role: roleSchema }).strict();
const historyEntrySchema = moveSchema.extend({ ply: z.number().int().positive(), side: sideSchema, piece: roleSchema, captured: roleSchema.nullable(), gaveCheck: z.boolean(), notation: z.string().max(80) }).strict();

export const cotuongPublicGameSchema = z.object({
  rulesVersion: z.literal('HQ-COTUONG-1'), gameId: z.string().min(1).max(80), revision: z.number().int().nonnegative(),
  board: z.array(pieceSchema.nullable()).length(90),
  players: z.array(z.object({ id: z.string().min(1).max(80), nickname: z.string().min(1).max(24), side: sideSchema }).strict()).length(2),
  currentSide: sideSchema.nullable(), turnId: z.string().min(1).max(160), phase: z.enum(['turn', 'finished']), lastMove: historyEntrySchema.nullable(), checkedSide: sideSchema.nullable(),
  checkHistory: z.array(z.object({ ply: z.number().int().positive(), side: sideSchema }).strict()).max(100),
  history: z.array(historyEntrySchema).max(100), historyCount: z.number().int().nonnegative(), noCapturePlies: z.number().int().nonnegative(),
  repetitionCount: z.number().int().nonnegative(), repetitionWarning: z.boolean(),
  drawOffer: z.object({ id: z.string().min(1).max(160), offeredBy: sideSchema, ply: z.number().int().nonnegative() }).strict().nullable(),
  clock: z.object({ initialMs: z.number().int().positive(), remainingMs: z.object({ red: z.number().int().nonnegative(), black: z.number().int().nonnegative() }).strict(), deadlineAt: z.number().finite().nullable(), serverNow: z.number().finite(), pausedRemainingMs: z.number().int().nonnegative().nullable(), incrementMs: z.number().int().nonnegative() }).strict().nullable(),
  winnerSide: sideSchema.nullable(), finishReason: z.enum(['checkmate', 'stalemate', 'perpetual-check', 'repetition', 'no-attacking-material', 'no-capture-limit', 'timeout', 'resign', 'draw-agreement']).nullable(),
  notice: z.string().max(240).nullable(), viewerSide: sideSchema.nullable(), legalMoves: z.array(moveSchema).max(900),
  capabilities: z.object({ canMove: z.boolean(), canOfferDraw: z.boolean(), canRespondDraw: z.boolean(), canResign: z.boolean() }).strict(),
}).strict().superRefine((game, context) => {
  const ids = game.board.flatMap((piece) => piece ? [piece.id] : []);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['board'], message: 'Mã quân trên bàn bị trùng.' });
  for (const side of ['red', 'black'] as const) if (game.board.filter((piece) => piece?.side === side && piece.role === 'general').length !== 1) context.addIssue({ code: 'custom', path: ['board'], message: `Bàn phải có đúng một Tướng ${side}.` });
});

const envelope = { actionId: z.string().uuid(), roomId: z.string().min(8).max(80), expectedRevision: z.number().int().nonnegative(), gameId: z.string().min(1).max(80) };
export const cotuongActionSchema = z.discriminatedUnion('type', [
  z.object({ ...envelope, type: z.literal('move'), turnId: z.string().min(1).max(160), from: pointSchema, to: pointSchema }).strict(),
  z.object({ ...envelope, type: z.literal('offerDraw'), turnId: z.string().min(1).max(160) }).strict(),
  z.object({ ...envelope, type: z.literal('respondDraw'), offerId: z.string().min(1).max(160), accept: z.boolean() }).strict(),
  z.object({ ...envelope, type: z.literal('resign') }).strict(),
]);
export type CotuongActionPayload = z.infer<typeof cotuongActionSchema>;

export const cotuongClockMinutesSchema = z.union([z.literal(5), z.literal(10), z.literal(15)]);
export const cotuongIncrementSecondsSchema = z.union([z.literal(0), z.literal(3), z.literal(5)]);
export const cotuongSideChoiceSchema = z.enum(['random', 'host-red']);
export const cotuongSettingsSchema = z.object({ gameKey: z.literal('cotuong'), targetScore: z.number().int().min(10).max(500).multipleOf(10), baseMinutes: cotuongClockMinutesSchema, incrementSeconds: cotuongIncrementSecondsSchema, redSide: cotuongSideChoiceSchema }).strict();

const localEnvelope = { actionId: z.string().uuid(), localSessionId: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/), expectedRevision: z.number().int().nonnegative(), gameId: z.string().min(1).max(80) };
export const cotuongLocalActionSchema = z.discriminatedUnion('type', [
  z.object({ ...localEnvelope, type: z.literal('move'), turnId: z.string().min(1).max(160), from: pointSchema, to: pointSchema }).strict(),
  z.object({ ...localEnvelope, type: z.literal('offerDraw'), turnId: z.string().min(1).max(160), actingSide: sideSchema }).strict(),
  z.object({ ...localEnvelope, type: z.literal('respondDraw'), offerId: z.string().min(1).max(160), accept: z.boolean(), actingSide: sideSchema }).strict(),
  z.object({ ...localEnvelope, type: z.literal('resign'), actingSide: sideSchema }).strict(),
]);
export const cotuongLocalCreateSchema = z.object({ actionId: z.string().uuid(), redNickname: z.string().trim().min(1).max(24), blackNickname: z.string().trim().min(1).max(24), redAvatarId: z.number().int().min(0).max(11), blackAvatarId: z.number().int().min(0).max(11), clock: z.object({ baseMinutes: cotuongClockMinutesSchema, incrementSeconds: cotuongIncrementSecondsSchema }).strict().nullable() }).strict();
export const cotuongLocalResumeSchema = z.object({ localSessionId: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/) }).strict();
export const cotuongLocalNewGameSchema = z.object({ actionId: z.string().uuid(), localSessionId: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/), expectedRevision: z.number().int().nonnegative(), redPlayerStarts: z.boolean().optional() }).strict();
export type CotuongLocalActionPayload = z.infer<typeof cotuongLocalActionSchema>;
export type CotuongLocalCreatePayload = z.infer<typeof cotuongLocalCreateSchema>;
export type CotuongLocalResumePayload = z.infer<typeof cotuongLocalResumeSchema>;
export type CotuongLocalNewGamePayload = z.infer<typeof cotuongLocalNewGameSchema>;
