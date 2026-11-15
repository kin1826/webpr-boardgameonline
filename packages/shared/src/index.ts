import { z } from 'zod';
import { unoPublicGameSchema, noituPublicGameSchema } from './public-game-schemas';
export { unoPublicGameSchema, noituPublicGameSchema } from './public-game-schemas';
import type { NoituPublicGame } from '@banban/noitu';
import type { UnoPublicGame } from '@banban/uno';
import type { CaroPublicGame } from '@banban/caro';

export const GAME_CATALOG = {
  uno: { key: 'uno', name: 'UNO', minPlayers: 2, maxPlayers: 6 },
  noitu: { key: 'noitu', name: 'Nối từ', minPlayers: 2, maxPlayers: 6 },
  caro: { key: 'caro', name: 'Caro', minPlayers: 2, maxPlayers: 2 },
} as const;

export type GameKey = keyof typeof GAME_CATALOG;
export type RoomVisibility = 'public' | 'private';
export type RoomPhase = 'waiting' | 'playing' | 'finished';

export const nicknameSchema = z.string().trim().min(1).max(24).transform((value) => value.normalize('NFC'));
export const avatarIdSchema = z.number().int().min(0).max(11);
export const roomCodeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/);
export const actionEnvelopeSchema = z.object({
  actionId: z.string().uuid(),
  roomId: z.string().min(8).max(80),
  expectedRevision: z.number().int().nonnegative(),
}).strict();

export type PublicRoomSummary = {
  code: string;
  gameKey: GameKey;
  visibility: 'public';
  hostName: string;
  hostAvatarId: number;
  playerCount: number;
  maxPlayers: number;
  phase: 'waiting';
};

export type PlayerSummary = {
  id: string;
  nickname: string;
  avatarId: number;
  isHost: boolean;
  isYou: boolean;
  online: boolean;
  ready: boolean;
  cardCount?: number;
};

type RoomSnapshotBase = {
  roomId: string;
  code: string;
  visibility: RoomVisibility;
  phase: RoomPhase;
  revision: number;
  paused: boolean;
  hostId: string;
  players: PlayerSummary[];
  minPlayers: number;
  maxPlayers: number;
  canStart: boolean;
  startReason: string | null;
  notice: string | null;
};

export type RoomSnapshot = RoomSnapshotBase & (
  | { gameKey: 'uno'; game: UnoPublicGame | null }
  | { gameKey: 'noitu'; game: NoituPublicGame | null }
  | { gameKey: 'caro'; caroWinLength: 4 | 5 | 6; game: CaroPublicGame | null }
);

export const caroWinLengthSchema = z.union([z.literal(4), z.literal(5), z.literal(6)]);
export const caroSettingsSchema = actionEnvelopeSchema.extend({ winLength: caroWinLengthSchema }).strict();

const caroPositionSchema = z.object({ row: z.number().int().min(0).max(14), col: z.number().int().min(0).max(14) }).strict();
const caroPlayerSchema = z.object({ id: z.string().min(1).max(80), nickname: nicknameSchema, symbol: z.enum(['X', 'O']) }).strict();
export const caroPublicGameSchema = z.object({
  gameId: z.string().min(1).max(80), revision: z.number().int().nonnegative(),
  winLength: caroWinLengthSchema,
  players: z.array(caroPlayerSchema).length(2),
  board: z.array(z.enum(['X', 'O']).nullable()).length(225),
  phase: z.enum(['turn', 'finished']), currentPlayerId: z.string().min(1).max(80).nullable(), turnId: z.string().min(1).max(160),
  lastMove: caroPositionSchema.extend({ playerId: z.string().min(1).max(80), symbol: z.enum(['X', 'O']) }).strict().nullable(),
  winningLines: z.array(z.array(caroPositionSchema).min(4).max(6)),
  deadlineAt: z.number().finite().nullable(), remainingMs: z.number().int().nonnegative().nullable(), serverNow: z.number().finite(), turnDurationMs: z.number().int().positive(),
  winnerId: z.string().min(1).max(80).nullable(), finishReason: z.enum(['five', 'timeout', 'resign', 'board-full']).nullable(), notice: z.string().max(240).nullable(),
  canPlace: z.boolean(), canResign: z.boolean(), yourSymbol: z.enum(['X', 'O']).nullable(), legalCellIndexes: z.array(z.number().int().min(0).max(224)).max(225),
}).strict();

export const caroActionSchema = z.discriminatedUnion('type', [
  z.object({ ...actionEnvelopeSchema.shape, gameId: z.string().min(1).max(80), type: z.literal('place'), row: z.number().int().min(0).max(14), col: z.number().int().min(0).max(14), turnId: z.string().min(1).max(160) }).strict(),
  z.object({ ...actionEnvelopeSchema.shape, gameId: z.string().min(1).max(80), type: z.literal('resign') }).strict(),
]);
export type CaroActionPayload = z.infer<typeof caroActionSchema>;

const roomSnapshotBaseSchema = z.object({
  roomId: z.string().min(8).max(80), code: roomCodeSchema, visibility: z.enum(['public', 'private']), phase: z.enum(['waiting', 'playing', 'finished']),
  revision: z.number().int().nonnegative(), paused: z.boolean(), hostId: z.string().min(1).max(80),
  players: z.array(z.object({ id: z.string().min(1).max(80), nickname: nicknameSchema, avatarId: avatarIdSchema, isHost: z.boolean(), isYou: z.boolean(), online: z.boolean(), ready: z.boolean(), cardCount: z.number().int().nonnegative().optional() }).strict()).min(1).max(6),
  minPlayers: z.number().int().min(1).max(6), maxPlayers: z.number().int().min(1).max(6), canStart: z.boolean(), startReason: z.string().max(240).nullable(), notice: z.string().max(240).nullable(),
});
const roomSnapshotRuntimeSchema = z.discriminatedUnion('gameKey', [
  roomSnapshotBaseSchema.extend({ gameKey: z.literal('caro'), caroWinLength: caroWinLengthSchema, game: caroPublicGameSchema.nullable() }).strict(),
  roomSnapshotBaseSchema.extend({ gameKey: z.literal('uno'), game: unoPublicGameSchema.nullable() }).strict(),
  roomSnapshotBaseSchema.extend({ gameKey: z.literal('noitu'), game: noituPublicGameSchema.nullable() }).strict(),
]);
export function parseRoomSnapshot(value: unknown): RoomSnapshot | null {
  const parsed = roomSnapshotRuntimeSchema.safeParse(value);
  return parsed.success ? parsed.data as RoomSnapshot : null;
}

export const gameEffectSchema = z.object({
  eventId: z.string().min(1).max(160), roomId: z.string().min(8).max(80), gameId: z.string().min(1).max(80),
  revision: z.number().int().nonnegative(), gameRevision: z.number().int().nonnegative(),
  actionType: z.enum(['start', 'play', 'draw', 'keep', 'chooseColor', 'acceptPenalty', 'declareUno', 'catchUno']),
  actorId: z.string().min(1).max(80), targetId: z.string().min(1).max(80).optional(),
  card: z.object({ type: z.enum(['number', 'drawTwo', 'reverse', 'skip', 'wild', 'wildDrawFour']), color: z.enum(['red', 'yellow', 'green', 'blue', 'wild']), value: z.number().int().min(0).max(9).optional() }).strict().optional(),
  currentColor: z.enum(['red', 'yellow', 'green', 'blue']).optional(), direction: z.union([z.literal(1), z.literal(-1)]).optional(),
  penaltyTotal: z.number().int().positive().optional(), drawnCount: z.number().int().nonnegative().optional(), winnerId: z.string().min(1).max(80).optional(),
}).strict();
export type GameEffectEvent = z.infer<typeof gameEffectSchema>;

export type SessionCredentials = { roomId: string; roomCode: string; playerId: string; token: string };
export const sessionCredentialsSchema = z.object({ roomId: z.string().min(8).max(80), roomCode: roomCodeSchema, playerId: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/) }).strict();

export const roomCreateSchema = z.object({ actionId: z.string().uuid(), nickname: nicknameSchema, avatarId: avatarIdSchema.optional(), visibility: z.enum(['public', 'private']), gameKey: z.enum(['uno', 'noitu', 'caro']).default('uno') }).strict();
export const roomJoinSchema = z.object({ actionId: z.string().uuid(), code: roomCodeSchema, nickname: nicknameSchema, avatarId: avatarIdSchema.optional() }).strict();
export const resumeSchema = z.object({ roomId: z.string().min(8).max(80), playerId: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/) }).strict();
export const roomCommandSchema = z.object({ actionId: z.string().uuid(), roomId: z.string().min(8).max(80), expectedRevision: z.number().int().nonnegative() }).strict();
export const readySchema = z.object({ ready: z.boolean() }).strict();
export const visibilitySchema = z.object({ visibility: z.enum(['public', 'private']) }).strict();
export const kickSchema = z.object({ targetPlayerId: z.string().min(8).max(80) }).strict();
const gameEnvelopeShape = { ...actionEnvelopeSchema.shape, gameId: z.string().min(1).max(80) };
export const gameActionSchema = z.discriminatedUnion('type', [
  z.object({ ...gameEnvelopeShape, type: z.literal('play'), cardId: z.string().min(1).max(80), color: z.enum(['red', 'yellow', 'green', 'blue']).optional(), declareUno: z.boolean().optional() }).strict(),
  z.object({ ...gameEnvelopeShape, type: z.literal('chooseColor'), color: z.enum(['red', 'yellow', 'green', 'blue']) }).strict(),
  z.object({ ...gameEnvelopeShape, type: z.literal('draw') }).strict(),
  z.object({ ...gameEnvelopeShape, type: z.literal('keep') }).strict(),
  z.object({ ...gameEnvelopeShape, type: z.literal('declareUno') }).strict(),
  z.object({ ...gameEnvelopeShape, type: z.literal('catchUno'), targetPlayerId: z.string().min(8).max(80) }).strict(),
  z.object({ ...gameEnvelopeShape, type: z.literal('acceptPenalty') }).strict(),
]);

const noituEnvelopeShape = { ...actionEnvelopeSchema.shape, gameId: z.string().min(1).max(80), turnId: z.string().min(1).max(160) };
export const noituActionSchema = z.discriminatedUnion('type', [
  z.object({ ...noituEnvelopeShape, type: z.literal('submit'), suffix: z.string().min(1).max(64) }).strict(),
  z.object({ ...noituEnvelopeShape, type: z.literal('giveUp') }).strict(),
  z.object({ ...noituEnvelopeShape, type: z.literal('vote'), proposalId: z.string().min(1).max(160), decision: z.enum(['accept', 'reject']) }).strict(),
]);
export type NoituActionPayload = z.infer<typeof noituActionSchema>;

export const noituDraftSchema = z.object({
  roomId: z.string().min(8).max(80), gameId: z.string().min(1).max(80), turnId: z.string().min(1).max(160),
  sequence: z.number().int().positive().max(2_147_483_647), suffix: z.string().max(64),
}).strict();
export type NoituDraftPayload = z.infer<typeof noituDraftSchema>;
export type NoituDraftNotice = NoituDraftPayload & { playerId: string; nickname: string; prefix: string };
export const noituDraftNoticeSchema = noituDraftSchema.extend({ playerId: z.string().min(1).max(80), nickname: nicknameSchema, prefix: z.string().min(1).max(32) }).strict();
export const noituDraftClearSchema = z.object({ roomId: z.string().min(8).max(80) }).strict();

export type GameActionPayload = z.infer<typeof gameActionSchema>;

export const roomClosedSchema = z.object({ roomId: z.string().min(8).max(80), reason: z.enum(['expired', 'shutdown', 'empty']), message: z.string().min(1).max(240) }).strict();
export type RoomClosedPayload = z.infer<typeof roomClosedSchema>;
