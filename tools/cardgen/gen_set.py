"""Generate src/cards/<SET>.ts from a spec file.
Usage: gen_set.py <repo> <spec.py>

The spec defines SET, DOC (header line), optional IMPORTS (list of TS import lines; otherwise
computed from the shapes used), PRELUDE (TS text) and CARDS = {'TD05-001': "template"}: the
template is a TS array-element list; `{t}` is the whole English text as a TS string literal,
`{t0}`, `{t1}`... its lines, `{T}` the raw text (for shapes that split it), `{name}` the English
name. Reprints (cards:reprints) become sameAs entries (REPRINTS / NOT_REPRINTS adjust them);
cards not in CARDS must have no ability text (reminder-only text allowed) and become [].
"""
import json, os, re, subprocess, sys

NL = chr(10)
BS = chr(92)
repo, spec_path = sys.argv[1], sys.argv[2]
os.chdir(repo)
spec: dict = {}
exec(open(spec_path, encoding='utf8').read(), spec)
SET = spec['SET']
data = json.load(open(f'data/cards/{SET}.json', encoding='utf8'))
out = subprocess.run(
    f'npx tsx scripts/cards/reprints.ts {SET}', shell=True, capture_output=True, text=True,
    encoding='utf8',
).stdout
reprint = dict(re.findall(r'^(\S+) .*reprint of (\S+)', out, re.M))
reprint.update(spec.get('REPRINTS', {}))
for k in spec.get('NOT_REPRINTS', []):
    reprint.pop(k, None)


def lit(s: str) -> str:
    if "'" in s or NL in s:
        return json.dumps(s, ensure_ascii=False)
    return "'" + s.replace(BS, BS + BS) + "'"


reminder = re.compile(r'^\(You may only have up to four cards with .*\)$|^$', re.S)

lines = ['/**', f" * {spec['DOC']} (DECISIONS D-023): ability scripts. Reprints use the",
         " * original's abilities (`sameAs`); the trial-exclusive cards are scripted here.", ' */']
imports = spec.get('IMPORTS')
if imports is None:
    used = NL.join(spec['CARDS'].values()) + spec.get('PRELUDE', '')
    shapes = open('src/cards/shapes.ts', encoding='utf8').read()
    exported = re.findall(r'^export const (\w+)', shapes, re.M)
    names = sorted(n for n in exported if re.search(r'(?<!ab\.)(?<!\w)' + n + r'(?!\w)', used))
    types = [t for t in ('CardFilter', 'Condition', 'Cost', 'Step') if re.search(r'\b' + t + r'\b', used)]
    engine = (['ab'] if 'ab.' in used else []) + [f'type {t}' for t in types]
    imports = ([f"import {{ {', '.join(engine)} }} from '../engine';"] if engine else []) + [
        "import type { SetAbilities } from './load';"]
    if names:
        imports.append('import { ' + ', '.join(names) + " } from './shapes';")
lines += imports + ['', spec.get('PRELUDE', '').strip(), '', f'export const {SET}: SetAbilities = {{']
for c in data['cards']:
    loc = c['en'] or c['jp']  # Japanese-only cards (BT11-055) have no English record
    cid, name = c['id'], loc['name']
    text = (loc.get('text') or '').strip()
    if cid in reprint and cid not in spec['CARDS']:
        lines.append(f"  '{cid}': {{ sameAs: '{reprint[cid]}' }}, // {name}")
        continue
    if cid not in spec['CARDS']:
        if not reminder.match(text):
            sys.exit(f'{cid} {name} has text but no spec:{NL}{text}')
        lines.append(f"  '{cid}': [], // {name}")
        continue
    # QUOTE_SPLIT: cards whose official text joins abilities with '. "[' or '."[' instead of line
    # breaks (a quote after "and"/"gets" opens a granted ability and is not split)
    parts = re.split(r'\n|(?<=\.) ?"(?=\[)', text) if cid in spec.get('QUOTE_SPLIT', []) else text.split(NL)
    fields = {'t': lit(text), 'T': lit(text), 'name': lit(name)}
    fields.update({f't{i}': lit(p) for i, p in enumerate(parts)})
    body = spec['CARDS'][cid]
    for k, v in fields.items():
        body = body.replace('{' + k + '}', v)
    lines.append(f'  // {name}')
    lines.append(f"  '{cid}': [{body}],")
lines += ['};', '']
open(f'src/cards/{SET}.ts', 'w', encoding='utf8', newline='').write(NL.join(lines))
print(f'wrote src/cards/{SET}.ts')
