/**
 * The desktop bridges (app/main/preload-*.cjs). Absent in a plain browser (`npm run ui:dev`), so
 * every use checks for them first.
 */
import type { DownloadProgress, DownloadResult } from '../../../src/artwork/types';
import type { ArtworkReport, ImportResult } from '../../../src/artwork/types';
import type { ArtworkInfo } from '../../../src/artwork/types';

export type Progress =
  | { readonly phase: 'scan' | 'import'; readonly done: number; readonly total: number }
  | ({ readonly phase: 'download' } & DownloadProgress);

export interface ArtworkManagerApi {
  info(): Promise<ArtworkInfo>;
  scan(): Promise<ArtworkReport>;
  importFolder(replace: boolean): Promise<ImportResult | null>;
  download(sets: readonly string[], sourceId: string): Promise<DownloadResult>;
  cancel(): Promise<void>;
  exportFolder(): Promise<{ count: number; folder: string } | null>;
  saveReport(): Promise<string | null>;
  openFolder(which: 'cards' | 'sources'): Promise<string>;
  onProgress(callback: (p: Progress) => void): () => void;
}

export interface VanguardDesktopApi {
  artworkStatus(): Promise<{ installed: number; expected: number; folder: string }>;
  openArtworkManager(): Promise<void>;
}

declare global {
  interface Window {
    artworkManager?: ArtworkManagerApi;
    vanguardDesktop?: VanguardDesktopApi;
  }
}
