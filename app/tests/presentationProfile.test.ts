// @vitest-environment jsdom
// Presentation profiles (Battlefield 2.0, docs/design/BATTLEFIELD_2_AUDIT.md): which profile a
// battle uses, and the view and playmat each profile keeps.
import { beforeEach, describe, expect, it } from 'vitest';
import { profileFor, PROFILES, seedProfiles } from '../renderer/presentation/profile';
import {
  DEFAULT_SETTINGS,
  effectiveSettings,
  forProfile,
  loadSettings,
  saveSettings,
  setProfilePref,
} from '../renderer/settings';

describe('presentation profiles', () => {
  it('Automatic picks Mobile on Android or a phone-sized screen, otherwise Desktop', () => {
    expect(profileFor('auto', false, false)).toBe('desktop');
    expect(profileFor('auto', true, false)).toBe('mobile');
    expect(profileFor('auto', false, true)).toBe('mobile');
  });

  it('a profile chosen by hand wins on any device', () => {
    expect(profileFor('desktop', true, true)).toBe('desktop');
    expect(profileFor('phone', false, false)).toBe('mobile');
  });

  it('names the profiles Desktop and Mobile', () => {
    expect(PROFILES.desktop.name).toBe('Desktop');
    expect(PROFILES.mobile.name).toBe('Mobile');
  });
});

describe('per-profile settings', () => {
  beforeEach(() => localStorage.clear());

  it('settings saved before profiles give Desktop the old view and playmat; Mobile its own', () => {
    localStorage.setItem(
      'vanguard-sim.settings.v1',
      JSON.stringify({ tableView: 'tilted', playmat: 'nebula' }),
    );
    const s = loadSettings();
    expect(s.profiles.desktop).toMatchObject({ tableView: 'tilted', playmat: 'nebula' });
    // the phone layout never showed those: it keeps its own defaults (phase 6)
    expect(s.profiles.mobile).toMatchObject(PROFILES.mobile.defaults);
  });

  it('animated backgrounds: on for Desktop, off for Mobile, kept per profile', () => {
    expect(PROFILES.desktop.defaults.animatedBackground).toBe(true);
    expect(PROFILES.mobile.defaults.animatedBackground).toBe(false);
    const s = setProfilePref(DEFAULT_SETTINGS, 'mobile', { animatedBackground: true });
    expect(forProfile(s, 'mobile').animatedBackground).toBe(true);
    expect(forProfile(s, 'desktop').animatedBackground).toBe(true);
    expect(
      effectiveSettings(forProfile({ ...s, graphics: 'low' }, 'mobile')).animatedBackground,
    ).toBe(false);
  });

  it('new settings start from the profile defaults', () => {
    expect(loadSettings().profiles).toEqual(seedProfiles({}));
    expect(DEFAULT_SETTINGS.profiles.desktop).toEqual(PROFILES.desktop.defaults);
  });

  it('changing one profile leaves the other alone, and survives a reload', () => {
    const s = setProfilePref(DEFAULT_SETTINGS, 'mobile', { playmat: 'void', tableView: 'tilted' });
    expect(s.profiles.mobile).toMatchObject({ playmat: 'void', tableView: 'tilted' });
    expect(s.profiles.desktop).toEqual(DEFAULT_SETTINGS.profiles.desktop);
    saveSettings(s);
    expect(loadSettings().profiles).toEqual(s.profiles);
  });

  it('a battle plays with its own profile values', () => {
    const s = setProfilePref(
      setProfilePref(DEFAULT_SETTINGS, 'desktop', { tableView: 'tilted', playmat: 'inferno' }),
      'mobile',
      { tableView: 'overhead', playmat: 'verdant' },
    );
    expect(forProfile(s, 'desktop')).toMatchObject({ tableView: 'tilted', playmat: 'inferno' });
    expect(forProfile(s, 'mobile')).toMatchObject({ tableView: 'overhead', playmat: 'verdant' });
  });

  it('Low graphics still flattens the table whatever the profile says', () => {
    const s = setProfilePref({ ...DEFAULT_SETTINGS, graphics: 'low' }, 'desktop', {
      tableView: 'tilted',
    });
    expect(effectiveSettings(forProfile(s, 'desktop')).tableView).toBe('overhead');
  });

  it('a damaged saved profile falls back to sensible values', () => {
    localStorage.setItem(
      'vanguard-sim.settings.v1',
      JSON.stringify({ profiles: { desktop: { tableView: 'sideways', playmat: 7 } } }),
    );
    const p = loadSettings().profiles;
    expect(p.desktop.tableView).toBe('overhead');
    expect(typeof p.desktop.playmat).toBe('string');
  });
});
