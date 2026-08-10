import { createCreatureAssignment, stableNumber, type CreatureAssignment } from './assignments';
import { loadCloudArchive, loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { PATHS } from './paths';
import { getAuthSnapshot } from './supabase';
import './rider-threshing-runtime.css';

type BondingPath = 'rider' | 'gryphon';
type BondingArchive = V2ArchiveState;
type DragonColor = 'Black' | 'Blue' | 'Brown' | 'Green' | 'Orange' | 'Red';
type NameResponseKind = 'correct' | 'wrong' | 'forgot';

type StoryAnswer = {
  id: string;
  text: string;
  result: string;
  lethal?: boolean;
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
};

const DRAGON_COLORS: DragonColor[] = ['Black', 'Blue', 'Brown', 'Green', 'Orange', 'Red'];

const CONFIGS: Record<BondingPath, EventConfig> = {
  rider: {
    path: 'rider', eventName: 'Threshing', progressName: 'Command', creatureKind: 'dragon', creatureLabel: 'dragon',
    unlockThreshold: PATHS.rider.thresholds[PATHS.rider.bondedRank ?? 1],
  },
  gryphon: {
    path: 'gryphon', eventName: 'The Harvest', progressName: 'Defiance', creatureKind: 'gryphon', creatureLabel: 'gryphon',
    unlockThreshold: PATHS.gryphon.thresholds[PATHS.gryphon.bondedRank ?? 1],
  },
};

const NAME_RESPONSES: Record<DragonColor, Record<NameResponseKind, string[]>> = {
  Blue: {
    correct: [
      'Good. At least terror has not damaged your memory.',
      'Correct. I was beginning to wonder whether choosing you was premature.',
      'You remembered. Sensible. I dislike repeating myself.',
      'Good. Keep proving that I did not choose carelessly.',
    ],
    wrong: [
      'That is not my name. You survived my flight only to embarrass yourself on the ground? My name is {name}.',
      'Wrong. Impressively wrong. My name is {name}. Try not to make me say it a third time.',
      'No. {name}. You would think surviving the sky would sharpen your attention.',
      'I am {name}. Remember it before I decide the maneuvers were too gentle.',
    ],
    forgot: [
      'Remarkable. You remembered how not to die and misplaced my name. It is {name}.',
      'You cannot remember? I am {name}. Do try to keep up.',
      'My name is {name}. I refuse to believe the flight shook every useful thought from your skull.',
      '{name}. That is my name. We will work on your memory after we work on your seat.',
    ],
  },
  Red: {
    correct: [
      'Yes. {name}. Do not make me ask twice.',
      'Correct. Finally, something today has not irritated me.',
      'Good. You listened.',
      'Right. {name}. Keep that answer ready next time.',
    ],
    wrong: [
      'Wrong. My name is {name}. Say another name at me and see how patient I am.',
      'Absolutely not. {name}. Did the wind knock the sense out of you?',
      'My name is {name}. I told you once. I am already annoyed that there must be a twice.',
      'No. {name}. Focus before I lose what remains of my temper.',
    ],
    forgot: [
      'You cannot remember? {name}. My name is {name}. Burn it into your memory.',
      'Unbelievable. {name}. Do not make forgetting me a habit.',
      'It is {name}. You survived the flight. Surely you can survive remembering one name.',
      '{name}. There. Now answer the roll keeper before I become offended.',
    ],
  },
  Orange: {
    correct: [
      'Oh, you remembered. How disappointingly competent.',
      'Correct. I had a whole speech prepared if you got it wrong.',
      'Yes, {name}. You may be entertaining after all.',
      'Right! I was curious whether the dive had rattled it loose.',
    ],
    wrong: [
      'That is definitely not my name. Tempting to let you keep saying it, though. I am {name}.',
      'Wrong! Spectacularly. My name is {name}. Want to try that again with dignity?',
      'No, but I almost want to answer to it just to confuse you. {name}. My name is {name}.',
      'Not even close enough for mercy. I am {name}. Try again.',
    ],
    forgot: [
      'You forgot? That is hilarious. I am {name}. I am never letting you forget that you forgot.',
      'I could tell you a fake name and watch this become very interesting. Fine. {name}.',
      'Already? We have been bonded for minutes. My name is {name}, forgetful one.',
      'You cannot remember. Incredible. {name}. I expect compensation in the form of better stories later.',
    ],
  },
  Black: {
    correct: [
      'Correct. Memory under pressure is useful. Keep yours.',
      'Yes. {name}. I wondered whether you would recognize the obvious test.',
      'Good. Observation may yet be one of your strengths.',
      'Correct. I appreciate evidence that my judgment was not entirely sentimental.',
    ],
    wrong: [
      'Interesting. Confident, specific, and entirely incorrect. My name is {name}.',
      'No. I am {name}. Consider this your first lesson in checking your assumptions.',
      'That answer tells me several things about you. None are flattering. My name is {name}.',
      'Incorrect. {name}. I suggest remembering the dragon who now has access to your thoughts.',
    ],
    forgot: [
      'You cannot remember. Fascinating. My name is {name}. We should investigate the limits of your attention later.',
      'A predictable failure of working memory under stress. I am {name}.',
      'You forgot the only name I gave you. I am {name}. Fortunately, one of us is attentive.',
      '{name}. My name is {name}. I had hoped not to begin our bond with remedial exercises.',
    ],
  },
  Brown: {
    correct: [
      'That is right. {name}. I knew you were paying attention.',
      'Correct. Good. We will manage each other just fine.',
      'Yes. {name}. Stand tall when you say it.',
      'Right. You held your nerve in the clearing and kept your head in the sky.',
    ],
    wrong: [
      'No. My name is {name}. Do not lose your confidence now; simply get it right.',
      'Wrong name. I am {name}. You survived harder things five minutes ago. Try again.',
      'Not quite. {name}. Look at the roll keeper and say it like you mean it.',
      'I am {name}. No fear, no flinching, and no surrendering to embarrassment. Again.',
    ],
    forgot: [
      'You cannot remember? Fine. I am {name}. Now straighten your shoulders and tell them.',
      'It is {name}. I have you. Breathe, remember, and answer.',
      '{name}. My name is {name}. Forgetting once is survivable. Looking frightened about it is unnecessary.',
      'You are exhausted, not incapable. I am {name}. Now give the roll keeper my name.',
    ],
  },
  Green: {
    correct: [
      'Correct. {name}. Efficient. I approve.',
      'Yes. Your memory appears functional despite the flight.',
      'Correct. One relevant fact retained under significant stress.',
      'Right. {name}. We may proceed.',
    ],
    wrong: [
      'Incorrect. My name is {name}. Reassess the information you were given and try again.',
      'No. {name}. The data was explicit; your recall was not.',
      'That is not my name. I am {name}. Fortunately, this error is correctable.',
      'Incorrect response. My name is {name}. Please improve the next attempt.',
    ],
    forgot: [
      'You cannot remember. Understandable after acute stress, but inconvenient. My name is {name}.',
      'Memory failure noted. I am {name}. Repeat it before answering.',
      'The relevant information is {name}. Retain it this time.',
      'My name is {name}. Your survival instincts are currently stronger than your short-term memory.',
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

function normalizeDragonColor(value: string): DragonColor {
  return DRAGON_COLORS.includes(value as DragonColor) ? value as DragonColor : 'Green';
}

function wrongDragonColor(creature: CreatureAssignment, seed: string): DragonColor {
  const actual = normalizeDragonColor(creature.color);
  const others = DRAGON_COLORS.filter((color) => color !== actual);
  return others[stableNumber(`${seed}:threshing:wrong-dragon`) % others.length];
}

function dragonNameLine(color: DragonColor, name: string): string {
  const lines: Record<DragonColor, string[]> = {
    Blue: [`The voice that fills your mind is cold, vast, and utterly certain. “My name is ${name}. Get on.”`, `A ruthless presence settles behind your thoughts. “${name}. That is my name. Get on.”`],
    Red: [`Heat rolls across the bond with the words. “My name is ${name}. Get on. Now.”`, `The voice cracks through your mind like flame. “${name}. My name is ${name}. Stop staring and get on.”`],
    Orange: [`Amusement flickers through the bond. “My name is ${name}. Get on. This should be interesting.”`, `The voice arrives with a spark of wicked delight. “${name}. Remember it if you can. Now get on.”`],
    Black: [`The voice slips into your mind as though it has been waiting there for you. “My name is ${name}. I assume you understand what comes next. Get on.”`, `A sharp, assessing intelligence brushes yours. “${name}. My name is ${name}. Get on, and try to keep up.”`],
    Brown: [`Steady certainty settles through the bond. “My name is ${name}. You held your ground. Now get on.”`, `The voice is firm and unwavering. “${name}. My name is ${name}. No hesitation now. Get on.”`],
    Green: [`The voice is calm and precise inside your mind. “My name is ${name}. The next logical step is for you to get on.”`, `A composed presence joins your thoughts. “${name}. My name is ${name}. We should proceed. Get on.”`],
  };
  return lines[color][stableNumber(`${name}:${color}:name-reveal`) % lines[color].length];
}

function riderQuestionOne(creature: CreatureAssignment, seed: string): StoryQuestion {
  const color = wrongDragonColor(creature, seed);
  return {
    title: 'Not yours',
    prompt: `A ${color.toLocaleLowerCase()} dragon appears in the distance. You know with absolute certainty that this is not your dragon. What do you do?`,
    answers: [
      { id: 'rider-q1-hide', text: 'Avert your eyes, lower your profile, and make yourself as hidden and unnoticeable as possible while giving it room to pass.', result: 'You make yourself small without looking panicked. The dragon passes without deciding you are worth its attention.' },
      { id: 'rider-q1-watch', text: 'Keep it in sight so you can react quickly if it comes toward you.', result: 'You track the dragon carefully. Its head turns toward you once, and your pulse spikes, but it eventually continues on.' },
      { id: 'rider-q1-stand', text: 'Stand tall and show it you are not afraid.', result: 'The dragon notices you immediately. A low warning growl shakes the ground before it loses interest and moves on.' },
    ],
  };
}

function riderQuestionTwo(creature: CreatureAssignment): StoryQuestion {
  const color = normalizeDragonColor(creature.color);
  const reveal = dragonNameLine(color, creature.name);
  const commonPrompt = `You feel pulled toward a clearing and find a ${color.toLocaleLowerCase()} dragon waiting there. The bond settles into place before either of you moves. You know this is your dragon. What do you do?`;
  const questions: Record<DragonColor, StoryQuestion> = {
    Blue: {
      title: 'The one who chose you', prompt: commonPrompt,
      answers: [
        { id: 'blue-correct', text: 'Stop at the edge of the clearing, stay composed, and wait for the massive, ruthless dragon to decide how close you are allowed to come.', result: `You do not mistake the bond for permission. The blue dragon closes the distance itself and sweeps you sharply aside when another dragon cuts too near; a scale ridge opens a long scar across your shoulder. ${reveal}` },
        { id: 'blue-touch', text: 'Walk straight up and place a hand on its muzzle. The bond means it will not hurt you.', lethal: true, result: 'You mistake being chosen for being safe. The blue dragon reacts with ruthless finality. You do not leave the clearing.' },
        { id: 'blue-command', text: 'Square your shoulders and order it to lower itself so you can mount.', lethal: true, result: 'The enormous blue dragon does not tolerate your presumption. One violent strike ends Threshing for you.' },
      ],
    },
    Red: {
      title: 'The one who chose you', prompt: commonPrompt,
      answers: [
        { id: 'red-correct', text: 'Immediately avert your eyes, keep your movements controlled, and wait without challenging its temper.', result: `You remember the warning about red dragons and refuse the challenge of direct eye contact. The dragon moves close enough that heat blisters a branching scar along your forearm before the bond settles fully. ${reveal}` },
        { id: 'red-eyes', text: 'Meet its eyes directly so it knows you are strong enough to be its rider.', lethal: true, result: 'The red dragon takes direct eye contact exactly as the warning said it might. Flame is the last thing you see.' },
        { id: 'red-rush', text: 'Move quickly toward it before its temper has time to change.', lethal: true, result: 'Quick movement meets a quicker temper. The red dragon torches the space where you stood.' },
      ],
    },
    Orange: {
      title: 'The one who chose you', prompt: commonPrompt,
      answers: [
        { id: 'orange-correct', text: 'Stay loose, alert, and ready to adapt. Do not assume the dragon will behave the way any other color would.', result: `You give the orange dragon room to be unpredictable instead of trying to predict it. It abruptly darts forward, hooks you out of the way of a snapping tail, and leaves a curved talon scar across your upper arm. ${reveal}` },
        { id: 'orange-pattern', text: 'Use the standard approach you were taught and commit to it without changing course.', lethal: true, result: 'The orange dragon changes the rules halfway through your approach. You fail to change with them.' },
        { id: 'orange-freeze', text: 'Do absolutely nothing until you can work out what it is going to do next.', lethal: true, result: 'You wait for predictability from the least predictable dragons alive. The answer comes too quickly for you to survive it.' },
      ],
    },
    Black: {
      title: 'The one who chose you', prompt: commonPrompt,
      answers: [
        { id: 'black-correct', text: 'Stay quiet and observant. Treat the dragon like the cunning intelligence it is and let it assess you before you make a move.', result: `You do not insult a black dragon by treating it like an animal to be managed. It circles once, then deliberately draws one claw across your forearm, leaving a narrow scar like a signature. ${reveal}` },
        { id: 'black-trick', text: 'Try to outsmart it by approaching indirectly while pretending not to be interested.', lethal: true, result: 'Trying to deceive one of the rarest and most cunning dragons alive lasts only seconds. The dragon saw the plan before you finished forming it.' },
        { id: 'black-simple', text: 'Use a firm command voice. Intelligence still needs clear authority.', lethal: true, result: 'The black dragon understands your words, your intention, and the insult behind both. It ends the conversation permanently.' },
      ],
    },
    Brown: {
      title: 'The one who chose you', prompt: commonPrompt,
      answers: [
        { id: 'brown-correct', text: 'Step forward with steady confidence. Do not show trepidation, even when it lowers its head toward you.', result: `You refuse to let fear turn into hesitation. The brown dragon accepts the confidence, then catches your jacket with a talon and pulls you safely past a sudden collision, leaving a hooked scar along your collarbone. ${reveal}` },
        { id: 'brown-back', text: 'Back away slowly. Loyalty should mean it will understand that you are nervous.', lethal: true, result: 'The brown dragon sees the trepidation you were warned not to show. The bond does not make the mistake survivable.' },
        { id: 'brown-cower', text: 'Lower yourself completely and wait until it proves you are safe.', lethal: true, result: 'You answer a test of nerve with visible fear. The brown dragon rejects the display with lethal force.' },
      ],
    },
    Green: {
      title: 'The one who chose you', prompt: commonPrompt,
      answers: [
        { id: 'green-correct', text: 'Approach calmly and deliberately, then stop at a respectful distance and let the rational dragon choose the next step.', result: `You meet intelligence with composure instead of drama. The green dragon studies you, then moves with precise purpose; one controlled talon catches your palm and leaves a clean scar before withdrawing. ${reveal}` },
        { id: 'green-rush', text: 'Rush forward enthusiastically. A rational dragon will understand that you mean no harm.', lethal: true, result: 'Rational does not mean tolerant of reckless behavior. Your uncontrolled approach becomes your last mistake.' },
        { id: 'green-submit', text: 'Drop to your knees and make an elaborate show of submission.', lethal: true, result: 'The green dragon reads the performance for exactly what it is: unnecessary, irrational, and dangerous. You do not get another attempt.' },
      ],
    },
  };
  return questions[color];
}

function riderQuestionThree(creature: CreatureAssignment): StoryQuestion {
  return {
    title: 'First flight',
    prompt: `${creature.name} launches. The ground disappears, then the dragon banks hard, drops fast enough to lift you from its back, rolls, and drives into a near-vertical climb. What do you do?`,
    answers: [
      { id: 'rider-flight-correct', text: 'Anchor with your legs, keep your center low, and move with the dragon through every bank instead of fighting the motion.', result: `You stop trying to overpower ${creature.name}'s movement and begin moving with it. The next roll is brutal, but you stay seated. You make it back to the flight field alive.` },
      { id: 'rider-flight-cling', text: 'Flatten yourself against the dragon and lock every muscle while gripping as hard as you can.', lethal: true, result: `You make it through the first bank on strength alone. Then ${creature.name} rolls again. Your rigid body moves the wrong way, your leg tears free, and you fall.` },
      { id: 'rider-flight-counter', text: 'Counter every turn by throwing your weight in the opposite direction so you stay upright.', lethal: true, result: `You fight ${creature.name}'s movement instead of following it. On the next dive your balance goes the wrong direction, your seat vanishes, and the sky takes you.` },
    ],
  };
}

function gryphonQuestions(): StoryQuestion[] {
  return [
    {
      title: 'Not yours', prompt: 'A gryphon lands directly in your path. The absence of a bond makes it unmistakable that this is not yours. What do you do?',
      answers: [
        { id: 'gryphon-disengage', text: 'Step sideways, lower your posture, and leave it a clear route back to the sky.', result: 'You make space instead of demanding attention. The gryphon launches past with a blast of wind and grit.' },
        { id: 'gryphon-hold', text: 'Stay where you are and wait for it to decide whether you are a threat.', result: 'A hooked beak snaps once in warning before the gryphon turns away.' },
        { id: 'gryphon-reach', text: 'Move closer and try to touch its beak.', result: 'One slash of a talon sends you stumbling backward before the warning becomes fatal.' },
      ],
    },
    {
      title: 'The one who chooses you', prompt: 'Your gryphon finds you on the far side of the field. The bond hits like a second heartbeat. What do you do?',
      answers: [
        { id: 'gryphon-bond-correct', text: 'Stay composed, give it room, and let the bond guide the approach.', result: 'The gryphon accepts you and a talon catches your upper arm during the chaos, leaving a pale hooked scar.' },
        { id: 'gryphon-bond-rush', text: 'Rush forward and grab for the saddle immediately.', lethal: true, result: 'You move before the gryphon accepts the approach. The Harvest ends here.' },
        { id: 'gryphon-bond-freeze', text: 'Freeze and refuse to move even when it calls you forward.', lethal: true, result: 'Hesitation at the wrong moment becomes fatal.' },
      ],
    },
    {
      title: 'First flight', prompt: 'You launch together. Your gryphon climbs sharply, snaps into a side roll, then dives through a crosswind. What do you do?',
      answers: [
        { id: 'gryphon-flight-correct', text: 'Stay loose through the hips, anchor your legs, and follow the gryphon through every correction.', result: 'The motion stops feeling like an attack and starts feeling like a language. You stay seated.' },
        { id: 'gryphon-flight-cling', text: 'Drop low and lock your body rigid against its back.', lethal: true, result: 'Your rigidity works against the next turn. Your seat disappears beneath you.' },
        { id: 'gryphon-flight-counter', text: 'Counter every movement so your body stays perfectly upright.', lethal: true, result: 'The crosswind and your resistance combine at exactly the wrong moment. You fall.' },
      ],
    },
  ];
}

function personalityLine(creature: CreatureAssignment, kind: NameResponseKind, seed: string): string {
  const color = normalizeDragonColor(creature.color);
  const pool = NAME_RESPONSES[color][kind];
  const line = pool[stableNumber(`${seed}:${creature.name}:${color}:${kind}`) % pool.length];
  return line.replaceAll('{name}', creature.name);
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function createStoryRecord(config: EventConfig, creature: CreatureAssignment, answers: StoryAnswer[], survived: boolean, nameMoment?: string) {
  const completedAt = new Date().toISOString();
  const ending = survived
    ? `You returned to the flight field bonded to ${creature.name}, a ${creature.color.toLocaleLowerCase()} ${config.creatureLabel}.`
    : 'You died during the bonding event. Your archive remains intact, but the point events earned before this attempt no longer count.';
  return {
    key: `${config.path}-${config.eventName.toLocaleLowerCase().replaceAll(' ', '-')}-${completedAt}`,
    title: survived ? `${config.eventName}: Bonded to ${creature.name}` : `${config.eventName}: Fallen`,
    story: answers.map((answer) => answer.result).concat(nameMoment ? [nameMoment] : []).concat(ending).join(' '),
    completedAt,
    answers: answers.map((answer) => answer.id),
  };
}

async function persistOutcome(config: EventConfig, answers: StoryAnswer[], survived: boolean, panel: HTMLElement, creatureOverride?: CreatureAssignment, nameMoment?: string): Promise<void> {
  const status = panel.querySelector<HTMLElement>('.rider-threshing-status');
  if (status) status.textContent = survived ? 'Recording the bond…' : 'Recording the fall…';

  try {
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('No signed-in user');
    const latest = await loadCloudArchive(user) as BondingArchive;
    const existingCreature = creatureOverride || currentCreature(latest, config.path);
    const usedNames = [latest.profile.identityAssignments?.rider?.dragon?.name, latest.profile.identityAssignments?.gryphon?.gryphon?.name]
      .filter((name): name is string => Boolean(name));
    const creature = existingCreature || createCreatureAssignment(config.creatureKind, usedNames, `${latest.profile.identitySeed}:${config.path}:${config.eventName}`);
    const story = createStoryRecord(config, creature, answers, survived, nameMoment);

    let next: BondingArchive;
    if (survived) {
      const completedEvents = [...new Set([...(latest.universes.empyrean.completedEvents || []), config.eventName])];
      const identityAssignments = config.path === 'rider'
        ? { ...latest.profile.identityAssignments, rider: { ...latest.profile.identityAssignments.rider, dragon: creature } }
        : { ...latest.profile.identityAssignments, gryphon: { ...latest.profile.identityAssignments.gryphon, gryphon: creature } };
      next = {
        ...latest,
        profile: { ...latest.profile, creature, identityAssignments },
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
      const suppressedPointEventIds = [...new Set([...(latest.suppressedPointEventIds || []), ...(latest.pointLog || []).map((event) => event.id)])];
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
      ? `<strong>${config.eventName} complete.</strong><p>${creature.name}, a ${creature.color.toLocaleLowerCase()} ${config.creatureLabel}, is now publicly recorded as your bond.</p>`
      : '<strong>You died.</strong><p>Your books, notes, theories, sessions, and every other archive record are untouched. The point events those records had already earned are nullified, so progression begins again from zero. New activity earns points normally.</p>';
    panel.replaceChildren(result);
    window.dispatchEvent(new StorageEvent('storage', { key: 'empyrean-v2-archive' }));
    window.setTimeout(() => window.location.reload(), survived ? 2400 : 3400);
  } catch {
    if (status) status.textContent = 'The event could not be saved. Your archive has not been changed.';
    panel.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = false; });
  }
}

function renderNameCheck(panel: HTMLElement, config: EventConfig, creature: CreatureAssignment, answers: StoryAnswer[], seed: string): void {
  panel.replaceChildren();
  const eyebrow = document.createElement('span');
  eyebrow.className = 'rider-threshing-eyebrow';
  eyebrow.textContent = `${config.eventName} · 4 of 4`;
  const title = document.createElement('h2');
  title.textContent = 'The roll keeper';
  const prompt = document.createElement('p');
  prompt.className = 'rider-threshing-prompt';
  prompt.textContent = 'You make it back to the flight field alive. The roll keeper looks up from the ledger. “Dragon’s name?”';

  const form = document.createElement('form');
  form.className = 'rider-threshing-name-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'Type your dragon’s name';
  input.setAttribute('aria-label', 'Dragon name');
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Give the name';
  const forgot = document.createElement('button');
  forgot.type = 'button';
  forgot.className = 'is-secondary';
  forgot.textContent = 'I can’t remember';
  const response = document.createElement('div');
  response.className = 'rider-threshing-dragon-response';

  const showResponse = (kind: NameResponseKind) => {
    const line = personalityLine(creature, kind, seed);
    response.replaceChildren();
    const label = document.createElement('small');
    label.textContent = `${creature.color} dragon · in your mind`;
    const text = document.createElement('p');
    text.textContent = `“${line}”`;
    response.append(label, text);
    return line;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    if (normalizedName(input.value) === normalizedName(creature.name)) {
      const line = showResponse('correct');
      input.disabled = true;
      submit.disabled = true;
      forgot.disabled = true;
      const finish = document.createElement('button');
      finish.type = 'button';
      finish.textContent = 'Report the bond';
      finish.addEventListener('click', () => void persistOutcome(config, answers, true, panel, creature, `When you gave the roll keeper the correct name, ${creature.name} answered in your mind: “${line}”`));
      response.appendChild(finish);
      return;
    }
    showResponse('wrong');
    input.value = '';
    input.focus();
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

function buildRiderStory(panel: HTMLElement, config: EventConfig, archive: BondingArchive): void {
  const seed = archive.profile.identitySeed;
  const creature = currentCreature(archive, 'rider') || createCreatureAssignment('dragon', [], `${seed}:rider:threshing`);
  const questions = [riderQuestionOne(creature, seed), riderQuestionTwo(creature), riderQuestionThree(creature)];
  const chosen: StoryAnswer[] = [];
  let step = 0;

  const renderQuestion = () => {
    const question = questions[step];
    panel.replaceChildren();
    const eyebrow = document.createElement('span');
    eyebrow.className = 'rider-threshing-eyebrow';
    eyebrow.textContent = `${config.eventName} · ${step + 1} of 4`;
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
        const next = document.createElement('button');
        next.type = 'button';

        if (answer.lethal && step > 0) {
          next.textContent = 'Continue';
          next.addEventListener('click', () => void persistOutcome(config, chosen, false, panel, creature));
        } else if (step === 2) {
          next.textContent = 'Return to the flight field';
          next.addEventListener('click', () => renderNameCheck(panel, config, creature, chosen, seed));
        } else {
          next.textContent = 'Continue';
          next.addEventListener('click', () => { step += 1; renderQuestion(); });
        }
        result.appendChild(next);
        panel.replaceChildren(eyebrow, title, result);
      });
      choices.appendChild(button);
    });
    panel.append(eyebrow, title, prompt, choices);
  };

  renderQuestion();
}

function buildGryphonStory(panel: HTMLElement, config: EventConfig, archive: BondingArchive): void {
  const creature = currentCreature(archive, 'gryphon') || createCreatureAssignment('gryphon', [], `${archive.profile.identitySeed}:gryphon:harvest`);
  const questions = gryphonQuestions();
  const chosen: StoryAnswer[] = [];
  let step = 0;
  const render = () => {
    const question = questions[step];
    panel.replaceChildren();
    const eyebrow = document.createElement('span'); eyebrow.className = 'rider-threshing-eyebrow'; eyebrow.textContent = `${config.eventName} · ${step + 1} of ${questions.length}`;
    const title = document.createElement('h2'); title.textContent = question.title;
    const prompt = document.createElement('p'); prompt.className = 'rider-threshing-prompt'; prompt.textContent = question.prompt;
    const choices = document.createElement('div'); choices.className = 'rider-threshing-choices';
    question.answers.forEach((answer) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = answer.text;
      button.addEventListener('click', () => {
        chosen.push(answer);
        const result = document.createElement('div'); result.className = 'rider-threshing-scene-result';
        const p = document.createElement('p'); p.textContent = answer.result; result.appendChild(p);
        const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Continue';
        next.addEventListener('click', () => {
          if (answer.lethal && step > 0) { void persistOutcome(config, chosen, false, panel, creature); return; }
          if (step === questions.length - 1) { void persistOutcome(config, chosen, true, panel, creature); return; }
          step += 1; render();
        });
        result.appendChild(next); panel.replaceChildren(eyebrow, title, result);
      });
      choices.appendChild(button);
    });
    panel.append(eyebrow, title, prompt, choices);
  };
  render();
}

function buildEvent(host: HTMLElement, archive: BondingArchive, config: EventConfig): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'rider-threshing-event';
  panel.dataset.empyreanBondingEvent = config.path;
  const eyebrow = document.createElement('span'); eyebrow.className = 'rider-threshing-eyebrow'; eyebrow.textContent = 'Progression event available';
  const title = document.createElement('h2'); title.textContent = config.eventName;
  const body = document.createElement('p');
  body.textContent = config.path === 'rider'
    ? 'You have earned the right to enter the valley. The dragons are ruthless, and surviving Threshing requires more than reaching a point threshold.'
    : 'You have reached the Harvest. Your choices through the bonding field and first flight determine whether you return as a bonded flier.';
  const meta = document.createElement('small');
  meta.textContent = `${pointsFor(archive).toLocaleString()} ${config.progressName} points · ${config.path === 'rider' ? 'Four-part' : 'Three-part'} story event`;
  const actions = document.createElement('div'); actions.className = 'rider-threshing-actions';
  const button = document.createElement('button'); button.type = 'button'; button.textContent = `Begin ${config.eventName}`;
  button.addEventListener('click', () => config.path === 'rider' ? buildRiderStory(panel, config, archive) : buildGryphonStory(panel, config, archive));
  const status = document.createElement('span'); status.className = 'rider-threshing-status';
  actions.append(button, status); panel.append(eyebrow, title, body, meta, actions); host.prepend(panel); return panel;
}

let syncToken = 0;
async function syncEvent(): Promise<void> {
  const token = ++syncToken;
  const existing = document.querySelector<HTMLElement>('[data-empyrean-bonding-event]');
  const root = document.querySelector<HTMLElement>('.core-path-app');
  const dashboard = document.querySelector<HTMLElement>('.v2-view--dashboard');
  const path = root?.dataset.path as BondingPath | undefined;
  const config = path === 'rider' || path === 'gryphon' ? CONFIGS[path] : undefined;
  if (!root || !dashboard || root.dataset.universe !== 'empyrean' || !config) { existing?.remove(); return; }

  let archive = loadLocalArchive() as BondingArchive;
  try { const { user } = await getAuthSnapshot(); if (user) archive = await loadCloudArchive(user) as BondingArchive; } catch {}
  if (token !== syncToken) return;
  if (!isEligible(archive, config)) { existing?.remove(); return; }
  const current = document.querySelector<HTMLElement>('[data-empyrean-bonding-event]');
  if (!current && document.contains(dashboard)) buildEvent(dashboard, archive, config);
}

let frame = 0;
function scheduleSync(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => { frame = 0; void syncEvent(); });
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
