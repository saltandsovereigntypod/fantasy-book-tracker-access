type ArchiveBook = { id?: unknown; title?: unknown };

const ARCHIVE_KEY = 'empyrean-v2-archive';

function archiveBooks(): Array<{ id: string; title: string }> {
  try {
    const parsed = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}') as { books?: ArchiveBook[] };
    if (!Array.isArray(parsed.books)) return [];
    return parsed.books
      .map((book) => ({ id: String(book?.id || ''), title: String(book?.title || '').trim() }))
      .filter((book) => book.id && book.title);
  } catch {
    return [];
  }
}

function visibleTitle(article: HTMLElement): string {
  const selectLabel = article.querySelector<HTMLElement>('.v2-library-select span')?.textContent?.trim() || '';
  if (selectLabel.toLocaleLowerCase().startsWith('select ')) return selectLabel.slice(7).trim();
  return '';
}

function stampGrid(grid: HTMLElement) {
  const books = archiveBooks();
  if (!books.length) return;
  const byTitle = new Map<string, Array<{ id: string; title: string }>>();
  books.forEach((book) => {
    const key = book.title.toLocaleLowerCase();
    byTitle.set(key, [...(byTitle.get(key) || []), book]);
  });
  const used = new Set<string>();
  grid.querySelectorAll<HTMLElement>(':scope > article').forEach((article) => {
    const title = visibleTitle(article);
    if (!title) return;
    const candidates = byTitle.get(title.toLocaleLowerCase()) || [];
    const current = article.dataset.bookId;
    const currentMatch = current ? candidates.find((book) => book.id === current && !used.has(book.id)) : undefined;
    const match = currentMatch || candidates.find((book) => !used.has(book.id));
    if (!match) {
      delete article.dataset.bookId;
      return;
    }
    used.add(match.id);
    article.dataset.bookId = match.id;
  });
}

function stampAll() {
  document.querySelectorAll<HTMLElement>('.v2-view--library .v2-library-grid').forEach(stampGrid);
}

let frame = 0;
function scheduleStamp() {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    stampAll();
  });
}

function start() {
  stampAll();
  document.addEventListener('change', (event) => {
    const select = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!select?.matches('.v2-view--library .advanced-library-sort select')) return;
    stampAll();
  }, true);
  window.addEventListener('library-preferences-updated', stampAll as EventListener);

  const observer = new MutationObserver((mutations) => {
    const libraryCardsChanged = mutations.some((mutation) => [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
      node instanceof HTMLElement && (node.matches('article,.v2-library-grid') || Boolean(node.querySelector?.('article,.v2-library-grid')))
    ));
    if (libraryCardsChanged) scheduleStamp();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
