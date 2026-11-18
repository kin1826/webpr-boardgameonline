import { afterEach, expect, it, vi } from 'vitest';
import type { BantauEffectEvent } from '@banban/shared';
import { createPresentationClock, presentBantauEffect } from './presentation-clock';

const event: BantauEffectEvent = {
  eventId: 'event', shotId: 'shot', roomId: 'room-12345', gameId: 'game', revision: 1,
  turnId: 'turn', actorId: 'a', targetId: 'b', row: 4, col: 2,
  result: 'hit', source: 'manual', serverTime: 1_000_000, presentationExpiresAt: 1_001_200,
};
afterEach(() => vi.restoreAllMocks());

it.each([-120_000, 120_000])('đồng hồ máy lệch %i ms và đổi giờ không làm mất hoặc nhảy hiệu ứng', (offset) => {
  let monotonic = 50;
  vi.spyOn(Date, 'now').mockReturnValue(event.serverTime + offset);
  const clock = createPresentationClock(() => monotonic);
  clock.sync(event.serverTime);
  monotonic += 100;
  const presentation = presentBantauEffect(event, clock.now()!, monotonic)!;
  expect(presentation.startedAt).toBe(50);
  expect(presentation.expiresAt).toBe(1250);
  vi.mocked(Date.now).mockReturnValue(event.serverTime - offset);
  monotonic += 180;
  expect(monotonic - presentation.startedAt).toBe(280);
  expect(clock.now()).toBe(event.serverTime + 280);
});

it('event tới muộn chạy tiếp phần còn lại và hết TTL thì bỏ', () => {
  const late = presentBantauEffect(event, event.serverTime + 600, 100)!;
  expect(100 - late.startedAt).toBe(600);
  expect(late.expiresAt - 100).toBe(600);
  expect(presentBantauEffect(event, event.presentationExpiresAt, 100)).toBeNull();
});

it('snapshot trễ không quay ngược giờ; snapshot mới và reconnect tái neo đúng', () => {
  let monotonic = 0;
  const clock = createPresentationClock(() => monotonic);
  expect(clock.now()).toBeNull();
  clock.sync(1000);
  monotonic = 100;
  clock.sync(1050);
  expect(clock.now()).toBe(1100);
  clock.sync(1200);
  expect(clock.now()).toBe(1200);
  clock.reset();
  expect(clock.now()).toBeNull();
  clock.sync(900);
  monotonic = 150;
  expect(clock.now()).toBe(950);
});

it('snapshot đến sau không đổi timeline của event đã nhận hoặc kéo TTL dài hơn 1200ms', () => {
  let monotonic = 0;
  const clock = createPresentationClock(() => monotonic);
  clock.sync(event.serverTime - 100);
  const presentation = presentBantauEffect(event, clock.now()!, monotonic)!;
  expect(presentation.expiresAt).toBe(1200);
  monotonic = 300;
  clock.sync(event.serverTime + 500);
  expect(presentation.startedAt).toBe(0);
  expect(presentation.expiresAt).toBe(1200);
});
