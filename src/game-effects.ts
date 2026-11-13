import type { GameEffectEvent, RoomSnapshot } from '@banban/shared';

export type Impact = { amplitude: number; duration: number };
export type FlightRect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
export type FlightTransform = { translateX: number; translateY: number; scaleX: number; scaleY: number };
const impactSteps = [
  { total: 0, amplitude: 2, duration: 130 },
  { total: 2, amplitude: 4, duration: 170 },
  { total: 4, amplitude: 6, duration: 210 },
  { total: 8, amplitude: 9, duration: 250 },
  { total: 12, amplitude: 12, duration: 290 },
  { total: 16, amplitude: 14, duration: 320 },
] as const;

/** Map a fixed-position card from one measured center/size to another. */
export function flightTransform(from: FlightRect, to: FlightRect): FlightTransform {
  const sourceWidth = Math.max(1, from.width);
  const sourceHeight = Math.max(1, from.height);
  return {
    translateX: to.left + to.width / 2 - (from.left + from.width / 2),
    translateY: to.top + to.height / 2 - (from.top + from.height / 2),
    scaleX: to.width / sourceWidth,
    scaleY: to.height / sourceHeight,
  };
}

/** Monotonic, bounded screen-space impact driven only by the confirmed penalty total. */
export function penaltyImpact(total: number, mobile: boolean): Impact {
  const safeTotal = Math.min(16, Math.max(0, Number.isFinite(total) ? total : 0));
  const upperIndex = impactSteps.findIndex((step) => safeTotal <= step.total);
  const index = upperIndex < 0 ? impactSteps.length - 1 : upperIndex;
  const lower = impactSteps[Math.max(0, index - 1)]!;
  const upper = impactSteps[index]!;
  const progress = upper.total === lower.total ? 0 : (safeTotal - lower.total) / (upper.total - lower.total);
  const desktopAmplitude = lower.amplitude + (upper.amplitude - lower.amplitude) * progress;
  const duration = lower.duration + (upper.duration - lower.duration) * progress;
  return { amplitude: Math.min(mobile ? 8 : 14, desktopAmplitude * (mobile ? 0.6 : 1)), duration };
}

/** Effects are presentation-only and only run for the exact authoritative snapshot they describe. */
export function shouldPlayGameEffect(event: GameEffectEvent, snapshot: RoomSnapshot | null, seen: ReadonlySet<string>): boolean {
  if (!snapshot || snapshot.roomId !== event.roomId || snapshot.revision !== event.revision || seen.has(event.eventId)) return false;
  const game = snapshot.game;
  return Boolean(game && game.gameId === event.gameId && game.revision === event.gameRevision);
}
