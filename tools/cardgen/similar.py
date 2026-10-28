"""For each card to script, print the most similar card text that already has a spec entry.

    python tools/cardgen/similar.py <repo> <SET> [--only-en] [--top N]

Compares English texts with difflib over every `tools/cardgen/specs/*.py` entry and prints the
best matches with their spec code, so a new card can start from a script that already works.
`--only-en`: only the English-only cards of the set (ids ending in "EN", DECISIONS D-031).
"""
import difflib
import glob
import json
import os
import sys


def load_texts(repo):
    texts = {}
    for f in glob.glob(os.path.join(repo, 'data', 'cards', '*.json')):
        d = json.load(open(f, encoding='utf-8'))
        for c in d.get('cards', []) if isinstance(d, dict) else []:
            rec = c.get('en') or c.get('jp')
            if rec and rec.get('text'):
                texts[c['id']] = rec['text']
    return texts


def load_specs(repo):
    specs = {}
    for f in glob.glob(os.path.join(repo, 'tools', 'cardgen', 'specs', '*.py')):
        ns = {}
        exec(open(f, encoding='utf-8').read(), ns)
        specs.update(ns.get('CARDS', {}))
    return specs


def main():
    repo, set_ = sys.argv[1], sys.argv[2]
    only_en = '--only-en' in sys.argv
    top = int(sys.argv[sys.argv.index('--top') + 1]) if '--top' in sys.argv else 1
    texts = load_texts(repo)
    specs = load_specs(repo)
    known = [(i, texts[i]) for i in specs if i in texts]
    d = json.load(open(os.path.join(repo, 'data', 'cards', f'{set_}.json'), encoding='utf-8'))
    for c in d['cards']:
        if only_en and not c['id'].endswith('EN'):
            continue
        if c['id'] in specs:
            continue
        text = (c.get('en') or c.get('jp'))['text']
        if not text:
            continue
        scored = sorted(
            ((difflib.SequenceMatcher(None, text, t).ratio(), i) for i, t in known),
            reverse=True,
        )[:top]
        print(f"=== {c['id']} {(c.get('en') or c.get('jp'))['name']}")
        print(text)
        for score, i in scored:
            print(f'--- {score:.2f} {i}: {texts[i]}')
            print(specs[i])
        print()


if __name__ == '__main__':
    main()
