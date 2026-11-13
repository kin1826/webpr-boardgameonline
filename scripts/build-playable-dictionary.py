#!/usr/bin/env python3
"""Build the pinned, experimental Noitu runtime word list from reviewed inputs."""
import hashlib
import json
import pathlib
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/word-chain'
SOURCE = DATA / 'two-syllable-candidates.jsonl'
FILTER_REPORT = DATA / 'filter-report.json'
CURATION = DATA / 'curation.json'


def norm(value):
    return ' '.join(unicodedata.normalize('NFC', value).lower().split())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')


def main():
    report = json.loads(FILTER_REPORT.read_text(encoding='utf-8'))
    curation = json.loads(CURATION.read_text(encoding='utf-8'))
    candidate_txt = DATA / 'two-syllable-candidates.txt'
    if sha(candidate_txt) != report['output_sha256']:
        raise SystemExit('Hash TXT ứng viên không khớp filter-report.json; dừng để tránh dùng nhầm snapshot.')

    candidates = {}
    for line in SOURCE.read_text(encoding='utf-8').splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        word = norm(row['text'])
        if len(word.split()) != 2 or word != row['text']:
            raise SystemExit(f'Ứng viên không ở dạng chuẩn: {row["text"]!r}')
        candidates[word] = row
    txt_words = candidate_txt.read_text(encoding='utf-8').splitlines()
    if sorted(candidates) != txt_words or len(candidates) != report['unique_candidates']:
        raise SystemExit('JSONL và TXT ứng viên không khớp nội dung hoặc số dòng.')

    allow = {norm(word): reason.strip() for word, reason in curation.get('reviewed_allow', {}).items()}
    deny = {}
    for row in curation.get('deny_words', []):
        word = norm(row['word'])
        reason = row.get('reason', '').strip()
        if not reason:
            raise SystemExit(f'Denylist phải có lý do: {word}')
        deny[word] = reason
    if set(allow) & set(deny):
        raise SystemExit('Một mục không thể đồng thời nằm trong allow và deny.')

    playable = []
    quarantined = []
    for word, row in sorted(candidates.items()):
        uppercase_only = bool(row.get('originals')) and all(any(char.isupper() for char in original) for original in row['originals'])
        if word in deny:
            continue
        if uppercase_only and word not in allow:
            quarantined.append({**row, 'quarantine_reason': 'uppercase-only-source-heuristic'})
            continue
        playable.append(word)

    for word in allow:
        if word not in candidates:
            raise SystemExit(f'Allow override không có trong ứng viên gốc: {word}')
        if word not in deny and word not in playable:
            playable.append(word)
    playable = sorted(set(playable))
    playable_set = set(playable)

    seed_words = [norm(word) for word in curation.get('seed_words', [])]
    invalid_seeds = [word for word in seed_words if word not in playable_set]
    no_successor = [word for word in seed_words if word.split()[1] not in {candidate.split()[0] for candidate in playable}]
    if invalid_seeds or no_successor:
        raise SystemExit('Seed chưa hợp lệ: ' + json.dumps({'not_playable': invalid_seeds, 'no_successor': no_successor}, ensure_ascii=False))
    if len(set(seed_words)) != len(seed_words):
        raise SystemExit('Seed trùng nhau.')

    words_path = DATA / 'playable-words.txt'
    quarantine_path = DATA / 'quarantine-uppercase-only.jsonl'
    words_path.write_text(''.join(word + '\n' for word in playable), encoding='utf-8')
    quarantine_path.write_text(''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in quarantined), encoding='utf-8')
    manifest = {
        'dataset_version': curation['dataset_version'],
        'source_repository': 'https://github.com/undertheseanlp/dictionary',
        'source_commit': '2c078cfc373b06e2980d324ce1d7bd13740c3319',
        'source_candidate_sha256': report['output_sha256'],
        'playable_sha256': sha(words_path),
        'candidate_count': len(candidates),
        'uppercase_only_quarantined': len(quarantined),
        'reviewed_allow_count': len(allow),
        'deny_count': len(deny),
        'playable_count': len(playable),
        'seed_count': len(seed_words),
        'seed_words': seed_words,
        'deny_words': sorted(deny),
        'status': 'experimental-shape-filtered-not-fully-semantically-reviewed',
        'data_rights': 'Not independently verified per source; do not treat as cleared for public redistribution.'
    }
    write_json(DATA / 'playable-manifest.json', manifest)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
