// Dev-only element picker. Hover to highlight, click to capture.
// Captured element snapshot lives on `window.__picked`; history on `window.__pick.history`.
// Trigger: Alt+Shift+P (or `window.__pick.toggle()`). ESC exits.

interface PickedSnapshot {
  selector: string;
  tag: string;
  id: string;
  classList: string[];
  outerHTML: string;
  innerText: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
  computed: Record<string, string>;
  astroIsland: string | null;
  pickedAt: string;
}

interface PickAPI {
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  getPicked: () => PickedSnapshot | null;
  history: PickedSnapshot[];
  clear: () => void;
}

declare global {
  interface Window {
    __pick?: PickAPI;
    __picked?: PickedSnapshot | null;
  }
}

const HISTORY_CAP = 20;
const OUTER_HTML_MAX = 600;
const INNER_TEXT_MAX = 200;
const COMPUTED_KEYS = [
  'display',
  'position',
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'padding',
  'margin',
  'border',
  'border-radius',
  'box-shadow',
] as const;

const STYLE = 'color:#ff3e80;font-weight:600';

// HMR guard — module re-eval shouldn't double-install listeners.
if (!window.__pick) {
  install();
}

function install() {
  let active = false;
  let rafId: number | null = null;
  let lastHovered: Element | null = null;
  const history: PickedSnapshot[] = [];

  const overlayRoot = document.createElement('div');
  overlayRoot.setAttribute('data-pick-mode-ui', '');
  overlayRoot.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:2147483647;display:none;';

  const outline = document.createElement('div');
  outline.style.cssText =
    'position:fixed;pointer-events:none;outline:2px solid #ff3e80;outline-offset:-2px;background:rgba(255,62,128,.08);transition:left 60ms,top 60ms,width 60ms,height 60ms;';

  const label = document.createElement('div');
  label.style.cssText =
    'position:fixed;pointer-events:none;font:600 11px/1 ui-monospace,Menlo,monospace;background:#ff3e80;color:#fff;padding:4px 6px;border-radius:4px;white-space:nowrap;transform:translateY(-100%);';

  const chip = document.createElement('div');
  chip.style.cssText =
    'position:fixed;top:16px;left:50%;transform:translateX(-50%);pointer-events:none;font:600 12px/1 ui-monospace,Menlo,monospace;background:#0f172a;color:#fff;padding:8px 12px;border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,.3);';
  chip.textContent = 'PICK MODE — click to capture · ESC to exit';

  overlayRoot.append(outline, label, chip);

  function ensureMounted() {
    if (!overlayRoot.isConnected) document.body.appendChild(overlayRoot);
  }

  function isPickerUI(node: EventTarget | null): boolean {
    if (!(node instanceof Element)) return false;
    return !!node.closest('[data-pick-mode-ui]');
  }

  function pathHitsPickerUI(e: Event): boolean {
    return e.composedPath().some(isPickerUI);
  }

  function isEditableFocused(): boolean {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function describe(el: Element): string {
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const cls = (el.getAttribute('class') || '').trim();
    if (cls) {
      const first = cls.split(/\s+/).slice(0, 2).join('.');
      if (first) s += `.${first}`;
    }
    return s;
  }

  function onPointerMove(e: PointerEvent) {
    if (!active) return;
    if (rafId !== null) return;
    const x = e.clientX;
    const y = e.clientY;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const target = document.elementFromPoint(x, y);
      if (!target || isPickerUI(target)) {
        outline.style.display = 'none';
        label.style.display = 'none';
        lastHovered = null;
        return;
      }
      if (target === lastHovered) return;
      lastHovered = target;
      const r = target.getBoundingClientRect();
      outline.style.display = 'block';
      outline.style.left = `${r.left}px`;
      outline.style.top = `${r.top}px`;
      outline.style.width = `${r.width}px`;
      outline.style.height = `${r.height}px`;
      label.style.display = 'block';
      label.style.left = `${r.left}px`;
      label.style.top = `${r.top}px`;
      label.textContent = describe(target);
    });
  }

  function onPointerDownCapture(e: PointerEvent) {
    if (!active) return;
    if (pathHitsPickerUI(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function onClickCapture(e: MouseEvent) {
    if (!active) return;
    if (pathHitsPickerUI(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || isPickerUI(target)) return;
    capture(target);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && active) {
      e.preventDefault();
      disable();
      return;
    }
    // Use e.code (physical key) — macOS Option+Shift+P remaps e.key to "∏".
    if (e.altKey && e.shiftKey && e.code === 'KeyP') {
      if (isEditableFocused()) return;
      e.preventDefault();
      toggle();
    }
  }

  function buildSelector(el: Element): string {
    if (el === document.body) return 'body';
    if (el === document.documentElement) return 'html';
    if (el.id) {
      const sel = `#${CSS.escape(el.id)}`;
      try {
        if (document.querySelectorAll(sel).length === 1) return sel;
      } catch {
        /* fall through */
      }
    }
    for (const attr of Array.from(el.attributes)) {
      if (!attr.name.startsWith('data-')) continue;
      if (!attr.value) continue;
      const sel = `[${attr.name}="${attr.value.replace(/"/g, '\\"')}"]`;
      try {
        if (document.querySelectorAll(sel).length === 1) return sel;
      } catch {
        /* skip invalid */
      }
    }
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      const classes = Array.from(node.classList)
        .slice(0, 2)
        .map((c) => `.${CSS.escape(c)}`)
        .join('');
      part += classes;
      const parent: Element | null = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(
          (c) => c.tagName === (node as Element).tagName,
        );
        if (sameTag.length > 1) {
          const idx = sameTag.indexOf(node) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(part);
      const chain = parts.join(' > ');
      try {
        if (document.querySelectorAll(chain).length === 1) return chain;
      } catch {
        /* keep climbing */
      }
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function snapshotOf(el: Element): PickedSnapshot {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const computed: Record<string, string> = {};
    for (const k of COMPUTED_KEYS) computed[k] = cs.getPropertyValue(k).trim();

    const text = ((el as HTMLElement).innerText ?? '').trim();
    const html = el.outerHTML;
    const island = el.closest('astro-island');

    return {
      selector: buildSelector(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      classList: Array.from(el.classList),
      outerHTML: html.length > OUTER_HTML_MAX ? html.slice(0, OUTER_HTML_MAX) + '…' : html,
      innerText:
        text.length > INNER_TEXT_MAX ? text.slice(0, INNER_TEXT_MAX) + '…' : text,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
      },
      computed,
      astroIsland: island?.getAttribute('component-url') || null,
      pickedAt: new Date().toISOString(),
    };
  }

  function capture(target: Element) {
    const snapshot = snapshotOf(target);
    history.unshift(snapshot);
    if (history.length > HISTORY_CAP) history.length = HISTORY_CAP;
    window.__picked = snapshot;
    console.log('%c[pick-mode] captured', STYLE, snapshot);
  }

  function enable() {
    if (active) return;
    active = true;
    ensureMounted();
    overlayRoot.style.display = 'block';
    document.documentElement.classList.add('pick-mode-on');
    document.documentElement.style.cursor = 'crosshair';
    window.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('pointerdown', onPointerDownCapture, { capture: true });
    window.addEventListener('click', onClickCapture, { capture: true });
    console.log(
      '%c[pick-mode] enabled — hover, click to capture, ESC to exit',
      STYLE,
    );
  }

  function disable() {
    if (!active) return;
    active = false;
    overlayRoot.style.display = 'none';
    outline.style.display = 'none';
    label.style.display = 'none';
    document.documentElement.classList.remove('pick-mode-on');
    document.documentElement.style.cursor = '';
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastHovered = null;
    window.removeEventListener('pointermove', onPointerMove, { capture: true });
    window.removeEventListener('pointerdown', onPointerDownCapture, { capture: true });
    window.removeEventListener('click', onClickCapture, { capture: true });
    console.log('%c[pick-mode] disabled', STYLE);
  }

  function toggle() {
    if (active) disable();
    else enable();
  }

  function getPicked() {
    return window.__picked ?? null;
  }

  function clear() {
    window.__picked = null;
    history.length = 0;
  }

  window.addEventListener('keydown', onKeyDown);

  window.__pick = { enable, disable, toggle, getPicked, history, clear };

  console.log('%c[pick-mode] ready — Alt+Shift+P to toggle', STYLE);
}

export {};
