import type { BantauEffectEvent } from '@banban/shared';

/** Presentation only: server epoch anchored to the browser's monotonic clock. */
export function createPresentationClock(now: () => number = () => performance.now()) {
  let anchor: { serverTime: number; receivedAt: number } | null = null;
  const serverNow = () => anchor ? anchor.serverTime + Math.max(0, now() - anchor.receivedAt) : null;
  return {
    now: serverNow,
    reset() { anchor = null; },
    sync(serverTime: number) {
      // A delayed snapshot must not rewind an already running presentation.
      anchor = { serverTime: Math.max(serverTime, serverNow() ?? serverTime), receivedAt: now() };
    },
  };
}

export type BantauPresentationEffect = BantauEffectEvent & { startedAt: number; expiresAt: number };

/** Freeze an event onto one local timeline so later snapshots cannot restart it. */
export function presentBantauEffect(event: BantauEffectEvent, serverNow: number, receivedAt: number): BantauPresentationEffect | null {
  const age = Math.max(0, serverNow - event.serverTime);
  const lifetime = event.presentationExpiresAt - event.serverTime;
  if (age >= lifetime) return null;
  return { ...event, startedAt: receivedAt - age, expiresAt: receivedAt + lifetime - age };
}
