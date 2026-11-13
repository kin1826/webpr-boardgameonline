import { describe, expect, it } from 'vitest';
import { canConfirmGiveUp, claimSingleAction, timelineFollowAfterScroll, timelineFollowAfterSubmit, type GiveUpEligibility, type GiveUpTarget } from './interaction-state';

describe('give-up confirmation guards', () => {
  const target: GiveUpTarget = { gameId: 'g1', turnId: 't1' };
  const eligible: GiveUpEligibility = { ...target, roomPhase: 'playing', gamePhase: 'turn', canGiveUp: true, connected: true, paused: false };

  it('rejects stale or unavailable confirmation intents', () => {
    expect(canConfirmGiveUp(target, eligible)).toBe(true);
    expect(canConfirmGiveUp(target, { ...eligible, turnId: 't2' })).toBe(false);
    expect(canConfirmGiveUp(target, { ...eligible, gameId: 'g2' })).toBe(false);
    expect(canConfirmGiveUp(target, { ...eligible, connected: false })).toBe(false);
    expect(canConfirmGiveUp(target, { ...eligible, paused: true })).toBe(false);
    expect(canConfirmGiveUp(target, { ...eligible, gamePhase: 'voting' })).toBe(false);
    expect(canConfirmGiveUp(target, { ...eligible, canGiveUp: false })).toBe(false);
    expect(canConfirmGiveUp(null, eligible)).toBe(false);
  });

  it('claims a destructive request once, before a rerender can occur', () => {
    const lock = { current: false };
    expect(claimSingleAction(lock)).toBe(true);
    expect(claimSingleAction(lock)).toBe(false);
    lock.current = false;
    expect(claimSingleAction(lock)).toBe(true);
  });
});

describe('timeline latest-follow policy', () => {
  it('preserves the reading position through layout and keyboard viewport changes', () => {
    expect(timelineFollowAfterScroll(true, false, false)).toBe(true);
    expect(timelineFollowAfterScroll(false, false, false)).toBe(false);
  });

  it('stops following only on an intentional upward scroll and resumes at the bottom', () => {
    expect(timelineFollowAfterScroll(true, false, true)).toBe(false);
    expect(timelineFollowAfterScroll(false, true, false)).toBe(true);
  });

  it('returns to the current turn after a successful submit but preserves history on failure', () => {
    expect(timelineFollowAfterSubmit(false, true)).toBe(true);
    expect(timelineFollowAfterSubmit(false, false)).toBe(false);
    expect(timelineFollowAfterSubmit(true, false)).toBe(true);
  });
});
