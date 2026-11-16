import { useEffect, useId, useRef, useState } from 'react';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Плавно «докручивает» число от 0 до цели (без анимации при prefers-reduced-motion). */
export function useCountUp(target: number, ms = 1100): number {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced() || target === from.current) { setV(target); from.current = target; return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 4);
      setV(a + (target - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return Number.isInteger(target) ? Math.round(v) : Math.round(v * 10) / 10;
}

export const tierOf = (s: number) => (s >= 90 ? 'Элита' : s >= 80 ? 'Про' : s >= 70 ? 'Крепкий состав' : s >= 50 ? 'Растущий' : 'Начало пути');
/** Градиент кольца по уровню, как кольца активности в Apple Fitness. */
export const tierColors = (s: number): [string, string] => (s >= 90 ? ['#ff9f0a', '#ffd60a'] : s >= 80 ? ['#0a84ff', '#5ac8fa'] : s >= 70 ? ['#30d158', '#a6e34a'] : ['#8e8e93', '#c7c7cc']);

export function ScoreRing({ score, size = 156 }: { score: number; size?: number }) {
  const id = useId().replace(/:/g, '');
  const shown = useCountUp(score);
  const sw = 14, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const [a, b] = tierColors(score);
  const [go, setGo] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setGo(true)); return () => cancelAnimationFrame(t); }, []);
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a} strokeOpacity="0.16" strokeWidth={sw} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={go || reduced() ? c * (1 - pct) : c}
            style={{ transition: reduced() ? 'none' : 'stroke-dashoffset 1.3s cubic-bezier(0.22,1,0.36,1)', filter: `drop-shadow(0 2px 6px ${a}66)` }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div><p className="text-[42px] font-semibold leading-none tabular-nums tracking-[-0.04em]">{shown}</p><p className="mt-1 text-[12px] font-medium text-mute">из 100</p></div>
        </div>
      </div>
      <div><p className="text-[12px] font-medium text-mute">Уровень</p><p className="mt-0.5 text-[24px] font-semibold leading-tight tracking-tight">{tierOf(score)}</p></div>
    </div>
  );
}
