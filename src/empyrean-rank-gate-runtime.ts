import { loadLocalArchive } from './archive';
import { PATHS, rankIndexForPoints } from './paths';

type BondingPath = 'rider' | 'gryphon';

const EVENT_FOR_PATH: Record<BondingPath, string> = {
  rider: 'Threshing',
  gryphon: 'The Harvest',
};

function hasBondedCreature(path: BondingPath): boolean {
  const archive = loadLocalArchive();
  return path === 'rider'
    ? Boolean(archive.profile.identityAssignments?.rider?.dragon?.name)
    : Boolean(archive.profile.identityAssignments?.gryphon?.gryphon?.name);
}

function isBondingComplete(path: BondingPath): boolean {
  const archive = loadLocalArchive();
  const completed = archive.universes?.empyrean?.completedEvents || [];
  return completed.includes(EVENT_FOR_PATH[path]) && hasBondedCreature(path);
}

function effectiveRankIndex(path: BondingPath): number {
  const archive = loadLocalArchive();
  const points = Number(archive.universes?.empyrean?.points ?? archive.profile.points) || 0;
  const raw = rankIndexForPoints(path, points);
  if (raw >= 1 && !isBondingComplete(path)) return 0;
  return raw;
}

function applyRankGate(): void {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  if (!root || root.dataset.universe !== 'empyrean') return;
  const path = root.dataset.path as BondingPath | undefined;
  if (path !== 'rider' && path !== 'gryphon') return;

  const index = effectiveRankIndex(path);
  const label = PATHS[path].ranks[index];

  const sidebarRank = root.querySelector<HTMLElement>('.v2-sidebar-footer > small');
  if (sidebarRank) sidebarRank.textContent = label;

  const dashboardRank = root.querySelector<HTMLElement>('.v2-view--dashboard .core-assignment-compact > div:last-child strong');
  if (dashboardRank) dashboardRank.textContent = label;

  const profileRank = root.querySelector<HTMLElement>('.v2-view--profile .core-profile-assignment > header > div:last-child strong');
  if (profileRank) profileRank.textContent = label;

  const ladder = root.querySelector<HTMLOListElement>('.v2-view--profile .core-rank-ladder ol');
  if (ladder) {
    [...ladder.children].forEach((node, itemIndex) => {
      if (!(node instanceof HTMLElement)) return;
      node.classList.toggle('is-unlocked', itemIndex < index);
      node.classList.toggle('is-current', itemIndex === index);
      node.classList.toggle('is-locked', itemIndex > index);
      const state = node.querySelector<HTMLElement>('em');
      if (state) state.textContent = itemIndex < index ? 'Unlocked' : itemIndex === index ? 'Current' : 'Locked';
    });
  }
}

let frame = 0;
function schedule(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    applyRankGate();
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
