import { z } from 'zod';
const id = z.string().min(1).max(160);
const coordinate = z.object({ row: z.number().int().min(0).max(11), col: z.number().int().min(0).max(11) }).strict();
const orientation = z.enum(['horizontal', 'vertical']);
const ship = z.object({ id, length: z.number().int().min(2).max(5), anchor: coordinate, orientation }).strict();
const placement = ship.extend({ cells: z.array(coordinate).min(2).max(5) }).strict();
const targetCell = z.enum(['unknown', 'hit', 'sunk']);
export const bantauAimStateSchema = z.object({ turnId: id, sequence: z.number().int().positive(), cell: coordinate }).strict().nullable();

export const bantauPublicGameSchema = z.object({
  gameId: id,
  revision: z.number().int().nonnegative(),
  boardSize: z.union([z.literal(8), z.literal(10), z.literal(12)]),
  shipCount: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  fleetLengths: z.array(z.number().int().min(2).max(5)).min(3).max(5),
  hitContinues: z.boolean(),
  allowTouch: z.boolean(),
  phase: z.enum(['setup', 'turn', 'resolving', 'finished']),
  setupId: id,
  setupDeadlineAt: z.number().finite().nullable(),
  setupRemainingMs: z.number().int().nonnegative().nullable(),
  players: z.array(z.object({ id, nickname: z.string().min(1).max(24), placementLocked: z.boolean(), sunkCount: z.number().int().nonnegative() }).strict()).length(2),
  currentPlayerId: id.nullable(),
  turnId: id,
  deadlineAt: z.number().finite().nullable(),
  remainingMs: z.number().int().nonnegative().nullable(),
  serverNow: z.number().finite(),
  turnDurationMs: z.number().int().positive(),
  resolvingDeadlineAt: z.number().finite().nullable(),
  winnerId: id.nullable(),
  finishReason: z.enum(['fleet-sunk', 'resign']).nullable(),
  notice: z.string().max(240).nullable(),
  ownFleet: z.object({
    revision: z.number().int().nonnegative(),
    ships: z.array(placement).min(3).max(5),
    hitCells: z.array(coordinate).max(60),
  }).strict(),
  targetBoard: z.array(targetCell).max(144),
  revealedSunkShips: z.array(z.object({
    displayId: z.string().regex(/^wreck-[1-5]$/),
    length: z.number().int().min(2).max(5),
    cells: z.array(coordinate).min(2).max(5),
  }).strict()).max(5),
  ownAim: bantauAimStateSchema,
  capabilities: z.object({ canEditFleet: z.boolean(), canRandomize: z.boolean(), canLock: z.boolean(), canAim: z.boolean(), canFire: z.boolean(), canResign: z.boolean() }).strict(),
}).strict().superRefine((game, context) => {
  if (game.fleetLengths.length !== game.shipCount) context.addIssue({ code: 'custom', path: ['fleetLengths'], message: 'Số tàu không khớp cấu hình.' });
  if (game.targetBoard.length !== game.boardSize * game.boardSize) context.addIssue({ code: 'custom', path: ['targetBoard'], message: 'Bản đồ mục tiêu không khớp kích thước bàn.' });
  if (game.ownFleet.ships.length !== game.shipCount) context.addIssue({ code: 'custom', path: ['ownFleet', 'ships'], message: 'Đội hình riêng không khớp cấu hình.' });
  for (const [index, item] of game.ownFleet.ships.entries()) {
    if (item.length !== game.fleetLengths[index] || item.cells.length !== item.length) context.addIssue({ code: 'custom', path: ['ownFleet', 'ships', index], message: 'Dữ liệu tàu không hợp lệ.' });
    if (item.cells.some((cell) => cell.row >= game.boardSize || cell.col >= game.boardSize)) context.addIssue({ code: 'custom', path: ['ownFleet', 'ships', index, 'cells'], message: 'Tàu nằm ngoài bàn.' });
  }
  if (game.targetBoard.some((cell) => cell === 'sunk') && game.phase === 'setup') context.addIssue({ code: 'custom', path: ['targetBoard'], message: 'Bàn setup không thể có tàu đã chìm.' });
  for (const [index, ship] of game.revealedSunkShips.entries()) {
    if (ship.cells.length !== ship.length || ship.cells.some((cell) => cell.row >= game.boardSize || cell.col >= game.boardSize)) {
      context.addIssue({ code: 'custom', path: ['revealedSunkShips', index], message: 'Dữ liệu tàu chìm không hợp lệ.' });
    }
    if (ship.cells.some((cell) => game.targetBoard[cell.row * game.boardSize + cell.col] !== 'sunk')) {
      context.addIssue({ code: 'custom', path: ['revealedSunkShips', index, 'cells'], message: 'Chỉ được công bố ô của tàu đã chìm.' });
    }
  }
  const revealedCells = game.revealedSunkShips.flatMap((ship) => ship.cells.map((cell) => cell.row * game.boardSize + cell.col));
  if (new Set(revealedCells).size !== revealedCells.length) context.addIssue({ code: 'custom', path: ['revealedSunkShips'], message: 'Các tàu chìm không thể dùng chung một ô.' });
});

export type BantauPublicGame = z.infer<typeof bantauPublicGameSchema>;
const envelope = { actionId: z.string().uuid(), roomId: z.string().min(8).max(80), gameId: id };
export const bantauPlacementSchema = z.discriminatedUnion('type', [
  z.object({ ...envelope, setupId: id, expectedFleetRevision: z.number().int().nonnegative(), type: z.literal('moveShip'), shipId: id, anchor: coordinate }).strict(),
  z.object({ ...envelope, setupId: id, expectedFleetRevision: z.number().int().nonnegative(), type: z.literal('rotateShip'), shipId: id }).strict(),
  z.object({ ...envelope, setupId: id, expectedFleetRevision: z.number().int().nonnegative(), type: z.literal('replaceFleetRandom') }).strict(),
]);
export const bantauAimSchema = z.object({ ...envelope, turnId: id, sequence: z.number().int().positive().max(2_147_483_647), cell: coordinate.nullable() }).strict();
export const bantauActionSchema = z.discriminatedUnion('type', [
  z.object({ actionId: z.string().uuid(), roomId: z.string().min(8).max(80), expectedRevision: z.number().int().nonnegative(), gameId: id, type: z.literal('lockFleet'), setupId: id, expectedFleetRevision: z.number().int().nonnegative() }).strict(),
  z.object({ actionId: z.string().uuid(), roomId: z.string().min(8).max(80), expectedRevision: z.number().int().nonnegative(), gameId: id, type: z.literal('fire'), turnId: id, aimSequence: z.number().int().positive(), row: z.number().int().min(0).max(11), col: z.number().int().min(0).max(11) }).strict(),
  z.object({ actionId: z.string().uuid(), roomId: z.string().min(8).max(80), expectedRevision: z.number().int().nonnegative(), gameId: id, type: z.literal('resign') }).strict(),
]);
export const bantauEffectSchema = z.object({
  eventId: id, shotId: id, roomId: z.string().min(8).max(80), gameId: id,
  revision: z.number().int().nonnegative(), turnId: id, actorId: id, targetId: id,
  row: z.number().int().min(0).max(11), col: z.number().int().min(0).max(11),
  result: z.enum(['miss', 'hit', 'sunk']), source: z.enum(['manual', 'timeout']),
  serverTime: z.number().finite(), presentationExpiresAt: z.number().finite(),
  sunkCells: z.array(coordinate).min(2).max(5).optional(),
}).strict().superRefine((effect, context) => {
  if (effect.result !== 'sunk' && effect.sunkCells) context.addIssue({ code: 'custom', path: ['sunkCells'], message: 'Chỉ tàu vừa chìm mới tiết lộ ô.' });
});
export type BantauEffectEvent = z.infer<typeof bantauEffectSchema>;
export type BantauPlacementPayload = z.infer<typeof bantauPlacementSchema>;
export type BantauAimPayload = z.infer<typeof bantauAimSchema>;
export type BantauActionPayload = z.infer<typeof bantauActionSchema>;
