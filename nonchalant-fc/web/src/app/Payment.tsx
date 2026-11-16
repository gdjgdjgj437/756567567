import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { money } from '../lib/format';
import type { Order } from '../lib/types';
import { Button, CopyChip, Field, Input, Notice, Surface, useToast } from '../components/ui';
import { useApp } from './ctx';

/** Shows how to pay and lets the user tell us they paid. Only an admin can mark an order as paid. */
export function PaymentPanel({ order, onUpdated }: { order: Order; onUpdated: (o: Order) => void }) {
  const { config, upsertOrder } = useApp();
  const toast = useToast();
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const waiting = order.paymentStatus === 'pending' && !!order.paymentReportedAt;

  async function report() {
    if (busy) return;
    setBusy(true);
    try {
      const o = await api.reportPayment(order.id, ref.trim());
      upsertOrder(o); onUpdated(o);
      toast('Спасибо! Скоро подтвердим ваш платёж.', 'success');
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Не удалось отправить. Попробуйте ещё раз.', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Surface className="p-5">
        <div className="flex items-end justify-between">
          <div><p className="text-[13px] font-medium text-mute">Тариф «{order.plan.name}»</p><p className="text-[34px] font-bold leading-none tracking-tight">{money(order.price, order.currency)}</p></div>
          <CopyChip text={order.code} />
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-1.5 text-[13px] font-medium text-mute">Как оплатить</p>
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{config.paymentInstructions || 'Инструкция по оплате пока не задана. Свяжитесь с нами.'}</p>
          <p className="mt-3 text-[13px] text-mute">По возможности укажите номер заказа <span className="font-mono">{order.code}</span> в комментарии к платежу.</p>
        </div>
      </Surface>

      {order.paymentStatus === 'rejected' && <Notice tone="bad" icon="info">Не удалось подтвердить ваш последний платёж. Проверьте данные и отправьте их ещё раз.</Notice>}
      {waiting ? (
        <Notice tone="info" icon="clock"><strong className="font-semibold">Ждём подтверждения.</strong> Сообщим в Telegram, как только платёж будет проверен.{order.paymentReference && <> Данные платежа: <span className="font-mono">{order.paymentReference}</span></>}</Notice>
      ) : order.canReportPayment ? (
        <>
          <Field label="Данные платежа (необязательно)" hint="ID транзакции, имя отправителя или последние цифры.">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="например, TX-84F2A1" maxLength={120} />
          </Field>
          <Button block loading={busy} onClick={report}>Я оплатил</Button>
          <p className="px-2 text-center text-[12px] text-mute">Заказ подтверждается только после проверки платежа.</p>
        </>
      ) : null}
    </div>
  );
}
