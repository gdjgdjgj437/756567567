import { tg } from './tg';

export type Theme = 'light' | 'dark';
const KEY = 'nc_theme';

export function getTheme(): Theme {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } // по умолчанию белая
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  const bg = t === 'dark' ? '#000000' : '#ffffff';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', t);
  const w = tg();
  if (w) for (const fn of ['setHeaderColor', 'setBackgroundColor', 'setBottomBarColor']) { try { w[fn]?.(bg); } catch { /* older clients */ } }
}

export function saveTheme(t: Theme) {
  try { localStorage.setItem(KEY, t); } catch { /* storage blocked */ }
  applyTheme(t);
}
