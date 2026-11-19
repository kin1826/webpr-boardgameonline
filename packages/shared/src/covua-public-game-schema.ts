import { z } from 'zod';

const color = z.enum(['white', 'black']);
const role = z.enum(['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']);
const promotion = z.enum(['queen', 'rook', 'bishop', 'knight']);
const square = z.string().regex(/^[a-h][1-8]$/);
const move = z.object({ from: square, to: square, promotion: promotion.optional() }).strict();
const piece = z.object({ id: z.string().min(1).max(80), color, role }).strict();
const clock = z.object({ initialMs: z.number().int().positive(), incrementMs: z.number().int().nonnegative(), remainingMs: z.object({ white: z.number().int().nonnegative(), black: z.number().int().nonnegative() }).strict(), deadlineAt: z.number().finite().nullable(), pausedRemainingMs: z.number().int().nonnegative().nullable(), serverNow: z.number().finite() }).strict();
const lastMove = z.object({ id: z.string().max(160), ply: z.number().int().positive(), actorId: z.string().max(80), pieceId: z.string().max(80), from: square, to: square, capturedPieceId: z.string().max(80).optional(), captureSquare: square.optional(), promotion: role.optional(), rookMove: z.object({ pieceId: z.string().max(80), from: square, to: square }).strict().optional(), san: z.string().max(32), gaveCheck: z.boolean() }).strict();
export const covuaPublicGameSchema = z.object({
  rulesVersion: z.literal('HQ-COVUA-1'), gameId: z.string().min(1).max(80), revision: z.number().int().nonnegative(),
  board: z.record(square, piece.nullable()).refine((board) => Object.keys(board).length === 64),
  players: z.array(z.object({ id: z.string().max(80), nickname: z.string().min(1).max(24), color }).strict()).length(2),
  currentColor: color.nullable(), turnId: z.string().max(160), phase: z.enum(['turn', 'finished']), lastMove: lastMove.nullable(), history: z.array(z.string().max(32)).max(100), historyCount: z.number().int().nonnegative(), checkedColor: color.nullable(), drawOffer: z.object({ id: z.string().max(160), offeredBy: color, ply: z.number().int().nonnegative() }).strict().nullable(), repetitionCount: z.number().int().nonnegative(), halfmovePlies: z.number().int().nonnegative(), clock: clock.nullable(), winnerColor: color.nullable(), finishReason: z.enum(['checkmate','stalemate','repetition-claim','fifty-move-claim','fivefold','seventy-five-move','insufficient-material','timeout','timeout-draw','resign','resign-draw','draw-agreement']).nullable(), notice: z.string().max(240).nullable(), viewerColor: color.nullable(), legalMoves: z.array(move).max(256), capabilities: z.object({ canMove: z.boolean(), canOfferDraw: z.boolean(), canRespondDraw: z.boolean(), canResign: z.boolean(), canClaimDrawNow: z.boolean() }).strict(), claimReasons: z.array(z.enum(['repetition', 'fifty-move'])).max(2),
}).strict();
export type CovuaPublicGame = z.infer<typeof covuaPublicGameSchema>;
export const covuaSettingsSchema = z.object({ gameKey: z.literal('covua'), targetScore: z.number().int().min(10).max(500).multipleOf(10), baseMinutes: z.union([z.literal(5),z.literal(10),z.literal(15)]), incrementSeconds: z.union([z.literal(0),z.literal(3),z.literal(5)]), whiteSide: z.enum(['random','host-white']) }).strict();
const envelope = { actionId: z.string().uuid(), roomId: z.string().min(8).max(80), expectedRevision: z.number().int().nonnegative(), gameId: z.string().min(1).max(80) };
export const covuaActionSchema = z.discriminatedUnion('type', [
  z.object({ ...envelope, type: z.literal('move'), turnId: z.string().max(160), move }).strict(),
  z.object({ ...envelope, type: z.literal('offerDraw'), turnId: z.string().max(160) }).strict(),
  z.object({ ...envelope, type: z.literal('respondDraw'), offerId: z.string().max(160), accept: z.boolean() }).strict(),
  z.object({ ...envelope, type: z.literal('claimDraw'), turnId: z.string().max(160), reason: z.enum(['repetition','fifty-move']), intendedMove: move.optional() }).strict(),
  z.object({ ...envelope, type: z.literal('resign') }).strict(),
]);
export type CovuaActionPayload = z.infer<typeof covuaActionSchema>;
const localEnvelope = { actionId: z.string().uuid(), localSessionId: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/), expectedRevision: z.number().int().nonnegative(), gameId: z.string().min(1).max(80) };
export const covuaLocalActionSchema = z.discriminatedUnion('type', [
  z.object({ ...localEnvelope, type: z.literal('move'), turnId: z.string().max(160), move }).strict(),
  z.object({ ...localEnvelope, type: z.literal('offerDraw'), turnId: z.string().max(160), actingColor: color }).strict(),
  z.object({ ...localEnvelope, type: z.literal('respondDraw'), offerId: z.string().max(160), accept: z.boolean(), actingColor: color }).strict(),
  z.object({ ...localEnvelope, type: z.literal('claimDraw'), turnId: z.string().max(160), reason: z.enum(['repetition','fifty-move']), intendedMove: move.optional(), actingColor: color }).strict(),
  z.object({ ...localEnvelope, type: z.literal('resign'), actingColor: color }).strict(),
]);
export const covuaLocalCreateSchema = z.object({ actionId: z.string().uuid(), whiteNickname: z.string().trim().min(1).max(24), blackNickname: z.string().trim().min(1).max(24), whiteAvatarId: z.number().int().min(0).max(11), blackAvatarId: z.number().int().min(0).max(11), clock: z.object({ baseMinutes: z.union([z.literal(5),z.literal(10),z.literal(15)]), incrementSeconds: z.union([z.literal(0),z.literal(3),z.literal(5)]) }).strict().nullable() }).strict();
export const covuaLocalResumeSchema = z.object({ localSessionId: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/) }).strict();
export const covuaLocalNewGameSchema = z.object({ actionId: z.string().uuid(), localSessionId: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/), expectedRevision: z.number().int().nonnegative() }).strict();
export type CovuaLocalActionPayload = z.infer<typeof covuaLocalActionSchema>;
export type CovuaLocalCreatePayload = z.infer<typeof covuaLocalCreateSchema>;
export type CovuaLocalResumePayload = z.infer<typeof covuaLocalResumeSchema>;
export type CovuaLocalNewGamePayload = z.infer<typeof covuaLocalNewGameSchema>;
