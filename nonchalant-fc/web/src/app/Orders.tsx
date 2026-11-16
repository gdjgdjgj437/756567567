import { useEffect, useState } from 'react';
import { date, dateTime, evalLabel, headline, money, paymentLabel } from '../lib/format';
import type { Order } from '../lib/types';
import { fireConfetti, firstCelebration } from '../components/Confetti';
import { Achievements } from '../components/Achievements';
import { Timeline } from '../components/Timeline';
import { ScoreRing } from '../components/ScoreRing';
import { Button, Card, CopyChip, EmptyState, PageTitle, Pill, Sheet, Skeleton, Surface } from '../components/ui';
import { Icon } from '../components/icons';
import { haptic, openExternal } from '../lib/tg';
import { PaymentPanel } from './Payment';
import { useApp } from './ctx';

function OrderCard({ o, onOpen, i }: { o: Order; onOpen: () => void; i: number }) {
  const h = headline(o);
  return (
    <button onClick={onOpen} className="animate-rise block w-full text-left" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <Card className="flex items-center gap-4 p-4 transition active:scale-[0.985] active:bg-surface">
        <img src={o.imageUrl} alt="" loading="lazy" className="size-16 shrink-0 rounded-2xl bg-surface object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[17px] font-semibold tracking-tight">{o.nickname}</p>
            <Icon name="chevron" size={16} className="shrink-0 text-faint" />
          </div>
          <p className="mt-0.5 text-[13px] text-mute"><span className="font-mono">{o.code}</span> · {date(o.createdAt)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5"><Pill>{o.plan.name}</Pill><Pill tone={h.tone}>{h.label}</Pill></div>
        </div>
      </Card>
    </button>
  );
}

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-3"><span className="text-[15px] text-mute">{k}</span><span className="text-right text-[15px] font-medium">{children}</span></div>
);

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const { orders, go } = useApp();
  const o = orders?.find((x) => x.id === id);
  const [, force] = useState(0);
  const celebrate = !!o && o.publishStatus === 'published' && !!o.videoUrl;
  useEffect(() => { if (celebrate && firstCelebration(id)) { const t = setTimeout(() => { haptic('success'); fireConfetti(); }, 450); return () => clearTimeout(t); } }, [celebrate, id]);
  if (!o) return null;
  const pay = paymentLabel[o.paymentStatus];
  const paid = o.plan.code !== 'free';
  const h = headline(o);
  return (
    <div className="space-y-5">
      <img src={o.imageUrl} alt="Скриншот вашего состава" className="max-h-72 w-full rounded-2xl bg-surface object-contain" />
      <Timeline order={o} />
      <div className="flex items-center justify-between"><Pill tone={h.tone} className="!text-[14px] !px-3 !py-1.5">{h.label}</Pill><CopyChip text={o.code} /></div>

      {o.publishStatus === 'published' && o.videoUrl && (
        <Button block onClick={() => openExternal(o.videoUrl!)}><Icon name="video" size={20} />Смотреть в TikTok</Button>
      )}
      {o.evalStatus === 'evaluated' || o.publishStatus === 'published' ? (o.ratingScore != null || o.ratingNote) && (
        <Surface className="p-5">
          <p className="text-[13px] font-medium text-mute">Оценка вашего состава</p>
          {o.ratingScore != null && <ScoreRing score={o.ratingScore} />}
          {o.ratingNote && <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug">{o.ratingNote}</p>}
        </Surface>
      ) : null}
      {o.queuePosition != null && <Surface className="flex items-center gap-3 p-4"><Icon name="clock" size={22} className="text-mute" /><p className="text-[15px]">Вы <strong className="font-semibold">№{o.queuePosition}</strong> в очереди {paid ? 'на видео' : 'на оценку'}.</p></Surface>}

      {paid && o.paymentStatus !== 'confirmed' && o.canReportPayment && <PaymentPanel order={o} onUpdated={() => force((n) => n + 1)} />}

      <div className="divide-y divide-line rounded-card border border-line px-5">
        <Row k="Номер заказа"><span className="font-mono">{o.code}</span></Row>
        <Row k="Отправлен">{dateTime(o.createdAt)}</Row>
        <Row k="Состав">{o.nickname}</Row>
        <Row k="UID"><span className="font-mono">{o.uid}</span></Row>
        <Row k="Тариф">{o.plan.name}{paid && <span className="text-mute"> · {money(o.price, o.currency)}</span>}</Row>
        <Row k="Оплата"><Pill tone={pay.tone}>{pay.label}</Pill></Row>
        <Row k="Оценка"><Pill tone={o.evalStatus === 'rejected' ? 'bad' : o.evalStatus === 'evaluated' ? 'ok' : 'neutral'}>{evalLabel[o.evalStatus]}</Pill></Row>
        <Row k="Видео в TikTok">{o.publishStatus === 'published' ? <Pill tone="ok">Опубликовано</Pill> : <Pill>{paid ? 'Ещё не опубликовано' : 'Не гарантировано'}</Pill>}</Row>
      </div>

      {o.canUpgrade && (
        <Surface className="p-5">
          <p className="text-[16px] font-semibold">Хотите, чтобы этот состав попал в видео на TikTok?</p>
          <p className="mt-1 text-[14px] text-mute">Перейдите на Стандарт или Экспресс, чтобы гарантированно попасть в видео.</p>
          <Button block variant="secondary" className="mt-4" onClick={() => { onClose(); go('featured', { upgrade: o }); }}>Улучшить заказ</Button>
        </Surface>
      )}
    </div>
  );
}

export function Orders() {
  const { orders, refreshOrders, go } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);

  useEffect(() => {
    refreshOrders();
    const t = setInterval(() => { if (document.visibilityState === 'visible') refreshOrders(); }, 30000);
    return () => clearInterval(t);
  }, [refreshOrders]);

  return (
    <div>
      <div className="flex items-start justify-between">
        <PageTitle title="Мои заказы" subtitle="Всё, что вы отправили, и статусы заказов." />
        <button aria-label="Обновить" className="mt-2 grid size-10 shrink-0 place-items-center rounded-full bg-surface text-mute active:bg-surface-2"
          onClick={async () => { setSpin(true); await refreshOrders(); setSpin(false); }}><Icon name="refresh" size={19} className={spin ? 'animate-spin' : ''} /></button>
      </div>
      {orders && orders.length > 0 && <Achievements orders={orders} />}
      {orders === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[96px]" />)}</div>
      ) : orders.length === 0 ? (
        <EmptyState icon="list" title="Заказов пока нет" text="Отправьте первый состав на бесплатную оценку. Это займёт минуту." action={<Button onClick={() => go('submit')}>Отправить состав</Button>} />
      ) : (
        <div className="space-y-3">{orders.map((o, i) => <OrderCard key={o.id} o={o} i={i} onOpen={() => setOpen(o.id)} />)}</div>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title="Детали заказа">{open && <Detail id={open} onClose={() => setOpen(null)} />}</Sheet>
    </div>
  );
}
