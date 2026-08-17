import { loadLocalArchive } from './archive';
import nightCourtBackground from './assets/themes/night-court/night-court-background.png';
import { pathFor } from './paths';
import { PRYTHIAN_COURTS, type PrythianCourtId } from './universes';

export const LAST_THEME_KEY = 'fantasy-book-tracker-last-visible-theme';

export type PersistedTheme = {
  universe: 'empyrean' | 'prythian';
  path?: string;
  court?: string;
};

type ThemePalette = {
  background: string;
  panel: string;
  panelAlt: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
};

function readPersistedTheme(): PersistedTheme | undefined {
  try {
    const raw = localStorage.getItem(LAST_THEME_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<PersistedTheme>;
    if (parsed.universe !== 'empyrean' && parsed.universe !== 'prythian') return undefined;
    return {
      universe: parsed.universe,
      path: parsed.path ? String(parsed.path) : undefined,
      court: parsed.court ? String(parsed.court) : undefined,
    };
  } catch {
    return undefined;
  }
}

export function writePersistedTheme(theme: PersistedTheme): void {
  try { localStorage.setItem(LAST_THEME_KEY, JSON.stringify(theme)); } catch {}
}

function paletteFor(theme: PersistedTheme): ThemePalette {
  if (theme.universe === 'prythian') {
    const courtId = (theme.court && theme.court in PRYTHIAN_COURTS ? theme.court : 'night') as PrythianCourtId;
    return PRYTHIAN_COURTS[courtId].theme;
  }
  return pathFor(theme.path || 'rider').theme;
}

export function applyPersistedTheme(theme: PersistedTheme): void {
  const palette = paletteFor(theme);
  const style = document.documentElement.style;
  style.setProperty('--v2-bg', palette.background);
  style.setProperty('--v2-panel', palette.panel);
  style.setProperty('--v2-panel-raised', palette.panelAlt);
  style.setProperty('--v2-border', palette.border);
  style.setProperty('--v2-border-strong', palette.accent);
  style.setProperty('--v2-text', palette.text);
  style.setProperty('--v2-muted', palette.muted);
  style.setProperty('--v2-accent', palette.accent);
  style.setProperty('--v2-accent-bright', palette.accent);

  document.documentElement.dataset.universe = theme.universe;
  document.body.dataset.universe = theme.universe;

  if (theme.universe === 'prythian') {
    const court = theme.court || 'night';
    document.documentElement.dataset.court = court;
    document.body.dataset.court = court;
    delete document.documentElement.dataset.path;
    delete document.body.dataset.path;
  } else {
    const path = theme.path || 'rider';
    document.documentElement.dataset.path = path;
    document.body.dataset.path = path;
    delete document.documentElement.dataset.court;
    delete document.body.dataset.court;
  }
}

/** Apply the last theme the user actually saw before React mounts. */
export function bootstrapUniverse(): void {
  document.documentElement.style.setProperty('--night-court-background-image', `url("${nightCourtBackground}")`);

  const archive = loadLocalArchive();
  const archiveTheme: PersistedTheme = archive.universes.activeUniverse === 'prythian'
    ? { universe: 'prythian', court: archive.universes.prythian.court || 'night' }
    : { universe: 'empyrean', path: archive.universes.empyrean.path || archive.profile.path || 'rider' };

  const initialTheme = readPersistedTheme() || archiveTheme;
  applyPersistedTheme(initialTheme);
}
