import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeNoituWord, type NoituDictionary } from '@banban/noitu';

type Manifest = {
  dataset_version: string;
  playable_sha256: string;
  playable_count: number;
  seed_words: string[];
  deny_words: string[];
};
export type RuntimeNoituDictionary = { dictionary: NoituDictionary; seedWords: readonly string[] };

export function loadNoituDictionary(): RuntimeNoituDictionary {
  const base = fileURLToPath(new URL('../../data/word-chain/', import.meta.url));
  const wordsBytes = readFileSync(base + 'playable-words.txt');
  const manifest = JSON.parse(readFileSync(base + 'playable-manifest.json', 'utf8')) as Manifest;
  const hash = createHash('sha256').update(wordsBytes).digest('hex');
  if (!manifest.dataset_version || hash !== manifest.playable_sha256) throw new Error('SHA-256 playable dictionary không khớp manifest.');
  const words = new Set(wordsBytes.toString('utf8').split(/\r?\n/u).filter(Boolean));
  if (words.size !== manifest.playable_count) throw new Error('Số mục playable dictionary không khớp manifest.');
  for (const word of words) if (normalizeNoituWord(word) !== word) throw new Error(`Mục từ không chuẩn hóa: ${word}`);
  for (const seed of manifest.seed_words) if (!words.has(seed)) throw new Error(`Từ mồi không có trong bộ playable: ${seed}`);
  const denied = new Set(manifest.deny_words);
  return {
    seedWords: [...manifest.seed_words],
    dictionary: {
      version: manifest.dataset_version,
      has: (word) => words.has(word),
      isDenied: (word) => denied.has(word),
    },
  };
}
