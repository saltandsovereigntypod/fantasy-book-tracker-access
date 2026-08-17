import { loadLocalArchive } from './archive';
import nightCourtBackground from './assets/themes/night-court/night-court-background.png';
import { pathFor } from './paths';
import { PRYTHIAN_COURTS, type PrythianCourtId } from './universes';

const LAST_THEME_KEY = 'fantasy-book-tracker-last-visible-theme';

type PersistedTheme = {
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

function writePersistedTheme(theme: PersistedTheme): void {
  try { localStorage.setItem(LAST_THEME_KEY, JSON.stringify(theme)); } catch {}
}

function paletteFor(theme: PersistedTheme): ThemePalette {
  if (theme.universe === 'prythian') {
    const courtId = (theme.court && theme.court in PRYTHIAN_COURTS ? theme.court : 'night') as PrythianCourtId;
    return PRYTHIAN_COURTS[courtId].theme;
  }
  return pathFor(theme.path || 'rider').theme;
}

function applyPalette(theme: PersistedTheme): void {
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
}

function applyThemeIdentity(theme: PersistedTheme): void {
  document.documentElement.dataset.universe = theme.universe;
  document.body.dataset.universe = theme.universe;
  applyPalette(theme);

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

function visibleThemeIdentity(): PersistedTheme | undefined {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  const universe = root?.dataset.universe || document.documentElement.dataset.universe;
  if (universe !== 'prythian' && universe !== 'empyrean') return undefined;

  if (universe === 'prythian') {
    return {
      universe,
      court: root?.dataset.court || document.documentElement.dataset.court || 'night',
    };
  }

  return {
    universe,
    path: root?.dataset.path || document.documentElement.dataset.path || 'rider',
  };
}

/**
 * Apply the last theme the user actually saw before React mounts so the loading
 * screen matches the active experience. The archive remains the fallback for
 * first load; once the app renders, a lightweight observer remembers the visible
 * universe/path/court for the next reload.
 */
export function bootstrapUniverse(): void {
  document.documentElement.style.setProperty('--night-court-background-image', `url("${nightCourtBackground}")`);

  const archive = loadLocalArchive();
  const archiveTheme: PersistedTheme = archive.universes.activeUniverse === 'prythian'
    ? { universe: 'prythian', court: archive.universes.prythian.court || 'night' }
    : { universe: 'empyrean', path: archive.universes.empyrean.path || archive.profile.path || 'rider' };

  const initialTheme = readPersistedTheme() || archiveTheme;
  applyThemeIdentity(initialTheme);
  writePersistedTheme(initialTheme);

  let frame = 0;
  const rememberVisibleTheme = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const current = visibleThemeIdentity();
      if (!current) return;
      writePersistedTheme(current);
      applyPalette(current);
    });
  };

  const observer = new MutationObserver(rememberVisibleTheme);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-universe', 'data-path', 'data-court'],
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-universe', 'data-path', 'data-court'],
  });
}
