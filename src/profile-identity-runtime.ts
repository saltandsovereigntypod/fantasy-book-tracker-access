import { loadLocalArchive, saveCloudArchive, saveLocalArchive } from './archive';
import { PATHS } from './paths';
import { getAuthSnapshot } from './supabase';
import { PRYTHIAN_THRESHOLDS, RARE_PRYTHIAN_AFFINITIES } from './universes';

function faeRoleName(role: 'high-fae' | 'lesser-fae' | 'illyrian' | undefined): string {
  if (role === 'illyrian') return 'Illyrian';
  if (role === 'lesser-fae') return 'Lesser Fae';
  return 'High Fae';
}

function ordinal(value: number): string {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  const remainder10 = value % 10;
  if (remainder10 === 1) return `${value}st`;
  if (remainder10 === 2) return `${value}nd`;
  if (remainder10 === 3) return `${value}rd`;
  return `${value}th`;
}

function makeCard(label: string, title: string, detail?: string, description?: string): HTMLElement {
  const article = document.createElement('article');
  article.className = 'core-identity-reveal-card';
  const labelNode = document.createElement('span');
  labelNode.textContent = label;
  const titleNode = document.createElement('strong');
  titleNode.textContent = title;
  article.append(labelNode, titleNode);
  if (detail) {
    const small = document.createElement('small');
    small.textContent = detail;
    article.appendChild(small);
  }
  if (description) {
    const paragraph = document.createElement('p');
    paragraph.textContent = description;
    article.appendChild(paragraph);
  }
  return article;
}

async function saveRiderAssignment(section: HTMLElement, wing: number, riderSection: 'Flame' | 'Claw' | 'Tail', squad: 1 | 2 | 3): Promise<void> {
  const archive = loadLocalArchive();
  const next = {
    ...archive,
    profile: {
      ...archive.profile,
      identityAssignments: {
        ...archive.profile.identityAssignments,
        rider: {
          ...archive.profile.identityAssignments.rider,
          wing,
          section: riderSection,
          squad,
        },
      },
    },
    updatedAt: new Date().toISOString(),
  };

  saveLocalArchive(next);
  section.dataset.signature = '';
  renderIdentity();

  const status = section.querySelector<HTMLElement>('[data-rider-assignment-status]');
  if (status) status.textContent = 'Saving…';
  try {
    const { user } = await getAuthSnapshot();
    if (!user) throw new Error('No signed-in user');
    await saveCloudArchive(user, next);
    if (status) status.textContent = 'Saved to your account';
  } catch {
    if (status) status.textContent = 'Saved locally. Cloud save failed.';
  }
}

function makeRiderEditor(section: HTMLElement, wing: number, riderSection: 'Flame' | 'Claw' | 'Tail', squad: 1 | 2 | 3): HTMLElement {
  const details = document.createElement('details');
  details.className = 'core-rider-assignment-editor';
  const summary = document.createElement('summary');
  summary.textContent = 'Edit Rider assignment';
  details.appendChild(summary);

  const form = document.createElement('div');
  form.className = 'core-rider-assignment-controls';

  const wingSelect = document.createElement('select');
  wingSelect.setAttribute('aria-label', 'Wing');
  [1, 2, 3, 4].forEach((value) => {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = `${ordinal(value)} Wing`;
    option.selected = value === wing;
    wingSelect.appendChild(option);
  });

  const sectionSelect = document.createElement('select');
  sectionSelect.setAttribute('aria-label', 'Section');
  (['Flame', 'Claw', 'Tail'] as const).forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `${value} Section`;
    option.selected = value === riderSection;
    sectionSelect.appendChild(option);
  });

  const squadSelect = document.createElement('select');
  squadSelect.setAttribute('aria-label', 'Squad');
  [1, 2, 3].forEach((value) => {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = `${ordinal(value)} Squad`;
    option.selected = value === squad;
    squadSelect.appendChild(option);
  });

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Save assignment';
  saveButton.addEventListener('click', () => {
    void saveRiderAssignment(
      section,
      Number(wingSelect.value),
      sectionSelect.value as 'Flame' | 'Claw' | 'Tail',
      Number(squadSelect.value) as 1 | 2 | 3,
    );
  });

  const status = document.createElement('small');
  status.dataset.riderAssignmentStatus = 'true';

  form.append(wingSelect, sectionSelect, squadSelect, saveButton);
  details.append(form, status);
  return details;
}

function renderIdentity(): void {
  const profile = document.querySelector<HTMLElement>('.v2-profile.core-profile');
  if (!profile) return;
  const assignment = profile.querySelector<HTMLElement>('.core-profile-assignment');
  if (!assignment) return;

  const archive = loadLocalArchive();
  const identity = archive.profile.identityAssignments;
  if (!identity) return;

  let section = assignment.querySelector<HTMLElement>('[data-core-identity-reveals]');
  if (!section) {
    section = document.createElement('section');
    section.dataset.coreIdentityReveals = 'true';
    section.className = 'core-identity-reveals';
    const heading = document.createElement('header');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = 'Known from the beginning';
    const title = document.createElement('h3');
    title.textContent = 'Your identity';
    heading.append(eyebrow, title);
    section.appendChild(heading);
    const selectors = assignment.querySelector('.prythian-core-selectors');
    if (selectors?.nextSibling) assignment.insertBefore(section, selectors.nextSibling);
    else assignment.prepend(section);
  }

  const root = document.querySelector<HTMLElement>('.core-path-app');
  const universe = root?.dataset.universe || archive.universes.activeUniverse;
  const path = root?.dataset.path || archive.universes.empyrean.path || archive.profile.path;
  const court = root?.dataset.court || archive.universes.prythian.court || 'night';
  const prythianRole = archive.universes.prythian.role;
  const empyreanPoints = Number(archive.universes.empyrean.points ?? archive.profile.points) || 0;
  const prythianPoints = Number(archive.universes.prythian.points ?? archive.profile.points) || 0;
  const prythian = archive.universes.prythian;
  const signature = JSON.stringify({ universe, path, court, identity, prythianRole, empyreanPoints, prythianPoints, primaryPowerId: prythian.primaryPowerId, rareAffinityId: prythian.rareAffinityId });
  if (section.dataset.signature === signature) return;
  section.dataset.signature = signature;

  section.querySelectorAll('.core-identity-reveal-grid, .core-rider-assignment-editor').forEach((node) => node.remove());
  const grid = document.createElement('div');
  grid.className = 'core-identity-reveal-grid';

  if (universe === 'prythian') {
    grid.appendChild(makeCard('Fae lineage', faeRoleName(prythianRole), `${court.charAt(0).toUpperCase()}${court.slice(1)} Court`));
    if (prythianPoints >= PRYTHIAN_THRESHOLDS[1] && prythian.primaryPowerName) {
      grid.appendChild(makeCard('Court power', prythian.primaryPowerName, 'Unlocked as Sworn Courtier', prythian.primaryPowerDescription));
    }
    if (prythianPoints >= PRYTHIAN_THRESHOLDS[2] && prythian.rareAffinityName) {
      const definition = RARE_PRYTHIAN_AFFINITIES.find((affinity) => affinity.id === prythian.rareAffinityId);
      const description = prythian.rareAffinityId === 'none' ? 'No rare affinity manifested.' : definition?.description;
      grid.appendChild(makeCard('Rare affinity', prythian.rareAffinityName, 'Unlocked as Court Emissary', description));
    }
  } else if (path === 'rider') {
    grid.appendChild(makeCard('Rider assignment', `${ordinal(identity.rider.squad)} Squad`, `${identity.rider.section} Section, ${ordinal(identity.rider.wing)} Wing`));
    if (identity.rider.dragon) {
      const dragon = identity.rider.dragon;
      grid.appendChild(makeCard('Bonded dragon', dragon.name, `${dragon.color}${dragon.tail ? ` · ${dragon.tail}` : ''}`));
    }
    if (empyreanPoints >= PATHS.rider.thresholds[2] && identity.rider.signet) {
      grid.appendChild(makeCard('Signet', identity.rider.signet.name, identity.rider.signet.category, identity.rider.signet.description));
    }
  } else if (path === 'gryphon') {
    grid.appendChild(makeCard('Drift assignment', identity.gryphon.drift));
    if (identity.gryphon.gryphon) {
      grid.appendChild(makeCard('Bonded gryphon', identity.gryphon.gryphon.name, identity.gryphon.gryphon.color));
    }
    if (empyreanPoints >= PATHS.gryphon.thresholds[2] && identity.gryphon.gift) {
      grid.appendChild(makeCard('Mindwork gift', identity.gryphon.gift.name, identity.gryphon.gift.category, identity.gryphon.gift.description));
    }
  } else if (path === 'dark') {
    const wyvern = identity.dark.wyvern;
    grid.appendChild(makeCard('Bound wyvern', wyvern.name, `${wyvern.color}${wyvern.flameColor ? ` · ${wyvern.flameColor} flame` : ''}`));
    grid.appendChild(makeCard('Dark Wielder signet', identity.dark.signet.name, identity.dark.signet.category, identity.dark.signet.description));
  } else {
    grid.appendChild(makeCard('Assignment', archive.profile.path === path ? 'Recorded' : path));
  }

  section.appendChild(grid);
  if (universe !== 'prythian' && path === 'rider') {
    section.appendChild(makeRiderEditor(section, identity.rider.wing, identity.rider.section, identity.rider.squad));
  }
}

let queued = false;
function scheduleRender(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    renderIdentity();
  });
}

function start(): void {
  scheduleRender();
  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-path', 'data-universe', 'data-court'] });
  window.addEventListener('storage', scheduleRender);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
