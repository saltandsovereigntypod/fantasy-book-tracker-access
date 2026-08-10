import './ash-harvest-recovery-runtime';

const STYLE_ID = 'harvest-ui-authority-style';

function installStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .core-path-app[data-universe="empyrean"][data-path="gryphon"]
      .rider-threshing-event[data-empyrean-bonding-event="gryphon-legacy"] {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function relabelLegacyHarvest(): void {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  if (!root || root.dataset.universe !== 'empyrean' || root.dataset.path !== 'gryphon') return;

  document.querySelectorAll<HTMLElement>('.rider-threshing-event[data-empyrean-bonding-event="gryphon"]').forEach((panel) => {
    if (panel.dataset.harvestRuntime === 'true') return;
    panel.dataset.empyreanBondingEvent = 'gryphon-legacy';
  });
}

let frame = 0;
function schedule(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    installStyle();
    relabelLegacyHarvest();
  });
}

function start(): void {
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-empyrean-bonding-event', 'data-path', 'data-universe'],
  });
  window.addEventListener('storage', schedule);
  window.addEventListener('focus', schedule);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
