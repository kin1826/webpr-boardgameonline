"""Create two-token Vietnamese candidates from the pinned Underthesea JSONL snapshot.

Run from any directory: python3 scripts/filter-vietnamese-dictionary.py
No network access or third-party dependencies. This filters shape, not meaning.
"""
import hashlib
import json
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/word-chain/source/underthesea/words.jsonl'
OUTPUT = ROOT / 'data/word-chain'
LETTERS = set('abcdefghijklmnopqrstuvwxyzđàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ')


def normalize(text):
    return ' '.join(unicodedata.normalize('NFC', text).lower().split())


def main():
    stats = Counter()
    candidates = {}
    for line in SOURCE.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        stats['source_entries'] += 1
        original = entry['text']
        normalized = normalize(original)
        parts = normalized.split()
        if len(parts) != 2:
            stats['excluded_not_two_tokens'] += 1
            continue
        stats['two_token_entries_before_character_filter'] += 1
        if not all(part and all(char in LETTERS for char in part) for part in parts):
            stats['excluded_two_tokens_with_non_vietnamese_characters'] += 1
            continue
        stats['accepted_entries_before_deduplication'] += 1
        record = candidates.setdefault(normalized, {'text': normalized, 'sources': set(), 'originals': set()})
        record['sources'].update(entry.get('source', []))
        record['originals'].add(original)

    words = sorted(candidates)
    records = [dict(text=word, sources=sorted(candidates[word]['sources']), originals=sorted(candidates[word]['originals'])) for word in words]
    stats['unique_candidates'] = len(words)
    stats['duplicates_merged'] = stats['accepted_entries_before_deduplication'] - len(words)
    assert stats['source_entries'] == stats['excluded_not_two_tokens'] + stats['excluded_two_tokens_with_non_vietnamese_characters'] + stats['accepted_entries_before_deduplication']
    assert all(len(word.split()) == 2 and word == normalize(word) for word in words)
    (OUTPUT / 'two-syllable-candidates.txt').write_text(''.join(word + '\n' for word in words), encoding='utf-8')
    (OUTPUT / 'two-syllable-candidates.jsonl').write_text(''.join(json.dumps(record, ensure_ascii=False) + '\n' for record in records), encoding='utf-8')
    report = dict(stats)
    report['source_sha256'] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    report['output_sha256'] = hashlib.sha256((OUTPUT / 'two-syllable-candidates.txt').read_bytes()).hexdigest()
    report['status'] = 'candidates_only_not_semantically_reviewed'
    (OUTPUT / 'filter-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
