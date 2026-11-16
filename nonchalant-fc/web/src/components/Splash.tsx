import { useEffect, useState } from 'react';
import logo from '../assets/logo.png';

/** Заставка при запуске: логотип появляется по буквам, затем плавно исчезает, когда данные загружены. */
export function Splash({ ready }: { ready: boolean }) {
  const [minDone, setMinDone] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMinDone(true), 1300); return () => clearTimeout(t); }, []);
  const hide = ready && minDone;
  useEffect(() => { if (!hide) return; const t = setTimeout(() => setGone(true), 600); return () => clearTimeout(t); }, [hide]);
  if (gone) return null;
  return (
    <div aria-hidden className={`fixed inset-0 z-[300] grid place-items-center bg-paper transition-all duration-500 ${hide ? 'pointer-events-none scale-[1.04] opacity-0' : 'opacity-100'}`}>
      <div className="absolute size-72 rounded-full bg-[#0a84ff] opacity-[0.14] blur-3xl animate-float" />
      <div className="relative text-center">
        <img src={logo} alt="" draggable={false} className="logo-img animate-letter mx-auto h-32 w-auto" />
        <div className="mx-auto mt-10 h-[3px] w-28 overflow-hidden rounded-full bg-tint-2"><div className="animate-bar h-full w-full rounded-full bg-[#0a84ff]" /></div>
      </div>
    </div>
  );
}
