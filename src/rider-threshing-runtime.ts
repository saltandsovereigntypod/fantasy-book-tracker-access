import { createCreatureAssignment, type CreatureAssignment } from './assignments';
import { loadCloudArchive, loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { PATHS } from './paths';
import { getAuthSnapshot } from './supabase';
import './rider-threshing-runtime.css';

type BondingPath = 'rider' | 'gryphon';
type BondingArchive = V2ArchiveState;

type StoryAnswer = {
  id: string;
  text: string;
  score: number;
  result: string;
};

type StoryQuestion = {
  title: string;
  prompt: string;
  answers: StoryAnswer[];
};

type EventConfig = {
  path: BondingPath;
  eventName: 'Threshing' | 'The Harvest';
  progressName: string;
  creatureKind: 'dragon' | 'gryphon';
  creatureLabel: string;
  unlockThreshold: number;
  questions: StoryQuestion[];
};

const CONFIGS: Record<BondingPath, EventConfig> = {
  rider: {
    path: 'rider',
    eventName: 'Threshing',
    progressName: 'Command',
    creatureKind: 'dragon',
    creatureLabel: 'dragon',
    unlockThreshold: PATHS.rider.thresholds[PATHS.rider.bondedRank ?? 1],
    questions: [
      {
        title: 'Not yours',
        prompt: 'A massive dragon blocks your path and lowers its head toward you. The instant its eyes meet yours, you know with absolute certainty that this dragon did not choose you. What do you do?',
        answers: [
          { id: 'rider-disengage', text: 'Lower your gaze, angle your body away, and give the dragon a clear path to leave.', score: 2, result: 'You refuse to turn the encounter into a challenge. The dragon watches you for one long moment, then moves past without striking.' },
          { id: 'rider-hold', text: 'Hold your ground without reaching for it and wait for the dragon to make the next move.', score: 1, result: 'You stay still enough to avoid provoking it. A warning rumble shakes your ribs before the dragon finally turns away.' },
          { id: 'rider-reach', text: 'Reach toward it anyway. Maybe the bond simply has not settled yet.', score: 0, result: 'Teeth flash inches from your hand. You throw yourself backward and finally understand the message: wanting a dragon does not make it yours.' },
        ],
      },
      {
        title: 'The one who chooses you',
        prompt: 'Deeper in the valley, another dragon finds you. The bond snaps into place with enough force to steal your breath. Before you can recover, the dragon marks the moment in a way you will carry forever. How does it happen?',
        answers: [
          { id: 'rider-scar-claw', text: 'You stay still as one talon catches your shoulder while the dragon pulls you out of another dragon’s path.', score: 2, result: 'The talon tears through cloth and skin. The wound will heal, but the long scar across your shoulder will always mark the moment your dragon chose to keep you alive.' },
          { id: 'rider-scar-heat', text: 'You put your palm to its scales too quickly and the heat burns a permanent pattern into your hand.', score: 2, result: 'Heat bites deep into your palm before the dragon cools its scales. The scar settles into a branching pattern that looks almost like a tiny bolt of lightning.' },
          { id: 'rider-scar-fall', text: 'The dragon shoves you aside with its snout, sending you into sharp rock as another dragon charges past.', score: 1, result: 'Stone splits the skin along your brow. Blood runs into one eye, but when you look up, your dragon is still there, waiting for you to understand that the shove saved your life.' },
        ],
      },
      {
        title: 'First flight',
        prompt: 'You mount and launch. Your dragon immediately rolls into a brutal bank, drops hard enough to lift you from the saddle, then climbs almost vertically. How do you stay seated?',
        answers: [
          { id: 'rider-flight-move', text: 'Anchor with your knees, keep your center low, and move with the dragon instead of fighting every turn.', score: 3, result: 'You stop trying to overpower the flight and start moving with it. The next roll is still vicious, but this time you are ready.' },
          { id: 'rider-flight-cling', text: 'Flatten yourself against the saddle and hold on with everything you have.', score: 1, result: 'You survive the first bank by raw stubbornness, but every correction comes a half-second late. Your grip starts to fail as the dragon dives again.' },
          { id: 'rider-flight-rigid', text: 'Lock your body rigid and pull against every bank so the dragon cannot throw you off balance.', score: 0, result: 'The next roll turns your own stiffness against you. Your weight shifts the wrong direction, your leg slips free, and suddenly there is nothing beneath you.' },
        ],
      },
    ],
  },
  gryphon: {
    path: 'gryphon',
    eventName: 'The Harvest',
    progressName: 'Defiance',
    creatureKind: 'gryphon',
    creatureLabel: 'gryphon',
    unlockThreshold: PATHS.gryphon.thresholds[PATHS.gryphon.bondedRank ?? 1],
    questions: [
      {
        title: 'Not yours',
        prompt: 'A gryphon lands directly in your path, feathers lifted and talons digging into the earth. For one breath you hope it is yours. Then the absence of a bond makes the truth unmistakable. What do you do?',
        answers: [
          { id: 'gryphon-disengage', text: 'Step sideways, lower your posture, and leave the gryphon a clear route back to the sky.', score: 2, result: 'You make space instead of demanding attention. The gryphon studies you, then launches past with a blast of wind and grit.' },
          { id: 'gryphon-hold', text: 'Stay where you are, hands visible, and wait for it to decide whether you are a threat.', score: 1, result: 'A hooked beak snaps once in warning. You do not move, and eventually the gryphon turns away.' },
          { id: 'gryphon-reach', text: 'Move closer and try to touch its beak. You came here to be chosen.', score: 0, result: 'One slash of a talon stops you cold. You stumble back before the warning becomes fatal and finally let the wrong gryphon go.' },
        ],
      },
      {
        title: 'The one who chooses you',
        prompt: 'Your gryphon finds you on the far side of the field. The bond hits like a second heartbeat. In the chaos that follows, the gryphon leaves you with a scar you will carry for the rest of your life. How?',
        answers: [
          { id: 'gryphon-scar-talon', text: 'A talon catches your upper arm while your gryphon yanks you clear of a collision.', score: 2, result: 'The cut is deep and clean. It will become a pale hooked scar across your upper arm, a permanent reminder of the instant your gryphon protected you.' },
          { id: 'gryphon-scar-beak', text: 'Its beak clips your cheek while it forces you down beneath another gryphon’s wings.', score: 2, result: 'Pain flashes across your cheek. The narrow scar will remain, but so will the memory of feathers passing where your head had been a second earlier.' },
          { id: 'gryphon-scar-rock', text: 'A wing knocks you into the rocky ground as your gryphon shields you from another pair.', score: 1, result: 'Rock opens a line across your collarbone. When you look up, your gryphon is standing over you with its wings spread.' },
        ],
      },
      {
        title: 'First flight',
        prompt: 'You launch together. Your gryphon climbs sharply, snaps into a side roll, then dives through a crosswind that jerks you half out of position. What do you do?',
        answers: [
          { id: 'gryphon-flight-move', text: 'Stay loose through the hips, anchor your legs, and follow the gryphon’s center through every correction.', score: 3, result: 'The motion stops feeling like an attack and starts feeling like a language. You catch the next bank before it can throw you.' },
          { id: 'gryphon-flight-cling', text: 'Drop low over the gryphon’s back and cling through the turbulence until the air steadies.', score: 1, result: 'You hold through the first dive, but your balance never quite catches up. The next turn tears one leg loose.' },
          { id: 'gryphon-flight-rigid', text: 'Brace hard and counter every movement so you can keep yourself perfectly upright.', score: 0, result: 'The crosswind and your own resistance combine at exactly the wrong moment. Your seat disappears beneath you.' },
        ],
      },
    ],
  },
};

function currentCreature(archive: BondingArchive, path: BondingPath): CreatureAssignment | undefined {
  return path === 'rider'
    ? archive.profile.identityAssignments?.rider?.dragon
    : archive.profile.identityAssignments?.gryphon?.gryphon;
}

function pointsFor(archive: BondingArchive): number {
  return Number(archive.universes?.empyrean?.points ?? archive.profile.points) || 0;
}

function isEligible(archive: BondingArchive, config: EventConfig): boolean {
  const path = archive.universes?.empyrean?.path || archive.profile.path;
  const completed = archive.universes?.empyrean?.completedEvents || [];
  const eventRecorded = completed.includes(config.eventName);
  const hasCreature = Boolean(currentCreature(archive, config.path)?.name);
  return path === config.path && pointsFor(archive) >= config.unlockThreshold && (!eventRecorded || !hasCreature);
}

function createStoryRecord(config: EventConfig, creature: CreatureAssignment, answers: StoryAnswer[], survived: boolean) {
  const completedAt = new Date().toISOString();
  const scar = answers[1]?.result || '';
  const ending = survived
    ? `You stayed seated through the final maneuver and returned to the flight field bonded to ${creature.name}, a ${creature.color.toLocaleLowerCase()} ${config.creatureLabel}. ${scar}`
    : `You lost your seat during the final maneuvers and fell before returning to the flight field. Your archive remains intact, but the progression earned before this attempt no longer counts.`;
  return {
    key: `${config.path}-${config.eventName.toLocaleLowerCase().replaceAll(' ', '-')}-${completedAt}`,
    title: survived ? `${config.eventName}: Bonded to ${creature.name}` : `${config.eventName}: Fallen`,
    story: answers.map((answer) => answer.result).concat(ending).join(' '),
    completedAt,
    answers: answers.map((answer) => answer.id),
  };
}

async function persistOutcome(config: EventConfig, answers: StoryAnswer[], survived: boolean, panel: HTMLElement): Promise<void> {
  const status = panel.querySelector<HTMLElement>('.rider-threshing-status');
  if (status) status.textContent = survived ? 'Recording the bond…' : 'Recording the fall…';

  try {
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('No signed-in user');
    const latest = await loadCloudArchive(user) as BondingArchive;
    const existingCreature = currentCreature(latest, config.path);
    const usedNames = [
      latest.profile.identityAssignments?.rider?.dragon?.name,
      latest.profile.identityAssignments?.gryphon?.gryphon?.name,
    ].filter((name): name is string => Boolean(name));
    const creature = existingCreature || createCreatureAssignment(config.creatureKind, usedNames, `${latest.profile.identitySeed}:${config.path}:${config.eventName}`);
    const story = createStoryRecord(config, creature, answers, survived);

    let next: BondingArchive;
    if (survived) {
      const completedEvents = [...new Set([...(latest.universes.empyrean.completedEvents || []), config.eventName])];
      const identityAssignments = config.path === 'rider'
        ? {
            ...latest.profile.identityAssignments,
            rider: { ...latest.profile.identityAssignments.rider, dragon: creature },
          }
        : {
            ...latest.profile.identityAssignments,
            gryphon: { ...latest.profile.identityAssignments.gryphon, gryphon: creature },
          };
      next = {
        ...latest,
        profile: {
          ...latest.profile,
          creature,
          identityAssignments,
        },
        universes: {
          ...latest.universes,
          empyrean: {
            ...latest.universes.empyrean,
            completedEvents,
            stories: [...(latest.universes.empyrean.stories || []), story],
          },
        },
        updatedAt: new Date().toISOString(),
      };
    } else {
      const resetAt = new Date().toISOString();
      const suppressedPointEventIds = [...new Set([
        ...(latest.suppressedPointEventIds || []),
        ...(latest.pointLog || []).map((event) => event.id),
      ])];
      next = {
        ...latest,
        pointResetAt: resetAt,
        suppressedPointEventIds,
        universes: {
          ...latest.universes,
          empyrean: {
            ...latest.universes.empyrean,
            completedEvents: (latest.universes.empyrean.completedEvents || []).filter((event) => event !== config.eventName),
            stories: [...(latest.universes.empyrean.stories || []), story],
          },
        },
        updatedAt: resetAt,
      };
    }

    saveLocalArchive(next);
    await saveCloudArchive(user, next);

    const result = document.createElement('div');
    result.className = survived ? 'rider-threshing-result is-success' : 'rider-threshing-result is-fallen';
    result.innerHTML = survived
      ? `<strong>You made it back.</strong><p>${creature.name}, a ${creature.color.toLocaleLowerCase()} ${config.creatureLabel}, chose you. You are bonded.</p>`
      : '<strong>You fell.</strong><p>Your books, notes, theories, sessions, and every other archive record are untouched. The point events those records had already earned are now nullified, so your progression begins again from zero. New activity can earn points normally.</p>';
    panel.replaceChildren(result);
    window.dispatchEvent(new StorageEvent('storage', { key: 'empyrean-v2-archive' }));
    window.setTimeout(() => window.location.reload(), survived ? 2200 : 3200);
  } catch {
    if (status) status.textContent = 'The event could not be saved. Your archive has not been changed.';
    panel.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = false; });
  }
}

function buildStory(panel: HTMLElement, config: EventConfig): void {
  let step = 0;
  const chosen: StoryAnswer[] = [];

  const renderQuestion = () => {
    const question = config.questions[step];
    panel.replaceChildren();

    const eyebrow = document.createElement('span');
    eyebrow.className = 'rider-threshing-eyebrow';
    eyebrow.textContent = `${config.eventName} · ${step + 1} of ${config.questions.length}`;

    const title = document.createElement('h2');
    title.textContent = question.title;

    const prompt = document.createElement('p');
    prompt.className = 'rider-threshing-prompt';
    prompt.textContent = question.prompt;

    const choices = document.createElement('div');
    choices.className = 'rider-threshing-choices';

    question.answers.forEach((answer) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = answer.text;
      button.addEventListener('click', () => {
        chosen.push(answer);
        const result = document.createElement('div');
        result.className = 'rider-threshing-scene-result';
        const resultText = document.createElement('p');
        resultText.textContent = answer.result;
        result.appendChild(resultText);

        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.textContent = step === config.questions.length - 1 ? 'See what happens' : 'Continue';
        nextButton.addEventListener('click', () => {
          if (step < config.questions.length - 1) {
            step += 1;
            renderQuestion();
            return;
          }
          const score = chosen.reduce((sum, selection) => sum + selection.score, 0);
          const survived = score >= 5;
          void persistOutcome(config, chosen, survived, panel);
        });
        result.appendChild(nextButton);
        panel.replaceChildren(eyebrow, title, result);
      });
      choices.appendChild(button);
    });

    const status = document.createElement('span');
    status.className = 'rider-threshing-status';
    panel.append(eyebrow, title, prompt, choices, status);
  };

  renderQuestion();
}

function buildEvent(host: HTMLElement, archive: BondingArchive, config: EventConfig): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'rider-threshing-event';
  panel.dataset.empyreanBondingEvent = config.path;

  const eyebrow = document.createElement('span');
  eyebrow.className = 'rider-threshing-eyebrow';
  eyebrow.textContent = 'Progression event available';

  const title = document.createElement('h2');
  title.textContent = config.eventName;

  const body = document.createElement('p');
  body.textContent = config.path === 'rider'
    ? 'You have earned the right to enter the valley. Threshing is not a button press: your choices determine whether you return bonded or whether your progression ends here.'
    : 'You have reached the Harvest. Your choices through the bonding field and first flight determine whether you return as a bonded flier.';

  const meta = document.createElement('small');
  meta.textContent = `${pointsFor(archive).toLocaleString()} ${config.progressName} points · Three-part story event`;

  const actions = document.createElement('div');
  actions.className = 'rider-threshing-actions';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `Begin ${config.eventName}`;
  button.addEventListener('click', () => buildStory(panel, config));
  const status = document.createElement('span');
  status.className = 'rider-threshing-status';
  actions.append(button, status);
  panel.append(eyebrow, title, body, meta, actions);
  host.prepend(panel);
  return panel;
}

let syncToken = 0;
async function syncEvent(): Promise<void> {
  const token = ++syncToken;
  const existing = document.querySelector<HTMLElement>('[data-empyrean-bonding-event]');
  const root = document.querySelector<HTMLElement>('.core-path-app');
  const dashboard = document.querySelector<HTMLElement>('.v2-view--dashboard');
  const path = root?.dataset.path as BondingPath | undefined;
  const config = path === 'rider' || path === 'gryphon' ? CONFIGS[path] : undefined;

  if (!root || !dashboard || root.dataset.universe !== 'empyrean' || !config) {
    existing?.remove();
    return;
  }

  let archive = loadLocalArchive() as BondingArchive;
  try {
    const { user } = await getAuthSnapshot();
    if (user) archive = await loadCloudArchive(user) as BondingArchive;
  } catch {
    // Local archive remains the fallback if cloud state cannot be read.
  }

  if (token !== syncToken) return;
  if (!isEligible(archive, config)) {
    existing?.remove();
    return;
  }

  const current = document.querySelector<HTMLElement>('[data-empyrean-bonding-event]');
  if (!current && document.contains(dashboard)) buildEvent(dashboard, archive, config);
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
