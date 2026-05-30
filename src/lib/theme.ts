// Single source of truth for runtime theme switching. Both the nav's
// ThemeToggle button and the command palette drive the theme through here so
// the persisted value and the applied `html.dark` class can't diverge.
//
// Note: BaseLayout's pre-paint <script is:inline> deliberately does NOT import
// this — it must run before any module loads (to avoid a flash of the wrong
// theme) and inline scripts can't use imports. It only reads THEME_KEY; keep
// the key string in sync if it ever changes.

export const THEME_KEY = 'theme-preference';

export type ThemeMode = 'dark' | 'light' | 'toggle';

/**
 * Apply a theme to <html>, persist the choice, and return whether dark mode is
 * now active. `'toggle'` flips the current state; `'dark'`/`'light'` set it.
 */
export function applyTheme(mode: ThemeMode = 'toggle'): boolean {
  const root = document.documentElement;
  const isDark = mode === 'toggle' ? !root.classList.contains('dark') : mode === 'dark';
  root.classList.toggle('dark', isDark);
  try {
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  } catch {}
  return isDark;
}
