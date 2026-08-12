import { stableNumber } from './assignments';
import { loadLocalArchive, saveCloudArchive, saveLocalArchive, type V2ArchiveState } from './archive';
import { getAuthSnapshot } from './supabase';
import { PRYTHIAN_COURTS, PRYTHIAN_THRESHOLDS, RARE_PRYTHIAN_AFFINITIES } from './universes';

const COURT_POWER_THRESHOLD = PRYTHIAN_THRESHOLDS[1];
const RARE_AFFINITY_THRESHOLD = PRYTHIAN_THRESHOLDS[2];
const COURT_POWER_EVENT = 'Court Power Revealed';
const RARE_AFFINITY_EVENT = 'Rare Affinity Revealed';

function pointsFor(archive: V2ArchiveState): number {
  return Number(archive.universes?.prythian?.points ?? archive.profile.points) || 0;
}

function chooseCourtPower(archive: V2ArchiveState) {
  const courtId = archive.universes.prythian.court;
  if (!courtId) return undefined;
  const court = PRYTHIAN_COURTS[courtId];
  if (!court?.powers.length) return undefined;
  return court.powers[stableNumber(`${archive.profile.identitySeed}:prythian:${courtId}:court-power`) % court.powers.length];
}

function currentPowerMatchesCourt(archive: V2ArchiveState): boolean {
  const courtId = archive.universes.prythian.court;
  const powerId = archive.universes.prythian.primaryPowerId;
  if (!courtId || !powerId) return false;
  return PRYTHIAN_COURTS[courtId].powers.some((power) => power.id === powerId);
}

function chooseRareAffinity(archive: V2ArchiveState) {
  const roll = stableNumber(`${archive.profile.identitySeed}:prythian:rare-affinity-roll`) % 8;
  if (roll !== 0) return { id: 'none', name: 'N/A', description: 'No rare affinity manifested.' };
  return RARE_PRYTHIAN_AFFINITIES[
    stableNumber(`${archive.profile.identitySeed}:prythian:rare-affinity`) % RARE_PRYTHIAN_AFFINITIES.length
  ];
}

let syncing = false;
async function syncUnlocks(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const archive = loadLocalArchive();
    if (!archive.universes?.prythian?.onboarded || !archive.universes.prythian.court) return;

    const points = pointsFor(archive);
    let next = archive;
    let changed = false;

    if (points >= COURT_POWER_THRESHOLD && !currentPowerMatchesCourt(archive)) {
      const power = chooseCourtPower(archive);
      if (power) {
        next = {
          ...next,
          profile: {
            ...next.profile,
            primaryPowerId: power.id,
            primaryPowerName: power.name,
            primaryPowerDescription: power.description,
          },
          universes: {
            ...next.universes,
            prythian: {
              ...next.universes.prythian,
              primaryPowerId: power.id,
              primaryPowerName: power.name,
              primaryPowerDescription: power.description,
              completedEvents: [...new Set([...(next.universes.prythian.completedEvents || []), COURT_POWER_EVENT])],
            },
          },
          updatedAt: new Date().toISOString(),
        };
        changed = true;
      }
    }

    if (points >= RARE_AFFINITY_THRESHOLD && !next.universes.prythian.rareAffinityId) {
      const affinity = chooseRareAffinity(next);
      next = {
        ...next,
        profile: {
          ...next.profile,
          rareAffinityId: affinity.id,
          rareAffinityName: affinity.name,
        },
        universes: {
          ...next.universes,
          prythian: {
            ...next.universes.prythian,
            rareAffinityId: affinity.id,
            rareAffinityName: affinity.name,
            completedEvents: [...new Set([...(next.universes.prythian.completedEvents || []), RARE_AFFINITY_EVENT])],
          },
        },
        updatedAt: new Date().toISOString(),
      };
      changed = true;
    }

    if (!changed) return;
    saveLocalArchive(next);
    const { user } = await getAuthSnapshot();
    if (user) await saveCloudArchive(user, next);
    window.dispatchEvent(new StorageEvent('storage', { key: 'empyrean-v2-archive' }));
  } catch {
    // Unlocks retry when local archive state changes or the window regains focus.
  } finally {
    syncing = false;
  }
}

let timer = 0;
function scheduleSync(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncUnlocks(), 120);
}

function start(): void {
  scheduleSync();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-universe', 'data-court', 'class'] });
  window.addEventListener('storage', scheduleSync);
  window.addEventListener('focus', scheduleSync);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
