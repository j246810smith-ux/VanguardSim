/**
 * Deck builder (blueprint DECK_BUILDER_SPEC, DECISIONS D-022): search and filter the card pool,
 * build a 50-card deck, see the engine's legality check, save / load / rename / delete decks,
 * import and export them as text, and test opening hands.
 */
import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { exportDeck, parseDeck } from '../../../src/decks/text';
import { maxCopiesOf, validateDeck, type CardDefinition, type DeckList } from '../../../src/engine';
import { deleteDeck, loadDecks, newDeckId, saveDeck, type SavedDeck } from '../decks/storage';
import { clanColor, ctx, metaOf } from '../engine';
import { CardView } from '../ui/CardView';

const ALL: readonly CardDefinition[] = ctx.registry
  .all()
  .filter((d) => ctx.format.legalSets.includes(d.set))
  .sort((a, b) => a.id.localeCompare(b.id));
const SETS = [...new Set(ALL.map((d) => d.set))];
const CLANS = [...new Set(ALL.map((d) => d.clan))].sort();
const RARITIES = [...new Set(ALL.map((d) => metaOf(d.id)?.rarity ?? '').filter(Boolean))].sort();

interface Filters {
  q: string;
  set: string;
  clan: string;
  grade: string;
  trigger: string;
  type: string;
  power: string;
  rarity: string;
}
const NO_FILTERS: Filters = {
  q: '',
  set: '',
  clan: '',
  grade: '',
  trigger: '',
  type: '',
  power: '',
  rarity: '',
};

function matches(d: CardDefinition, f: Filters): boolean {
  const q = f.q.trim().toLowerCase();
  if (q && !`${d.name} ${d.id} ${d.text}`.toLowerCase().includes(q)) return false;
  if (f.set && d.set !== f.set) return false;
  if (f.clan && d.clan !== f.clan) return false;
  if (f.grade && d.grade !== Number(f.grade)) return false;
  if (f.trigger === 'none' && d.trigger !== null) return false;
  if (f.trigger && f.trigger !== 'none' && d.trigger !== f.trigger) return false;
  if (f.type === 'normal' && d.cardType !== 'normal_unit') return false;
  if (f.type === 'trigger' && d.cardType !== 'trigger_unit') return false;
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

type Modal =
  | { kind: 'details'; id: string }
  | { kind: 'load' }
  | { kind: 'import'; text: string; problems: readonly string[] }
  | { kind: 'export'; text: string }
  | { kind: 'hand'; order: string[]; drawn: number };

export function DeckBuilder({ onBack }: { onBack: () => void }) {
  const [deckId, setDeckId] = useState<string | null>(null);
  const [name, setName] = useState('New deck');
  const [cards, setCards] = useState<string[]>([]);
  const [first, setFirst] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedDeck[]>(loadDecks);

  const shown = useMemo(() => ALL.filter((d) => matches(d, filters)), [filters]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of cards) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [cards]);
  const byName = (n: string) => cards.filter((id) => ctx.registry.get(id).name === n).length;
  const startingVanguard =
    first && cards.includes(first)
      ? first
      : (cards.find((id) => ctx.registry.get(id).grade === 0) ?? null);
  const deck: DeckList = { firstVanguard: startingVanguard ?? '', cards };
  const issues = validateDeck(deck, ctx.registry, ctx.format);
  const defs = cards.map((id) => ctx.registry.get(id));
  const triggers = (t: string) => defs.filter((d) => d.trigger === t).length;

  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };
  const edit = (next: string[]) => {
    setCards(next);
    setDirty(true);
  };
  const add = (id: string) => {
    const max = maxCopiesOf(ctx.registry.get(id), ctx.format);
    if (byName(ctx.registry.get(id).name) >= max)
      return flash(`At most ${max} copies of this card name`);
    if (cards.length >= ctx.format.deckSize.value)
      return flash(`A deck has ${ctx.format.deckSize.value} cards`);
    edit([...cards, id]);
  };
  const remove = (id: string) => {
    const i = cards.lastIndexOf(id);
    if (i >= 0) edit(cards.filter((_, k) => k !== i));
  };
  const loadInto = (d: SavedDeck | null) => {
    setDeckId(d?.id ?? null);
    setName(d?.name ?? 'New deck');
    setCards(d ? [...d.deck.cards] : []);
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
      updated: Date.now(),
    };
    if (!saveDeck(entry)) return flash('Could not save (storage unavailable)');
    setDeckId(id);
    setDirty(false);
    setSaved(loadDecks());
    flash(issues.length ? 'Saved (not legal yet)' : 'Saved');
  };
  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved changes?');

  const grouped = [0, 1, 2, 3].map((g) => ({
    grade: g,
    ids: [...counts.keys()]
      .filter((id) => ctx.registry.get(id).grade === g)
      .sort((a, b) => a.localeCompare(b)),
  }));

  const set = (k: keyof Filters) => (e: { target: { value: string } }) =>
    setFilters({ ...filters, [k]: e.target.value });

  return (
    <div className="builder">
      <div className="builder-head">
        <button className="btn" onClick={() => confirmDiscard() && onBack()}>
          ← Menu
        </button>
        <h1>DECK BUILDER</h1>
        <span className="hint">
          Click a card to add it · right-click for details · in the deck, − and + change counts
        </span>
      </div>

      <div className="builder-filters">
        <input
          className="text"
          placeholder="Search name, number or text"
          value={filters.q}
          onChange={set('q')}
        />
        <select value={filters.set} onChange={set('set')}>
          <option value="">All sets</option>
          {SETS.map((s) => (
            <option key={s}>{s}</option>
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
          {[0, 1, 2, 3].map((g) => (
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
        <button className="btn" onClick={() => setFilters(NO_FILTERS)}>
          Clear
        </button>
        <span className="hint">{shown.length} cards</span>
      </div>

      <div className="builder-pool" data-testid="card-pool">
        {shown.map((d) => (
          <div
            key={d.id}
            className="pool-card"
            onClick={() => add(d.id)}
            onContextMenu={(e: MouseEvent) => {
              e.preventDefault();
              setModal({ kind: 'details', id: d.id });
            }}
            data-testid={`pool-${d.id}`}
          >
            <CardView definitionId={d.id} width={118} height={172} />
            {counts.has(d.id) && <span className="count-badge">{counts.get(d.id)}</span>}
            <div className="pool-name">{d.name}</div>
          </div>
        ))}
      </div>

      <div className="builder-deck">
        <input
          className="text deck-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          data-testid="deck-name"
        />
        <div className="deck-stats">
          <span className={cards.length === ctx.format.deckSize.value ? 'ok' : 'bad'}>
            {cards.length}/{ctx.format.deckSize.value} cards
          </span>
          <span
            className={
              defs.filter((d) => d.trigger).length === ctx.format.triggerCount.value ? 'ok' : 'bad'
            }
          >
            {defs.filter((d) => d.trigger).length}/{ctx.format.triggerCount.value} triggers
          </span>
          <span>
            ★{triggers('critical')} · draw {triggers('draw')} · stand {triggers('stand')} · heal{' '}
            {triggers('heal')}
          </span>
          <span>sentinels {defs.filter((d) => d.sentinel).length}</span>
        </div>
        <div className="builder-list" data-testid="deck-list">
          {grouped.map(({ grade, ids }) =>
            ids.length === 0 ? null : (
              <div key={grade}>
                <div className="deck-grade">
                  Grade {grade} · {ids.reduce((n, id) => n + counts.get(id)!, 0)}
                </div>
                {ids.map((id) => {
                  const d = ctx.registry.get(id);
                  const isFirst = id === startingVanguard;
                  return (
                    <div
                      key={id}
                      className="deck-row"
                      style={{ '--clan': clanColor(d.clan) } as CSSProperties}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setModal({ kind: 'details', id });
                      }}
                    >
                      <button className="mini-btn" onClick={() => remove(id)}>
                        −
                      </button>
                      <b>{counts.get(id)}</b>
                      <button className="mini-btn" onClick={() => add(id)}>
                        +
                      </button>
                      <span className="row-name">
                        {d.name}
                        {d.trigger ? <em> {d.trigger}</em> : null}
                        {d.sentinel ? <em> sentinel</em> : null}
                      </span>
                      {grade === 0 && (
                        <button
                          className={`star ${isFirst ? 'on' : ''}`}
                          title="Starting vanguard"
                          onClick={() => {
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
              </div>
            ),
          )}
          {cards.length === 0 && <div className="hint">Click cards on the left to add them.</div>}
        </div>
        <div className="deck-issues" data-testid="deck-issues">
          {issues.length === 0 ? (
            <span className="ok">
              ✓ Legal deck · starting vanguard{' '}
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
      </div>

      {modal?.kind === 'details' && (
        <DefinitionDetails id={modal.id} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'load' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal deck-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Your decks</h2>
            {saved.length === 0 && <div className="hint">No saved decks yet.</div>}
            {saved.map((d) => {
              const legal = validateDeck(d.deck, ctx.registry, ctx.format).length === 0;
              return (
                <div key={d.id} className="saved-row">
                  <b>{d.name}</b>
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
