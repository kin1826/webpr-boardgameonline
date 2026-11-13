import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server as SocketServer, type Socket } from 'socket.io';
import sirv from 'sirv';
import {
  GAME_CATALOG, gameActionSchema, gameEffectSchema, kickSchema, noituActionSchema, noituDraftSchema, readySchema, resumeSchema, roomCommandSchema,
  roomCreateSchema, roomJoinSchema, visibilitySchema,
} from '@banban/shared';
import { loadNoituDictionary, type RuntimeNoituDictionary } from './noitu-dictionary.ts';
import { RoomError, RoomService } from './rooms.ts';

type Ack = (value: Record<string, unknown>) => void;
type ActiveSession = { roomId: string; playerId: string; generation: number };
type ClientSocket = Socket & { data: Socket['data'] & { activeSession?: ActiveSession } };
type Cached = { fingerprint: string; response: Record<string, unknown>; expiresAt: number };

export function createRealtimeServer(options: { serveWeb?: boolean; roomService?: RoomService; maxEventsPerWindow?: number; noitu?: RuntimeNoituDictionary | null } = {}) {
  let io: SocketServer;
  const http = createServer();
  let noitu = options.noitu;
  if (noitu === undefined) {
    try { noitu = loadNoituDictionary(); }
    catch { noitu = null; }
  }
  const roomService = options.roomService ?? new RoomService({ noitu });
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

  function failure(error: unknown) {
    if (error instanceof RoomError) return { ok: false, code: error.code, message: error.message };
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
      const result = operation(room, seat, payload) as { gameEffect?: unknown } | undefined;
      const response = { ok: true, actionId: payload.actionId, snapshot: roomService.snapshot(room, seat.id) };
      broadcast(room.id);
      if (result?.gameEffect) {
        const parsedEffect = gameEffectSchema.safeParse(result.gameEffect);
        if (parsedEffect.success) for (const member of room.players.values()) {
          if (!member.online || !member.socketId) continue;
          io.sockets.sockets.get(member.socketId)?.emit('game:effect', parsedEffect.data);
        }
      }
      cacheResult(actionCache, key, fingerprint, response, ack);
    } catch (error) { ack(failure(error)); }
  }

  function originAllowed(origin: string | undefined, host?: string, protocol = 'http') {
    if (!origin) return true;
    try {
      const parsed = new URL(origin);
      const allowed = process.env.ALLOWED_ORIGINS?.split(',').map((x) => x.trim()).filter(Boolean) ?? [];
      const localDev = (parsed.port === '5173' || parsed.port === '4173') && (
        parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' ||
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname)
      );
      const sameHost = Boolean(host && parsed.host.toLowerCase() === host.toLowerCase());
      const sameProtocol = parsed.protocol === `${protocol.replace(':', '')}:`;
      return allowed.includes(origin) || localDev || (sameHost && sameProtocol);
    } catch { return false; }
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
      const forwarded = req.headers['x-forwarded-proto'];
      const protocol = typeof forwarded === 'string' ? forwarded.split(',')[0]!.trim() : (req.socket as typeof req.socket & { encrypted?: boolean }).encrypted ? 'https' : 'http';
      callback(null, originAllowed(req.headers.origin, req.headers.host, protocol));
    },
    maxHttpBufferSize: 16 * 1024,
    connectionStateRecovery: { maxDisconnectionDuration: 0, skipMiddlewares: false },
  });

  io.on('connection', (baseSocket) => {
    const socket = baseSocket as ClientSocket;
    socket.emit('server:status', { connected: true });
    socket.on('room:list', (ack?: Ack) => {
      if (ack && allowEvent(socket.id, ack)) ack({ ok: true, rooms: roomService.publicRooms() });
    });
    socket.on('room:create', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      const parsed = roomCreateSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Hãy nhập biệt danh và chọn chế độ phòng.' });
      const value = parsed.data;
      idempotentRequest(socket, value.actionId, value, ack, () => {
        const created = roomService.create(value.nickname, value.visibility, socket.id, value.gameKey);
        socket.data.activeSession = { roomId: created.room.id, playerId: created.seat.id, generation: created.seat.generation };
        void socket.join('room:' + created.room.id);
        return { ok: true, actionId: value.actionId, credentials: created.credentials, snapshot: roomService.snapshot(created.room, created.seat.id) };
      });
    });
    socket.on('room:join', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
      const parsed = roomJoinSchema.safeParse(raw);
      if (!parsed.success) return ack({ ok: false, code: 'INVALID_PAYLOAD', message: 'Mã phòng hoặc biệt danh chưa hợp lệ.' });
      const value = parsed.data;
      idempotentRequest(socket, value.actionId, value, ack, () => {
        const joined = roomService.join(value.code, value.nickname, socket.id);
        socket.data.activeSession = { roomId: joined.room.id, playerId: joined.seat.id, generation: joined.seat.generation };
        void socket.join('room:' + joined.room.id);
        broadcast(joined.room.id);
        return { ok: true, actionId: value.actionId, credentials: joined.credentials, snapshot: roomService.snapshot(joined.room, joined.seat.id) };
      });
    });
    socket.on('session:resume', (raw: unknown, ack: Ack = () => {}) => {
      if (!allowEvent(socket.id, ack)) return;
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
    socket.on('room:visibility', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, roomCommandSchema.extend({ visibility: visibilitySchema.shape.visibility }).strict(), ack, (room, seat, value) => roomService.setVisibility(room, seat, value.visibility)));
    socket.on('room:start', (raw: unknown, ack: Ack = () => {}) => command(socket, raw, roomCommandSchema, ack, (room, seat) => {
      roomService.start(room, seat);
      if (room.gameKey === 'noitu') return;
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
      const session = socket.data.activeSession;
      if (!session) return;
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
    if (pathname === '/api/rooms' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(roomService.publicRooms())); return;
    }
    if (pathname === '/api/games' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(Object.values(GAME_CATALOG).map((game) => ({ ...game, available: roomService.gameAvailable(game.key) })))); return;
    }
    if (pathname.startsWith('/api/')) { res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ ok: false, message: 'Không tìm thấy API.' })); }
  });
  return { http, io, rooms: roomService };
}

if (process.env.NODE_ENV !== 'test') {
  const app = createRealtimeServer();
  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? 3001);
  app.http.listen(port, host, () => console.log('Bàn Bạn server đang chạy tại http://' + host + ':' + port));
  const close = () => { app.rooms.destroyAll(); app.io.close(); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
}

