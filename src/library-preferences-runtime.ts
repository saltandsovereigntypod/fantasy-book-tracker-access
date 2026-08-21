import { getAuthSnapshot, supabase } from './supabase';

type LibraryPreferences = {
  filter?: string;
  sort?: string;
  size?: string;
  detailedSort?: string;
  sortPrimary?: string;
  sortSecondary?: string;
  sortTertiary?: string;
  groupBy?: string;
  settingsCollapsed?: boolean;
};

const LOCAL_KEY = 'empyrean-v2-library-preferences';
let preferences: LibraryPreferences = readLocal();
let hydrated = false;
let saveTimer: number | null = null;

function readLocal(): LibraryPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed as LibraryPreferences : {};
  } catch {
    return {};
  }
}

function writeLocal(next: LibraryPreferences) {
  preferences = { ...preferences, ...next };
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(preferences)); } catch {}
}

function selectKind(select: HTMLSelectElement): keyof LibraryPreferences | null {
  const explicit = select.dataset.libraryPref as keyof LibraryPreferences | undefined;
  if (explicit) return explicit;
  if (select.closest('.advanced-library-sort')) return 'detailedSort';
  const values = [...select.options].map((option) => option.value);
  if (values.includes('active') && values.includes('archived')) return 'filter';
  if (values.includes('updated') && values.includes('rating')) return 'sort';
  if (values.includes('small') && values.includes('medium') && values.includes('large')) return 'size';
  return null;
}

function applyPreference(select: HTMLSelectElement) {
  const kind = selectKind(select);
  if (!kind || kind === 'settingsCollapsed') return;
  let value = preferences[kind];
  if (kind === 'sortPrimary' && !value && preferences.detailedSort) value = preferences.detailedSort;
  if (typeof value !== 'string' || !value || select.value === value || ![...select.options].some((option) => option.value === value)) return;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function setCollapsed(library: HTMLElement, collapsed: boolean) {
  library.classList.toggle('library-settings-collapsed', collapsed);
  const toggle = library.querySelector<HTMLButtonElement>('.library-settings-toggle');
  if (!toggle) return;
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.setAttribute('aria-label', collapsed ? 'Expand library settings' : 'Collapse library settings');
  const label = toggle.querySelector<HTMLElement>('.library-settings-toggle-label');
  const state = toggle.querySelector<HTMLElement>('.library-settings-toggle-state');
  if (label) label.textContent = 'Library settings';
  if (state) state.textContent = collapsed ? 'Show' : 'Hide';
}

function ensureCollapseUi(library: HTMLElement) {
  const controls = library.querySelector<HTMLElement>('.v2-library-controls');
  if (!controls) return;

  let toggle = library.querySelector<HTMLButtonElement>('.library-settings-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'library-settings-toggle';
    toggle.innerHTML = '<span class="library-settings-toggle-label">Library settings</span><span class="library-settings-toggle-state">Hide</span><span class="library-settings-toggle-chevron" aria-hidden="true">⌄</span>';
    controls.insertAdjacentElement('beforebegin', toggle);
    toggle.addEventListener('click', () => {
      const collapsed = !library.classList.contains('library-settings-collapsed');
      writeLocal({ settingsCollapsed: collapsed });
      setCollapsed(library, collapsed);
      scheduleCloudSave();
      window.dispatchEvent(new CustomEvent('library-settings-visibility-changed', { detail: { collapsed } }));
    });
  }

  setCollapsed(library, preferences.settingsCollapsed === true);
}

function applyAll() {
  document.querySelectorAll<HTMLSelectElement>('.v2-view--library .v2-library-controls select, .v2-view--library .advanced-library-sort select').forEach(applyPreference);
  document.querySelectorAll<HTMLElement>('.v2-view--library .v2-library').forEach(ensureCollapseUi);
}

async function loadCloudPreferences() {
  try {
    const { user } = await getAuthSnapshot();
    if (!user) return;
    const { data, error } = await supabase
      .from('archive_states')
      .select('state')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : undefined;
    const state = row?.state && typeof row.state === 'object' ? row.state as Record<string, unknown> : {};
    const cloud = state.libraryPreferences;
    if (cloud && typeof cloud === 'object' && !Array.isArray(cloud)) {
      preferences = { ...preferences, ...(cloud as LibraryPreferences) };
      writeLocal(preferences);
    }
  } catch {
    // Local preferences remain the offline fallback.
  } finally {
    hydrated = true;
    applyAll();
  }
}

async function saveCloudPreferences() {
  if (!hydrated) return;
  try {
    const { user } = await getAuthSnapshot();
    if (!user) return;
    const { data, error } = await supabase
      .from('archive_states')
      .select('state')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : undefined;
    if (!row?.state || typeof row.state !== 'object') return;
    const state = row.state as Record<string, unknown>;
    const { error: updateError } = await supabase
      .from('archive_states')
      .update({ state: { ...state, libraryPreferences: preferences }, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (updateError) throw updateError;
  } catch {
    // Preferences stay local and will retry on a later change.
  }
}

function scheduleCloudSave() {
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void saveCloudPreferences();
  }, 350);
}

function handleChange(event: Event) {
  const select = event.target instanceof HTMLSelectElement ? event.target : null;
  if (!select || !select.matches('.v2-view--library .v2-library-controls select, .v2-view--library .advanced-library-sort select')) return;
  const kind = selectKind(select);
  if (!kind || kind === 'settingsCollapsed') return;
  writeLocal({ [kind]: select.value });
  scheduleCloudSave();
}

let frame = 0;
function scheduleApply() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    applyAll();
  });
}

function start() {
  document.addEventListener('change', handleChange, true);
  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.body, { childList: true, subtree: true });
  applyAll();
  void loadCloudPreferences();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();