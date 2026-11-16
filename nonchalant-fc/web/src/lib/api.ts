import type { AppConfig, Hall, Order, Overview, Settings, User } from './types';
import { devUser, initData } from './tg';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = 'error') { super(message); this.status = status; this.code = code; }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const data = initData();
  if (data) headers.set('Authorization', `tma ${data}`);
  else { const d = devUser(); if (d) headers.set('x-dev-user', JSON.stringify(d)); }
  let res: Response;
  try { res = await fetch(path, { ...init, headers }); }
  catch { throw new ApiError('Ошибка сети. Проверьте подключение и попробуйте снова.', 0, 'network'); }
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(body?.message || `Что-то пошло не так (${res.status}).`, res.status, body?.error);
  return body as T;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
  bot: () => request<{ botUsername: string }>('/api/bot'),
  me: () => request<{ user: User; config: AppConfig }>('/api/me'),
  config: () => request<AppConfig>('/api/config'),
  hall: () => request<Hall>('/api/hall'),
  orders: () => request<{ orders: Order[] }>('/api/orders').then((r) => r.orders),
  createOrder: (form: FormData) => request<{ order: Order; duplicate: boolean }>('/api/orders', { method: 'POST', body: form }).then((r) => r.order),
  upgrade: (id: string, plan: string) => request<{ order: Order }>(`/api/orders/${id}/upgrade`, json('POST', { plan })).then((r) => r.order),
  reportPayment: (id: string, reference: string) => request<{ order: Order }>(`/api/orders/${id}/payment`, json('POST', { reference })).then((r) => r.order),

  admin: {
    overview: () => request<{ overview: Overview }>('/api/admin/overview').then((r) => r.overview),
    orders: (params: Record<string, string>) => request<{ total: number; orders: Order[] }>(`/api/admin/orders?${new URLSearchParams(params)}`),
    patch: (id: string, patch: Record<string, unknown>) => request<{ order: Order }>(`/api/admin/orders/${id}`, json('PATCH', patch)).then((r) => r.order),
    remove: (id: string) => request<{ ok: true }>(`/api/admin/orders/${id}`, { method: 'DELETE' }),
    payment: (id: string, action: 'confirm' | 'reject') => request<{ order: Order }>(`/api/admin/orders/${id}/payment`, json('POST', { action })).then((r) => r.order),
    queue: () => request<{ queue: Order[]; inProgress: Order[] }>('/api/admin/queue'),
    move: (orderId: string, position: number) => request<{ queue: Order[]; inProgress: Order[] }>('/api/admin/queue/move', json('POST', { orderId, position })),
    settings: () => request<{ settings: Settings }>('/api/admin/settings').then((r) => r.settings),
    saveSettings: (s: Record<string, unknown>) => request<{ settings: Settings }>('/api/admin/settings', json('PUT', s)).then((r) => r.settings),
  },
};
