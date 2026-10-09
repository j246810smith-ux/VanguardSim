"""Regenerate src/cards/index.ts from the sets that have both data and a script file.
Usage: gen_index.py <repo> <dataVersion>"""
import sys, os, re
os.chdir(sys.argv[1])
version = sys.argv[2]
sets = sorted(
    f[:-5] for f in os.listdir('data/cards')
    if re.fullmatch(r'(BT|TD)\d{2}\.json', f) and os.path.exists(f'src/cards/{f[:-5]}.ts')
)
order = lambda s: (int(s[2:]) if s.startswith('BT') else 100 + int(s[2:]))
sets.sort(key=order)
lines = ['/** The real card pool: imported data + ability scripts per set (boosters, then trial decks). */']
lines += [f"import {s.lower()}Data from '../../data/cards/{s}.json';" for s in sets]
lines += [f"import {{ {s} }} from './{s}';" for s in sets]
lines += [
    "import { registryFor, type SetAbilities } from './load';",
    "import type { SetFile } from './record';",
    '',
    'export const SETS: readonly { readonly file: SetFile; readonly abilities: SetAbilities }[] = [',
]
lines += [f'  {{ file: {s.lower()}Data as SetFile, abilities: {s} }},' for s in sets]
lines += [
    '];',
    '',
    '/** Bump whenever card data or ability scripts change (recorded in saves and replays). */',
    f"export const CARD_DATA_VERSION = '{version}';",
    '',
    'export const cardRegistry = () => registryFor(SETS, CARD_DATA_VERSION);',
    '',
]
open('src/cards/index.ts', 'w', encoding='utf8', newline='').write('\n'.join(lines))
print('registered:', ' '.join(sets))
