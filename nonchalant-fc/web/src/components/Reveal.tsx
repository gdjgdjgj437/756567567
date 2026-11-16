import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Появление блока с пружинным эффектом, когда он попадает в видимую область. */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return (
    <Tag ref={ref as never} className={className}
      style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(28px) scale(0.97)', transition: `opacity .5s ease ${delay}ms, transform .8s cubic-bezier(0.34, 1.35, 0.64, 1) ${delay}ms` }}>
      {children}
    </Tag>
  );
}
