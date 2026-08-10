function isFlierDashboard(): boolean {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  return Boolean(
    root
    && root.dataset.universe === 'empyrean'
    && root.dataset.path === 'gryphon'
    && document.querySelector('.v2-view--dashboard'),
  );
}

function removeLegacyHarvestPanels(): void {
  if (!isFlierDashboard()) return;

  document.querySelectorAll<HTMLElement>('.rider-threshing-event').forEach((panel) => {
    const text = panel.textContent || '';
    const isLegacyHarvest = text.includes('Three-part story event')
      || text.includes('Your choices through the bonding field and first flight determine whether you return as a bonded flier.');

    if (isLegacyHarvest) panel.remove();
  });
}

let frame = 0;
function schedule(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    removeLegacyHarvestPanels();
  });
}

function start(): void {
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-path', 'data-universe'],
  });
  window.addEventListener('storage', schedule);
  window.addEventListener('focus', schedule);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
