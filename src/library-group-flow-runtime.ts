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

function articleByBookId(articles: HTMLElement[], bookId: string | undefined): HTMLElement | null {
  if (!bookId) return null;
  return articles.find((article) => article.dataset.bookId === bookId) ?? null;
}

function captureAndNormalizeGroups(grid: HTMLElement, markers: HTMLElement[], articles: HTMLElement[]) {
  const freshMarkers = markers.some((marker) => !marker.dataset.groupFirstBookId);

  if (freshMarkers) {
    articles.forEach((article) => {
      delete article.dataset.libraryGroupIndex;
      delete article.dataset.libraryGroupStart;
    });

    markers.forEach((marker, index) => {
      const groupArticles = articlesAfter(marker);
      marker.dataset.groupIndex = String(index);
      marker.dataset.groupFirstBookId = groupArticles[0]?.dataset.bookId || '';
      groupArticles.forEach((article, articleIndex) => {
        article.dataset.libraryGroupIndex = String(index);
        if (articleIndex === 0) article.dataset.libraryGroupStart = 'true';
        else delete article.dataset.libraryGroupStart;
      });
    });
  }

  /* The metadata layer intentionally emits marker -> cards -> marker -> cards.
     That DOM topology is inherently sectioned. On desktop, preserve its group
     metadata but move every marker after the cards so the CSS grid contains one
     uninterrupted card sequence. Markers are then positioned as overlays. */
  const interleaved = markers.some((marker) => articlesAfter(marker).length > 0);
  if (interleaved) markers.forEach((marker) => grid.appendChild(marker));
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
    articles.forEach((article) => {
      delete article.dataset.libraryGroupIndex;
      delete article.dataset.libraryGroupStart;
    });
    return;
  }

  grid.classList.add('is-grouped-tinted');

  if (!desktop) {
    markers.forEach((marker, index) => {
      const toneClass = index % 2 === 0 ? 'is-flow-group-tone-a' : 'is-flow-group-tone-b';
      articlesAfter(marker).forEach((article, articleIndex) => {
        article.classList.add(toneClass);
        if (articleIndex === 0) article.classList.add('is-flow-group-start');
      });
    });
    grid.classList.remove('is-flow-grouped');
    markers.forEach(clearMarkerFlow);
    return;
  }

  captureAndNormalizeGroups(grid, markers, articles);
  grid.classList.add('is-flow-grouped');
  grid.style.setProperty('position', 'relative', 'important');

  articles.forEach((article) => {
    const groupIndex = Number(article.dataset.libraryGroupIndex);
    if (!Number.isFinite(groupIndex)) return;
    article.classList.add(groupIndex % 2 === 0 ? 'is-flow-group-tone-a' : 'is-flow-group-tone-b');
    if (article.dataset.libraryGroupStart === 'true') article.classList.add('is-flow-group-start');
  });

  const starts = articles.filter((article) => article.dataset.libraryGroupStart === 'true');
  starts[0]?.classList.add('is-flow-first-group');

  markers.forEach((marker) => {
    marker.style.setProperty('position', 'absolute', 'important');
    marker.style.setProperty('grid-column', 'auto', 'important');
    marker.style.setProperty('margin', '0', 'important');

    const firstArticle = articleByBookId(articles, marker.dataset.groupFirstBookId);
    if (!firstArticle) {
      clearMarkerFlow(marker);
      return;
    }

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
