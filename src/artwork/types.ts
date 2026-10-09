/** Artwork Manager types shared with the renderer (no Node imports). */
import type { ImageExtension } from './manifest';
import type { ArtworkSource } from './sources';

export type CardStatus =
  | { readonly state: 'installed'; readonly ext: ImageExtension }
  | { readonly state: 'missing' }
  | { readonly state: 'invalid'; readonly ext: ImageExtension; readonly reason: string };

export interface Problem {
  readonly kind: 'invalid' | 'duplicate' | 'unmatched' | 'partial' | 'failed' | 'unavailable';
  /** The file (relative to the folder) or card ID concerned. */
  readonly what: string;
  readonly reason: string;
}

export interface ArtworkReport {
  readonly root: string;
  readonly totals: {
    readonly expected: number;
    readonly installed: number;
    readonly missing: number;
    readonly invalid: number;
    readonly duplicates: number;
    readonly unmatched: number;
  };
  readonly bySet: Readonly<
    Record<string, { readonly expected: number; readonly installed: number }>
  >;
  readonly cards: Readonly<Record<string, CardStatus>>;
  readonly problems: readonly Problem[];
}

export interface ImportResult {
  readonly installed: number;
  readonly replaced: number;
  readonly keptExisting: number;
  readonly problems: readonly Problem[];
}

export interface DownloadProgress {
  readonly total: number;
  readonly done: number;
  readonly downloaded: number;
  readonly skipped: number;
  readonly failed: number;
  readonly current?: string;
}

export interface DownloadResult extends DownloadProgress {
  readonly cancelled: boolean;
  readonly problems: readonly Problem[];
}

export interface ArtworkInfo {
  readonly root: string;
  readonly cardData: string;
  readonly sets: readonly { readonly set: string; readonly expected: number }[];
  readonly sources: readonly Pick<ArtworkSource, 'id' | 'name' | 'attribution'>[];
  readonly sourcesFile: string;
  readonly sourceProblems: readonly string[];
}
