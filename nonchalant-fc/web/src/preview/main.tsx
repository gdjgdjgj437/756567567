import './mock';
import { mode } from './mock';
import { createRoot } from 'react-dom/client';
import { App } from '../app/App';
import { Admin } from '../admin/Admin';
import { ToastProvider } from '../components/ui';

import { applyTheme, getTheme } from '../lib/theme';
applyTheme(getTheme());
const el = document.getElementById('phone-root')!;
const scroller = document.getElementById('phone-scroll');
if (scroller && matchMedia('(min-width: 521px)').matches) {
  (window as any).scrollTo = () => scroller.scrollTo({ top: 0 });
}
const root = createRoot(el);
let n = 0;
function show(m: 'player' | 'admin') {
  mode.current = m; location.hash = m === 'player' ? '#/home' : '';
  root.render(<ToastProvider key={++n}>{m === 'admin' ? <Admin /> : <App />}</ToastProvider>);
}
(window as any).__show = show;
show('player');
