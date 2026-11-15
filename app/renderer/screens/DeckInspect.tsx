/**
 * A ready-built deck's full list and ratios, and a copy for the Deck Builder (prompt pack
 * 2026-11-15, 3.7). The original is never changed: "Copy to my decks" saves a new deck of your
 * own (its own id and name), which then saves separately like any deck you built.
 */
import { useMemo, useState } from 'react';
import { validateDeck, type DeckList, type FormatKey, PLAY_FORMATS } from '../../../src/engine';
import { newDeckId, saveDeck } from '../decks/storage';
import { ctx } from '../engine';
import { Button, Dialog } from '../ui/kit';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly grade: number;
  readonly count: number;
}

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '0%');

/** Counts by a key, largest first. */
function tally<T>(items: readonly T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const t of items) m.set(key(t), (m.get(key(t)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** The deck's statistics (main deck only; the G deck is listed apart). Exported for tests. */
export function deckStats(deck: DeckList) {
  const main = deck.cards.filter((id) => ctx.registry.has(id)).map((id) => ctx.registry.get(id));
  const byGrade = tally(main, (d) => `Grade ${d.grade}`).sort((a, b) => a[0].localeCompare(b[0]));
  const byTrigger = tally(main, (d) =>
    d.trigger ? `${d.trigger[0]!.toUpperCase()}${d.trigger.slice(1)}` : 'No trigger',
  );
  const byClan = tally(main, (d) => d.clan || 'No clan');
  const byType = tally(main, (d) =>
    d.trigger ? 'Trigger unit' : d.sentinel ? 'Normal unit (sentinel)' : 'Normal unit',
  );
  return { size: main.length, byGrade, byTrigger, byClan, byType };
}

function rowsOf(ids: readonly string[]): Row[] {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()]
    .filter(([id]) => ctx.registry.has(id))
    .map(([id, count]) => {
      const d = ctx.registry.get(id);
      return { id, name: d.name, grade: d.grade, count };
    })
    .sort((a, b) => b.grade - a.grade || b.count - a.count || a.name.localeCompare(b.name));
}

export function DeckInspect({
  name,
  deck,
  format,
  onClose,
  onEdit,
}: {
  name: string;
  deck: DeckList;
  format: FormatKey;
  onClose: () => void;
  /** Open the saved copy in the Deck Builder. */
  onEdit?: (deckId: string) => void;
}) {
  const stats = useMemo(() => deckStats(deck), [deck]);
  const main = useMemo(() => rowsOf(deck.cards), [deck]);
  const gDeck = useMemo(() => rowsOf(deck.gDeck ?? []), [deck]);
  const issues = useMemo(
    () => validateDeck(deck, ctx.registry, PLAY_FORMATS[format].format),
    [deck, format],
  );
  const [copied, setCopied] = useState<string | null>(null);
  const copy = () => {
    const id = newDeckId();
    const ok = saveDeck({
      id,
      name: `${name} (copy)`,
      deck: { ...deck, cards: [...deck.cards], ...(deck.gDeck ? { gDeck: [...deck.gDeck] } : {}) },
      format,
      updated: Date.now(),
    });
    if (ok) setCopied(id);
  };
  const first = ctx.registry.has(deck.firstVanguard)
    ? ctx.registry.get(deck.firstVanguard).name
    : '?';
  const block = (title: string, rows: [string, number][]) => (
    <div className="di-block">
      <h4>{title}</h4>
      {rows.map(([k, n]) => (
        <div key={k} className="di-stat">
          <span>{k}</span>
          <b>{n}</b>
          <span className="di-pct">{pct(n, stats.size)}</span>
        </div>
      ))}
    </div>
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title={name}
      description={`${stats.size} cards · first vanguard ${first}${issues.length ? ` · not legal in this format: ${issues[0]!.message}` : ''}`}
      testId="deck-inspect"
      className="deck-inspect"
      actions={
        <>
          {copied && onEdit ? (
            <Button
              variant="primary"
              onClick={() => onEdit(copied)}
              data-testid="deck-inspect-edit"
            >
              Edit the copy in the Deck Builder
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={copy}
              disabled={copied !== null}
              data-testid="deck-inspect-copy"
            >
              {copied ? 'Copied to your decks' : 'Copy to my decks'}
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="di-body">
        <div className="di-list" data-testid="deck-inspect-list">
          {main.map((r) => (
            <div key={r.id} className="di-row">
              <b>{r.count}×</b> <span className="di-grade">G{r.grade}</span> {r.name}
            </div>
          ))}
          {gDeck.length > 0 && (
            <>
              <h4>G deck ({deck.gDeck!.length})</h4>
              {gDeck.map((r) => (
                <div key={r.id} className="di-row">
                  <b>{r.count}×</b> {r.name}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="di-stats">
          {block('Grades', stats.byGrade)}
          {block('Triggers', stats.byTrigger)}
          {block('Card types', stats.byType)}
          {block('Clans', stats.byClan)}
        </div>
      </div>
    </Dialog>
  );
}
