import { describe, expect, it } from 'vitest';
import { loadNoituDictionary } from './noitu-dictionary.ts';

describe('runtime dictionary NT-VI-1', () => {
  it('loads the pinned server-only snapshot and seeds from the repository root', () => {
    const { dictionary, seedWords } = loadNoituDictionary();
    expect(dictionary.version).toBe('underthesea-2c078cf-ntvi1-curation-1');
    expect(seedWords).toContain('nấu cơm');
    expect(dictionary.has('nấu cơm')).toBe(true);
    expect(dictionary.has('cơm nước')).toBe(true);
    expect(dictionary.has('lọc cọc')).toBe(true);
    expect(dictionary.isDenied('cơm nước')).toBe(false);
  });
});
