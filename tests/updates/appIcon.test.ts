// Selectable app icons on Windows (icon pack, 2026-11-08): app/main/appIcon.cjs.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createAppIcon, APP_ICON_IDS } = require('../../app/main/appIcon.cjs') as {
  createAppIcon: (o: object) => {
    current(): string;
    iconPath(id?: string): string;
    set(id: unknown): string;
    makeShortcut(id: unknown): boolean;
  };
  APP_ICON_IDS: string[];
};

const ICONS = resolve(import.meta.dirname, '../../app/main/icons');

describe('app icon (Windows)', () => {
  let dir: string;
  let shortcuts: { file: string; op: string; options: { icon: string; target: string } }[];
  const make = () =>
    createAppIcon({
      userData: join(dir, 'data'),
      iconsDir: ICONS,
      desktop: join(dir, 'desktop'),
      launch: () => ({ target: 'C:\\Games\\VanguardSim.exe', args: '', cwd: 'C:\\Games' }),
      writeShortcut: (file: string, op: string, options: { icon: string; target: string }) => {
        shortcuts.push({ file, op, options });
        writeFileSync(file, 'lnk');
        return true;
      },
    });
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vg-icon-'));
    shortcuts = [];
    require('node:fs').mkdirSync(join(dir, 'desktop'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('every icon in the catalogue has its .ico, and the renderer catalogue matches', () => {
    for (const id of APP_ICON_IDS) expect(existsSync(join(ICONS, `${id}.ico`))).toBe(true);
    const catalogue = readFileSync(
      resolve(import.meta.dirname, '../../app/renderer/appIcons.ts'),
      'utf8',
    );
    for (const id of APP_ICON_IDS) expect(catalogue).toContain(`id: '${id}'`);
  });

  it('starts as Classic, remembers a choice across restarts, and falls back on bad ones', () => {
    expect(make().current()).toBe('classic');
    make().set('g_era');
    expect(make().current()).toBe('g_era');
    expect(make().iconPath()).toBe(join(ICONS, 'g_era.ico'));
    expect(make().set('not-an-icon')).toBe('classic');
    writeFileSync(join(dir, 'data', 'app-icon.json'), '{broken');
    expect(make().current()).toBe('classic');
  });

  it('a desktop shortcut gets the chosen icon and follows later changes', () => {
    const icons = make();
    expect(icons.makeShortcut('cfs')).toBe(true);
    expect(shortcuts[0]!.op).toBe('create');
    expect(shortcuts[0]!.options.target).toBe('C:\\Games\\VanguardSim.exe');
    expect(shortcuts[0]!.options.icon).toBe(join(dir, 'data', 'icons', 'cfs.ico'));
    expect(existsSync(shortcuts[0]!.options.icon)).toBe(true);
    make().set('overdress');
    expect(shortcuts[1]!.op).toBe('replace');
    expect(shortcuts[1]!.options.icon).toBe(join(dir, 'data', 'icons', 'overdress.ico'));
  });

  it('no shortcut made: changing the icon writes none', () => {
    make().set('blaster_blade');
    expect(shortcuts).toEqual([]);
  });
});
