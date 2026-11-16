import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { money } from '../lib/format';
import type { Overview as O } from '../lib/types';
import { Card, PageTitle, Skeleton, Surface, useToast } from '../components/ui';

function Stat({ label, value, sub, wide }: { label: string; value: string | number; sub?: string; wide?: boolean }) {
  return (
    <Card className={`p-5 ${wide ? 'col-span-2' : ''}`}>
      <p className="text-[13px] font-medium text-mute">{label}</p>
      <p className="mt-2 text-[34px] font-bold leading-none tracking-[-0.03em]">{value}</p>
      {sub && <p className="mt-2 text-[13px] text-mute">{sub}</p>}
    </Card>
  );
}

export function Overview() {
  const [o, setO] = useState<O | null>(null);
  const toast = useToast();
  useEffect(() => { api.admin.overview().then(setO).catch((e) => toast(e.message, 'error')); }, [toast]);
  return (
    <div>
      <PageTitle title="Обзор" subtitle="Как идут дела прямо сейчас." />
      {!o ? <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[104px]" />)}</div> : (
        <div className="grid animate-rise grid-cols-2 gap-3">
          <Card className="col-span-2 border-ink bg-ink p-6 text-on-ink">
            <p className="text-[13px] font-medium text-on-ink/60">Выручка (подтверждённые платежи)</p>
            {o.revenue.length === 0 ? <p className="mt-2 text-[40px] font-bold leading-none tracking-[-0.03em]">0</p>
              : o.revenue.map((r) => <p key={r.currency} className="mt-2 text-[40px] font-bold leading-none tracking-[-0.03em]">{money(r.total, r.currency)}</p>)}
            <p className="mt-3 text-[13px] text-on-ink/60">Стандарт: {o.standardPaid} · Экспресс: {o.expressPaid}</p>
          </Card>
          <Stat label="Всего заявок" value={o.totalSubmissions} />
          <Stat label="Бесплатные заявки" value={o.freeSubmissions} />
          <Stat label="Платные заказы" value={o.paidOrders} sub="Платёж подтверждён" />
          <Stat label="Ожидают оплаты" value={o.pendingPayments} sub="Нужна ваша проверка" />
          <Stat label="Ждут оценки" value={o.awaitingEvaluation} />
          <Stat label="Опубликованные видео" value={o.published} />
          {o.pendingPayments > 0 && <Surface className="col-span-2 p-4 text-center text-[14px] text-mute">Платежей на проверке: {o.pendingPayments}. Откройте «Заказы» и отфильтруйте по ожидающим.</Surface>}
        </div>
      )}
    </div>
  );
}
