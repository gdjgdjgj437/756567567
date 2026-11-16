import { useState } from 'react';
import { getTheme, saveTheme, type Theme } from '../lib/theme';
import { haptic } from '../lib/tg';
import { Icon } from './icons';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button onClick={() => { haptic('tap'); saveTheme(next); setTheme(next); }} aria-label={next === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему'}
      className="grid size-10 place-items-center rounded-full bg-surface text-ink transition active:scale-90">
      <span key={theme} className="animate-pop2"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} strokeWidth={1.7} /></span>
    </button>
  );
}
