import { loadCloudArchive, loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { PATHS } from './paths';
import { getAuthSnapshot } from './supabase';
import './rider-replay-threshing-runtime.css';

const EVENT_NAME = 'Threshing';
const VIEW_KEY = 'empyrean-v2-current-view';
const REPLAY_THRESHOLD = PATHS.rider.thresholds[PATHS.rider.bondedRank ?? 1];

function isThreshingStory(story: V2ArchiveState['universes']['empyrean']['stories'][number]): boolean {
  const title = String(story?.title || '').toLocaleLowerCase();
  const key = String(story?.key || '').toLocaleLowerCase();
  return title.startsWith('threshing:') || key.includes('-threshing-');
}

async function resetThreshing(button: HTMLButtonElement, status: HTMLElement): Promise<void> {
  if (!window.confirm('Replay Threshing? Your points and assigned dragon will stay exactly as they are. Only the completed Threshing event and its previous story record will be reset.')) return;
  button.disabled = true;
  status.textContent = 'Resetting Threshing…';

  try {
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('No signed-in user');
    const latest = await loadCloudArchive(user);
    const next: V2ArchiveState = {
      ...latest,
      universes: {
        ...latest.universes,
        empyrean: {
          ...latest.universes.empyrean,
          completedEvents: (latest.universes.empyrean.completedEvents || []).filter((event) => event !== EVENT_NAME),
          stories: (latest.universes.empyrean.stories || []).filter((story) => !isThreshingStory(story)),
        },
      },
      updatedAt: new Date().toISOString(),
    };

    saveLocalArchive(next);
    await saveCloudArchive(user, next);
    status.textContent = 'Threshing reset. Your dragon and points were preserved.';
    try { localStorage.setItem(VIEW_KEY, 'dashboard'); } catch {}
    window.dispatchEvent(new StorageEvent('storage', { key: 'empyrean-v2-archive' }));
    window.setTimeout(() => window.location.reload(), 900);
  } catch {
    button.disabled = false;
    status.textContent = 'Could not reset Threshing. Nothing was changed.';
  }
}

function render(): void {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  const profile = document.querySelector<HTMLElement>('.v2-profile.core-profile');
  const existing = document.querySelector<HTMLElement>('[data-replay-threshing]');
  if (!root || !profile || root.dataset.universe !== 'empyrean' || root.dataset.path !== 'rider') {
    existing?.remove();
    return;
  }

  const archive = loadLocalArchive();
  const dragon = archive.profile.identityAssignments?.rider?.dragon;
  const points = Number(archive.universes.empyrean.points ?? archive.profile.points) || 0;
  if (!dragon?.name || points < REPLAY_THRESHOLD) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const host = profile.querySelector<HTMLElement>('.core-profile-assignment');
  if (!host) return;
  const section = document.createElement('section');
  section.className = 'rider-replay-threshing';
  section.dataset.replayThreshing = 'true';
  const copy = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = 'Replay Threshing';
  const detail = document.createElement('small');
  detail.textContent = 'Reset only the Threshing event. Your points and assigned dragon stay saved, but the dragon is hidden again until you survive the new story.';
  copy.append(title, detail);
  const controls = document.createElement('div');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Reset & replay Threshing';
  const status = document.createElement('span');
  button.addEventListener('click', () => void resetThreshing(button, status));
  controls.append(button, status);
  section.append(copy, controls);
  host.appendChild(section);
}

let queued = false;
function schedule(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
}

function start(): void {
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-path', 'data-universe'] });
  window.addEventListener('storage', schedule);
  window.addEventListener('focus', schedule);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
