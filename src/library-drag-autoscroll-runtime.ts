const EDGE_ZONE = 120;
const MAX_SPEED = 22;

let active = false;
let pointerY = 0;
let frame = 0;

function isLibraryDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('.v2-view--library .library-group-marker, .v2-view--library article[data-book-id]'));
}

function stopAutoScroll(): void {
  active = false;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

function scrollStep(): void {
  if (!active) {
    frame = 0;
    return;
  }

  const viewportHeight = window.innerHeight;
  let delta = 0;

  if (pointerY < EDGE_ZONE) {
    const strength = Math.max(0, Math.min(1, (EDGE_ZONE - pointerY) / EDGE_ZONE));
    delta = -Math.max(2, Math.round(MAX_SPEED * strength));
  } else if (pointerY > viewportHeight - EDGE_ZONE) {
    const strength = Math.max(0, Math.min(1, (pointerY - (viewportHeight - EDGE_ZONE)) / EDGE_ZONE));
    delta = Math.max(2, Math.round(MAX_SPEED * strength));
  }

  if (delta !== 0) window.scrollBy(0, delta);
  frame = requestAnimationFrame(scrollStep);
}

function startAutoScroll(event: DragEvent): void {
  if (!isLibraryDragTarget(event.target)) return;
  active = true;
  pointerY = event.clientY;
  if (!frame) frame = requestAnimationFrame(scrollStep);
}

function updatePointer(event: DragEvent): void {
  if (!active) return;
  pointerY = event.clientY;
}

function start(): void {
  document.addEventListener('dragstart', startAutoScroll, true);
  document.addEventListener('dragover', updatePointer, true);
  document.addEventListener('dragend', stopAutoScroll, true);
  document.addEventListener('drop', stopAutoScroll, true);
  window.addEventListener('blur', stopAutoScroll);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
