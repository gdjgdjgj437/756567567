/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { Telegram?: { WebApp?: any } } }

export const tg = (): any => window.Telegram?.WebApp;
export const initData = (): string => tg()?.initData || '';
export const inTelegram = (): boolean => Boolean(initData());

/** Local development only (server must run with DEV_AUTH_BYPASS=1): open /?dev=<telegramId> in a normal browser. */
export function devUser(): { id: number; first_name: string } | null {
  try {
    const q = new URLSearchParams(location.search).get('dev');
    const v = q ?? sessionStorage.getItem('nc_dev');
    if (!v || !/^\d+$/.test(v)) return null;
    sessionStorage.setItem('nc_dev', v);
    return { id: Number(v), first_name: 'Dev' };
  } catch { return null; }
}

export function initTelegram() {
  const w = tg();
  if (!w) return;
  try { w.ready(); w.expand(); } catch { /* ignore */ }
  try { w.disableVerticalSwipes?.(); } catch { /* ignore */ }
}

export function haptic(kind: 'tap' | 'success' | 'error' = 'tap') {
  try {
    const h = tg()?.HapticFeedback;
    if (!h) return;
    if (kind === 'tap') h.impactOccurred('light'); else h.notificationOccurred(kind);
  } catch { /* ignore */ }
}

export function openExternal(url: string) {
  const w = tg();
  if (/^https:\/\/(t\.me|telegram\.me)\//.test(url) && w?.openTelegramLink) return w.openTelegramLink(url);
  if (w?.openLink) return w.openLink(url);
  window.open(url, '_blank', 'noopener,noreferrer');
}
