"""Append starter decks to src/decks/starters.ts. Usage: add_decks.py <repo> <decks.json>
decks.json: [{set, name, description, first, groups: [[count, id, comment], ...]}]"""
import sys, os, json
os.chdir(sys.argv[1])
decks = json.load(open(sys.argv[2], encoding='utf8'))
p = 'src/decks/starters.ts'
s = open(p, encoding='utf8', newline='').read().rstrip()
assert s.endswith('];')
s = s[:-2]
cur_set = None
for d in decks:
    total = 1 + sum(g[0] for g in d['groups'])
    assert total == 50, (d['name'], total)
    if d['set'] != cur_set:
        cur_set = d['set']
        s += f"  // ---- {cur_set} " + '-' * (91 - len(cur_set)) + "\n"
    s += "  {\n"
    s += f"    name: {json.dumps(d['name'], ensure_ascii=False)},\n"
    s += f"    description: {json.dumps(d['description'], ensure_ascii=False)},\n"
    s += "    deck: {\n"
    s += f"      firstVanguard: '{d['first']}',\n"
    s += "      cards: [\n"
    s += f"        ...n(1, '{d['first']}'),\n"
    for count, cid, comment in d['groups']:
        s += f"        ...n({count}, '{cid}'), // {comment}\n"
    s += "      ],\n    },\n  },\n"
s += "];\n"
open(p, 'w', encoding='utf8', newline='').write(s)
print('ok', len(decks))
