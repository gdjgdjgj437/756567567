import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { User } from '../lib/types';
import { Button, PageTitle, Skeleton, cn } from '../components/ui';
import { Icon, type IconName } from '../components/icons';
import { devUser, haptic, inTelegram } from '../lib/tg';
import { NotInTelegram } from '../app/App';
import { Overview } from './Overview';
import { AdminOrders } from './AdminOrders';
import { Queue } from './Queue';
import { ThemeToggle } from '../components/ThemeToggle';
import { Pricing } from './Pricing';

type Section = 'overview' | 'orders' | 'queue' | 'pricing';
const NAV: { id: Section; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Обзор', icon: 'grid' },
  { id: 'orders', label: 'Заказы', icon: 'list' },
  { id: 'queue', label: 'Очередь', icon: 'queue' },
  { id: 'pricing', label: 'Цены', icon: 'tag' },
];

export function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [section, setSection] = useState<Section>('overview');

  useEffect(() => { document.title = 'Админка · NONCHALANT FC'; if (inTelegram() || devUser()) api.me().then((r) => setUser(r.user)).catch(setErr); }, []);

  if (!inTelegram() && !devUser()) return <NotInTelegram />;
  if (err) return err.status === 401 ? <NotInTelegram message="Не удалось проверить сессию Telegram. Откройте панель заново через бота командой /admin." />
    : <div className="mx-auto max-w-md px-6 pt-24 text-center"><PageTitle title="Нет соединения" subtitle={err.message} /></div>;
  if (!user) return <div className="mx-auto max-w-3xl space-y-4 px-5 pt-16"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>;
  if (!user.isAdmin) return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-8 text-center">
      <div className="mb-6 grid size-20 place-items-center rounded-full bg-surface"><Icon name="lock" size={32} strokeWidth={1.3} /></div>
      <h1 className="text-[26px] font-bold tracking-[-0.03em]">Нет доступа</h1>
      <p className="mt-2 text-[16px] text-mute">Этот раздел только для администраторов.</p>
      <a href="/"><Button className="mt-8" variant="secondary">Назад в приложение</Button></a>
    </div>
  );

  const View = { overview: Overview, orders: AdminOrders, queue: Queue, pricing: Pricing }[section];
  return (
    <>
      <main className="pb-nav safe-t mx-auto min-h-dvh w-full max-w-3xl px-5 pt-5">
        <div className="mb-1 flex items-center justify-between pt-3">
          <p className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.18em] text-mute">Админка</p>
          <span className="flex items-center gap-3"><a href="/" className="whitespace-nowrap text-[14px] font-medium text-mute">Приложение</a><ThemeToggle /></span>
        </div>
        <div key={section}><View /></div>
      </main>
      <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/85 backdrop-blur-xl" aria-label="Админка">
        <div className="mx-auto grid h-[64px] max-w-3xl grid-cols-4">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => { haptic('tap'); setSection(n.id); window.scrollTo({ top: 0 }); }} aria-current={section === n.id ? 'page' : undefined}
              className={cn('flex flex-col items-center justify-center gap-1 transition active:scale-95', section === n.id ? 'text-[#0a84ff]' : 'text-faint')}>
              <Icon name={n.icon} size={24} strokeWidth={section === n.id ? 1.9 : 1.5} />
              <span className="text-[10.5px] font-medium tracking-wide">{n.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
