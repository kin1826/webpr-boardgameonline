import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server as SocketServer, type Socket } from 'socket.io';
import sirv from 'sirv';
import {
  DEFAULT_GAME_SETTINGS, GAME_CATALOG, bantauActionSchema, bantauAimSchema, bantauEffectSchema, bantauPlacementSchema, caroSettingsSchema, caroActionSchema, cotuongActionSchema, cotuongLocalActionSchema, cotuongLocalCreateSchema, cotuongLocalNewGameSchema, cotuongLocalResumeSchema, gameActionSchema, gameEffectSchema, kickSchema, noituActionSchema, noituDraftSchema, readySchema, resumeSchema, roomCommandSchema, roomSettingsSchema,
  roomCreateSchema, roomJoinSchema, visibilitySchema,
} from '@banban/shared';
import { loadNoituDictionary, type RuntimeNoituDictionary } from './noitu-dictionary.ts';
import { RoomError, RoomService } from './rooms.ts';
import { CotuongLocalError, CotuongLocalService } from './cotuong-local.ts';

type Ack = (value: Record<string, unknown>) => void;
type ActiveSession = { roomId: string; playerId: string; generation: number };
type ClientSocket = Socket & { data: Socket['data'] & { activeSession?: ActiveSession; activeLocalCotuong?: string } };
type Cached = { fingerprint: string; response: Record<string, unknown>; expiresAt: number };

export function originAllowed(origin: string | undefined, host?: string, protocol = 'http', allowlist = process.env.ALLOWED_ORIGINS ?? '') {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const allowed = allowlist.split(',').map((value) => value.trim()).filter(Boolean);
    const localDev = process.env.NODE_ENV !== 'production' && (parsed.port === '5173' || parsed.port === '4173') && (
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)
    );
    const sameHost = Boolean(host && parsed.host.toLowerCase() === host.toLowerCase());
    const sameProtocol = parsed.protocol === `${protocol.replace(':', '')}:`;
    return allowed.includes(origin) || localDev || (sameHost && sameProtocol);
  } catch { return false; }
}

function requestProtocol(req: import('node:http').IncomingMessage) {
  const forwarded = req.headers['x-forwarded-proto'];
  return typeof forwarded === 'string' ? forwarded.split(',')[0]!.trim() : (req.socket as typeof req.socket & { encrypted?: boolean }).encrypted ? 'https' : 'http';
}

export function createRealtimeServer(options: { serveWeb?: boolean; roomService?: RoomService; maxEventsPerWindow?: number; noitu?: RuntimeNoituDictionary | null } = {}) {
  let io: SocketServer;
  const http = createServer();
  let noitu = options.noitu;
  if (noitu === undefined) {
    try { noitu = loadNoituDictionary(); }
    catch { noitu = null; }
  }
  const roomService = options.roomService ?? new RoomService({ noitu });
  let ioForLocal: SocketServer | undefined;
  const localCotuong = new CotuongLocalService({
    onRevoke: (socketId) => {
      const client = ioForLocal?.sockets.sockets.get(socketId) as ClientSocket | undefined;
      if (client) { delete client.data.activeLocalCotuong; client.emit('cotuong:local:revoked', { message: 'Ván cùng máy đã được mở ở kết nối khác.' }); setTimeout(() => client.disconnect(true), 40); }
    },
    onChanged: (sessionId) => {
      const client = [...(ioForLocal?.sockets.sockets.values() ?? [])].find((socket) => (socket as ClientSocket).data.activeLocalCotuong === sessionId);
      const snapshot = localCotuong.snapshot(sessionId);
      if (client && snapshot) client.emit('cotuong:local:changed', { sessionId, ...snapshot });
    },
  });
  roomService.setLifecycleHandlers({
    onRevoke: (socketId) => {
      const client = io?.sockets.sockets.get(socketId);
      if (client) {
        delete client.data.activeSession;
        client.emit('session:revoked', { message: 'Phiên này không còn ghế trong phòng.' });
        setTimeout(() => client.disconnect(true), 40);
      }
    },
    onChanged: (roomId) => broadcast(roomId),
    onNoituDraft: (roomId, draft) => {
      io?.to('room:' + roomId).emit(draft ? 'noitu:draft:changed' : 'noitu:draft:clear', draft ?? { roomId });
    },
    onBantauEffect: (roomId, effect) => broadcastBantauEffect(roomId, effect),
    onClosed: (payload, socketIds) => {
      for (const socketId of socketIds) {
        const client = io?.sockets.sockets.get(socketId);
        if (client) {
          delete client.data.activeSession;
          client.emit('room:closed', payload);
          void client.leave('room:' + payload.roomId);
        }
      }
    },
  });
  const actionCache = new Map<string, Cached>();
  const requestCache = new Map<string, Cached>();
  const limits = new Map<string, { start: number; count: number }>();
  const eventLimits = new Map<string, { start: number; count: number }>();
  const bantauActionLimits = new Map<string, { start: number; count: number }>();

  function failure(error: unknown) {
    if (error instanceof RoomError) return { ok: false, code: error.code, message: error.message };
    if (error instanceof CotuongLocalError) return { ok: false, code: error.code, message: error.message };
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Có lỗi máy chủ. Hãy thử lại.' };
  }
  function allowEvent(socketId: string, ack: Ack) {
    const now = Date.now(); const bucket = eventLimits.get(socketId) ?? { start: now, count: 0 };
    if (now - bucket.start >= 10_000) { bucket.start = now; bucket.count = 0; }
    bucket.count++; eventLimits.set(socketId, bucket);
    if (bucket.count <= (options.maxEventsPerWindow ?? 100)) return true;
    ack({ ok: false, code: 'RATE_LIMITED', message: 'Bạn thao tác hơi nhanh. Hãy chờ một chút rồi thử lại.' });
    return false;
  }
  function current(socket: ClientSocket, roomId?: string) {
    const session = socket.data.activeSession;
    if (!session || (roomId && session.roomId !== roomId) || !roomService.isCurrentSocket(session.roomId, session.playerId, socket.id, session.generation)) throw new RoomError('SESSION_REVOKED', 'Phiên kết nối này không còn quyền trong phòng.');
    const room = roomService.getRoom(session.roomId);
    return { session, room, seat: roomService.getSeat(room, session.playerId) };
  }
  function broadcast(roomId: string) {
    let room;
    try { room = roomService.getRoom(roomId); } catch { return; }
    for (const seat of room.players.values()) {
      if (seat.online && seat.socketId) {
        const client = io.sockets.sockets.get(seat.socketId);
        if (client) client.emit('room:snapshot', roomService.snapshot(room, seat.id));
      }
    }
  }
  function broadcastBantauEffect(roomId: string, effect: unknown) {
    const parsed = bantauEffectSchema.safeParse({ ...(effect as Record<string, unknown>), roomId });
    if (!parsed.success) return;
    let room;
    try { room = roomService.getRoom(roomId); } catch { return; }
    for (const seat of room.players.values()) {
      if (!seat.online || !seat.socketId) continue;
      const client = io.sockets.sockets.get(seat.socketId) as ClientSocket | undefined;
      if (client?.data.activeSession?.roomId === roomId && client.data.activeSession.playerId === seat.id && client.data.activeSession.generation === seat.generation) client.emit('bantau:effect', parsed.data);
    }
  }
  function cacheResult(cache: Map<string, Cached>, key: string, fingerprint: string, response: Record<string, unknown>, ack: Ack) {
    cache.set(key, { fingerprint, response, expiresAt: Date.now() + 5 * 60_000 });
    if (cache.size > 5000) {
      for (const [id, entry] of cache) if (entry.expiresAt < Date.now()) cache.delete(id);
      while (cache.size > 5000) cache.delete(cache.keys().next().value!);
    }
    ack(response);
  }
  function idempotentRequest(socket: ClientSocket, actionId: string, payload: unknown, ack: Ack, operation: () => Record<string, unknown>) {
    const key = socket.id + ':' + actionId;
    const fingerprint = JSON.stringify(payload);
    const old = requestCache.get(key);
    if (old && old.expiresAt > Date.now()) {
      if (old.fingerprint !== fingerprint) return ack({ ok: false, code: 'ACTION_ID_REUSED', message: 'Mã thao tác đã được dùng cho nội dung khác.' });
      return ack(old.response);
    }
    try { cacheResult(requestCache, key, fingerprint, operation(), ack); } catch (error) { ack(failure(error)); }
  }
  function command(socket: ClientSocket, raw: unknown, schema: { safeParse(value: unknown): { success: boolean; data?: any } }, ack: Ack, operation: (room: ReturnType<RoomService['getRoom']>, seat: ReturnType<RoomService['getSeat']>, payload: any) => unknown) {
    if (!allowEvent(socket.id, ack)) return;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Dữ liệu gửi lên chưa hợp lệ.' });
    const payload = parsed.data;
    try {
      const { session, room, seat } = current(socket as ClientSocket, payload.roomId);
      const key = session.playerId + ':' + payload.actionId;
      const fingerprint = JSON.stringify(payload);
      const previous = actionCache.get(key);
      if (previous && previous.expiresAt > Date.now()) {
        if (previous.fingerprint !== fingerprint) return ack({ ok: false, code: 'ACTION_ID_REUSED', message: 'Mã thao tác đã được dùng cho nội dung khác.' });
        return ack(previous.response);
      }
      if (room.revision !== payload.expectedRevision) throw new RoomError('STALE_REVISION', 'Trạng thái phòng vừa đổi. Bảng đang được cập nhật.');
      const result = operation(room, seat, payload) as { gameEffect?: unknown; bantauEffect?: unknown } | undefined;
      const response = { ok: true, actionId: payload.actionId, snapshot: roomService.snapshot(room, seat.id) };
      broadcast(room.id);
      if (result?.gameEffect) {
        const parsedEffect = gameEffectSchema.safeParse(result.gameEffect);
        if (parsedEffect.success) for (const member of room.players.values()) {
          if (!member.online || !member.socketId) continue;
          io.sockets.sockets.get(member.socketId)?.emit('game:effect', parsedEffect.data);
        }
      }
      if (result?.bantauEffect) broadcastBantauEffect(room.id, result.bantauEffect);
      cacheResult(actionCache, key, fingerprint, response, ack);
    } catch (error) { ack(failure(error)); }
  }

  function allowBantauAction(playerId: string, ack: Ack) {
    const now = Date.now(); const bucket = bantauActionLimits.get(playerId) ?? { start: now, count: 0 };
    if (now - bucket.start >= 1000) { bucket.start = now; bucket.count = 0; }
    bucket.count++; bantauActionLimits.set(playerId, bucket);
    if (bucket.count <= 8) return true;
    ack({ ok: false, code: 'RATE_LIMITED', message: 'Bạn đang thao tác quá nhanh. Hãy chờ một chút.' });
    return false;
  }
  function privateBantauCommand(socket: ClientSocket, raw: unknown, schema: { safeParse(value: unknown): { success: boolean; data?: any } }, ack: Ack, operation: (room: ReturnType<RoomService['getRoom']>, seat: ReturnType<RoomService['getSeat']>, payload: any) => Record<string, unknown>) {
    if (!allowEvent(socket.id, ack)) return;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Dữ liệu thao tác Bắn tàu chưa hợp lệ.' });
    try {
      const { session, room, seat } = current(socket, parsed.data.roomId);
      if (!allowBantauAction(seat.id, ack)) return;
      const key = session.playerId + ':' + parsed.data.actionId;
      const fingerprint = JSON.stringify(parsed.data);
      const previous = actionCache.get(key);
      if (previous && previous.expiresAt > Date.now()) {
        if (previous.fingerprint !== fingerprint) return ack({ ok: false, code: 'ACTION_ID_REUSED', message: 'Mã thao tác đã được dùng cho nội dung khác.' });
        return ack(previous.response);
      }
      const response = operation(room, seat, parsed.data);
      cacheResult(actionCache, key, fingerprint, { ok: true, actionId: parsed.data.actionId, ...response }, ack);
    } catch (error) { ack(failure(error)); }
  }

  io = new SocketServer(http, {
    path: '/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        callback(null, originAllowed(origin));
      },
    },
    allowRequest: (req, callback) => {
      callback(null, originAllowed(req.headers.origin, req.headers.host, requestProtocol(req)));
    },
    maxHttpBufferSize: 16 * 1024,
    connectionStateRecovery: { maxDisconnectionDuration: 0, skipMiddlewares: false },
  });
  ioForLocal = io;

  io.on('connection', (baseSocket) => {
    const socket = baseSocket as ClientSocket;
    socket.emit('server:status', { connected: true });
    socket.on('room:list', (ack?: Ack) => {
      if (ack && allowEvent(socket.id, ack)) ack({ ok: true, rooms: roomService.publicRooms() });
    });
    socket.on('room:create', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      if (socket.data.activeLocalCotuong) return ack({ ok: false, code: 'ACTIVE_LOCAL_GAME', message: 'Hãy thoát ván cùng máy trước khi vào phòng online.' });
      const parsed = roomCreateSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Hãy nhập biệt danh và chọn chế độ phòng.' });
      const value = parsed.data;
      idempotentRequest(socket, value.actionId, value, ack, () => {
        const created = roomService.create(value.nickname, value.visibility, socket.id, value.gameKey, value.avatarId, value.settings);
        socket.data.activeSession = { roomId: created.room.id, playerId: created.seat.id, generation: created.seat.generation };
        void socket.join('room:' + created.room.id);
        return { ok: true, actionId: value.actionId, credentials: created.credentials, snapshot: roomService.snapshot(created.room, created.seat.id) };
      });
    });
    socket.on('room:join', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      if (socket.data.activeLocalCotuong) return ack({ ok: false, code: 'ACTIVE_LOCAL_GAME', message: 'Hãy thoát ván cùng máy trước khi vào phòng online.' });
      const parsed = roomJoinSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Mã phòng hoặc biệt danh chưa hợp lệ.' });
      const value = parsed.data;
      idempotentRequest(socket, value.actionId, value, ack, () => {
        const joined = roomService.join(value.code, value.nickname, socket.id, value.avatarId);
        socket.data.activeSession = { roomId: joined.room.id, playerId: joined.seat.id, generation: joined.seat.generation };
        void socket.join('room:' + joined.room.id);
        broadcast(joined.room.id);
        return { ok: true, actionId: value.actionId, credentials: joined.credentials, snapshot: roomService.snapshot(joined.room, joined.seat.id) };
      });
    });
    socket.on('session:resume', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      if (socket.data.activeLocalCotuong) return ack({ ok: false, code: 'ACTIVE_LOCAL_GAME', message: 'Hãy thoát ván cùng máy trước khi nối lại phòng online.' });
      const parsed = resumeSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Thông tin nối lại phiên chưa hợp lệ.' });
      try {
        const resumed = roomService.resume(parsed.data.roomId, parsed.data.playerId, parsed.data.token, socket.id);
        socket.data.activeSession = { roomId: resumed.room.id, playerId: resumed.seat.id, generation: resumed.generation };
        void socket.join('room:' + resumed.room.id);
        broadcast(resumed.room.id);
        ack({ ok: true, snapshot: roomService.snapshot(resumed.room, resumed.seat.id), credentials: { roomId: resumed.room.id, roomCode: resumed.room.code, playerId: resumed.seat.id, token: parsed.data.token } });
      } catch (error) { ack(failure(error)); }
    });
    socket.on('room:ready', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, roomCommandSchema.extend({ ready: readySchema.shape.ready }).strict(), ack, (room, seat, value) => roomService.ready(room, seat, value.ready)));
    socket.on('room:caro-settings', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, caroSettingsSchema, ack, (room, seat, value) => roomService.setCaroWinLength(room, seat, value.winLength)));
    socket.on('room:settings', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, roomSettingsSchema, ack, (room, seat, value) => roomService.updateSettings(room, seat, value.settings)));
    socket.on('room:visibility', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, roomCommandSchema.extend({ visibility: visibilitySchema.shape.visibility }).strict(), ack, (room, seat, value) => roomService.setVisibility(room, seat, value.visibility)));
    socket.on('room:start', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, roomCommandSchema, ack, (room, seat) => {
      roomService.start(room, seat);
      if (room.gameKey !== 'uno') return;
      const game = room.game!;
      return { gameEffect: { eventId: `${game.gameId}:${game.revision}`, roomId: room.id, gameId: game.gameId, revision: room.revision, gameRevision: game.revision, actionType: 'start', actorId: seat.id, direction: game.direction, ...(game.currentColor ? { currentColor: game.currentColor } : {}) } };
    }));
    socket.on('room:kick', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, roomCommandSchema.extend({ targetPlayerId: kickSchema.shape.targetPlayerId }).strict(), ack, (room, seat, value) => roomService.kick(room, seat, value.targetPlayerId)));
    socket.on('room:rematch', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, roomCommandSchema, ack, (room, seat) => roomService.rematch(room, seat)));
    socket.on('game:action', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, gameActionSchema, ack, (room, seat, value) => {
      const { actionId: _actionId, roomId: _roomId, expectedRevision, gameId, ...intent } = value;
      void _actionId; void _roomId;
      if (!room.game || room.game.gameId !== gameId) throw new RoomError('STALE_GAME', 'Ván đã thay đổi. Hãy chờ bàn chơi cập nhật.');
      const before = room.game;
      const beforeActorCount = before.players.find((player) => player.id === seat.id)?.hand.length ?? 0;
      const playedCard = intent.type === 'play' ? before.players.find((player) => player.id === seat.id)?.hand.find((card) => card.id === intent.cardId) : undefined;
      const beforeDirection = before.direction;
      roomService.gameAction(room, seat, expectedRevision, intent);
      const after = room.game!;
      let targetId: string | undefined;
      let drawnCount: number | undefined;
      if (intent.type === 'play' && playedCard?.type === 'skip') {
        const index = before.players.findIndex((player) => player.id === seat.id);
        targetId = before.players[(index + beforeDirection + before.players.length) % before.players.length]?.id;
      } else if (intent.type === 'play' && playedCard?.type === 'reverse' && before.players.length === 2) {
        targetId = before.players.find((player) => player.id !== seat.id)?.id;
      } else if (intent.type === 'play' && (playedCard?.type === 'drawTwo' || playedCard?.type === 'wildDrawFour')) targetId = after.currentPlayerId;
      else if (intent.type === 'acceptPenalty') { targetId = seat.id; drawnCount = Math.max(0, (after.players.find((player) => player.id === seat.id)?.hand.length ?? beforeActorCount) - beforeActorCount); }
      else if (intent.type === 'draw') { targetId = seat.id; drawnCount = Math.max(0, (after.players.find((player) => player.id === seat.id)?.hand.length ?? beforeActorCount) - beforeActorCount); }
      else if (intent.type === 'catchUno') {
        targetId = intent.targetPlayerId;
        const beforeTargetCount = before.players.find((player) => player.id === targetId)?.hand.length ?? 0;
        drawnCount = Math.max(0, (after.players.find((player) => player.id === targetId)?.hand.length ?? beforeTargetCount) - beforeTargetCount);
      }
      const effect = {
        eventId: `${after.gameId}:${after.revision}`, roomId: room.id, gameId: after.gameId,
        revision: room.revision, gameRevision: after.revision, actionType: intent.type, actorId: seat.id,
        ...(targetId ? { targetId } : {}),
        ...(playedCard ? { card: { type: playedCard.type, color: playedCard.color, ...(playedCard.value !== undefined ? { value: playedCard.value } : {}) } } : {}),
        ...(after.currentColor ? { currentColor: after.currentColor } : {}), direction: after.direction,
        ...(after.pendingPenalty ? { penaltyTotal: after.pendingPenalty.total } : {}),
        ...(drawnCount !== undefined ? { drawnCount } : {}), ...(after.winnerId ? { winnerId: after.winnerId } : {}),
      };
      return { gameEffect: effect };
    }));
    socket.on('noitu:action', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, noituActionSchema, ack, (room, seat, value) => {
      if (room.gameKey !== 'noitu' || !room.noituGame || room.noituGame.gameId !== value.gameId) throw new RoomError('STALE_GAME', 'Ván đã thay đổi. Hãy chờ bàn chơi cập nhật.');
      roomService.noituAction(room, seat, value.expectedRevision, value);
    }));
    socket.on('caro:action', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, caroActionSchema, ack, (room, seat, value) => {
      if (room.gameKey !== 'caro' || !room.caroGame || room.caroGame.gameId !== value.gameId) throw new RoomError('STALE_GAME', 'Ván đã thay đổi. Hãy chờ bàn chơi cập nhật.');
      roomService.caroAction(room, seat, value.expectedRevision, value);
    }));
    socket.on('bantau:placement', (raw: unknown, ack: Ack = () => {}) => privateBantauCommand(socket, raw, bantauPlacementSchema, ack, (room, seat, value) => {
      if (room.gameKey !== 'bantau') throw new RoomError('WRONG_GAME', 'Lệnh xếp tàu chỉ dùng trong phòng Bắn tàu.');
      const { actionId: _actionId, roomId: _roomId, gameId, setupId, expectedFleetRevision, ...intent } = value;
      void _actionId; void _roomId;
      const snapshot = roomService.bantauPlacement(room, seat, gameId, setupId, expectedFleetRevision, intent);
      return { snapshot };
    }));
    socket.on('bantau:aim', (raw: unknown, ack: Ack = () => {}) => privateBantauCommand(socket, raw, bantauAimSchema, ack, (room, seat, value) => {
      if (room.gameKey !== 'bantau') throw new RoomError('WRONG_GAME', 'Lệnh nhắm chỉ dùng trong phòng Bắn tàu.');
      const { actionId: _actionId, roomId: _roomId, gameId, turnId, sequence, cell } = value;
      void _actionId; void _roomId;
      const aim = roomService.bantauAim(room, seat, gameId, turnId, sequence, cell);
      return { aim };
    }));
    socket.on('bantau:action', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, bantauActionSchema, ack, (room, seat, value) => {
      if (room.gameKey !== 'bantau') throw new RoomError('WRONG_GAME', 'Lệnh này chỉ dùng trong phòng Bắn tàu.');
      const { actionId: _actionId, roomId: _roomId, expectedRevision, ...action } = value;
      void _actionId; void _roomId;
      const effect = roomService.bantauAction(room, seat, expectedRevision, action);
      return effect ? { bantauEffect: effect } : undefined;
    }));
    socket.on('cotuong:action', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, cotuongActionSchema, ack, (room, seat, value) => {
      if (room.gameKey !== 'cotuong' || !room.cotuongGame || room.cotuongGame.gameId !== value.gameId) throw new RoomError('STALE_GAME', 'Ván Cờ tướng đã thay đổi. Hãy đồng bộ bàn cờ.');
      roomService.cotuongAction(room, seat, value.expectedRevision, value);
    }));
    socket.on('cotuong:local:create', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      if (socket.data.activeSession) return ack({ ok: false, code: 'ACTIVE_ROOM', message: 'Hãy rời phòng online trước khi mở ván cùng máy.' });
      if (socket.data.activeLocalCotuong) return ack({ ok: false, code: 'ACTIVE_LOCAL_GAME', message: 'Bạn đang có một ván cùng máy. Hãy thoát ván đó trước.' });
      const parsed = cotuongLocalCreateSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Thông tin ván cùng máy chưa hợp lệ.' });
      idempotentRequest(socket, parsed.data.actionId, parsed.data, ack, () => {
        const result = localCotuong.create(parsed.data, socket.id);
        socket.data.activeLocalCotuong = result.credentials.localSessionId;
        return { ok: true, credentials: result.credentials, game: result.game, avatars: result.avatars };
      });
    });
    socket.on('cotuong:local:resume', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      if (socket.data.activeSession) return ack({ ok: false, code: 'ACTIVE_ROOM', message: 'Hãy rời phòng online trước khi nối lại ván cùng máy.' });
      const parsed = cotuongLocalResumeSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Thông tin nối lại ván cùng máy chưa hợp lệ.' });
      if (socket.data.activeLocalCotuong && socket.data.activeLocalCotuong !== parsed.data.localSessionId) return ack({ ok: false, code: 'ACTIVE_LOCAL_GAME', message: 'Bạn đang điều khiển một ván cùng máy khác. Hãy thoát ván đó trước.' });
      try {
        const result = localCotuong.resume(parsed.data.localSessionId, parsed.data.token, socket.id);
        socket.data.activeLocalCotuong = parsed.data.localSessionId;
        ack({ ok: true, game: result.game, avatars: result.avatars });
      } catch (error) { ack(failure(error)); }
    });
    socket.on('cotuong:local:action', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      const parsed = cotuongLocalActionSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Nước đi Cờ tướng chưa hợp lệ.' });
      if (socket.data.activeLocalCotuong !== parsed.data.localSessionId) return ack({ ok: false, code: 'LOCAL_SESSION_REPLACED', message: 'Phiên này không còn quyền điều khiển ván cùng máy.' });
      idempotentRequest(socket, parsed.data.actionId, parsed.data, ack, () => {
        const result = localCotuong.action(parsed.data, socket.id);
        return { ok: true, actionId: parsed.data.actionId, game: result.game, avatars: result.avatars };
      });
    });
    socket.on('cotuong:local:new-game', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      const parsed = cotuongLocalNewGameSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Yêu cầu chơi lại chưa hợp lệ.' });
      if (socket.data.activeLocalCotuong !== parsed.data.localSessionId) return ack({ ok: false, code: 'LOCAL_SESSION_REPLACED', message: 'Phiên này không còn quyền điều khiển ván cùng máy.' });
      idempotentRequest(socket, parsed.data.actionId, parsed.data, ack, () => {
        const result = localCotuong.newGame(parsed.data.localSessionId, parsed.data.token, socket.id, parsed.data.expectedRevision, parsed.data.redPlayerStarts);
        return { ok: true, actionId: parsed.data.actionId, game: result.game, avatars: result.avatars };
      });
    });
    socket.on('cotuong:local:leave', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      const parsed = cotuongLocalResumeSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Yêu cầu đóng ván chưa hợp lệ.' });
      try { localCotuong.leave(parsed.data.localSessionId, parsed.data.token, socket.id); delete socket.data.activeLocalCotuong; ack({ ok: true }); }
      catch (error) { ack(failure(error)); }
    });
    socket.on('noitu:draft', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      const parsed = noituDraftSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Bản đang nhập chưa hợp lệ.' });
      try {
        const { room, seat } = current(socket, parsed.data.roomId);
        roomService.updateNoituDraft(room, seat, parsed.data);
        ack({ ok: true, sequence: parsed.data.sequence });
      } catch (error) { ack(failure(error)); }
    });
    socket.on('room:leave', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      const parsed = roomCommandSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Dữ liệu rời phòng chưa hợp lệ.' });
      try {
        const { room, seat } = current(socket, parsed.data.roomId);
        const roomId = room.id;
        roomService.leave(room, seat); delete socket.data.activeSession; void socket.leave('room:' + roomId);
        broadcast(roomId); ack({ ok: true, actionId: parsed.data.actionId });
      } catch (error) { ack(failure(error)); }
    });
    socket.on('disconnect', () => {
      eventLimits.delete(socket.id);
      if (socket.data.activeLocalCotuong) localCotuong.disconnect(socket.data.activeLocalCotuong, socket.id);
      const session = socket.data.activeSession;
      if (!session) return;
      bantauActionLimits.delete(session.playerId);
      roomService.disconnect(session.roomId, session.playerId, socket.id);
      broadcast(session.roomId);
    });
    const count = limits.get(socket.handshake.address) ?? { start: Date.now(), count: 0 };
    if (Date.now() - count.start > 10_000) { count.start = Date.now(); count.count = 0; }
    count.count++; limits.set(socket.handshake.address, count);
    if (count.count > 60) socket.disconnect(true);
  });

  if (options.serveWeb !== false) {
    const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
    if (existsSync(dist)) {
      const staticFiles = sirv(dist, { single: true, etag: true, maxAge: 0 });
      http.on('request', (req, res) => {
        const pathname = new URL(req.url ?? '/', 'http://local').pathname;
        if (pathname === '/health' || pathname.startsWith('/socket.io') || pathname.startsWith('/api/')) return;
        staticFiles(req, res, () => { res.statusCode = 404; res.end('Không tìm thấy trang.'); });
      });
    }
  }
  http.on('request', (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://local').pathname;
    if (pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ ok: true })); return; }
    if (pathname.startsWith('/api/')) {
      const origin = req.headers.origin;
      res.setHeader('Vary', 'Origin');
      if (origin && !originAllowed(origin, req.headers.host, requestProtocol(req))) {
        res.writeHead(403, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ ok: false, code: 'ORIGIN_NOT_ALLOWED', message: 'Nguồn truy cập này chưa được cho phép.' }));
        return;
      }
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      if (req.method === 'OPTIONS') {
        if (pathname !== '/api/rooms' && pathname !== '/api/games') {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ ok: false, message: 'Không tìm thấy API.' })); return;
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
        res.writeHead(204); res.end(); return;
      }
      if (req.method !== 'GET') {
        res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'Allow': 'GET, OPTIONS' });
        res.end(JSON.stringify({ ok: false, message: 'API này chỉ hỗ trợ GET.' })); return;
      }
    }
    if (pathname === '/api/rooms' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(roomService.publicRooms())); return;
    }
    if (pathname === '/api/games' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(Object.values(GAME_CATALOG).map((game) => ({ ...game, available: roomService.gameAvailable(game.key), settingsDefaults: DEFAULT_GAME_SETTINGS[game.key], options: { turnSeconds: game.key === 'cotuong' ? [] : [15, 30, 45, 60], targetScorePresets: [10, 30, 50, 100], targetScoreMin: 10, targetScoreMax: 500, targetScoreStep: 10, ...(game.key === 'uno' ? { stacking: [true, false] } : {}), ...(game.key === 'caro' ? { boardSizes: [9, 15, 19], winLengths: [4, 5, 6] } : {}), ...(game.key === 'bantau' ? { boardSizes: [8, 10, 12], shipCounts: [3, 4, 5], hitContinues: [true, false], allowTouch: [true, false] } : {}), ...(game.key === 'cotuong' ? { baseMinutes: [5, 10, 15], incrementSeconds: [0, 3, 5], redSides: ['random', 'host-red'] } : {}) } })))); return;
    }
    if (pathname.startsWith('/api/')) { res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify({ ok: false, message: 'Không tìm thấy API.' })); }
  });
  return { http, io, rooms: roomService, localCotuong };
}

if (process.env.NODE_ENV !== 'test') {
  const app = createRealtimeServer();
  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? 3001);
  app.http.listen(port, host, () => console.log('Hội Quậy server đang chạy tại http://' + host + ':' + port));
  const close = () => { app.rooms.destroyAll(); app.localCotuong.destroyAll(); app.io.close(); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
}

