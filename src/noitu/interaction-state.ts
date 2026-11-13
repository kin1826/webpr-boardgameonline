export type GiveUpTarget = { gameId: string; turnId: string };
export type GiveUpEligibility = GiveUpTarget & {
  roomPhase: string;
  gamePhase: string;
  canGiveUp: boolean;
  connected: boolean;
  paused: boolean;
};

export function canConfirmGiveUp(target: GiveUpTarget | null, latest: GiveUpEligibility): boolean {
  return Boolean(
    target && target.gameId === latest.gameId && target.turnId === latest.turnId &&
    latest.roomPhase === 'playing' && latest.gamePhase === 'turn' && latest.canGiveUp &&
    latest.connected && !latest.paused,
  );
}

/** Synchronous single-flight guard for a destructive action before React can rerender. */
export function claimSingleAction(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function timelineFollowAfterScroll(current: boolean, atBottom: boolean, intentionalUpScroll: boolean): boolean {
  if (intentionalUpScroll) return false;
  if (atBottom) return true;
  return current;
}

export function timelineFollowAfterSubmit(current: boolean, succeeded: boolean): boolean {
  return succeeded ? true : current;
}
