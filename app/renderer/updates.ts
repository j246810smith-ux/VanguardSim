// Vanguard Update Manager, stage 1 (D-037), renderer side: types for the desktop bridge
// (app/main/updates.cjs does the lookup) and a small, safe reader for GitHub release notes.
import type { UpdateChannel } from './settings';

export interface ReleaseInfo {
  readonly version: string;
  readonly name: string;
  /** ISO date the release was published, or null. */
  readonly date: string | null;
  /** The release notes as written on GitHub (Markdown). */
  readonly notes: string;
  /** The release's page on the official repository. */
  readonly page: string;
  readonly preview: boolean;
}

export type UpdateCheck =
  | {
      readonly ok: true;
      readonly current: string;
      readonly channel: UpdateChannel;
      readonly latest: ReleaseInfo;
      readonly available: boolean;
    }
  | { readonly ok: false; readonly error: string };

export interface InstallInfo {
  readonly version: string;
  /** The single-file portable .exe (it cannot be updated in place). */
  readonly portable: boolean;
  readonly packaged: boolean;
}

/** How far a download has got (stage 3). `received`/`total` are bytes, while downloading only. */
export interface UpdateProgress {
  readonly phase: 'checking' | 'downloading' | 'verifying' | 'unpacking';
  readonly received?: number;
  readonly total?: number;
}

export type UpdateDownload =
  | {
      readonly ok: true;
      readonly version: string;
      /** `app`: the small package; `full`: the whole game, when the runtime changed. */
      readonly mode: 'app' | 'full';
      readonly size: number;
    }
  | {
      readonly ok: false;
      readonly error: string;
      /** `no-manifest`: the release can only be installed by hand. */
      readonly code?: 'no-manifest' | 'cancelled';
    };

export type UpdateAction = { readonly ok: true } | { readonly ok: false; readonly error: string };

export interface UpdateResult {
  readonly kind: 'ok' | 'failed' | 'rolled-back' | 'interrupted' | 'restored' | 'restore-failed';
  /** The version that was being installed, and the one it came from. */
  readonly to: string;
  readonly from: string;
}

/** The main menu's sentence about what the updater did. */
export function updateResultText(r: UpdateResult): string {
  switch (r.kind) {
    case 'ok':
      return `Updated to v${r.to}.`;
    case 'failed':
      return `The update to v${r.to} could not start. Your game was not changed.`;
    case 'rolled-back':
      return `The update to v${r.to} failed, so v${r.from} was put back. Nothing was lost.`;
    case 'interrupted':
      return `An update was interrupted, so v${r.from} was put back. Nothing was lost.`;
    case 'restored':
      return `Went back to v${r.from}.`;
    case 'restore-failed':
      return 'The previous version could not be restored. Please download the game again. Your decks, settings and card art are safe.';
  }
}

export interface DesktopUpdates {
  info(): Promise<InstallInfo>;
  check(channel: UpdateChannel): Promise<UpdateCheck>;
  openPage(url: string): Promise<void>;
  download(version: string): Promise<UpdateDownload>;
  cancelDownload(): Promise<void>;
  /** `ok`: the updater is running and the game is about to close. */
  install(version: string): Promise<UpdateAction>;
  /** Put back the version kept when this one was installed. Same answer as `install`. */
  rollback(): Promise<UpdateAction>;
  rollbackInfo(): Promise<{ readonly version: string } | null>;
  /** What the updater did last time; asked once, then it is gone. */
  lastResult(): Promise<UpdateResult | null>;
  /** Returns a function that stops listening. */
  onProgress(callback: (p: UpdateProgress) => void): () => void;
}

/** "1.4 MB", for the download screen. */
export const megabytes = (bytes: number): string => `${(bytes / 1e6).toFixed(1)} MB`;

/** What the screen says while a download runs. */
export function progressText(p: UpdateProgress): string {
  switch (p.phase) {
    case 'checking':
      return 'Checking the signed file list…';
    case 'downloading':
      return `Downloading… ${megabytes(p.received ?? 0)} of ${megabytes(p.total ?? 0)}`;
    case 'verifying':
      return 'Verifying the download…';
    case 'unpacking':
      return 'Unpacking and verifying each file…';
  }
}

export const desktopUpdates = (): DesktopUpdates | null =>
  globalThis.window?.vanguardDesktop?.updates ?? null;

/** One block of release notes: a heading, a list item or a paragraph (plain text only). */
export interface NoteBlock {
  readonly kind: 'heading' | 'item' | 'text';
  readonly text: string;
  /** Heading level 1–6, or the list item's nesting depth (0 = top). */
  readonly level: number;
}

/** Markdown inline marks reduced to plain text: links keep their label, code/bold/italics lose marks. */
export function plainInline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Release notes as plain blocks. The notes are never shown as HTML: they come from the internet,
 * so the screen renders these blocks as text.
 */
export function parseNotes(markdown: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length)
      blocks.push({ kind: 'text', text: plainInline(paragraph.join(' ')), level: 0 });
    paragraph = [];
  };
  let fence = false;
  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(raw)) {
      flush();
      fence = !fence;
      continue;
    }
    if (fence) {
      if (raw.trim()) blocks.push({ kind: 'text', text: raw.trim(), level: 0 });
      continue;
    }
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      continue;
    }
    const h = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      flush();
      blocks.push({ kind: 'heading', text: plainInline(h[2]!), level: h[1]!.length });
      continue;
    }
    const li = /^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(line);
    if (li) {
      flush();
      blocks.push({
        kind: 'item',
        text: plainInline(li[2]!),
        level: Math.min(3, Math.floor(li[1]!.length / 2)),
      });
      continue;
    }
    const last = blocks[blocks.length - 1];
    // an indented line right after a list item continues that item
    if (!paragraph.length && last?.kind === 'item' && /^\s{2,}\S/.test(line)) {
      blocks[blocks.length - 1] = { ...last, text: `${last.text} ${plainInline(line)}` };
      continue;
    }
    paragraph.push(line.trim().replace(/^>\s?/, ''));
  }
  flush();
  return blocks.filter((b) => b.text.length > 0);
}

/** "3 November 2026" from an ISO date, or '' when unknown. */
export function releaseDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
