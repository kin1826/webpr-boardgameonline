import { io, type Socket } from 'socket.io-client';
import {
  gameEffectSchema, noituDraftClearSchema, noituDraftNoticeSchema, parseRoomSnapshot, roomClosedSchema, sessionCredentialsSchema,
  type GameEffectEvent, type GameKey, type NoituDraftNotice, type NoituDraftPayload,
  type CaroActionPayload, type GameSettings, type RoomSnapshot, type RoomVisibility, type SessionCredentials, type GameActionPayload, type NoituActionPayload,
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
};

type ActionEnvelopeKeys = 'actionId' | 'roomId' | 'expectedRevision' | 'gameId';
type IntentWithoutEnvelope<T> = T extends Record<ActionEnvelopeKeys, unknown> ? Omit<T, ActionEnvelopeKeys> : never;
export type UnoActionIntent = IntentWithoutEnvelope<GameActionPayload>;
export type NoituActionIntent = IntentWithoutEnvelope<NoituActionPayload>;
export type CaroActionIntent = IntentWithoutEnvelope<CaroActionPayload>;

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
  onSessionRevoked?: (payload: { message?: string }) => void;
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
    const onSessionRevoked = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return handlers.onSessionRevoked?.({});
      const message = 'message' in raw && typeof raw.message === 'string' ? raw.message : undefined;
      handlers.onSessionRevoked?.({ ...(message ? { message } : {}) });
    };

    this.socket.on('connect', onConnect);
    this.socket.on('disconnect', onDisconnect);
    this.socket.on('connect_error', onConnectError);
    this.socket.on('room:closed', onRoomClosed);
    this.socket.on('room:snapshot', onSnapshot);
    this.socket.on('noitu:draft:changed', onDraftChanged);
    this.socket.on('noitu:draft:clear', onDraftClear);
    this.socket.on('game:effect', onGameEffect);
    this.socket.on('session:revoked', onSessionRevoked);

    return () => {
      this.socket.off('connect', onConnect);
      this.socket.off('disconnect', onDisconnect);
      this.socket.off('connect_error', onConnectError);
      this.socket.off('room:closed', onRoomClosed);
      this.socket.off('room:snapshot', onSnapshot);
      this.socket.off('noitu:draft:changed', onDraftChanged);
      this.socket.off('noitu:draft:clear', onDraftClear);
      this.socket.off('game:effect', onGameEffect);
      this.socket.off('session:revoked', onSessionRevoked);
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
        if ('credentials' in value) {
          const parsed = sessionCredentialsSchema.safeParse(value.credentials);
          if (!parsed.success) return resolve({ ok: false, code: 'INVALID_RESPONSE', message: 'Máy chủ trả về phiên phòng không hợp lệ.' });
          credentials = parsed.data;
        }
        resolve({
          ok,
          ...(typeof value.code === 'string' ? { code: value.code } : {}),
          ...(typeof value.message === 'string' ? { message: value.message } : {}),
          ...(typeof value.actionId === 'string' ? { actionId: value.actionId } : {}),
          ...(typeof value.sequence === 'number' ? { sequence: value.sequence } : {}),
          ...(snapshot ? { snapshot } : {}), ...(credentials ? { credentials } : {}),
        });
      });
    });
  }
}
