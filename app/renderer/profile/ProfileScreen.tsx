/**
 * Player Profile (the user's profile brief and asset pack, 2026-11-11): the profile with its banner,
 * avatar, name and title; statistics; match history; and what friends will need. Local first:
 * nothing online is shown as working (no server: docs/design/SERVER_IDEAS.md).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { PLAY_FORMATS, type FormatKey } from '../../../src/engine';
import { playmatOf, PLAYMATS } from '../cosmetics';
import { ctx } from '../engine';
import { Avatar, avatarLabel } from '../home/Avatars';
import { AVATARS, MAX_NAME } from '../home/profile';
import { useBackHandler } from '../android/back';
import { useConfirm } from '../ui/ConfirmDialog';
import {
  DEFAULT_BANNER,
  EXP_PER_LEVEL,
  expFor,
  expOf,
  favouriteClanOf,
  favouriteFormatOf,
  levelOf,
  MAX_LEVEL,
  MAT_BANNER,
  PACK_BANNERS,
  recordOf,
  TITLES,
  totalOf,
  type MatchRecord,
  type Profile,
  type Title,
} from './model';
import { loadPlayerProfile, savePlayerProfile, subscribeProfile } from './repository';
import { SyncPanel } from './SyncPanel';

const BANNER_FILES = import.meta.glob('../assets/profile/banners/*.{webp,png}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The CSS background of a banner id (a pack banner, or a playmat used as a banner). */
export function bannerBackground(id: string): string {
  if (id.startsWith(MAT_BANNER)) return playmatOf(id.slice(MAT_BANNER.length)).background;
  const file = Object.entries(BANNER_FILES).find(([p]) => p.includes(`/${id}.`))?.[1];
  return file ? `url("${file}") center / cover no-repeat, #0a1430` : '#0a1430';
}

export const formatLabel = (key: string | null) =>
  key && key in PLAY_FORMATS ? PLAY_FORMATS[key as FormatKey].label : (key ?? '—');

function useProfile(): Profile {
  const [p, setP] = useState<Profile>(loadPlayerProfile);
  useEffect(() => subscribeProfile(setP), []);
  return p;
}

type Tab = 'profile' | 'stats' | 'history' | 'sync' | 'friends';

export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const p = useProfile();
  const [tab, setTab] = useState<Tab>('profile');
  const [editing, setEditing] = useState(false);
  useBackHandler(() => {
    if (editing) return (setEditing(false), true);
    onBack();
    return true;
  });
  const tabs: readonly (readonly [Tab, string])[] = [
    ['profile', 'Profile'],
    ['stats', 'Statistics'],
    ['history', 'Match History'],
    ['sync', 'Sync devices'],
    ['friends', 'Friends'],
  ];
  return (
    <div className="pp" data-testid="player-profile">
      <nav className="pp-nav">
        <button className="btn" onClick={onBack} data-testid="profile-back">
          ← Home
        </button>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={`pp-tab ${tab === id ? 'on' : ''}`}
            onClick={() => setTab(id)}
            data-testid={`profile-tab-${id}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className="pp-main">
        <header className="pp-header" style={{ background: bannerBackground(p.banner) }}>
          <div className="pp-header-shade" />
          <Avatar id={p.avatar} size={150} />
          <div className="pp-who">
            <div className="pp-name" data-testid="profile-display-name">
              {p.name}
            </div>
            <div className="pp-title" data-testid="profile-title">
              {p.title === 'No Title' ? '' : p.title}
            </div>
            <LevelBar p={p} />
            <div className="pp-ids">
              <span title="Made once on this device; not an online account">
                Local ID: {p.localId.slice(0, 8).toUpperCase()}
              </span>
              <span className="pp-dim">Friend code: when online accounts exist</span>
            </div>
          </div>
          <button
            className="btn primary pp-edit"
            onClick={() => setEditing(true)}
            data-testid="profile-edit"
          >
            Edit profile
          </button>
        </header>
        {tab === 'profile' && <Overview p={p} />}
        {tab === 'stats' && <Statistics p={p} />}
        {tab === 'history' && <History history={p.history} />}
        {tab === 'sync' && <SyncPanel />}
        {tab === 'friends' && (
          <section className="pp-card" data-testid="profile-friends">
            <h3>Friends</h3>
            <p>
              Friends, friend codes and ranked play need online accounts, and the game has no server
              yet. Play Online with a friend works without them: START BATTLE → Play Online, with a
              room code.
            </p>
          </section>
        )}
      </main>
      {editing && <EditProfile p={p} onClose={() => setEditing(false)} />}
    </div>
  );
}

/** Level and EXP (25 a counted game, 75 for a win on a declared Final Turn; level 50 at most). */
function LevelBar({ p }: { p: Profile }) {
  const l = levelOf(expOf(p));
  return (
    <div className="pp-level" data-testid="profile-level" title={`${l.total} EXP in all`}>
      <span className="pp-lv">
        Lv. {l.level}
        {l.max && <small> MAX</small>}
      </span>
      <span className="pp-lvbar">
        <i style={{ width: `${l.max ? 100 : l.into}%` }} />
      </span>
      <span className="pp-dim">
        {l.max ? `Level ${MAX_LEVEL} reached` : `${l.into} / ${EXP_PER_LEVEL} EXP`}
      </span>
    </div>
  );
}

function Tile({
  label,
  value,
  id,
  small = false,
}: {
  label: string;
  value: string;
  id: string;
  small?: boolean;
}) {
  return (
    <div className={`pp-tile ${small ? 'small' : ''}`} data-testid={id}>
      <span className="pp-tile-label">{label}</span>
      <span className="pp-tile-value">{value}</span>
    </div>
  );
}

const rate = (r: { winRate: number | null }) => (r.winRate === null ? '—' : `${r.winRate}%`);
const wl = (r: { win: number; loss: number; draw: number }) =>
  `${r.win}–${r.loss}${r.draw ? `–${r.draw}` : ''}`;

function Overview({ p }: { p: Profile }) {
  const all = totalOf(p);
  const cpu = totalOf(p, ['cpu']);
  const online = totalOf(p, ['online_casual', 'online_ranked']);
  const clan = favouriteClanOf(p);
  const format = favouriteFormatOf(p);
  return (
    <>
      <section className="pp-card">
        <h3>
          Player stats <small className="pp-dim">on this device</small>
        </h3>
        <div className="pp-tiles">
          <Tile label="Games played" value={String(all.games)} id="stat-games" />
          <Tile label="Wins" value={String(all.win)} id="stat-wins" />
          <Tile label="Losses" value={String(all.loss)} id="stat-losses" />
          <Tile label="Win rate" value={rate(all)} id="stat-rate" />
        </div>
      </section>
      <section className="pp-card">
        <h3>Game modes</h3>
        <div className="pp-tiles">
          <Tile label="Against the CPU" value={wl(cpu)} id="stat-cpu" />
          <Tile label="Online (casual)" value={wl(online)} id="stat-online" />
          <Tile label="Ranked" value="No ranked play yet" id="stat-ranked" small />
        </div>
        <p className="pp-dim">
          Counted: finished games against the CPU and online games. Not counted: CPU demonstrations,
          and games left before they ended.
        </p>
      </section>
      <section className="pp-card pp-favs">
        <div>
          <h3>Favourite clan</h3>
          <div className="pp-fav" data-testid="fav-clan">
            {clan ?? '—'}
            <small className="pp-dim">
              {p.favouriteClan ? ' (your choice)' : clan ? ' (most played)' : ''}
            </small>
          </div>
        </div>
        <div>
          <h3>Favourite format</h3>
          <div className="pp-fav" data-testid="fav-format">
            {formatLabel(format)}
            <small className="pp-dim">
              {p.favouriteFormat ? ' (your choice)' : format ? ' (most played)' : ''}
            </small>
          </div>
        </div>
      </section>
    </>
  );
}

function Statistics({ p }: { p: Profile }) {
  const [format, setFormat] = useState<string>('all');
  const inFormat = (m: MatchRecord) => format === 'all' || m.format === format;
  const rows: readonly (readonly [string, (m: MatchRecord) => boolean])[] = [
    ['Overall', () => true],
    ['Against the CPU', (m) => m.mode === 'cpu'],
    ['Online', (m) => m.mode !== 'cpu'],
    ['Casual', (m) => m.mode === 'online_casual'],
    ['Ranked', (m) => m.mode === 'online_ranked'],
  ];
  return (
    <section className="pp-card" data-testid="profile-statistics">
      <div className="pp-row">
        <h3>Statistics</h3>
        <span className="seg">
          {(['all', ...Object.keys(PLAY_FORMATS)] as string[]).map((f) => (
            <button
              key={f}
              className={format === f ? 'on' : ''}
              onClick={() => setFormat(f)}
              data-testid={`stats-format-${f}`}
            >
              {f === 'all' ? 'All formats' : formatLabel(f)}
            </button>
          ))}
        </span>
      </div>
      <table className="pp-table">
        <thead>
          <tr>
            <th />
            <th>Games</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Draws</th>
            <th>Win rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, keep]) => {
            const r =
              format === 'all' && label === 'Overall'
                ? totalOf(p)
                : recordOf(p.history, (m) => inFormat(m) && keep(m));
            return (
              <tr key={label} data-testid={`stats-row-${label}`}>
                <td>{label}</td>
                <td>{r.games}</td>
                <td>{r.win}</td>
                <td>{r.loss}</td>
                <td>{r.draw}</td>
                <td>{rate(r)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="pp-dim">
        Games played on this device, and on devices synced with it (Sync devices). Local, not
        verified by a server. Ranked: the game has no ranked play yet.
      </p>
    </section>
  );
}

function History({ history }: { history: readonly MatchRecord[] }) {
  const newest = [...history].reverse();
  return (
    <section className="pp-card" data-testid="profile-history">
      <h3>Match history</h3>
      {newest.length === 0 ? (
        <p className="pp-dim">No counted games yet: finish a game against the CPU or online.</p>
      ) : (
        <ul className="pp-history">
          {newest.map((m) => (
            <li key={m.id} className={`r-${m.result}`}>
              <b>{m.result === 'win' ? 'WIN' : m.result === 'loss' ? 'LOSS' : 'DRAW'}</b>
              <span className="pp-exp">
                +{expFor(m)} EXP{m.finalTurnWin ? ' · Final Turn' : ''}
              </span>
              <span>{m.mode === 'cpu' ? 'vs CPU' : 'Online'}</span>
              <span>{m.opponent}</span>
              <span>{m.deckName || m.clan}</span>
              <span className="pp-dim">{formatLabel(m.format)}</span>
              <span className="pp-dim">{new Date(m.at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const CLANS = [...new Set(ctx.registry.all().map((d) => d.clan))]
  .filter((c) => c && c !== '-')
  .sort();

function EditProfile({ p, onClose }: { p: Profile; onClose: () => void }) {
  const [name, setName] = useState(p.name);
  const [title, setTitle] = useState<Title>(p.title);
  const [avatar, setAvatar] = useState(p.avatar);
  const [banner, setBanner] = useState(p.banner);
  const [clan, setClan] = useState(p.favouriteClan ?? '');
  const [format, setFormat] = useState(p.favouriteFormat ?? '');
  const [picking, setPicking] = useState(false);
  const { ask, dialog } = useConfirm();
  const save = () => {
    savePlayerProfile((cur) => ({
      ...cur,
      name,
      title,
      avatar,
      banner,
      favouriteClan: clan || null,
      favouriteFormat: format || null,
    }));
    onClose();
  };
  const restore = () =>
    ask('Restore the default look? (Your statistics are kept.)', 'Restore', () => {
      setTitle('No Title');
      setAvatar(AVATARS[0]);
      setBanner(DEFAULT_BANNER);
      setClan('');
      setFormat('');
    });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal pp-editor"
        onClick={(e) => e.stopPropagation()}
        data-testid="profile-editor-full"
      >
        <h2>Edit profile</h2>
        <div className="pp-banner-preview" style={{ background: bannerBackground(banner) }}>
          <Avatar id={avatar} size={96} />
          <span className="pp-name">{name.trim() || 'Player'}</span>
        </div>
        <label className="pp-field">
          Display name
          <input
            className="text"
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            data-testid="profile-name-field"
          />
        </label>
        <label className="pp-field">
          Title
          <select
            value={title}
            onChange={(e) => setTitle(e.target.value as Title)}
            data-testid="profile-title-field"
          >
            {TITLES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="pp-field">
          Avatar
          <div className="pp-avatars">
            {AVATARS.map((id) => (
              <button
                key={id}
                className={`pp-avatar ${id === avatar ? 'on' : ''}`}
                onClick={() => setAvatar(id)}
                title={avatarLabel(id)}
                data-testid={`profile-avatar-${id}`}
              >
                <Avatar id={id} size={64} />
              </button>
            ))}
          </div>
        </div>
        <div className="pp-field">
          Banner
          <button
            className="btn"
            onClick={() => setPicking(true)}
            data-testid="profile-banner-change"
          >
            Change banner
          </button>
        </div>
        <label className="pp-field">
          Favourite clan
          <select
            value={clan}
            onChange={(e) => setClan(e.target.value)}
            data-testid="profile-clan-field"
          >
            <option value="">From my games (most played)</option>
            {CLANS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="pp-field">
          Favourite format
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            data-testid="profile-format-field"
          >
            <option value="">From my games (most played)</option>
            {Object.keys(PLAY_FORMATS).map((f) => (
              <option key={f} value={f}>
                {formatLabel(f)}
              </option>
            ))}
          </select>
        </label>
        <div className="buttons">
          <button className="btn" onClick={restore} data-testid="profile-restore">
            Restore defaults
          </button>
          <button className="btn" onClick={onClose} data-testid="profile-cancel">
            Cancel
          </button>
          <button className="btn primary" onClick={save} data-testid="profile-save-full">
            Save
          </button>
        </div>
        {picking && (
          <BannerPicker
            value={banner}
            onApply={(b) => {
              setBanner(b);
              setPicking(false);
            }}
            onCancel={() => setPicking(false)}
          />
        )}
        {dialog}
      </div>
    </div>
  );
}

function BannerPicker({
  value,
  onApply,
  onCancel,
}: {
  value: string;
  onApply: (id: string) => void;
  onCancel: () => void;
}) {
  const [group, setGroup] = useState<'banners' | 'playmats'>(
    value.startsWith(MAT_BANNER) ? 'playmats' : 'banners',
  );
  const [chosen, setChosen] = useState(value);
  const options = useMemo(
    () =>
      group === 'banners'
        ? PACK_BANNERS.map((b) => ({ id: b.id, name: b.name }))
        : PLAYMATS.map((m) => ({ id: `${MAT_BANNER}${m.id}`, name: m.name })),
    [group],
  );
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal pp-banners"
        onClick={(e) => e.stopPropagation()}
        data-testid="banner-picker"
      >
        <h2>Select banner</h2>
        <span className="seg">
          <button className={group === 'banners' ? 'on' : ''} onClick={() => setGroup('banners')}>
            Banners
          </button>
          <button
            className={group === 'playmats' ? 'on' : ''}
            onClick={() => setGroup('playmats')}
            data-testid="banner-group-playmats"
          >
            Playmats
          </button>
        </span>
        <div className="pp-banner-grid">
          {options.map((o) => (
            <button
              key={o.id}
              className={`pp-banner-option ${o.id === chosen ? 'on' : ''}`}
              style={{ background: bannerBackground(o.id) } as CSSProperties}
              onClick={() => setChosen(o.id)}
              data-testid={`banner-${o.id}`}
            >
              <span>{o.name}</span>
              {o.id === chosen && <i className="pp-check">✓</i>}
            </button>
          ))}
        </div>
        <div className="buttons">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => onApply(chosen)}
            data-testid="banner-apply"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
