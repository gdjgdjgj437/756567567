/* Preview-only: an in-browser stand-in for the real server, seeded with sample data. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Order, PlanCode } from '../lib/types';

export const mode = { current: 'player' as 'player' | 'admin' };

const w = window as any;
w.Telegram = { WebApp: { initData: 'preview', ready() {}, expand() {}, openLink: (u: string) => window.open(u, '_blank', 'noopener'), openTelegramLink: (u: string) => window.open(u, '_blank', 'noopener') } };

const PLANS = [
  { code: 'free', name: 'Бесплатный', price: 0, priority: 3, guaranteedFeature: false },
  { code: 'standard', name: 'Стандарт', price: 5, priority: 2, guaranteedFeature: true },
  { code: 'express', name: 'Экспресс', price: 15, priority: 1, guaranteedFeature: true },
] as const;
const S = { currency: 'USD', paymentInstructions: 'Отправьте точную сумму в USDT (TRC20) на кошелёк ниже, затем нажмите «Я оплатил» и укажите ID транзакции.\n\nКошелёк: TXyz...пример-для-предпросмотра\n\nУкажите номер заказа в комментарии.' };
const price = (c: PlanCode) => PLANS.find((p) => p.code === c)!.price;
const planName = (c: PlanCode) => PLANS.find((p) => p.code === c)!.name;

function squadImage(seed: number) {
  const f = [[1, 4, 3, 3], [1, 4, 2, 3, 1], [1, 3, 4, 3]][seed % 3];
  let y = 70, dots = '';
  const rows = [...f].reverse();
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const x = (390 / (n + 1)) * (i + 1), ov = 80 + ((seed * 7 + r * 5 + i * 3) % 17);
      dots += `<g transform="translate(${x},${y})"><rect x="-26" y="-34" width="52" height="68" rx="9" fill="#fff" fill-opacity=".92"/><text y="-8" text-anchor="middle" font-size="19" font-weight="700" fill="#14281c" font-family="Arial">${ov}</text><circle cy="14" r="6" fill="#2f7a4c"/></g>`;
    }
    y += 150;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844"><rect width="390" height="844" fill="#2a5e3f"/><g stroke="#fff" stroke-opacity=".28" stroke-width="2" fill="none"><rect x="14" y="14" width="362" height="816" rx="6"/><path d="M14 422h362"/><circle cx="195" cy="422" r="52"/></g>${dots}<text x="195" y="826" text-anchor="middle" font-size="13" fill="#fff" fill-opacity=".6" font-family="Arial">ПРИМЕР СКРИНШОТА СОСТАВА</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
let seq = 0;
interface Row extends Order { userKey: string }
const db: { orders: Row[]; queue: string[] } = { orders: [], queue: [] };

function add(o: Partial<Row> & { nickname: string; uid: string; plan: PlanCode; userKey: string }, hours: number) {
  const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const code = 'NFC-' + ['7K2M9X', 'Q4R8TZ', 'B3N6WD', 'H9C2LP', 'V5J7YA', 'M8D4FE', 'X2G6SU', 'T7P3KB'][seq % 8];
  const paid = o.plan !== 'free';
  const row: Row = {
    id, code, createdAt: ago(hours), nickname: o.nickname, uid: o.uid, plan: { code: o.plan, name: planName(o.plan) },
    price: price(o.plan), currency: S.currency, paymentStatus: paid ? 'pending' : 'not_required', evalStatus: 'submitted', publishStatus: 'not_published',
    videoUrl: null, ratingScore: null, ratingNote: null, queuePosition: null, paymentReference: null, paymentReportedAt: null,
    canReportPayment: false, canUpgrade: false, imageUrl: o.imageUrl ?? squadImage(seq), userId: o.userKey, username: o.userKey, firstName: o.nickname,
    adminNote: null, userKey: o.userKey,
  } as Row;
  if (o.imageUrl) row.imageUrl = o.imageUrl;
  db.orders.unshift(row);
  return row;
}
const prio = (r: Row) => PLANS.find((p) => p.code === r.plan.code)!.priority;
function enqueue(r: Row) {
  db.queue = db.queue.filter((x) => x !== r.id);
  let i = 0;
  while (i < db.queue.length && prio(db.orders.find((x) => x.id === db.queue[i])!) <= prio(r)) i++;
  db.queue.splice(i, 0, r.id);
}
const dequeue = (r: Row) => { db.queue = db.queue.filter((x) => x !== r.id); };
const find = (id: string) => { const r = db.orders.find((x) => x.id === id); if (!r) throw err(404, 'Не найдено.'); return r; };

class E extends Error { status = 400; code = 'error'; }
function err(status: number, message: string, code = 'error') { const e = new E(message); e.status = status; e.code = code; return e; }

function seed() {
  const a = add({ userKey: 'me', nickname: 'Nonchalant_XI', uid: '48215937', plan: 'express' }, 70);
  Object.assign(a, { paymentStatus: 'confirmed', paymentReference: 'TX-84F2A1', paymentReportedAt: ago(69), evalStatus: 'evaluated', publishStatus: 'published', ratingScore: 91.5, ratingNote: 'Топовая атака, полузащита — слабое звено. В целом сильная сборка.', videoUrl: 'https://www.tiktok.com/' });
  const b = add({ userKey: 'me', nickname: 'Nonchalant_XI', uid: '48215937', plan: 'free' }, 30);
  Object.assign(b, { evalStatus: 'evaluated', ratingScore: 78, ratingNote: 'Крепкий состав. Усильте защиту, и вы выйдете на 85+.' });
  const c = add({ userKey: 'me', nickname: 'Nonchalant_XI', uid: '48215937', plan: 'standard' }, 6);
  Object.assign(c, { paymentStatus: 'confirmed', paymentReportedAt: ago(5), paymentReference: 'TX-19C0DE', evalStatus: 'in_queue' });
  const d = add({ userKey: 'u4', nickname: 'KaizenFC', uid: '77120398', plan: 'express' }, 3);
  Object.assign(d, { paymentStatus: 'confirmed', paymentReference: 'TX-5521AB', paymentReportedAt: ago(2.5), evalStatus: 'in_queue' });
  const e = add({ userKey: 'u5', nickname: 'GoalMachine', uid: '30998123', plan: 'standard' }, 9);
  Object.assign(e, { paymentStatus: 'confirmed', paymentReference: 'TX-A77B10', paymentReportedAt: ago(8), evalStatus: 'being_evaluated' });
  [['TitanFC', 95.5, 'express', 200], ['ValeraGoat', 88, 'standard', 150], ['SkyBlue10', 84.5, 'standard', 120], ['NightOwl_FC', 76, 'express', 100]].forEach(([n, sc, pl, h], i) => {
    const r = add({ userKey: 'h' + i, nickname: n as string, uid: '1000' + i, plan: pl as PlanCode }, h as number);
    Object.assign(r, { paymentStatus: 'confirmed', paymentReference: 'TX-H' + i, paymentReportedAt: ago((h as number) - 1), evalStatus: 'evaluated', publishStatus: 'published', ratingScore: sc, videoUrl: 'https://www.tiktok.com/' });
  });
  add({ userKey: 'u6', nickname: 'LegendRonaldo7', uid: '61004455', plan: 'standard' }, 1.5).paymentReportedAt = ago(1);
  add({ userKey: 'u7', nickname: 'PixelPrince', uid: '22918700', plan: 'free' }, 12).evalStatus = 'in_queue';
  add({ userKey: 'u8', nickname: 'Mbappe_Fan', uid: '90331276', plan: 'free' }, 20).evalStatus = 'submitted';
  for (const r of [c, d]) enqueue(r);
  for (const r of db.orders.filter((x) => x.plan.code === 'free' && ['submitted', 'in_queue'].includes(x.evalStatus))) enqueue(r);
}
seed();

function view(r: Row, admin = false) {
  const paid = r.plan.code !== 'free';
  const o: any = { ...r };
  delete o.userKey;
  o.queuePosition = db.queue.includes(r.id) ? db.queue.indexOf(r.id) + 1 : null;
  o.canReportPayment = paid && ['pending', 'rejected'].includes(r.paymentStatus) && r.evalStatus !== 'rejected';
  o.canUpgrade = !paid && ['submitted', 'in_queue'].includes(r.evalStatus);
  if (!admin) {
    if (r.publishStatus !== 'published') o.videoUrl = null;
    if (r.evalStatus !== 'evaluated') { o.ratingScore = null; o.ratingNote = null; }
    for (const k of ['userId', 'username', 'firstName', 'adminNote']) delete o[k];
  }
  return o as Order;
}

const config = () => ({ currency: S.currency, paymentInstructions: S.paymentInstructions, plans: PLANS.map((p) => ({ ...p })), botUsername: 'Nonchalant_XI_Bot', maxUploadMb: 8 });
const payOk = (r: Row) => r.plan.code === 'free' || r.paymentStatus === 'confirmed';

function patch(r: Row, p: any) {
  let ev = r.evalStatus, pub = r.publishStatus, url = r.videoUrl;
  if (p.evalStatus !== undefined) {
    if (!payOk(r) && !['submitted', 'rejected'].includes(p.evalStatus)) throw err(409, 'Сначала подтвердите платёж, затем двигайте заказ дальше.', 'payment_required');
    ev = p.evalStatus;
  }
  if (p.videoUrl !== undefined) {
    if (!p.videoUrl) url = null;
    else if (/^https:\/\/([a-z0-9-]+\.)*tiktok\.com\//i.test(p.videoUrl)) url = p.videoUrl; else throw err(400, 'Ссылка на видео должна быть https-ссылкой на tiktok.com.');
  }
  if (p.ratingScore !== undefined) {
    if (p.ratingScore === null || p.ratingScore === '') r.ratingScore = null;
    else { const n = Number(p.ratingScore); if (!Number.isFinite(n) || n < 0 || n > 100) throw err(400, 'Оценка должна быть от 0 до 100.'); r.ratingScore = Math.round(n * 10) / 10; }
  }
  if (p.ratingNote !== undefined) r.ratingNote = String(p.ratingNote || '').trim() || null;
  if (p.adminNote !== undefined) r.adminNote = String(p.adminNote || '').trim() || null;
  if (p.publishStatus !== undefined) pub = p.publishStatus;
  if (pub === 'published') {
    if (!payOk(r)) throw err(409, 'Сначала подтвердите платёж, затем публикуйте.', 'payment_required');
    if (ev === 'rejected') throw err(409, 'Отклонённый заказ нельзя опубликовать.', 'invalid_state');
    if (!url) throw err(400, 'Добавьте ссылку на видео TikTok перед публикацией.');
    ev = 'evaluated';
  }
  r.evalStatus = ev; r.publishStatus = pub; r.videoUrl = url;
  if (payOk(r) && ['submitted', 'in_queue'].includes(ev)) { if (!db.queue.includes(r.id)) enqueue(r); } else dequeue(r);
  return r;
}

async function route(method: string, path: string, init?: RequestInit): Promise<any> {
  const u = new URL(path, 'http://x');
  const p = u.pathname, q = u.searchParams;
  const json = () => JSON.parse(String(init?.body || '{}'));
  const me = () => db.orders.filter((o) => o.userKey === 'me');
  let m: RegExpExecArray | null;

  if (p === '/api/bot') return { botUsername: 'Nonchalant_XI_Bot' };
  if (p === '/api/me') return { user: { id: mode.current === 'admin' ? 'admin' : 'me', username: 'nonchalant_fan', firstName: mode.current === 'admin' ? 'Босс' : 'Алекс', isAdmin: mode.current === 'admin' }, config: config() };
  if (p === '/api/config') return config();
  if (p === '/api/hall') {
    const pub = db.orders.filter((o) => o.publishStatus === 'published' && o.evalStatus === 'evaluated' && o.ratingScore != null && o.videoUrl)
      .sort((x, y) => (y.ratingScore as number) - (x.ratingScore as number)).slice(0, 20);
    return {
      stats: { evaluated: db.orders.filter((o) => o.evalStatus === 'evaluated').length + 124, published: pub.length + 18 },
      entries: pub.map((o) => ({ nickname: o.nickname, ratingScore: o.ratingScore, plan: o.plan, videoUrl: o.videoUrl, publishedAt: o.createdAt })),
    };
  }
  if (p === '/api/orders' && method === 'GET') return { orders: me().map((o) => view(o)) };
  if (p === '/api/orders' && method === 'POST') {
    const f = init!.body as FormData;
    const nickname = String(f.get('nickname') || '').trim(), uid = String(f.get('uid') || '').trim(), plan = String(f.get('plan') || 'free') as PlanCode;
    const file = f.get('screenshot') as File | null;
    if (!nickname || !uid || !file || !file.size) throw err(400, 'Заполните все поля и добавьте скриншот.', 'validation');
    const r = add({ userKey: 'me', nickname, uid, plan, imageUrl: URL.createObjectURL(file) }, 0);
    if (plan === 'free') { r.evalStatus = 'in_queue'; enqueue(r); }
    return { __status: 201, order: view(r), duplicate: false };
  }
  if ((m = /^\/api\/orders\/([^/]+)\/upgrade$/.exec(p))) {
    const r = find(m[1]); const b = json();
    r.plan = { code: b.plan, name: planName(b.plan) }; r.price = price(b.plan); r.paymentStatus = 'pending'; r.evalStatus = 'submitted'; dequeue(r);
    return { order: view(r) };
  }
  if ((m = /^\/api\/orders\/([^/]+)\/payment$/.exec(p))) {
    const r = find(m[1]); const b = json();
    r.paymentReference = String(b.reference || '').trim() || null; r.paymentReportedAt = new Date().toISOString();
    return { order: view(r) };
  }

  // ---- admin
  if (mode.current !== 'admin') throw err(403, 'Только для администраторов.', 'forbidden');
  if (p === '/api/admin/overview') {
    const paid = db.orders.filter((o) => o.plan.code !== 'free' && o.paymentStatus === 'confirmed');
    return { overview: {
      totalSubmissions: db.orders.length, freeSubmissions: db.orders.filter((o) => o.plan.code === 'free').length, paidOrders: paid.length,
      standardPaid: paid.filter((o) => o.plan.code === 'standard').length, expressPaid: paid.filter((o) => o.plan.code === 'express').length,
      pendingPayments: db.orders.filter((o) => o.plan.code !== 'free' && o.paymentStatus === 'pending').length,
      awaitingEvaluation: db.orders.filter((o) => payOk(o) && ['submitted', 'in_queue', 'being_evaluated'].includes(o.evalStatus)).length,
      published: db.orders.filter((o) => o.publishStatus === 'published').length,
      revenue: [{ currency: S.currency, total: paid.reduce((s, o) => s + o.price, 0) }],
    } };
  }
  if (p === '/api/admin/orders' && method === 'GET') {
    const qq = (q.get('q') || '').toLowerCase();
    let rows = db.orders.filter((o) => (!q.get('plan') || o.plan.code === q.get('plan')) && (!q.get('payment') || o.paymentStatus === q.get('payment')) && (!q.get('status') || o.evalStatus === q.get('status'))
      && (!qq || [o.nickname, o.uid, o.code].some((s) => s.toLowerCase().includes(qq))));
    rows = [...rows].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const off = Number(q.get('offset') || 0), lim = Number(q.get('limit') || 50);
    return { total: rows.length, orders: rows.slice(off, off + lim).map((o) => view(o, true)) };
  }
  if ((m = /^\/api\/admin\/orders\/([^/]+)$/.exec(p))) {
    const r = find(m[1]);
    if (method === 'PATCH') return { order: view(patch(r, json()), true) };
    if (method === 'DELETE') { dequeue(r); db.orders = db.orders.filter((x) => x !== r); return { ok: true }; }
  }
  if ((m = /^\/api\/admin\/orders\/([^/]+)\/payment$/.exec(p))) {
    const r = find(m[1]); const { action } = json();
    if (action === 'confirm') { r.paymentStatus = 'confirmed'; if (r.evalStatus === 'submitted') r.evalStatus = 'in_queue'; enqueue(r); }
    else { r.paymentStatus = 'rejected'; dequeue(r); }
    return { order: view(r, true) };
  }
  const queueView = () => ({ queue: db.queue.map((id) => view(find(id), true)), inProgress: db.orders.filter((o) => o.evalStatus === 'being_evaluated').map((o) => view(o, true)) });
  if (p === '/api/admin/queue') return queueView();
  if (p === '/api/admin/queue/move') { const b = json(); const i = db.queue.indexOf(b.orderId); if (i < 0) throw err(409, 'Этого заказа нет в очереди ожидания.'); db.queue.splice(i, 1); db.queue.splice(Math.min(b.position, db.queue.length), 0, b.orderId); return queueView(); }
  if (p === '/api/admin/settings' && method === 'GET') return { settings: config() };
  if (p === '/api/admin/settings' && method === 'PUT') {
    const b = json();
    const std = Number(b.standardPrice), exp = Number(b.expressPrice);
    if (!(std >= 0) || !(exp >= 0)) throw err(400, 'Цены не могут быть отрицательными.');
    (PLANS as any)[1].price = std; (PLANS as any)[2].price = exp;
    S.currency = String(b.currency || 'USD').toUpperCase().slice(0, 5); S.paymentInstructions = String(b.paymentInstructions ?? '');
    return { settings: config() };
  }
  throw err(404, 'Не найдено.');
}

const realFetch = window.fetch.bind(window);
w.fetch = async (input: any, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('/api/')) return realFetch(input, init);
  await new Promise((r) => setTimeout(r, 220));
  try {
    const out = await route((init?.method || 'GET').toUpperCase(), url, init);
    const status = out?.__status ?? 200; if (out?.__status) delete out.__status;
    return new Response(JSON.stringify(out), { status, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.code || 'error', message: e.message }), { status: e.status || 500, headers: { 'Content-Type': 'application/json' } });
  }
};
