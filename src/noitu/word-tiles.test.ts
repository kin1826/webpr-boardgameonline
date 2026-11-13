import { describe, expect, it } from 'vitest';
import { activeTurnRowKey, diffGraphemeTiles, rejectedProposalBetween, splitGraphemes, type ProposalView } from './word-tiles';

describe('splitGraphemes', () => {
  it('keeps Vietnamese precomposed letters as one tile', () => {
    expect(splitGraphemes('nước')).toEqual(['n', 'ư', 'ớ', 'c']);
  });

  it('normalizes decomposed accents before making tiles', () => {
    expect(splitGraphemes('a\u0302\u0301')).toEqual(['ấ']);
  });

  it('keeps IDs around an inserted grapheme, including repeated characters', () => {
    const before = [...'cơm'].map((text, id) => ({ id, text }));
    const result = diffGraphemeTiles(before, [...'cơmm'], 3);
    expect(result.ordered.map((tile) => tile.text)).toEqual(['c', 'ơ', 'm', 'm']);
    expect(result.ordered.slice(0, 3).map((tile) => tile.id)).toEqual([0, 1, 2]);
    expect(result.added.map((tile) => tile.text)).toEqual(['m']);
    expect(result.removed).toEqual([]);
  });

  it('only removes the changed grapheme when editing a syllable in the middle', () => {
    const before = [...'nước'].map((text, id) => ({ id, text }));
    const result = diffGraphemeTiles(before, [...'nướp'], 4);
    expect(result.ordered.map((tile) => tile.text)).toEqual(['n', 'ư', 'ớ', 'p']);
    expect(result.removed.map((tile) => tile.text)).toEqual(['c']);
    expect(result.added.map((tile) => tile.text)).toEqual(['p']);
    expect(result.ordered.slice(0, 3).map((tile) => tile.id)).toEqual([0, 1, 2]);
  });

  it('recognizes only an authoritative rejected proposal transition', () => {
    const before: ProposalView = { gameId: 'g1', turnId: 't1', phase: 'voting', historyCount: 5, paused: false, proposalId: 'p1', proposalWord: 'cơm lạ' };
    const rejected: ProposalView = { ...before, phase: 'turn', proposalId: null, proposalWord: null };
    expect(rejectedProposalBetween(before, rejected)).toBe('cơm lạ');
    expect(rejectedProposalBetween(before, { ...rejected, historyCount: 6 })).toBeNull();
    expect(rejectedProposalBetween(before, { ...rejected, turnId: 't2' })).toBeNull();
    expect(rejectedProposalBetween({ ...before, paused: true }, rejected)).toBeNull();
    expect(rejectedProposalBetween(before, { ...rejected, paused: true })).toBeNull();
    expect(rejectedProposalBetween(before, { ...rejected, phase: 'finished' })).toBeNull();
  });

  it('keys the active row by game and turn, regardless of proposal ID', () => {
    expect(activeTurnRowKey('g1', 't1')).toBe(activeTurnRowKey('g1', 't1'));
    expect(activeTurnRowKey('g1', 't2')).not.toBe(activeTurnRowKey('g1', 't1'));
  });
});
