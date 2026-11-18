import { afterEach, describe, expect, it, vi } from 'vitest';
import { CotuongLocalService } from './cotuong-local.ts';

const createPayload = () => ({
  actionId: crypto.randomUUID(), redNickname: 'Người Đỏ', blackNickname: 'Người Đen',
  redAvatarId: 1, blackAvatarId: 2, clock: null,
});

describe('Phiên Cờ tướng cùng máy', () => {
  let service: CotuongLocalService | undefined;
  afterEach(() => { service?.destroyAll(); service = undefined; vi.useRealTimers(); });

  it('chỉ giữ token băm, xác thực nước hợp lệ phía server và không gia hạn bằng action sai', () => {
    let now = 1_000;
    service = new CotuongLocalService({ now: () => now, randomInt: () => 0 });
    const created = service.create(createPayload(), 'socket-a');
    expect(created.credentials.token).toHaveLength(43);
    expect(created.game.board.filter(Boolean)).toHaveLength(32);
    expect(JSON.stringify(created.game)).not.toContain(created.credentials.token);

    expect(() => service!.action({
      actionId: crypto.randomUUID(), localSessionId: created.credentials.localSessionId, token: 'x'.repeat(43),
      expectedRevision: 0, gameId: created.game.gameId, type: 'move', turnId: created.game.turnId,
      from: created.game.legalMoves[0]!.from, to: created.game.legalMoves[0]!.to,
    }, 'socket-a')).toThrowError(expect.objectContaining({ code: 'LOCAL_SESSION_INVALID' }));

    now += 5_000;
    const move = created.game.legalMoves[0]!;
    const moved = service!.action({
      actionId: crypto.randomUUID(), localSessionId: created.credentials.localSessionId, token: created.credentials.token,
      expectedRevision: 0, gameId: created.game.gameId, type: 'move', turnId: created.game.turnId, from: move.from, to: move.to,
    }, 'socket-a');
    expect(moved.game).toMatchObject({ revision: 1, currentSide: 'black', historyCount: 1 });
    expect(moved.game.lastMove).toMatchObject(move);
  });

  it('nối lại bằng token thu hồi socket cũ; chơi lại chỉ sau khi ván kết thúc và revision còn mới', () => {
    const revoked: string[] = [];
    service = new CotuongLocalService({ randomInt: () => 0, onRevoke: (socketId) => revoked.push(socketId) });
    const created = service.create(createPayload(), 'socket-old');
    const resumed = service!.resume(created.credentials.localSessionId, created.credentials.token, 'socket-new');
    expect(revoked).toEqual(['socket-old']);
    expect(() => service!.action({
      actionId: crypto.randomUUID(), localSessionId: created.credentials.localSessionId, token: created.credentials.token,
      expectedRevision: 0, gameId: created.game.gameId, type: 'move', turnId: created.game.turnId,
      from: created.game.legalMoves[0]!.from, to: created.game.legalMoves[0]!.to,
    }, 'socket-old')).toThrowError(expect.objectContaining({ code: 'LOCAL_SESSION_REPLACED' }));

    expect(() => service!.newGame(created.credentials.localSessionId, created.credentials.token, 'socket-new', 0)).toThrowError(expect.objectContaining({ code: 'GAME_NOT_FINISHED' }));
    const offer = service!.action({
      actionId: crypto.randomUUID(), localSessionId: created.credentials.localSessionId, token: created.credentials.token,
      expectedRevision: resumed.game.revision, gameId: resumed.game.gameId, type: 'resign', actingSide: 'red',
    }, 'socket-new');
    expect(offer.game.phase).toBe('finished');
    expect(() => service!.newGame(created.credentials.localSessionId, created.credentials.token, 'socket-new', 0)).toThrowError(expect.objectContaining({ code: 'STALE_REVISION' }));
    const next = service!.newGame(created.credentials.localSessionId, created.credentials.token, 'socket-new', offer.game.revision, false);
    expect(next.game.gameId).not.toBe(offer.game.gameId);
    expect(next.game.players.find((player) => player.nickname === 'Người Đen')?.side).toBe('red');
  });

  it('tạm dừng đồng hồ khi socket rớt, tiếp tục phần thời gian còn lại', () => {
    vi.useFakeTimers();
    service = new CotuongLocalService({ now: () => Date.now(), randomInt: () => 0 });
    const created = service.create({ ...createPayload(), clock: { baseMinutes: 5, incrementSeconds: 0 } }, 'socket-a');
    vi.advanceTimersByTime(2_500);
    service!.disconnect(created.credentials.localSessionId, 'socket-a');
    const paused = service!.snapshot(created.credentials.localSessionId)!;
    expect(paused.game.clock?.deadlineAt).toBeNull();
    expect(paused.game.clock?.pausedRemainingMs).toBe(297_500);
    vi.advanceTimersByTime(15_000);
    const resumed = service!.resume(created.credentials.localSessionId, created.credentials.token, 'socket-b');
    expect(resumed.game.clock?.deadlineAt).toBe(Date.now() + 297_500);
  });
});
