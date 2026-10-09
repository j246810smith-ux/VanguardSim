# Artwork Manager

Vanguard Sim never includes card artwork: it belongs to Bushiroad (see
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)). The game is fully playable without it. The
**Artwork Manager** helps you put images you are entitled to use where the game expects them, check
them, and see what is missing.

## Opening it

- In the game: **Settings → Card artwork → Open Artwork Manager** (Settings also shows how many
  cards have art).
- Or start the program with `--artwork`, e.g. a shortcut to
  `"…\Vanguard Sim.exe" --artwork` (works for the zip and the portable .exe).

It is part of the same program (no separate install, no development tools needed), in its own
window. The game window itself stays offline.

## Where the game looks for art

`cards\` next to the program (zip: the unzipped folder; portable .exe: the folder that holds the
.exe), one sub-folder per set or trial deck, one file per card named by its card ID:

```
cards\
├─ BT01\BT01-001.png
├─ BT09\BT09-012.jpg
└─ TD03\TD03-016.jpg
```

`.png` or `.jpg`; if both exist the game shows the `.png`. The card ID is the set code, a dash and
the three-digit number (printed `BT01/001EN` → `BT01-001`). Restart the game after changes. A
missing or damaged image is drawn as a text card; art never changes a card's rules.

## What it does

| Action          | Details                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Check folder    | Verifies every expected image (real PNG/JPEG content, complete file, ≤ 10 MB, matching extension) and lists installed / missing / invalid / duplicate / unmatched files, per set. Works offline. Unfinished downloads (`*.part-*`) are removed.                                                                                                                                                             |
| Import a folder | Picks up your own images from any folder (two levels of sub-folders) and installs them under the right names. Recognised names: `BT01-001`, `BT01_001`, `bt01_001EN`, `BT01 001en` (any case, `.png`/`.jpg`/`.jpeg`). Files that match no card of the game, second images of the same card, and damaged files are reported and skipped, never guessed. Existing images are kept unless "Replace" is ticked. |
| Download        | Only when you have set up a source (below). Fetches the missing or invalid images of the selected sets, two at a time with a pause between requests, 20 s timeout, size limit and content check. Cancel at any time; starting again continues where it stopped (images already installed are skipped).                                                                                                      |
| Export folder   | Copies the verified images, in the same layout, plus `artwork-manifest.json`, to another folder (e.g. to move them to another copy of the game).                                                                                                                                                                                                                                                            |
| Save report     | A text report of the last check plus the problems of the last import or download.                                                                                                                                                                                                                                                                                                                           |

Every file is written to a temporary file first and renamed into place only when it is complete,
and only to `cards\<SET>\<CARD-ID>.<png|jpg>` of a card in the game: never anywhere else.

## Download sources

**Built in: the official card list** (Bushiroad's Cardfight!! Vanguard website, whose image
addresses the card database records; decision D-027). Press **Download missing images** and the
manager fetches the selected sets' images from there. It only ever downloads when you press the
button, two images at a time with a pause between requests. The images are © Bushiroad and are for
your personal use on your own PC: please don't share or upload them.

You can add other sources (or replace the built-in one by using its id, `official`) in
`artwork-sources.json` in the game's data folder (`%APPDATA%\Vanguard Sim\`; the manager's "Open
data folder" button opens it). Only add a site whose terms allow you to download its images.

```json
{
  "sources": [
    {
      "id": "my-source",
      "name": "My image source",
      "baseUrl": "https://images.example.org",
      "baseUrls": { "en": "https://images.example.org", "jp": "https://jp.example.org" },
      "images": ["en", "jp"],
      "delayMs": 500,
      "attribution": "Where the images come from, shown in the manager."
    }
  ]
}
```

- The image addresses are the card database's image paths (`data/cards/<SET>.json`, fields
  `en.image` / `jp.image`) appended to `baseUrl` (or to `baseUrls.en` / `baseUrls.jp`); `images` is
  the order to try them in. Addresses must be `https` and stay on that host; redirects are refused.
- `delayMs` is the pause after each request per download slot (minimum 250 ms).
- Invalid entries are shown in the manager and never used.

## For developers

| Part                                                                      | File                                                                                                                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest (one entry per card, from the card database), file-name matching | `src/artwork/manifest.ts`                                                                                                                                         |
| Image content checks                                                      | `src/artwork/image.ts`                                                                                                                                            |
| Scan, install, import, export, report                                     | `src/artwork/files.ts`                                                                                                                                            |
| Downloads                                                                 | `src/artwork/download.ts`                                                                                                                                         |
| Source configuration                                                      | `src/artwork/sources.ts`                                                                                                                                          |
| Main-process service                                                      | `src/artwork/service.ts`, bundled with the manifest into `app/main/generated/` by `npm run artwork:build` (part of `npm run app` and `npm run dist:win`)          |
| Window and bridges                                                        | `app/renderer/artwork/`, `app/renderer/artwork.html`, `app/main/preload-*.cjs`, `app/main/main.cjs`                                                               |
| Tests                                                                     | `tests/artwork/artwork.test.ts` (local fixtures and a fake network; no live site), and `npm run dist:smoke` (packaged app: no art, one image, `--artwork` window) |

Keep separate: the game's source (this repository), the packaged program (GitHub Releases), and
downloaded artwork (only on users' PCs; `assets/cards/` and every `cards\` folder are git-ignored and
never packaged).

Coverage: the manifest lists every card of the playable sets (BT01–BT15 and TD01–TD17 except TD15:
1690 cards as of v0.17.0); BT16–BT17 join when their cards are added to the game.
