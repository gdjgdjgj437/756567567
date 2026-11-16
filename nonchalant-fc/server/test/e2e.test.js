import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { BOT_TOKEN, signInitData, PNG, JPG, WEBP, multipart, startFakeTelegram, waitFor, sleep } from './helpers.js';

const ADMIN = { id: 900001, first_name: 'Boss', username: 'boss' };
const ALICE = { id: 111, first_name: 'Alice', username: 'alice' };
const BOB = { id: 222, first_name: 'Bob' };

let base, srv, fake, mod, dbName, adminPool, uploadDir;

before(async () => {
  fake = await startFakeTelegram();
  dbName = 'nc_test_' + Date.now();
  const adminUrl = process.env.TEST_PG_ADMIN_URL || 'postgres://postgres@127.0.0.1:55432/postgres';
  adminPool = new pg.Pool({ connectionString: adminUrl });
  await adminPool.query(`CREATE DATABASE ${dbName}`);
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-up-'));
  Object.assign(process.env, {
    DATABASE_URL: adminUrl.replace(/\/[^/]*$/, '/' + dbName),
    TELEGRAM_BOT_TOKEN: BOT_TOKEN, ADMIN_TELEGRAM_IDS: String(ADMIN.id), TELEGRAM_API_BASE: fake.url,
    APP_URL: 'https://app.example.com', UPLOAD_DIR: uploadDir, MAX_UPLOAD_MB: '1', ORDERS_PER_HOUR_LIMIT: '1000', NODE_ENV: 'test',
  });
  const { migrate } = await import('../src/migrate.js');
  await migrate();
  mod = {
    server: await import('../src/index.js'),
    db: await import('../src/db.js'),
    bot: await import('../src/bot.js'),
    auth: await import('../src/auth.js'),
  };
  srv = mod.server.createServer();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}`;
});

after(async () => {
  srv?.close();
  await mod?.db.pool.end();
  await adminPool?.query(`DROP DATABASE IF EXISTS ${dbName}`).catch(() => {});
  await adminPool?.end();
  fake?.server.close();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

const hdr = (u) => ({ Authorization: 'tma ' + signInitData(u) });
async function api(method, url, { user, json, form } = {}) {
  const headers = user ? hdr(user) : {};
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) { headers['Content-Type'] = form.contentType; body = form.body; }
  const r = await fetch(base + url, { method, headers, body });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, body: ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()), headers: r.headers };
}
let n = 0;
const submit = (user, { plan = 'free', nickname = 'Messi10', uid = '12345678', file = { data: PNG }, key } = {}) =>
  api('POST', '/api/orders', { user, form: multipart({ nickname, uid, plan, idempotencyKey: key ?? `key-${Date.now()}-${n++}-xxxx` }, file) });
const adminPatch = (id, json) => api('PATCH', `/api/admin/orders/${id}`, { user: ADMIN, json });
const queueCodes = async () => (await api('GET', '/api/admin/queue', { user: ADMIN })).body.queue.map((o) => o.code);
const msgsTo = (chat) => fake.calls.filter((c) => c.method === 'sendMessage' && String(c.body.chat_id) === String(chat));

test('initData verification: valid, tampered, wrong token, expired', () => {
  const { verifyInitData } = mod.auth;
  const ok = signInitData(ALICE);
  assert.equal(verifyInitData(ok, BOT_TOKEN).user.id, 111);
  assert.throws(() => verifyInitData(ok.replace('Alice', 'Mallory'), BOT_TOKEN), /invalid signature/);
  assert.throws(() => verifyInitData(ok, 'other:token'), /invalid signature/);
  assert.throws(() => verifyInitData(signInitData(ALICE, { authDate: 1000 }), BOT_TOKEN), /expired/);
  assert.throws(() => verifyInitData('', BOT_TOKEN), /missing/);
});

test('API requires valid Telegram identity', async () => {
  assert.equal((await api('GET', '/api/orders')).status, 401);
  const forged = await fetch(base + '/api/orders', { headers: { Authorization: 'tma ' + signInitData(ALICE, { token: 'x:y' }) } });
  assert.equal(forged.status, 401);
  assert.equal((await fetch(base + '/api/orders', { headers: { 'x-dev-user': '{"id":1}' } })).status, 401, 'dev bypass must be off');
  const me = await api('GET', '/api/me', { user: ALICE });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.isAdmin, false);
  assert.equal((await api('GET', '/api/me', { user: ADMIN })).body.user.isAdmin, true);
});

test('free submission: validation, upload, order id, queue, notification', async () => {
  assert.equal((await submit(ALICE, { nickname: '' })).status, 400);
  assert.equal((await submit(ALICE, { uid: 'bad uid!' })).status, 400);
  assert.equal((await submit(ALICE, { file: null })).status, 400);
  const txt = await submit(ALICE, { file: { data: Buffer.from('not an image at all, just text'), type: 'image/png', name: 'x.png' } });
  assert.equal(txt.status, 400, 'content sniffing must reject fake png');
  assert.equal((await submit(ALICE, { file: { data: Buffer.alloc(1.5 * 1024 * 1024, 1) } })).status, 413);
  for (const [i, f] of [PNG, JPG, WEBP].entries()) assert.equal((await submit(ALICE, { file: { data: f }, nickname: 'fmt' + i })).status, 201);

  const r = await submit(ALICE, { nickname: 'FreeGuy', uid: 'ABC12345' });
  assert.equal(r.status, 201);
  const o = r.body.order;
  assert.match(o.code, /^NFC-[A-Z2-9]{6}$/);
  assert.equal(o.plan.code, 'free');
  assert.equal(o.paymentStatus, 'not_required');
  assert.equal(o.evalStatus, 'submitted');
  assert.ok(o.queuePosition >= 1);
  const m = await waitFor(() => msgsTo(111).find((c) => c.body.text.includes(o.code)));
  assert.ok(m, 'user got a submission_received notification');
  assert.match(m.body.text, /не гарантируется/);
  const img = await api('GET', o.imageUrl);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.deepEqual(img.body, PNG);
  assert.equal((await api('GET', o.imageUrl.replace(/t=[^&]+/, 't=1.forged'))).status, 403);
});

test('double-click safety: same idempotency key creates one order', async () => {
  const key = 'idem-test-key-0001';
  const [a, b] = await Promise.all([submit(BOB, { key, nickname: 'Dup' }), submit(BOB, { key, nickname: 'Dup' })]);
  assert.equal(a.body.order.id, b.body.order.id);
  const list = (await api('GET', '/api/orders', { user: BOB })).body.orders;
  assert.equal(list.filter((o) => o.nickname === 'Dup').length, 1);
  assert.equal(list.length, 1);
  const files = fs.readdirSync(uploadDir, { recursive: true }).filter((f) => /\.(png|jpg|webp)$/.test(String(f)));
  const rows = (await mod.db.query('SELECT count(*) AS n FROM squad_submissions')).rows[0].n;
  assert.equal(files.length, Number(rows), 'no orphaned uploads');
});

test('users only see their own orders', async () => {
  const mine = (await submit(ALICE, { nickname: 'AliceOnly' })).body.order;
  const bobList = (await api('GET', '/api/orders', { user: BOB })).body.orders;
  assert.ok(!bobList.some((o) => o.id === mine.id));
  assert.equal((await api('GET', `/api/orders/${mine.id}`, { user: BOB })).status, 404);
  assert.equal((await api('POST', `/api/orders/${mine.id}/payment`, { user: BOB, json: {} })).status, 404);
  assert.equal((await api('POST', `/api/orders/${mine.id}/upgrade`, { user: BOB, json: { plan: 'express' } })).status, 404);
  assert.equal((await api('GET', `/api/orders/${mine.id}`, { user: ALICE })).status, 200);
  assert.equal((await api('GET', '/api/orders/not-a-uuid', { user: ALICE })).status, 404);
});

test('non-admins cannot use admin API', async () => {
  for (const [m, u] of [['GET', '/api/admin/overview'], ['GET', '/api/admin/orders'], ['GET', '/api/admin/queue'], ['GET', '/api/admin/settings']]) {
    assert.equal((await api(m, u, { user: ALICE })).status, 403, u);
    assert.equal((await api(m, u)).status, 401, u);
  }
  assert.equal((await api('PUT', '/api/admin/settings', { user: ALICE, json: { standardPrice: 1 } })).status, 403);
});

test('paid flow: server-side price, pending payment, user cannot self-confirm, admin confirms', async () => {
  const cfg = (await api('GET', '/api/config', { user: ALICE })).body;
  const std = cfg.plans.find((p) => p.code === 'standard');
  const r = await submit(ALICE, { plan: 'standard', nickname: 'Payer' });
  const o = r.body.order;
  assert.equal(o.paymentStatus, 'pending');
  assert.equal(o.price, std.price);
  assert.equal(o.queuePosition, null, 'unpaid orders are not queued');
  assert.equal(o.canReportPayment, true);

  const rep = await api('POST', `/api/orders/${o.id}/payment`, { user: ALICE, json: { reference: 'TX-123' } });
  assert.equal(rep.status, 200);
  assert.equal(rep.body.order.paymentStatus, 'pending', 'reporting a payment must not mark it paid');
  assert.equal(rep.body.order.paymentReference, 'TX-123');
  const adminMsg = await waitFor(() => fake.calls.find((c) => c.method === 'sendMessage' && String(c.body.chat_id) === String(ADMIN.id) && c.body.text.includes('Платёж отмечен') && c.body.text.includes(o.code)));
  assert.ok(adminMsg, 'admin notified');
  assert.match(JSON.stringify(adminMsg.body.reply_markup), /pay:confirm:/);

  assert.equal((await api('POST', `/api/admin/orders/${o.id}/payment`, { user: ALICE, json: { action: 'confirm' } })).status, 403);
  assert.equal((await adminPatch(o.id, { evalStatus: 'being_evaluated' })).status, 409, 'cannot progress unpaid order');
  assert.equal((await adminPatch(o.id, { publishStatus: 'published', videoUrl: 'https://www.tiktok.com/@x/video/1' })).status, 409);

  const c = await api('POST', `/api/admin/orders/${o.id}/payment`, { user: ADMIN, json: { action: 'confirm' } });
  assert.equal(c.status, 200);
  assert.equal(c.body.order.paymentStatus, 'confirmed');
  assert.equal(c.body.order.evalStatus, 'in_queue');
  assert.ok(c.body.order.queuePosition >= 1);
  assert.equal((await api('POST', `/api/admin/orders/${o.id}/payment`, { user: ADMIN, json: { action: 'confirm' } })).status, 409, 'double confirm rejected');
  assert.ok(await waitFor(() => msgsTo(111).find((m) => m.body.text.includes('Платёж подтверждён') && m.body.text.includes(o.code))));
  const mine = (await api('GET', `/api/orders/${o.id}`, { user: ALICE })).body.order;
  assert.equal(mine.paymentStatus, 'confirmed');
});

test('queue priority: Express > Standard > Free, and manual reordering', async () => {
  await mod.db.query('DELETE FROM squad_submissions'); // clean slate
  const free1 = (await submit(ALICE, { nickname: 'F1' })).body.order;
  const std1 = (await submit(BOB, { plan: 'standard', nickname: 'S1' })).body.order;
  const exp1 = (await submit(ALICE, { plan: 'express', nickname: 'E1' })).body.order;
  const confirm = (id) => api('POST', `/api/admin/orders/${id}/payment`, { user: ADMIN, json: { action: 'confirm' } });
  await confirm(std1.id);
  assert.deepEqual(await queueCodes(), [std1.code, free1.code]);
  await confirm(exp1.id);
  assert.deepEqual(await queueCodes(), [exp1.code, std1.code, free1.code], 'express jumps ahead of standard and free');
  const free2 = (await submit(BOB, { nickname: 'F2' })).body.order;
  const std2 = (await submit(BOB, { plan: 'standard', nickname: 'S2' })).body.order;
  await confirm(std2.id);
  assert.deepEqual(await queueCodes(), [exp1.code, std1.code, std2.code, free1.code, free2.code]);

  const mv = await api('POST', '/api/admin/queue/move', { user: ADMIN, json: { orderId: free2.id, position: 0 } });
  assert.equal(mv.status, 200);
  assert.deepEqual(mv.body.queue.map((o) => o.code), [free2.code, exp1.code, std1.code, std2.code, free1.code]);
  assert.equal((await api('POST', '/api/admin/queue/move', { user: ADMIN, json: { orderId: free2.id, position: -1 } })).status, 400);
  assert.equal((await api('POST', '/api/admin/queue/move', { user: ALICE, json: { orderId: free2.id, position: 1 } })).status, 403);

  const exp2 = (await submit(ALICE, { plan: 'express', nickname: 'E2' })).body.order;
  await confirm(exp2.id);
  assert.deepEqual(await queueCodes(), [free2.code, exp1.code, exp2.code, std1.code, std2.code, free1.code],
    'a new express goes ahead of all standard/free orders, while respecting the admin\'s manual placement');
  const mineF2 = (await api('GET', `/api/orders/${free2.id}`, { user: BOB })).body.order;
  assert.equal(mineF2.queuePosition, 1);
});

test('evaluation + publication lifecycle with notifications', async () => {
  const o = (await submit(ALICE, { plan: 'express', nickname: 'Star' })).body.order;
  await api('POST', `/api/admin/orders/${o.id}/payment`, { user: ADMIN, json: { action: 'confirm' } });

  let r = await adminPatch(o.id, { evalStatus: 'being_evaluated' });
  assert.equal(r.status, 200);
  assert.equal(r.body.order.queuePosition, null, 'leaves waiting queue');
  assert.ok(await waitFor(() => msgsTo(111).find((m) => m.body.text.includes('Оценка началась') && m.body.text.includes(o.code))));
  assert.ok((await api('GET', '/api/admin/queue', { user: ADMIN })).body.inProgress.some((x) => x.id === o.id));
  // user cannot see rating until evaluated
  r = await adminPatch(o.id, { ratingScore: 87.5, ratingNote: 'Strong attack, weak bench' });
  assert.equal((await api('GET', `/api/orders/${o.id}`, { user: ALICE })).body.order.ratingScore, null);

  assert.equal((await adminPatch(o.id, { ratingScore: 101 })).status, 400);
  r = await adminPatch(o.id, { evalStatus: 'evaluated' });
  assert.equal(r.body.order.evalStatus, 'evaluated');
  const done = await waitFor(() => msgsTo(111).find((m) => m.body.text.includes('оценён') && m.body.text.includes('87.5')));
  assert.ok(done);
  assert.equal((await api('GET', `/api/orders/${o.id}`, { user: ALICE })).body.order.ratingScore, 87.5);

  assert.equal((await adminPatch(o.id, { publishStatus: 'published' })).status, 400, 'needs a url');
  for (const bad of ['javascript:alert(1)', 'http://tiktok.com/x', 'https://evil.com/tiktok.com', 'https://tiktok.com.evil.com/x', 'not a url']) {
    assert.equal((await adminPatch(o.id, { videoUrl: bad })).status, 400, bad);
  }
  const url = 'https://www.tiktok.com/@nonchalantfc/video/7300000000000000000';
  r = await adminPatch(o.id, { publishStatus: 'published', videoUrl: url });
  assert.equal(r.status, 200);
  assert.equal(r.body.order.publishStatus, 'published');
  const pub = await waitFor(() => msgsTo(111).find((m) => m.body.text.includes('в видео на TikTok') && m.body.text.includes(o.code)));
  assert.ok(pub);
  assert.match(JSON.stringify(pub.body.reply_markup), /tiktok\.com/);
  const mine = (await api('GET', `/api/orders/${o.id}`, { user: ALICE })).body.order;
  assert.equal(mine.videoUrl, url);
  assert.equal(mine.publishStatus, 'published');
});

test('hall of fame shows only published, rated squads without private data', async () => {
  const r = await api('GET', '/api/hall', { user: BOB });
  assert.equal(r.status, 200);
  const star = r.body.entries.find((e) => e.nickname === 'Star');
  assert.ok(star, 'published squad is listed');
  assert.match(star.videoUrl, /tiktok\.com/);
  assert.equal(star.uid, undefined);
  assert.equal(star.userId, undefined);
  assert.ok(r.body.stats.published >= 1);
  for (let i = 1; i < r.body.entries.length; i++) assert.ok(r.body.entries[i - 1].ratingScore >= r.body.entries[i].ratingScore);
  assert.equal((await api('GET', '/api/hall')).status, 401);
});

test('reject payment, user resubmits reference, admin confirms', async () => {
  const o = (await submit(BOB, { plan: 'standard', nickname: 'Retry' })).body.order;
  assert.equal((await api('POST', `/api/admin/orders/${o.id}/payment`, { user: ADMIN, json: { action: 'reject' } })).body.order.paymentStatus, 'rejected');
  assert.ok(await waitFor(() => msgsTo(222).find((m) => m.body.text.includes('Платёж не подтверждён'))));
  const rep = await api('POST', `/api/orders/${o.id}/payment`, { user: BOB, json: { reference: 'NEW-REF' } });
  assert.equal(rep.body.order.paymentStatus, 'pending');
  assert.equal((await api('POST', `/api/admin/orders/${o.id}/payment`, { user: ADMIN, json: { action: 'confirm' } })).body.order.paymentStatus, 'confirmed');
  assert.equal((await api('POST', `/api/orders/${o.id}/payment`, { user: BOB, json: {} })).status, 409, 'nothing more to report');
});

test('upgrade a free order to Express', async () => {
  const o = (await submit(BOB, { nickname: 'Upg' })).body.order;
  assert.equal(o.canUpgrade, true);
  assert.equal((await api('POST', `/api/orders/${o.id}/upgrade`, { user: BOB, json: { plan: 'free' } })).status, 400);
  const u = (await api('POST', `/api/orders/${o.id}/upgrade`, { user: BOB, json: { plan: 'express' } })).body.order;
  assert.equal(u.plan.code, 'express');
  assert.equal(u.paymentStatus, 'pending');
  assert.equal(u.queuePosition, null);
  assert.equal((await api('POST', `/api/orders/${o.id}/upgrade`, { user: BOB, json: { plan: 'standard' } })).status, 409);
});

test('pricing is configurable and applies immediately', async () => {
  const before = (await submit(ALICE, { plan: 'standard', nickname: 'OldPrice' })).body.order;
  const bad = await api('PUT', '/api/admin/settings', { user: ADMIN, json: { standardPrice: -3 } });
  assert.equal(bad.status, 400);
  const put = await api('PUT', '/api/admin/settings', { user: ADMIN, json: { standardPrice: 7.5, expressPrice: 20, currency: 'eur', paymentInstructions: 'Pay to IBAN 123' } });
  assert.equal(put.status, 200);
  const cfg = (await api('GET', '/api/config', { user: BOB })).body;
  assert.equal(cfg.currency, 'EUR');
  assert.equal(cfg.paymentInstructions, 'Pay to IBAN 123');
  assert.equal(cfg.plans.find((p) => p.code === 'standard').price, 7.5);
  assert.equal(cfg.plans.find((p) => p.code === 'express').price, 20);
  const after = (await submit(ALICE, { plan: 'express', nickname: 'NewPrice' })).body.order;
  assert.equal(after.price, 20);
  assert.equal(after.currency, 'EUR');
  assert.notEqual((await api('GET', `/api/orders/${before.id}`, { user: ALICE })).body.order.price, 7.5, 'existing orders keep their price');
});

test('admin overview, search and filters, delete', async () => {
  const ov = (await api('GET', '/api/admin/overview', { user: ADMIN })).body.overview;
  const total = Number((await mod.db.query('SELECT count(*) n FROM orders')).rows[0].n);
  assert.equal(ov.totalSubmissions, total);
  assert.ok(ov.paidOrders >= 3 && ov.pendingPayments >= 1 && ov.published >= 1 && ov.awaitingEvaluation >= 1);
  assert.ok(ov.revenue.length >= 1 && ov.revenue[0].total > 0);
  const exact = (await mod.db.query(`SELECT sum(price) s FROM orders WHERE plan_code<>'free' AND payment_status='confirmed' AND currency=$1`, [ov.revenue[0].currency])).rows[0].s;
  assert.equal(ov.revenue[0].total, Number(exact));

  const byNick = (await api('GET', '/api/admin/orders?q=star', { user: ADMIN })).body;
  assert.equal(byNick.orders.length, 1);
  const o = byNick.orders[0];
  assert.equal(o.username, 'alice');
  assert.equal((await api('GET', `/api/admin/orders?q=${o.code}`, { user: ADMIN })).body.orders.length, 1);
  assert.ok((await api('GET', '/api/admin/orders?q=1234567', { user: ADMIN })).body.orders.length >= 1);
  assert.equal((await api('GET', '/api/admin/orders?q=%25', { user: ADMIN })).body.orders.length, 0, 'wildcards are escaped');
  const ex = (await api('GET', '/api/admin/orders?plan=express', { user: ADMIN })).body.orders;
  assert.ok(ex.length > 0 && ex.every((x) => x.plan.code === 'express'));
  assert.ok((await api('GET', '/api/admin/orders?plan=free', { user: ADMIN })).body.orders.every((x) => x.plan.code === 'free'));

  const full = await api('GET', o.imageUrl);
  assert.equal(full.status, 200);
  assert.equal((await api('DELETE', `/api/admin/orders/${o.id}`, { user: ADMIN })).status, 200);
  assert.equal((await api('GET', `/api/admin/orders/${o.id}`, { user: ADMIN })).status, 404);
  assert.equal((await api('GET', `/api/orders/${o.id}`, { user: ALICE })).status, 404);
});

test('rejecting a submission removes it from the queue and notifies the user', async () => {
  const o = (await submit(ALICE, { nickname: 'Spam' })).body.order;
  const r = await adminPatch(o.id, { evalStatus: 'rejected', adminNote: 'blurry' });
  assert.equal(r.body.order.evalStatus, 'rejected');
  assert.equal(r.body.order.queuePosition, null);
  assert.ok(await waitFor(() => msgsTo(111).find((m) => m.body.text.includes('отклонён') && m.body.text.includes(o.code))));
  assert.equal((await api('GET', `/api/orders/${o.id}`, { user: ALICE })).body.order.adminNote, undefined, 'admin notes never reach users');
});

test('Telegram bot: admin inline confirm works, non-admin is refused', async () => {
  const o = (await submit(BOB, { plan: 'standard', nickname: 'BotPay' })).body.order;
  fake.calls.length = 0;
  await mod.bot.handleUpdate({ update_id: 1, callback_query: { id: 'cb1', from: { id: BOB.id }, data: `pay:confirm:${o.id}`, message: { chat: { id: BOB.id }, message_id: 5 } } });
  assert.equal((await api('GET', `/api/admin/orders/${o.id}`, { user: ADMIN })).body.order.paymentStatus, 'pending', 'non-admin callback ignored');
  assert.ok(fake.calls.some((c) => c.method === 'answerCallbackQuery' && /Нет доступа/.test(c.body.text)));
  await mod.bot.handleUpdate({ update_id: 2, callback_query: { id: 'cb2', from: { id: ADMIN.id }, data: `pay:confirm:${o.id}`, message: { chat: { id: ADMIN.id }, message_id: 6 } } });
  assert.equal((await api('GET', `/api/admin/orders/${o.id}`, { user: ADMIN })).body.order.paymentStatus, 'confirmed');
  // /start opens the mini app, /admin only for admins
  fake.calls.length = 0;
  await mod.bot.handleUpdate({ update_id: 3, message: { text: '/start', chat: { id: 111, type: 'private' }, from: { id: 111, first_name: 'Alice' } } });
  assert.match(JSON.stringify(fake.calls.at(-1).body.reply_markup), /web_app.*app\.example\.com/);
  await mod.bot.handleUpdate({ update_id: 4, message: { text: '/admin', chat: { id: 111, type: 'private' }, from: { id: 111 } } });
  assert.equal(fake.calls.at(-1).body.text, 'Недоступно.');
  await mod.bot.handleUpdate({ update_id: 5, message: { text: '/admin', chat: { id: ADMIN.id, type: 'private' }, from: { id: ADMIN.id } } });
  assert.match(JSON.stringify(fake.calls.at(-1).body.reply_markup), /app\.example\.com\/admin/);
});

test('failed Telegram delivery is recorded (blocked user) and never breaks the order', async () => {
  const GHOST = { id: 666, first_name: 'Ghost' };
  const r = await submit(GHOST, { nickname: 'Blocked' });
  assert.equal(r.status, 201);
  const row = await waitFor(async () => null, 1).catch(() => null);
  await sleep(300);
  const n = (await mod.db.query(`SELECT status, error FROM notifications WHERE user_id=666`)).rows[0];
  assert.equal(n.status, 'failed');
  assert.match(n.error, /blocked/);
});

test('webhook endpoint is closed unless enabled with the secret', async () => {
  const r = await fetch(base + '/telegram/webhook', { method: 'POST', body: '{}' });
  assert.equal(r.status, 403);
});

test('health and unknown routes', async () => {
  assert.equal((await api('GET', '/api/health')).status, 200);
  assert.equal((await api('GET', '/api/nope')).status, 404);
  const h = await fetch(base + '/api/health');
  assert.ok(h.headers.get('content-security-policy'));
});
