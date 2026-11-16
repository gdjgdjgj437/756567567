import type { Order } from './types';

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info';

export function money(amount: number, currency: string): string {
  try {
    if (/^[A-Z]{3}$/.test(currency)) return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
  } catch { /* not an ISO code (e.g. USDT) */ }
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2)} ${currency}`;
}

export const date = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
export const dateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Один главный статус заказа. */
export function headline(o: Order): { label: string; tone: Tone } {
  if (o.evalStatus === 'rejected') return { label: 'Отклонено', tone: 'bad' };
  if (o.publishStatus === 'published') return { label: 'Опубликовано', tone: 'ok' };
  if (o.evalStatus === 'evaluated') return { label: 'Оценено', tone: 'ok' };
  if (o.evalStatus === 'being_evaluated') return { label: 'Оценивается', tone: 'info' };
  if (o.plan.code !== 'free') {
    if (o.paymentStatus === 'pending') return { label: 'Ожидает оплаты', tone: 'warn' };
    if (o.paymentStatus === 'rejected') return { label: 'Платёж отклонён', tone: 'bad' };
  }
  if (o.evalStatus === 'in_queue') return { label: 'В очереди', tone: 'info' };
  return { label: 'Отправлено', tone: 'neutral' };
}

export const paymentLabel: Record<string, { label: string; tone: Tone }> = {
  not_required: { label: 'Оплата не нужна', tone: 'neutral' },
  pending: { label: 'Ожидает оплаты', tone: 'warn' },
  confirmed: { label: 'Платёж подтверждён', tone: 'ok' },
  rejected: { label: 'Платёж отклонён', tone: 'bad' },
};
export const evalLabel: Record<string, string> = {
  submitted: 'Отправлено', in_queue: 'В очереди', being_evaluated: 'Оценивается', evaluated: 'Оценено', rejected: 'Отклонено',
};

export const uuid = (): string =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto) ? globalThis.crypto.randomUUID()
    : 'k' + Math.random().toString(36).slice(2) + Date.now().toString(36);
