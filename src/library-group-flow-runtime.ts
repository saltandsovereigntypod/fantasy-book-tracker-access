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
    z-index: 4;
    min-height: 20px;
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

  .v2-view--library .v2-library-grid.is-flow-grouped > article.is-flow-group-start:not(.is-flow-first-group) {
    position: relative;
  }
}
`;
  document.head.appendChild(style);
}

function clearMarkerFlow(marker: HTMLElement) {
  marker.style.removeProperty('position');
  marker.style.removeProperty('grid-column');
  marker.style.removeProperty('left');
  marker.style.removeProperty('top');
  marker.style.removeProperty('inline-size');
  marker.style.removeProperty('width');
  marker.style.removeProperty('margin');
  marker.style.removeProperty('padding');
  marker.style.removeProperty('--group-flow-left');
  marker.style.removeProperty('--group-flow-top');
  marker.style.removeProperty('--group-flow-width');
}

function applyMarkerFlow(marker: HTMLElement, left: number, top: number, width: number) {
  /* Group markers are DOM siblings of cards so drag ordering remains simple,
     but they must never participate in CSS Grid placement on desktop. Keep
     this structural rule inline and !important so theme/layout styles cannot
     turn a heading back into a full-width grid row. */
  marker.style.setProperty('position', 'absolute', 'important');
  marker.style.setProperty('grid-column', 'auto', 'important');
  marker.style.setProperty('left', `${left}px`, 'important');
  marker.style.setProperty('top', `${top}px`, 'important');
  marker.style.setProperty('inline-size', `${width}px`, 'important');
  marker.style.setProperty('width', `${width}px`, 'important');
  marker.style.setProperty('margin', '0', 'important');
  marker.style.setProperty('padding', '0 4px', 'important');
  marker.style.setProperty('--group-flow-left', `${left}px`);
  marker.style.setProperty('--group-flow-top', `${top}px`);
  marker.style.setProperty('--group-flow-width', `${width}px`);
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

function articlesAfter(marker: HTMLElement): HTMLElement[] {
  const articles: HTMLElement[] = [];
  let sibling = marker.nextElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement && sibling.matches('.library-group-marker')) break;
    if (sibling instanceof HTMLElement && sibling.matches('article')) articles.push(sibling);
    sibling = sibling.nextElementSibling;
  }
  return articles;
}

function layoutGrid(grid: HTMLElement) {
  const markers = [...grid.querySelectorAll<HTMLElement>(':scope > .library-group-marker')];
  const desktop = window.matchMedia(DESKTOP_QUERY).matches;
  const articles = [...grid.querySelectorAll<HTMLElement>(':scope > article')];

  articles.forEach((article) => {
    article.classList.remove('is-flow-group-start', 'is-flow-first-group', 'is-flow-group-tone-a', 'is-flow-group-tone-b');
  });

  if (markers.length === 0) {
    grid.classList.remove('is-flow-grouped', 'is-grouped-tinted');
    return;
  }

  grid.classList.add('is-grouped-tinted');
  markers.forEach((marker, index) => {
    const toneClass = index % 2 === 0 ? 'is-flow-group-tone-a' : 'is-flow-group-tone-b';
    articlesAfter(marker).forEach((article) => article.classList.add(toneClass));
  });

  if (!desktop) {
    grid.classList.remove('is-flow-grouped');
    markers.forEach(clearMarkerFlow);
    return;
  }

  grid.classList.add('is-flow-grouped');
  grid.style.setProperty('position', 'relative', 'important');

  /* First remove every heading from grid flow. This is intentionally done
     before reading article offsets: otherwise a marker can create the very
     empty row whose coordinates we are trying to eliminate. */
  markers.forEach((marker) => {
    marker.style.setProperty('position', 'absolute', 'important');
    marker.style.setProperty('grid-column', 'auto', 'important');
    marker.style.setProperty('margin', '0', 'important');
  });

  markers.forEach((marker, index) => {
    const firstArticle = firstArticleAfter(marker);
    if (!firstArticle) {
      clearMarkerFlow(marker);
      return;
    }

    firstArticle.classList.add('is-flow-group-start');
    if (index === 0) firstArticle.classList.add('is-flow-first-group');

    const left = firstArticle.offsetLeft;
    const top = Math.max(2, firstArticle.offsetTop - 24);
    const width = firstArticle.offsetWidth;
    applyMarkerFlow(marker, left, top, width);
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

let resizeObserver: ResizeObserver | null = null;
function observeGrids() {
  if (!('ResizeObserver' in window)) return;
  if (!resizeObserver) resizeObserver = new ResizeObserver(scheduleLayout);
  document.querySelectorAll<HTMLElement>('.v2-view--library .v2-library-grid').forEach((grid) => resizeObserver?.observe(grid));
}

function start() {
  ensureStyle();
  scheduleLayout();
  observeGrids();

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) =>
      mutation.type === 'childList' ||
      (mutation.type === 'attributes' && ['class', 'data-universe', 'data-path', 'data-court'].includes(mutation.attributeName || '')),
    );
    if (!relevant) return;
    observeGrids();
    scheduleLayout();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-universe', 'data-path', 'data-court'],
  });

  window.addEventListener('resize', scheduleLayout, { passive: true });
  window.addEventListener('library-settings-visibility-changed', scheduleLayout as EventListener);
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.closest('.v2-view--library')) scheduleLayout();
  }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
