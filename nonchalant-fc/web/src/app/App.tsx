import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { AppConfig, Order, User } from '../lib/types';
import { Button, PageTitle, Skeleton } from '../components/ui';
import { Icon, type IconName } from '../components/icons';
import { devUser, haptic, inTelegram, openExternal } from '../lib/tg';
import { cn } from '../components/ui';
import { Ctx, type Tab } from './ctx';
import { Home } from './Home';
import { Submit } from './Submit';
import { Featured } from './Featured';
import { Orders } from './Orders';
import { Hall } from './Hall';
import { Splash } from '../components/Splash';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'submit', label: 'Отправка', icon: 'upload' },
  { id: 'featured', label: 'В видео', icon: 'star' },
  { id: 'hall', label: 'Зал славы', icon: 'trophy' },
  { id: 'orders', label: 'Заказы', icon: 'list' },
];
const fromHash = (): Tab => (TABS.find((t) => `#/${t.id}` === location.hash)?.id ?? 'home');

export function NotInTelegram({ message }: { message?: string }) {
  const [bot, setBot] = useState('');
  useEffect(() => { api.bot().then((b) => setBot(b.botUsername)).catch(() => {}); }, []);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-8 text-center">
      <div className="mb-6 grid size-20 place-items-center rounded-full bg-surface"><Icon name="plane" size={34} strokeWidth={1.3} /></div>
      <h1 className="text-[28px] font-bold tracking-[-0.03em]">Откройте в Telegram</h1>
      <p className="mt-3 text-[16px] leading-snug text-mute">{message ?? 'NONCHALANT FC · Оценка составов работает внутри Telegram. Откройте приложение через нашего Telegram-бота, чтобы мы знали, кто вы.'}</p>
      {bot && <Button className="mt-8" onClick={() => openExternal(`https://t.me/${bot}`)}>Открыть @{bot}</Button>}
    </div>
  );
}

export function App() {
  const [boot, setBoot] = useState<{ user: User; config: AppConfig } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [tab, setTab] = useState<Tab>(fromHash);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [upgrade, setUpgrade] = useState<Order | null>(null);

  const load = useCallback(() => { setError(null); api.me().then(setBoot).catch((e) => setError(e)); }, []);
  useEffect(() => { if (inTelegram() || devUser()) load(); }, [load]);
  useEffect(() => { const h = () => setTab(fromHash()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);

  const go = useCallback((t: Tab, opts?: { upgrade?: Order }) => {
    setUpgrade(opts?.upgrade ?? null); setTab(t); history.replaceState(null, '', `#/${t}`); window.scrollTo({ top: 0 });
  }, []);
  const refreshOrders = useCallback(async () => { try { setOrders(await api.orders()); } catch { setOrders((o) => o ?? []); } }, []);
  const refreshConfig = useCallback(async () => { try { const c = await api.config(); setBoot((b) => (b ? { ...b, config: c } : b)); } catch { /* keep old */ } }, []);
  const upsertOrder = useCallback((o: Order) => setOrders((list) => (list ? [o, ...list.filter((x) => x.id !== o.id)].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) : [o])), []);

  // Keep prices fresh when the user comes back to the app.
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible' && boot) refreshConfig(); };
    document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f);
  }, [boot, refreshConfig]);
  useEffect(() => { if (boot) refreshOrders(); }, [boot, refreshOrders]);

  const ctx = useMemo(() => boot && ({ user: boot.user, config: boot.config, orders, refreshOrders, refreshConfig, upsertOrder, go, upgrade }), [boot, orders, refreshOrders, refreshConfig, upsertOrder, go, upgrade]);

  if (!inTelegram() && !devUser()) return <NotInTelegram />;
  if (error?.status === 401) return <NotInTelegram message="Не удалось проверить вашу сессию Telegram. Закройте окно и откройте приложение заново через бота." />;
  if (error) return (
    <div className="mx-auto max-w-md px-6 pt-24 text-center"><PageTitle title="Нет соединения" subtitle={error.message} /><Button onClick={load}>Повторить</Button></div>
  );
  const splash = <Splash ready={!!ctx} />;
  if (!ctx) return <>{splash}<div className="mx-auto max-w-md space-y-4 px-5 pt-16"><Skeleton className="h-12 w-3/4" /><Skeleton className="h-6 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-40 w-full" /></div></>;

  const Page = { home: Home, submit: Submit, featured: Featured, hall: Hall, orders: Orders }[tab];
  const pending = orders?.filter((o) => o.plan.code !== 'free' && o.paymentStatus === 'pending' && !o.paymentReportedAt).length ?? 0;
  return (
    <>{splash}<Ctx.Provider value={ctx}>
      <main className="pb-nav safe-t mx-auto min-h-dvh w-full max-w-lg px-5 pt-5">
        <div key={tab}><Page /></div>
      </main>
      <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/85 backdrop-blur-xl" aria-label="Главное меню">
        <div className="mx-auto grid h-[64px] max-w-lg grid-cols-5">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => { haptic('tap'); go(t.id); }} aria-current={active ? 'page' : undefined}
                className={cn('relative flex flex-col items-center justify-center gap-0.5 transition active:scale-95', active ? 'text-[#0a84ff]' : 'text-faint')}>
                <span className={cn('relative grid h-8 w-14 place-items-center rounded-full transition-all duration-300', active ? 'bg-[#0a84ff]/12 scale-100' : 'scale-95')}><Icon name={t.icon} size={24} strokeWidth={active ? 1.9 : 1.5} />
                  {t.id === 'orders' && pending > 0 && <span className="absolute right-2.5 top-1 size-2.5 rounded-full border-2 border-paper bg-warn" />}</span>
                <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </Ctx.Provider></>
  );
}
