const DESKTOP_QUERY = '(min-width: 761px)';

function clearMarkerFlow(marker: HTMLElement) {
  marker.style.removeProperty('position');
  marker.style.removeProperty('grid-column');
  marker.style.removeProperty('grid-row');
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

function articleByBookId(articles: HTMLElement[], bookId: string | undefined): HTMLElement | null {
  if (!bookId) return null;
  return articles.find((article) => article.dataset.bookId === bookId) ?? null;
}

function applyMarkerFlow(marker: HTMLElement, left: number, top: number, width: number) {
  marker.style.setProperty('position', 'absolute', 'important');
  marker.style.setProperty('grid-column', 'auto', 'important');
  marker.style.setProperty('grid-row', 'auto', 'important');
  marker.style.setProperty('left', `${left}px`, 'important');
  marker.style.setProperty('top', `${top}px`, 'important');
  marker.style.setProperty('inline-size', `${width}px`, 'important');
  marker.style.setProperty('width', `${width}px`, 'important');
  marker.style.setProperty('margin', '0', 'important');
  marker.style.setProperty('padding', '0', 'important');
  marker.style.setProperty('--group-flow-left', `${left}px`);
  marker.style.setProperty('--group-flow-top', `${top}px`);
  marker.style.setProperty('--group-flow-width', `${width}px`);
}

function layoutGrid(grid: HTMLElement) {
  const markers = [...grid.querySelectorAll<HTMLElement>(':scope > .library-group-marker')];
  const articles = [...grid.querySelectorAll<HTMLElement>(':scope > article')];
  const desktop = window.matchMedia(DESKTOP_QUERY).matches;

  if (!markers.length) {
    grid.classList.remove('is-flow-grouped');
    return;
  }

  if (!desktop) {
    grid.classList.remove('is-flow-grouped');
    markers.forEach(clearMarkerFlow);
    return;
  }

  grid.classList.add('is-flow-grouped');
  grid.style.setProperty('position', 'relative', 'important');

  markers.forEach((marker) => {
    const firstArticle = articleByBookId(articles, marker.dataset.groupFirstBookId);
    if (!firstArticle) {
      clearMarkerFlow(marker);
      return;
    }

    const left = firstArticle.offsetLeft;
    const top = Math.max(4, firstArticle.offsetTop - 40);
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
  scheduleLayout();
  observeGrids();

  const observer = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => mutation.type === 'childList')) return;
    observeGrids();
    scheduleLayout();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('resize', scheduleLayout, { passive: true });
  window.addEventListener('library-settings-visibility-changed', scheduleLayout as EventListener);
  window.addEventListener('library-groups-arranged', scheduleLayout as EventListener);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
