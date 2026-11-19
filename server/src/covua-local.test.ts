import { afterEach, describe, expect, it } from 'vitest';
import { CovuaLocalService } from './covua-local.ts';

const services: CovuaLocalService[] = [];
afterEach(() => { for (const service of services.splice(0)) service.destroyAll(); });

describe('Phiên Cờ vua 2P cùng máy', () => {
  it('nối lại giữ đồng hồ, sau ván mới đổi màu và avatar theo đúng người', () => {
    let now = 0;
    const service = new CovuaLocalService({ now: () => now, randomInt: () => 0 }); services.push(service);
    const created = service.create({ actionId:'00000000-0000-4000-8000-000000000010', whiteNickname:'Trắng', blackNickname:'Đen', whiteAvatarId:2, blackAvatarId:8, clock:{ baseMinutes:5, incrementSeconds:0 } }, 'socket-1');
    expect(created.game.players.find((player) => player.color === 'white')?.nickname).toBe('Trắng');
    now = 1_000; service.disconnect(created.credentials.localSessionId, 'socket-1');
    const paused = service.snapshot(created.credentials.localSessionId)!;
    expect(paused.game.clock?.deadlineAt).toBeNull();
    now = 8_000;
    const resumed = service.resume(created.credentials.localSessionId, created.credentials.token, 'socket-2');
    expect(resumed.game.clock?.deadlineAt).toBe(307_000);
    const white = resumed.game.players.find((player) => player.color === 'white')!;
    const resigned = service.action({ actionId:'00000000-0000-4000-8000-000000000011', localSessionId:created.credentials.localSessionId, token:created.credentials.token, expectedRevision:0, gameId:resumed.game.gameId, type:'resign', actingColor:'white' }, 'socket-2');
    expect(resigned.game.phase).toBe('finished');
    const next = service.newGame(created.credentials.localSessionId, created.credentials.token, 'socket-2', resigned.game.revision);
    expect(next.game.players.find((player) => player.id === white.id)?.color).toBe('black');
    expect(next.avatars).toEqual({ white:8, black:2 });
  });
});
