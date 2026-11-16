import { money } from '../lib/format';
import { Button, Card, Notice, Surface } from '../components/ui';
import { Icon } from '../components/icons';
import logo from '../assets/logo.png';
import { Ticker } from '../components/Ticker';
import type { HallEntry } from '../lib/types';
import { Reveal } from '../components/Reveal';
import { ThemeToggle } from '../components/ThemeToggle';
import { planOf, useApp } from './ctx';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useCountUp } from '../components/ScoreRing';

const steps = [
  ['Загрузите скриншот состава FC Mobile.', 'Чёткий снимок всего стартового состава.'],
  ['Укажите данные игрока.', 'Только никнейм и UID, больше ничего.'],
  ['Получите оценку состава.', 'Мы оценим его и сообщим прямо здесь, в Telegram.'],
];

export function Home() {
  const { go, config, user } = useApp();
  const [stats, setStats] = useState<{ evaluated: number; published: number } | null>(null);
  const [top, setTop] = useState<HallEntry[]>([]);
  useEffect(() => { api.hall().then((h) => { setStats(h.stats); setTop(h.entries.slice(0, 8)); }).catch(() => {}); }, []);
  const evaluated = useCountUp(stats?.evaluated ?? 0);
  const published = useCountUp(stats?.published ?? 0);
  const std = planOf(config, 'standard'); const exp = planOf(config, 'express');
  const from = std && exp ? money(Math.min(std.price, exp.price), config.currency) : null;
  return (
    <div className="space-y-10 pt-4">
      <section className="animate-rise relative pt-4">
        <div aria-hidden className="pointer-events-none absolute -inset-x-5 -top-24 -z-10 h-[460px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_45%,transparent)]">
          <div className="animate-float absolute -left-16 top-8 size-72 rounded-full bg-[#0a84ff] opacity-[0.16] blur-3xl" />
          <div className="animate-float2 absolute -right-20 top-24 size-72 rounded-full bg-[#bf5af2] opacity-[0.14] blur-3xl" />
          <div className="animate-float absolute left-24 top-56 size-56 rounded-full bg-[#5ac8fa] opacity-[0.12] blur-3xl" />
        </div>
        <div className="mb-5 flex items-center justify-between"><img src={logo} alt="NXI" draggable={false} className="logo-img h-[60px] w-auto" /><ThemeToggle /></div>
        <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.03em]">Оцени свой <span className="bg-gradient-to-r from-[#0a84ff] to-[#bf5af2] bg-clip-text text-transparent">состав</span></h1>
        <p className="mt-3 max-w-sm text-[16px] leading-snug text-mute">Отправьте состав FC Mobile и узнайте, чего на самом деле стоит ваша команда.</p>
        <div className="mt-4 flex flex-wrap gap-2">{['Бесплатно', 'За минуту', 'Ответ в Telegram'].map((t) => <span key={t} className="rounded-full bg-surface px-3 py-1.5 text-[12.5px] font-medium text-mute">{t}</span>)}</div>
        <Button block className="mt-7" onClick={() => go('submit')}>Отправить состав <Icon name="chevron" size={18} strokeWidth={2} /></Button>
      </section>

      {stats && stats.evaluated > 0 && (
        <div className="animate-rise grid grid-cols-2 gap-3">
          {[[evaluated, "составов оценено"], [published, "попало в видео"]].map(([n, l]) => (
            <button key={String(l)} onClick={() => go('hall')} className="rounded-[26px] bg-surface p-5 text-left transition active:scale-[0.97]">
              <span className="animate-glow block size-2.5 rounded-full bg-[#0a84ff]" />
              <span className="mt-4 block text-[40px] font-semibold leading-none tabular-nums tracking-[-0.045em]">{n}</span>
              <span className="mt-1.5 block text-[13px] text-mute">{l}</span>
            </button>
          ))}
        </div>
      )}

      {top.length > 1 && <Ticker entries={top} />}

      <Reveal as="section" className="space-y-3">
        <h2 className="px-1 text-[22px] font-semibold tracking-tight">Как это работает</h2>
        <Surface className="divide-y divide-line">
          {steps.map(([t, s], i) => (
            <div key={t} className="flex items-start gap-4 px-5 py-4">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#3aa0ff] to-[#0a7aff] text-[14px] font-semibold text-white shadow-[0_4px_12px_rgb(10_132_255/0.4)]">{i + 1}</span>
              <div><p className="text-[16px] font-medium leading-snug">{t}</p><p className="mt-0.5 text-[14px] text-mute">{s}</p></div>
            </div>
          ))}
        </Surface>
      </Reveal>

      <Reveal as="section" className="space-y-3">
        <div className="px-1">
          <h2 className="text-[22px] font-semibold tracking-tight">Сравнение планов</h2>
          <p className="mt-1 text-[14px] leading-snug text-mute">Оценку вы получаете в любом случае. Разница в том, увидят ли ваш состав зрители TikTok.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: 'star' as const, name: 'Бесплатно', tag: 'Для старта', rows: [[true, 'Оценка состава'], [true, 'Обычная очередь'], [false, 'Видео в TikTok']] },
            { icon: 'video' as const, name: 'Видео в TikTok', tag: 'Круче', rows: [[true, 'Оценка состава'], [true, 'Вне очереди (Экспресс)'], [true, 'Видео гарантировано']] },
          ].map((p) => (
            <Card key={p.name} className="relative !border-transparent bg-surface p-5 shadow-none">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-full bg-info-bg text-info"><Icon name={p.icon} size={20} /></span>
                <span className="rounded-full bg-info-bg px-2.5 py-1 text-[11px] font-semibold text-info">{p.tag}</span>
              </div>
              <p className="mt-4 text-[17px] font-semibold leading-tight">{p.name}</p>
              <ul className="mt-3 space-y-2">
                {p.rows.map(([ok, t]) => (
                  <li key={String(t)} className={`flex items-start gap-2 text-[13.5px] leading-snug ${ok ? '' : 'text-faint'}`}>
                    <Icon name={ok ? 'check' : 'x'} size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${ok ? 'text-info' : 'text-faint'}`} />{t}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <Surface className="p-5">
          <p className="text-[15px] font-semibold">Что выбрать?</p>
          <p className="mt-1 text-[14px] leading-relaxed text-mute">Хотите просто узнать, насколько силён ваш состав, берите бесплатный план. Хотите, чтобы его увидели зрители, и без ожидания, берите видео в TikTok: <strong className="font-semibold text-ink">Экспресс</strong> разбирают первым, <strong className="font-semibold text-ink">Стандарт</strong> идёт в общей очереди платных заказов.</p>
        </Surface>
        <Notice icon="info" tone="warn"><strong className="font-semibold">Бесплатная отправка состава НЕ гарантирует, что он появится в видео на TikTok.</strong></Notice>
      </Reveal>

      <Reveal as="section" className="space-y-3">
        <h2 className="px-1 text-[22px] font-semibold tracking-tight">Как работают платные тарифы</h2>
        <Surface className="space-y-4 p-5">
          {[
            ['Выберите тариф', 'Стандарт попадает в обычную очередь на видео, Экспресс идёт вне очереди.'],
            ['Оплатите и отправьте данные платежа', 'Следуйте инструкции по оплате, затем сообщите нам, что оплатили.'],
            ['Мы подтверждаем платёж', 'Заказ подтверждается только после проверки. Вы получите сообщение в Telegram.'],
            ['Смотрите себя в TikTok', 'Мы оценим ваш состав в видео и добавим ссылку во вкладку «Заказы».'],
          ].map(([t, s]) => (
            <div key={t} className="flex gap-3"><Icon name="check" size={20} className="mt-0.5 shrink-0 text-ink" strokeWidth={2} /><p className="text-[15px] leading-snug"><span className="font-medium">{t}.</span> <span className="text-mute">{s}</span></p></div>
          ))}
          <Button block variant="secondary" onClick={() => go('featured')}>{from ? `Попасть в видео · от ${from}` : 'Попасть в видео'}</Button>
        </Surface>
      </Reveal>

      {user.isAdmin && (
        <a href="/admin" className="flex items-center justify-between rounded-2xl border border-line px-5 py-4 text-[16px] font-medium active:bg-surface">
          <span className="flex items-center gap-3"><Icon name="shield" size={22} />Панель администратора</span><Icon name="chevron" size={18} className="text-faint" />
        </a>
      )}
      <p className="pb-2 text-center text-[12px] text-faint">NONCHALANT FC · Не связано с EA SPORTS и Telegram.</p>
    </div>
  );
}
