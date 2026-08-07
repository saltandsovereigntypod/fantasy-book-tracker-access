const STYLE_ID = 'library-group-flow-runtime-style';
const DESKTOP_QUERY = '(min-width: 761px)';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@media (min-width: 761px) {
  .v2-view--library .v2-library-grid.is-flow-grouped {
    position: relative !important;
    box-sizing: border-box;
    padding-block-start: 28px !important;
    row-gap: 44px !important;
  }

  .v2-view--library .v2-library-grid.is-flow-grouped > .library-group-marker {
    position: absolute !important;
    z-index: 4;
    grid-column: auto !important;
    inline-size: var(--group-flow-width, auto) !important;
    min-height: 20px;
    margin: 0 !important;
    padding: 0 4px !important;
    left: var(--group-flow-left, 0px);
    top: var(--group-flow-top, 0px);
    box-sizing: border-box;
    pointer-events: auto;
  }

  .v2-view--library .v2-library-grid.is-flow-grouped > .library-group-marker::before {
    width: 10px;
    flex: 0 0 10px;
  }

  .v2-view--library .v2-library-grid.is-flow-grouped > .library-group-marker em {
    flex: 0 0 auto;
  }
}
`;
  document.head.appendChild(style);
}

function clearMarkerPosition(marker: HTMLElement) {
  marker.style.removeProperty('--group-flow-left');
  marker.style.removeProperty('--group-flow-top');
  marker.style.removeProperty('--group-flow-width');
}

function firstArticleAfter(marker: HTMLElement): HTMLElement | null {
  let sibling = marker.nextElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement && sibling.matches('.library-group-marker')) return null;
    if (sibling instanceof HTMLElement && sibling.matches('article')) return sibling;
    sibling = sibling.nextElementSibling;
  }
  return null;
}

function layoutGrid(grid: HTMLElement) {
  const markers = [...grid.querySelectorAll<HTMLElement>(':scope > .library-group-marker')];
  const desktop = window.matchMedia(DESKTOP_QUERY).matches;

  if (!desktop || markers.length === 0) {
    grid.classList.remove('is-flow-grouped');
    markers.forEach(clearMarkerPosition);
    return;
  }

  grid.classList.add('is-flow-grouped');

  markers.forEach((marker) => {
    const firstArticle = firstArticleAfter(marker);
    if (!firstArticle) {
      clearMarkerPosition(marker);
      return;
    }

    const left = firstArticle.offsetLeft;
    const top = Math.max(2, firstArticle.offsetTop - 24);
    const width = firstArticle.offsetWidth;

    marker.style.setProperty('--group-flow-left', `${left}px`);
    marker.style.setProperty('--group-flow-top', `${top}px`);
    marker.style.setProperty('--group-flow-width', `${width}px`);
  });
}

let frame = 0;
function scheduleLayout() {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    document.querySelectorAll<HTMLElement>('.v2-view--library .v2-library-grid').forEach(layoutGrid);
  });
}

function start() {
  ensureStyle();
  scheduleLayout();

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList')) scheduleLayout();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('resize', scheduleLayout, { passive: true });
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.closest('.v2-view--library')) scheduleLayout();
  }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
