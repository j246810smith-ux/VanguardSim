/**
 * The Artwork Manager's back end (bundled for the Electron main process by
 * scripts/artwork-build.ts). One instance per app run; at most one download at a time.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { downloadMissing, type DownloadProgress, type DownloadResult } from './download';
import {
  exportFolder,
  importFolder,
  removePartials,
  reportText,
  scanFolder,
  type ArtworkReport,
  type ImportResult,
  type Problem,
} from './files';
import { IMAGE_EXTENSIONS, imagePath, setsOf, type ArtworkManifest } from './manifest';
import { parseSources, withDefaults, type ArtworkSource } from './sources';
import type { ArtworkInfo } from './types';

export type { ArtworkInfo } from './types';

export class ArtworkService {
  private download: AbortController | null = null;
  private lastReport: ArtworkReport | null = null;
  private lastProblems: Problem[] = [];

  constructor(
    readonly manifest: ArtworkManifest,
    readonly root: string,
    readonly sourcesFile: string,
  ) {}

  private sources(): { sources: ArtworkSource[]; problems: string[] } {
    if (!existsSync(this.sourcesFile)) return { sources: withDefaults([]), problems: [] };
    const own = parseSources(readFileSync(this.sourcesFile, 'utf8'));
    return { sources: withDefaults(own.sources), problems: own.problems };
  }

  info(): ArtworkInfo {
    const { sources, problems } = this.sources();
    return {
      root: this.root,
      cardData: this.manifest.cardData,
      sets: setsOf(this.manifest).map((set) => ({
        set,
        expected: this.manifest.entries.filter((e) => e.set === set).length,
      })),
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        ...(s.attribution ? { attribution: s.attribution } : {}),
      })),
      sourcesFile: this.sourcesFile,
      sourceProblems: problems,
    };
  }

  /** A quick count of cards with an image file (no content check; for the game's Settings). */
  quickStatus(): { installed: number; expected: number; folder: string } {
    let installed = 0;
    for (const e of this.manifest.entries) {
      if (IMAGE_EXTENSIONS.some((ext) => existsSync(path.join(this.root, imagePath(e.id, ext)))))
        installed++;
    }
    return { installed, expected: this.manifest.entries.length, folder: this.root };
  }

  async scan(onProgress?: (done: number, total: number) => void): Promise<ArtworkReport> {
    await removePartials(this.root);
    this.lastReport = await scanFolder(this.root, this.manifest, onProgress);
    this.lastProblems = [];
    return this.lastReport;
  }

  async importFrom(
    source: string,
    replace: boolean,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ImportResult> {
    const result = await importFolder(source, this.root, this.manifest, {
      replace,
      ...(onProgress ? { onProgress } : {}),
    });
    this.lastProblems = [...result.problems];
    return result;
  }

  async downloadSets(
    sets: readonly string[],
    sourceId: string,
    onProgress: (p: DownloadProgress) => void,
  ): Promise<DownloadResult> {
    if (this.download) throw new Error('a download is already running');
    const source = this.sources().sources.find((s) => s.id === sourceId);
    if (!source) throw new Error(`no download source "${sourceId}"`);
    this.download = new AbortController();
    try {
      const result = await downloadMissing(this.manifest, this.root, source, {
        sets,
        signal: this.download.signal,
        onProgress,
      });
      this.lastProblems = [...result.problems];
      return result;
    } finally {
      this.download = null;
    }
  }

  cancel(): void {
    this.download?.abort();
  }

  exportTo(dest: string): Promise<number> {
    if (path.resolve(dest).startsWith(path.resolve(this.root))) {
      throw new Error("choose a folder outside the game's cards folder");
    }
    return exportFolder(this.root, dest, this.manifest);
  }

  async reportText(): Promise<string> {
    const report = this.lastReport ?? (await this.scan());
    return reportText(report, this.lastProblems);
  }
}
