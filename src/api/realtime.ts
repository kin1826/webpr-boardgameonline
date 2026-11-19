import { io, type Socket } from 'socket.io-client';
import {
  bantauAimStateSchema, bantauEffectSchema, cotuongPublicGameSchema, covuaPublicGameSchema, gameEffectSchema, noituDraftClearSchema, noituDraftNoticeSchema, parseRoomSnapshot, roomClosedSchema, sessionCredentialsSchema,
  type BantauActionPayload, type BantauAimPayload, type BantauEffectEvent, type BantauPlacementPayload, type BantauPublicGame, type GameEffectEvent, type GameKey, type NoituDraftNotice, type NoituDraftPayload,
  type CaroActionPayload, type CovuaActionPayload, type CovuaLocalActionPayload, type CovuaLocalCreatePayload, type CovuaLocalNewGamePayload, type CovuaLocalResumePayload, type CotuongActionPayload, type CotuongLocalActionPayload, type CotuongLocalCreatePayload, type CotuongLocalNewGamePayload, type CotuongLocalResumePayload, type GameSettings, type RoomSnapshot, type RoomVisibility, type SessionCredentials, type GameActionPayload, type NoituActionPayload,
} from '@banban/shared';
import { createActionId } from '../action-id';
import type { BackendApiConfig } from './config';

export type ApiReply = {
  ok: boolean;
  code?: string;
  message?: string;
  actionId?: string;
  snapshot?: RoomSnapshot;
  credentials?: SessionCredentials;
  sequence?: number;
  aim?: BantauPublicGame['ownAim'];
  cotuongGame?: import('@banban/cotuong').CotuongPublicGame;
  localCredentials?: { localSessionId: string; token: string };
  localAvatars?: { red: number; black: number };
  covuaGame?: import('@banban/shared').CovuaPublicGame;
  covuaAvatars?: { white: number; black: number };
};

type ActionEnvelopeKeys = 'actionId' | 'roomId' | 'expectedRevision' | 'gameId';
type IntentWithoutEnvelope<T> = T extends Record<ActionEnvelopeKeys, unknown> ? Omit<T, ActionEnvelopeKeys> : never;
export type UnoActionIntent = IntentWithoutEnvelope<GameActionPayload>;
export type NoituActionIntent = IntentWithoutEnvelope<NoituActionPayload>;
export type CaroActionIntent = IntentWithoutEnvelope<CaroActionPayload>;
type PrivateEnvelopeKeys = 'actionId' | 'roomId';
type IntentWithoutPrivateEnvelope<T> = T extends Record<PrivateEnvelopeKeys, unknown> ? Omit<T, PrivateEnvelopeKeys> : never;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type CotuongActionIntent = DistributiveOmit<CotuongActionPayload, ActionEnvelopeKeys>;
export type CovuaActionIntent = DistributiveOmit<CovuaActionPayload, ActionEnvelopeKeys>;
export type CovuaLocalActionIntent = DistributiveOmit<CovuaLocalActionPayload, 'actionId'>;
export type CotuongLocalActionIntent = DistributiveOmit<CotuongLocalActionPayload, 'actionId'>;
export type BantauPlacementIntent = DistributiveOmit<BantauPlacementPayload, 'actionId' | 'roomId'>;
export type BantauAimIntent = IntentWithoutPrivateEnvelope<BantauAimPayload>;
export type BantauActionIntent = DistributiveOmit<BantauActionPayload, 'actionId' | 'roomId' | 'expectedRevision'>;

export type RoomCommandInput =
  | { event: 'room:start' | 'room:rematch' | 'room:leave' }
  | { event: 'room:ready'; ready: boolean }
  | { event: 'room:visibility'; visibility: RoomVisibility }
  | { event: 'room:caro-settings'; winLength: 4 | 5 | 6 }
  | { event: 'room:settings'; settings: GameSettings }
  | { event: 'room:kick'; targetPlayerId: string };

export type RealtimeHandlers = {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onConnectError?: () => void;
  onRoomClosed?: (payload: { roomId: string; message: string }) => void;
  onSnapshot?: (snapshot: RoomSnapshot) => void;
  onDraftChanged?: (draft: NoituDraftNotice) => void;
  onDraftClear?: (payload: { roomId: string }) => void;
  onGameEffect?: (event: GameEffectEvent) => void;
  onBantauEffect?: (event: BantauEffectEvent) => void;
  onSessionRevoked?: (payload: { message?: string }) => void;
  onLocalCotuongChanged?: (payload: { sessionId: string; game: import('@banban/cotuong').CotuongPublicGame; avatars: { red: number; black: number } }) => void;
  onLocalCotuongRevoked?: (payload: { message?: string }) => void;
  onLocalCovuaChanged?: (payload: { sessionId: string; game: import('@banban/shared').CovuaPublicGame; avatars: { white: number; black: number } }) => void;
  onLocalCovuaRevoked?: (payload: { message?: string }) => void;
};

export class RealtimeApiClient {
  private readonly socket: Socket;

  constructor(config: BackendApiConfig) {
    this.socket = io(config.backendOrigin || undefined, {
      path: '/socket.io',
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 8000,
    });
  }

  get connected() { return this.socket.connected; }

  subscribe(handlers: RealtimeHandlers): () => void {
    const onConnect = () => handlers.onConnect?.();
    const onDisconnect = () => handlers.onDisconnect?.();
    const onConnectError = () => handlers.onConnectError?.();
    const onRoomClosed = (raw: unknown) => {
      const parsed = roomClosedSchema.safeParse(raw);
      if (parsed.success) handlers.onRoomClosed?.(parsed.data);
    };
    const onSnapshot = (raw: unknown) => {
      const snapshot = parseRoomSnapshot(raw);
      if (snapshot) handlers.onSnapshot?.(snapshot);
    };
    const onDraftChanged = (raw: unknown) => {
      const parsed = noituDraftNoticeSchema.safeParse(raw);
      if (parsed.success) handlers.onDraftChanged?.(parsed.data);
    };
    const onDraftClear = (raw: unknown) => {
      const parsed = noituDraftClearSchema.safeParse(raw);
      if (parsed.success) handlers.onDraftClear?.(parsed.data);
    };
    const onGameEffect = (raw: unknown) => {
      const parsed = gameEffectSchema.safeParse(raw);
      if (parsed.success) handlers.onGameEffect?.(parsed.data);
    };
    const onBantauEffect = (raw: unknown) => {
      const parsed = bantauEffectSchema.safeParse(raw);
      if (parsed.success) handlers.onBantauEffect?.(parsed.data);
    };
    const onSessionRevoked = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return handlers.onSessionRevoked?.({});
      const message = 'message' in raw && typeof raw.message === 'string' ? raw.message : undefined;
      handlers.onSessionRevoked?.({ ...(message ? { message } : {}) });
    };
    const onLocalCotuongChanged = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const value = raw as Record<string, unknown>;
      const game = cotuongPublicGameSchema.safeParse(value.game);
      const avatars = value.avatars as Record<string, unknown> | undefined;
      if (typeof value.sessionId === 'string' && game.success && Number.isInteger(avatars?.red) && Number.isInteger(avatars?.black)) handlers.onLocalCotuongChanged?.({ sessionId: value.sessionId, game: game.data, avatars: { red: avatars!.red as number, black: avatars!.black as number } });
    };
    const onLocalCotuongRevoked = (raw: unknown) => {
      const message = raw && typeof raw === 'object' && 'message' in raw && typeof raw.message === 'string' ? raw.message : undefined;
      handlers.onLocalCotuongRevoked?.({ ...(message ? { message } : {}) });
    };

    const onLocalCovuaChanged = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const value = raw as Record<string, unknown>;
      const game = covuaPublicGameSchema.safeParse(value.game);
      const avatars = value.avatars as Record<string, unknown> | undefined;
      if (typeof value.sessionId === 'string' && game.success && Number.isInteger(avatars?.white) && Number.isInteger(avatars?.black)) handlers.onLocalCovuaChanged?.({ sessionId: value.sessionId, game: game.data, avatars: { white: avatars!.white as number, black: avatars!.black as number } });
    };
    const onLocalCovuaRevoked = (raw: unknown) => handlers.onLocalCovuaRevoked?.({ ...(raw && typeof raw === 'object' && 'message' in raw && typeof raw.message === 'string' ? { message: raw.message } : {}) });

    this.socket.on('connect', onConnect);
    this.socket.on('disconnect', onDisconnect);
    this.socket.on('connect_error', onConnectError);
    this.socket.on('room:closed', onRoomClosed);
    this.socket.on('room:snapshot', onSnapshot);
    this.socket.on('noitu:draft:changed', onDraftChanged);
    this.socket.on('noitu:draft:clear', onDraftClear);
    this.socket.on('game:effect', onGameEffect);
    this.socket.on('bantau:effect', onBantauEffect);
    this.socket.on('session:revoked', onSessionRevoked);
    this.socket.on('cotuong:local:changed', onLocalCotuongChanged);
    this.socket.on('cotuong:local:revoked', onLocalCotuongRevoked);
    this.socket.on('covua:local:changed', onLocalCovuaChanged);
    this.socket.on('covua:local:revoked', onLocalCovuaRevoked);

    return () => {
      this.socket.off('connect', onConnect);
      this.socket.off('disconnect', onDisconnect);
      this.socket.off('connect_error', onConnectError);
      this.socket.off('room:closed', onRoomClosed);
      this.socket.off('room:snapshot', onSnapshot);
      this.socket.off('noitu:draft:changed', onDraftChanged);
      this.socket.off('noitu:draft:clear', onDraftClear);
      this.socket.off('game:effect', onGameEffect);
      this.socket.off('bantau:effect', onBantauEffect);
      this.socket.off('session:revoked', onSessionRevoked);
      this.socket.off('cotuong:local:changed', onLocalCotuongChanged);
      this.socket.off('cotuong:local:revoked', onLocalCotuongRevoked);
      this.socket.off('covua:local:changed', onLocalCovuaChanged);
      this.socket.off('covua:local:revoked', onLocalCovuaRevoked);
    };
  }

  createRoom(input: { nickname: string; avatarId: number; visibility: RoomVisibility; gameKey?: GameKey; settings?: GameSettings }): Promise<ApiReply> {
    return this.emitAck('room:create', { actionId: createActionId(), ...input });
  }

  joinRoom(input: { code: string; nickname: string; avatarId: number }): Promise<ApiReply> {
    return this.emitAck('room:join', { actionId: createActionId(), ...input });
  }

  resumeSession(credentials: SessionCredentials): Promise<ApiReply> {
    return this.emitAck('session:resume', credentials);
  }

  roomCommand(roomId: string, expectedRevision: number, command: RoomCommandInput): Promise<ApiReply> {
    const { event, ...body } = command;
    return this.emitAck(event, { actionId: createActionId(), roomId, expectedRevision, ...body });
  }

  gameAction(roomId: string, expectedRevision: number, gameId: string, intent: UnoActionIntent): Promise<ApiReply> {
    return this.emitAck('game:action', { actionId: createActionId(), roomId, expectedRevision, gameId, ...intent });
  }

  noituAction(roomId: string, expectedRevision: number, gameId: string, intent: NoituActionIntent): Promise<ApiReply> {
    return this.emitAck('noitu:action', { actionId: createActionId(), roomId, expectedRevision, gameId, ...intent });
  }

  caroAction(roomId: string, expectedRevision: number, gameId: string, intent: CaroActionIntent): Promise<ApiReply> {
    return this.emitAck('caro:action', { actionId: createActionId(), roomId, expectedRevision, gameId, ...intent });
  }

  bantauPlacement(roomId: string, intent: BantauPlacementIntent): Promise<ApiReply> {
    return this.emitAck('bantau:placement', { actionId: createActionId(), roomId, ...intent });
  }

  bantauAim(roomId: string, intent: BantauAimIntent): Promise<ApiReply> {
    return this.emitAck('bantau:aim', { actionId: createActionId(), roomId, ...intent });
  }

  bantauAction(roomId: string, expectedRevision: number, intent: BantauActionIntent): Promise<ApiReply> {
    return this.emitAck('bantau:action', { actionId: createActionId(), roomId, expectedRevision, ...intent });
  }

  cotuongAction(roomId: string, expectedRevision: number, gameId: string, intent: CotuongActionIntent): Promise<ApiReply> {
    return this.emitAck('cotuong:action', { actionId: createActionId(), roomId, expectedRevision, gameId, ...intent });
  }

  createLocalCotuong(input: Omit<CotuongLocalCreatePayload, 'actionId'>): Promise<ApiReply> {
    return this.emitAck('cotuong:local:create', { actionId: createActionId(), ...input });
  }
  resumeLocalCotuong(input: CotuongLocalResumePayload): Promise<ApiReply> { return this.emitAck('cotuong:local:resume', input); }
  localCotuongAction(input: CotuongLocalActionIntent): Promise<ApiReply> { return this.emitAck('cotuong:local:action', { actionId: createActionId(), ...input }); }
  newLocalCotuong(input: Omit<CotuongLocalNewGamePayload, 'actionId'>): Promise<ApiReply> { return this.emitAck('cotuong:local:new-game', { actionId: createActionId(), ...input }); }
  leaveLocalCotuong(input: CotuongLocalResumePayload): Promise<ApiReply> { return this.emitAck('cotuong:local:leave', input); }

  covuaAction(roomId: string, expectedRevision: number, gameId: string, intent: CovuaActionIntent): Promise<ApiReply> { return this.emitAck('covua:action', { actionId: createActionId(), roomId, expectedRevision, gameId, ...intent }); }
  createLocalCovua(input: Omit<CovuaLocalCreatePayload, 'actionId'>): Promise<ApiReply> { return this.emitAck('covua:local:create', { actionId: createActionId(), ...input }); }
  resumeLocalCovua(input: CovuaLocalResumePayload): Promise<ApiReply> { return this.emitAck('covua:local:resume', input); }
  localCovuaAction(input: CovuaLocalActionIntent): Promise<ApiReply> { return this.emitAck('covua:local:action', { actionId: createActionId(), ...input }); }
  newLocalCovua(input: Omit<CovuaLocalNewGamePayload, 'actionId'>): Promise<ApiReply> { return this.emitAck('covua:local:new-game', { actionId: createActionId(), ...input }); }
  leaveLocalCovua(input: CovuaLocalResumePayload): Promise<ApiReply> { return this.emitAck('covua:local:leave', input); }

  sendNoituDraft(payload: NoituDraftPayload): void {
    if (this.socket.connected) this.socket.emit('noitu:draft', payload);
  }

  close(): void { this.socket.disconnect(); }

  private emitAck(event: string, payload: unknown): Promise<ApiReply> {
    if (!this.socket.connected) return Promise.resolve({ ok: false, code: 'DISCONNECTED', message: 'Đang kết nối lại. Thử lại sau nhé.' });
    return new Promise((resolve) => {
      this.socket.timeout(7000).emit(event, payload, (error: Error | null, raw: unknown) => {
        if (error) return resolve({ ok: false, code: 'TIMEOUT', message: 'Máy chủ chưa phản hồi. Hãy thử lại.' });
        if (!raw || typeof raw !== 'object' || !('ok' in raw) || typeof raw.ok !== 'boolean') return resolve({ ok: false, code: 'INVALID_RESPONSE', message: 'Máy chủ trả về phản hồi không hợp lệ.' });
        const value = raw as Record<string, unknown>;
        const ok = value.ok;
        if (typeof ok !== 'boolean') return resolve({ ok: false, code: 'INVALID_RESPONSE', message: 'Máy chủ trả về phản hồi không hợp lệ.' });
        let snapshot: RoomSnapshot | undefined;
        if ('snapshot' in value) {
          snapshot = parseRoomSnapshot(value.snapshot) ?? undefined;
          if (!snapshot) return resolve({ ok: false, code: 'INVALID_RESPONSE', message: 'Máy chủ trả về bàn chơi không hợp lệ.' });
        }
        let credentials: SessionCredentials | undefined;
        if ('credentials' in value && !(value.credentials && typeof value.credentials === 'object' && 'localSessionId' in value.credentials)) {
          const parsed = sessionCredentialsSchema.safeParse(value.credentials);
          if (!parsed.success) return resolve({ ok: false, code: 'INVALID_RESPONSE', message: 'Máy chủ trả về phiên phòng không hợp lệ.' });
          credentials = parsed.data;
        }
        let aim: ApiReply['aim'];
        if ('aim' in value) {
          const parsed = bantauAimStateSchema.safeParse(value.aim);
          if (!parsed.success) return resolve({ ok: false, code: 'INVALID_RESPONSE', message: 'Máy chủ trả về mục tiêu Bắn tàu không hợp lệ.' });
          aim = parsed.data;
        }
        let cotuongGame: ApiReply['cotuongGame'];
        if ('game' in value) {
          const parsed = cotuongPublicGameSchema.safeParse(value.game);
          if (!parsed.success) return resolve({ ok: false, code: 'INVALID_RESPONSE', message: 'Máy chủ trả về bàn Cờ tướng không hợp lệ.' });
          cotuongGame = parsed.data;
        }
        let localCredentials: ApiReply['localCredentials'];
        if ('credentials' in value && value.credentials && typeof value.credentials === 'object' && 'localSessionId' in value.credentials && 'token' in value.credentials) {
          const local = value.credentials as Record<string, unknown>;
          if (typeof local.localSessionId !== 'string' || typeof local.token !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(local.token)) return resolve({ ok: false, code: 'INVALID_RESPONSE', message: 'Máy chủ trả về phiên Cờ tướng không hợp lệ.' });
          localCredentials = { localSessionId: local.localSessionId, token: local.token };
        }
        const rawAvatars = value.avatars && typeof value.avatars === 'object' ? value.avatars as Record<string, unknown> : null;
        const localAvatars = rawAvatars && Number.isInteger(rawAvatars.red) && Number.isInteger(rawAvatars.black) ? { red: rawAvatars.red as number, black: rawAvatars.black as number } : undefined;
        let covuaGame: ApiReply['covuaGame'];
        if ('covuaGame' in value) { const parsed = covuaPublicGameSchema.safeParse(value.covuaGame); if (!parsed.success) return resolve({ ok: false, code: 'INVALID_RESPONSE', message: 'Máy chủ trả về bàn Cờ vua không hợp lệ.' }); covuaGame = parsed.data; }
        const rawCovuaAvatars = value.covuaAvatars && typeof value.covuaAvatars === 'object' ? value.covuaAvatars as Record<string, unknown> : null;
        const covuaAvatars = rawCovuaAvatars && Number.isInteger(rawCovuaAvatars.white) && Number.isInteger(rawCovuaAvatars.black) ? { white: rawCovuaAvatars.white as number, black: rawCovuaAvatars.black as number } : undefined;
        resolve({
          ok,
          ...(typeof value.code === 'string' ? { code: value.code } : {}),
          ...(typeof value.message === 'string' ? { message: value.message } : {}),
          ...(typeof value.actionId === 'string' ? { actionId: value.actionId } : {}),
          ...(typeof value.sequence === 'number' ? { sequence: value.sequence } : {}),
          ...(snapshot ? { snapshot } : {}), ...(credentials ? { credentials } : {}), ...('aim' in value ? { aim } : {}), ...(cotuongGame ? { cotuongGame } : {}), ...(localCredentials ? { localCredentials } : {}), ...(localAvatars ? { localAvatars } : {}), ...(covuaGame ? { covuaGame } : {}), ...(covuaAvatars ? { covuaAvatars } : {}),
        });
      });
    });
  }
}
