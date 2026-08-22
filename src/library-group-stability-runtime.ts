const ADVANCED_SELECT = '.v2-view--library .advanced-library-sort select';

function syncHeadings() {
  document.querySelectorAll<HTMLElement>('.v2-view--library .v2-library-grid').forEach((grid) => {
    grid.querySelectorAll<HTMLElement>(':scope > article .library-inline-group-heading').forEach((heading) => heading.remove());

    const articles = [...grid.querySelectorAll<HTMLElement>(':scope > article[data-book-id]')];
    const markers = [...grid.querySelectorAll<HTMLElement>(':scope > .library-group-marker[data-group-first-book-id]')];

    markers.forEach((marker) => {
      const bookId = marker.dataset.groupFirstBookId;
      if (!bookId) return;
      const article = articles.find((candidate) => candidate.dataset.bookId === bookId);
      if (!article) return;

      const heading = document.createElement('div');
      heading.className = 'library-inline-group-heading';
      heading.dataset.groupLabel = marker.dataset.groupLabel || '';
      heading.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.textContent = marker.dataset.groupLabel || '';
      const rule = document.createElement('i');
      heading.append(label, rule);
      article.prepend(heading);
    });
  });
}

let syncFrame = 0;
function scheduleSync() {
  if (syncFrame) cancelAnimationFrame(syncFrame);
  syncFrame = requestAnimationFrame(() => {
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      syncHeadings();
    });
  });
}

let arrangeTimer = 0;
function nudgeArrangement() {
  if (arrangeTimer) window.clearTimeout(arrangeTimer);
  arrangeTimer = window.setTimeout(() => {
    arrangeTimer = 0;
    window.dispatchEvent(new Event('resize'));
    scheduleSync();
  }, 60);
}

function start() {
  scheduleSync();

  document.addEventListener('change', (event) => {
    const select = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!select?.matches(ADVANCED_SELECT)) return;
    nudgeArrangement();
  }, true);

  window.addEventListener('library-preferences-updated', nudgeArrangement as EventListener);
  window.addEventListener('library-groups-arranged', scheduleSync as EventListener);
  window.addEventListener('library-settings-visibility-changed', scheduleSync as EventListener);

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      return Boolean(target?.closest('.v2-view--library .v2-library-grid'));
    });
    if (relevant) scheduleSync();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
