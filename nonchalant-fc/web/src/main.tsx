import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { Admin } from './admin/Admin';
import { ToastProvider } from './components/ui';
import { initTelegram } from './lib/tg';

import { applyTheme, getTheme } from './lib/theme';

initTelegram();
applyTheme(getTheme());
const isAdmin = location.pathname.replace(/\/+$/, '') === '/admin';
createRoot(document.getElementById('root')!).render(<ToastProvider>{isAdmin ? <Admin /> : <App />}</ToastProvider>);
