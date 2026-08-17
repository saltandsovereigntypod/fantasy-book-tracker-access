import { applyPersistedTheme, writePersistedTheme, type PersistedTheme } from './bootstrap-universe';

function mountedTheme(): PersistedTheme | undefined {
  const root = document.querySelector<HTMLElement>('.core-path-app');
  if (!root) return undefined;
  if (root.dataset.universe === 'prythian') {
    return { universe: 'prythian', court: root.dataset.court || 'night' };
  }
  if (root.dataset.universe === 'empyrean') {
    return { universe: 'empyrean', path: root.dataset.path || 'rider' };
  }
  return undefined;
}

let frame = 0;
function syncMountedTheme(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const theme = mountedTheme();
    if (!theme) return;
    writePersistedTheme(theme);
    applyPersistedTheme(theme);
  });
}

function start(): void {
  syncMountedTheme();
  const observer = new MutationObserver(syncMountedTheme);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-universe', 'data-path', 'data-court'],
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
