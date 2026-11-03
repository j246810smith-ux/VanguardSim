/**
 * Deck builder (blueprint DECK_BUILDER_SPEC, DECISIONS D-022), laid out like Dear Days 2's deck
 * edit (user's request, 2026-11-03): the whole deck as cards on the left (main deck sorted by
 * grade, and the G deck for the G era, D-034), the card pool on the right with a search that
 * narrows as you type (Enter adds the top card, Esc clears). Save / load / import / export /
 * sleeve & mat / test hand as before.
 */
import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { exportDeck, parseDeck } from '../../../src/decks/text';
import {
  maxCopiesOf,
  PLAY_FORMATS,
  validateDeck,
  type CardDefinition,
  type DeckList,
  type FormatKey,
} from '../../../src/engine';
import {
  deleteDeck,
  formatOfSaved,
  loadDecks,
  newDeckId,
  saveDeck,
  type SavedDeck,
} from '../decks/storage';
import { buildIndex, search, type SearchEntry } from '../decks/search';
import { clanColor, ctx, metaOf } from '../engine';
import { CardView } from '../ui/CardView';
import { playmatOf, sleeveLook } from '../cosmetics';
import { useSettings } from '../settings';
import { PlaymatPicker, SleevePicker } from '../ui/CosmeticPickers';

type Pool = { defs: CardDefinition[]; index: SearchEntry[] };
/** The card pool of each format (Classic: BT01–BT17 and side sets; G era: those plus G sets). */
const POOLS = Object.fromEntries(
  (Object.keys(PLAY_FORMATS) as FormatKey[]).map((key) => {
    const legal = PLAY_FORMATS[key].format.legalSets;
    const defs = ctx.registry
      .all()
      .filter((d) => legal.includes(d.set))
      .sort((a, b) => a.id.localeCompare(b.id));
    return [key, { defs, index: buildIndex(defs) }];
  }),
) as Record<FormatKey, Pool>;
const ALL_DEFS = POOLS.g.defs;
const SETS = [...new Set(ALL_DEFS.map((d) => d.set))];
const CLANS = [...new Set(ALL_DEFS.map((d) => d.clan))].filter((c) => c && c !== '-').sort();
const RARITIES = [
  ...new Set(ALL_DEFS.map((d) => metaOf(d.id)?.rarity ?? '').filter(Boolean)),
].sort();
/** How many pool cards are drawn at once (more on "Show more"), so typing stays instant. */
export const PAGE = 140;

interface Filters {
  set: string;
  clan: string;
  grade: string;
  trigger: string;
  type: string;
  power: string;
  rarity: string;
}
const NO_FILTERS: Filters = {
  set: '',
  clan: '',
  grade: '',
  trigger: '',
  type: '',
  power: '',
  rarity: '',
};

function matches(d: CardDefinition, f: Filters): boolean {
  if (f.set && d.set !== f.set) return false;
  if (f.clan && d.clan !== f.clan) return false;
  if (f.grade && d.grade !== Number(f.grade)) return false;
  if (f.trigger === 'none' && d.trigger !== null) return false;
  if (f.trigger && f.trigger !== 'none' && d.trigger !== f.trigger) return false;
  if (f.type === 'normal' && d.cardType !== 'normal_unit') return false;
  if (f.type === 'trigger' && d.cardType !== 'trigger_unit') return false;
  if (f.type === 'g_unit' && d.cardType !== 'g_unit') return false;
  if (f.type === 'sentinel' && !d.sentinel) return false;
  if (f.power && d.power < Number(f.power)) return false;
  if (f.rarity && metaOf(d.id)?.rarity !== f.rarity) return false;
  return true;
}

const shuffle = <T,>(items: readonly T[]): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Deck order on screen: grade 4 → 0, triggers after the other grade 0 cards, then by number. */
const deckOrder = (a: string, b: string) => {
  const x = ctx.registry.get(a);
  const y = ctx.registry.get(b);
  return y.grade - x.grade || Number(!!x.trigger) - Number(!!y.trigger) || a.localeCompare(b);
};

type Modal =
  | { kind: 'details'; id: string }
  | { kind: 'load' }
  | { kind: 'import'; text: string; problems: readonly string[] }
  | { kind: 'export'; text: string }
  | { kind: 'hand'; order: string[]; drawn: number }
  | { kind: 'sleeve' };

export function DeckBuilder({ onBack }: { onBack: () => void }) {
  const settings = useSettings();
  const [deckId, setDeckId] = useState<string | null>(null);
  const [name, setName] = useState('New deck');
  const [format, setFormat] = useState<FormatKey>('classic');
  /** This deck's sleeve and playmat (D-033); null: the defaults from Settings. */
  const [sleeve, setSleeve] = useState<string | null>(null);
  const [playmat, setPlaymat] = useState<string | null>(null);
  const [cards, setCards] = useState<string[]>([]);
  const [gDeck, setGDeck] = useState<string[]>([]);
  const [first, setFirst] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [limit, setLimit] = useState(PAGE);
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedDeck[]>(loadDecks);
  const searchBox = useRef<HTMLInputElement>(null);

  const rules = PLAY_FORMATS[format].format;
  const gEra = rules.maxGDeckSize.value > 0;
  const q = useDeferredValue(query);
  const shown = useMemo(
    () => search(POOLS[format].index, q).filter((e) => matches(e.def, filters)),
    [format, q, filters],
  );
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of [...cards, ...gDeck]) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [cards, gDeck]);
  const startingVanguard =
    first && cards.includes(first)
      ? first
      : (cards.find((id) => ctx.registry.get(id).grade === 0) ?? null);
  const deck: DeckList = {
    firstVanguard: startingVanguard ?? '',
    cards,
    ...(gDeck.length > 0 ? { gDeck } : {}),
  };
  const issues = validateDeck(deck, ctx.registry, rules);
  const defs = cards.map((id) => ctx.registry.get(id));
  const triggers = (t: string) => defs.filter((d) => d.trigger === t).length;
  const ofGrade = (g: number) => defs.filter((d) => d.grade === g).length;
  const triggerTotal = defs.filter((d) => d.trigger).length;
  const sortedMain = useMemo(() => [...cards].sort(deckOrder), [cards]);
  const sortedG = useMemo(() => [...gDeck].sort(), [gDeck]);

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };
  const sameName = (list: readonly string[], n: string) =>
    list.filter((x) => ctx.registry.get(x).name === n).length;
  // the latest lists, so several quick clicks before a re-render all count
  const latest = useRef({ cards, gDeck });
  latest.current = { cards, gDeck };
  const put = (next: { cards?: string[]; gDeck?: string[] }) => {
    latest.current = { ...latest.current, ...next };
    if (next.cards) setCards(next.cards);
    if (next.gDeck) setGDeck(next.gDeck);
    setDirty(true);
  };
  const add = (id: string) => {
    const d = ctx.registry.get(id);
    const max = maxCopiesOf(d, rules);
    const now = latest.current;
    if (d.cardType === 'g_unit') {
      if (!gEra) return flash('G units go in a G era deck');
      if (sameName(now.gDeck, d.name) >= max)
        return flash(`At most ${max} copies of this card name`);
      if (now.gDeck.length >= rules.maxGDeckSize.value)
        return flash(`A G deck has at most ${rules.maxGDeckSize.value} cards`);
      put({ gDeck: [...now.gDeck, id] });
    } else {
      if (sameName(now.cards, d.name) >= max)
        return flash(`At most ${max} copies of this card name`);
      if (now.cards.length >= rules.deckSize.value)
        return flash(`A deck has ${rules.deckSize.value} cards`);
      put({ cards: [...now.cards, id] });
    }
  };
  const remove = (id: string) => {
    const g = ctx.registry.get(id).cardType === 'g_unit';
    const list = g ? latest.current.gDeck : latest.current.cards;
    const i = list.lastIndexOf(id);
    if (i < 0) return;
    const next = list.filter((_, k) => k !== i);
    put(g ? { gDeck: next } : { cards: next });
  };
  const changeFormat = (next: FormatKey) => {
    if (next === format) return;
    if (PLAY_FORMATS[next].format.maxGDeckSize.value === 0 && gDeck.length > 0) {
      if (!window.confirm('Original Era decks have no G deck. Remove the G deck?')) return;
      setGDeck([]);
    }
    setFormat(next);
    setLimit(PAGE);
    if (cards.length > 0 || gDeck.length > 0) setDirty(true);
  };
  const loadInto = (d: SavedDeck | null) => {
    setDeckId(d?.id ?? null);
    setName(d?.name ?? 'New deck');
    if (d) setFormat(formatOfSaved(d));
    setSleeve(d?.sleeve ?? null);
    setPlaymat(d?.playmat ?? null);
    setCards(d ? [...d.deck.cards] : []);
    setGDeck(d ? [...(d.deck.gDeck ?? [])] : []);
    setFirst(d?.deck.firstVanguard ?? null);
    setDirty(false);
    setModal(null);
  };
  const save = (asCopy: boolean) => {
    const id = asCopy || !deckId ? newDeckId() : deckId;
    const entry: SavedDeck = {
      id,
      name: name.trim() || 'Untitled deck',
      deck,
      format,
      ...(sleeve ? { sleeve } : {}),
      ...(playmat ? { playmat } : {}),
      updated: Date.now(),
    };
    if (!saveDeck(entry)) return flash('Could not save (storage unavailable)');
    setDeckId(id);
    setDirty(false);
    setSaved(loadDecks());
    flash(issues.length ? 'Saved (not legal yet)' : 'Saved');
  };
  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved changes?');
  const details = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    setModal({ kind: 'details', id });
  };
  const set = (k: keyof Filters) => (e: { target: { value: string } }) => {
    setFilters({ ...filters, [k]: e.target.value });
    setLimit(PAGE);
  };

  return (
    <div className="builder dd">
      <div className="builder-head">
        <button className="btn" onClick={() => confirmDiscard() && onBack()}>
          ← Menu
        </button>
        <h1>DECK EDIT</h1>
        <div className="format-switch" data-testid="deck-format">
          {(Object.keys(PLAY_FORMATS) as FormatKey[]).map((key) => (
            <button
              key={key}
              className={`btn ${format === key ? 'primary' : ''}`}
              onClick={() => changeFormat(key)}
              data-testid={`deck-format-${key}`}
            >
              {PLAY_FORMATS[key].label}
            </button>
          ))}
        </div>
        <input
          className="text deck-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          data-testid="deck-name"
        />
        <span className="hint">Click a card to add or remove it · right-click for details</span>
      </div>

      <section className="dd-deck">
        <div className="dd-label">
          <b>MAIN DECK</b>
          <span className={cards.length === rules.deckSize.value ? 'ok' : 'bad'}>
            {cards.length}/{rules.deckSize.value}
          </span>
          <span className={triggerTotal === rules.triggerCount.value ? 'ok' : 'bad'}>
            {triggerTotal}/{rules.triggerCount.value} triggers
          </span>
          <span>
            ★{triggers('critical')} · draw {triggers('draw')} · stand {triggers('stand')} · heal{' '}
            {triggers('heal')}
          </span>
          <span>sentinels {defs.filter((d) => d.sentinel).length}</span>
          <span>
            G3 {ofGrade(3)} · G2 {ofGrade(2)} · G1 {ofGrade(1)} · G0 {ofGrade(0)}
          </span>
        </div>
        <div className={`dd-main ${gEra ? '' : 'tall'}`} data-testid="deck-list">
          {sortedMain.map((id, i) => {
            const d = ctx.registry.get(id);
            const isFirst = id === startingVanguard && sortedMain.indexOf(id) === i;
            return (
              <div
                key={`${id}-${i}`}
                className={`dd-tile ${isFirst ? 'first' : ''}`}
                style={{ '--clan': clanColor(d.clan) } as CSSProperties}
                onClick={() => remove(id)}
                onContextMenu={details(id)}
                title={`${d.name} (click to remove)`}
                data-testid={`deck-card-${id}`}
              >
                <CardView definitionId={id} width={84} height={122} />
                {d.grade === 0 && !d.trigger && (
                  <button
                    className={`star ${isFirst ? 'on' : ''}`}
                    title="Starting vanguard"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFirst(id);
                      setDirty(true);
                    }}
                  >
                    ★
                  </button>
                )}
              </div>
            );
          })}
          {cards.length === 0 && (
            <div className="hint dd-empty">Click cards on the right to add them to your deck.</div>
          )}
        </div>
        {gEra && (
          <>
            <div className="dd-label">
              <b>G DECK</b>
              <span>
                {gDeck.length}/{rules.maxGDeckSize.value}
              </span>
              <span className="hint">G units you click in the pool go here</span>
            </div>
            <div className="dd-g" data-testid="g-deck">
              {sortedG.map((id, i) => (
                <div
                  key={`${id}-${i}`}
                  className="dd-tile g"
                  onClick={() => remove(id)}
                  onContextMenu={details(id)}
                  title={`${ctx.registry.get(id).name} (click to remove)`}
                  data-testid={`g-card-${id}`}
                >
                  <CardView definitionId={id} width={54} height={79} />
                </div>
              ))}
              {Array.from({ length: rules.maxGDeckSize.value - gDeck.length }, (_, i) => (
                <div key={`empty-${i}`} className="dd-slot" />
              ))}
            </div>
          </>
        )}
        <div className="deck-issues" data-testid="deck-issues">
          {issues.length === 0 ? (
            <span className="ok">
              ✓ Legal {PLAY_FORMATS[gEra ? 'g' : 'classic'].label} deck · starting vanguard{' '}
              {startingVanguard && ctx.registry.get(startingVanguard).name}
            </span>
          ) : (
            issues.map((i) => <div key={i.message}>• {i.message}</div>)
          )}
        </div>
        <div className="deck-buttons">
          <button className="btn gold" onClick={() => save(false)} data-testid="save-deck">
            Save
          </button>
          <button className="btn" onClick={() => save(true)}>
            Save copy
          </button>
          <button className="btn" onClick={() => setModal({ kind: 'load' })}>
            Load…
          </button>
          <button
            className="btn"
            onClick={() => setModal({ kind: 'sleeve' })}
            data-testid="deck-sleeve"
            title={`Sleeve: ${sleeve ? sleeveLook(sleeve).name : 'default'} · Playmat: ${
              playmat ? playmatOf(playmat).name : 'default'
            }`}
          >
            Sleeve &amp; mat…
          </button>
          <button className="btn" onClick={() => confirmDiscard() && loadInto(null)}>
            New
          </button>
          <button
            className="btn"
            onClick={() => setModal({ kind: 'import', text: '', problems: [] })}
          >
            Import…
          </button>
          <button
            className="btn"
            onClick={() => setModal({ kind: 'export', text: exportDeck(name, deck, ctx.registry) })}
          >
            Export…
          </button>
          <button
            className="btn"
            disabled={cards.length < 5}
            onClick={() => setModal({ kind: 'hand', order: shuffle(cards), drawn: 5 })}
          >
            Test hand
          </button>
        </div>
      </section>

      <section className="dd-pool">
        <div className="dd-search">
          <input
            ref={searchBox}
            className="text"
            autoFocus
            placeholder="Search: name, number (BT01/001), clan, race or text…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
              if (e.key === 'Enter' && shown[0]) add(shown[0].def.id);
            }}
            data-testid="card-search"
          />
          {query && (
            <button
              className="mini-btn"
              title="Clear the search"
              onClick={() => {
                setQuery('');
                searchBox.current?.focus();
              }}
            >
              ×
            </button>
          )}
          <span className="hint" data-testid="pool-count">
            {shown.length} cards
          </span>
        </div>
        <div className="builder-filters">
          <select value={filters.set} onChange={set('set')}>
            <option value="">All sets</option>
            {SETS.filter((x) => POOLS[format].defs.some((d) => d.set === x)).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select value={filters.clan} onChange={set('clan')}>
            <option value="">All clans</option>
            {CLANS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={filters.grade} onChange={set('grade')}>
            <option value="">Any grade</option>
            {[0, 1, 2, 3, 4].map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
          <select value={filters.trigger} onChange={set('trigger')}>
            <option value="">Any trigger</option>
            <option value="none">No trigger</option>
            {['critical', 'draw', 'stand', 'heal'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={filters.type} onChange={set('type')}>
            <option value="">Any type</option>
            <option value="normal">Normal unit</option>
            <option value="trigger">Trigger unit</option>
            <option value="sentinel">Sentinel</option>
            {gEra && <option value="g_unit">G unit</option>}
          </select>
          <select value={filters.power} onChange={set('power')}>
            <option value="">Any power</option>
            {[5000, 6000, 7000, 8000, 9000, 10000, 11000].map((p) => (
              <option key={p} value={p}>
                {p}+
              </option>
            ))}
          </select>
          <select value={filters.rarity} onChange={set('rarity')}>
            <option value="">Any rarity</option>
            {RARITIES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button
            className="btn"
            onClick={() => {
              setFilters(NO_FILTERS);
              setQuery('');
            }}
          >
            Clear
          </button>
        </div>
        <div className="builder-pool" data-testid="card-pool">
          {shown.slice(0, limit).map(({ def: d }) => (
            <div
              key={d.id}
              className="pool-card"
              onClick={() => add(d.id)}
              onContextMenu={details(d.id)}
              data-testid={`pool-${d.id}`}
            >
              <CardView definitionId={d.id} width={112} height={163} />
              {counts.has(d.id) && <span className="count-badge">{counts.get(d.id)}</span>}
              <div className="pool-name">{d.name}</div>
            </div>
          ))}
          {shown.length === 0 && <div className="hint">No cards match.</div>}
          {shown.length > limit && (
            <button className="btn more" onClick={() => setLimit(limit + PAGE)}>
              Show more ({shown.length - limit} left)
            </button>
          )}
        </div>
      </section>

      {modal?.kind === 'details' && (
        <DefinitionDetails id={modal.id} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'sleeve' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal deck-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Sleeve</h2>
            <div className="hint" style={{ marginBottom: 8 }}>
              Your card backs when you play this deck. Built-in sleeves are shown to an online
              opponent; your own images stay on this PC.
            </div>
            <button
              className={`btn ${sleeve === null ? 'primary' : ''}`}
              style={{ marginBottom: 8 }}
              onClick={() => {
                setSleeve(null);
                setDirty(true);
              }}
            >
              Use the default ({sleeveLook(settings.defaultSleeve).name})
            </button>
            <SleevePicker
              value={sleeve ?? ''}
              onChange={(id) => {
                setSleeve(id);
                setDirty(true);
              }}
            />
            <h2 style={{ marginTop: 16 }}>Playmat</h2>
            <button
              className={`btn ${playmat === null ? 'primary' : ''}`}
              style={{ marginBottom: 8 }}
              onClick={() => {
                setPlaymat(null);
                setDirty(true);
              }}
            >
              Use the default ({playmatOf(settings.playmat).name})
            </button>
            <PlaymatPicker
              value={playmat ?? ''}
              onChange={(id) => {
                setPlaymat(id);
                setDirty(true);
              }}
            />
            <div className="buttons" style={{ marginTop: 12 }}>
              <button className="btn gold" onClick={() => setModal(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {modal?.kind === 'load' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal deck-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Your decks</h2>
            {saved.length === 0 && <div className="hint">No saved decks yet.</div>}
            {saved.map((d) => {
              const f = formatOfSaved(d);
              const legal = validateDeck(d.deck, ctx.registry, PLAY_FORMATS[f].format).length === 0;
              return (
                <div key={d.id} className="saved-row">
                  <b>{d.name}</b>
                  <span className="hint">{PLAY_FORMATS[f].label}</span>
                  <span className={legal ? 'ok' : 'bad'}>{legal ? 'legal' : 'not legal'}</span>
                  <button className="btn" onClick={() => confirmDiscard() && loadInto(d)}>
                    Load
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      if (!window.confirm(`Delete "${d.name}"?`)) return;
                      deleteDeck(d.id);
                      setSaved(loadDecks());
                      if (d.id === deckId) setDeckId(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
            <div className="buttons">
              <button className="btn" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {modal?.kind === 'import' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal deck-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Import a deck</h2>
            <div className="hint">
              Paste a deck list, one card per line, e.g. "4x BT01-001 Blaster Blade".
            </div>
            <textarea
              className="deck-text"
              value={modal.text}
              onChange={(e) => setModal({ ...modal, text: e.target.value })}
              data-testid="import-text"
            />
            {modal.problems.map((p) => (
              <div key={p} className="bad">
                {p}
              </div>
            ))}
            <div className="buttons">
              <button
                className="btn gold"
                onClick={() => {
                  const parsed = parseDeck(modal.text, ctx.registry);
                  if (parsed.deck.cards.length === 0)
                    return setModal({
                      ...modal,
                      problems: ['No cards found.', ...parsed.problems],
                    });
                  if (!confirmDiscard()) return;
                  setDeckId(null);
                  setName(parsed.name ?? 'Imported deck');
                  setCards([...parsed.deck.cards]);
                  setGDeck([...(parsed.deck.gDeck ?? [])]);
                  if ((parsed.deck.gDeck?.length ?? 0) > 0) setFormat('g');
                  setFirst(parsed.deck.firstVanguard || null);
                  setDirty(true);
                  setModal(parsed.problems.length ? { ...modal, problems: parsed.problems } : null);
                  flash('Imported — save it to keep it');
                }}
              >
                Import
              </button>
              <button className="btn" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {modal?.kind === 'export' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal deck-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Export “{name}”</h2>
            <textarea className="deck-text" readOnly value={modal.text} />
            <div className="buttons">
              <button
                className="btn gold"
                onClick={() =>
                  navigator.clipboard
                    .writeText(modal.text)
                    .then(() => flash('Copied'))
                    .catch(() => flash('Select the text and copy it'))
                }
              >
                Copy
              </button>
              <a
                className="btn"
                download={`${name.replace(/[^\w -]+/g, '') || 'deck'}.txt`}
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(modal.text)}`}
              >
                Save as file
              </a>
              <button className="btn" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {modal?.kind === 'hand' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal deck-modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>Test hand ({modal.drawn} drawn)</h2>
            <div className="test-hand">
              {modal.order.slice(0, modal.drawn).map((id, i) => (
                <CardView key={i} definitionId={id} width={130} height={189} />
              ))}
            </div>
            <div className="buttons">
              <button
                className="btn gold"
                disabled={modal.drawn >= modal.order.length}
                onClick={() => setModal({ ...modal, drawn: modal.drawn + 1 })}
              >
                Draw
              </button>
              <button
                className="btn"
                onClick={() => setModal({ kind: 'hand', order: shuffle(cards), drawn: 5 })}
              >
                Shuffle again
              </button>
              <button className="btn" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/** A card's printed details (no game state). */
function DefinitionDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const d = ctx.registry.get(id);
  const meta = metaOf(id);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal details" onClick={(e) => e.stopPropagation()}>
        <CardView definitionId={id} width={380} height={553} />
        <div className="info">
          <h2>{d.name}</h2>
          <div className="num">
            {meta?.number ?? id} · {meta?.rarity || '—'} · {d.set}
          </div>
          <dl className="stats">
            <div>
              <dt>GRADE</dt>
              <dd>{d.grade}</dd>
            </div>
            <div>
              <dt>POWER</dt>
              <dd>{d.power}</dd>
            </div>
            <div>
              <dt>SHIELD</dt>
              <dd>{d.shield || '—'}</dd>
            </div>
            <div>
              <dt>CRITICAL</dt>
              <dd>{d.critical}</dd>
            </div>
            <div>
              <dt>CLAN</dt>
              <dd style={{ fontSize: 18 }}>{d.clan}</dd>
            </div>
            <div>
              <dt>TRIGGER</dt>
              <dd style={{ fontSize: 18 }}>{d.trigger ? d.trigger.toUpperCase() : '—'}</dd>
            </div>
          </dl>
          <div className="skill-text">{d.text || 'No abilities.'}</div>
          <div className="buttons" style={{ marginTop: 18 }}>
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
