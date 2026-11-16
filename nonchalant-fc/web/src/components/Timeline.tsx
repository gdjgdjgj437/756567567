import type { Order } from '../lib/types';
import { Icon } from './icons';
import { cn } from './ui';

/** Сколько шагов пути заказа уже пройдено и какие шаги есть у этого тарифа. */
export function stages(o: Order): { steps: string[]; done: number } | null {
  if (o.evalStatus === 'rejected') return null;
  const paid = o.plan.code !== 'free';
  if (!paid) {
    const steps = ['Отправлено', 'В очереди', 'Оценка', 'Оценено'];
    return { steps, done: o.evalStatus === 'evaluated' ? 4 : o.evalStatus === 'being_evaluated' ? 2 : 1 };
  }
  const steps = ['Отправлено', 'Оплата', 'В очереди', 'Оценка', 'Оценено', 'В видео'];
  let done = 1;
  if (o.paymentStatus === 'confirmed') done = 2;
  if (o.evalStatus === 'being_evaluated') done = 3;
  if (o.evalStatus === 'evaluated') done = 5;
  if (o.publishStatus === 'published') done = 6;
  return { steps, done };
}

export function Timeline({ order }: { order: Order }) {
  const s = stages(order);
  if (!s) return null;
  const { steps, done } = s;
  const n = steps.length;
  return (
    <div className="rounded-card bg-surface px-3 pb-4 pt-5" role="list" aria-label="Путь заказа">
      <div className="relative">
        {/* линия: фон и заполнение */}
        <div className="absolute top-[11px] h-[3px] rounded-full bg-tint-2" style={{ left: `${50 / n}%`, right: `${50 / n}%` }} />
        <div className="absolute top-[11px] h-[3px] origin-left rounded-full bg-[#0a84ff] transition-[width] duration-[1200ms] ease-out"
          style={{ left: `${50 / n}%`, width: `${(100 - 100 / n) * Math.min(1, Math.max(0, (done - 1) / (n - 1)))}%`, boxShadow: '0 0 8px rgb(10 132 255 / 0.6)' }} />
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {steps.map((t, i) => {
            const isDone = i < done, current = i === done;
            return (
              <div key={t} role="listitem" aria-current={current ? 'step' : undefined} className="flex flex-col items-center text-center">
                <span className={cn('grid size-6 place-items-center rounded-full border-2 transition-colors duration-500',
                  isDone ? 'border-[#0a84ff] bg-[#0a84ff] text-white' : current ? 'animate-glow border-[#0a84ff] bg-paper' : 'border-tint-2 bg-paper')}>
                  {isDone && <Icon name="check" size={13} strokeWidth={3} />}
                  {current && <span className="size-2 rounded-full bg-[#0a84ff]" />}
                </span>
                <span className={cn('mt-2 px-0.5 text-[10.5px] leading-tight', isDone || current ? 'font-semibold text-ink' : 'text-faint')}>{t}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
