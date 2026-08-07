const STYLE_ID = 'library-group-flow-runtime-style';
const DESKTOP_QUERY = '(min-width: 761px)';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.v2-view--library .v2-library-grid.is-grouped-tinted > article.is-flow-group-tone-a {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--v2-panel, var(--panel)) 58%, var(--v2-accent, var(--accent)) 42%),
    color-mix(in srgb, var(--v2-panel, var(--panel)) 76%, var(--v2-accent, var(--accent)) 24%)
  ) !important;
  border-color: color-mix(in srgb, var(--v2-border, var(--border)) 38%, var(--v2-accent, var(--accent)) 62%) !important;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--v2-accent, var(--accent)) 22%, transparent),
    inset 0 10px 26px color-mix(in srgb, var(--v2-accent, var(--accent)) 10%, transparent);
}

.v2-view--library .v2-library-grid.is-grouped-tinted > article.is-flow-group-tone-b {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--v2-panel, var(--panel)) 64%, var(--path-paper, var(--paper)) 36%),
    color-mix(in srgb, var(--v2-panel, var(--panel)) 82%, var(--path-paper, var(--paper)) 18%)
  ) !important;
  border-color: color-mix(in srgb, var(--v2-border, var(--border)) 44%, var(--path-paper, var(--paper)) 56%) !important;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--path-paper, var(--paper)) 18%, transparent),
    inset 0 10px 26px color-mix(in srgb, var(--path-paper, var(--paper)) 8%, transparent);
}

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

  .v2-view--library .v2-library-grid.is-flow-grouped > article.is-flow-group-start:not(.is-flow-first-group) {
    position: relative;
  }

  .v2-view--library .v2-library-grid.is-flow-grouped > article.is-flow-group-start:not(.is-flow-first-group)::before {
    content: '';
    position: absolute;
    z-index: 2;
    pointer-events: none;
    inset-block: 5%;
    inset-inline-start: -13px;
    inline-size: 2px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--v2-border-strong, var(--v2-border, var(--border))) 52%, transparent);
    box-shadow: 0 0 7px color-mix(in srgb, var(--v2-border-strong, var(--v2-border, var(--border))) 18%, transparent);
    opacity: .94;
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
    markers.forEach(clearMarkerPosition);
    return;
  }

  grid.classList.add('is-flow-grouped');

  markers.forEach((marker, index) => {
    const firstArticle = firstArticleAfter(marker);
    if (!firstArticle) {
      clearMarkerPosition(marker);
      return;
    }

    firstArticle.classList.add('is-flow-group-start');
    if (index === 0) firstArticle.classList.add('is-flow-first-group');

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
