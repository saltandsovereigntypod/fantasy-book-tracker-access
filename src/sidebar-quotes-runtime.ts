import { loadCloudArchive, loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { getAuthSnapshot } from './supabase';
import './sidebar-quotes-runtime.css';

type UniverseId = 'empyrean' | 'prythian';
type QuoteProfile = V2ArchiveState['profile'] & {
  sidebarQuotes?: string[];
  sidebarQuotesByUniverse?: Partial<Record<UniverseId, string[]>>;
};

const DEFAULT_QUOTES: Record<UniverseId, string[]> = {
  empyrean: [
    '“I am the sky and the power of every storm that has ever been. I am infinite.”',
    '“There’s nowhere in existence you could go that I wouldn’t find you, Violence.”',
  ],
  prythian: [
    '“To the stars who listen and the dreams that are answered.”',
    '“I am the rock against which the surf crashes. Nothing can break me.”',
  ],
};

function activeUniverse(): UniverseId {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  return root?.dataset.universe === 'prythian' ? 'prythian' : 'empyrean';
}

function quotePair(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return [String(value[0] ?? ''), String(value[1] ?? '')];
}

function currentQuotes(universe = activeUniverse()): string[] {
  const archive = loadLocalArchive();
  const profile = archive.profile as QuoteProfile;
  const savedForUniverse = quotePair(profile.sidebarQuotesByUniverse?.[universe]);
  if (savedForUniverse) return savedForUniverse;

  // Preserve any quotes already edited from the original Rider-only editor as the
  // Empyrean set. Prythian starts from the established Night Court pair.
  if (universe === 'empyrean') {
    const legacy = quotePair(profile.sidebarQuotes);
    if (legacy) return legacy;
  }

  return [...DEFAULT_QUOTES[universe]];
}

function withUniverseQuotes(state: V2ArchiveState, universe: UniverseId, quotes: string[]): V2ArchiveState {
  const profile = state.profile as QuoteProfile;
  const nextByUniverse = {
    ...(profile.sidebarQuotesByUniverse || {}),
    [universe]: quotes,
  };
  return {
    ...state,
    profile: {
      ...profile,
      sidebarQuotesByUniverse: nextByUniverse,
      ...(universe === 'empyrean' ? { sidebarQuotes: quotes } : {}),
    } as QuoteProfile,
    updatedAt: new Date().toISOString(),
  };
}

async function saveQuotes(universe: UniverseId, quotes: string[], status: HTMLElement): Promise<void> {
  const localNext = withUniverseQuotes(loadLocalArchive(), universe, quotes);
  saveLocalArchive(localNext);
  status.textContent = 'Saving…';

  try {
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('No signed-in user');
    const latest = await loadCloudArchive(user);
    const next = withUniverseQuotes(latest, universe, quotes);
    await saveCloudArchive(user, next);
    saveLocalArchive(next);
    status.textContent = 'Saved';
    window.setTimeout(() => { status.textContent = ''; }, 1400);
  } catch {
    status.textContent = 'Saved locally';
  }
}

function buildPanel(footer: HTMLElement, universe: UniverseId): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'v2-sidebar-custom-quotes';
  panel.dataset.sidebarCustomQuotes = 'true';
  panel.dataset.quoteUniverse = universe;

  const display = document.createElement('div');
  display.className = 'v2-sidebar-custom-quotes-display';

  const controls = document.createElement('div');
  controls.className = 'v2-sidebar-custom-quotes-controls';

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'v2-sidebar-custom-quotes-edit';
  edit.textContent = 'Edit';
  edit.setAttribute('aria-label', `Edit ${universe === 'prythian' ? 'Prythian' : 'Empyrean'} sidebar quotes`);

  const status = document.createElement('small');
  status.className = 'v2-sidebar-custom-quotes-status';
  controls.append(edit, status);
  panel.append(display, controls);

  const renderDisplay = () => {
    display.replaceChildren();
    currentQuotes(universe).forEach((quote) => {
      if (!quote.trim()) return;
      const p = document.createElement('p');
      p.textContent = quote;
      display.appendChild(p);
    });
    if (!display.childElementCount) {
      const empty = document.createElement('p');
      empty.className = 'is-empty';
      empty.textContent = 'Add your own sidebar words.';
      display.appendChild(empty);
    }
  };

  edit.addEventListener('click', () => {
    if (panel.classList.contains('is-editing')) return;
    panel.classList.add('is-editing');
    const values = currentQuotes(universe);
    const form = document.createElement('div');
    form.className = 'v2-sidebar-custom-quotes-form';

    const first = document.createElement('textarea');
    first.value = values[0] ?? '';
    first.placeholder = 'First quote or message';
    first.setAttribute('aria-label', 'First sidebar quote');

    const second = document.createElement('textarea');
    second.value = values[1] ?? '';
    second.placeholder = 'Second quote or message';
    second.setAttribute('aria-label', 'Second sidebar quote');

    const actions = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Save';
    actions.append(cancel, save);
    form.append(first, second, actions);
    display.replaceChildren(form);

    cancel.addEventListener('click', () => {
      panel.classList.remove('is-editing');
      renderDisplay();
    });
    save.addEventListener('click', async () => {
      save.disabled = true;
      await saveQuotes(universe, [first.value.trim(), second.value.trim()], status);
      panel.classList.remove('is-editing');
      renderDisplay();
    });
  });

  renderDisplay();
  footer.prepend(panel);
  return panel;
}

function syncPanel(): void {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  const footer = document.querySelector<HTMLElement>('.v2-app-sidebar .v2-sidebar-footer');
  const existing = document.querySelector<HTMLElement>('[data-sidebar-custom-quotes]');
  const universe: UniverseId | undefined = root?.dataset.universe === 'prythian'
    ? 'prythian'
    : root?.dataset.universe === 'empyrean'
      ? 'empyrean'
      : undefined;

  if (!footer || !universe) {
    existing?.remove();
    return;
  }

  if (existing?.dataset.quoteUniverse !== universe) existing.remove();
  if (!document.querySelector('[data-sidebar-custom-quotes]')) buildPanel(footer, universe);
}

let frame = 0;
function scheduleSync(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    syncPanel();
  });
}

function start(): void {
  scheduleSync();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-path', 'data-universe', 'data-court'] });
  window.addEventListener('storage', scheduleSync);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
