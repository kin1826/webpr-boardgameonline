import { createHash, randomBytes, randomInt as cryptoRandomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { DEFAULT_GAME_SETTINGS, GAME_CATALOG, type BantauActionPayload, type CaroActionPayload, type GameKey, type GameSettings, type NoituActionPayload, type NoituDraftNotice, type NoituDraftPayload, type RoomPhase, type RoomSnapshot, type RoomVisibility, type SessionCredentials, type PublicRoomSummary, type RoomClosedPayload } from '@banban/shared';
import { applyGameAction, createGame, expireUnoDeadline, pauseUnoGame, projectGame, resumeUnoGame, type UnoState, type UnoIntent } from '@banban/uno';
import { applyNoituAction, createNoituGame, expireNoituDeadline, pauseNoituGame, projectNoituGame, resumeNoituGame, type NoituDictionary, type NoituIntent, type NoituState } from '@banban/noitu';
import { applyCaroAction, createCaroGame, expireCaroDeadline, pauseCaroGame, projectCaroGame, resumeCaroGame, type CaroIntent, type CaroState } from '@banban/caro';
import { advanceBantauResolution, applyBantauPlacement, createBantauGame, expireBantauSetup, expireBantauTurn, fireBantau, lockBantauFleet, pauseBantauGame, projectBantauGame, resignBantau, resumeBantauGame, setBantauAim, BANTAU_ROUND_LIMIT_MS, type BantauEffect, type BantauPlacementIntent, type BantauState } from '@banban/bantau';

export class RoomError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'RoomError'; }
}
type Seat = {
  id: string; nickname: string; avatarId: number; tokenHash: string; socketId: string | null; generation: number;
  online: boolean; ready: boolean; joinedAt: number; graceTimer?: ReturnType<typeof setTimeout>;
};
type Room = {
  id: string; code: string; gameKey: GameKey; visibility: RoomVisibility; phase: RoomPhase; revision: number;
  settings: GameSettings;
  match: null | { id: string; status: 'active' | 'intermission' | 'finished'; targetScore: number; roundNumber: number; scores: Map<string, number>; winnerId: string | null; nextRoundAt: number | null; remainingMs: number | null; lastRound: null | { roundNumber: number; winnerId: string | null; reason: string; points: 0 | 10 }; settledGameId: string | null };
  hostId: string; players: Map<string, Seat>; game: UnoState | null; noituGame: NoituState | null; caroGame: CaroState | null; bantauGame: BantauState | null; notice: string | null;
  caroWinLength: 4 | 5 | 6;
  caroPreviousPair: [string, string] | null; caroPreviousXId: string | null; bantauPreviousFirstPlayerId: string | null;
  createdAt: number; lastActivity: number; pauseStartedAt: number | null; offlineTimers: Set<ReturnType<typeof setTimeout>>;
  noituTimer?: ReturnType<typeof setTimeout>; caroTimer?: ReturnType<typeof setTimeout>; unoTimer?: ReturnType<typeof setTimeout>; bantauTimer?: ReturnType<typeof setTimeout>; bantauRoundTimer?: ReturnType<typeof setTimeout>; bantauRoundDeadlineAt: number | null; bantauRoundRemainingMs: number | null; intermissionTimer?: ReturnType<typeof setTimeout>; noituDraft: NoituDraftNotice | null;
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
  onBantauEffect?: (roomId: string, effect: BantauEffect) => void;
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
  private makeSeat(nickname: string, socketId: string, avatarId = 0): { seat: Seat; token: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, seat: { id: randomUUID(), nickname, avatarId, tokenHash: this.tokenDigest(token), socketId, generation: 1, online: true, ready: false, joinedAt: this.now() } };
  }
  create(nickname: string, visibility: RoomVisibility, socketId: string, gameKey: GameKey = 'uno', avatarId = 0, settings?: GameSettings): { room: Room; seat: Seat; credentials: SessionCredentials } {
    if (this.rooms.size >= MAX_ROOMS) throw new RoomError('ROOM_CAPACITY', 'Máy chủ đang có quá nhiều phòng. Hãy thử lại sau.');
    const roomSettings = settings ?? DEFAULT_GAME_SETTINGS[gameKey];
    if (roomSettings.gameKey !== gameKey) throw new RoomError('INVALID_SETTINGS', 'Cấu hình không khớp với trò chơi đã chọn.');
    const id = randomUUID(); const code = this.makeCode(); const { seat, token } = this.makeSeat(nickname, socketId, avatarId);
    const room: Room = { id, code, gameKey, visibility, phase: 'waiting', revision: 0, settings: roomSettings, match: null, hostId: seat.id, players: new Map([[seat.id, seat]]), game: null, noituGame: null, caroGame: null, bantauGame: null, notice: null, caroWinLength: gameKey === 'caro' && roomSettings.gameKey === 'caro' ? roomSettings.winLength : 5, caroPreviousPair: null, caroPreviousXId: null, bantauPreviousFirstPlayerId: null, bantauRoundDeadlineAt: null, bantauRoundRemainingMs: null, createdAt: this.now(), lastActivity: this.now(), pauseStartedAt: null, offlineTimers: new Set(), noituDraft: null, noituDraftTurnId: null, noituDraftSequence: 0, noituDraftUpdatedAt: 0 };
    this.rooms.set(id, room); this.byCode.set(code, id);
    return { room, seat, credentials: { roomId: id, roomCode: code, playerId: seat.id, token } };
  }
  join(code: string, nickname: string, socketId: string, avatarId = 0): { room: Room; seat: Seat; credentials: SessionCredentials } {
    const roomId = this.byCode.get(code.toUpperCase()); const room = roomId ? this.rooms.get(roomId) : undefined;
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng với mã này.');
    if (room.phase !== 'waiting') throw new RoomError('ROOM_IN_PROGRESS', 'Ván đã bắt đầu; phòng không nhận người mới.');
    if (room.players.size >= GAME_CATALOG[room.gameKey].maxPlayers) throw new RoomError('ROOM_FULL', `Phòng đã đủ ${GAME_CATALOG[room.gameKey].maxPlayers} người.`);
    const { seat, token } = this.makeSeat(nickname, socketId, avatarId);
    for (const player of room.players.values()) player.ready = false;
    room.players.set(seat.id, seat); room.notice = null; this.bump(room);
    return { room, seat, credentials: { roomId: room.id, roomCode: room.code, playerId: seat.id, token } };
  }
  publicRooms(): PublicRoomSummary[] {
    return [...this.rooms.values()].filter((room) => room.visibility === 'public' && room.phase === 'waiting' && room.players.size < GAME_CATALOG[room.gameKey].maxPlayers)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 100)
      .map((room) => ({ code: room.code, gameKey: room.gameKey, visibility: 'public', hostName: room.players.get(room.hostId)?.nickname ?? 'Chủ phòng', hostAvatarId: room.players.get(room.hostId)?.avatarId ?? 0, playerCount: room.players.size, maxPlayers: GAME_CATALOG[room.gameKey].maxPlayers, phase: 'waiting', turnSeconds: room.settings.turnSeconds, targetScore: room.settings.targetScore, settings: room.settings }));
  }
  gameAvailable(gameKey: GameKey) { return gameKey === 'uno' || gameKey === 'caro' || gameKey === 'bantau' || Boolean(this.options.noitu); }
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
    if ((room.phase === 'playing' || room.match?.status === 'intermission') && [...room.players.values()].every((player) => player.online) && room.pauseStartedAt !== null) {
      room.pauseStartedAt = null;
      if (room.phase === 'playing' && room.game) { room.game = resumeUnoGame(room.game, this.now()); this.scheduleUnoDeadline(room); }
      if (room.phase === 'playing' && room.noituGame) { room.noituGame = resumeNoituGame(room.noituGame, this.now()); this.scheduleNoituDeadline(room); }
      if (room.phase === 'playing' && room.caroGame) { room.caroGame = resumeCaroGame(room.caroGame, this.now()); this.scheduleCaroDeadline(room); }
      if (room.phase === 'playing' && room.bantauGame) { room.bantauGame = resumeBantauGame(room.bantauGame, this.now()); this.scheduleBantauDeadline(room); this.scheduleBantauRoundLimit(room, room.bantauRoundRemainingMs ?? BANTAU_ROUND_LIMIT_MS); }
      if (room.match?.status === 'intermission' && room.match.remainingMs !== null) this.scheduleNextRound(room, room.match.remainingMs);
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
    if (room.phase === 'playing' && room.caroGame && room.pauseStartedAt === null) this.resolveCaroDeadline(room);
    if (room.phase === 'playing' && room.game && room.pauseStartedAt === null) this.resolveUnoDeadline(room);
    if (room.phase === 'playing' && room.bantauGame && room.pauseStartedAt === null) this.resolveBantauDeadline(room);
    seat.socketId = null; seat.online = false;
    if (room.phase === 'waiting') seat.ready = false;
    if ((room.phase === 'playing' || room.match?.status === 'intermission') && room.pauseStartedAt === null) {
      room.pauseStartedAt = this.now();
      if (room.match?.status === 'intermission') {
        room.match.remainingMs = Math.max(0, (room.match.nextRoundAt ?? this.now()) - this.now());
        this.clearNextRound(room);
      }
      if (room.phase === 'playing' && room.game) { room.game = pauseUnoGame(room.game, this.now()); this.clearUnoDeadline(room); }
      if (room.phase === 'playing' && room.noituGame) { room.noituGame = pauseNoituGame(room.noituGame, this.now()); this.clearNoituDeadline(room); this.clearNoituDraft(room); }
      if (room.phase === 'playing' && room.caroGame) { room.caroGame = pauseCaroGame(room.caroGame, this.now()); this.clearCaroDeadline(room); }
      if (room.phase === 'playing' && room.bantauGame) {
        room.bantauGame = pauseBantauGame(room.bantauGame, this.now());
        this.clearBantauDeadline(room);
        room.bantauRoundRemainingMs = Math.max(0, (room.bantauRoundDeadlineAt ?? this.now()) - this.now());
        room.bantauRoundDeadlineAt = null;
        this.clearBantauRoundLimit(room);
      }
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
  setCaroWinLength(room: Room, actor: Seat, winLength: 4 | 5 | 6) {
    this.requireHost(room, actor); this.requirePhase(room, 'waiting');
    if (room.gameKey !== 'caro') throw new RoomError('WRONG_GAME', 'Tùy chỉnh này chỉ dùng cho Caro.');
    if (![4, 5, 6].includes(winLength)) throw new RoomError('INVALID_WIN_LENGTH', 'Chỉ chọn 4, 5 hoặc 6 quân để thắng.');
    if (room.caroWinLength === winLength) return;
    room.caroWinLength = winLength;
    if (room.settings.gameKey === 'caro') room.settings = { ...room.settings, winLength };
    for (const seat of room.players.values()) seat.ready = false;
    room.notice = `Đã đổi thành nối đúng ${winLength} quân để thắng. Mọi người hãy sẵn sàng lại.`;
    this.bump(room);
  }
  updateSettings(room: Room, actor: Seat, settings: GameSettings) {
    this.requireHost(room, actor); this.requirePhase(room, 'waiting');
    if (settings.gameKey !== room.gameKey) throw new RoomError('INVALID_SETTINGS', 'Cấu hình không khớp trò chơi của phòng.');
    if (JSON.stringify(settings) === JSON.stringify(room.settings)) return;
    room.settings = settings;
    if (settings.gameKey === 'caro') room.caroWinLength = settings.winLength;
    for (const seat of room.players.values()) if (seat.id !== room.hostId) seat.ready = false;
    room.notice = 'Chủ phòng đã đổi cấu hình. Mọi người hãy sẵn sàng lại.';
    this.bump(room);
  }
  start(room: Room, actor: Seat) {
    this.requireHost(room, actor); this.requirePhase(room, 'waiting');
    const seats = [...room.players.values()];
    if (seats.length < GAME_CATALOG[room.gameKey].minPlayers) throw new RoomError('NEED_TWO_PLAYERS', 'Cần ít nhất 2 người để bắt đầu.');
    if (seats.some((player) => !player.online)) throw new RoomError('PLAYER_OFFLINE', 'Chờ mọi người kết nối lại trước khi bắt đầu.');
    const missing = seats.find((player) => player.id !== room.hostId && !player.ready);
    if (missing) throw new RoomError('NOT_READY', 'Chờ ' + missing.nickname + ' sẵn sàng.');
    room.match = { id: randomUUID(), status: 'active', targetScore: room.settings.targetScore, roundNumber: 0, scores: new Map(seats.map((seat) => [seat.id, 0])), winnerId: null, nextRoundAt: null, remainingMs: null, lastRound: null, settledGameId: null };
    this.startRound(room);
  }
  private startRound(room: Room) {
    const seats = [...room.players.values()];
    const match = room.match;
    if (!match || match.status === 'finished') throw new RoomError('MATCH_FINISHED', 'Trận đã kết thúc.');
    if (seats.length < GAME_CATALOG[room.gameKey].minPlayers) throw new RoomError('NEED_TWO_PLAYERS', 'Không đủ người để bắt đầu ván tiếp theo.');
    this.clearNextRound(room);
    match.roundNumber++;
    match.status = 'active'; match.nextRoundAt = null; match.remainingMs = null;
    const gameId = randomUUID();
    if (room.gameKey === 'noitu') {
      if (!this.options.noitu) throw new RoomError('DICTIONARY_NOT_READY', 'Từ điển thử nghiệm chưa sẵn sàng. Nối từ chưa thể bắt đầu; UNO vẫn hoạt động.');
      try {
        room.noituGame = createNoituGame({ gameId, players: seats.map(({ id, nickname }) => ({ id, nickname })), dictionary: this.options.noitu.dictionary, seedWords: this.options.noitu.seedWords, randomInt: (max) => this.random(max), now: this.now(), turnDurationMs: room.settings.turnSeconds * 1000 });
        room.game = null;
      } catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
    } else if (room.gameKey === 'caro') {
      const pair = seats.map((player) => player.id).sort() as [string, string];
      const samePair = room.caroPreviousPair?.[0] === pair[0] && room.caroPreviousPair?.[1] === pair[1];
      const xPlayerId = samePair && room.caroPreviousXId ? pair.find((id) => id !== room.caroPreviousXId) : undefined;
      try {
        room.caroGame = createCaroGame({ gameId, winLength: room.caroWinLength, boardSize: room.settings.gameKey === 'caro' ? room.settings.boardSize : 15, turnDurationMs: room.settings.turnSeconds * 1000, players: seats.map(({ id, nickname }) => ({ id, nickname })), randomInt: (max) => this.random(max), now: this.now(), ...(xPlayerId ? { xPlayerId } : {}) });
        room.caroPreviousPair = pair;
        room.caroPreviousXId = room.caroGame.players.find((player) => player.symbol === 'X')!.id;
        room.game = null; room.noituGame = null;
      } catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
    } else if (room.gameKey === 'bantau') {
      const settings = room.settings;
      if (settings.gameKey !== 'bantau' || seats.length !== 2) throw new RoomError('PLAYER_COUNT', 'Bắn tàu cần đúng hai người chơi.');
      const firstPlayerId = room.bantauPreviousFirstPlayerId && seats.some((seat) => seat.id === room.bantauPreviousFirstPlayerId)
        ? seats.find((seat) => seat.id !== room.bantauPreviousFirstPlayerId)!.id
        : seats[this.random(seats.length)]!.id;
      try {
        room.bantauGame = createBantauGame({
          gameId, players: seats.map(({ id, nickname }) => ({ id, nickname })) as [{ id: string; nickname: string }, { id: string; nickname: string }],
          options: { boardSize: settings.boardSize, shipCount: settings.shipCount, turnDurationMs: settings.turnSeconds * 1000, hitContinues: settings.hitContinues, allowTouch: settings.allowTouch },
          firstPlayerId, randomInt: (max) => this.random(max), now: this.now(),
        });
        room.bantauPreviousFirstPlayerId = firstPlayerId;
        room.game = null; room.noituGame = null; room.caroGame = null;
      } catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
    } else {
      room.noituGame = null;
      room.caroGame = null;
      room.bantauGame = null;
      room.game = createGame({ gameId, players: seats.map(({ id, nickname }) => ({ id, nickname })), randomInt: (max) => this.random(max), now: this.now(), turnDurationMs: room.settings.turnSeconds * 1000, stacking: room.settings.gameKey === 'uno' ? room.settings.stacking : true });
    }
    room.phase = 'playing'; room.notice = null; room.pauseStartedAt = null; this.clearNoituDraft(room);
    if (room.game) this.scheduleUnoDeadline(room);
    if (room.noituGame) this.scheduleNoituDeadline(room);
    if (room.caroGame) this.scheduleCaroDeadline(room);
    if (room.bantauGame) { this.scheduleBantauDeadline(room); this.scheduleBantauRoundLimit(room, BANTAU_ROUND_LIMIT_MS); }
    this.bump(room);
  }
  gameAction(room: Room, actor: Seat, expectedRevision: number, action: UnoIntent) {
    if (room.gameKey !== 'uno' || !room.game) throw new RoomError('WRONG_GAME', 'Hành động UNO không dùng được trong phòng này.');
    if (room.phase !== 'playing') throw new RoomError('NOT_PLAYING', 'Phòng hiện không có ván đang chơi.');
    if (room.pauseStartedAt !== null) throw new RoomError('GAME_PAUSED', 'Ván đang tạm dừng, chờ người chơi kết nối lại.');
    if (this.resolveUnoDeadline(room)) throw new RoomError('ACTION_EXPIRED', 'Đã hết thời gian lượt. Bàn chơi đã cập nhật.');
    if (room.revision !== expectedRevision) throw new RoomError('STALE_REVISION', 'Trạng thái đã đổi. Bàn chơi đang được làm mới.');
    try { room.game = applyGameAction(room.game, actor.id, action, (max) => this.random(max), this.now()); }
    catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
    if (room.game.phase === 'finished') { this.clearUnoDeadline(room); this.settleRound(room, room.game.winnerId, room.game.finishReason ?? 'finished', room.game.gameId); }
    else this.scheduleUnoDeadline(room);
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
    if (room.noituGame.phase === 'finished') { this.clearNoituDeadline(room); this.settleRound(room, room.noituGame.winnerId, 'finished', room.noituGame.gameId); }
    else this.scheduleNoituDeadline(room);
    this.clearNoituDraft(room);
    this.bump(room);
  }
  caroAction(room: Room, actor: Seat, expectedRevision: number, action: CaroActionPayload) {
    if (room.gameKey !== 'caro' || !room.caroGame) throw new RoomError('WRONG_GAME', 'Hành động Caro không dùng được trong phòng này.');
    if (room.phase !== 'playing') throw new RoomError('NOT_PLAYING', 'Phòng hiện không có ván đang chơi.');
    if (room.pauseStartedAt !== null) throw new RoomError('GAME_PAUSED', 'Ván đang tạm dừng, chờ người chơi kết nối lại.');
    if (this.resolveCaroDeadline(room)) throw new RoomError('ACTION_EXPIRED', 'Đã hết giờ. Ván Caro đã kết thúc.');
    if (room.revision !== expectedRevision) throw new RoomError('STALE_REVISION', 'Trạng thái đã đổi. Bàn chơi đang được cập nhật.');
    if (room.caroGame.gameId !== action.gameId) throw new RoomError('STALE_GAME', 'Ván đã thay đổi. Hãy chờ bàn chơi cập nhật.');
    const { actionId: _actionId, roomId: _roomId, gameId: _gameId, expectedRevision: _revision, ...intent } = action;
    void _actionId; void _roomId; void _gameId; void _revision;
    try { room.caroGame = applyCaroAction(room.caroGame, actor.id, intent as CaroIntent, this.now()); }
    catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
    if (room.caroGame.phase === 'finished') { this.clearCaroDeadline(room); this.settleRound(room, room.caroGame.winnerId, room.caroGame.finishReason ?? 'finished', room.caroGame.gameId); }
    else this.scheduleCaroDeadline(room);
    this.bump(room);
  }
  bantauPlacement(room: Room, actor: Seat, gameId: string, setupId: string, expectedFleetRevision: number, intent: BantauPlacementIntent) {
    if (room.gameKey !== 'bantau' || !room.bantauGame || room.bantauGame.gameId !== gameId) throw new RoomError('STALE_GAME', 'Ván Bắn tàu đã thay đổi. Hãy đồng bộ bàn chơi.');
    if (room.phase !== 'playing' || room.bantauGame.phase !== 'setup') throw new RoomError('WRONG_PHASE', 'Hiện không thể xếp tàu.');
    if (room.pauseStartedAt !== null) throw new RoomError('GAME_PAUSED', 'Ván đang tạm dừng, chờ người chơi kết nối lại.');
    if (room.bantauGame.setupId !== setupId) throw new RoomError('STALE_SETUP', 'Pha xếp tàu đã thay đổi.');
    if (this.resolveBantauDeadline(room)) throw new RoomError('ACTION_EXPIRED', 'Đã hết thời gian xếp tàu. Bàn chơi đã cập nhật.');
    try { room.bantauGame = applyBantauPlacement(room.bantauGame, actor.id, expectedFleetRevision, intent, (max) => this.random(max), this.now()); }
    catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
    return this.snapshot(room, actor.id);
  }
  bantauAim(room: Room, actor: Seat, gameId: string, turnId: string, sequence: number, cell: { row: number; col: number } | null) {
    if (room.gameKey !== 'bantau' || !room.bantauGame || room.bantauGame.gameId !== gameId) throw new RoomError('STALE_GAME', 'Ván Bắn tàu đã thay đổi. Hãy đồng bộ bàn chơi.');
    if (room.phase !== 'playing' || room.pauseStartedAt !== null) throw new RoomError('GAME_PAUSED', 'Ván đang tạm dừng hoặc chưa bắt đầu.');
    if (this.resolveBantauDeadline(room)) throw new RoomError('ACTION_EXPIRED', 'Đã hết thời gian lượt. Bàn chơi đã cập nhật.');
    try {
      const result = setBantauAim(room.bantauGame, actor.id, turnId, sequence, cell, this.now());
      room.bantauGame = result.state;
      return result.aim;
    } catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
  }
  bantauAction(room: Room, actor: Seat, expectedRevision: number, action: BantauActionPayload) {
    if (room.gameKey !== 'bantau' || !room.bantauGame || room.bantauGame.gameId !== action.gameId) throw new RoomError('STALE_GAME', 'Ván Bắn tàu đã thay đổi. Hãy đồng bộ bàn chơi.');
    if (room.phase !== 'playing' || room.pauseStartedAt !== null) throw new RoomError('NOT_PLAYING', 'Phòng hiện không có ván Bắn tàu đang chơi.');
    if (this.resolveBantauDeadline(room)) throw new RoomError('ACTION_EXPIRED', 'Thời gian thao tác đã hết. Bàn chơi đã cập nhật.');
    if (room.revision !== expectedRevision) throw new RoomError('STALE_REVISION', 'Trạng thái đã đổi. Bàn chơi đang được làm mới.');
    if (action.type === 'lockFleet') {
      if (room.bantauGame.setupId !== action.setupId) throw new RoomError('STALE_SETUP', 'Pha xếp tàu đã thay đổi.');
      try { room.bantauGame = lockBantauFleet(room.bantauGame, actor.id, action.expectedFleetRevision, this.now()); }
      catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
      this.scheduleBantauDeadline(room);
      this.bump(room);
      return undefined;
    }
    if (action.type === 'resign') {
      try { room.bantauGame = resignBantau(room.bantauGame, actor.id); }
      catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
      this.settleRound(room, room.bantauGame.winnerId, 'resign', room.bantauGame.gameId);
      this.bump(room);
      return undefined;
    }
    if (room.bantauGame.turnId !== action.turnId) throw new RoomError('STALE_TURN', 'Lượt đã thay đổi. Hãy nhắm lại.');
    let shot;
    try { shot = fireBantau(room.bantauGame, actor.id, action.turnId, action.aimSequence, { row: action.row, col: action.col }, (max) => this.random(max), this.now()); }
    catch (error) { if (error instanceof Error && 'code' in error) throw new RoomError(String(error.code), error.message); throw error; }
    room.bantauGame = shot.state;
    if (shot.state.phase === 'finished') this.settleRound(room, shot.state.winnerId, shot.state.finishReason ?? 'fleet-sunk', shot.state.gameId);
    else this.scheduleBantauDeadline(room);
    this.bump(room);
    return shot.effect;
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
    if (room.match?.status !== 'finished') throw new RoomError('MATCH_NOT_FINISHED', 'Trận vẫn đang diễn ra.');
    this.clearUnoDeadline(room); this.clearNoituDeadline(room); this.clearCaroDeadline(room); this.clearBantauDeadline(room); this.clearBantauRoundLimit(room); this.clearNextRound(room); this.clearNoituDraft(room);
    room.game = null; room.noituGame = null; room.caroGame = null; room.bantauGame = null; room.bantauRoundDeadlineAt = null; room.bantauRoundRemainingMs = null; room.match = null; room.phase = 'waiting'; room.notice = null; room.pauseStartedAt = null;
    for (const seat of room.players.values()) seat.ready = false;
    this.bump(room);
  }
  kick(room: Room, actor: Seat, targetId: string): { kicked: Seat; wasPlaying: boolean } {
    this.requireHost(room, actor);
    if (targetId === actor.id) throw new RoomError('CANNOT_KICK_SELF', 'Bạn không thể tự mời mình ra.');
    const target = this.getSeat(room, targetId); const wasPlaying = room.phase === 'playing'; const matchInProgress = room.match !== null && room.match.status !== 'finished';
    this.removeSeat(room, target);
    if (matchInProgress) this.cancelMatch(room, 'Trận đã hủy vì chủ phòng mời ' + target.nickname + ' ra khỏi phòng.');
    else room.notice = target.nickname + ' đã được mời ra khỏi phòng.';
    for (const seat of room.players.values()) seat.ready = false;
    this.transferHostIfNeeded(room); this.bump(room);
    return { kicked: target, wasPlaying };
  }
  leave(room: Room, actor: Seat) {
    const matchInProgress = room.match !== null && room.match.status !== 'finished';
    this.removeSeat(room, actor, false);
    if (matchInProgress) this.cancelMatch(room, actor.nickname + ' đã rời phòng; trận bị hủy.');
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
      players: seats.map((player) => ({ id: player.id, nickname: player.nickname, avatarId: player.avatarId, isHost: player.id === room.hostId, isYou: player.id === viewerId, online: player.online, ready: player.ready, ...(room.gameKey === 'uno' && room.game ? { cardCount: room.game.players.find((gamePlayer) => gamePlayer.id === player.id)?.hand.length ?? 0 } : {}) })),
      minPlayers: GAME_CATALOG[room.gameKey].minPlayers, maxPlayers: GAME_CATALOG[room.gameKey].maxPlayers,
      canStart: viewer.id === room.hostId && startReason === null,
      startReason, notice: room.notice,
      match: room.match ? { id: room.match.id, status: room.match.status, targetScore: room.match.targetScore, roundNumber: room.match.roundNumber, scores: [...room.match.scores].map(([playerId, score]) => ({ playerId, score })), winnerId: room.match.winnerId, nextRoundAt: room.match.nextRoundAt, remainingMs: room.match.remainingMs ?? (room.match.nextRoundAt === null ? null : Math.max(0, room.match.nextRoundAt - this.now())), serverNow: this.now(), lastRound: room.match.lastRound ? { ...room.match.lastRound } : null } : null,
    };
    if (room.gameKey === 'noitu') return {
      ...common, gameKey: 'noitu',
      settings: room.settings as Extract<GameSettings, { gameKey: 'noitu' }>,
      game: room.noituGame ? projectNoituGame(room.noituGame, viewerId, this.now(), room.pauseStartedAt !== null) : null,
    };
    if (room.gameKey === 'caro') return {
      ...common, gameKey: 'caro', settings: room.settings as Extract<GameSettings, { gameKey: 'caro' }>, caroWinLength: room.caroWinLength,
      game: room.caroGame ? projectCaroGame(room.caroGame, viewerId, this.now(), room.pauseStartedAt !== null) : null,
    };
    if (room.gameKey === 'bantau') return {
      ...common, gameKey: 'bantau', settings: room.settings as Extract<GameSettings, { gameKey: 'bantau' }>,
      game: room.bantauGame ? projectBantauGame(room.bantauGame, viewerId, this.now(), room.pauseStartedAt !== null) : null,
    };
    return { ...common, gameKey: 'uno', settings: room.settings as Extract<GameSettings, { gameKey: 'uno' }>, game: room.game ? projectGame(room.game, viewerId, this.now(), room.pauseStartedAt !== null) : null };
  }
  isCurrentSocket(roomId: string, playerId: string, socketId: string, generation: number) {
    const seat = this.rooms.get(roomId)?.players.get(playerId);
    return Boolean(seat && seat.online && seat.socketId === socketId && seat.generation === generation);
  }
  destroyAll() { clearInterval(this.cleanupTimer); for (const room of this.rooms.values()) this.destroy(room, 'shutdown'); }

  private clearUnoDeadline(room: Room) { if (room.unoTimer) clearTimeout(room.unoTimer); room.unoTimer = undefined; }
  private scheduleUnoDeadline(room: Room) {
    this.clearUnoDeadline(room);
    if (room.phase !== 'playing' || room.pauseStartedAt !== null || !room.game || room.game.phase === 'finished' || room.game.turnDeadlineAt === null) return;
    const { gameId, turnId, turnDeadlineAt } = room.game;
    room.unoTimer = setTimeout(() => this.expireUnoTimer(room.id, gameId, turnId, turnDeadlineAt), Math.max(0, turnDeadlineAt - this.now()));
    room.unoTimer.unref?.();
  }
  private expireUnoTimer(roomId: string, gameId: string, turnId: string, deadlineAt: number) {
    const room = this.rooms.get(roomId); const current = room?.game;
    if (!room || room.phase !== 'playing' || room.pauseStartedAt !== null || !current || current.gameId !== gameId || current.turnId !== turnId || current.turnDeadlineAt !== deadlineAt || this.now() < deadlineAt) return;
    const next = expireUnoDeadline(current, this.now());
    if (!next) return;
    room.game = next;
    if (next.phase === 'finished') { this.clearUnoDeadline(room); this.settleRound(room, next.winnerId, next.finishReason ?? 'finished', gameId); }
    else this.scheduleUnoDeadline(room);
    this.bump(room); this.options.onChanged?.(room.id);
  }
  private resolveUnoDeadline(room: Room): boolean {
    if (!room.game || room.phase !== 'playing' || room.pauseStartedAt !== null) return false;
    const next = expireUnoDeadline(room.game, this.now());
    if (!next) return false;
    room.game = next;
    if (next.phase === 'finished') { this.clearUnoDeadline(room); this.settleRound(room, next.winnerId, next.finishReason ?? 'finished', next.gameId); }
    else this.scheduleUnoDeadline(room);
    this.bump(room); this.options.onChanged?.(room.id);
    return true;
  }
  private clearNextRound(room: Room) { if (room.intermissionTimer) clearTimeout(room.intermissionTimer); room.intermissionTimer = undefined; }
  private scheduleNextRound(room: Room, delayMs: number) {
    const match = room.match;
    this.clearNextRound(room);
    if (!match || match.status !== 'intermission' || room.pauseStartedAt !== null) return;
    const matchId = match.id; const roundNumber = match.roundNumber; const wait = Math.max(0, delayMs);
    match.remainingMs = null; match.nextRoundAt = this.now() + wait;
    room.intermissionTimer = setTimeout(() => {
      const current = this.rooms.get(room.id)?.match;
      if (!current || current.id !== matchId || current.status !== 'intermission' || current.roundNumber !== roundNumber || current.nextRoundAt === null || this.now() < current.nextRoundAt) return;
      const liveRoom = this.rooms.get(room.id)!;
      if ([...liveRoom.players.values()].some((seat) => !seat.online)) {
        liveRoom.pauseStartedAt = this.now(); current.remainingMs = 0; current.nextRoundAt = null;
        this.bump(liveRoom); this.options.onChanged?.(liveRoom.id); return;
      }
      this.startRound(liveRoom); this.options.onChanged?.(liveRoom.id);
    }, wait);
    room.intermissionTimer.unref?.();
  }
  private settleRound(room: Room, winnerId: string | null, reason: string, gameId: string) {
    const match = room.match;
    if (!match || match.status !== 'active' || match.settledGameId === gameId) return;
    match.settledGameId = gameId;
    const points: 0 | 10 = winnerId && match.scores.has(winnerId) ? 10 : 0;
    if (points && winnerId) match.scores.set(winnerId, (match.scores.get(winnerId) ?? 0) + points);
    match.lastRound = { roundNumber: match.roundNumber, winnerId, reason: reason.slice(0, 40), points };
    room.phase = 'finished';
    this.clearUnoDeadline(room); this.clearNoituDeadline(room); this.clearCaroDeadline(room); this.clearBantauDeadline(room); this.clearBantauRoundLimit(room); room.bantauRoundDeadlineAt = null; room.bantauRoundRemainingMs = null; this.clearNoituDraft(room);
    if (winnerId && (match.scores.get(winnerId) ?? 0) >= match.targetScore) {
      match.status = 'finished'; match.winnerId = winnerId; match.nextRoundAt = null; match.remainingMs = null;
      room.notice = `${room.players.get(winnerId)?.nickname ?? 'Người chơi'} đã thắng trận!`;
    } else {
      match.status = 'intermission'; match.winnerId = null; match.nextRoundAt = this.now() + 3_000; match.remainingMs = null;
      room.notice = winnerId ? `Ván ${match.roundNumber} kết thúc. Ván tiếp theo bắt đầu sau 3 giây.` : `Ván ${match.roundNumber} hòa. Ván tiếp theo bắt đầu sau 3 giây.`;
      this.scheduleNextRound(room, 3_000);
    }
  }
  private cancelMatch(room: Room, message: string) {
    this.clearUnoDeadline(room); this.clearNoituDeadline(room); this.clearCaroDeadline(room); this.clearBantauDeadline(room); this.clearBantauRoundLimit(room); this.clearNextRound(room); this.clearNoituDraft(room);
    room.match = null; room.phase = 'waiting'; room.game = null; room.noituGame = null; room.caroGame = null; room.bantauGame = null; room.bantauRoundDeadlineAt = null; room.bantauRoundRemainingMs = null;
    room.notice = message; room.pauseStartedAt = null;
    for (const player of room.players.values()) player.ready = false;
  }
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
  private clearCaroDeadline(room: Room) { if (room.caroTimer) clearTimeout(room.caroTimer); room.caroTimer = undefined; }
  private scheduleCaroDeadline(room: Room) {
    this.clearCaroDeadline(room);
    if (room.phase !== 'playing' || room.pauseStartedAt !== null || !room.caroGame || room.caroGame.phase !== 'turn' || room.caroGame.turnDeadlineAt === null) return;
    const { gameId, turnId, turnDeadlineAt } = room.caroGame;
    room.caroTimer = setTimeout(() => this.expireCaroTimer(room.id, gameId, turnId, turnDeadlineAt), Math.max(0, turnDeadlineAt - this.now()));
    room.caroTimer.unref?.();
  }
  private expireCaroTimer(roomId: string, gameId: string, turnId: string, deadlineAt: number) {
    const room = this.rooms.get(roomId);
    const current = room?.caroGame;
    if (!room || room.phase !== 'playing' || room.pauseStartedAt !== null || !current || current.gameId !== gameId || current.turnId !== turnId || current.turnDeadlineAt !== deadlineAt || this.now() < deadlineAt) return;
    const next = expireCaroDeadline(current, this.now());
    if (!next) return;
    room.caroGame = next; this.clearCaroDeadline(room); this.settleRound(room, next.winnerId, next.finishReason ?? 'finished', gameId); this.bump(room); this.options.onChanged?.(room.id);
  }
  private resolveCaroDeadline(room: Room): boolean {
    if (!room.caroGame || room.phase !== 'playing' || room.pauseStartedAt !== null) return false;
    const next = expireCaroDeadline(room.caroGame, this.now());
    if (!next) return false;
    room.caroGame = next; this.clearCaroDeadline(room); this.settleRound(room, next.winnerId, next.finishReason ?? 'finished', next.gameId); this.bump(room); this.options.onChanged?.(room.id);
    return true;
  }
  private clearBantauDeadline(room: Room) { if (room.bantauTimer) clearTimeout(room.bantauTimer); room.bantauTimer = undefined; }
  private scheduleBantauDeadline(room: Room) {
    this.clearBantauDeadline(room);
    const state = room.bantauGame;
    if (room.phase !== 'playing' || room.pauseStartedAt !== null || !state) return;
    const phaseId = state.phase === 'setup' ? state.setupId : state.phase === 'turn' ? state.turnId : state.phase === 'resolving' ? state.resolvingId : null;
    const deadlineAt = state.phase === 'setup' ? state.setupDeadlineAt : state.phase === 'turn' ? state.turnDeadlineAt : state.phase === 'resolving' ? state.resolveDeadlineAt : null;
    if (!phaseId || deadlineAt === null) return;
    const { gameId } = state;
    room.bantauTimer = setTimeout(() => this.expireBantauTimer(room.id, gameId, phaseId, deadlineAt), Math.max(0, deadlineAt - this.now()));
    room.bantauTimer.unref?.();
  }
  private expireBantauTimer(roomId: string, gameId: string, phaseId: string, deadlineAt: number) {
    const room = this.rooms.get(roomId); const state = room?.bantauGame;
    if (!room || !state || state.gameId !== gameId || room.phase !== 'playing' || room.pauseStartedAt !== null || this.now() < deadlineAt) return;
    const currentPhaseId = state.phase === 'setup' ? state.setupId : state.phase === 'turn' ? state.turnId : state.phase === 'resolving' ? state.resolvingId : null;
    const currentDeadline = state.phase === 'setup' ? state.setupDeadlineAt : state.phase === 'turn' ? state.turnDeadlineAt : state.phase === 'resolving' ? state.resolveDeadlineAt : null;
    if (currentPhaseId !== phaseId || currentDeadline !== deadlineAt) return;
    this.resolveBantauDeadline(room);
  }
  private resolveBantauDeadline(room: Room): boolean {
    const current = room.bantauGame;
    if (!current || room.phase !== 'playing' || room.pauseStartedAt !== null) return false;
    const now = this.now();
    if (current.phase === 'setup') {
      const next = expireBantauSetup(current, now);
      if (!next) return false;
      room.bantauGame = next; this.scheduleBantauDeadline(room); this.bump(room); this.options.onChanged?.(room.id);
      return true;
    }
    if (current.phase === 'turn') {
      const shot = expireBantauTurn(current, (max) => this.random(max), now);
      if (!shot) return false;
      room.bantauGame = shot.state;
      if (shot.state.phase === 'finished') this.settleRound(room, shot.state.winnerId, shot.state.finishReason ?? 'fleet-sunk', shot.state.gameId);
      else this.scheduleBantauDeadline(room);
      this.bump(room); this.options.onChanged?.(room.id);
      this.options.onBantauEffect?.(room.id, shot.effect);
      return true;
    }
    if (current.phase === 'resolving') {
      const next = advanceBantauResolution(current, now);
      if (!next) return false;
      room.bantauGame = next; this.scheduleBantauDeadline(room); this.bump(room); this.options.onChanged?.(room.id);
      return true;
    }
    return false;
  }
  private clearBantauRoundLimit(room: Room) { if (room.bantauRoundTimer) clearTimeout(room.bantauRoundTimer); room.bantauRoundTimer = undefined; }
  private scheduleBantauRoundLimit(room: Room, delayMs: number) {
    this.clearBantauRoundLimit(room);
    if (room.phase !== 'playing' || room.pauseStartedAt !== null || !room.bantauGame || room.bantauGame.phase === 'finished') return;
    const gameId = room.bantauGame.gameId; const wait = Math.max(0, delayMs);
    room.bantauRoundDeadlineAt = this.now() + wait; room.bantauRoundRemainingMs = null;
    const deadlineAt = room.bantauRoundDeadlineAt;
    room.bantauRoundTimer = setTimeout(() => {
      const liveRoom = this.rooms.get(room.id);
      if (!liveRoom || liveRoom.phase !== 'playing' || liveRoom.pauseStartedAt !== null || liveRoom.bantauGame?.gameId !== gameId || liveRoom.bantauRoundDeadlineAt !== deadlineAt || this.now() < deadlineAt) return;
      this.clearBantauDeadline(liveRoom); this.clearBantauRoundLimit(liveRoom);
      liveRoom.bantauRoundDeadlineAt = null; liveRoom.bantauRoundRemainingMs = null;
      liveRoom.bantauGame = null; liveRoom.match = null; liveRoom.phase = 'waiting'; liveRoom.pauseStartedAt = null;
      liveRoom.notice = 'Ván Bắn tàu dừng sau 30 phút hoạt động. Không có điểm nào được cộng.';
      for (const seat of liveRoom.players.values()) seat.ready = false;
      this.bump(liveRoom); this.options.onChanged?.(liveRoom.id);
    }, wait);
    room.bantauRoundTimer.unref?.();
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
    if (next.phase === 'finished') { this.clearNoituDeadline(room); this.settleRound(room, next.winnerId, 'timeout', gameId); }
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
    if (next.phase === 'finished') { this.clearNoituDeadline(room); this.settleRound(room, next.winnerId, 'timeout', next.gameId); }
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
    const matchInProgress = room.match !== null && room.match.status !== 'finished'; this.removeSeat(room, seat);
    if (matchInProgress) this.cancelMatch(room, seat.nickname + ' hết thời gian kết nối lại; trận bị hủy.');
    if (room.players.size === 0) this.destroy(room); else { this.bump(room); this.options.onChanged?.(room.id); }
  }
  private cleanup() {
    const now = this.now();
    for (const room of [...this.rooms.values()]) {
      if (room.phase === 'waiting' && now - room.lastActivity >= WAITING_TTL_MS) this.destroy(room, 'expired');
      else if (room.phase === 'playing' && room.gameKey !== 'bantau' && now - room.lastActivity >= 15 * 60_000) {
        this.clearNoituDeadline(room); this.clearCaroDeadline(room); this.clearNoituDraft(room);
        room.phase = 'waiting'; room.game = null; room.noituGame = null; room.caroGame = null; room.bantauGame = null; room.notice = 'Ván bị hủy vì không có lượt chơi trong 15 phút.'; room.pauseStartedAt = null;
        for (const seat of room.players.values()) seat.ready = false;
        this.bump(room); this.options.onChanged?.(room.id);
      }
      if (room.pauseStartedAt !== null && now - room.pauseStartedAt >= 5 * 60_000 && (room.phase === 'playing' || room.match?.status === 'intermission')) {
        this.cancelMatch(room, 'Trận bị hủy sau 5 phút gián đoạn kết nối.'); this.bump(room); this.options.onChanged?.(room.id);
      }
    }
  }
  private destroy(room: Room, reason: RoomClosedPayload['reason'] = 'empty') {
    this.clearUnoDeadline(room); this.clearNoituDeadline(room); this.clearCaroDeadline(room); this.clearBantauDeadline(room); this.clearBantauRoundLimit(room); this.clearNextRound(room); this.clearNoituDraft(room);
    const message = reason === 'expired' ? 'Phòng đã đóng vì hết thời gian chờ.' : reason === 'shutdown' ? 'Máy chủ đang khởi động lại; phòng đã đóng.' : 'Phòng không còn người chơi.';
    this.options.onClosed?.({ roomId: room.id, reason, message }, [...room.players.values()].flatMap((player) => player.socketId ? [player.socketId] : []));
    for (const player of room.players.values()) if (player.graceTimer) clearTimeout(player.graceTimer);
    for (const timer of room.offlineTimers) clearTimeout(timer);
    room.offlineTimers.clear(); this.rooms.delete(room.id); this.byCode.delete(room.code);
  }
}
