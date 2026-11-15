import { z } from 'zod';
import type { GameKey, PublicRoomSummary } from '@banban/shared';
import { backendApiUrl, type BackendApiConfig } from './config';

const gameAvailabilitySchema = z.array(z.object({
  key: z.enum(['uno', 'noitu', 'caro']),
  available: z.boolean(),
}));

const publicRoomSchema = z.object({
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/),
  gameKey: z.enum(['uno', 'noitu', 'caro']),
  visibility: z.literal('public'),
  hostName: z.string().min(1).max(24),
  hostAvatarId: z.number().int().min(0).max(11),
  playerCount: z.number().int().min(1).max(6),
  maxPlayers: z.number().int().min(2).max(6),
  phase: z.literal('waiting'),
});

export type GameAvailability = { key: GameKey; available: boolean };

export class HttpApiClient {
  constructor(
    private readonly config: BackendApiConfig,
    private readonly request: typeof fetch = (...args) => fetch(...args),
  ) {}

  async fetchGames(signal?: AbortSignal): Promise<GameAvailability[]> {
    const response = await this.request(backendApiUrl('/api/games', this.config.backendOrigin), { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Không tải được danh sách trò chơi.');
    const parsed = gameAvailabilitySchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('Máy chủ trả về danh sách trò chơi không hợp lệ.');
    return parsed.data;
  }

  async fetchPublicRooms(signal?: AbortSignal): Promise<PublicRoomSummary[]> {
    const response = await this.request(backendApiUrl('/api/rooms', this.config.backendOrigin), { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Không tải được danh sách phòng công khai.');
    const parsed = z.array(publicRoomSchema).safeParse(await response.json());
    if (!parsed.success) throw new Error('Máy chủ trả về danh sách phòng không hợp lệ.');
    return parsed.data;
  }
}
