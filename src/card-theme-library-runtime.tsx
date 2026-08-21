import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CardDesign } from './domain';
import { loadCloudArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState, type V2BookRecord } from './archive';
import { loadWorkspaceDraft } from './library';
import { getAuthSnapshot, supabase } from './supabase';
import './card-theme-library-runtime.css';

type CardThemePreset = { id: string; name: string; design: CardDesign; createdAt: string; updatedAt: string };
type View = 'hidden' | 'editor' | 'library';
type RestoreMode = 'off' | 'ask' | 'auto';
type ThemeContext = { key: string; label: string };
type CardThemeMemory = { mode: RestoreMode; lastThemeByContext: Record<string, string>; updatedAt: string };

const THEME_KEY = 'empyrean-v2-card-themes';
const MEMORY_KEY = 'empyrean-v2-card-theme-context-memory';

function loadThemes(): CardThemePreset[] {
  try { const value = JSON.parse(localStorage.getItem(THEME_KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function storeThemes(themes: CardThemePreset[]) { try { localStorage.setItem(THEME_KEY, JSON.stringify(themes)); } catch {} }
function cloneDesign(design: CardDesign): CardDesign { return structuredClone(design); }
function themedDesign(theme: CardThemePreset, book: V2BookRecord): CardDesign {
  return {
    ...cloneDesign(theme.design),
    id: book.design.id || crypto.randomUUID(),
    width: Number(theme.design.width) || 420,
    height: Number(theme.design.height) || 380,
    version: Math.max(4, Number(theme.design.version) || 1),
  };
}

function defaultMemory(): CardThemeMemory {
  return { mode: 'off', lastThemeByContext: {}, updatedAt: new Date(0).toISOString() };
}

function normalizeMemory(value: unknown): CardThemeMemory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultMemory();
  const source = value as Partial<CardThemeMemory>;
  const mode: RestoreMode = source.mode === 'ask' || source.mode === 'auto' ? source.mode : 'off';
  const map: Record<string, string> = {};
  if (source.lastThemeByContext && typeof source.lastThemeByContext === 'object' && !Array.isArray(source.lastThemeByContext)) {
    Object.entries(source.lastThemeByContext).forEach(([key, themeId]) => { if (typeof themeId === 'string' && themeId) map[key] = themeId; });
  }
  return { mode, lastThemeByContext: map, updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : new Date(0).toISOString() };
}

function loadMemory(): CardThemeMemory {
  try { return normalizeMemory(JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}')); }
  catch { return defaultMemory(); }
}
function storeMemory(memory: CardThemeMemory) { try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch {} }

function prettyId(value: string): string {
  return value.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function activeThemeContext(): ThemeContext | null {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  if (!root) return null;
  if (root.dataset.universe === 'prythian') {
    const id = root.dataset.court || 'night';
    return { key: `prythian:${id}`, label: `${prettyId(id)} Court` };
  }
  const id = root.dataset.path || 'rider';
  return { key: `empyrean:${id}`, label: prettyId(id) };
}

function validTheme(value: unknown): value is CardThemePreset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Partial<CardThemePreset>;
  return Boolean(source.id && source.name && source.design && source.createdAt && source.updatedAt);
}

function normalizeThemes(value: unknown): CardThemePreset[] {
  return Array.isArray(value) ? value.filter(validTheme).map((theme) => ({ ...theme, design: cloneDesign(theme.design) })) : [];
}

function mergeThemes(localThemes: CardThemePreset[], cloudThemes: CardThemePreset[]): CardThemePreset[] {
  const merged = new Map<string, CardThemePreset>();
  [...localThemes, ...cloudThemes].forEach((theme) => {
    const key = theme.id || theme.name.toLocaleLowerCase();
    const existing = merged.get(key);
    if (!existing || String(theme.updatedAt).localeCompare(String(existing.updatedAt)) >= 0) merged.set(key, theme);
  });
  return [...merged.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function readCloudState(userId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('archive_states')
    .select('state')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : undefined;
  return row?.state && typeof row.state === 'object' ? row.state as Record<string, unknown> : {};
}

async function loadCloudThemes(userId: string): Promise<CardThemePreset[]> {
  const state = await readCloudState(userId);
  return normalizeThemes(state.cardThemes);
}

async function loadCloudMemory(userId: string): Promise<CardThemeMemory> {
  const state = await readCloudState(userId);
  return normalizeMemory(state.cardThemeContextMemory);
}

async function saveCloudStateSlice(userId: string, slice: Record<string, unknown>): Promise<void> {
  const { data, error: readError } = await supabase
    .from('archive_states')
    .select('state')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (readError) throw readError;
  const existing = Array.isArray(data) ? data[0] : undefined;
  const state = existing?.state && typeof existing.state === 'object' ? existing.state as Record<string, unknown> : {};
  const payload = { state: { ...state, ...slice }, updated_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabase.from('archive_states').update(payload).eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('archive_states').insert({ user_id: userId, ...payload });
  if (error) throw error;
}

async function saveCloudThemes(userId: string, themes: CardThemePreset[]): Promise<void> {
  await saveCloudStateSlice(userId, { cardThemes: themes });
}
async function saveCloudMemory(userId: string, memory: CardThemeMemory): Promise<void> {
  await saveCloudStateSlice(userId, { cardThemeContextMemory: memory });
}

function CardThemeLibrary() {
  const [view, setView] = useState<View>('hidden');
  const [open, setOpen] = useState(false);
  const [themes, setThemes] = useState<CardThemePreset[]>(loadThemes);
  const [archive, setArchive] = useState<V2ArchiveState | null>(null);
  const [memory, setMemory] = useState<CardThemeMemory>(loadMemory);
  const [context, setContext] = useState<ThemeContext | null>(() => activeThemeContext());
  const [name, setName] = useState('');
  const [selectedThemeId, setSelectedThemeId] = useState('');
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [applying, setApplying] = useState(false);
  const previousContextKey = useRef<string | null>(activeThemeContext()?.key || null);
  const restoreToken = useRef(0);

  useEffect(() => {
    const syncView = () => setView(document.querySelector('.v2-view--editor') ? 'editor' : document.querySelector('.v2-view--library') ? 'library' : 'hidden');
    const syncContext = () => setContext(activeThemeContext());
    syncView();
    syncContext();
    const observer = new MutationObserver(() => { syncView(); syncContext(); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-universe', 'data-path', 'data-court'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    getAuthSnapshot().then(async ({ user }) => {
      if (!user || !active) return;
      const [nextArchive, cloudThemes, cloudMemory] = await Promise.all([loadCloudArchive(user), loadCloudThemes(user.id), loadCloudMemory(user.id)]);
      if (!active) return;
      setArchive(nextArchive);
      const mergedThemes = mergeThemes(loadThemes(), cloudThemes);
      setThemes(mergedThemes);
      storeThemes(mergedThemes);
      const localMemory = loadMemory();
      const mergedMemory = cloudMemory.updatedAt.localeCompare(localMemory.updatedAt) >= 0 ? cloudMemory : localMemory;
      setMemory(mergedMemory);
      storeMemory(mergedMemory);
      if (JSON.stringify(mergedThemes) !== JSON.stringify(cloudThemes)) await saveCloudThemes(user.id, mergedThemes);
      if (JSON.stringify(mergedMemory) !== JSON.stringify(cloudMemory)) await saveCloudMemory(user.id, mergedMemory);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (view === 'hidden' || !open) return;
    let active = true;
    getAuthSnapshot().then(async ({ user }) => {
      if (!user || !active) return;
      const nextArchive = await loadCloudArchive(user);
      if (active) setArchive(nextArchive);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [view, open]);

  useEffect(() => { if (!selectedThemeId && themes.length) setSelectedThemeId(themes[0].id); }, [themes, selectedThemeId]);

  useEffect(() => {
    const nextKey = context?.key || null;
    const previousKey = previousContextKey.current;
    previousContextKey.current = nextKey;
    if (!nextKey || !previousKey || nextKey === previousKey || memory.mode === 'off') return;

    const token = ++restoreToken.current;
    window.setTimeout(() => {
      if (token !== restoreToken.current) return;
      const rememberedId = memory.lastThemeByContext[nextKey];
      if (!rememberedId) return;
      const rememberedTheme = themes.find((theme) => theme.id === rememberedId);
      if (!rememberedTheme) {
        const cleaned: CardThemeMemory = {
          ...memory,
          lastThemeByContext: Object.fromEntries(Object.entries(memory.lastThemeByContext).filter(([, themeId]) => themeId !== rememberedId)),
          updatedAt: new Date().toISOString(),
        };
        setMemory(cleaned);
        storeMemory(cleaned);
        void getAuthSnapshot().then(({ user }) => user ? saveCloudMemory(user.id, cleaned) : undefined).catch(() => undefined);
        return;
      }

      const shouldRestore = memory.mode === 'auto' || window.confirm(`You last used the Card Theme “${rememberedTheme.name}” with ${context?.label || 'this theme'}. Switch your library cards back to it?`);
      if (shouldRestore) void restoreThemeToEveryCard(rememberedTheme, context?.label || 'this theme');
    }, 450);
  }, [context?.key, memory.mode, themes]);

  const selectedTheme = useMemo(() => themes.find((theme) => theme.id === selectedThemeId) || null, [themes, selectedThemeId]);
  const rememberedTheme = useMemo(() => {
    const id = context ? memory.lastThemeByContext[context.key] : '';
    return themes.find((theme) => theme.id === id) || null;
  }, [context?.key, memory.lastThemeByContext, themes]);
  const filteredBooks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (archive?.books || []).filter((book) => !needle || `${book.title} ${book.author} ${book.series}`.toLowerCase().includes(needle));
  }, [archive?.books, query]);

  async function persistThemes(next: CardThemePreset[]) {
    setThemes(next);
    storeThemes(next);
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('Your session expired.');
    await saveCloudThemes(user.id, next);
  }

  async function persistMemory(next: CardThemeMemory, message?: string) {
    setMemory(next);
    storeMemory(next);
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired.');
      await saveCloudMemory(user.id, next);
      if (message) setStatus(message);
    } catch (reason) {
      if (message) setStatus(reason instanceof Error ? `${reason.message} The preference is still saved on this device.` : 'Saved on this device, but cloud sync failed.');
    }
  }

  async function rememberTheme(themeId: string) {
    if (!context) return;
    const next: CardThemeMemory = {
      ...memory,
      lastThemeByContext: { ...memory.lastThemeByContext, [context.key]: themeId },
      updatedAt: new Date().toISOString(),
    };
    await persistMemory(next);
  }

  async function changeRestoreMode(mode: RestoreMode) {
    const next: CardThemeMemory = { ...memory, mode, updatedAt: new Date().toISOString() };
    const label = mode === 'off' ? 'Card Theme memory is off.' : mode === 'ask' ? 'I’ll ask before restoring a remembered Card Theme.' : 'Remembered Card Themes will restore automatically when you switch themes.';
    await persistMemory(next, label);
  }

  async function saveCurrentDesign() {
    const cleanName = name.trim();
    if (!cleanName) return;
    const draft = await loadWorkspaceDraft();
    if (!draft?.design) { setStatus('No current design was found. Open a book and edit its card first.'); return; }
    const timestamp = new Date().toISOString();
    const existing = themes.find((theme) => theme.name.toLowerCase() === cleanName.toLowerCase());
    const preset: CardThemePreset = existing
      ? { ...existing, design: cloneDesign(draft.design), updatedAt: timestamp }
      : { id: crypto.randomUUID(), name: cleanName, design: cloneDesign(draft.design), createdAt: timestamp, updatedAt: timestamp };
    const next = existing ? themes.map((theme) => theme.id === existing.id ? preset : theme) : [preset, ...themes];
    setSelectedThemeId(preset.id);
    setName('');
    setStatus('Saving theme to your account…');
    try {
      await persistThemes(next);
      await rememberTheme(preset.id);
      setStatus(existing ? `Updated “${preset.name}”, remembered it for ${context?.label || 'this theme'}, and synced it.` : `Saved “${preset.name}”, remembered it for ${context?.label || 'this theme'}, and synced it.`);
    } catch (reason) {
      setThemes(next);
      storeThemes(next);
      setStatus(reason instanceof Error ? `${reason.message} The theme is still saved on this device.` : 'Theme saved on this device, but cloud sync failed.');
    }
  }

  async function deleteTheme(id: string) {
    const target = themes.find((theme) => theme.id === id);
    if (!target || !window.confirm(`Delete the card theme “${target.name}”? This removes it from every synced device.`)) return;
    const nextThemes = themes.filter((theme) => theme.id !== id);
    const nextMemory: CardThemeMemory = {
      ...memory,
      lastThemeByContext: Object.fromEntries(Object.entries(memory.lastThemeByContext).filter(([, themeId]) => themeId !== id)),
      updatedAt: new Date().toISOString(),
    };
    setSelectedThemeId(nextThemes[0]?.id || '');
    setStatus('Removing theme from your account…');
    try {
      await persistThemes(nextThemes);
      await persistMemory(nextMemory);
      setStatus(`Deleted “${target.name}” and cleared any remembered theme associations that used it.`);
    } catch (reason) {
      setThemes(nextThemes);
      storeThemes(nextThemes);
      setMemory(nextMemory);
      storeMemory(nextMemory);
      setStatus(reason instanceof Error ? `${reason.message} The local copy was removed.` : 'Local theme removed, but cloud sync failed.');
    }
  }

  async function applyThemeToIds(theme: CardThemePreset, ids: string[], successMessage: string) {
    if (!archive || !ids.length || applying) return;
    setApplying(true);
    const idSet = new Set(ids);
    const timestamp = new Date().toISOString();
    const next: V2ArchiveState = {
      ...archive,
      books: archive.books.map((book) => idSet.has(book.id) ? { ...book, design: themedDesign(theme, book), updatedAt: timestamp } : book),
      updatedAt: timestamp,
    };
    setArchive(next);
    saveLocalArchive(next);
    setStatus('Saving applied theme…');
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired.');
      await saveCloudArchive(user, next);
      await rememberTheme(theme.id);
      setStatus(successMessage);
      setOpen(false);
      window.setTimeout(() => window.location.reload(), 140);
    } catch (reason) {
      setApplying(false);
      setStatus(reason instanceof Error ? reason.message : 'Saved locally, but cloud save failed.');
    }
  }

  async function applySelected() {
    if (!selectedTheme || !selectedBookIds.length) return;
    await applyThemeToIds(selectedTheme, selectedBookIds, `Applied “${selectedTheme.name}” to ${selectedBookIds.length} ${selectedBookIds.length === 1 ? 'card' : 'cards'} and remembered it for ${context?.label || 'this theme'}.`);
  }

  async function restoreThemeToEveryCard(theme: CardThemePreset, contextLabel: string) {
    if (applying) return;
    setApplying(true);
    try {
      const { user } = await getAuthSnapshot();
      if (!user) throw new Error('Your session expired.');
      const latest = await loadCloudArchive(user);
      const timestamp = new Date().toISOString();
      const next: V2ArchiveState = {
        ...latest,
        books: latest.books.map((book) => ({ ...book, design: themedDesign(theme, book), updatedAt: timestamp })),
        updatedAt: timestamp,
      };
      setArchive(next);
      saveLocalArchive(next);
      await saveCloudArchive(user, next);
      setStatus(`Restored “${theme.name}” for ${contextLabel}.`);
      window.setTimeout(() => window.location.reload(), 140);
    } catch (reason) {
      setApplying(false);
      setStatus(reason instanceof Error ? reason.message : 'Could not restore the remembered Card Theme.');
    }
  }

  if (view === 'hidden') return null;
  return <>
    <button className={`card-theme-library-launcher is-${view}`} type="button" onClick={() => { setOpen(true); setStatus(''); }}>{view === 'editor' ? 'Save Design as Theme' : 'Card Themes'}</button>
    {open && <div className="card-theme-library-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !applying) setOpen(false); }}>
      <section className="card-theme-library-dialog" role="dialog" aria-modal="true">
        <header><div><p>Reusable card designs</p><h2>Card Theme Library</h2></div><button type="button" disabled={applying} onClick={() => setOpen(false)}>×</button></header>
        <section className="card-theme-context-memory">
          <div><h3>Remember Card Theme by interface theme</h3><p>{context ? `Current interface theme: ${context.label}.` : 'Current interface theme is unavailable.'} {rememberedTheme ? `Remembered Card Theme: “${rememberedTheme.name}”.` : 'No Card Theme has been remembered here yet.'}</p></div>
          <label>When switching themes<select value={memory.mode} disabled={applying} onChange={(event) => void changeRestoreMode(event.target.value as RestoreMode)}><option value="off">Off</option><option value="ask">Ask me when switching themes</option><option value="auto">Automatically restore last used Card Theme</option></select></label>
        </section>
        <div className="card-theme-library-columns">
          <section><h3>Save current design</h3><label>Theme name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Midnight parchment" /></label><button className="is-primary" type="button" disabled={!name.trim()} onClick={() => void saveCurrentDesign()}>Save This Design</button><h3>Saved themes</h3><div className="card-theme-library-list">{themes.map((theme) => <article key={theme.id} className={selectedThemeId === theme.id ? 'is-selected' : ''}><button type="button" onClick={() => setSelectedThemeId(theme.id)}><span style={{ background: theme.design.background }} /><strong>{theme.name}</strong><small>{theme.design.elements.length} elements</small></button><button type="button" className="is-danger" onClick={() => void deleteTheme(theme.id)}>Delete</button></article>)}{!themes.length && <p>No themes saved yet.</p>}</div></section>
          <section><h3>Apply to library cards</h3><label>Theme<select value={selectedThemeId} onChange={(event) => setSelectedThemeId(event.target.value)}><option value="">Choose a theme</option>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label><label>Search books<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, author, or series" /></label><div className="card-theme-library-select-actions"><button type="button" onClick={() => setSelectedBookIds(filteredBooks.map((book) => book.id))}>Select shown</button><button type="button" onClick={() => setSelectedBookIds([])}>Clear</button></div><div className="card-theme-library-books">{filteredBooks.map((book) => <label key={book.id}><input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={() => setSelectedBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} /><span><strong>{book.title}</strong><small>{book.author || 'Unknown author'}{book.series ? ` · ${book.series}` : ''}</small></span></label>)}{!filteredBooks.length && <p>No books match this search.</p>}</div><div className="card-theme-library-apply-buttons"><button type="button" className="is-primary" disabled={!selectedTheme || !selectedBookIds.length || applying} onClick={() => void applySelected()}>{applying ? 'Applying…' : `Apply to Selected (${selectedBookIds.length})`}</button><button type="button" disabled={!selectedTheme || !archive?.books.length || applying} onClick={() => selectedTheme && void applyThemeToIds(selectedTheme, archive?.books.map((book) => book.id) || [], `Applied “${selectedTheme.name}” to every card and remembered it for ${context?.label || 'this theme'}.`)}>Apply to Every Card</button></div></section>
        </div>{status && <footer>{status}</footer>}
      </section>
    </div>}
  </>;
}

function start() {
  document.getElementById('card-theme-manager-runtime')?.remove();
  document.getElementById('card-theme-library-runtime')?.remove();
  const host = document.createElement('div');
  host.id = 'card-theme-library-runtime';
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><CardThemeLibrary /></StrictMode>);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
