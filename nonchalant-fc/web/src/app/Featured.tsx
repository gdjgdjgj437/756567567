import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { money } from '../lib/format';
import type { Order, Plan, PlanCode } from '../lib/types';
import { Button, Card, Notice, PageTitle, Surface, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { cn } from '../components/ui';
import { SquadForm } from './SquadForm';
import { PaymentPanel } from './Payment';
import { planOf, useApp } from './ctx';

const FEATURES: Record<PlanCode, string[]> = {
  free: ['Бесплатная отправка состава', 'Стандартная оценка', 'Нет гарантии попадания в видео TikTok'],
  standard: ['Гарантированное появление в видео TikTok', 'Попадает в обычную очередь на видео', 'Отслеживание статуса'],
  express: ['Гарантированное появление в видео TikTok', 'Приоритет: вне обычной очереди', 'Обработка быстрее, чем в Стандарте'],
};

function PlanCard({ plan, currency, onChoose, dark }: { plan: Plan; currency: string; onChoose?: () => void; dark?: boolean }) {
  return (
    <Card className={cn('relative overflow-hidden p-6', dark ? '!border-transparent bg-gradient-to-br from-[#0a84ff] via-[#2f6bff] to-[#7a4dff] text-white shadow-[0_16px_40px_rgb(10_132_255/0.4)]' : '!border-transparent bg-surface shadow-none')}>
      {dark && <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/20 blur-3xl" />}
      <div className="flex items-center justify-between">
        <p className={cn('text-[13px] font-semibold uppercase tracking-[0.16em]', dark ? 'text-white/75' : 'text-mute')}>{plan.name}</p>
        {plan.code === 'express' && <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"><Icon name="bolt" size={13} strokeWidth={2} />Выбор игроков</span>}
      </div>
      <p className="mt-3 text-[44px] font-bold leading-none tracking-[-0.04em]">{plan.price === 0 ? '$0' : money(plan.price, currency)}</p>
      <ul className="mt-5 space-y-3">
        {FEATURES[plan.code].map((f) => (
          <li key={f} className="flex items-start gap-3 text-[15px] leading-snug">
            <Icon name={f.startsWith('Нет ') ? 'x' : 'check'} size={18} strokeWidth={2} className={cn('mt-0.5 shrink-0', dark ? 'text-white' : f.startsWith('Нет ') ? 'text-faint' : 'text-[#0a84ff]')} />
            <span className={cn(plan.code === 'free' && f.startsWith('Нет ') && 'text-mute')}>{f}</span>
          </li>
        ))}
      </ul>
      {onChoose && <Button block variant={dark ? 'light' : 'primary'} className={cn('mt-6', dark && '!bg-white !text-[#0a6cff] shadow-[0_6px_18px_rgb(0_0_0/0.18)]')} onClick={onChoose}>Выбрать тариф</Button>}
    </Card>
  );
}

export function Featured() {
  const { config, go, upgrade, upsertOrder } = useApp();
  const toast = useToast();
  const [selected, setSelected] = useState<PlanCode | null>(null);
  const [created, setCreated] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  const plans = (['free', 'standard', 'express'] as PlanCode[]).map((c) => planOf(config, c)!).filter(Boolean);
  const sel = selected ? planOf(config, selected) : null;

  async function confirmUpgrade() {
    if (!upgrade || !selected || busy) return;
    setBusy(true);
    try { const o = await api.upgrade(upgrade.id, selected); upsertOrder(o); setCreated(o); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Не удалось улучшить заказ.', 'error'); }
    finally { setBusy(false); }
  }

  if (created) {
    return (
      <div className="animate-rise">
        <PageTitle title="Почти готово" subtitle={`Заказ ${created.code} создан и ждёт оплаты.`} />
        <PaymentPanel order={created} onUpdated={setCreated} />
        <Button block variant="ghost" className="mt-3" onClick={() => go('orders')}>Открыть в «Заказах»</Button>
      </div>
    );
  }

  if (sel && selected !== 'free') {
    return (
      <div className="animate-rise">
        <button onClick={() => setSelected(null)} className="-ml-1 mb-2 inline-flex items-center gap-1 text-[16px] text-mute active:opacity-60"><Icon name="back" size={20} />Тарифы</button>
        <PageTitle title={upgrade ? 'Подтвердите улучшение' : 'Подтвердите заказ'} />
        <Surface className="mb-6 flex items-center justify-between p-5">
          <div><p className="text-[13px] font-medium text-mute">Выбранный тариф</p><p className="text-[22px] font-semibold tracking-tight">{sel.name}</p></div>
          <p className="text-[28px] font-bold tracking-tight">{money(sel.price, config.currency)}</p>
        </Surface>
        {upgrade ? (
          <div className="space-y-4">
            <Card className="p-5"><p className="text-[13px] text-mute">Состав</p><p className="text-[17px] font-medium">{upgrade.nickname} <span className="font-mono text-[14px] text-mute">· {upgrade.code}</span></p></Card>
            <Button block loading={busy} onClick={confirmUpgrade}>Подтвердить заказ · {money(sel.price, config.currency)}</Button>
          </div>
        ) : (
          <SquadForm plan={sel.code} submitLabel={`Подтвердить заказ · ${money(sel.price, config.currency)}`} onCreated={setCreated} />
        )}
        <p className="mt-4 px-2 text-center text-[12px] leading-snug text-mute">Будет создан заказ, ожидающий оплаты. Место в видео гарантируется после подтверждения платежа.</p>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Попасть в видео" subtitle={upgrade ? `Улучшите состав ${upgrade.nickname} и гарантированно попадите в видео на TikTok.` : 'Оплатите один раз, и ваш состав гарантированно появится в видео на TikTok.'} />
      <div className="space-y-4">
        {plans.map((p, i) => (
          <div key={p.code} className="animate-rise" style={{ animationDelay: `${i * 70}ms` }}>
            <PlanCard plan={p} currency={config.currency} dark={p.code === 'express'}
              onChoose={p.code === 'free' ? undefined : () => setSelected(p.code)} />
            {p.code === 'free' && <Button block variant="secondary" className="mt-3" onClick={() => go('submit')}>Отправить бесплатно</Button>}
          </div>
        ))}
        <Notice icon="shield">Платежи проверяются нашей командой, прежде чем заказ подтверждается. Экспресс-заказы всегда идут впереди Стандарта.</Notice>
      </div>
    </div>
  );
}
