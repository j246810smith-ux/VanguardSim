import json, sys, glob, os
os.chdir(sys.argv[1])
target = sys.argv[2]
others = []
for f in glob.glob('data/cards/*.json'):
    d = json.load(open(f, encoding='utf8'))
    if 'cards' in d and d['set'] != target: others += d['cards']
name = lambda c: (c['en'] or c['jp'])['name']
d = json.load(open(f'data/cards/{target}.json', encoding='utf8'))
for c in d['cards']:
    orig = next((o for o in sorted(others, key=lambda o: o['id']) if name(o) == name(c) and o['grade'] == c['grade'] and o['power'] == c['power']), None)
    if orig: continue
    en = c['en'] or c['jp']
    if not en['text']: continue
    print(f"=== {c['id']} {en['name']} | {en['clan']} | G{c['grade']} {c['power']} sh{c['shield']} {c['skillIcon']} {c['trigger'] or ''} {'SENTINEL' if c['sentinel'] else ''}")
    print(json.dumps(en['text'], ensure_ascii=False))
