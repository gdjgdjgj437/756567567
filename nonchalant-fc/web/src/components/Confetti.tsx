const COLORS = ['#0a84ff', '#5ac8fa', '#ffd60a', '#ff9f0a', '#ff375f', '#bf5af2', '#30d158'];

/** Конфетти на canvas. Сам удаляется после завершения; при «уменьшить движение» ничего не делает. */
export function fireConfetti(duration = 2600) {
  if (typeof document === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:200';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d')!; ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 110 }, (_, i) => {
    const side = i % 2 ? 1 : -1, a = (-Math.PI / 2) + side * (0.2 + Math.random() * 0.7);
    const v = 9 + Math.random() * 9;
    return { x: W / 2 + side * W * 0.15, y: H * 0.55, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 6, h: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: COLORS[i % COLORS.length] };
  });
  const t0 = performance.now();
  const step = (t: number) => {
    const k = (t - t0) / duration;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (k < 1) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
}

const KEY = 'nc_celebrated';
/** true один раз для каждого заказа: чтобы праздновать публикацию только при первом просмотре. */
export function firstCelebration(id: string): boolean {
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (seen.includes(id)) return false;
    localStorage.setItem(KEY, JSON.stringify([...seen, id].slice(-200)));
    return true;
  } catch { return false; }
}
