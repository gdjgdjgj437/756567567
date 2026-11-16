import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Icon, type IconName } from './icons';
import { haptic } from '../lib/tg';
import type { Tone } from '../lib/format';

export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

// ---------------------------------------------------------------- Button
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'light'; loading?: boolean; block?: boolean; size?: 'md' | 'sm' };
export function Button({ variant = 'primary', loading, block, size = 'md', className, children, disabled, onClick, ...rest }: BtnProps) {
  const styles = {
    primary: 'animate-btnglow bg-gradient-to-b from-[#3aa0ff] to-[#0a7aff] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28)] active:brightness-90',
    light: 'bg-card text-ink active:bg-surface',
    secondary: 'bg-surface text-ink active:bg-surface-2',
    ghost: 'bg-transparent text-ink active:bg-surface',
    danger: 'bg-bad-bg text-bad active:bg-[#f9d9d6]',
  }[variant];
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      onClick={(e) => { haptic('tap'); onClick?.(e); }}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-medium select-none transition duration-150 ease-out active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
        size === 'md' ? 'h-[52px] px-6 text-[17px]' : 'h-9 px-4 text-[14px]',
        block && 'w-full', styles, className)}
    >
      {variant === 'primary' && size === 'md' && !disabled && !loading && <span aria-hidden className="animate-shine pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent" />}
      <span className={cn('inline-flex items-center gap-2', loading && 'opacity-0')}>{children}</span>
      {loading && <Spinner className="absolute" />}
    </button>
  );
}

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg className={cn('animate-spin', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Загрузка">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- surfaces
export const Card = ({ className, children, ...r }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) =>
  <div {...r} className={cn('rounded-card border shadow-card', /\bbg-/.test(className ?? '') ? '' : 'bg-card', /\bborder-/.test(className ?? '') ? '' : 'border-line', className)}>{children}</div>;

export const Surface = ({ className, children }: { className?: string; children: ReactNode }) =>
  <div className={cn('rounded-card bg-surface', className)}>{children}</div>;

const tones: Record<Tone, string> = {
  neutral: 'bg-surface text-mute', ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn', bad: 'bg-bad-bg text-bad', info: 'bg-info-bg text-info',
};
export const Pill = ({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) =>
  <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium leading-none', tones[tone], className)}>{children}</span>;

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-shimmer rounded-2xl bg-surface-2', className)} />;

export function Notice({ icon = 'info', children, tone = 'neutral' }: { icon?: IconName; children: ReactNode; tone?: Tone }) {
  return (
    <div className={cn('flex gap-3 rounded-2xl p-4 text-[14px] leading-snug', tones[tone])}>
      <Icon name={icon} size={20} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="animate-rise flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-5 grid size-16 place-items-center rounded-full bg-surface text-mute"><Icon name={icon} size={28} strokeWidth={1.4} /></div>
      <h3 className="text-[20px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-[17rem] text-[15px] text-mute">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export const PageTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="animate-rise pb-6 pt-2">
    <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.03em]">{title}</h1>
    {subtitle && <p className="mt-2 text-[17px] leading-snug text-mute">{subtitle}</p>}
  </div>
);

// ---------------------------------------------------------------- form
const inputBase = 'w-full rounded-2xl border border-transparent bg-surface px-4 text-[17px] text-ink placeholder:text-faint outline-none transition focus:border-[#0a84ff]/60 focus:bg-card focus:ring-4 focus:ring-[#0a84ff]/15';
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-mute">{label}</span>
      {children}
      {error ? <span role="alert" className="mt-1.5 block px-1 text-[13px] text-bad">{error}</span>
        : hint ? <span className="mt-1.5 block px-1 text-[13px] text-faint">{hint}</span> : null}
    </label>
  );
}
export const Input = ({ className, invalid, ...r }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) =>
  <input {...r} aria-invalid={invalid || undefined} className={cn(inputBase, 'h-[52px]', invalid && 'border-bad/40 bg-bad-bg/40', className)} />;
export const Textarea = ({ className, ...r }: TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea {...r} className={cn(inputBase, 'min-h-24 py-3 leading-snug', className)} />;
export const Select = ({ className, children, ...r }: React.SelectHTMLAttributes<HTMLSelectElement>) =>
  <select {...r} className={cn(inputBase, 'h-[52px] appearance-none', className)}>{children}</select>;

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex rounded-full bg-surface p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => { haptic('tap'); onChange(o.value); }}
          className={cn('flex-1 rounded-full px-3 py-2 text-[14px] font-medium transition', value === o.value ? 'bg-raised text-ink shadow-sm' : 'text-mute')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- toast
type ToastKind = 'success' | 'error' | 'info';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  const seq = useRef(0);
  const push = useCallback((msg: string, kind: ToastKind = 'info') => {
    const id = ++seq.current;
    haptic(kind === 'success' ? 'success' : kind === 'error' ? 'error' : 'tap');
    setItems((s) => [...s.slice(-2), { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)]" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="animate-toast pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full bg-ink/95 px-4 py-3 text-[14px] font-medium text-on-ink shadow-pop backdrop-blur">
            <Icon name={t.kind === 'success' ? 'checkCircle' : t.kind === 'error' ? 'info' : 'info'} size={18} className={t.kind === 'error' ? 'text-[#ff8a80]' : t.kind === 'success' ? 'text-[#7ee0a5]' : 'text-white/70'} />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------- sheet
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-card shadow-pop sm:rounded-[28px]">
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <div className="mx-auto absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-surface-2 sm:hidden" />
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Закрыть" className="grid size-8 place-items-center rounded-full bg-surface text-mute active:bg-surface-2"><Icon name="x" size={16} strokeWidth={2} /></button>
        </div>
        <div className="safe-b overflow-y-auto overscroll-contain px-5 pb-6 pt-3">{children}</div>
      </div>
    </div>
  );
}

export function CopyChip({ text, label }: { text: string; label?: string }) {
  const toast = useToast();
  return (
    <button onClick={async () => { try { await navigator.clipboard.writeText(text); toast('Скопировано', 'success'); } catch { toast('Не удалось скопировать', 'error'); } }}
      className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 font-mono text-[15px] font-medium tracking-wide active:bg-surface-2">
      {label ?? text}<Icon name="copy" size={15} className="text-mute" />
    </button>
  );
}
