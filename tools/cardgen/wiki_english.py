"""English name and text for cards whose official English page was never archived (G-BT06 onward).

Usage (repo root, PYTHONIOENCODING=utf-8):
    python tools/cardgen/wiki_english.py . G-BT07 "G_Booster_Set_7:_Glorious_Bravery_of_Radiant_Sword"

Reads data/cards/<SET>.json for cards with a Japanese record and no English one, finds their English
names on the newest pre-2020 Internet Archive copy of the card wiki's set page, then each card's own
wiki page (newest pre-2020 copy), and writes name, effect text (in the official notation:
"[Counter-Blast 1]", "[Generation Break 1]") and the archive URL into scripts/cards/wiki-english.json.
Run `npm run cards:import -- <SET>` afterwards: the importer uses these for the missing cards
(sources.enWiki, checks.englishFromWiki). Downloads are cached in data/raw/archive/<SET>/wiki/.
"""
import html as htmllib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

UA = 'VanguardSim card importer (personal offline simulator)'
BEFORE = '20200101'
HOSTS = ['cardfight.wikia.com', 'cardfight.fandom.com']


def get(url: str, cache: str) -> str:
    if os.path.exists(cache) and os.path.getsize(cache) > 0:
        return open(cache, encoding='utf8', errors='replace').read()
    for attempt in range(4):
        time.sleep(2 + attempt * 5)
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            body = urllib.request.urlopen(req, timeout=90).read().decode('utf8', errors='replace')
        except Exception as e:  # the archive answers 503 when busy: wait and retry
            print(f'  retry {url}: {e}', file=sys.stderr)
            continue
        if 'Internet Archive: Temporarily Offline' in body:
            continue
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        open(cache, 'w', encoding='utf8').write(body)
        return body
    raise RuntimeError(f'could not fetch {url}')


def newest(page: str, cache_dir: str, key: str):
    """(host, timestamp) of the newest pre-2020 archived copy of a wiki page, or None."""
    for host in HOSTS:
        q = urllib.parse.quote(page, safe="_,:()'!&-")
        cdx = get(
            f'https://web.archive.org/cdx/search/cdx?url={host}/wiki/{q}&output=txt'
            f'&filter=statuscode:200&fl=timestamp&to={BEFORE}',
            os.path.join(cache_dir, f'cdx_{key}_{host}.txt'),
        )
        stamps = [l.strip() for l in cdx.splitlines() if re.fullmatch(r'\d{14}', l.strip())]
        if stamps:
            return host, stamps[-1], q
    return None


def official(t: str) -> str:
    """Card-wiki wording → the official English notation."""
    for word in ('Counter Blast', 'Soul Blast', 'Soul Charge', 'Counter Charge'):
        dash = word.replace(' ', '-')
        # inside a cost bracket: "[Counter Blast (1)" / "& Soul Blast (1)"
        t = re.sub(r'\[' + word + r' \((\d+)\)', '[' + dash + r' \1', t)
        t = re.sub(r'& ' + word + r' \((\d+)\)', '& ' + dash + r' \1', t)
        # anywhere else it is a keyword in brackets
        t = re.sub(word + r' \((\d+)\)', '[' + dash + r' \1]', t)
    # "[Counter-Blast 1]-card with X]" (a cost with a filter that the wiki closes early)
    t = re.sub(r'\[(Counter-Blast|Soul-Blast) (\d+)\]-card', r'[\1 \2-card', t)
    t = re.sub(r'\[(Counter-Blast|Soul-Blast) (\d+)\] & ', r'[\1 \2 & ', t)
    t = re.sub(r'(?<!\[)Generation Break (\d)', r'[Generation Break \1]', t)
    t = re.sub(r'\[Power\]\s*\+\s*(\d+)', r'[Power] +\1', t)
    t = re.sub(r'\[Critical\]\s*\+\s*(\d+)', r'[Critical] +\1', t)
    t = re.sub(r'\[Shield\]\s*\+\s*(\d+)', r'[Shield] +\1', t)
    t = t.replace('[AUTO] [', '[AUTO][').replace('[ACT] [', '[ACT][').replace('[CONT] [', '[CONT][')
    t = re.sub(r'\((VC|RC|GC|VC/RC)\) \[', r'(\1)[', t)
    t = t.replace('[[', '[').replace(']]', ']')
    t = re.sub(r'^\[AUTO\]:Forerunner$', '[AUTO]:Forerunner (When a unit of the same clan rides this unit, you may call this unit to (RC))', t, flags=re.M)
    # editors' notes on the wiki page are not card text
    lines = [l.strip() for l in t.split('\n') if l.strip()]
    return '\n'.join(l for l in lines if not l.lower().startswith(('please note', 'note:')))


def effect_text(page_html: str) -> str:
    i = page_html.find('Card Effect(s)')
    if i < 0:
        return ''
    j = page_html.find('</td></tr></table>', i)
    seg = page_html[page_html.find('<td>', i) + 4:j]
    seg = re.sub(r'<br\s*/?>', '\n', seg)
    seg = re.sub(r'<img[^>]*alt="([^"]*)"[^>]*>', r'[\1]', seg)
    t = htmllib.unescape(re.sub(r'<[^>]+>', '', seg)).strip()
    return official(re.sub(r'[ \t]+', ' ', t))


def main():
    repo, set_, set_page = sys.argv[1], sys.argv[2], sys.argv[3]
    cards = json.load(open(os.path.join(repo, 'data', 'cards', f'{set_}.json'), encoding='utf8'))['cards']
    missing = [c for c in cards if c['jp'] and not c['en']]
    cache = os.path.join(repo, 'data', 'raw', 'archive', set_, 'wiki')
    found = newest(set_page, cache, 'set')
    if not found:
        sys.exit(f'no archived copy of {set_page}')
    host, stamp, q = found
    page = get(f'https://web.archive.org/web/{stamp}id_/http://{host}/wiki/{q}', os.path.join(cache, 'set.html'))
    text = re.sub(r'[ \t]+', ' ', re.sub(r'<[^>]+>', ' ', page))
    text = re.sub(r'\n\s*\n+', '\n', htmllib.unescape(text))
    out_path = os.path.join(repo, 'scripts', 'cards', 'wiki-english.json')
    out = json.load(open(out_path, encoding='utf8')) if os.path.exists(out_path) else {}
    for c in missing:
        no = c['id'].split('-')[-1]
        m = re.search(re.escape(f'{set_}/{no}') + r'\s*\n\s*([^\n]+)', text)
        if not m:
            print(f'{c["id"]}: not on the set page')
            continue
        name = m.group(1).strip()
        entry = {'name': name, 'text': '', 'url': f'https://web.archive.org/web/{stamp}/http://{host}/wiki/{q}'}
        if c['jp']['text'].strip() and not c['jp']['text'].startswith('（'):
            card = newest(name.replace(' ', '_'), cache, no)
            if not card:
                print(f'{c["id"]} {name}: no archived wiki page')
                continue
            h, st, cq = card
            body = get(f'https://web.archive.org/web/{st}id_/http://{h}/wiki/{cq}', os.path.join(cache, f'{no}.html'))
            entry = {'name': name, 'text': effect_text(body), 'url': f'https://web.archive.org/web/{st}/http://{h}/wiki/{cq}'}
        elif c['trigger'] == 'heal':
            entry['text'] = '(You may only have up to four cards with "[Heal] HEAL" in a deck.)'
        out[c['id']] = entry
        print(f'{c["id"]} {name}: {len(entry["text"])} chars')
    json.dump(dict(sorted(out.items())), open(out_path, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    open(out_path, 'a', encoding='utf8').write('\n')


if __name__ == '__main__':
    main()
