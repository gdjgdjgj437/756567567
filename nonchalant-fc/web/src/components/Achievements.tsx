import type { Order } from '../lib/types';
import { Icon, type IconName } from './icons';
import { cn } from './ui';

const defs: { id: string; name: string; hint: string; icon: IconName; from: string; to: string; test: (o: Order[]) => boolean }[] = [
  { id: 'debut', name: 'Дебют', hint: 'Отправьте первый состав', icon: 'upload', from: '#0a84ff', to: '#5ac8fa', test: (o) => o.length >= 1 },
  { id: 'rated', name: 'Оценён', hint: 'Получите оценку состава', icon: 'check', from: '#30d158', to: '#a6e34a', test: (o) => o.some((x) => x.evalStatus === 'evaluated') },
  { id: 'series', name: 'Серия', hint: 'Отправьте 3 состава', icon: 'list', from: '#bf5af2', to: '#ff6482', test: (o) => o.length >= 3 },
  { id: 'express', name: 'Экспресс', hint: 'Оплатите тариф Экспресс', icon: 'bolt', from: '#ff9f0a', to: '#ff453a', test: (o) => o.some((x) => x.plan.code === 'express' && x.paymentStatus === 'confirmed') },
  { id: 'onair', name: 'В кадре', hint: 'Попадите в видео на TikTok', icon: 'video', from: '#ff375f', to: '#ff9f0a', test: (o) => o.some((x) => x.publishStatus === 'published') },
  { id: 'elite', name: 'Элита', hint: 'Оценка 90 и выше', icon: 'trophy', from: '#ff9f0a', to: '#ffd60a', test: (o) => o.some((x) => (x.ratingScore ?? 0) >= 90) },
];

export function Achievements({ orders }: { orders: Order[] }) {
  const items = defs.map((d) => ({ ...d, got: d.test(orders) }));
  const n = items.filter((i) => i.got).length;
  return (
    <section className="mb-5" aria-label="Достижения">
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="text-[17px] font-semibold tracking-tight">Достижения</h2>
        <span className="text-[13px] tabular-nums text-mute">{n} из {items.length}</span>
      </div>
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((a, i) => (
          <div key={a.id} title={a.hint} className="animate-pop3 w-[88px] shrink-0 text-center" style={{ animationDelay: `${i * 70}ms` }}>
            <div className={cn('relative mx-auto grid size-[68px] place-items-center rounded-[22px]', a.got ? 'text-white' : 'bg-surface text-faint')}
              style={a.got ? { background: `linear-gradient(135deg, ${a.from}, ${a.to})`, boxShadow: `0 8px 20px ${a.from}55` } : undefined}>
              <Icon name={a.icon} size={28} strokeWidth={1.7} />
              {!a.got && <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-paper text-[10px] shadow-sm">🔒</span>}
            </div>
            <p className={cn('mt-2 text-[12.5px] font-semibold leading-tight', !a.got && 'text-faint')}>{a.name}</p>
            <p className="mt-0.5 text-[10.5px] leading-tight text-mute">{a.got ? 'Получено' : a.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
