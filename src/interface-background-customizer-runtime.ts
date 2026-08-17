import { getAuthSnapshot, supabase } from './supabase';

type BackgroundRecord = { url: string; updatedAt: string };
type BackgroundLibrary = Record<string, BackgroundRecord>;

const STORAGE_KEY = 'fantasy-book-tracker-interface-backgrounds';
let library: BackgroundLibrary = loadLocal();

function activeKey(): string | null {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  if (!root) return null;
  if (root.dataset.universe === 'prythian') return `prythian:${root.dataset.court || 'night'}`;
  return `empyrean:${root.dataset.path || 'rider'}`;
}

function validUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const clean = value.trim();
  if (!clean) return '';
  try {
    const parsed = new URL(clean, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function normalize(value: unknown): BackgroundLibrary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: BackgroundLibrary = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const source = raw as Partial<BackgroundRecord>;
    if (!source.updatedAt) return;
    output[key] = { url: validUrl(source.url), updatedAt: String(source.updatedAt) };
  });
  return output;
}

function loadLocal(): BackgroundLibrary {
  try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return {}; }
}

function storeLocal(next: BackgroundLibrary): void {
  library = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
}

function merge(local: BackgroundLibrary, cloud: BackgroundLibrary): BackgroundLibrary {
  const next = { ...local };
  Object.entries(cloud).forEach(([key, record]) => {
    const current = next[key];
    if (!current || record.updatedAt.localeCompare(current.updatedAt) >= 0) next[key] = record;
  });
  return next;
}

function applyActive(): void {
  const key = activeKey();
  const record = key ? library[key] : undefined;
  const url = record?.url || '';
  if (!url) {
    document.documentElement.style.removeProperty('--interface-background-image');
    delete document.documentElement.dataset.interfaceBackgroundCustom;
    delete document.body.dataset.interfaceBackgroundCustom;
    return;
  }
  document.documentElement.style.setProperty('--interface-background-image', `url("${url.replace(/"/g, '%22')}")`);
  document.documentElement.dataset.interfaceBackgroundCustom = 'true';
  document.body.dataset.interfaceBackgroundCustom = 'true';
}

async function loadCloud(userId: string): Promise<BackgroundLibrary> {
  const { data, error } = await supabase.from('archive_states').select('state').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : undefined;
  const state = row?.state && typeof row.state === 'object' ? row.state as Record<string, unknown> : {};
  return normalize(state.interfaceBackgrounds);
}

async function saveCloud(userId: string, next: BackgroundLibrary): Promise<void> {
  const { data, error: readError } = await supabase.from('archive_states').select('state').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1);
  if (readError) throw readError;
  const existing = Array.isArray(data) ? data[0] : undefined;
  const state = existing?.state && typeof existing.state === 'object' ? existing.state as Record<string, unknown> : {};
  const payload = { state: { ...state, interfaceBackgrounds: next }, updated_at: new Date().toISOString() };
  if (existing) {
    const { error } = await supabase.from('archive_states').update(payload).eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('archive_states').insert({ user_id: userId, ...payload });
    if (error) throw error;
  }
}

async function persist(url: string): Promise<void> {
  const key = activeKey();
  if (!key) return;
  const next = { ...library, [key]: { url: validUrl(url), updatedAt: new Date().toISOString() } };
  storeLocal(next);
  applyActive();
  const { user } = await getAuthSnapshot();
  if (user) await saveCloud(user.id, next);
}

function injectField(): void {
  const dialog = document.querySelector<HTMLElement>('.interface-theme-dialog');
  if (!dialog || dialog.querySelector('.interface-background-field')) return;
  const colorsSection = dialog.querySelector<HTMLElement>('.interface-theme-grid>section');
  if (!colorsSection) return;

  const key = activeKey();
  const current = key ? library[key]?.url || '' : '';
  const wrap = document.createElement('div');
  wrap.className = 'interface-background-field';
  wrap.innerHTML = `<h3>Background image</h3><label><span>Image URL</span><input type="url" placeholder="https://…/your-background.png" value="${current.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></label><small>Replaces the built-in theme artwork on this theme only. Saved across devices.</small>`;
  colorsSection.appendChild(wrap);

  const input = wrap.querySelector<HTMLInputElement>('input');
  input?.addEventListener('input', () => {
    const preview = validUrl(input.value);
    if (preview) {
      document.documentElement.style.setProperty('--interface-background-image', `url("${preview.replace(/"/g, '%22')}")`);
      document.documentElement.dataset.interfaceBackgroundCustom = 'true';
      document.body.dataset.interfaceBackgroundCustom = 'true';
    } else {
      document.documentElement.style.removeProperty('--interface-background-image');
      delete document.documentElement.dataset.interfaceBackgroundCustom;
      delete document.body.dataset.interfaceBackgroundCustom;
    }
  });

  const saveButton = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Save Interface Theme'));
  saveButton?.addEventListener('click', () => void persist(input?.value || '').catch(() => undefined));

  const resetButton = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Reset to Theme Defaults'));
  resetButton?.addEventListener('click', () => { if (input) input.value = ''; void persist('').catch(() => undefined); });
}

function start(): void {
  applyActive();
  getAuthSnapshot().then(async ({ user }) => {
    if (!user) return;
    const cloud = await loadCloud(user.id);
    storeLocal(merge(loadLocal(), cloud));
    applyActive();
  }).catch(() => undefined);

  const observer = new MutationObserver(() => { applyActive(); injectField(); });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-universe', 'data-path', 'data-court'] });
  injectField();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
