// Visual FPS monitor (dev / on-demand jank hunting).
//
// Mounts a small fixed overlay: a live FPS number, the worst frame time in the
// current window (the thing that actually reads as a "hitch"), and a frame-time
// sparkline where dropped frames spike up and turn red. Built to localise scroll
// jank — watch the graph while scrolling and the spikes line up with the stutter.
//
// Loaded automatically in dev (BaseLayout). On a production build (e.g. the
// Netlify deploy preview) it stays dormant unless summoned with `?fps` or `#fps`
// in the URL — so it can be pulled up on a real iPhone without shipping it to
// every visitor. The overlay is pointer-events:none and never blocks the page.
//
// Cost: the graph scrolls one column per frame (a single self-drawImage) and
// paints only the newest bar — ~5 canvas ops/frame, not a full ~150-bar
// repaint — plus a throttled (~6Hz) text update. Kept deliberately cheap so the
// monitor doesn't meaningfully perturb the very framerate it measures.

const WIDTH = 150; // graph width in CSS px (one column per retained frame)
const GRAPH_H = 40; // graph height in CSS px
const MAX_MS = 50; // top of the graph's vertical scale (ms); spikes clip here

// Frame-time thresholds (ms). Engine-agnostic: a "hitch" is a long frame
// regardless of whether the panel is 60Hz (16.7ms ideal) or 120Hz (8.3ms).
const WARN_MS = 20; // ~ below 50fps
const BAD_MS = 34; // ~ below 30fps — a visible stutter

const GREEN = '#4dff88';
const YELLOW = '#ffcf4d';
const RED = '#ff5151';

function colourFor(ms: number): string {
  return ms > BAD_MS ? RED : ms > WARN_MS ? YELLOW : GREEN;
}

function mount(): void {
  if (document.getElementById('fps-monitor')) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const wrap = document.createElement('div');
  wrap.id = 'fps-monitor';
  wrap.setAttribute('aria-hidden', 'true');
  Object.assign(wrap.style, {
    position: 'fixed',
    left: '12px',
    bottom: '12px',
    zIndex: '2147483647',
    pointerEvents: 'none',
    font: '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    color: '#fff',
    background: 'rgba(0, 0, 0, 0.6)',
    borderRadius: '8px',
    padding: '6px 7px 5px',
    lineHeight: '1.2',
    userSelect: 'none',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
  });

  const label = document.createElement('div');
  Object.assign(label.style, {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '4px',
  });
  const fpsText = document.createElement('span');
  fpsText.textContent = '— fps';
  const worstText = document.createElement('span');
  worstText.style.opacity = '0.8';
  worstText.textContent = '▲ —';
  label.append(fpsText, worstText);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(WIDTH * dpr);
  canvas.height = Math.round(GRAPH_H * dpr);
  Object.assign(canvas.style, {
    width: `${WIDTH}px`,
    height: `${GRAPH_H}px`,
    display: 'block',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.06)',
  });
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Draw in DEVICE pixels (no ctx.scale) so the per-frame canvas-scroll
  // (drawImage onto itself) shifts by a whole column with no fractional blur.
  const GW = canvas.width;
  const GH = canvas.height;
  const colW = Math.max(1, Math.round(dpr)); // device px per 1-CSS-px column
  const gLine = colW; // guide-line thickness

  wrap.append(label, canvas);

  const attach = (): void => {
    document.body.appendChild(wrap);
    requestAnimationFrame(tick);
  };

  let last = performance.now();
  let accMs = 0;
  let accFrames = 0;
  let worst = 0;
  let lastText = last;

  // ms → y (device px). Longer frames draw taller bars from the baseline.
  const yFor = (ms: number): number =>
    Math.round(GH - Math.min(GH, (ms / MAX_MS) * GH));

  function tick(now: number): void {
    const dt = now - last;
    last = now;
    accMs += dt;
    accFrames++;
    if (dt > worst) worst = dt;

    // Cheap render: scroll the whole graph one column left — drawImage the
    // canvas onto itself with 'copy' (which also clears the newly-exposed right
    // strip) — then paint ONLY the newest column: the two guide-line pixels +
    // this frame's bar. ~5 canvas ops/frame instead of clearing and repainting
    // all ~150 bars, so the monitor barely perturbs the framerate it measures.
    if (ctx) {
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(canvas, -colW, 0);
      ctx.globalCompositeOperation = 'source-over';
      const x = GW - colW;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, yFor(WARN_MS), colW, gLine);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x, yFor(BAD_MS), colW, gLine);
      const top = yFor(dt);
      ctx.fillStyle = colourFor(dt);
      ctx.fillRect(x, top, colW, GH - top);
    }

    // Throttle the numeric readout to ~6Hz so the digits are legible (and the
    // text write itself isn't per-frame churn).
    if (now - lastText > 160) {
      const fps = accFrames > 0 ? Math.round(1000 / (accMs / accFrames)) : 0;
      fpsText.textContent = `${fps} fps`;
      // Green when keeping up (≥55fps covers a 60Hz panel; a 120Hz panel reads
      // ~120 and is also green), yellow ≥30, red below.
      fpsText.style.color = fps >= 55 ? GREEN : fps >= 30 ? YELLOW : RED;
      worstText.textContent = `▲ ${Math.round(worst)}ms`;
      worstText.style.color = colourFor(worst);
      accMs = 0;
      accFrames = 0;
      worst = 0;
      lastText = now;
    }

    requestAnimationFrame(tick);
  }

  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });
}

mount();

export {};
