/**
 * Command palette runtime — prototype.
 *
 * Dependency-free (no React/cmdk). Mirrors the liquid-glass module pattern:
 * auto-wires on DOMContentLoaded, reads a server-rendered JSON index, and
 * publishes an imperative handle on `window.__cmdk`.
 *
 * Spotlight mode: fuzzy-filter the entry registry.
 * Terminal mode: when the query's first token is a known command, the body
 * becomes a shell transcript that operates over the same index.
 */

import { applyTheme } from '../lib/theme';

interface PaletteEntry {
  id: string;
  group: string;
  icon: string;
  title: string;
  subtitle?: string;
  keywords?: string[];
  body?: string;
  action: 'navigate' | 'open-url' | 'copy-email' | 'toggle-theme';
  href?: string;
}

interface PaletteMeta {
  name: string;
  title: string;
  location: string;
  email: string;
}

declare global {
  interface Window {
    __cmdk?: {
      open: () => void;
      close: () => void;
      toggle: () => void;
    };
  }
}

const COMMANDS = ['help', 'ls', 'cat', 'grep', 'whoami', 'open', 'theme', 'email', 'clear', 'ask'];

// Minimal inline-SVG sprite (lucide path data). The client module injects
// per-result icons via innerHTML at runtime and can't call Astro's <Icon>
// component (which only renders at build time), so the glyphs are inlined
// here. Trade-off: these paths can drift from the lucide version astro-icon
// resolves elsewhere — keep them in sync if icons look off.
const ICONS: Record<string, string> = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  sparkles: '<path d="M9.94 14.66a1 1 0 0 1-.66.66l-2.2.73a.5.5 0 0 0 0 .94l2.2.73a1 1 0 0 1 .66.66l.73 2.2a.5.5 0 0 0 .94 0l.73-2.2a1 1 0 0 1 .66-.66l2.2-.73a.5.5 0 0 0 0-.94l-2.2-.73a1 1 0 0 1-.66-.66l-.73-2.2a.5.5 0 0 0-.94 0z"/><path d="M5 3v4"/><path d="M3 5h4"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>',
  briefcase: '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
  contrast: '<circle cx="12" cy="12" r="10"/><path d="M12 18a6 6 0 0 0 0-12v12z"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V2h12v7"/><rect width="12" height="8" x="6" y="14"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
};

function svg(icon: string): string {
  const path = ICONS[icon] ?? ICONS.box;
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ---------- Fuzzy matcher (subsequence scoring) ----------

interface Match {
  score: number;
  indices: number[];
}

function fuzzy(query: string, target: string): Match | null {
  if (!query) return { score: 0, indices: [] };
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let prevIdx = -2;
  const indices: number[] = [];
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      // Contiguous + word-boundary bonuses; earlier matches score higher.
      if (ti === prevIdx + 1) score += 6;
      if (ti === 0 || /[\s\-_/.]/.test(t[ti - 1])) score += 8;
      score += Math.max(0, 4 - ti * 0.05);
      prevIdx = ti;
      qi++;
    }
  }
  if (qi < q.length) return null;
  return { score, indices };
}

function highlight(text: string, indices: number[]): string {
  if (!indices.length) return escapeHtml(text);
  const set = new Set(indices);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = escapeHtml(text[i]);
    out += set.has(i) ? `<mark>${ch}</mark>` : ch;
  }
  return out;
}

// ---------- Runtime ----------

function init() {
  const root = document.getElementById('cmdk-root');
  const dataEl = document.getElementById('cmdk-data');
  const input = document.getElementById('cmdk-input') as HTMLInputElement | null;
  const list = document.getElementById('cmdk-list');
  if (!root || !dataEl || !input || !list) return;

  let entries: PaletteEntry[] = [];
  let meta: PaletteMeta;
  try {
    const parsed = JSON.parse(dataEl.textContent || '{}');
    entries = parsed.entries ?? [];
    meta = parsed.meta;
  } catch {
    return;
  }

  const overlay = root.querySelector('[data-cmdk-overlay]');
  const promptEl = root.querySelector('[data-cmdk-prompt]');
  const modeEl = root.querySelector('[data-cmdk-mode]') as HTMLElement | null;

  let active = 0; // active spotlight item index
  let visible: PaletteEntry[] = [];
  let scrollback: string[] = []; // committed terminal lines (HTML)
  let lastFocused: Element | null = null;
  let closeTimer: number | null = null; // pending hide after the close transition
  let prevHtmlOverflow = ''; // saved html overflow for the JS scroll lock

  const isTerminal = (q: string) => COMMANDS.includes(q.trim().split(/\s+/)[0]?.toLowerCase());

  // Scroll lock driven from JS, not just CSS. The CSS rule relies on
  // `html:has(body.cmdk-open)`, but <html> is the real scroller here and :has()
  // isn't supported everywhere (older Safari/Firefox, some in-app webviews) —
  // where it's missing the background scrolls freely behind the palette. Lock
  // <html> directly so it works regardless of :has() support and for wheel and
  // trackpad scroll (the touchmove guard below only covers touch). Not
  // position:fixed — see CLAUDE.md, that broke scroll position twice on iOS.
  // Scrollbars are hidden globally (scrollbar-width:none), so there's no shift.
  function lockScroll() {
    const html = document.documentElement;
    prevHtmlOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
  }
  function unlockScroll() {
    document.documentElement.style.overflow = prevHtmlOverflow;
  }


  // ----- open / close -----
  // The close animation hides the root only after the transition (or a 260ms
  // fallback) so it can fade out. If the user re-opens within that window we
  // must cancel the pending hide, or the stale timer would blank the freshly
  // opened palette.
  function finishClose() {
    closeTimer = null;
    root!.removeEventListener('transitionend', onCloseTransitionEnd);
    if (root!.classList.contains('is-open')) return; // re-opened mid-transition
    root!.hidden = true;
  }
  function onCloseTransitionEnd(e: TransitionEvent) {
    if (e.target === root || (e.target as HTMLElement).classList?.contains('cmdk-dialog')) finishClose();
  }

  function open() {
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    root!.removeEventListener('transitionend', onCloseTransitionEnd);
    const wasHidden = root!.hidden;
    root!.hidden = false;
    document.body.classList.add('cmdk-open');
    requestAnimationFrame(() => root!.classList.add('is-open'));
    if (wasHidden) {
      lockScroll();
      lastFocused = document.activeElement;
      input!.value = '';
      render();
    }
    input!.focus();
  }

  function close() {
    if (root!.hidden) return;
    root!.classList.remove('is-open');
    document.body.classList.remove('cmdk-open');
    unlockScroll();
    root!.addEventListener('transitionend', onCloseTransitionEnd);
    if (closeTimer !== null) clearTimeout(closeTimer);
    closeTimer = window.setTimeout(finishClose, 260); // fallback if transitionend doesn't fire
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  function toggle() {
    root!.hidden ? open() : close();
  }

  // ----- spotlight render -----
  function renderSpotlight(q: string) {
    root!.classList.remove('is-terminal');
    promptEl!.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>';
    if (modeEl) modeEl.hidden = true;

    const scored = entries
      .map((e) => {
        const hay = [e.title, e.subtitle ?? '', (e.keywords ?? []).join(' ')].join(' ');
        const m = q ? fuzzy(q, hay) : { score: 0, indices: [] };
        if (!m) return null;
        // Re-run on the title alone so highlight indices land on the title text.
        const titleMatch = q ? fuzzy(q, e.title) : { score: 0, indices: [] };
        return { e, score: m.score, titleIndices: titleMatch ? titleMatch.indices : [] };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (!q) {
      // Preserve declared order when no query.
      visible = entries.slice();
    } else {
      scored.sort((a, b) => b.score - a.score);
      visible = scored.map((s) => s.e);
    }

    if (!visible.length) {
      list!.innerHTML = `<div class="cmdk-empty">No matches for “${escapeHtml(q)}”. Try <code>help</code> or <code>grep ${escapeHtml(q)}</code>.</div>`;
      return;
    }

    const indexById = new Map(scored.map((s) => [s.e.id, s.titleIndices]));
    let html = '';
    let lastGroup = '';
    visible.forEach((e, i) => {
      if (e.group !== lastGroup) {
        html += `<div class="cmdk-group-label">${escapeHtml(e.group)}</div>`;
        lastGroup = e.group;
      }
      const titleHtml = q ? highlight(e.title, indexById.get(e.id) ?? []) : escapeHtml(e.title);
      const sub = e.subtitle ? `<div class="cmdk-item-sub">${escapeHtml(e.subtitle)}</div>` : '';
      html += `
        <div class="cmdk-item" role="option" data-idx="${i}" aria-selected="${i === active}">
          <span class="cmdk-item-icon">${svg(e.icon)}</span>
          <span class="cmdk-item-text">
            <div class="cmdk-item-title">${titleHtml}</div>${sub}
          </span>
          <span class="cmdk-item-go">↵</span>
        </div>`;
    });
    list!.innerHTML = html;
  }

  // ----- terminal render -----
  function renderTerminal(q: string) {
    root!.classList.add('is-terminal');
    promptEl!.textContent = '$';
    if (modeEl) modeEl.hidden = false;

    const liveHtml = runCommand(q, /* preview */ true);
    const lines = [...scrollback];
    if (q.trim()) {
      lines.push(`<div class="cmdk-term-line cmdk-term-cmd">${escapeHtml(q)}</div>${liveHtml}`);
      lines.push('<div class="cmdk-term-run">press <kbd>↵</kbd> to run</div>');
    }
    list!.innerHTML = `<div class="cmdk-term">${lines.join('')}</div>`;
    list!.scrollTop = list!.scrollHeight;
  }

  function render() {
    const q = input!.value;
    active = 0;
    if (isTerminal(q)) renderTerminal(q);
    else renderSpotlight(q);
  }

  // ----- command interpreter -----
  function corpus() {
    return entries.filter((e) => e.body || e.subtitle);
  }

  function runCommand(raw: string, preview: boolean): string {
    const parts = raw.trim().split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const arg = parts.slice(1).join(' ').trim();
    const line = (cls: string, html: string) => `<div class="cmdk-term-line ${cls}">${html}</div>`;
    const muted = (s: string) => line('cmdk-term-muted', escapeHtml(s));

    switch (cmd) {
      case 'help':
        return [
          muted('Available commands:'),
          line('', '<span class="cmdk-term-key">ls</span>            list sections & pages'),
          line('', '<span class="cmdk-term-key">cat</span> &lt;topic&gt;   print a section (e.g. cat about)'),
          line('', '<span class="cmdk-term-key">grep</span> &lt;term&gt;   search the whole site'),
          line('', '<span class="cmdk-term-key">whoami</span>        who is this'),
          line('', '<span class="cmdk-term-key">open</span> &lt;target&gt;  navigate (e.g. open work)'),
          line('', '<span class="cmdk-term-key">theme</span> [mode]   toggle / set light|dark'),
          line('', '<span class="cmdk-term-key">email</span>         copy email address'),
          line('', '<span class="cmdk-term-key">ask</span> &lt;question&gt; ask the site (AI — preview)'),
          line('', '<span class="cmdk-term-key">clear</span>         clear the screen'),
          muted('Or just start typing to search.'),
        ].join('');

      case 'whoami':
        return [
          line('', `<span class="cmdk-term-key">${escapeHtml(meta.name)}</span> — ${escapeHtml(meta.title)}`),
          muted(`📍 ${meta.location}   ✉  ${meta.email}`),
        ].join('');

      case 'ls': {
        const groups = [...new Set(entries.map((e) => e.group))];
        const want = arg.toLowerCase();
        const rows = entries
          .filter((e) => !want || e.group.toLowerCase() === want)
          .map((e) => {
            const path = e.href ?? `(action: ${e.action})`;
            return line('', `<span class="cmdk-term-key">${escapeHtml(e.title)}</span>  <span class="cmdk-term-path">${escapeHtml(path)}</span>`);
          });
        if (!rows.length) return muted(`ls: no such group: ${arg}. Try one of: ${groups.join(', ')}`);
        return rows.join('');
      }

      case 'cat': {
        if (!arg) return muted('usage: cat <topic>   e.g. cat about | cat skills | cat interests');
        const e = findEntry(arg);
        if (!e) return muted(`cat: ${arg}: no such topic. Try: ls`);
        const body = e.body || e.subtitle || '(no content)';
        return body
          .split('\n')
          .map((l) => line('', escapeHtml(l)))
          .join('') + (e.href ? muted(`→ ${e.href}`) : '');
      }

      case 'grep': {
        if (!arg) return muted('usage: grep <term>');
        // Escape regex metacharacters once: a query like `grep c++` would
        // otherwise build an invalid pattern and throw on every keystroke.
        const safe = arg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(safe, 'i');
        const hits: string[] = [];
        corpus().forEach((e) => {
          const text = `${e.title}. ${e.subtitle ?? ''} ${e.body ?? ''}`;
          text.split(/(?<=[.!?\n])\s+/).forEach((sentence) => {
            if (re.test(sentence)) {
              const hl = escapeHtml(sentence.trim()).replace(new RegExp(`(${safe})`, 'ig'), '<mark>$1</mark>');
              hits.push(line('', `<span class="cmdk-term-path">${escapeHtml(e.href ?? e.id)}:</span> ${hl}`));
            }
          });
        });
        return hits.length ? hits.slice(0, 12).join('') : muted(`grep: no matches for “${arg}”`);
      }

      case 'open': {
        const e = findEntry(arg);
        if (!e) return muted(`open: ${arg}: not found. Try: ls`);
        if (!preview) runAction(e);
        return line('', `opening <span class="cmdk-term-key">${escapeHtml(e.title)}</span> ${e.href ? `<span class="cmdk-term-path">${escapeHtml(e.href)}</span>` : ''}…`);
      }

      case 'theme': {
        const mode = arg.toLowerCase();
        const requested = mode === 'dark' || mode === 'light' ? mode : 'toggle';
        // applyTheme returns the resulting state, so we report exactly what was
        // applied (in preview we just echo the requested mode).
        const label = preview ? mode || 'toggle' : applyTheme(requested) ? 'dark' : 'light';
        return line('', `theme → <span class="cmdk-term-key">${label}</span>`);
      }

      case 'email':
        if (!preview) copyEmail();
        return line('', `<span class="cmdk-term-key">${escapeHtml(meta.email)}</span> ${preview ? '<span class="cmdk-term-muted">(↵ to copy)</span>' : '<span class="cmdk-term-muted">copied ✓</span>'}`);

      case 'ask': {
        if (!arg) return muted('usage: ask <question>   e.g. ask what did you build with TensorRT?');
        // Honest stub: real answers would route to an MCP/LLM endpoint. For
        // now we fall back to a local grep so the command still does something.
        const local = runCommand(`grep ${arg.split(/\s+/).slice(0, 3).join(' ')}`, true);
        return [
          muted('🤖 AI search is a preview — not wired to a model yet.'),
          muted('It would route to an edge function / MCP. Closest local hits:'),
          local,
        ].join('');
      }

      case 'clear':
        // Just drop the scrollback. The Enter handler clears the input and
        // calls render() next, which repaints from the (now empty) state — a
        // queued rAF wipe here would race that render and blank the palette.
        if (!preview) scrollback = [];
        return '';

      default:
        return muted(`${cmd}: command not found. Type 'help'.`);
    }
  }

  function findEntry(term: string): PaletteEntry | undefined {
    const t = term.toLowerCase();
    return (
      entries.find((e) => e.id === t || e.id === `ans-${t}` || e.title.toLowerCase() === t) ||
      entries.find((e) => e.title.toLowerCase().includes(t) || (e.keywords ?? []).some((k) => k.toLowerCase() === t)) ||
      entries.find((e) => (e.keywords ?? []).some((k) => k.toLowerCase().includes(t)))
    );
  }

  // ----- actions -----
  function copyEmail() {
    navigator.clipboard?.writeText(meta.email).catch(() => {});
  }

  function runAction(e: PaletteEntry) {
    switch (e.action) {
      case 'navigate':
        close();
        if (e.href) window.location.assign(e.href);
        break;
      case 'open-url':
        if (e.href) window.open(e.href, e.href.startsWith('mailto:') ? '_self' : '_blank', 'noopener');
        close();
        break;
      case 'copy-email':
        copyEmail();
        close();
        break;
      case 'toggle-theme':
        applyTheme('toggle');
        break;
    }
  }

  // ----- events -----
  input.addEventListener('input', render);

  input.addEventListener('keydown', (e) => {
    const terminal = isTerminal(input.value);
    // Esc is handled by the document-level listener (see below) so it works
    // even when focus isn't on the input.
    // Focus trap: the input is the only focusable control in the dialog, so
    // Tab/Shift+Tab would otherwise escape to the nav/page behind the overlay.
    if (e.key === 'Tab') {
      e.preventDefault();
      input.focus();
      return;
    }
    if (terminal) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = input.value;
        if (q.trim()) {
          const out = runCommand(q, /* preview */ false);
          const lower = q.trim().split(/\s+/)[0].toLowerCase();
          if (lower !== 'clear') {
            scrollback.push(`<div class="cmdk-term-line cmdk-term-cmd">${escapeHtml(q)}</div>${out}`);
          }
          input.value = '';
          render();
        }
      }
      return;
    }
    // Spotlight navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, visible.length - 1);
      syncActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      syncActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const e2 = visible[active];
      if (e2) runAction(e2);
    } else if (e.key === 'Home') {
      e.preventDefault();
      active = 0;
      syncActive();
    } else if (e.key === 'End') {
      e.preventDefault();
      active = visible.length - 1;
      syncActive();
    }
  });

  function syncActive() {
    const items = list!.querySelectorAll<HTMLElement>('.cmdk-item');
    items.forEach((el) => {
      const idx = Number(el.dataset.idx);
      const sel = idx === active;
      el.setAttribute('aria-selected', String(sel));
      if (sel) el.scrollIntoView({ block: 'nearest' });
    });
  }

  list.addEventListener('mousemove', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.cmdk-item');
    if (item) {
      const idx = Number(item.dataset.idx);
      if (idx !== active) {
        active = idx;
        syncActive();
      }
    }
  });

  list.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.cmdk-item');
    if (item) {
      const idx = Number(item.dataset.idx);
      const entry = visible[idx];
      if (entry) runAction(entry);
      // For actions that keep the palette open (e.g. theme toggle), the click
      // may have moved focus off the input; restore it so keyboard nav and the
      // Esc/Tab handlers keep working.
      if (!root!.hidden) input.focus();
    }
  });

  overlay?.addEventListener('click', close);

  // iOS touch-scroll guard. The CSS lock (body.cmdk-open{overflow:hidden} +
  // html:has(...)) stops wheel/keyboard scroll, but iOS Safari lets touch and
  // momentum scrolling bleed through overflow:hidden on the background. Block
  // touchmove while the palette is open, except inside the scrollable results
  // list so it can still be flicked. Non-passive so preventDefault() works.
  // (Deliberately not position:fixed — see CLAUDE.md, that broke scroll
  // position twice on iOS.)
  document.addEventListener(
    'touchmove',
    (e) => {
      if (root!.hidden) return;
      if (list && list.contains(e.target as Node)) return; // allow list scroll
      e.preventDefault();
    },
    { passive: false },
  );

  // Belt-and-suspenders focus trap: if focus escapes the open dialog (e.g. a
  // programmatic move), pull it back to the input.
  document.addEventListener('focusin', (e) => {
    if (root!.hidden) return;
    const dialog = root!.querySelector('.cmdk-dialog');
    if (dialog && !dialog.contains(e.target as Node)) input.focus();
  });

  // Global hotkeys: ⌘K / Ctrl+K toggles; "/" opens when not already typing.
  document.addEventListener('keydown', (e) => {
    // Esc closes whenever the palette is open. Handled at the document level
    // (not just on the input) so it still works after an in-palette action that
    // keeps the dialog open but moves focus off the input — e.g. clicking the
    // theme toggle, which in some engines blurs focus to <body>.
    if (e.key === 'Escape' && !root!.hidden) {
      e.preventDefault();
      close();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggle();
      return;
    }
    if (e.key === '/' && root!.hidden) {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (!typing) {
        e.preventDefault();
        open();
      }
    }
  });

  // Any element with [data-cmdk-open] (e.g. the nav button) opens the palette.
  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest('[data-cmdk-open]');
    if (trigger) {
      e.preventDefault();
      open();
    }
  });

  window.__cmdk = { open, close, toggle };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export {};
