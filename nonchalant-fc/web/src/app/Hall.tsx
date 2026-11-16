import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { Hall as HallData, HallEntry } from '../lib/types';
import { EmptyState, PageTitle, Skeleton, cn } from '../components/ui';
import { Icon } from '../components/icons';
import { tierColors, tierOf } from '../components/ScoreRing';
import { haptic, openExternal } from '../lib/tg';

const open = (e: HallEntry) => { if (e.videoUrl) { haptic('tap'); openExternal(e.videoUrl); } };

function Hero({ e }: { e: HallEntry }) {
  const [a, b] = tierColors(e.ratingScore);
  const el = useRef<HTMLButtonElement>(null);
  const tilt = (ev: React.PointerEvent) => {
    const n = el.current; if (!n) return;
    const r = n.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
    n.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale(0.985)`;
  };
  const reset = () => { if (el.current) el.current.style.transform = ''; };
  return (
    <button ref={el} onClick={() => open(e)} onPointerMove={tilt} onPointerLeave={reset} onPointerUp={reset} onPointerCancel={reset} aria-label={`1 место: ${e.nickname}, ${e.ratingScore}`}
      className="animate-rise relative block w-full touch-pan-y overflow-hidden rounded-[30px] bg-[#1d1d1f] p-6 text-left text-white shadow-pop ring-1 ring-white/10 transition-transform duration-200 ease-out">
      <div aria-hidden className="absolute -right-16 -top-20 size-64 rounded-full opacity-60 blur-3xl" style={{ background: `radial-gradient(circle, ${a}, transparent 70%)` }} />
      <div aria-hidden className="absolute -bottom-24 -left-10 size-56 rounded-full opacity-30 blur-3xl" style={{ background: `radial-gradient(circle, ${b}, transparent 70%)` }} />
      <div className="relative">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Icon name="trophy" size={16} strokeWidth={1.8} />Лучший состав</p>
        <p className="mt-6 text-[72px] font-semibold leading-none tabular-nums tracking-[-0.05em]">{e.ratingScore}</p>
        <p className="mt-3 truncate text-[22px] font-semibold tracking-tight">{e.nickname}</p>
        <p className="mt-0.5 text-[14px] text-white/60">{tierOf(e.ratingScore)} · {e.plan.name}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[14px] font-medium backdrop-blur-md"><Icon name="video" size={16} />Смотреть видео</span>
      </div>
    </button>
  );
}

function Mini({ e, place, delay }: { e: HallEntry; place: 2 | 3; delay: number }) {
  const [a, b] = tierColors(e.ratingScore);
  return (
    <button onClick={() => open(e)} aria-label={`${place} место: ${e.nickname}, ${e.ratingScore}`} style={{ animationDelay: `${delay}ms` }}
      className="animate-rise min-w-0 rounded-[26px] bg-surface p-5 text-left transition active:scale-[0.97]">
      <span className="grid size-7 place-items-center rounded-full text-[13px] font-semibold text-white" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>{place}</span>
      <p className="mt-4 text-[36px] font-semibold leading-none tabular-nums tracking-[-0.04em]">{e.ratingScore}</p>
      <p className="mt-2 truncate text-[15px] font-semibold">{e.nickname}</p>
      <p className="truncate text-[12.5px] text-mute">{tierOf(e.ratingScore)}</p>
    </button>
  );
}

export function Hall() {
  const [data, setData] = useState<HallData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { api.hall().then(setData).catch(() => setFailed(true)); }, []);

  if (failed) return <div className="pt-4"><PageTitle title="Зал славы" /><EmptyState icon="info" title="Не удалось загрузить" text="Проверьте соединение и откройте вкладку ещё раз." /></div>;
  if (!data) return <div className="space-y-4 pt-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-60 w-full !rounded-[30px]" /><Skeleton className="h-16 w-full" /></div>;
  const { entries } = data;
  const rest = entries.slice(3);
  return (
    <div className="space-y-4 pt-4">
      <PageTitle title="Зал славы" subtitle="Лучшие составы, которые мы разобрали в видео на TikTok." />
      {entries.length === 0 ? (
        <EmptyState icon="trophy" title="Пока пусто" text="Здесь появятся составы, которые попали в наши видео. Следующим может быть ваш." />
      ) : (
        <>
          <Hero e={entries[0]} />
          {entries.length > 1 && <div className="grid grid-cols-2 gap-3">{entries.slice(1, 3).map((e, i) => <Mini key={i} e={e} place={(i + 2) as 2 | 3} delay={80 + i * 70} />)}</div>}
          {rest.length > 0 && (
            <>
              <h2 className="px-1 pt-3 text-[20px] font-semibold tracking-tight">Остальные</h2>
              <div className="overflow-hidden rounded-[26px] bg-surface">
                {rest.map((e, i) => (
                  <button key={i} onClick={() => open(e)} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    className={cn('animate-rise flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition active:bg-tint', i > 0 && 'border-t border-line')}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-[13px] font-semibold tabular-nums text-mute">{i + 4}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-medium">{e.nickname}</span><span className="block truncate text-[12.5px] text-mute">{tierOf(e.ratingScore)} · {e.plan.name}</span></span>
                    <span className="text-[20px] font-semibold tabular-nums tracking-tight">{e.ratingScore}</span>
                    <Icon name="chevron" size={16} className="text-faint" />
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="pt-2 text-center text-[12px] text-faint">Нажмите на состав, чтобы открыть видео.</p>
        </>
      )}
    </div>
  );
}
