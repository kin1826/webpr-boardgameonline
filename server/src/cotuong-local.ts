import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  applyCotuongAction, createCotuongGame, expireCotuongDeadline, pauseCotuongGame, projectCotuongGame, resumeCotuongGame,
  type CotuongIntent, type CotuongPublicGame, type CotuongState, type CotuongSide,
} from '@banban/cotuong';
import type { CotuongLocalActionPayload, CotuongLocalCreatePayload } from '@banban/shared';

export class CotuongLocalError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'CotuongLocalError'; }
}

type LocalSession = {
  id: string; tokenHash: string; state: CotuongState; avatars: { red: number; black: number };
  socketId: string | null; graceTimer?: ReturnType<typeof setTimeout>; gameTimer?: ReturnType<typeof setTimeout>; lastActivity: number;
};
type Clock = { now?: () => number; randomInt?: (max: number) => number; onRevoke?: (socketId: string) => void; onChanged?: (sessionId: string) => void };
const GRACE_MS = Number(process.env.RECONNECT_GRACE_MS || 90_000);
const IDLE_TTL_MS = 30 * 60_000;
const MAX_LOCAL_SESSIONS = 500;

export class CotuongLocalService {
  private sessions = new Map<string, LocalSession>();
  private cleanupTimer: ReturnType<typeof setInterval>;
  constructor(private options: Clock = {}) {
    this.cleanupTimer = setInterval(() => this.cleanup(), 30_000);
    this.cleanupTimer.unref?.();
  }
  private now() { return (this.options.now ?? Date.now)(); }
  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private requireSession(id: string, token: string, socketId?: string): LocalSession {
    const session = this.sessions.get(id);
    if (!session) throw new CotuongLocalError('LOCAL_SESSION_EXPIRED', 'Ván cùng máy không còn trong bộ nhớ. Hãy tạo ván mới.');
    const candidate = Buffer.from(this.hash(token)); const expected = Buffer.from(session.tokenHash);
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) throw new CotuongLocalError('LOCAL_SESSION_INVALID', 'Mã nối lại ván cùng máy không hợp lệ.');
    if (socketId && session.socketId !== socketId) throw new CotuongLocalError('LOCAL_SESSION_REPLACED', 'Phiên này đã được mở ở kết nối khác.');
    return session;
  }
  private project(session: LocalSession): CotuongPublicGame {
    const viewer = session.state.players.find((player) => player.side === session.state.currentSide) ?? session.state.players[0]!;
    const projection = projectCotuongGame(session.state, viewer.id, this.now(), false);
    // A local session owns both sides, so it must be able to answer the opponent's draw offer.
    if (session.state.drawOffer && session.state.phase === 'turn') projection.capabilities.canRespondDraw = true;
    return projection;
  }
  create(payload: CotuongLocalCreatePayload, socketId: string) {
    if (this.sessions.size >= MAX_LOCAL_SESSIONS) throw new CotuongLocalError('LOCAL_CAPACITY', 'Máy chủ đang có nhiều ván cùng máy. Hãy thử lại sau.');
    const id = randomUUID(); const token = randomBytes(32).toString('base64url'); const redId = `local:${id}:red`; const blackId = `local:${id}:black`;
    const state = createCotuongGame({
      gameId: randomUUID(), players: [{ id: redId, nickname: payload.redNickname.normalize('NFC') }, { id: blackId, nickname: payload.blackNickname.normalize('NFC') }],
      redPlayerId: redId, randomInt: this.options.randomInt ?? ((max) => Math.floor(Math.random() * max)), now: this.now(),
      clock: payload.clock ? { initialMs: payload.clock.baseMinutes * 60_000, incrementMs: payload.clock.incrementSeconds * 1000 } : null,
    });
    const session: LocalSession = { id, tokenHash: this.hash(token), state, avatars: { red: payload.redAvatarId, black: payload.blackAvatarId }, socketId, lastActivity: this.now() };
    this.sessions.set(id, session);
    this.schedule(session);
    return { credentials: { localSessionId: id, token }, game: this.project(session), avatars: session.avatars };
  }
  resume(id: string, token: string, socketId: string) {
    const session = this.requireSession(id, token);
    if (session.graceTimer) { clearTimeout(session.graceTimer); session.graceTimer = undefined; }
    if (session.socketId && session.socketId !== socketId) this.options.onRevoke?.(session.socketId);
    session.socketId = socketId; session.state = resumeCotuongGame(session.state, this.now()); session.lastActivity = this.now();
    this.schedule(session);
    this.options.onChanged?.(id);
    return { game: this.project(session), avatars: session.avatars };
  }
  action(payload: CotuongLocalActionPayload, socketId: string) {
    const session = this.requireSession(payload.localSessionId, payload.token, socketId);
    if (session.state.phase !== 'turn') throw new CotuongLocalError('GAME_FINISHED', 'Ván cờ đã kết thúc.');
    if (payload.gameId !== session.state.gameId) throw new CotuongLocalError('STALE_GAME', 'Ván cờ đã đổi. Hãy cập nhật bàn cờ.');
    if (payload.expectedRevision !== session.state.revision) throw new CotuongLocalError('STALE_REVISION', 'Bàn cờ vừa thay đổi. Hãy thử lại.');
    let actingSide: CotuongSide;
    let intent: CotuongIntent;
    switch (payload.type) {
      case 'move': actingSide = session.state.currentSide; intent = { type: payload.type, turnId: payload.turnId, from: payload.from, to: payload.to }; break;
      case 'offerDraw':
        if (payload.actingSide !== session.state.currentSide) throw new CotuongLocalError('NOT_YOUR_TURN', 'Chỉ bên đang tới lượt mới được đề nghị hòa.');
        actingSide = payload.actingSide; intent = { type: payload.type, turnId: payload.turnId }; break;
      case 'respondDraw': {
        const responder = session.state.drawOffer?.offeredBy === 'red' ? 'black' : 'red';
        if (!session.state.drawOffer || payload.actingSide !== responder) throw new CotuongLocalError('NO_DRAW_OFFER', 'Không có lời đề nghị hòa dành cho bên này.');
        actingSide = payload.actingSide; intent = { type: payload.type, offerId: payload.offerId, accept: payload.accept }; break;
      }
      case 'resign':
        if (payload.actingSide !== session.state.currentSide) throw new CotuongLocalError('NOT_YOUR_TURN', 'Chỉ bên đang tới lượt mới được xin thua.');
        actingSide = payload.actingSide; intent = { type: payload.type }; break;
    }
    const playerId = session.state.players.find((player) => player.side === actingSide)!.id;
    try { session.state = applyCotuongAction(session.state, playerId, intent, this.now()); }
    catch (error) { if (error instanceof Error && 'code' in error) throw new CotuongLocalError(String((error as Error & { code?: string }).code ?? 'INVALID_ACTION'), error.message); throw error; }
    session.lastActivity = this.now(); this.options.onChanged?.(session.id);
    this.schedule(session);
    return { game: this.project(session), avatars: session.avatars };
  }
  newGame(id: string, token: string, socketId: string, expectedRevision: number, redPlayerStarts?: boolean) {
    const session = this.requireSession(id, token, socketId);
    if (session.state.revision !== expectedRevision) throw new CotuongLocalError('STALE_REVISION', 'Bàn cờ vừa thay đổi. Hãy cập nhật rồi thử lại.');
    if (session.state.phase !== 'finished') throw new CotuongLocalError('GAME_NOT_FINISHED', 'Chỉ có thể mở ván mới sau khi ván hiện tại kết thúc.');
    const oldRedId = session.state.players.find((player) => player.side === 'red')!.id;
    const oldBlackId = session.state.players.find((player) => player.side === 'black')!.id;
    const redPlayerId = redPlayerStarts === undefined ? oldBlackId : redPlayerStarts ? oldRedId : oldBlackId;
    const clock = session.state.clock ? { initialMs: session.state.clock.initialMs, incrementMs: session.state.clock.incrementMs } : null;
    session.state = createCotuongGame({ gameId: randomUUID(), players: session.state.players.map(({ id: playerId, nickname }) => ({ id: playerId, nickname })), redPlayerId, randomInt: this.options.randomInt ?? ((max) => Math.floor(Math.random() * max)), now: this.now(), clock });
    session.lastActivity = this.now(); this.options.onChanged?.(id);
    this.schedule(session);
    return { game: this.project(session), avatars: session.avatars };
  }
  disconnect(id: string, socketId: string) {
    const session = this.sessions.get(id);
    if (!session || session.socketId !== socketId) return;
    session.state = pauseCotuongGame(session.state, this.now()); session.socketId = null; this.clearGameTimer(session); this.options.onChanged?.(id);
    session.graceTimer = setTimeout(() => { if (this.sessions.get(id)?.socketId === null) this.remove(id); }, GRACE_MS);
    session.graceTimer.unref?.();
  }
  leave(id: string, token: string, socketId: string) { const session = this.requireSession(id, token, socketId); this.remove(session.id); }
  snapshot(id: string) { const session = this.sessions.get(id); return session ? { game: this.project(session), avatars: session.avatars } : null; }
  destroyAll() { clearInterval(this.cleanupTimer); for (const id of this.sessions.keys()) this.remove(id); }
  private remove(id: string) { const session = this.sessions.get(id); if (session?.graceTimer) clearTimeout(session.graceTimer); if (session) this.clearGameTimer(session); this.sessions.delete(id); }
  private cleanup() { const now = this.now(); for (const [id, session] of this.sessions) if (now - session.lastActivity >= IDLE_TTL_MS) this.remove(id); }
  private clearGameTimer(session: LocalSession) { if (session.gameTimer) clearTimeout(session.gameTimer); session.gameTimer = undefined; }
  private schedule(session: LocalSession) {
    this.clearGameTimer(session);
    const deadline = session.state.clock?.deadlineAt;
    if (!deadline || session.state.phase !== 'turn' || session.socketId === null) return;
    session.gameTimer = setTimeout(() => {
      const live = this.sessions.get(session.id);
      if (!live || live.socketId === null || live.state.clock?.deadlineAt !== deadline || this.now() < deadline) return;
      const next = expireCotuongDeadline(live.state, this.now());
      if (!next) return;
      live.state = next; live.gameTimer = undefined; this.options.onChanged?.(live.id);
    }, Math.max(0, deadline - this.now()));
    session.gameTimer.unref?.();
  }
}
