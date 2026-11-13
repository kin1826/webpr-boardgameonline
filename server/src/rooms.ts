import { createHash, randomBytes, randomInt as cryptoRandomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { GAME_CATALOG, type GameKey, type NoituActionPayload, type NoituDraftNotice, type NoituDraftPayload, type RoomPhase, type RoomSnapshot, type RoomVisibility, type SessionCredentials, type PublicRoomSummary, type RoomClosedPayload } from '@banban/shared';
import { applyGameAction, createGame, projectGame, type UnoState, type UnoIntent } from '@banban/uno';
import { applyNoituAction, createNoituGame, expireNoituDeadline, pauseNoituGame, projectNoituGame, resumeNoituGame, type NoituDictionary, type NoituIntent, type NoituState } from '@banban/noitu';

export class RoomError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'RoomError'; }
}
type Seat = {
  id: string; nickname: string; tokenHash: string; socketId: string | null; generation: number;
  online: boolean; ready: boolean; joinedAt: number; graceTimer?: ReturnType<typeof setTimeout>;
};
type Room = {
  id: string; code: string; gameKey: GameKey; visibility: RoomVisibility; phase: RoomPhase; revision: number;
  hostId: string; players: Map<string, Seat>; game: UnoState | null; noituGame: NoituState | null; notice: string | null;
  createdAt: number; lastActivity: number; pauseStartedAt: number | null; offlineTimers: Set<ReturnType<typeof setTimeout>>;
  noituTimer?: ReturnType<typeof setTimeout>; noituDraft: NoituDraftNotice | null;
  noituDraftTurnId: string | null; noituDraftSequence: number; noituDraftUpdatedAt: number;
};
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS || 90_000);
const WAITING_TTL_MS = Number(process.env.WAITING_ROOM_TTL_MS || 1_800_000);
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 2000);
const MAX_DRAFT_CODEPOINTS = 32;
const DRAFT_RATE_MS = 100;

type LifecycleHandlers = {
  onChanged?: (roomId: string) => void;
  onClosed?: (payload: RoomClosedPayload, socketIds: string[]) => void;
  onRevoke?: (socketId: string) => void;
  onNoituDraft?: (roomId: string, draft: NoituDraftNotice | null) => void;
};
type RoomServiceOptions = LifecycleHandlers & {
  randomInt?: (max: number) => number;
  now?: () => number;
  noitu?: { dictionary: NoituDictionary; seedWords: readonly string[] } | null;
};

export class RoomService {
  private rooms = new Map<string, Room>();
  private byCode = new Map<string, string>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private readonly options: RoomServiceOptions = {}) {
    this.cleanupTimer = setInterval(() => this.cleanup(), 30_000);
    this.cleanupTimer.unref?.();
  }
  setLifecycleHandlers(handlers: LifecycleHandlers) { Object.assign(this.options, handlers); }
  private random(max: number) { return (this.options.randomInt ?? cryptoRandomInt)(max); }
  private now() { return (this.options.now ?? Date.now)(); }
  private touch(room: Room) { room.lastActivity = this.now(); }
  private bump(room: Room) { room.revision++; this.touch(room); }
  private tokenDigest(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private makeCode(): string {
    for (let tries = 0; tries < 100; tries++) {
      let code = '';
      for (let i = 0; i < 6; i++) code += CODE_ALPHABET[this.random(CODE_ALPHABET.length)];
      if (!this.byCode.has(code)) return code;
    }
    throw new RoomError('ROOM_CAPACITY', 'Chưa thể tạo mã phòng, hãy thử lại.');
  }
  private makeSeat(nickname: string, socketId: string): { seat: Seat; token: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, seat: { id: randomUUID(), nickname, tokenHash: this.tokenDigest(token), socketId, generation: 1, online: true, ready: false, joinedAt: this.now() } };
  }
  create(nickname: string, visibility: RoomVisibility, socketId: string, gameKey: GameKey = 'uno'): { room: Room; seat: Seat; credentials: SessionCredentials } {
    if (this.rooms.size >= MAX_ROOMS) throw new RoomError('ROOM_CAPACITY', 'Máy chủ đang có quá nhiều phòng. Hãy thử lại sau.');
    const id = randomUUID(); const code = this.makeCode(); const { seat, token } = this.makeSeat(nickname, socketId);
    const room: Room = { id, code, gameKey, visibility, phase: 'waiting', revision: 0, hostId: seat.id, players: new Map([[seat.id, seat]]), game: null, noituGame: null, notice: null, createdAt: this.now(), lastActivity: this.now(), pauseStartedAt: null, offlineTimers: new Set(), noituDraft: null, noituDraftTurnId: null, noituDraftSequence: 0, noituDraftUpdatedAt: 0 };
    this.rooms.set(id, room); this.byCode.set(code, id);
    return { room, seat, credentials: { roomId: id, roomCode: code, playerId: seat.id, token } };
  }
  join(code: string, nickname: string, socketId: string): { room: Room; seat: Seat; credentials: SessionCredentials } {
    const roomId = this.byCode.get(code.toUpperCase()); const room = roomId ? this.rooms.get(roomId) : undefined;
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng với mã này.');
    if (room.phase !== 'waiting') throw new RoomError('ROOM_IN_PROGRESS', 'Ván đã bắt đầu; phòng không nhận người mới.');
    if (room.players.size >= GAME_CATALOG[room.gameKey].maxPlayers) throw new RoomError('ROOM_FULL', 'Phòng đã đủ 6 người.');
    const { seat, token } = this.makeSeat(nickname, socketId);
    for (const player of room.players.values()) player.ready = false;
    room.players.set(seat.id, seat); room.notice = null; this.bump(room);
    return { room, seat, credentials: { roomId: room.id, roomCode: room.code, playerId: seat.id, token } };
  }
  publicRooms(): PublicRoomSummary[] {
    return [...this.rooms.values()].filter((room) => room.visibility === 'public' && room.phase === 'waiting' && room.players.size < GAME_CATALOG[room.gameKey].maxPlayers)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 100)
      .map((room) => ({ code: room.code, gameKey: room.gameKey, visibility: 'public', hostName: room.players.get(room.hostId)?.nickname ?? 'Chủ phòng', playerCount: room.players.size, maxPlayers: GAME_CATALOG[room.gameKey].maxPlayers, phase: 'waiting' }));
  }
  gameAvailable(gameKey: GameKey) { return gameKey === 'uno' || Boolean(this.options.noitu); }
  getRoom(roomId: string) { const room = this.rooms.get(roomId); if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Phòng không còn tồn tại.'); return room; }
  getSeat(room: Room, playerId: string) { const seat = room.players.get(playerId); if (!seat) throw new RoomError('SESSION_REVOKED', 'Ghế của bạn không còn trong phòng.'); return seat; }
  verifySession(roomId: string, playerId: string, token: string) {
    const room = this.getRoom(roomId); const seat = this.getSeat(room, playerId);
    const candidate = Buffer.from(this.tokenDigest(token)); const stored = Buffer.from(seat.tokenHash);
    if (candidate.length !== stored.length || !timingSafeEqual(candidate, stored)) throw new RoomError('SESSION_INVALID', 'Phiên nối lại không hợp lệ.');
    return { room, seat };
  }
  resume(roomId: string, playerId: string, token: string, socketId: string) {
    const { room, seat } = this.verifySession(roomId, playerId, token);
    if (seat.graceTimer) { clearTimeout(seat.graceTimer); seat.graceTimer = undefined; }
    if (seat.socketId && seat.socketId !== socketId) this.options.onRevoke?.(seat.socketId);
    seat.socketId = socketId; seat.online = true; seat.generation++;
    if (room.phase === 'playing' && [...room.players.values()].every((player) => player.online) && room.pauseStartedAt !== null) {
      room.pauseStartedAt = null;
      if (room.noituGame) { room.noituGame = resumeNoituGame(room.noituGame, this.now()); this.scheduleNoituDeadline(room); }
      this.clearNoituDraft(room);
    }
    if (room.hostId === seat.id) this.transferHostIfNeeded(room);
    this.bump(room);
    return { room, seat, generation: seat.generation };
  }
  disconnect(roomId: string, playerId: string, socketId: string) {
    const room = this.rooms.get(roomId); const seat = room?.players.get(playerId);
    if (!room || !seat || seat.socketId !== socketId) return;
    if (room.phase === 'playing' && room.noituGame && room.pauseStartedAt === null) this.resolveNoituDeadline(room);
    seat.socketId = null; seat.online = false;
    if (room.phase === 'waiting') seat.ready = false;
    if (room.phase === 'playing' && room.pauseStartedAt === null) {
      room.pauseStartedAt = this.now();
      if (room.noituGame) { room.noituGame = pauseNoituGame(room.noituGame, this.now()); this.clearNoituDeadline(room); this.clearNoituDraft(room); }
    }
    this.bump(room);
    seat.graceTimer = setTimeout(() => {
      const current = this.rooms.get(roomId)?.players.get(playerId);
      if (current && !current.online) this.expireSeat(roomId, playerId);
    }, RECONNECT_GRACE_MS);
    seat.graceTimer.unref?.();
  }
  ready(room: Room, actor: Seat, value: boolean) {
    this.requirePhase(room, 'waiting');
    if (actor.id === room.hostId) throw new RoomError('HOST_READY_NOT_NEEDED', 'Chủ phòng xác nhận bằng nút Bắt đầu.');
    actor.ready = value; this.bump(room);
  }
  setVisibility(room: Room, actor: Seat, visibility: RoomVisibility) {
    this.requireHost(room, actor); this.requirePhase(room, 'waiting');
    room.visibility = visibility; this.bump(room);
  }
  start(room: Room, actor: Seat) {
    this.requireHost(room, actor); this.requirePhase(room, 'waiting');
    const seats = [...room.players.values()];
    if (seats.length < GAME_CATALOG[room.gameKey].minPlayers) throw new RoomError('NEED_TWO_PLAYERS', 'Cần ít nhất 2 người để bắt đầu.');
    if (seats.some((player) => !player.online)) throw new RoomError('PLAYER_OFFLINE', 'Chờ mọi người kết nối lại trước khi bắt đầu.');
    const missing = seats.find((player) => player.id !== room.hostId && !player.ready);
    if (missing) throw new RoomError('NOT_READY', 'Chờ ' + missing.nickname + ' sẵn sàng.');
    const gameId = randomUUID();
    if (room.gameKey === 'noitu') {
      if (!this.options.noitu) throw new RoomError('DICTIONARY_NOT_READY', 'Từ điển thử nghiệm chưa sẵn sàng. Nối từ chưa thể bắt đầu; UNO vẫn hoạt động.');
      try {
        room.noituGame = createNoituGame({ gameId, players: seats.map(({ id, nickname }) => ({ id, nickname })), dictionary: this.options.noitu.dictionary, seedWords: this.options.noitu.seedWords, randomInt: (max) => this.random(max), now: this.now() });
        room.game = null;
      } catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
    } else {
      room.noituGame = null;
      room.game = createGame({ gameId, players: seats.map(({ id, nickname }) => ({ id, nickname })), randomInt: (max) => this.random(max) });
    }
    room.phase = 'playing'; room.notice = null; room.pauseStartedAt = null; this.clearNoituDraft(room);
    if (room.noituGame) this.scheduleNoituDeadline(room);
    this.bump(room);
  }
  gameAction(room: Room, actor: Seat, expectedRevision: number, action: UnoIntent) {
    if (room.gameKey !== 'uno' || !room.game) throw new RoomError('WRONG_GAME', 'Hành động UNO không dùng được trong phòng này.');
    if (room.phase !== 'playing') throw new RoomError('NOT_PLAYING', 'Phòng hiện không có ván đang chơi.');
    if (room.pauseStartedAt !== null) throw new RoomError('GAME_PAUSED', 'Ván đang tạm dừng, chờ người chơi kết nối lại.');
    if (room.revision !== expectedRevision) throw new RoomError('STALE_REVISION', 'Trạng thái đã đổi. Bàn chơi đang được làm mới.');
    try { room.game = applyGameAction(room.game, actor.id, action, (max) => this.random(max)); }
    catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
    if (room.game.phase === 'finished') room.phase = 'finished';
    this.bump(room);
  }
  noituAction(room: Room, actor: Seat, expectedRevision: number, action: NoituActionPayload) {
    if (room.gameKey !== 'noitu' || !room.noituGame) throw new RoomError('WRONG_GAME', 'Hành động Nối từ không dùng được trong phòng này.');
    if (room.phase !== 'playing') throw new RoomError('NOT_PLAYING', 'Phòng hiện không có ván đang chơi.');
    if (room.pauseStartedAt !== null) throw new RoomError('GAME_PAUSED', 'Ván đang tạm dừng, chờ người chơi kết nối lại.');
    if (this.resolveNoituDeadline(room)) throw new RoomError('ACTION_EXPIRED', 'Thời gian đã hết. Bàn chơi đã chuyển lượt.');
    if (room.revision !== expectedRevision) throw new RoomError('STALE_REVISION', 'Trạng thái đã đổi. Bàn chơi đang được làm mới.');
    if (!this.options.noitu) throw new RoomError('DICTIONARY_NOT_READY', 'Từ điển thử nghiệm chưa sẵn sàng.');
    const { actionId: _actionId, roomId: _roomId, gameId: _gameId, expectedRevision: _revision, ...intent } = action;
    void _actionId; void _roomId; void _gameId; void _revision;
    try { room.noituGame = applyNoituAction(room.noituGame, actor.id, intent as NoituIntent, this.options.noitu.dictionary, this.now()); }
    catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
    if (room.noituGame.phase === 'finished') { room.phase = 'finished'; this.clearNoituDeadline(room); }
    else this.scheduleNoituDeadline(room);
    this.clearNoituDraft(room);
    this.bump(room);
  }
  updateNoituDraft(room: Room, actor: Seat, payload: NoituDraftPayload): NoituDraftNotice {
    if (room.gameKey !== 'noitu' || !room.noituGame) throw new RoomError('WRONG_GAME', 'Draft chỉ dùng trong phòng Nối từ.');
    if (room.phase !== 'playing' || room.pauseStartedAt !== null || room.noituGame.phase !== 'turn' || room.noituGame.currentPlayerId !== actor.id || room.noituGame.turnId !== payload.turnId || room.noituGame.gameId !== payload.gameId) throw new RoomError('STALE_TURN', 'Lượt đã thay đổi. Bàn chơi đang được cập nhật.');
    const now = this.now();
    if (room.noituGame.turnDeadlineAt === null || now >= room.noituGame.turnDeadlineAt) throw new RoomError('TURN_EXPIRED', 'Đã hết thời gian lượt.');
    if ([...payload.suffix].length > MAX_DRAFT_CODEPOINTS || /[\u0000-\u001f\u007f]/u.test(payload.suffix)) throw new RoomError('INVALID_DRAFT', 'Phần đang nhập quá dài hoặc chứa ký tự điều khiển.');
    if (room.noituDraftTurnId !== payload.turnId) { room.noituDraftTurnId = payload.turnId; room.noituDraftSequence = 0; room.noituDraftUpdatedAt = 0; }
    if (payload.sequence <= room.noituDraftSequence) throw new RoomError('STALE_DRAFT', 'Bản đang nhập cũ đã bị bỏ qua.');
    if (now - room.noituDraftUpdatedAt < DRAFT_RATE_MS) throw new RoomError('RATE_LIMITED', 'Đang cập nhật chữ quá nhanh.');
    room.noituDraftSequence = payload.sequence; room.noituDraftUpdatedAt = now;
    room.noituDraft = { ...payload, suffix: payload.suffix.normalize('NFC'), playerId: actor.id, nickname: actor.nickname, prefix: room.noituGame.requiredSyllable };
    this.options.onNoituDraft?.(room.id, room.noituDraft);
    return room.noituDraft;
  }
  getNoituDraft(room: Room) { return room.noituDraft; }
  rematch(room: Room, actor: Seat) {
    this.requireHost(room, actor); this.requirePhase(room, 'finished');
    this.clearNoituDeadline(room); this.clearNoituDraft(room);
    room.game = null; room.noituGame = null; room.phase = 'waiting'; room.notice = null; room.pauseStartedAt = null;
    for (const seat of room.players.values()) seat.ready = false;
    this.bump(room);
  }
  kick(room: Room, actor: Seat, targetId: string): { kicked: Seat; wasPlaying: boolean } {
    this.requireHost(room, actor);
    if (targetId === actor.id) throw new RoomError('CANNOT_KICK_SELF', 'Bạn không thể tự mời mình ra.');
    const target = this.getSeat(room, targetId); const wasPlaying = room.phase === 'playing';
    this.removeSeat(room, target);
    if (wasPlaying) { this.clearNoituDeadline(room); this.clearNoituDraft(room); room.phase = 'waiting'; room.game = null; room.noituGame = null; room.notice = 'Ván đã hủy vì chủ phòng mời ' + target.nickname + ' ra khỏi phòng.'; room.pauseStartedAt = null; }
    else room.notice = target.nickname + ' đã được mời ra khỏi phòng.';
    for (const seat of room.players.values()) seat.ready = false;
    this.transferHostIfNeeded(room); this.bump(room);
    return { kicked: target, wasPlaying };
  }
  leave(room: Room, actor: Seat) {
    const wasPlaying = room.phase === 'playing';
    this.removeSeat(room, actor, false);
    if (wasPlaying) { this.clearNoituDeadline(room); this.clearNoituDraft(room); room.phase = 'waiting'; room.game = null; room.noituGame = null; room.notice = actor.nickname + ' đã rời phòng; ván bị hủy.'; room.pauseStartedAt = null; for (const player of room.players.values()) player.ready = false; }
    if (room.players.size === 0) this.destroy(room);
    else { this.transferHostIfNeeded(room); this.bump(room); }
  }
  snapshot(room: Room, viewerId: string): RoomSnapshot {
    const viewer = this.getSeat(room, viewerId);
    const seats = [...room.players.values()];
    const guestNotReady = seats.find((player) => player.id !== room.hostId && !player.ready);
    const startReason = room.phase !== 'waiting' ? 'Ván chưa kết thúc.' :
      seats.length < GAME_CATALOG[room.gameKey].minPlayers ? 'Cần ít nhất 2 người.' :
      seats.some((player) => !player.online) ? 'Có người đang mất kết nối.' :
      guestNotReady ? 'Chờ ' + guestNotReady.nickname + ' sẵn sàng.' :
      room.gameKey === 'noitu' && !this.options.noitu ? 'Từ điển thử nghiệm chưa sẵn sàng.' : null;
    const common = {
      roomId: room.id, code: room.code, visibility: room.visibility, phase: room.phase,
      revision: room.revision, paused: room.pauseStartedAt !== null, hostId: room.hostId,
      players: seats.map((player) => ({ id: player.id, nickname: player.nickname, isHost: player.id === room.hostId, isYou: player.id === viewerId, online: player.online, ready: player.ready, ...(room.gameKey === 'uno' && room.game ? { cardCount: room.game.players.find((gamePlayer) => gamePlayer.id === player.id)?.hand.length ?? 0 } : {}) })),
      minPlayers: GAME_CATALOG[room.gameKey].minPlayers, maxPlayers: GAME_CATALOG[room.gameKey].maxPlayers,
      canStart: viewer.id === room.hostId && startReason === null,
      startReason, notice: room.notice,
    };
    if (room.gameKey === 'noitu') return {
      ...common, gameKey: 'noitu',
      game: room.noituGame ? projectNoituGame(room.noituGame, viewerId, this.now(), room.pauseStartedAt !== null) : null,
    };
    return { ...common, gameKey: 'uno', game: room.game ? projectGame(room.game, viewerId) : null };
  }
  isCurrentSocket(roomId: string, playerId: string, socketId: string, generation: number) {
    const seat = this.rooms.get(roomId)?.players.get(playerId);
    return Boolean(seat && seat.online && seat.socketId === socketId && seat.generation === generation);
  }
  destroyAll() { clearInterval(this.cleanupTimer); for (const room of this.rooms.values()) this.destroy(room, 'shutdown'); }

  private clearNoituDeadline(room: Room) { if (room.noituTimer) clearTimeout(room.noituTimer); room.noituTimer = undefined; }
  private clearNoituDraft(room: Room) {
    const hadDraft = room.noituDraft !== null;
    room.noituDraft = null; room.noituDraftTurnId = null; room.noituDraftSequence = 0; room.noituDraftUpdatedAt = 0;
    if (hadDraft) this.options.onNoituDraft?.(room.id, null);
  }
  private scheduleNoituDeadline(room: Room) {
    this.clearNoituDeadline(room);
    if (room.phase !== 'playing' || room.pauseStartedAt !== null || !room.noituGame) return;
    const state = room.noituGame;
    const deadlineAt = state.phase === 'voting' ? state.proposal?.deadlineAt : state.turnDeadlineAt;
    if (deadlineAt === null || deadlineAt === undefined) return;
    const gameId = state.gameId; const turnId = state.turnId; const proposalId = state.proposal?.id ?? null;
    room.noituTimer = setTimeout(() => this.expireNoituTimer(room.id, gameId, turnId, proposalId, deadlineAt), Math.max(0, deadlineAt - this.now()));
    room.noituTimer.unref?.();
  }
  private expireNoituTimer(roomId: string, gameId: string, turnId: string, proposalId: string | null, deadlineAt: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== 'playing' || room.pauseStartedAt !== null || !room.noituGame) return;
    const current = room.noituGame;
    const currentDeadline = current.phase === 'voting' ? current.proposal?.deadlineAt : current.turnDeadlineAt;
    if (current.gameId !== gameId || current.turnId !== turnId || (current.proposal?.id ?? null) !== proposalId || currentDeadline !== deadlineAt || this.now() < deadlineAt) return;
    const next = expireNoituDeadline(current, this.now());
    if (!next) return;
    room.noituGame = next;
    if (next.phase === 'finished') { room.phase = 'finished'; this.clearNoituDeadline(room); }
    else this.scheduleNoituDeadline(room);
    this.clearNoituDraft(room); this.bump(room); this.options.onChanged?.(room.id);
  }
  private resolveNoituDeadline(room: Room): boolean {
    if (!room.noituGame || room.phase !== 'playing' || room.pauseStartedAt !== null) return false;
    const deadlineAt = room.noituGame.phase === 'voting' ? room.noituGame.proposal?.deadlineAt : room.noituGame.turnDeadlineAt;
    if (deadlineAt === null || deadlineAt === undefined || this.now() < deadlineAt) return false;
    const next = expireNoituDeadline(room.noituGame, this.now());
    if (!next) return false;
    room.noituGame = next;
    if (next.phase === 'finished') { room.phase = 'finished'; this.clearNoituDeadline(room); }
    else this.scheduleNoituDeadline(room);
    this.clearNoituDraft(room); this.bump(room); this.options.onChanged?.(room.id);
    return true;
  }
  private requireHost(room: Room, actor: Seat) { if (room.hostId !== actor.id) throw new RoomError('HOST_ONLY', 'Chỉ chủ phòng được thực hiện thao tác này.'); }
  private requirePhase(room: Room, phase: RoomPhase) { if (room.phase !== phase) throw new RoomError('WRONG_PHASE', 'Phòng đang ở trạng thái khác.'); }
  private transferHostIfNeeded(room: Room) {
    const current = room.players.get(room.hostId);
    if (current?.online) return;
    const candidates = [...room.players.values()].sort((a, b) => Number(b.online) - Number(a.online) || a.joinedAt - b.joinedAt);
    if (candidates[0]) room.hostId = candidates[0].id;
  }
  private removeSeat(room: Room, seat: Seat, revoke = true) {
    if (seat.graceTimer) clearTimeout(seat.graceTimer);
    if (revoke && seat.socketId) this.options.onRevoke?.(seat.socketId);
    room.players.delete(seat.id);
    this.transferHostIfNeeded(room);
  }
  private expireSeat(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId); const seat = room?.players.get(playerId);
    if (!room || !seat || seat.online) return;
    const wasPlaying = room.phase === 'playing'; this.removeSeat(room, seat);
    if (wasPlaying) { this.clearNoituDeadline(room); this.clearNoituDraft(room); room.phase = 'waiting'; room.game = null; room.noituGame = null; room.notice = seat.nickname + ' hết thời gian kết nối lại; ván bị hủy.'; room.pauseStartedAt = null; for (const player of room.players.values()) player.ready = false; }
    if (room.players.size === 0) this.destroy(room); else { this.bump(room); this.options.onChanged?.(room.id); }
  }
  private cleanup() {
    const now = this.now();
    for (const room of [...this.rooms.values()]) {
      if (room.phase === 'waiting' && now - room.lastActivity >= WAITING_TTL_MS) this.destroy(room, 'expired');
      else if (room.phase === 'playing' && now - room.lastActivity >= 15 * 60_000) {
        this.clearNoituDeadline(room); this.clearNoituDraft(room);
        room.phase = 'waiting'; room.game = null; room.noituGame = null; room.notice = 'Ván bị hủy vì không có lượt chơi trong 15 phút.'; room.pauseStartedAt = null;
        for (const seat of room.players.values()) seat.ready = false;
        this.bump(room); this.options.onChanged?.(room.id);
      }
      if (room.pauseStartedAt !== null && now - room.pauseStartedAt >= 5 * 60_000 && room.phase === 'playing') {
        this.clearNoituDeadline(room); this.clearNoituDraft(room);
        room.phase = 'waiting'; room.game = null; room.noituGame = null; room.notice = 'Ván bị hủy sau 5 phút gián đoạn kết nối.'; room.pauseStartedAt = null; for (const player of room.players.values()) player.ready = false; this.bump(room); this.options.onChanged?.(room.id);
      }
    }
  }
  private destroy(room: Room, reason: RoomClosedPayload['reason'] = 'empty') {
    this.clearNoituDeadline(room); this.clearNoituDraft(room);
    const message = reason === 'expired' ? 'Phòng đã đóng vì hết thời gian chờ.' : reason === 'shutdown' ? 'Máy chủ đang khởi động lại; phòng đã đóng.' : 'Phòng không còn người chơi.';
    this.options.onClosed?.({ roomId: room.id, reason, message }, [...room.players.values()].flatMap((player) => player.socketId ? [player.socketId] : []));
    for (const player of room.players.values()) if (player.graceTimer) clearTimeout(player.graceTimer);
    for (const timer of room.offlineTimers) clearTimeout(timer);
    room.offlineTimers.clear(); this.rooms.delete(room.id); this.byCode.delete(room.code);
  }
}
