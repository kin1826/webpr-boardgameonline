import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { NoituDictionary } from '@banban/noitu';
import { createRealtimeServer } from './index.ts';
import { RoomService } from './rooms.ts';

type SocketReply = { ok: boolean; code?: string; message?: string; snapshot?: any; credentials?: { roomId: string; roomCode: string; playerId: string; token: string } };
function emitAck(socket: Socket, event: string, payload: unknown): Promise<SocketReply> {
  return new Promise((resolve, reject) => socket.timeout(3000).emit(event, payload, (error: Error | null, reply: SocketReply) => error ? reject(error) : resolve(reply)));
}
function roomAction(roomId: string, expectedRevision: number, extra: Record<string, unknown> = {}) {
  return { actionId: crypto.randomUUID(), roomId, expectedRevision, ...extra };
}

describe('HTTP API origin policy', () => {
  let app: ReturnType<typeof createRealtimeServer> | undefined;
  let sockets: Socket[] = [];
  let baseUrl = '';
  let previousOrigins: string | undefined;

  beforeEach(async () => {
    previousOrigins = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'https://game.example.com';
    const knownWords = new Set(['nấu cơm', 'cơm nước']);
    const dictionary: NoituDictionary = { version: 'cors-fixture', has: (word) => knownWords.has(word), isDenied: () => false };
    app = createRealtimeServer({ serveWeb: false, roomService: new RoomService({ noitu: { dictionary, seedWords: ['nấu cơm'] } }) });
    await new Promise<void>((resolve) => app!.http.listen(0, '127.0.0.1', resolve));
    const address = app.http.address();
    if (!address || typeof address === 'string') throw new Error('Không lấy được cổng HTTP API.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const socket of sockets) socket.disconnect();
    sockets = [];
    if (previousOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previousOrigins;
    if (app) {
      const closing = app;
      app = undefined;
      closing.rooms.destroyAll();
      await new Promise<void>((resolve) => closing.io.close(() => resolve()));
    }
  });

  it('cho phép origin đã khai báo đọc API và trả Vary: Origin', async () => {
    const response = await fetch(`${baseUrl}/api/games`, { headers: { Origin: 'https://game.example.com' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://game.example.com');
    expect(response.headers.get('vary')).toContain('Origin');
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
    expect(await response.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'uno', available: true }),
      expect.objectContaining({ key: 'noitu', available: true }),
      expect.objectContaining({ key: 'caro', available: true, minPlayers: 2, maxPlayers: 2 }),
    ]));
  });

  it('từ chối origin không nằm trong allowlist', async () => {
    const response = await fetch(`${baseUrl}/api/rooms`, { headers: { Origin: 'https://attacker.example' } });
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('trả preflight giới hạn vào GET và OPTIONS cho endpoint đọc', async () => {
    const response = await fetch(`${baseUrl}/api/rooms`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://game.example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://game.example.com');
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
  });

  it('vẫn cho phép gọi same-origin mà không cần cấu hình thêm', async () => {
    const response = await fetch(`${baseUrl}/api/rooms`, { headers: { Origin: baseUrl } });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(baseUrl);
  });

  it('cho phép hai phiên độc lập gọi HTTP và chơi UNO/Nối từ qua origin frontend đã khai báo', async () => {
    const frontendOrigin = 'https://game.example.com';
    const openPair = async () => {
      const pair = Array.from({ length: 2 }, () => connect(baseUrl, {
        forceNew: true,
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: { Origin: frontendOrigin },
      }));
      sockets.push(...pair);
      await Promise.all(pair.map((socket) => new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      })));
      return pair as [Socket, Socket];
    };
    const waitForRevision = (socket: Socket, current: () => any, revision: number) => {
      if (current()?.revision >= revision) return Promise.resolve(current());
      return new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => { socket.off('room:snapshot', onSnapshot); reject(new Error('Snapshot từ origin frontend đến chậm.')); }, 3000);
        const onSnapshot = (snapshot: any) => {
          if (snapshot.revision < revision) return;
          clearTimeout(timeout); socket.off('room:snapshot', onSnapshot); resolve(snapshot);
        };
        socket.on('room:snapshot', onSnapshot);
      });
    };

    const apiResponse = await fetch(`${baseUrl}/api/games`, { headers: { Origin: frontendOrigin } });
    expect(apiResponse.headers.get('access-control-allow-origin')).toBe(frontendOrigin);

    const playUno = async () => {
      const [host, guest] = await openPair();
      let guestSnapshot: any;
      guest.on('room:snapshot', (snapshot) => { guestSnapshot = snapshot; });
      const created = await emitAck(host, 'room:create', { actionId: crypto.randomUUID(), nickname: 'Chủ UNO', visibility: 'private' });
      expect(created.ok).toBe(true);
      const credentials = created.credentials!;
      const joined = await emitAck(guest, 'room:join', { actionId: crypto.randomUUID(), code: credentials.roomCode, nickname: 'Khách UNO' });
      expect(joined.ok).toBe(true);
      const ready = await emitAck(guest, 'room:ready', roomAction(credentials.roomId, joined.snapshot!.revision, { ready: true }));
      const started = await emitAck(host, 'room:start', roomAction(credentials.roomId, ready.snapshot!.revision));
      expect(started.ok).toBe(true);
      const game = started.snapshot!.game;
      const actor = game.currentPlayerId === credentials.playerId ? host : guest;
      const actorView = game.currentPlayerId === credentials.playerId ? started.snapshot : await waitForRevision(guest, () => guestSnapshot, started.snapshot!.revision);
      const card = actorView.game.hand[0];
      const played = await emitAck(actor, 'game:action', roomAction(credentials.roomId, started.snapshot!.revision, {
        gameId: game.gameId, type: 'play', cardId: card.id, ...(card.color === 'wild' ? { color: 'red' } : {}),
      }));
      expect(played.ok).toBe(true);
      expect(played.snapshot!.game.topCard).toMatchObject({ id: card.id });
    };

    const playNoitu = async () => {
      const [host, guest] = await openPair();
      let guestSnapshot: any;
      guest.on('room:snapshot', (snapshot) => { guestSnapshot = snapshot; });
      const created = await emitAck(host, 'room:create', { actionId: crypto.randomUUID(), nickname: 'Chủ từ', visibility: 'private', gameKey: 'noitu' });
      expect(created.ok).toBe(true);
      const credentials = created.credentials!;
      const joined = await emitAck(guest, 'room:join', { actionId: crypto.randomUUID(), code: credentials.roomCode, nickname: 'Khách từ' });
      const ready = await emitAck(guest, 'room:ready', roomAction(credentials.roomId, joined.snapshot!.revision, { ready: true }));
      const started = await emitAck(host, 'room:start', roomAction(credentials.roomId, ready.snapshot!.revision));
      expect(started.ok).toBe(true);
      const game = started.snapshot!.game;
      const actor = game.currentPlayerId === credentials.playerId ? host : guest;
      const actorView = game.currentPlayerId === credentials.playerId ? started.snapshot : await waitForRevision(guest, () => guestSnapshot, started.snapshot!.revision);
      const submitted = await emitAck(actor, 'noitu:action', roomAction(credentials.roomId, started.snapshot!.revision, {
        gameId: game.gameId, turnId: game.turnId, type: 'submit', suffix: 'nước',
      }));
      expect(submitted.ok).toBe(true);
      expect(submitted.snapshot!.game.currentWord).toBe('cơm nước');
      expect(actorView.game.currentWord).toBe('nấu cơm');
    };

    await playUno();
    await playNoitu();
  });
});
