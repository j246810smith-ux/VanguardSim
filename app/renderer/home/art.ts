/**
 * The home screen's character and mech artwork (docs/design/HOME_SCREEN_PLAN.md). Each picture is
 * a separate see-through PNG or WebP in app/renderer/assets/home/ (see the README there); a file
 * that is not there yet shows a drawn stand-in instead, so the screen works without any of them.
 */
const FILES = import.meta.glob('../assets/home/*.{png,webp}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The four pictures, named by their file names without the extension. */
export type HomeArt = 'duelist-blue' | 'rival-red' | 'mech-blue' | 'mech-red' | 'skyline';

export function homeArtUrl(name: HomeArt, files: Record<string, string> = FILES): string | null {
  for (const [path, url] of Object.entries(files)) {
    const base = path
      .split('/')
      .pop()
      ?.replace(/\.(png|webp)$/i, '');
    if (base === name) return url;
  }
  return null;
}
