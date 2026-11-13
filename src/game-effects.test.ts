import { describe, expect, it } from 'vitest';
import type { GameEffectEvent, RoomSnapshot } from '@banban/shared';
import { flightTransform, penaltyImpact, shouldPlayGameEffect } from './game-effects';

it('tính đường bay theo tâm nguồn/đích và kích thước thật của hai lá', () => {
  expect(flightTransform(
    { left: 10, top: 20, width: 40, height: 60 },
    { left: 100, top: 150, width: 50, height: 75 },
  )).toEqual({ translateX: 95, translateY: 137.5, scaleX: 1.25, scaleY: 1.25 });
});

it('intensity tăng theo khoản phạt, có trần desktop/mobile và xử lý số lỗi', () => {
  const values = [2, 4, 8, 12, 16, 40].map((n) => penaltyImpact(n, false));
  expect(values.map((value) => value.amplitude)).toEqual([4, 6, 9, 12, 14, 14]);
  expect(values.map((value) => value.duration)).toEqual([170, 210, 250, 290, 320, 320]);
  expect(values[0]!.amplitude).toBeLessThan(values[1]!.amplitude);
  expect(values[1]!.amplitude).toBeLessThan(values[2]!.amplitude);
  expect(values[2]!.amplitude).toBeLessThan(values[3]!.amplitude);
  expect(values[3]!.amplitude).toBeLessThan(values[4]!.amplitude);
  expect(values[4]).toEqual(values[5]);
  const mobileValues = [2, 4, 8, 12, 16, 40].map((n) => penaltyImpact(n, true).amplitude);
  expect(mobileValues[0]!).toBeLessThan(mobileValues[1]!);
  expect(mobileValues[1]!).toBeLessThan(mobileValues[2]!);
  expect(mobileValues[2]!).toBeLessThan(mobileValues[3]!);
  expect(mobileValues[3]!).toBeLessThan(mobileValues[4]!);
  expect(mobileValues[4]).toBe(8);
  expect(mobileValues[5]).toBe(8);
  expect(penaltyImpact(Number.NaN, false).amplitude).toBe(2);
});

const event: GameEffectEvent = { eventId: 'game-123:4', roomId: 'room-12345', gameId: 'game-123', revision: 9, gameRevision: 4, actionType: 'play', actorId: 'player-a', card: { type: 'number', color: 'red', value: 5 } };
const snapshot = { roomId: event.roomId, revision: 9, game: { gameId: event.gameId, revision: 4 } } as RoomSnapshot;

describe('gating effetti realtime', () => {
  it('accetta solo l’evento corrispondente allo snapshot server', () => expect(shouldPlayGameEffect(event, snapshot, new Set())).toBe(true));
  it('rifiuta eventId già visto e snapshot più vecchio', () => {
    expect(shouldPlayGameEffect(event, snapshot, new Set([event.eventId]))).toBe(false);
    expect(shouldPlayGameEffect(event, { ...snapshot, revision: 8 }, new Set())).toBe(false);
  });
  it('rifiuta event tới trước snapshot, ván cũ hoặc revision không khớp', () => {
    expect(shouldPlayGameEffect(event, null, new Set())).toBe(false);
    expect(shouldPlayGameEffect(event, { ...snapshot, game: { gameId: 'old-game', revision: 4 } }, new Set())).toBe(false);
    expect(shouldPlayGameEffect(event, { ...snapshot, game: { gameId: event.gameId, revision: 3 } }, new Set())).toBe(false);
  });
});
