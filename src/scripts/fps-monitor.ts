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
// Cost: one canvas draw per frame + a throttled text update (~6Hz). Negligible,
// so it doesn't meaningfully perturb the very thing it measures.

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
  ctx.scale(dpr, dpr);

  wrap.append(label, canvas);

  const attach = (): void => {
    document.body.appendChild(wrap);
    requestAnimationFrame(tick);
  };

  const durations: number[] = [];
  let last = performance.now();
  let accMs = 0;
  let accFrames = 0;
  let worst = 0;
  let lastText = last;

  // ms → y pixel (0 at top). Longer frames draw taller bars from the baseline.
  const yFor = (ms: number): number =>
    GRAPH_H - Math.min(GRAPH_H, (ms / MAX_MS) * GRAPH_H);

  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, GRAPH_H);

    // Guide lines at the warn + bad thresholds so spikes are easy to read.
    ctx.lineWidth = 1;
    for (const [ms, alpha] of [[WARN_MS, 0.18], [BAD_MS, 0.28]] as const) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      const y = Math.round(yFor(ms)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    // One 1px column per retained frame, right-aligned (newest at the right).
    const start = WIDTH - durations.length;
    for (let i = 0; i < durations.length; i++) {
      const d = durations[i];
      const top = yFor(d);
      ctx.fillStyle = colourFor(d);
      ctx.fillRect(start + i, top, 1, GRAPH_H - top);
    }
  }

  function tick(now: number): void {
    const dt = now - last;
    last = now;

    durations.push(dt);
    if (durations.length > WIDTH) durations.shift();
    accMs += dt;
    accFrames++;
    if (dt > worst) worst = dt;

    draw();

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
