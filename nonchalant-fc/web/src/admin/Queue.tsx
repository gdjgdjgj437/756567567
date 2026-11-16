import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { date } from '../lib/format';
import type { Order } from '../lib/types';
import { Card, EmptyState, PageTitle, Pill, Skeleton, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { AdminOrderSheet } from './AdminOrders';

export function Queue() {
  const toast = useToast();
  const [queue, setQueue] = useState<Order[] | null>(null);
  const [progress, setProgress] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await api.admin.queue(); setQueue(r.queue); setProgress(r.inProgress); } catch (e) { toast((e as Error).message, 'error'); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  async function move(o: Order, position: number) {
    if (busy || !queue) return; setBusy(true);
    const prev = queue;
    const next = [...queue]; next.splice(queue.indexOf(o), 1); next.splice(position, 0, o); setQueue(next); // optimistic
    try { const r = await api.admin.move(o.id, position); setQueue(r.queue); setProgress(r.inProgress); }
    catch (e) { setQueue(prev); toast((e as Error).message, 'error'); }
    setBusy(false);
  }
  const current = [...(queue ?? []), ...progress].find((o) => o.id === open) ?? null;
  const tone = (o: Order) => (o.plan.code === 'express' ? 'info' : 'neutral') as 'info' | 'neutral';

  return (
    <div>
      <PageTitle title="Очередь" subtitle="Сначала Экспресс, затем Стандарт, затем бесплатные. Порядок можно менять вручную." />
      {progress.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="px-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-mute">В работе</p>
          {progress.map((o) => (
            <button key={o.id} onClick={() => setOpen(o.id)} className="block w-full text-left"><Card className="flex items-center gap-3 border-info/30 bg-info-bg/40 p-4"><Icon name="clock" size={20} className="text-info" />
              <span className="min-w-0 flex-1 truncate font-semibold">{o.nickname}</span><Pill tone={tone(o)}>{o.plan.name}</Pill></Card></button>
          ))}
        </div>
      )}
      <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-mute">Ожидают{queue ? ` · ${queue.length}` : ''}</p>
      <div className="space-y-2">
        {queue === null ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[76px]" />)
          : queue.length === 0 ? <EmptyState icon="queue" title="Очередь пуста" text="Новые заявки и подтверждённые платежи появятся здесь." />
          : queue.map((o, i) => (
            <Card key={o.id} className="flex items-center gap-3 p-3 pl-4">
              <span className="w-6 shrink-0 text-center text-[15px] font-semibold tabular-nums text-mute">{i + 1}</span>
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(o.id)}>
                <p className="truncate text-[16px] font-semibold tracking-tight">{o.nickname}</p>
                <div className="mt-1 flex flex-col items-start gap-1 text-[12px] text-mute"><Pill tone={tone(o)}>{o.plan.name}</Pill><span className="whitespace-nowrap"><span className="font-mono">{o.code}</span> · {date(o.createdAt)}</span></div>
              </button>
              <div className="flex shrink-0 gap-1">
                {[
                  { label: 'В начало', icon: 'toTop', to: 0, off: i === 0 },
                  { label: 'Выше', icon: 'arrowUp', to: i - 1, off: i === 0 },
                  { label: 'Ниже', icon: 'arrowDown', to: i + 1, off: i === queue.length - 1 },
                ].map((b) => (
                  <button key={b.label} aria-label={b.label} disabled={b.off || busy} onClick={() => move(o, b.to)}
                    className="grid size-9 place-items-center rounded-full bg-surface text-ink transition active:scale-90 active:bg-surface-2 disabled:opacity-25"><Icon name={b.icon as 'toTop'} size={18} /></button>
                ))}
              </div>
            </Card>
          ))}
      </div>
      <AdminOrderSheet order={current} onClose={() => setOpen(null)} onChange={() => load()} onDelete={() => load()} />
    </div>
  );
}
