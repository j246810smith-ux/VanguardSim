// The chosen app icon on Windows (icon pack, 2026-11-08; renderer side: appIcons.ts,
// appIconNative.ts). The icon built into VanguardSim.exe is Classic and cannot change while the
// program runs; the window and taskbar button take the chosen icon, and a desktop shortcut made
// from Settings carries it and is updated when the choice changes. The choice is kept in
// <userData>/app-icon.json so the window has it from the first frame; a missing or unknown choice
// is Classic.
const fs = require('node:fs');
const path = require('node:path');

const IDS = ['classic', 'blaster_blade', 'overdress', 'g_era', 'cfs'];
const DEFAULT_ID = 'classic';
const SHORTCUT_NAME = 'Vanguard Sim.lnk';

const valid = (id) => (typeof id === 'string' && IDS.includes(id) ? id : DEFAULT_ID);

/**
 * @param {object} o
 * @param {string} o.userData   the app's data folder
 * @param {string} o.iconsDir   folder with <id>.ico (may be inside app.asar)
 * @param {string} o.desktop    the user's desktop folder
 * @param {() => {target: string, args: string, cwd: string}} o.launch  what a shortcut starts
 * @param {(file: string, op: string, options: object) => boolean} o.writeShortcut  shell.writeShortcutLink
 */
function createAppIcon(o) {
  const stateFile = path.join(o.userData, 'app-icon.json');
  const read = () => {
    try {
      const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      return { id: valid(s.id), shortcut: typeof s.shortcut === 'string' ? s.shortcut : null };
    } catch {
      return { id: DEFAULT_ID, shortcut: null };
    }
  };
  const write = (s) => {
    try {
      fs.mkdirSync(o.userData, { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(s));
    } catch {
      // not remembered: the renderer sends the choice again at the next start
    }
  };
  const bundled = (id) => path.join(o.iconsDir, `${valid(id)}.ico`);
  /** A shortcut needs a real file, not one inside app.asar: copied to the data folder. */
  const realIcon = (id) => {
    const out = path.join(o.userData, 'icons', `${valid(id)}.ico`);
    if (!fs.existsSync(out)) {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, fs.readFileSync(bundled(id)));
    }
    return out;
  };
  const writeShortcut = (file, id) => {
    const l = o.launch();
    return o.writeShortcut(file, fs.existsSync(file) ? 'replace' : 'create', {
      target: l.target,
      args: l.args,
      cwd: l.cwd,
      icon: realIcon(id),
      iconIndex: 0,
      description: 'Vanguard Sim',
    });
  };
  return {
    current: () => read().id,
    iconPath: (id) => bundled(id ?? read().id),
    /** Saves the choice and updates our desktop shortcut if there is one. Returns the id used. */
    set(id) {
      const s = read();
      const next = { ...s, id: valid(id) };
      write(next);
      if (s.shortcut && fs.existsSync(s.shortcut)) {
        try {
          writeShortcut(s.shortcut, next.id);
        } catch {
          // the shortcut keeps its old icon
        }
      }
      return next.id;
    },
    /** Makes (or replaces) "Vanguard Sim" on the desktop with the chosen icon. */
    makeShortcut(id) {
      const file = path.join(o.desktop, SHORTCUT_NAME);
      try {
        const ok = writeShortcut(file, valid(id));
        if (ok) write({ id: valid(id), shortcut: file });
        return ok;
      } catch {
        return false;
      }
    },
  };
}

module.exports = { createAppIcon, APP_ICON_IDS: IDS, DEFAULT_APP_ICON: DEFAULT_ID };
