import { useMemo, useState } from 'react';
import { PLAY_FORMATS, type FormatKey } from '../../../src/engine';
import { DEFAULT_SLEEVE } from '../cosmetics';
import { randomSeed, seedFrom } from '../game/seed';
import type { AiLevel, DemoSpeed, SessionConfig } from '../game/session';
import { useSettings } from '../settings';
import { deckEntries, DeckList } from './deckChoice';

const LEVELS: readonly (readonly [AiLevel, string])[] = [
  ['random', 'Easy'],
  ['basic', 'Normal'],
  ['smart', 'Hard'],
];
const SPEEDS: readonly (readonly [DemoSpeed, string])[] = [
  ['normal', 'Normal'],
  ['fast', 'Fast'],
  ['veryfast', 'Very fast'],
];

/** What the demonstration setup remembers when the player comes back to it. */
export interface DemoChoice {
  readonly format: FormatKey;
  readonly p1: number;
  readonly p2: number;
  readonly p1Level: AiLevel;
  readonly p2Level: AiLevel;
  readonly seed: string;
  readonly speed: DemoSpeed;
}

const FIRST: DemoChoice = {
  format: 'classic',
  p1: 0,
  p2: 1,
  p1Level: 'smart',
  p2Level: 'smart',
  seed: '',
  speed: 'normal',
};

/**
 * CPU Deck Demonstration (v0.28): pick two decks (the same one twice is fine), the format, the
 * AIs, a seed and the speed, then watch the CPUs play each other.
 */
export function DemoSetup({
  initial,
  onBack,
  onStart,
}: {
  initial: DemoChoice | null;
  onBack: () => void;
  onStart: (config: SessionConfig, choice: DemoChoice) => void;
}) {
  const settings = useSettings();
  const [c, setC] = useState<DemoChoice>(initial ?? FIRST);
  const set = (patch: Partial<DemoChoice>) => setC((prev) => ({ ...prev, ...patch }));
  const entries = useMemo(() => deckEntries(c.format), [c.format]);
  const p1 = entries[c.p1] ?? entries[0]!;
  const p2 = entries[c.p2] ?? entries[0]!;
  const ready = p1.legal && p2.legal;
  const start = () => {
    if (!ready) return;
    onStart(
      {
        seed: seedFrom(c.seed) ?? randomSeed(),
        myDeck: p1.deck,
        myDeckName: p1.name,
        aiDeck: p2.deck,
        aiDeckName: p2.name,
        aiLevel: c.p2Level,
        format: c.format,
        demo: { p1Level: c.p1Level, speed: c.speed },
        mySleeve: p1.sleeve ?? settings.defaultSleeve,
        aiSleeve: p2.sleeve ?? DEFAULT_SLEEVE,
        playmat: settings.playmat,
      },
      c,
    );
  };
  const seg = <T extends string>(
    options: readonly (readonly [T, string])[],
    value: T,
    pick: (v: T) => void,
    id: string,
  ) => (
    <span className="seg">
      {options.map(([v, label]) => (
        <button
          key={v}
          className={value === v ? 'on' : ''}
          onClick={() => pick(v)}
          data-testid={`${id}-${v}`}
        >
          {label}
        </button>
      ))}
    </span>
  );
  return (
    <div className="menu" style={{ justifyContent: 'flex-start', paddingTop: 40 }}>
      <h1 className="title" style={{ fontSize: 52 }}>
        CPU DEMONSTRATION
      </h1>
      <div className="row">
        Format
        {seg(
          (Object.keys(PLAY_FORMATS) as FormatKey[]).map((k) => [k, PLAY_FORMATS[k].label]),
          c.format,
          (format) => set({ format, p1: 0, p2: 1 }),
          'demo-format',
        )}
      </div>
      <div className="setup">
        <div>
          <h2 style={{ color: 'var(--me)' }}>CPU 1 DECK</h2>
          <DeckList entries={entries} selected={c.p1} onSelect={(p1) => set({ p1 })} />
          <div className="row" style={{ marginTop: 8 }}>
            AI {seg(LEVELS, c.p1Level, (p1Level) => set({ p1Level }), 'demo-p1')}
          </div>
        </div>
        <div>
          <h2 style={{ color: 'var(--opp)' }}>CPU 2 DECK</h2>
          <DeckList entries={entries} selected={c.p2} onSelect={(p2) => set({ p2 })} />
          <div className="row" style={{ marginTop: 8 }}>
            AI {seg(LEVELS, c.p2Level, (p2Level) => set({ p2Level }), 'demo-p2')}
          </div>
        </div>
      </div>
      <div className="row">
        <button
          className="btn"
          onClick={() => set({ p1: c.p2, p2: c.p1, p1Level: c.p2Level, p2Level: c.p1Level })}
          data-testid="demo-swap"
        >
          ⇄ Swap decks
        </button>
        <span style={{ marginLeft: 24 }}>Speed</span>
        {seg(SPEEDS, c.speed, (speed) => set({ speed }), 'demo-speed')}
        <span style={{ marginLeft: 24 }}>Seed</span>
        <input
          className="text"
          placeholder="random"
          value={c.seed}
          onChange={(e) => set({ seed: e.target.value })}
          title="Blank: a new game each time. The same seed with the same decks and AIs replays the same game."
          data-testid="demo-seed"
        />
      </div>
      <div className="hint" style={{ maxWidth: 900, textAlign: 'center' }}>
        {ready
          ? `${p1.name} vs ${p2.name} — ${PLAY_FORMATS[c.format].label}. You only watch: pause, change the speed or restart at any time.`
          : `Not legal in ${PLAY_FORMATS[c.format].label}: ${[p1, p2]
              .filter((d) => !d.legal)
              .map((d) => d.name)
              .join(', ')}`}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="menu-btn" style={{ width: 300 }} onClick={onBack}>
          BACK
        </button>
        <button
          className="menu-btn"
          style={{ width: 300 }}
          onClick={start}
          disabled={!ready}
          data-testid="demo-start"
        >
          START DEMONSTRATION
        </button>
      </div>
    </div>
  );
}
