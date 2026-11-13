/**
 * UI Component Showcase (docs/design/UI_COMPONENT_SYSTEM.md): every kit control in every variant,
 * with game-like sample content, for the owner to approve the look before any control in the game
 * is replaced. Nothing here touches settings, decks or saves: all state is local to this screen.
 */
import { useState } from 'react';
import {
  ArrowLeft,
  Download,
  Layers,
  Play,
  Plus,
  Search,
  Settings,
  Swords,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  IconButton,
  Panel,
  Segmented,
  Select,
  Slider,
  Switch,
  Tabs,
  TextField,
  Tooltip,
} from '../ui/kit';

const TOKENS = [
  ['Background', '--ui-bg'],
  ['Surface', '--ui-surface'],
  ['Surface 2', '--ui-surface-2'],
  ['Charcoal', '--ui-charcoal'],
  ['Electric blue', '--ui-accent'],
  ['Cyan', '--ui-accent-2'],
  ['Gold', '--ui-gold'],
  ['Danger', '--ui-danger'],
  ['Success', '--ui-success'],
] as const;

export function UiShowcase({ onBack }: { onBack: () => void }) {
  const [format, setFormat] = useState<'classic' | 'classic_ou' | 'g'>('classic');
  const [ai, setAi] = useState<'random' | 'basic' | 'smart'>('basic');
  const [deck, setDeck] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState('grade');
  const [tab, setTab] = useState('main');
  const [volume, setVolume] = useState(70);
  const [sfx, setSfx] = useState(40);
  const [effects, setEffects] = useState(true);
  const [autoPass, setAutoPass] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [clans, setClans] = useState<boolean | 'indeterminate'>('indeterminate');
  const [name, setName] = useState('Royal Paladin Seekers');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<null | 'delete' | 'info'>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="ui-showcase" data-testid="ui-showcase">
      <div className="ui-showcase-head">
        <IconButton label="Back" variant="ghost" onClick={onBack} data-testid="showcase-back">
          <ArrowLeft size={18} />
        </IconButton>
        <h1>UI COMPONENT SHOWCASE</h1>
        <Badge tone="accent">PREVIEW</Badge>
      </div>
      <p className="ui-showcase-note">
        A preview of the new controls. Nothing in the game uses them yet, and nothing you change
        here is saved.
      </p>

      <div className="ui-showcase-grid">
        <Panel title="Buttons">
          <div className="ui-row">
            <Button variant="primary" icon={<Play size={16} />}>
              Start battle
            </Button>
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="ui-row">
            <Button variant="gold" icon={<Swords size={16} />}>
              Confirm
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={() => setDialog('delete')}
            >
              Delete deck
            </Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="ui-row">
            <Button size="sm">Small</Button>
            <Button>Medium</Button>
            <Button size="lg" variant="primary">
              LARGE
            </Button>
          </div>
          <div className="ui-row">
            <Button
              variant="primary"
              loading={loading}
              icon={<Download size={16} />}
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 1500);
              }}
            >
              {loading ? 'Downloading…' : 'Download art'}
            </Button>
            <IconButton label="Settings">
              <Settings size={18} />
            </IconButton>
            <IconButton label="New deck" variant="primary">
              <Plus size={18} />
            </IconButton>
            <IconButton label="Delete" variant="ghost">
              <Trash2 size={18} />
            </IconButton>
          </div>
        </Panel>

        <Panel title="Segmented controls">
          <div className="ui-stack">
            <Segmented
              ariaLabel="Format"
              value={format}
              onChange={setFormat}
              options={[
                { value: 'classic', label: 'Original — Strict' },
                { value: 'classic_ou', label: 'Original — Expanded' },
                { value: 'g', label: 'G Era' },
              ]}
            />
            <Segmented
              ariaLabel="AI level"
              value={ai}
              onChange={setAi}
              options={[
                { value: 'random', label: 'Easy' },
                { value: 'basic', label: 'Normal' },
                { value: 'smart', label: 'Hard' },
              ]}
            />
            <Segmented
              ariaLabel="Example with a disabled choice"
              value="a"
              onChange={() => undefined}
              options={[
                { value: 'a', label: 'Offline' },
                { value: 'b', label: 'Ranked', disabled: true },
              ]}
            />
          </div>
        </Panel>

        <Panel title="Dropdowns">
          <div className="ui-stack">
            <Select
              ariaLabel="Deck"
              placeholder="Choose a deck…"
              value={deck}
              onChange={setDeck}
              options={[
                {
                  label: 'G-BT01 Playtest',
                  options: [
                    { value: 'rp', label: 'Royal Paladin Seekers' },
                    { value: 'kg', label: 'Kagero "The X"' },
                  ],
                },
                {
                  label: 'Starter decks',
                  options: [
                    { value: 'ka', label: 'Kagero — Dragonic Overlord' },
                    { value: 'sp', label: 'Shadow Paladin — Phantom Blaster', disabled: true },
                  ],
                },
              ]}
            />
            <Select
              ariaLabel="Sort by"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'grade', label: 'Sort: grade' },
                { value: 'name', label: 'Sort: name' },
                { value: 'power', label: 'Sort: power' },
              ]}
            />
            <Select
              ariaLabel="Disabled dropdown"
              value="x"
              onChange={() => undefined}
              disabled
              options={[{ value: 'x', label: 'Disabled' }]}
            />
          </div>
        </Panel>

        <Panel title="Switches and checkboxes">
          <div className="ui-stack">
            <Switch checked={effects} onChange={setEffects} label="Card effects" />
            <Switch checked={autoPass} onChange={setAutoPass} label="Auto-pass empty guard steps" />
            <Switch checked={false} onChange={() => undefined} label="Disabled" disabled />
            <Checkbox checked={showHints} onChange={setShowHints} label="Show rules hints" />
            <Checkbox
              checked={clans}
              onChange={(c) => setClans(c)}
              label="All clans (some selected)"
            />
          </div>
        </Panel>

        <Panel title="Sliders">
          <div className="ui-stack">
            <div className="ui-field">
              <span>
                <Volume2 size={14} /> Music {volume}%
              </span>
              <Slider ariaLabel="Music volume" value={volume} onChange={setVolume} />
            </div>
            <div className="ui-field">
              <span>Sound effects {sfx}%</span>
              <Slider ariaLabel="Sound effects volume" value={sfx} onChange={setSfx} step={5} />
            </div>
            <div className="ui-field">
              <span>Disabled</span>
              <Slider ariaLabel="Disabled slider" value={30} onChange={() => undefined} disabled />
            </div>
          </div>
        </Panel>

        <Panel title="Text fields">
          <div className="ui-stack">
            <TextField
              label="Deck name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint="Up to 40 characters"
            />
            <TextField
              aria-label="Search cards"
              placeholder="Search cards…"
              icon={<Search size={16} />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <TextField label="Room code" value="AB12" readOnly error="That room is full" />
          </div>
        </Panel>

        <Panel title="Tabs">
          <Tabs
            ariaLabel="Deck builder sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'main', label: 'MAIN DECK', content: <p>50 cards · 16 triggers</p> },
              { value: 'g', label: 'G DECK', content: <p>0 / 16 G units</p> },
              { value: 'stats', label: 'STATS', content: <p>Grade curve and trigger mix</p> },
              { value: 'off', label: 'LOCKED', content: null, disabled: true },
            ]}
          />
        </Panel>

        <Panel title="Dialogs, tooltips, badges">
          <div className="ui-row">
            <Button onClick={() => setDialog('info')} icon={<Layers size={16} />}>
              Open dialog
            </Button>
            <Tooltip text="Counter-Blast 1: turn one face-up damage card face down.">
              <Button variant="ghost">Hover for a tooltip</Button>
            </Tooltip>
          </div>
          <div className="ui-row">
            <Badge>OU v1.1</Badge>
            <Badge tone="accent">LEGAL</Badge>
            <Badge tone="gold">G-BT01</Badge>
            <Badge tone="success">VERIFIED</Badge>
            <Badge tone="danger">NOT LEGAL</Badge>
          </div>
        </Panel>

        <Panel title="Colour tokens">
          <div className="ui-row">
            {TOKENS.map(([label, token]) => (
              <span className="ui-swatch" key={token}>
                <i style={{ background: `var(${token})` }} />
                {label}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Dialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete this deck?"
        description={`"${name}" will be removed from your decks. This cannot be undone.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDialog(null)}>
              Delete
            </Button>
          </>
        }
      />
      <Dialog
        open={dialog === 'info'}
        onClose={() => setDialog(null)}
        title="Match settings"
        description="Dialogs close with Escape, a click outside, or Android's back button."
        actions={
          <Button variant="primary" onClick={() => setDialog(null)}>
            Done
          </Button>
        }
      >
        <div className="ui-stack">
          <Segmented
            ariaLabel="First player"
            value="random"
            onChange={() => undefined}
            options={[
              { value: 'me', label: 'Me' },
              { value: 'random', label: 'Random' },
              { value: 'ai', label: 'AI' },
            ]}
          />
          <Switch checked={effects} onChange={setEffects} label="Card effects" />
        </div>
      </Dialog>
    </div>
  );
}
