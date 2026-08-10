import { createCreatureAssignment, stableNumber, type CreatureAssignment } from './assignments';
import { loadCloudArchive, loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { PATHS } from './paths';
import { getAuthSnapshot } from './supabase';
import './rider-threshing-runtime.css';

type Archive = V2ArchiveState;
type NameResponseKind = 'correct' | 'wrong' | 'forgot';
type GryphonTemperament = 'wry' | 'steady' | 'bold' | 'watchful' | 'gentle' | 'proud';

const EVENT_NAME = 'The Harvest';
const UNLOCK_POINTS = PATHS.gryphon.thresholds[PATHS.gryphon.bondedRank ?? 1];
const RETRY_POINTS = 1000;

const TEMPERAMENTS: readonly GryphonTemperament[] = ['wry', 'steady', 'bold', 'watchful', 'gentle', 'proud'];

const NAME_REVEALS: Record<GryphonTemperament, string[]> = {
  wry: [
    'A dry amusement brushes across your thoughts. “You jumped without knowing whether I would catch you. I am {name}. Try to remember that part.”',
    'The voice in your mind is unmistakably entertained. “{name}. That is my name. You may stop looking so surprised now.”',
  ],
  steady: [
    'A calm presence settles into your mind. “My name is {name}. Breathe. I have you.”',
    'The bond feels solid and certain. “{name}. My name is {name}. You can unclench your hands now.”',
  ],
  bold: [
    'Triumph flashes through the bond. “{name}! Remember it. We are going to be very good at this.”',
    'The voice arrives bright with exhilaration. “My name is {name}. That was a proper jump.”',
  ],
  watchful: [
    'An alert, assessing presence touches your thoughts. “I am {name}. I was watching long before you jumped.”',
    'The gryphon’s voice is quiet and precise. “{name}. My name is {name}. I decided you were worth catching.”',
  ],
  gentle: [
    'Warm reassurance moves through the bond. “My name is {name}. You are safe. I caught you.”',
    'The voice in your mind is soft but certain. “{name}. That is my name. You did well.”',
  ],
  proud: [
    'A dignified presence fills your mind. “My name is {name}. See that you record it correctly.”',
    'The gryphon sounds deeply satisfied with its own decision. “{name}. You may tell the record keeper that I chose you.”',
  ],
};

const NAME_RESPONSES: Record<GryphonTemperament, Record<NameResponseKind, string[]>> = {
  wry: {
    correct: ['Correct. I was worried the wind had taken your memory with it.', 'There it is. I knew you had at least one useful thought left.', 'Yes, {name}. You may keep your dignity.'],
    wrong: ['That is not my name. I am {name}. An impressive start to our partnership.', 'No. {name}. Should I have caught your memory too?', 'Wrong. I am {name}. Try again before the record keeper starts enjoying this.'],
    forgot: ['You cannot remember? Wonderful. I am {name}. I will treasure this forever.', 'Already? My name is {name}. We have been bonded for minutes.', 'I caught you out of the sky and you lost my name on the way down. {name}.'],
  },
  steady: {
    correct: ['Yes. {name}. You remembered.', 'Correct. Good. One thing at a time.', 'That is right. {name}.'],
    wrong: ['Not quite. My name is {name}. Breathe and try again.', 'No. I am {name}. There is no need to panic about one mistake.', 'My name is {name}. You survived the jump. You can manage the correction.'],
    forgot: ['You cannot remember. That is all right. I am {name}. Now tell them.', 'My name is {name}. Breathe first, answer second.', '{name}. I have you. Try again.'],
  },
  bold: {
    correct: ['Yes! {name}. Say it like you mean it.', 'Correct. Excellent. Let them write it down.', 'That is my name. Good.'],
    wrong: ['No! I am {name}. We did not make that jump for you to invent a new name now.', 'Wrong name. {name}. Again, with confidence this time.', 'Absolutely not. {name}. Try again.'],
    forgot: ['You forgot? After that jump? I am {name}. Come on.', '{name}! My name is {name}. Keep up.', 'I am {name}. You remembered to jump off a cliff, surely you can remember that.'],
  },
  watchful: {
    correct: ['Correct. You were listening.', 'Yes. {name}. Good recall under pressure.', 'That is right. I noticed you remembered.'],
    wrong: ['Incorrect. I am {name}. Think back to the moment I caught you.', 'No. {name}. You heard me clearly the first time.', 'That is not my name. I am {name}. Try once more.'],
    forgot: ['You cannot remember. I am {name}. Focus on the bond and try again.', 'My name is {name}. I expected the fall to distract you, not erase everything.', '{name}. Hold onto that thought this time.'],
  },
  gentle: {
    correct: ['Yes. {name}. You got it.', 'That is right. Well done.', 'Correct. I knew you would remember.'],
    wrong: ['Not that one. I am {name}. Try again.', 'My name is {name}. It is all right. You can correct it.', 'No, but you are close to being less terrified. I am {name}.'],
    forgot: ['You cannot remember? I am {name}. No harm done.', 'My name is {name}. You had rather a lot happening when I told you.', '{name}. There. Now you can tell the record keeper.'],
  },
  proud: {
    correct: ['Correct. Naturally.', 'Yes. {name}. At least that was properly done.', 'That is my name. Record it well.'],
    wrong: ['That is emphatically not my name. I am {name}.', 'No. {name}. I did not choose you to be introduced incorrectly.', 'My name is {name}. Please do not make the record keeper write nonsense.'],
    forgot: ['You cannot remember my name? I am {name}. We will discuss standards later.', 'It is {name}. I expected better, but there is time.', '{name}. My name is {name}. Do try to retain it.'],
  },
};

function pointsFor(archive: Archive): number {
  return Number(archive.universes.empyrean.points ?? archive.profile.points) || 0;
}

function completed(archive: Archive): boolean {
  const eventRecorded = (archive.universes.empyrean.completedEvents || []).includes(EVENT_NAME);
  return eventRecorded && Boolean(existingGryphon(archive)?.name);
}

function existingGryphon(archive: Archive): CreatureAssignment | undefined {
  return archive.profile.identityAssignments?.gryphon?.gryphon;
}

function harvestFailureStories(archive: Archive) {
  return (archive.universes.empyrean.stories || []).filter((story) => String(story.title || '') === 'The Harvest: Uncaught');
}

function latestRetryBaseline(archive: Archive): number | undefined {
  const failures = harvestFailureStories(archive);
  const latest = failures[failures.length - 1];
  if (!latest) return undefined;
  const marker = (latest.answers || []).find((answer) => String(answer).startsWith('retry-baseline:'));
  if (!marker) return undefined;
  const value = Number(String(marker).slice('retry-baseline:'.length));
  return Number.isFinite(value) ? value : undefined;
}

function retryProgress(archive: Archive): number {
  const baseline = latestRetryBaseline(archive);
  if (baseline == null) return RETRY_POINTS;
  return Math.max(0, pointsFor(archive) - baseline);
}

function attemptNumber(archive: Archive): number {
  return harvestFailureStories(archive).length + 1;
}

function temperamentFor(archive: Archive, creature: CreatureAssignment): GryphonTemperament {
  return TEMPERAMENTS[stableNumber(`${archive.profile.identitySeed}:${creature.name}:gryphon-temperament`) % TEMPERAMENTS.length];
}

function chooseLine(pool: string[], seed: string, creature: CreatureAssignment): string {
  return pool[stableNumber(seed) % pool.length].replaceAll('{name}', creature.name);
}

function revealLine(archive: Archive, creature: CreatureAssignment): string {
  const temperament = temperamentFor(archive, creature);
  return chooseLine(NAME_REVEALS[temperament], `${archive.profile.identitySeed}:${creature.name}:harvest-reveal`, creature);
}

function responseLine(archive: Archive, creature: CreatureAssignment, kind: NameResponseKind): string {
  const temperament = temperamentFor(archive, creature);
  return chooseLine(NAME_RESPONSES[temperament][kind], `${archive.profile.identitySeed}:${creature.name}:harvest:${kind}`, creature);
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function makeGryphon(archive: Archive): CreatureAssignment {
  const existing = existingGryphon(archive);
  if (existing) return existing;
  const used = [archive.profile.identityAssignments?.rider?.dragon?.name].filter((name): name is string => Boolean(name));
  return createCreatureAssignment('gryphon', used, `${archive.profile.identitySeed}:gryphon:harvest`);
}

function successRoll(archive: Archive): boolean {
  const attempt = attemptNumber(archive);
  return stableNumber(`${archive.profile.identitySeed}:harvest-attempt:${attempt}`) % 2 === 0;
}

async function saveFailure(panel: HTMLElement, archive: Archive): Promise<void> {
  const baseline = pointsFor(archive);
  const at = new Date().toISOString();
  const story = {
    key: `gryphon-the-harvest-failed-${at}`,
    title: 'The Harvest: Uncaught',
    story: 'You stepped from the cliff and committed to the fall. No gryphon met you in time. You did not bond, and you remain a Flier Candidate. Earn 1,000 new Defiance before attempting the Harvest again.',
    completedAt: at,
    answers: ['harvest-failed', `retry-baseline:${baseline}`],
  };
  const next: Archive = {
    ...archive,
    universes: {
      ...archive.universes,
      empyrean: {
        ...archive.universes.empyrean,
        completedEvents: (archive.universes.empyrean.completedEvents || []).filter((event) => event !== EVENT_NAME),
        stories: [...(archive.universes.empyrean.stories || []), story],
      },
    },
    updatedAt: at,
  };
  saveLocalArchive(next);
  const { user } = await getAuthSnapshot();
  if (user) await saveCloudArchive(user, next);

  const result = document.createElement('div');
  result.className = 'rider-threshing-result is-fallen';
  result.innerHTML = '<strong>No gryphon catches you.</strong><p>You do not bond, but your points are untouched. You remain a Flier Candidate. Earn 1,000 new Defiance before the Harvest will open again.</p>';
  panel.replaceChildren(result);
  window.dispatchEvent(new StorageEvent('storage', { key: 'empyrean-v2-archive' }));
  window.setTimeout(() => window.location.reload(), 2800);
}

async function saveSuccess(panel: HTMLElement, archive: Archive, creature: CreatureAssignment, finalLine: string): Promise<void> {
  const at = new Date().toISOString();
  const temperament = temperamentFor(archive, creature);
  const story = {
    key: `gryphon-the-harvest-${at}`,
    title: `The Harvest: Bonded to ${creature.name}`,
    story: `You stepped from the cliff and ${creature.name}, a ${creature.color.toLocaleLowerCase()} gryphon, caught you. The bond formed in open air. After you returned and correctly recorded the name, ${creature.name} answered in your mind: “${finalLine}”`,
    completedAt: at,
    answers: ['harvest-success', `temperament:${temperament}`],
  };
  const completedEvents = [...new Set([...(archive.universes.empyrean.completedEvents || []), EVENT_NAME])];
  const next: Archive = {
    ...archive,
    profile: {
      ...archive.profile,
      identityAssignments: {
        ...archive.profile.identityAssignments,
        gryphon: { ...archive.profile.identityAssignments.gryphon, gryphon: creature },
      },
    },
    universes: {
      ...archive.universes,
      empyrean: {
        ...archive.universes.empyrean,
        completedEvents,
        stories: [...(archive.universes.empyrean.stories || []), story],
      },
    },
    updatedAt: at,
  };
  saveLocalArchive(next);
  const { user } = await getAuthSnapshot();
  if (user) await saveCloudArchive(user, next);

  const result = document.createElement('div');
  result.className = 'rider-threshing-result is-success';
  result.innerHTML = `<strong>The Harvest is complete.</strong><p>${creature.name} is recorded as your bonded gryphon. You have earned the rank of Flier Cadet.</p>`;
  panel.replaceChildren(result);
  window.dispatchEvent(new StorageEvent('storage', { key: 'empyrean-v2-archive' }));
  window.setTimeout(() => window.location.reload(), 2600);
}

function renderNameRecord(panel: HTMLElement, archive: Archive, creature: CreatureAssignment): void {
  panel.replaceChildren();
  const eyebrow = document.createElement('span');
  eyebrow.className = 'rider-threshing-eyebrow';
  eyebrow.textContent = 'The Harvest · Record the bond';
  const title = document.createElement('h2');
  title.textContent = 'The record keeper';
  const prompt = document.createElement('p');
  prompt.className = 'rider-threshing-prompt';
  prompt.textContent = 'Back on solid ground, the record keeper looks up. “Gryphon’s name?”';

  const form = document.createElement('form');
  form.className = 'rider-threshing-name-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'Type your gryphon’s name';
  input.setAttribute('aria-label', 'Gryphon name');
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Give the name';
  const forgot = document.createElement('button');
  forgot.type = 'button';
  forgot.className = 'is-secondary';
  forgot.textContent = 'I can’t remember';
  const response = document.createElement('div');
  response.className = 'rider-threshing-dragon-response';

  const showResponse = (kind: NameResponseKind): string => {
    const line = responseLine(archive, creature, kind);
    response.replaceChildren();
    const label = document.createElement('small');
    label.textContent = 'Your gryphon · in your mind';
    const text = document.createElement('p');
    text.textContent = `“${line}”`;
    response.append(label, text);
    return line;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    if (normalizeName(input.value) !== normalizeName(creature.name)) {
      showResponse('wrong');
      input.value = '';
      input.focus();
      return;
    }
    const line = showResponse('correct');
    input.disabled = true;
    submit.disabled = true;
    forgot.disabled = true;
    const finish = document.createElement('button');
    finish.type = 'button';
    finish.textContent = 'Record the bond';
    finish.addEventListener('click', () => void saveSuccess(panel, archive, creature, line));
    response.appendChild(finish);
  });

  forgot.addEventListener('click', () => {
    showResponse('forgot');
    input.value = creature.name;
    input.focus();
    input.select();
  });

  form.append(input, submit, forgot);
  panel.append(eyebrow, title, prompt, form, response);
  window.setTimeout(() => input.focus(), 0);
}

function renderCaught(panel: HTMLElement, archive: Archive, creature: CreatureAssignment): void {
  panel.replaceChildren();
  const eyebrow = document.createElement('span');
  eyebrow.className = 'rider-threshing-eyebrow';
  eyebrow.textContent = 'The Harvest · Caught';
  const title = document.createElement('h2');
  title.textContent = 'Something catches you';
  const copy = document.createElement('div');
  copy.className = 'rider-threshing-scene-result';
  const text = document.createElement('p');
  text.textContent = `Talons and wings turn your fall into flight. A ${creature.color.toLocaleLowerCase()} gryphon has you. The bond hits all at once. ${revealLine(archive, creature)}`;
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Return to be recorded';
  next.addEventListener('click', () => renderNameRecord(panel, archive, creature));
  copy.append(text, next);
  panel.append(eyebrow, title, copy);
}

function beginHarvest(panel: HTMLElement, archive: Archive): void {
  const creature = makeGryphon(archive);
  panel.replaceChildren();
  const eyebrow = document.createElement('span');
  eyebrow.className = 'rider-threshing-eyebrow';
  eyebrow.textContent = `The Harvest · Attempt ${attemptNumber(archive)}`;
  const title = document.createElement('h2');
  title.textContent = 'The cliff';
  const prompt = document.createElement('p');
  prompt.className = 'rider-threshing-prompt';
  prompt.textContent = 'You stand at the edge. Gryphons move through the air below, but none gives you a sign. There is no guarantee that one will catch you. The only way through the Harvest is to jump.';
  const actions = document.createElement('div');
  actions.className = 'rider-threshing-actions';
  const jump = document.createElement('button');
  jump.type = 'button';
  jump.textContent = 'Jump';
  jump.addEventListener('click', () => {
    jump.disabled = true;
    const result = successRoll(archive);
    window.setTimeout(() => {
      if (result) renderCaught(panel, archive, creature);
      else void saveFailure(panel, archive);
    }, 500);
  });
  actions.appendChild(jump);
  panel.append(eyebrow, title, prompt, actions);
}

function buildPanel(host: HTMLElement, archive: Archive): void {
  const panel = document.createElement('section');
  panel.className = 'rider-threshing-event';
  panel.dataset.empyreanBondingEvent = 'gryphon';
  panel.dataset.harvestRuntime = 'true';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'rider-threshing-eyebrow';
  const title = document.createElement('h2');
  title.textContent = EVENT_NAME;
  const body = document.createElement('p');
  const meta = document.createElement('small');
  const actions = document.createElement('div');
  actions.className = 'rider-threshing-actions';

  const progress = retryProgress(archive);
  const hasFailed = latestRetryBaseline(archive) != null;
  if (hasFailed && progress < RETRY_POINTS) {
    eyebrow.textContent = 'Harvest retry locked';
    body.textContent = 'Your last jump did not result in a bond. You remain a Flier Candidate until you successfully complete the Harvest.';
    meta.textContent = `${Math.min(progress, RETRY_POINTS).toLocaleString()} / ${RETRY_POINTS.toLocaleString()} new Defiance earned since your last attempt`;
    const locked = document.createElement('button');
    locked.type = 'button';
    locked.disabled = true;
    locked.textContent = `${(RETRY_POINTS - progress).toLocaleString()} more Defiance required`;
    actions.appendChild(locked);
  } else {
    eyebrow.textContent = hasFailed ? 'Harvest retry available' : 'Progression event available';
    body.textContent = 'You have reached the Harvest. Reaching 5,000 Defiance does not make you a Flier Cadet. Only a successful Harvest does.';
    meta.textContent = `${pointsFor(archive).toLocaleString()} Defiance points · 50/50 bond attempt${hasFailed ? ' · retry earned' : ''}`;
    const begin = document.createElement('button');
    begin.type = 'button';
    begin.textContent = hasFailed ? 'Attempt the Harvest again' : 'Begin the Harvest';
    begin.addEventListener('click', () => beginHarvest(panel, archive));
    actions.appendChild(begin);
  }

  panel.append(eyebrow, title, body, meta, actions);
  host.prepend(panel);
}

let token = 0;
async function sync(): Promise<void> {
  const currentToken = ++token;
  const root = document.querySelector<HTMLElement>('.core-path-app');
  const dashboard = document.querySelector<HTMLElement>('.v2-view--dashboard');
  const existing = document.querySelector<HTMLElement>('[data-empyrean-bonding-event="gryphon"]');

  if (!root || !dashboard || root.dataset.universe !== 'empyrean' || root.dataset.path !== 'gryphon') {
    document.querySelector<HTMLElement>('[data-harvest-runtime]')?.remove();
    return;
  }

  let archive = loadLocalArchive();
  try {
    const { user } = await getAuthSnapshot();
    if (user) archive = await loadCloudArchive(user);
  } catch {}
  if (currentToken !== token) return;

  if (completed(archive) || pointsFor(archive) < UNLOCK_POINTS) {
    existing?.remove();
    return;
  }

  if (existing && !existing.dataset.harvestRuntime) existing.remove();
  if (!document.querySelector('[data-harvest-runtime]') && document.contains(dashboard)) buildPanel(dashboard, archive);
}

let frame = 0;
function schedule(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => { frame = 0; void sync(); });
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
