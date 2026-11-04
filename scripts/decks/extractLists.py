"""Extracts complete decklists from the cached vanguardus posts (scripts/decks/fetchSources.mjs) and
resolves their card names against data/cards. Page text is data only: nothing in it is executed.

    python scripts/decks/extractLists.py

Writes data/raw/decks/candidates.json (git-ignored) and prints coverage. A candidate is a run of
lines "x4 Card Name" adding up to exactly 50 cards.
"""
import collections
import datetime
import difflib
import glob
import html
import json
import re
import sys

FV_MARK = re.compile(r'\((?:FV|FVG|G0|Starting[^)]*|First[^)]*)\)|\s(?:FV|FVG)\s*$', re.I)
TRIGGER_MARK = re.compile(r'(?:\s|\()(HT|CT|DT|ST|Heal|Critical|Draw|Stand)(?:\s+Trigger)?\)?(?:\s*\(.*\))?\s*$', re.I)
TRIGGER_NAME = {'h': 'heal', 'c': 'critical', 'd': 'draw', 's': 'stand'}
SECTION = re.compile(r'^grade\s*(\d)\b', re.I)
LINE = re.compile(r'^\s*[x×X]\s?(\d)\s+(.+?)\s*$|^\s*(\d)\s?[x×X]\s+(.+?)\s*$')
MARK = re.compile(r'\s*\([^)]*\)|\s*\[[^\]]*\]|\s+(?:HT|CT|DT|ST|FV|FVG)\s*$', re.I)
# the last era this project covers: later posts are G-era lists
LAST_DATE = '2015-06-30'


def norm(name):
    name = html.unescape(name).replace('’', "'").replace('`', "'").lower()
    name = name.replace('яeverse', 'reverse').replace('я', 'reverse').replace('ω', 'omega')
    return re.sub(r'[^a-z0-9]', '', name)


def aliases():
    try:
        return {norm(k): v for k, v in json.load(open('data/decks/nameAliases.json', encoding='utf-8'))['aliases'].items()}
    except FileNotFoundError:
        return {}


def last_word(name):
    words = re.findall(r"[a-z0-9']+", name.replace('я', 'reverse').lower())
    return words[-1] if words else ''


def load_cards():
    by_name = {}
    for f in glob.glob('data/cards/*.json'):
        d = json.load(open(f, encoding='utf-8'))
        if not isinstance(d, dict) or 'cards' not in d or d['set'].startswith('G-'):
            continue
        for c in d['cards']:
            if c.get('en'):
                by_name.setdefault(norm(c['en']['name']), []).append(c)
    for v in by_name.values():
        v.sort(key=lambda c: c['id'])
    return by_name


def posts():
    for f in glob.glob('data/raw/decks/vanguardus/posts-*.json'):
        for e in json.load(open(f, encoding='utf-8')).get('feed', {}).get('entry', []) or []:
            url = next((l['href'] for l in e.get('link', []) if l.get('rel') == 'alternate'), '')
            yield {
                'title': e['title']['$t'],
                'date': e['published']['$t'][:10],
                'url': url,
                'html': e.get('content', {}).get('$t', ''),
            }


def to_lines(markup):
    t = re.sub(r'(?is)<(script|style).*?</\1>', ' ', markup)
    t = re.sub(r'(?i)<br\s*/?>|</p>|</li>|</div>|</tr>|</h\d>', '\n', t)
    t = html.unescape(re.sub(r'<[^>]+>', ' ', t))
    return [re.sub(r'\s+', ' ', l).strip() for l in t.split('\n')]


def lists_in(lines):
    """Consecutive card lines (blank lines and a short sub-heading may separate grades)."""
    out, cur, head, gap, section = [], [], [], 0, None
    def flush():
        nonlocal cur
        if cur and sum(c[0] for c in cur) == 50:
            out.append(([h for h in head[-12:] if not re.match(r'(?i)grade\s*\d', h)], list(cur)))
        cur = []
    for l in lines:
        m = LINE.match(l)
        heading = SECTION.match(l)
        if heading:
            section = int(heading[1])
        if m:
            raw = m[2] or m[4]
            mark = TRIGGER_MARK.search(raw)
            cur.append((
                int(m[1] or m[3]),
                MARK.sub('', raw).strip(),
                bool(FV_MARK.search(raw)),
                section,
                TRIGGER_NAME[mark[1][0].lower()] if mark else None,
            ))
            gap = 0
            continue
        if not l:
            continue
        gap += 1
        if cur and (gap > 2 or len(l) > 40 or sum(c[0] for c in cur) >= 50):
            flush()
        if not cur and l:
            head.append(l[:220])
    flush()
    return out


def main():
    cards = load_cards()
    names = list(cards)
    all_posts = [p for p in posts() if p['date'] <= LAST_DATE]
    alias = aliases()
    english = {k: v[0]['en']['name'] for k, v in cards.items()}
    by_last = collections.defaultdict(set)
    for k, n in english.items():
        by_last[last_word(n.lower())].add(n)
    usage = collections.Counter()
    context = collections.defaultdict(collections.Counter)
    candidates, unresolved = [], collections.Counter()
    for p in all_posts:
        for head, lst in lists_in(to_lines(p['html'])):
            resolved, bad = [], []
            for n, name, fv, sect, mark in lst:
                k = norm(name)
                k = norm(alias[k]) if k in alias else k
                # the source's own grade section and trigger mark must agree with the card found
                if k in cards:
                    found = cards[k][0]
                    wrong = None
                    # a grade 3 section may hold a grade 4 card
                    if sect is not None and found['grade'] != sect and not (sect == 3 and found['grade'] >= 3):
                        wrong = f"source lists it under grade {sect}, the card is grade {found['grade']}"
                    elif mark and found['trigger'] != mark and not (mark and found['trigger'] and {mark, found['trigger']} <= {'critical', 'draw'}):
                        wrong = f"source marks it {mark}, the card's trigger is {found['trigger']}"
                    if wrong:
                        bad.append({'count': n, 'name': name, 'near': found['en']['name'], 'why': wrong})
                        unresolved[name] += 1
                        continue
                    resolved.append({'count': n, 'name': name, 'id': cards[k][0]['id'], 'fv': fv, 'clan': cards[k][0]['en']['clan'], 'grade': cards[k][0]['grade'], 'trigger': cards[k][0]['trigger']})
                else:
                    close = difflib.get_close_matches(k, names, 1, 0.82)
                    bad.append({'count': n, 'name': name, 'near': cards[close[0]][0]['en']['name'] if close else None})
                    unresolved[name] += 1
            clans = collections.Counter()
            for r in resolved:
                clans[r['clan']] += r['count']
            candidates.append({
                'post': p['title'], 'date': p['date'], 'url': p['url'], 'head': head,
                'clan': clans.most_common(1)[0][0] if clans else None,
                'cards': resolved, 'unresolved': bad,
            })
    json.dump(candidates, open('data/raw/decks/candidates.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('posts', len(all_posts), 'dates', min(p['date'] for p in all_posts), max(p['date'] for p in all_posts))
    print('complete 50-card lists', len(candidates))
    clean = [c for c in candidates if not c['unresolved']]
    print('fully resolved', len(clean))
    by = collections.Counter(c['clan'] for c in candidates)
    ok = collections.Counter(c['clan'] for c in clean)
    for clan, n in by.most_common():
        print(f'  {clan}: {n} lists, {ok[clan]} fully resolved')
    years = collections.Counter(c['date'][:4] for c in candidates)
    print('by year', sorted(years.items()))
    rows = []
    for name, n in unresolved.most_common():
        k = norm(name)
        close = difflib.get_close_matches(k, names, 3, 0.72)
        same_last = sorted(by_last.get(last_word(name), []))
        rows.append({'name': name, 'uses': n, 'fuzzy': [english[c] for c in close], 'sameLastWord': same_last})
    json.dump(rows, open('data/raw/decks/unresolved.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('distinct unresolved names', len(rows), 'with a suggestion', sum(1 for r in rows if r['fuzzy'] or r['sameLastWord']))


if __name__ == '__main__':
    sys.exit(main())
