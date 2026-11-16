import { Router, HttpError, bad, readJson, readBody, parseMultipart, rateLimit, sendJson } from './http.js';
import { config } from './config.js';
import { authenticate, assertAdmin, checkToken } from './auth.js';
import { readImage } from './storage.js';
import { query } from './db.js';
import * as orders from './orders.js';
import { handleUpdate } from './bot.js';

export const router = new Router();

const publicConfig = async () => {
  const s = await orders.getSettings();
  return { ...s, botUsername: config.botUsername, maxUploadMb: Math.round(config.maxUploadBytes / 1048576) };
};
const toCtx = (h, { admin = false } = {}) => async (ctx) => {
  ctx.user = await authenticate(ctx.req);
  if (admin) assertAdmin(ctx.user);
  rateLimit(`api:${ctx.user.id}`, 240, 60_000);
  return h(ctx);
};
const user = (p, h) => router.get(p, toCtx(h));

// ---- public ----
router.get('/api/bot', async () => ({ botUsername: config.botUsername }));
router.get('/api/health', async () => { await query('SELECT 1'); return { ok: true }; });

router.get('/api/orders/:id/image', async (ctx) => {
  // <img> tags cannot send headers, so access is granted via a short-lived signed token that is only
  // ever issued inside authenticated, ownership-checked responses.
  if (!checkToken(`img:${ctx.params.id}`, ctx.query.get('t'))) throw new HttpError(403, 'Срок действия ссылки истёк.', 'forbidden');
  const { key, mime } = await orders.imageForOrder(ctx.params.id);
  const buf = await readImage(key);
  ctx.res.writeHead(200, { 'Content-Type': mime, 'Content-Length': buf.length, 'Cache-Control': 'private, max-age=300', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' });
  ctx.res.end(buf);
  return ctx.handled;
});

router.post('/telegram/webhook', async (ctx) => {
  if (!config.useWebhook || ctx.req.headers['x-telegram-bot-api-secret-token'] !== config.webhookSecret) throw new HttpError(403, 'Forbidden', 'forbidden');
  const update = await readJson(ctx.req, 256 * 1024);
  handleUpdate(update); // respond immediately, process in background
  return { ok: true };
});

// ---- user ----
router.get('/api/me', toCtx(async (ctx) => ({ user: ctx.user, config: await publicConfig() })));
user('/api/config', async () => publicConfig());
user('/api/hall', async () => orders.hallOfFame());
user('/api/orders', async (ctx) => ({ orders: await orders.listUserOrders(ctx.user.id) }));
user('/api/orders/:id', async (ctx) => ({ order: await orders.getUserOrder(ctx.user.id, ctx.params.id) }));

router.post('/api/orders', toCtx(async (ctx) => {
  rateLimit(`create:${ctx.user.id}`, config.ordersPerHour, 3600_000);
  const ct = ctx.req.headers['content-type'] || '';
  if (!/^multipart\/form-data/i.test(ct)) throw bad('Ожидается multipart/form-data.');
  const buf = await readBody(ctx.req, config.maxUploadBytes + 256 * 1024);
  const { fields, files } = parseMultipart(buf, ct);
  const { order, duplicate } = await orders.createOrder(ctx.user, {
    nickname: fields.nickname, uid: fields.uid, plan: fields.plan, idempotencyKey: fields.idempotencyKey, file: files.screenshot,
  });
  ctx.status = duplicate ? 200 : 201;
  return { order, duplicate };
}));

router.post('/api/orders/:id/upgrade', toCtx(async (ctx) => {
  const b = await readJson(ctx.req);
  return { order: await orders.upgradeOrder(ctx.user, ctx.params.id, b.plan) };
}));

router.post('/api/orders/:id/payment', toCtx(async (ctx) => {
  const b = await readJson(ctx.req);
  return { order: await orders.reportPayment(ctx.user, ctx.params.id, b.reference) };
}));

// ---- admin ----
const admin = (m, p, h) => router[m](p, toCtx(h, { admin: true }));
admin('get', '/api/admin/overview', async () => ({ overview: await orders.overview() }));
admin('get', '/api/admin/orders', async (ctx) => orders.adminListOrders({
  plan: ctx.query.get('plan'), q: ctx.query.get('q'), paymentStatus: ctx.query.get('payment'), evalStatus: ctx.query.get('status'),
  limit: ctx.query.get('limit') || 50, offset: ctx.query.get('offset') || 0,
}));
admin('get', '/api/admin/orders/:id', async (ctx) => ({ order: await orders.adminGetOrder(ctx.params.id) }));
admin('patch', '/api/admin/orders/:id', async (ctx) => ({ order: await orders.updateOrder(ctx.params.id, await readJson(ctx.req)) }));
admin('delete', '/api/admin/orders/:id', async (ctx) => orders.deleteOrder(ctx.params.id));
admin('post', '/api/admin/orders/:id/payment', async (ctx) => {
  const b = await readJson(ctx.req);
  return { order: await orders.reviewPayment(ctx.user.id, ctx.params.id, b.action) };
});
admin('get', '/api/admin/queue', async () => orders.getQueue());
admin('post', '/api/admin/queue/move', async (ctx) => {
  const b = await readJson(ctx.req);
  return orders.moveInQueue(b.orderId, b.position);
});
admin('get', '/api/admin/settings', async () => ({ settings: await orders.getSettings() }));
admin('put', '/api/admin/settings', async (ctx) => ({ settings: await orders.updateSettings(await readJson(ctx.req)) }));

export { sendJson };
