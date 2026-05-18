// Tech-stack multi-row marquee runtime.
//
// Discovers [data-bento-stack] containers, measures the available vertical
// space below the card's text content, and populates N independently-
// scrolling marquee rows. Odd rows reverse direction so adjacent lanes
// move in opposite directions. Re-evaluates on resize because card height
// scales with viewport (aspect-ratio + width: 100%).
//
// Port of docs/ideas/bento-mchiu.html's stack-card marquee, restructured
// for multiple rows.

interface StackItem {
  slug: string;
  hex: string;
}

const STACK: StackItem[] = [
  { slug: 'python', hex: '3776AB' },
  { slug: 'pytorch', hex: 'EE4C2C' },
  { slug: 'tensorflow', hex: 'FF6F00' },
  { slug: 'docker', hex: '2496ED' },
  { slug: 'kubernetes', hex: '326CE5' },
  { slug: 'postgresql', hex: '4169E1' },
  { slug: 'git', hex: 'F05032' },
  { slug: 'grafana', hex: 'F46800' },
  { slug: 'nvidia', hex: '76B900' },
  { slug: 'jenkins', hex: 'D24939' },
  { slug: 'opencv', hex: '5C3EE8' },
  { slug: 'onnx', hex: '005CED' },
];

// Tile size and gap are owned by CSS via --tile-size / --tile-gap on the
// marquee container — read at measure-time so the row-count math stays in
// sync with the rendered tile geometry (e.g. mobile bumps --tile-size to
// 64px).
const MAX_ROWS = 3;
const BOTTOM_OFFSET = 24; // matches .marquee CSS `bottom: 24px`
const TOP_GAP = 12;       // breathing space below body text before marquee starts

function readTileMetrics(marquee: HTMLElement): { tile: number; gap: number } {
  const cs = getComputedStyle(marquee);
  const tile = parseFloat(cs.getPropertyValue('--tile-size')) || 44;
  const gap = parseFloat(cs.getPropertyValue('--tile-gap')) || 10;
  return { tile, gap };
}

function buildTrack(): HTMLElement {
  const track = document.createElement('div');
  track.className = 'marquee-track';
  // Doubled for the seamless -50% loop in @keyframes bento-stack-marquee.
  for (const t of [...STACK, ...STACK]) {
    const tile = document.createElement('div');
    tile.className = 'stack-tile';
    tile.style.setProperty('--bg-color', `#${t.hex}`);
    const img = document.createElement('img');
    img.src = `https://cdn.simpleicons.org/${t.slug}/white`;
    img.alt = '';
    img.loading = 'lazy';
    tile.appendChild(img);
    track.appendChild(tile);
  }
  return track;
}

function buildRows(marquee: HTMLElement): void {
  const card = marquee.closest<HTMLElement>('.bento-card');
  const text = card?.querySelector<HTMLElement>('.card-text');
  if (!card || !text) return;
  // Skip while the host card is mid-expand/collapse — its rect reflects the
  // modal (or a transitioning size), not the resting geometry. Resize events
  // fire on this path when lockBodyScroll/unlockBodyScroll toggles the page
  // scrollbar and the viewport width shifts.
  if (
    card.classList.contains('is-expanding') ||
    card.classList.contains('is-expanded') ||
    card.classList.contains('is-collapsing')
  ) {
    return;
  }
  const cardRect = card.getBoundingClientRect();
  const textRect = text.getBoundingClientRect();
  const marqueeTop = textRect.bottom - cardRect.top + TOP_GAP;
  const marqueeBottom = cardRect.height - BOTTOM_OFFSET;
  const available = Math.max(0, marqueeBottom - marqueeTop);
  const { tile, gap } = readTileMetrics(marquee);
  const rowHeight = tile + gap;
  const rowCount = Math.max(
    1,
    Math.min(MAX_ROWS, Math.floor((available + gap) / rowHeight)),
  );
  // Only rebuild if the row count actually changed. Rebuilding clones the
  // tracks, which restarts the CSS marquee animation at translateX(0) — a
  // visible snap to start position. Idempotent resize was the close-time
  // "tiles relocate" bug: unlockBodyScroll restores the scrollbar, fires
  // window resize, this path rebuilt tracks, animations snapped.
  if (marquee.children.length === rowCount) return;
  marquee.replaceChildren();
  for (let i = 0; i < rowCount; i++) {
    const row = document.createElement('div');
    row.className = 'marquee-row' + (i % 2 === 1 ? ' reverse' : '');
    row.appendChild(buildTrack());
    marquee.appendChild(row);
  }
}

function init(): void {
  document.querySelectorAll<HTMLElement>('[data-bento-stack]').forEach(buildRows);
}

let resizeRaf: number | null = null;
function onResize(): void {
  if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    init();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

export {};
