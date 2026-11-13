import { z } from 'zod';
import type { NoituPublicGame } from '@banban/noitu';
import type { UnoPublicGame } from '@banban/uno';

export const GAME_CATALOG = {
  uno: { key: 'uno', name: 'UNO', minPlayers: 2, maxPlayers: 6 },
  noitu: { key: 'noitu', name: 'Nối từ', minPlayers: 2, maxPlayers: 6 },
} as const;

export type GameKey = keyof typeof GAME_CATALOG;
export type RoomVisibility = 'public' | 'private';
export type RoomPhase = 'waiting' | 'playing' | 'finished';

export const nicknameSchema = z.string().trim().min(1).max(24).transform((value) => value.normalize('NFC'));
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
  playerCount: number;
  maxPlayers: number;
  phase: 'waiting';
};

export type PlayerSummary = {
  id: string;
  nickname: string;
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
);

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

export const roomCreateSchema = z.object({ actionId: z.string().uuid(), nickname: nicknameSchema, visibility: z.enum(['public', 'private']), gameKey: z.enum(['uno', 'noitu']).default('uno') }).strict();
export const roomJoinSchema = z.object({ actionId: z.string().uuid(), code: roomCodeSchema, nickname: nicknameSchema }).strict();
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
