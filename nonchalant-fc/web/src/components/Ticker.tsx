import type { HallEntry } from '../lib/types';
import { tierColors } from './ScoreRing';

/** Бегущая лента лучших оценок. Останавливается при нажатии. */
export function Ticker({ entries }: { entries: HallEntry[] }) {
  if (entries.length < 2) return null;
  const row = (k: string) => entries.map((e, i) => {
    const [a, b] = tierColors(e.ratingScore);
    return (
      <span key={k + i} className="mx-1.5 inline-flex shrink-0 items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 pr-4 text-[14px]">
        <span className="grid h-7 min-w-9 place-items-center rounded-full px-2 text-[13px] font-semibold tabular-nums text-white" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>{e.ratingScore}</span>
        <span className="max-w-[140px] truncate font-medium">{e.nickname}</span>
      </span>
    );
  });
  return (
    <div aria-label="Лучшие оценки" className="-mx-5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div className="animate-marquee flex w-max active:[animation-play-state:paused]">{row('a')}{row('b')}</div>
    </div>
  );
}
