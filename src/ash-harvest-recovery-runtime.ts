import { createCreatureAssignment, stableNumber, type CreatureAssignment } from './assignments';
import { loadCloudArchive, loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { getAuthSnapshot } from './supabase';

type Archive = V2ArchiveState;
type Temperament = 'wry' | 'steady' | 'bold' | 'watchful' | 'gentle' | 'proud';

const OWNER_EMAIL = 'ashley.jensen1222@gmail.com';
const EVENT_NAME = 'The Harvest';
const TEMPERAMENTS: readonly Temperament[] = ['wry', 'steady', 'bold', 'watchful', 'gentle', 'proud'];

const RECOVERY_LINES: Record<Temperament, string[]> = {
  wry: [
    'You really thought I was going to let you hit the ground? My name is {name}.',
    'Consider the first result a clerical error. I am {name}. Try to keep up.',
  ],
  steady: [
    'I have you. My name is {name}. Breathe.',
    'The fall ends here. I am {name}. You are safe.',
  ],
  bold: [
    'There you are! I am {name}. Now that is a proper Harvest.',
    'Caught you. My name is {name}. We are going to be excellent at this.',
  ],
  watchful: [
    'I was watching the whole time. I am {name}.',
    'I decided you were worth catching. My name is {name}.',
  ],
  gentle: [
    'You are safe. My name is {name}. I caught you.',
    'No more falling. I am {name}.',
  ],
  proud: [
    'My name is {name}. See that the record is corrected properly.',
    'You may inform the record keeper that {name} chose you.',
  ],
};

function failedHarvest(archive: Archive): boolean {
  return (archive.universes.empyrean.stories || []).some((story) => String(story.title || '') === 'The Harvest: Uncaught');
}

function completedHarvest(archive: Archive): boolean {
  return (archive.universes.empyrean.completedEvents || []).includes(EVENT_NAME)
    && Boolean(archive.profile.identityAssignments?.gryphon?.gryphon?.name);
}

function makeGryphon(archive: Archive): CreatureAssignment {
  const existing = archive.profile.identityAssignments?.gryphon?.gryphon;
  if (existing) return existing;
  const used = [archive.profile.identityAssignments?.rider?.dragon?.name].filter((name): name is string => Boolean(name));
  return createCreatureAssignment('gryphon', used, `${archive.profile.identitySeed}:gryphon:harvest`);
}

function temperamentFor(archive: Archive, creature: CreatureAssignment): Temperament {
  return TEMPERAMENTS[stableNumber(`${archive.profile.identitySeed}:${creature.name}:gryphon-temperament`) % TEMPERAMENTS.length];
}

function recoveryLine(archive: Archive, creature: CreatureAssignment): string {
  const temperament = temperamentFor(archive, creature);
  const pool = RECOVERY_LINES[temperament];
  return pool[stableNumber(`${archive.profile.identitySeed}:${creature.name}:ash-harvest-recovery`) % pool.length].replaceAll('{name}', creature.name);
}

async function applyRecovery(panel: HTMLElement, archive: Archive): Promise<void> {
  const button = panel.querySelector<HTMLButtonElement>('button');
  if (button) button.disabled = true;

  try {
    const { user } = await getAuthSnapshot();
    if (!user || user.email?.toLocaleLowerCase() !== OWNER_EMAIL) throw new Error('Not authorized');

    const latest = await loadCloudArchive(user);
    if (!failedHarvest(latest) || completedHarvest(latest)) throw new Error('Recovery no longer available');

    const creature = makeGryphon(latest);
    const line = recoveryLine(latest, creature);
    const at = new Date().toISOString();
    const completedEvents = [...new Set([...(latest.universes.empyrean.completedEvents || []), EVENT_NAME])];
    const correctionStory = {
      key: `gryphon-the-harvest-recovered-${at}`,
      title: `The Harvest: Bonded to ${creature.name}`,
      story: `Your Harvest record was corrected. ${creature.name}, a ${creature.color.toLocaleLowerCase()} gryphon, caught you and the bond formed in open air. In your mind, ${creature.name} said: “${line}”`,
      completedAt: at,
      answers: ['harvest-success', 'owner-recovery'],
    };

    const next: Archive = {
      ...latest,
      profile: {
        ...latest.profile,
        identityAssignments: {
          ...latest.profile.identityAssignments,
          gryphon: { ...latest.profile.identityAssignments.gryphon, gryphon: creature },
        },
      },
      universes: {
        ...latest.universes,
        empyrean: {
          ...latest.universes.empyrean,
          completedEvents,
          stories: [...(latest.universes.empyrean.stories || []), correctionStory],
        },
      },
      updatedAt: at,
    };

    saveLocalArchive(next);
    await saveCloudArchive(user, next);

    panel.className = 'rider-threshing-result is-success';
    panel.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = 'Harvest corrected.';
    const copy = document.createElement('p');
    copy.textContent = `${creature.name}, a ${creature.color.toLocaleLowerCase()} gryphon, caught you. “${line}” You are now a Flier Cadet.`;
    panel.append(strong, copy);
    window.dispatchEvent(new StorageEvent('storage', { key: 'empyrean-v2-archive' }));
    window.setTimeout(() => window.location.reload(), 3200);
  } catch {
    if (button) button.disabled = false;
  }
}

async function sync(): Promise<void> {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  const dashboard = document.querySelector<HTMLElement>('.v2-view--dashboard');
  const existing = document.querySelector<HTMLElement>('[data-ash-harvest-recovery]');

  if (!root || !dashboard || root.dataset.universe !== 'empyrean' || root.dataset.path !== 'gryphon') {
    existing?.remove();
    return;
  }

  try {
    const { user } = await getAuthSnapshot();
    if (!user || user.email?.toLocaleLowerCase() !== OWNER_EMAIL) {
      existing?.remove();
      return;
    }

    const archive = loadLocalArchive(user);
    if (!failedHarvest(archive) || completedHarvest(archive)) {
      existing?.remove();
      return;
    }

    if (existing) return;

    const panel = document.createElement('section');
    panel.className = 'rider-threshing-event';
    panel.dataset.ashHarvestRecovery = 'true';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'rider-threshing-eyebrow';
    eyebrow.textContent = 'Owner recovery';
    const title = document.createElement('h2');
    title.textContent = 'Correct Harvest result';
    const body = document.createElement('p');
    body.textContent = 'Your last Harvest test result can be corrected once. This does not change the Harvest rules for anyone else.';
    const actions = document.createElement('div');
    actions.className = 'rider-threshing-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Make my Harvest successful';
    button.addEventListener('click', () => void applyRecovery(panel, archive));
    actions.appendChild(button);
    panel.append(eyebrow, title, body, actions);
    dashboard.prepend(panel);
  } catch {
    existing?.remove();
  }
}

let frame = 0;
function schedule(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    void sync();
  });
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
