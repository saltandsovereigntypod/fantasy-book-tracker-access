import { createCreatureAssignment } from './assignments';
import { loadCloudArchive, loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { PATHS } from './paths';
import { getAuthSnapshot } from './supabase';
import './rider-threshing-runtime.css';

type RiderArchive = V2ArchiveState;

const EVENT_NAME = 'Threshing';
const THRESHING_UNLOCK_THRESHOLD = PATHS.rider.thresholds[1];

function riderPoints(archive: RiderArchive): number {
  return Number(archive.universes?.empyrean?.points ?? archive.profile.points) || 0;
}

function currentDragon(archive: RiderArchive) {
  return archive.profile.identityAssignments?.rider?.dragon;
}

function isEligible(archive: RiderArchive): boolean {
  const path = archive.universes?.empyrean?.path || archive.profile.path;
  const completed = archive.universes?.empyrean?.completedEvents || [];
  const threshingRecorded = completed.includes(EVENT_NAME);
  const hasBondedDragon = Boolean(currentDragon(archive)?.name);
  return path === 'rider' && riderPoints(archive) >= THRESHING_UNLOCK_THRESHOLD && (!threshingRecorded || !hasBondedDragon);
}

async function completeThreshing(status: HTMLElement, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  status.textContent = 'Entering the valley…';

  try {
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('No signed-in user');

    const latest = await loadCloudArchive(user) as RiderArchive;
    if (!isEligible(latest)) {
      status.textContent = 'Threshing already recorded.';
      scheduleSync();
      return;
    }

    const existingDragon = currentDragon(latest);
    const dragon = existingDragon || createCreatureAssignment('dragon', [], `${latest.profile.identitySeed}:threshing`);
    const completedEvents = [...new Set([...(latest.universes.empyrean.completedEvents || []), EVENT_NAME])];

    const next: RiderArchive = {
      ...latest,
      profile: {
        ...latest.profile,
        creature: dragon,
        identityAssignments: {
          ...latest.profile.identityAssignments,
          rider: {
            ...latest.profile.identityAssignments.rider,
            dragon,
          },
        },
      },
      universes: {
        ...latest.universes,
        empyrean: {
          ...latest.universes.empyrean,
          completedEvents,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    saveLocalArchive(next);
    await saveCloudArchive(user, next);
    status.textContent = `Bonded to ${dragon.name}.`;
    window.dispatchEvent(new StorageEvent('storage', { key: 'empyrean-v2-archive' }));
    window.setTimeout(scheduleSync, 700);
  } catch {
    button.disabled = false;
    status.textContent = 'Threshing could not be recorded. Try again.';
  }
}

function buildEvent(host: HTMLElement, archive: RiderArchive): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'rider-threshing-event';
  panel.dataset.riderThreshingEvent = 'true';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'rider-threshing-eyebrow';
  eyebrow.textContent = 'Progression event available';

  const title = document.createElement('h2');
  title.textContent = 'Threshing';

  const body = document.createElement('p');
  body.textContent = 'You have earned the right to enter the valley. Complete Threshing to record the dragon who chooses you.';

  const meta = document.createElement('small');
  meta.textContent = `${riderPoints(archive).toLocaleString()} Command points · Rider progression event`;

  const actions = document.createElement('div');
  actions.className = 'rider-threshing-actions';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Begin Threshing';

  const status = document.createElement('span');
  status.className = 'rider-threshing-status';

  button.addEventListener('click', () => void completeThreshing(status, button));
  actions.append(button, status);
  panel.append(eyebrow, title, body, meta, actions);

  host.prepend(panel);
  return panel;
}

let syncToken = 0;
async function syncEvent(): Promise<void> {
  const token = ++syncToken;
  const existing = document.querySelector<HTMLElement>('[data-rider-threshing-event]');
  const root = document.querySelector<HTMLElement>('.core-path-app');
  const dashboard = document.querySelector<HTMLElement>('.v2-view--dashboard');

  if (!root || !dashboard || root.dataset.universe !== 'empyrean' || root.dataset.path !== 'rider') {
    existing?.remove();
    return;
  }

  let archive = loadLocalArchive() as RiderArchive;
  try {
    const { user } = await getAuthSnapshot();
    if (user) archive = await loadCloudArchive(user) as RiderArchive;
  } catch {
    // Local archive remains the fallback if cloud state cannot be read.
  }

  if (token !== syncToken) return;

  if (!isEligible(archive)) {
    existing?.remove();
    return;
  }

  const current = document.querySelector<HTMLElement>('[data-rider-threshing-event]');
  if (!current && document.contains(dashboard)) buildEvent(dashboard, archive);
}

let frame = 0;
function scheduleSync(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    void syncEvent();
  });
}

function start(): void {
  scheduleSync();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-path', 'data-universe'] });
  window.addEventListener('storage', scheduleSync);
  window.addEventListener('focus', scheduleSync);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
