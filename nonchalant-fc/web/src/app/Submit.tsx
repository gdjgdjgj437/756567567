import { useState } from 'react';
import type { Order } from '../lib/types';
import { Button, CopyChip, PageTitle, Surface } from '../components/ui';
import { Icon } from '../components/icons';
import { SquadForm } from './SquadForm';
import { useApp } from './ctx';

export function Submit() {
  const { go } = useApp();
  const [done, setDone] = useState<Order | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (done) {
    return (
      <div className="animate-rise flex flex-col items-center pt-10 text-center">
        <div className="relative grid size-24 place-items-center">
          <span aria-hidden className="animate-ring absolute inset-0 rounded-full bg-[#0a84ff]/30" />
          <span aria-hidden className="animate-ring absolute inset-0 rounded-full bg-[#0a84ff]/20" style={{ animationDelay: '0.35s' }} />
          <div className="animate-pop3 relative grid size-20 place-items-center rounded-full bg-gradient-to-br from-[#0a84ff] to-[#5ac8fa] text-white shadow-[0_8px_24px_rgb(10_132_255/0.45)]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path className="animate-draw" d="M5.5 12.8l4.2 4.2L18.5 8" pathLength="1" /></svg>
          </div>
        </div>
        <h1 className="mt-6 text-[30px] font-bold tracking-[-0.03em]">Состав отправлен</h1>
        <p className="mt-2 max-w-xs text-[16px] text-mute">Мы получили ваш состав, <strong className="font-medium text-ink">{done.nickname}</strong>. Напишем вам здесь, в Telegram, когда оценка будет готова.</p>
        <div className="mt-8"><p className="mb-2 text-[13px] font-medium text-mute">Номер заказа</p><CopyChip text={done.code} /></div>
        <Surface className="mt-8 w-full p-5 text-left">
          <p className="text-[15px] font-semibold">Хотите, чтобы ваш состав попал в видео на TikTok?</p>
          <p className="mt-1 text-[14px] leading-snug text-mute">Бесплатным заявкам попадание в видео не гарантируется. Улучшите заказ до Стандарта или Экспресса, чтобы закрепить своё место.</p>
          <Button className="mt-4" block variant="secondary" onClick={() => go('featured', { upgrade: done })}>Посмотреть платные тарифы</Button>
        </Surface>
        <div className="mt-3 flex w-full gap-3">
          <Button className="flex-1" variant="ghost" onClick={() => { setDone(null); setFormKey((k) => k + 1); }}>Отправить ещё</Button>
          <Button className="flex-1" onClick={() => go('orders')}>Мои заказы</Button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <PageTitle title="Отправить состав" subtitle="Расскажите, кто вы, и покажите свой состав." />
      <div className="animate-rise" style={{ animationDelay: '60ms' }}>
        <SquadForm key={formKey} plan="free" submitLabel="Отправить на бесплатную оценку" onCreated={setDone} />
        <p className="mt-4 px-2 text-center text-[13px] leading-snug text-mute">
          Бесплатная отправка не гарантирует попадание в видео на TikTok. Хотите попасть в видео?{' '}
          <button className="font-medium text-ink underline underline-offset-2" onClick={() => go('featured')}>Посмотрите платные тарифы.</button>
        </p>
      </div>
    </div>
  );
}
