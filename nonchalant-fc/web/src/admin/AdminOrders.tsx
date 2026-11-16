import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { date, dateTime, evalLabel, headline, money, paymentLabel } from '../lib/format';
import type { Order } from '../lib/types';
import { Button, Card, CopyChip, EmptyState, Field, Input, PageTitle, Pill, Segmented, Select, Sheet, Skeleton, Surface, Textarea, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { openExternal } from '../lib/tg';

const abs = (u: string) => new URL(u, location.origin).href;

/** Full order management sheet. Shared by Orders and Queue. */
export function AdminOrderSheet({ order, onClose, onChange, onDelete }: { order: Order | null; onClose: () => void; onChange: (o: Order) => void; onDelete: (id: string) => void }) {
  return (
    <Sheet open={!!order} onClose={onClose} title={order ? `${order.nickname}` : ''}>
      {order && <OrderEditor key={order.id} order={order} onChange={onChange} onDelete={(id) => { onDelete(id); onClose(); }} />}
    </Sheet>
  );
}

function OrderEditor({ order: o, onChange, onDelete }: { order: Order; onChange: (o: Order) => void; onDelete: (id: string) => void }) {
  const toast = useToast();
  const [evalStatus, setEval] = useState(o.evalStatus);
  const [publish, setPublish] = useState(o.publishStatus);
  const [video, setVideo] = useState(o.videoUrl ?? '');
  const [score, setScore] = useState(o.ratingScore?.toString() ?? '');
  const [note, setNote] = useState(o.ratingNote ?? '');
  const [anote, setAnote] = useState(o.adminNote ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [armDelete, setArmDelete] = useState(false);
  const [zoom, setZoom] = useState(false);
  const paid = o.plan.code !== 'free';
  const payOk = !paid || o.paymentStatus === 'confirmed';
  const pay = paymentLabel[o.paymentStatus];

  const run = async (key: string, fn: () => Promise<Order>, ok: string) => {
    if (busy) return; setBusy(key);
    try { const n = await fn(); onChange(n); setEval(n.evalStatus); setPublish(n.publishStatus); setVideo(n.videoUrl ?? ''); toast(ok, 'success'); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Что-то пошло не так.', 'error'); }
    finally { setBusy(null); }
  };
  const save = () => run('save', () => api.admin.patch(o.id, { evalStatus, publishStatus: publish, videoUrl: video.trim() || null, ratingScore: score.trim() === '' ? null : score, ratingNote: note, adminNote: anote }), 'Сохранено');

  return (
    <div className="space-y-5">
      <button onClick={() => setZoom(true)} className="relative block w-full overflow-hidden rounded-2xl bg-surface">
        <img src={o.imageUrl} alt="Скриншот состава" className="max-h-80 w-full object-contain" />
        <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur">Во весь размер</span>
      </button>
      {zoom && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/95" onClick={() => setZoom(false)}>
          <div className="flex justify-between p-4"><button className="rounded-full bg-white/15 px-4 py-2 text-[14px] text-white" onClick={(e) => { e.stopPropagation(); openExternal(abs(o.imageUrl)); }}>Открыть оригинал</button>
            <button aria-label="Закрыть" className="grid size-10 place-items-center rounded-full bg-white/15 text-white"><Icon name="x" size={18} strokeWidth={2} /></button></div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-2"><img src={o.imageUrl} alt="Скриншот состава во весь размер" className="max-h-full max-w-full object-contain" /></div>
        </div>
      )}

      <Surface className="space-y-1 p-5 text-[15px]">
        <div className="flex items-center justify-between"><span className="text-mute">Заказ</span><CopyChip text={o.code} /></div>
        <div className="flex justify-between py-1"><span className="text-mute">Никнейм</span><span className="font-medium">{o.nickname}</span></div>
        <div className="flex items-center justify-between py-1"><span className="text-mute">UID</span><CopyChip text={o.uid} /></div>
        <div className="flex justify-between py-1"><span className="text-mute">Telegram</span><span className="font-medium">{o.username ? `@${o.username}` : o.firstName || '—'} <span className="font-mono text-[13px] text-mute">{o.userId}</span></span></div>
        <div className="flex justify-between py-1"><span className="text-mute">Отправлен</span><span className="font-medium">{dateTime(o.createdAt)}</span></div>
        <div className="flex justify-between py-1"><span className="text-mute">Тариф</span><span className="font-medium">{o.plan.name}{paid && ` · ${money(o.price, o.currency)}`}</span></div>
      </Surface>

      {paid && (
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between"><p className="text-[16px] font-semibold">Платёж</p><Pill tone={pay.tone}>{pay.label}</Pill></div>
          {o.paymentReference && <p className="text-[14px] text-mute">Данные платежа: <span className="font-mono text-ink">{o.paymentReference}</span></p>}
          {o.paymentReportedAt && o.paymentStatus === 'pending' && <p className="text-[13px] text-mute">Клиент сообщил об оплате {dateTime(o.paymentReportedAt)}</p>}
          {o.paymentStatus === 'pending' && !o.paymentReportedAt && <p className="text-[13px] text-mute">Клиент ещё не сообщил об оплате.</p>}
          {o.paymentStatus !== 'confirmed' && (
            <div className="flex gap-3 pt-1">
              <Button className="flex-1" loading={busy === 'confirm'} onClick={() => run('confirm', () => api.admin.payment(o.id, 'confirm'), 'Платёж подтверждён')}>Подтвердить платёж</Button>
              {o.paymentStatus === 'pending' && <Button className="flex-1" variant="danger" loading={busy === 'reject'} onClick={() => run('reject', () => api.admin.payment(o.id, 'reject'), 'Платёж отклонён')}>Отклонить</Button>}
            </div>
          )}
        </Card>
      )}

      <div className="space-y-4">
        <Field label="Статус оценки" hint={!payOk ? 'Сначала подтвердите платёж, затем двигайте заказ дальше.' : undefined}>
          <Select value={evalStatus} onChange={(e) => setEval(e.target.value as Order['evalStatus'])}>
            {Object.entries(evalLabel).map(([v, l]) => <option key={v} value={v} disabled={!payOk && !['submitted', 'rejected'].includes(v)}>{l}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Оценка (0–100)"><Input type="number" inputMode="decimal" min={0} max={100} step="0.1" value={score} onChange={(e) => setScore(e.target.value)} placeholder="—" /></Field>
          <div className="col-span-2"><Field label="Заметка для игрока"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Показывается после оценки" maxLength={1000} /></Field></div>
        </div>
        <Field label="Статус публикации">
          <Select value={publish} onChange={(e) => setPublish(e.target.value as Order['publishStatus'])} disabled={!payOk}>
            <option value="not_published">Не опубликовано</option><option value="published">Опубликовано</option>
          </Select>
        </Field>
        <Field label="Ссылка на видео TikTok" hint="Нужна https-ссылка на tiktok.com. Обязательна для публикации.">
          <Input type="url" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://www.tiktok.com/@nonchalantfc/video/…" autoCapitalize="off" />
        </Field>
        <Field label="Личная заметка администратора"><Textarea value={anote} onChange={(e) => setAnote(e.target.value)} placeholder="Видна только администраторам" maxLength={1000} /></Field>
        <Button block loading={busy === 'save'} onClick={save}>Сохранить изменения</Button>
      </div>

      <div className="flex gap-3 border-t border-line pt-5">
        {o.evalStatus !== 'rejected' && <Button className="flex-1" variant="secondary" loading={busy === 'rej'} onClick={() => run('rej', () => api.admin.patch(o.id, { evalStatus: 'rejected' }), 'Заявка отклонена')}>Отклонить заявку</Button>}
        <Button className="flex-1" variant="danger" onClick={async () => {
          if (!armDelete) { setArmDelete(true); setTimeout(() => setArmDelete(false), 4000); return; }
          try { await api.admin.remove(o.id); toast('Удалено', 'success'); onDelete(o.id); } catch (e) { toast((e as Error).message, 'error'); }
        }}><Icon name="trash" size={18} />{armDelete ? 'Нажмите ещё раз' : 'Удалить'}</Button>
      </div>
    </div>
  );
}

export function AdminOrders() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('all');
  const [payment, setPayment] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<Order[] | null>(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const seq = useRef(0);

  const params = useCallback((offset = 0) => {
    const p: Record<string, string> = { limit: '30', offset: String(offset) };
    if (q.trim()) p.q = q.trim(); if (plan !== 'all') p.plan = plan; if (payment) p.payment = payment; if (status) p.status = status;
    return p;
  }, [q, plan, payment, status]);

  const load = useCallback(async () => {
    const my = ++seq.current;
    try { const r = await api.admin.orders(params()); if (my === seq.current) { setRows(r.orders); setTotal(r.total); } }
    catch (e) { toast((e as Error).message, 'error'); }
  }, [params, toast]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const more = async () => {
    if (!rows) return; setLoadingMore(true);
    try { const r = await api.admin.orders(params(rows.length)); setRows([...rows, ...r.orders]); } catch (e) { toast((e as Error).message, 'error'); }
    setLoadingMore(false);
  };
  const current = rows?.find((r) => r.id === open) ?? null;

  return (
    <div>
      <PageTitle title="Заказы" subtitle={rows ? `Заявок: ${total}` : 'Загрузка…'} />
      <div className="space-y-3">
        <div className="relative"><Icon name="search" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <Input className="!pl-12" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по нику, UID или номеру заказа" autoCapitalize="off" /></div>
        <Segmented value={plan} onChange={setPlan} options={[{ value: 'all', label: 'Все' }, { value: 'free', label: 'Бесплатно' }, { value: 'standard', label: 'Стандарт' }, { value: 'express', label: 'Экспресс' }]} />
        <div className="grid grid-cols-2 gap-3">
          <Select value={payment} onChange={(e) => setPayment(e.target.value)} className="!h-11 !text-[15px]"><option value="">Все платежи</option><option value="pending">Ожидают оплаты</option><option value="confirmed">Подтверждённые</option><option value="rejected">Отклонённые</option></Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!h-11 !text-[15px]"><option value="">Все статусы</option>{Object.entries(evalLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {rows === null ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />)
          : rows.length === 0 ? <EmptyState icon="search" title="Заказы не найдены" text="Попробуйте другой запрос или сбросьте фильтры." />
          : rows.map((o) => {
            const h = headline(o);
            return (
              <button key={o.id} onClick={() => setOpen(o.id)} className="block w-full text-left">
                <Card className="flex items-center gap-4 p-4 transition active:scale-[0.985] active:bg-surface">
                  <img src={o.imageUrl} alt="" loading="lazy" className="size-16 shrink-0 rounded-2xl bg-surface object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-semibold tracking-tight">{o.nickname} <span className="font-mono text-[13px] font-normal text-mute">{o.uid}</span></p>
                    <p className="mt-0.5 text-[13px] text-mute"><span className="font-mono">{o.code}</span> · {date(o.createdAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5"><Pill tone={o.plan.code === 'express' ? 'info' : 'neutral'}>{o.plan.name}</Pill><Pill tone={h.tone}>{h.label}</Pill>{o.paymentStatus === 'pending' && o.paymentReportedAt && <Pill tone="warn">Проверить оплату</Pill>}</div>
                  </div>
                </Card>
              </button>
            );
          })}
        {rows && rows.length < total && <Button block variant="secondary" loading={loadingMore} onClick={more}>Показать ещё</Button>}
      </div>
      <AdminOrderSheet order={current} onClose={() => setOpen(null)}
        onChange={(n) => setRows((r) => r?.map((x) => (x.id === n.id ? n : x)) ?? r)}
        onDelete={(id) => { setRows((r) => r?.filter((x) => x.id !== id) ?? r); setTotal((t) => t - 1); }} />
    </div>
  );
}
