import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PATHS, pathFor } from './paths';
import { PRYTHIAN_COURTS, type PrythianCourtId } from './universes';
import { getAuthSnapshot, supabase } from './supabase';

type ThemeSettings = {
  pageBackground: string;
  navigation: string;
  panel: string;
  panelAlt: string;
  accent: string;
  border: string;
  text: string;
  muted: string;
  navigationOpacity: number;
  contentOpacity: number;
  blur: number;
};

type ThemeRecord = {
  enabled: boolean;
  settings: ThemeSettings;
  updatedAt: string;
};

type ThemeLibrary = Record<string, ThemeRecord>;

type ThemeIdentity = {
  key: string;
  label: string;
  defaults: ThemeSettings;
};

const STORAGE_KEY = 'fantasy-book-tracker-interface-themes';
const STYLE_VARS = [
  '--interface-page-bg',
  '--interface-navigation',
  '--interface-panel',
  '--interface-panel-alt',
  '--interface-accent',
  '--interface-border',
  '--interface-text',
  '--interface-muted',
  '--interface-nav-opacity',
  '--interface-content-opacity',
  '--interface-blur',
] as const;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : fallback;
}

function validColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function defaultsFromPalette(palette: {
  background: string; panel: string; panelAlt: string; text: string; muted: string; accent: string; border: string;
}): ThemeSettings {
  return {
    pageBackground: palette.background,
    navigation: palette.panel,
    panel: palette.panel,
    panelAlt: palette.panelAlt,
    accent: palette.accent,
    border: palette.border,
    text: palette.text,
    muted: palette.muted,
    navigationOpacity: 44,
    contentOpacity: 36,
    blur: 18,
  };
}

function activeThemeIdentity(): ThemeIdentity | null {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  if (!root) return null;
  const universe = root.dataset.universe;
  if (universe === 'prythian') {
    const rawCourt = root.dataset.court || 'night';
    const courtId = (rawCourt in PRYTHIAN_COURTS ? rawCourt : 'night') as PrythianCourtId;
    const court = PRYTHIAN_COURTS[courtId];
    return { key: `prythian:${courtId}`, label: court.name, defaults: defaultsFromPalette(court.theme) };
  }
  const path = pathFor(root.dataset.path || 'rider');
  return { key: `empyrean:${path.id}`, label: path.name, defaults: defaultsFromPalette(path.theme) };
}

function normalizeSettings(value: unknown, defaults: ThemeSettings): ThemeSettings {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<ThemeSettings> : {};
  return {
    pageBackground: validColor(source.pageBackground, defaults.pageBackground),
    navigation: validColor(source.navigation, defaults.navigation),
    panel: validColor(source.panel, defaults.panel),
    panelAlt: validColor(source.panelAlt, defaults.panelAlt),
    accent: validColor(source.accent, defaults.accent),
    border: validColor(source.border, defaults.border),
    text: validColor(source.text, defaults.text),
    muted: validColor(source.muted, defaults.muted),
    navigationOpacity: clamp(source.navigationOpacity, 10, 100, defaults.navigationOpacity),
    contentOpacity: clamp(source.contentOpacity, 10, 100, defaults.contentOpacity),
    blur: clamp(source.blur, 0, 32, defaults.blur),
  };
}

function loadLocalLibrary(): ThemeLibrary {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ThemeLibrary : {};
  } catch {
    return {};
  }
}

function storeLocalLibrary(library: ThemeLibrary): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(library)); } catch {}
}

function normalizeLibrary(value: unknown): ThemeLibrary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: ThemeLibrary = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const source = raw as Partial<ThemeRecord>;
    const identity = identityForKey(key);
    if (!identity || !source.updatedAt) return;
    output[key] = {
      enabled: source.enabled !== false,
      settings: normalizeSettings(source.settings, identity.defaults),
      updatedAt: String(source.updatedAt),
    };
  });
  return output;
}

function identityForKey(key: string): ThemeIdentity | null {
  const [universe, id] = key.split(':');
  if (universe === 'prythian' && id && id in PRYTHIAN_COURTS) {
    const court = PRYTHIAN_COURTS[id as PrythianCourtId];
    return { key, label: court.name, defaults: defaultsFromPalette(court.theme) };
  }
  if (universe === 'empyrean' && id && id in PATHS) {
    const path = PATHS[id as keyof typeof PATHS];
    return { key, label: path.name, defaults: defaultsFromPalette(path.theme) };
  }
  return null;
}

function mergeLibraries(local: ThemeLibrary, cloud: ThemeLibrary): ThemeLibrary {
  const merged: ThemeLibrary = { ...local };
  Object.entries(cloud).forEach(([key, record]) => {
    const current = merged[key];
    if (!current || record.updatedAt.localeCompare(current.updatedAt) >= 0) merged[key] = record;
  });
  return merged;
}

function clearAppliedTheme(): void {
  STYLE_VARS.forEach((name) => document.documentElement.style.removeProperty(name));
  delete document.documentElement.dataset.interfaceThemeCustom;
  delete document.body.dataset.interfaceThemeCustom;
}

function applyTheme(record: ThemeRecord | undefined): void {
  if (!record?.enabled) {
    clearAppliedTheme();
    return;
  }
  const settings = record.settings;
  const style = document.documentElement.style;
  style.setProperty('--interface-page-bg', settings.pageBackground);
  style.setProperty('--interface-navigation', settings.navigation);
  style.setProperty('--interface-panel', settings.panel);
  style.setProperty('--interface-panel-alt', settings.panelAlt);
  style.setProperty('--interface-accent', settings.accent);
  style.setProperty('--interface-border', settings.border);
  style.setProperty('--interface-text', settings.text);
  style.setProperty('--interface-muted', settings.muted);
  style.setProperty('--interface-nav-opacity', `${settings.navigationOpacity}%`);
  style.setProperty('--interface-content-opacity', `${settings.contentOpacity}%`);
  style.setProperty('--interface-blur', `${settings.blur}px`);
  document.documentElement.dataset.interfaceThemeCustom = 'true';
  document.body.dataset.interfaceThemeCustom = 'true';
}

async function loadCloudLibrary(userId: string): Promise<ThemeLibrary> {
  const { data, error } = await supabase
    .from('archive_states')
    .select('state')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : undefined;
  const state = row?.state && typeof row.state === 'object' ? row.state as Record<string, unknown> : {};
  return normalizeLibrary(state.interfaceThemes);
}

async function saveCloudLibrary(userId: string, library: ThemeLibrary): Promise<void> {
  const { data, error: readError } = await supabase
    .from('archive_states')
    .select('state')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (readError) throw readError;
  const existing = Array.isArray(data) ? data[0] : undefined;
  const state = existing?.state && typeof existing.state === 'object' ? existing.state as Record<string, unknown> : {};
  const payload = { state: { ...state, interfaceThemes: library }, updated_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabase.from('archive_states').update(payload).eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('archive_states').insert({ user_id: userId, ...payload });
  if (error) throw error;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="interface-theme-color-field"><span>{label}</span><div><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></div></label>;
}

function RangeField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="interface-theme-range-field"><span>{label}<strong>{value}{suffix}</strong></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function InterfaceThemeCustomizer() {
  const [identity, setIdentity] = useState<ThemeIdentity | null>(() => activeThemeIdentity());
  const [library, setLibrary] = useState<ThemeLibrary>(() => loadLocalLibrary());
  const [draft, setDraft] = useState<ThemeSettings | null>(() => {
    const current = activeThemeIdentity();
    if (!current) return null;
    const record = loadLocalLibrary()[current.key];
    return record?.enabled ? normalizeSettings(record.settings, current.defaults) : current.defaults;
  });
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const syncIdentity = () => {
      const next = activeThemeIdentity();
      setIdentity((current) => current?.key === next?.key ? current : next);
    };
    syncIdentity();
    const observer = new MutationObserver(syncIdentity);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-universe', 'data-path', 'data-court'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!identity) { clearAppliedTheme(); setDraft(null); return; }
    const record = library[identity.key];
    applyTheme(record);
    setDraft(record?.enabled ? normalizeSettings(record.settings, identity.defaults) : identity.defaults);
  }, [identity?.key, library]);

  useEffect(() => {
    let active = true;
    getAuthSnapshot().then(async ({ user }) => {
      if (!user || !active) return;
      const cloud = await loadCloudLibrary(user.id);
      if (!active) return;
      const merged = mergeLibraries(loadLocalLibrary(), cloud);
      setLibrary(merged);
      storeLocalLibrary(merged);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open || !identity || !draft) return;
    applyTheme({ enabled: true, settings: draft, updatedAt: new Date().toISOString() });
    return () => applyTheme(library[identity.key]);
  }, [open, identity?.key, draft]);

  const customized = useMemo(() => Boolean(identity && library[identity.key]?.enabled), [identity?.key, library]);

  function update<K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!identity || !draft || saving) return;
    const record: ThemeRecord = { enabled: true, settings: normalizeSettings(draft, identity.defaults), updatedAt: new Date().toISOString() };
    const next = { ...library, [identity.key]: record };
    setLibrary(next);
    storeLocalLibrary(next);
    applyTheme(record);
    setSaving(true);
    setStatus('Saving interface theme to your account…');
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired.');
      await saveCloudLibrary(user.id, next);
      setStatus(`Saved your ${identity.label} interface and synced it across devices.`);
    } catch (reason) {
      setStatus(reason instanceof Error ? `${reason.message} Your changes are still saved on this device.` : 'Saved locally, but cloud sync failed.');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!identity || saving) return;
    const record: ThemeRecord = { enabled: false, settings: identity.defaults, updatedAt: new Date().toISOString() };
    const next = { ...library, [identity.key]: record };
    setLibrary(next);
    storeLocalLibrary(next);
    setDraft(identity.defaults);
    clearAppliedTheme();
    setSaving(true);
    setStatus('Restoring the built-in theme…');
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired.');
      await saveCloudLibrary(user.id, next);
      setStatus(`Restored the built-in ${identity.label} colors on every synced device.`);
    } catch (reason) {
      setStatus(reason instanceof Error ? `${reason.message} This device is reset to defaults.` : 'Reset locally, but cloud sync failed.');
    } finally {
      setSaving(false);
    }
  }

  if (!identity || !draft) return null;

  return <>
    <button className="interface-theme-launcher" type="button" onClick={() => { setOpen(true); setStatus(''); }}>Interface Theme</button>
    {open && <div className="interface-theme-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
      <section className="interface-theme-dialog" role="dialog" aria-modal="true" aria-label="Customize interface theme">
        <header><div><p>Personal interface</p><h2>Customize {identity.label}</h2><span>Changes affect the app around your books. Book cards and Card Themes are never modified.</span></div><button type="button" disabled={saving} onClick={() => setOpen(false)}>×</button></header>
        <div className="interface-theme-grid">
          <section><h3>Colors</h3><div className="interface-theme-colors">
            <ColorField label="Page background" value={draft.pageBackground} onChange={(value) => update('pageBackground', value)} />
            <ColorField label="Sidebar / topbar" value={draft.navigation} onChange={(value) => update('navigation', value)} />
            <ColorField label="Panel" value={draft.panel} onChange={(value) => update('panel', value)} />
            <ColorField label="Secondary panel" value={draft.panelAlt} onChange={(value) => update('panelAlt', value)} />
            <ColorField label="Accent" value={draft.accent} onChange={(value) => update('accent', value)} />
            <ColorField label="Border" value={draft.border} onChange={(value) => update('border', value)} />
            <ColorField label="Text" value={draft.text} onChange={(value) => update('text', value)} />
            <ColorField label="Muted text" value={draft.muted} onChange={(value) => update('muted', value)} />
          </div></section>
          <section><h3>Foggy glass</h3>
            <RangeField label="Navigation opacity" value={draft.navigationOpacity} min={10} max={100} suffix="%" onChange={(value) => update('navigationOpacity', value)} />
            <RangeField label="Content opacity" value={draft.contentOpacity} min={10} max={100} suffix="%" onChange={(value) => update('contentOpacity', value)} />
            <RangeField label="Blur strength" value={draft.blur} min={0} max={32} suffix="px" onChange={(value) => update('blur', value)} />
            <div className="interface-theme-preview"><span>Live preview</span><strong>{identity.label}</strong><p>The background remains visible through theme-colored glass.</p></div>
          </section>
        </div>
        <footer><div>{status || (customized ? 'This theme has your personal interface colors.' : 'Using the built-in interface colors.')}</div><div><button type="button" disabled={saving} onClick={() => void reset()}>Reset to Theme Defaults</button><button className="is-primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Interface Theme'}</button></div></footer>
      </section>
    </div>}
  </>;
}

function start() {
  document.getElementById('interface-theme-customizer-runtime')?.remove();
  const host = document.createElement('div');
  host.id = 'interface-theme-customizer-runtime';
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><InterfaceThemeCustomizer /></StrictMode>);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
