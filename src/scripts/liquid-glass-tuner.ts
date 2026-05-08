/**
 * Liquid-glass dev tuner.
 *
 * Spec: docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md
 *
 * Dynamically imported by the runtime when at least one .liquid-glass element
 * carries the data-lg-tuner attribute. Mounts a slider panel to <body> and
 * writes CSS vars to the target element's inline style.
 */

interface SliderConfig {
  key: string;
  cssVar: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}

const SLIDERS: SliderConfig[] = [
  { key: 'thickness',    cssVar: '--lg-thickness',     min: 10,    max: 200, step: 5,    fmt: (v) => v.toFixed(0) },
  { key: 'bezel',        cssVar: '--lg-bezel',         min: 2,     max: 80,  step: 1,    fmt: (v) => v.toFixed(0) },
  { key: 'ior',          cssVar: '--lg-ior',           min: 1.0,   max: 2.5, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: 'uniformShift', cssVar: '--lg-uniform-shift', min: -20,   max: 20,  step: 0.5,  fmt: (v) => v.toFixed(1) },
  { key: 'blur',         cssVar: '--lg-blur',          min: 0,     max: 30,  step: 0.5,  fmt: (v) => v.toFixed(1) },
  { key: 'saturate',     cssVar: '--lg-saturate',      min: 0,     max: 300, step: 5,    fmt: (v) => v.toFixed(0) },
  { key: 'svgSaturate',  cssVar: '--lg-svg-saturate',  min: 0,     max: 10,  step: 0.25, fmt: (v) => v.toFixed(2) },
  { key: 'specAlpha',    cssVar: '--lg-spec-alpha',    min: 0,     max: 1,   step: 0.02, fmt: (v) => v.toFixed(2) },
];

function readInitial(target: HTMLElement, cssVar: string): number {
  const raw = getComputedStyle(target).getPropertyValue(cssVar).trim();
  return parseFloat(raw);
}

function buildPanel(target: HTMLElement): HTMLElement {
  const panel = document.createElement('aside');
  panel.id = 'lg-tuner-panel';
  panel.setAttribute('aria-label', 'Liquid glass tuner');
  panel.style.cssText = [
    'position: fixed',
    'top: 12px',
    'right: 12px',
    'z-index: 9999',
    'width: 280px',
    'padding: 12px',
    'background: rgba(20, 20, 24, 0.92)',
    'color: #fafafa',
    'font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
    'border-radius: 8px',
    'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4)',
    'pointer-events: auto',
  ].join(';');

  const head = document.createElement('header');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600;';
  head.textContent = 'Liquid Glass Tuner';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'background:transparent;border:0;color:#fafafa;font-size:16px;cursor:pointer;padding:0 4px;';
  closeBtn.addEventListener('click', () => panel.remove());
  head.appendChild(closeBtn);
  panel.appendChild(head);

  for (const slider of SLIDERS) {
    const initial = readInitial(target, slider.cssVar);
    const value = Number.isFinite(initial) ? initial : (slider.min + slider.max) / 2;

    const label = document.createElement('label');
    label.style.cssText = 'display:block;margin:6px 0;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:2px;';
    const name = document.createElement('span');
    name.textContent = slider.cssVar;
    const out = document.createElement('output');
    out.textContent = slider.fmt(value);
    row.appendChild(name);
    row.appendChild(out);
    label.appendChild(row);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(slider.min);
    input.max = String(slider.max);
    input.step = String(slider.step);
    input.value = String(value);
    input.style.cssText = 'width:100%;';
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      out.textContent = slider.fmt(v);
      target.style.setProperty(slider.cssVar, String(v));
      window.__lg?.refresh?.(target);
    });
    label.appendChild(input);
    panel.appendChild(label);
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:6px;margin-top:10px;';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset';
  resetBtn.style.cssText = 'flex:1;padding:6px;background:#34343a;color:#fafafa;border:0;border-radius:4px;cursor:pointer;';
  resetBtn.addEventListener('click', () => {
    for (const slider of SLIDERS) {
      target.style.removeProperty(slider.cssVar);
    }
    window.__lg?.refresh?.(target);
    // Re-read defaults and update slider positions
    panel.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input, i) => {
      const slider = SLIDERS[i];
      const v = readInitial(target, slider.cssVar);
      input.value = String(v);
      const out = input.parentElement?.querySelector('output');
      if (out) out.textContent = slider.fmt(v);
    });
  });
  actions.appendChild(resetBtn);

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy CSS';
  copyBtn.style.cssText = 'flex:1;padding:6px;background:#34343a;color:#fafafa;border:0;border-radius:4px;cursor:pointer;';
  copyBtn.addEventListener('click', async () => {
    const lines = SLIDERS.map((s) => `  ${s.cssVar}: ${target.style.getPropertyValue(s.cssVar) || readInitial(target, s.cssVar)};`);
    const css = `:root {\n${lines.join('\n')}\n}`;
    try {
      await navigator.clipboard.writeText(css);
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => { copyBtn.textContent = 'Copy CSS'; }, 1200);
    } catch {
      console.warn('liquid-glass-tuner: clipboard write failed', css);
    }
  });
  actions.appendChild(copyBtn);

  panel.appendChild(actions);

  return panel;
}

export function mountTuner(target: HTMLElement): void {
  // Single panel per page. If one already exists, refuse and warn.
  if (document.getElementById('lg-tuner-panel')) {
    console.warn('liquid-glass-tuner: a tuner panel is already mounted; skipping.');
    return;
  }
  const panel = buildPanel(target);
  document.body.appendChild(panel);
}
