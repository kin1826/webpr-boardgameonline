/** Split Vietnamese text into visual graphemes without separating tone marks. */
export function splitGraphemes(value: string): string[] {
  const normalized = value.normalize('NFC');
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('vi', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(normalized), (part) => part.segment);
  }

  const graphemes: string[] = [];
  for (const codePoint of Array.from(normalized)) {
    if (/\p{Mark}/u.test(codePoint) && graphemes.length) {
      graphemes[graphemes.length - 1] += codePoint;
    } else {
      graphemes.push(codePoint);
    }
  }
  return graphemes;
}

export type StableTile = { id: number; text: string };
export type TileDiff = { ordered: StableTile[]; added: StableTile[]; removed: StableTile[]; nextId: number };

export function splitWordTiles(word: string): string[] {
  const parts = word.normalize('NFC').split(/(\s+)/).filter(Boolean);
  return parts.flatMap((part) => /^\s+$/.test(part) ? [' '] : splitGraphemes(part));
}

/** Normal deletion ghosts; rejected proposal fragments are captured outside flow. */
export function tileMotionClass(tile: { exiting?: boolean; fadeOnly?: boolean }): 'is-fracturing' | 'is-fading' | '' {
  if (tile.exiting) return tile.fadeOnly ? 'is-fading' : 'is-fracturing';
  return '';
}

export type RejectionPresentation = {
  id: number;
  gameId: string;
  turnId: string;
  proposalId: string;
  proposerId: string;
  word: string;
  acceptCount: number;
  rejectCount: number;
};

/** Proposal/vote/reject/draft share one row for the entire authoritative turn. */
export function activeTurnRowKey(gameId: string, turnId: string): string {
  return `active-${gameId}-${turnId}`;
}

/** LCS matching preserves identity through insertions, deletions, and repeated letters. */
export function diffGraphemeTiles(previous: StableTile[], nextText: string[], nextId: number): TileDiff {
  const rows = previous.length + 1;
  const cols = nextText.length + 1;
  const table = Array.from({ length: rows }, () => new Uint16Array(cols));
  for (let i = previous.length - 1; i >= 0; i--) {
    for (let j = nextText.length - 1; j >= 0; j--) {
      table[i][j] = previous[i].text === nextText[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const retained: StableTile[] = [];
  const removed: StableTile[] = [];
  const added: StableTile[] = [];
  let i = 0; let j = 0;
  while (i < previous.length && j < nextText.length) {
    if (previous[i].text === nextText[j]) { retained.push(previous[i]); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) removed.push(previous[i++]);
    else added.push({ id: nextId++, text: nextText[j++] });
  }
  while (i < previous.length) removed.push(previous[i++]);
  while (j < nextText.length) added.push({ id: nextId++, text: nextText[j++] });

  // Preserve the requested new order for rendering; removed tiles render as temporary ghosts.
  const retainedById = new Map(retained.map((tile) => [tile.id, tile]));
  const addedByText = new Map<string, StableTile[]>();
  for (const tile of added) addedByText.set(tile.text, [...(addedByText.get(tile.text) ?? []), tile]);
  const ordered = nextText.map((text) => {
    const old = retained.find((tile) => tile.text === text && retainedById.has(tile.id));
    if (old) { retainedById.delete(old.id); return old; }
    const match = addedByText.get(text)?.shift();
    return match!;
  });
  return { ordered, added, removed, nextId };
}

export type ProposalView = { gameId: string; turnId: string; phase: string; historyCount: number; paused: boolean; proposalId: string | null; proposalWord: string | null };

export function rejectedProposalBetween(previous: ProposalView | null, current: ProposalView): string | null {
  if (!previous || !previous.proposalId || !previous.proposalWord || current.proposalId !== null) return null;
  if (previous.gameId !== current.gameId || previous.turnId !== current.turnId || current.phase !== 'turn') return null;
  if (previous.historyCount !== current.historyCount || previous.paused || current.paused) return null;
  return previous.proposalWord;
}
