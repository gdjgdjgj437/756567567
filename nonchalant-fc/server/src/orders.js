import crypto from 'node:crypto';
import { query, tx } from './db.js';
import { config } from './config.js';
import { HttpError, bad } from './http.js';
import { saveImage, deleteImage, sniffImage } from './storage.js';
import { signToken } from './auth.js';
import { queueNotification, deliverAll } from './notify.js';
import { esc, webAppButton } from './telegram.js';

export const PLAN_CODES = ['free', 'standard', 'express'];
export const EVAL_STATUSES = ['submitted', 'in_queue', 'being_evaluated', 'evaluated', 'rejected'];
const WAITING = ['submitted', 'in_queue'];
const MAX_PENDING_PAYMENTS = 5;

const num = (v) => (v === null || v === undefined ? v : Number(v));
const fmtMoney = (amount, currency) => `${Number(amount).toFixed(2)} ${currency}`;

// ------------------------------------------------------------------ settings / plans
export async function getSettings(q = query) {
  const [plans, settings] = await Promise.all([
    q('SELECT * FROM plans ORDER BY priority DESC'),
    q('SELECT key, value FROM settings'),
  ]);
  const s = Object.fromEntries(settings.rows.map((r) => [r.key, r.value]));
  return {
    currency: s.currency || 'USD',
    paymentInstructions: s.payment_instructions || '',
    plans: plans.rows.map((p) => ({
      code: p.code, name: p.name, price: num(p.price), priority: p.priority, guaranteedFeature: p.guaranteed_feature,
    })),
  };
}

export async function updateSettings(body) {
  const out = {};
  const price = (v, label) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) throw bad(`Цена «${label}» должна быть числом больше 0.`);
    return Math.round(n * 100) / 100;
  };
  if (body.standardPrice !== undefined) out.standard = price(body.standardPrice, 'Стандарт');
  if (body.expressPrice !== undefined) out.express = price(body.expressPrice, 'Экспресс');
  let currency;
  if (body.currency !== undefined) {
    currency = String(body.currency).trim().toUpperCase();
    if (!/^[A-Z0-9]{2,6}$/.test(currency)) throw bad('Валюта: от 2 до 6 букв или цифр, например USD, EUR, UAH, USDT.');
  }
  let instructions;
  if (body.paymentInstructions !== undefined) {
    instructions = String(body.paymentInstructions).trim();
    if (instructions.length > 2000) throw bad('Инструкция по оплате: не более 2000 символов.');
  }
  await tx(async (c) => {
    for (const [code, p] of Object.entries(out)) await c.query('UPDATE plans SET price=$2, updated_at=now() WHERE code=$1', [code, p]);
    const up = (k, v) => c.query(`INSERT INTO settings(key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, [k, v]);
    if (currency !== undefined) await up('currency', currency);
    if (instructions !== undefined) await up('payment_instructions', instructions);
  });
  return getSettings();
}

// ------------------------------------------------------------------ serialization
const BASE_SELECT = `
  SELECT o.*, s.nickname, s.fc_uid, u.username AS tg_username, u.first_name AS tg_first_name,
         p.name AS plan_name, p.priority AS plan_priority,
         CASE WHEN o.queue_rank IS NULL THEN NULL
              ELSE (SELECT count(*) FROM orders q WHERE q.queue_rank IS NOT NULL AND q.queue_rank <= o.queue_rank) END AS queue_position,
         (SELECT reference FROM payments pay WHERE pay.order_id = o.id ORDER BY pay.created_at DESC LIMIT 1) AS payment_reference,
         (SELECT user_reported_at FROM payments pay WHERE pay.order_id = o.id ORDER BY pay.created_at DESC LIMIT 1) AS payment_reported_at
  FROM orders o
  JOIN squad_submissions s ON s.id = o.submission_id
  JOIN users u ON u.telegram_id = o.user_id
  JOIN plans p ON p.code = o.plan_code`;

function serialize(r, { admin = false } = {}) {
  const paid = r.plan_code !== 'free';
  const evaluated = r.eval_status === 'evaluated';
  const o = {
    id: r.id,
    code: r.order_code,
    createdAt: r.created_at,
    nickname: r.nickname,
    uid: r.fc_uid,
    plan: { code: r.plan_code, name: r.plan_name },
    price: num(r.price),
    currency: r.currency,
    paymentStatus: r.payment_status,
    evalStatus: r.eval_status,
    publishStatus: r.publish_status,
    videoUrl: r.publish_status === 'published' || admin ? r.video_url : null,
    ratingScore: admin || evaluated ? num(r.rating_score) : null,
    ratingNote: admin || evaluated ? r.rating_note : null,
    queuePosition: r.queue_position == null ? null : Number(r.queue_position),
    paymentReference: r.payment_reference,
    paymentReportedAt: r.payment_reported_at,
    canReportPayment: paid && ['pending', 'rejected'].includes(r.payment_status) && r.eval_status !== 'rejected',
    canUpgrade: !paid && WAITING.includes(r.eval_status),
    imageUrl: `/api/orders/${r.id}/image?t=${encodeURIComponent(signToken(`img:${r.id}`, 3600))}`,
  };
  if (admin) {
    Object.assign(o, {
      userId: r.user_id, username: r.tg_username, firstName: r.tg_first_name, adminNote: r.admin_note,
      paymentConfirmedAt: r.payment_confirmed_at, evaluatedAt: r.evaluated_at, publishedAt: r.published_at,
      updatedAt: r.updated_at, queueRank: num(r.queue_rank),
    });
  }
  return o;
}

export async function hallOfFame() {
  const r = await query(`
    SELECT s.nickname, o.rating_score, o.plan_code, p.name AS plan_name, o.video_url, o.published_at
    FROM orders o JOIN squad_submissions s ON s.id = o.submission_id JOIN plans p ON p.code = o.plan_code
    WHERE o.publish_status = 'published' AND o.eval_status = 'evaluated' AND o.rating_score IS NOT NULL
    ORDER BY o.rating_score DESC, o.published_at DESC LIMIT 20`);
  const st = await query(`SELECT count(*) FILTER (WHERE eval_status = 'evaluated') AS evaluated,
                                 count(*) FILTER (WHERE publish_status = 'published') AS published FROM orders`);
  return {
    stats: { evaluated: Number(st.rows[0].evaluated), published: Number(st.rows[0].published) },
    entries: r.rows.map((x) => ({
      nickname: x.nickname, ratingScore: num(x.rating_score), plan: { code: x.plan_code, name: x.plan_name },
      videoUrl: x.video_url, publishedAt: x.published_at,
    })),
  };
}

export async function listUserOrders(userId) {
  const r = await query(`${BASE_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT 200`, [userId]);
  return r.rows.map((x) => serialize(x));
}

export async function getUserOrder(userId, orderId) {
  if (!isUuid(orderId)) throw notFound();
  const r = await query(`${BASE_SELECT} WHERE o.id = $1 AND o.user_id = $2`, [orderId, userId]);
  if (!r.rows[0]) throw notFound();
  return serialize(r.rows[0]);
}

const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
const notFound = () => new HttpError(404, 'Заказ не найден.', 'not_found');

// ------------------------------------------------------------------ queue
async function lockQueue(c) { await c.query('SELECT pg_advisory_xact_lock(7001)'); }

async function renumber(c, ids) {
  if (!ids.length) return;
  await c.query(
    `UPDATE orders o SET queue_rank = t.ord * 1024
     FROM unnest($1::uuid[]) WITH ORDINALITY AS t(id, ord) WHERE o.id = t.id`, [ids]);
}

/** Insert an order into the waiting queue at its default position: after everything of equal or higher priority. */
async function enqueue(c, orderId) {
  await lockQueue(c);
  const me = await c.query('SELECT p.priority FROM orders o JOIN plans p ON p.code=o.plan_code WHERE o.id=$1', [orderId]);
  const prio = me.rows[0].priority;
  const rows = (await c.query(
    `SELECT o.id, p.priority FROM orders o JOIN plans p ON p.code=o.plan_code
     WHERE o.queue_rank IS NOT NULL AND o.id <> $1 ORDER BY o.queue_rank, o.created_at`, [orderId])).rows;
  let idx = 0;
  rows.forEach((r, i) => { if (r.priority <= prio) idx = i + 1; });
  const ids = rows.map((r) => r.id);
  ids.splice(idx, 0, orderId);
  await renumber(c, ids);
}
const dequeue = (c, orderId) => c.query('UPDATE orders SET queue_rank = NULL WHERE id = $1', [orderId]);

export async function getQueue() {
  const waiting = await query(`${BASE_SELECT} WHERE o.queue_rank IS NOT NULL ORDER BY o.queue_rank, o.created_at`);
  const progress = await query(`${BASE_SELECT} WHERE o.eval_status = 'being_evaluated' ORDER BY o.updated_at`);
  return { queue: waiting.rows.map((r) => serialize(r, { admin: true })), inProgress: progress.rows.map((r) => serialize(r, { admin: true })) };
}

export async function moveInQueue(orderId, position) {
  if (!isUuid(orderId)) throw notFound();
  const pos = Number(position);
  if (!Number.isInteger(pos) || pos < 0) throw bad('Позиция должна быть целым числом от 0.');
  await tx(async (c) => {
    await lockQueue(c);
    const ids = (await c.query('SELECT id FROM orders WHERE queue_rank IS NOT NULL ORDER BY queue_rank, created_at')).rows.map((r) => r.id);
    const from = ids.indexOf(orderId);
    if (from === -1) throw new HttpError(409, 'Этого заказа нет в очереди ожидания.', 'not_in_queue');
    ids.splice(from, 1);
    ids.splice(Math.min(pos, ids.length), 0, orderId);
    await renumber(c, ids);
  });
  return getQueue();
}

// ------------------------------------------------------------------ notifications helpers
async function notifyAdmins(c, orderId, type, message, replyMarkup) {
  const ids = [];
  for (const a of config.adminIds) ids.push(await queueNotification(c, { userId: a, orderId, type, message, replyMarkup }));
  return ids;
}
const dashButton = () => (config.appUrl ? webAppButton('Открыть панель', `${config.appUrl}/admin`) : null);
const myOrdersButton = () => (config.appUrl ? webAppButton('Открыть мои заказы', config.appUrl) : null);

// ------------------------------------------------------------------ create
function cleanText(v, label, min, max) {
  const s = String(v ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (s.length < min) throw bad(`Поле «${label}» обязательно.`, 'validation');
  if (s.length > max) throw bad(`Поле «${label}»: не более ${max} символов.`, 'validation');
  return s;
}

export async function createOrder(user, { nickname, uid, plan, file, idempotencyKey }) {
  nickname = cleanText(nickname, 'Никнейм', 1, 40);
  uid = cleanText(uid, 'UID', 1, 40);
  if (!/^[A-Za-z0-9]{4,24}$/.test(uid)) throw bad('UID должен состоять из 4–24 букв или цифр без пробелов.', 'validation');
  plan = String(plan || 'free');
  if (!PLAN_CODES.includes(plan)) throw bad('Неизвестный тариф.', 'validation');
  if (idempotencyKey != null && idempotencyKey !== '' && !/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) throw bad('Неверный ключ запроса.');
  idempotencyKey = idempotencyKey || null;

  if (idempotencyKey) {
    const ex = await query('SELECT id FROM orders WHERE user_id=$1 AND idempotency_key=$2', [user.id, idempotencyKey]);
    if (ex.rows[0]) return { order: await getUserOrder(user.id, ex.rows[0].id), duplicate: true };
  }

  if (!file || !file.data?.length) throw bad('Прикрепите скриншот состава.', 'validation');
  if (file.data.length > config.maxUploadBytes) throw new HttpError(413, `Скриншот слишком большой (максимум ${Math.round(config.maxUploadBytes / 1048576)} МБ).`, 'too_large');
  const kind = sniffImage(file.data);
  if (!kind) throw bad('Скриншот должен быть изображением JPG, PNG или WEBP.', 'validation');

  if (plan !== 'free') {
    const pend = await query(`SELECT count(*) AS n FROM orders WHERE user_id=$1 AND payment_status='pending'`, [user.id]);
    if (Number(pend.rows[0].n) >= MAX_PENDING_PAYMENTS) throw new HttpError(409, 'У вас уже есть несколько неоплаченных заказов. Сначала оплатите их или дождитесь проверки.', 'too_many_pending');
  }

  const imageKey = await saveImage(file.data, kind.ext, kind.mime);
  let notifIds = [];
  try {
    const order = await tx(async (c) => {
      const cfg = await getSettings((t, p) => c.query(t, p));
      const p = cfg.plans.find((x) => x.code === plan);
      const paid = plan !== 'free';
      const sub = await c.query(
        `INSERT INTO squad_submissions (user_id, nickname, fc_uid, image_key, image_mime) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [user.id, nickname, uid, imageKey, kind.mime]);
      let code;
      for (;;) {
        code = 'NFC-' + Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join('');
        if (!(await c.query('SELECT 1 FROM orders WHERE order_code=$1', [code])).rows[0]) break;
      }
      const o = await c.query(
        `INSERT INTO orders (order_code, user_id, submission_id, plan_code, price, currency, payment_status, eval_status, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'submitted',$8) RETURNING id`,
        [code, user.id, sub.rows[0].id, plan, paid ? p.price : 0, cfg.currency, paid ? 'pending' : 'not_required', idempotencyKey]);
      const id = o.rows[0].id;
      if (paid) {
        await c.query(`INSERT INTO payments (order_id, user_id, amount, currency, method) VALUES ($1,$2,$3,$4,'manual')`, [id, user.id, p.price, cfg.currency]);
      } else {
        await enqueue(c, id);
      }
      const msg = paid
        ? `<b>Заказ ${esc(code)} создан</b>\nТариф «${esc(p.name)}» · ${esc(fmtMoney(p.price, cfg.currency))}\n\nВаш состав сохранён. Оплатите заказ по инструкции в приложении. Место в видео подтвердится после проверки платежа.`
        : `<b>Состав получен</b>\nЗаказ ${esc(code)} в очереди на бесплатную оценку.\n\nБесплатные заявки обрабатываются после платных, и появление в видео TikTok не гарантируется.`;
      notifIds.push(await queueNotification(c, { userId: user.id, orderId: id, type: 'submission_received', message: msg, replyMarkup: myOrdersButton() }));
      if (paid) {
        notifIds.push(...await notifyAdmins(c, id, 'admin_new_order',
          `<b>Новый заказ «${esc(p.name)}» ${esc(code)}</b>\n${esc(nickname)} · UID ${esc(uid)}\n${esc(fmtMoney(p.price, cfg.currency))} · ожидает оплаты`, dashButton()));
      }
      return id;
    });
    deliverAll(notifIds);
    return { order: await getUserOrder(user.id, order), duplicate: false };
  } catch (e) {
    await deleteImage(imageKey);
    if (e.code === '23505' && idempotencyKey) {
      const ex = await query('SELECT id FROM orders WHERE user_id=$1 AND idempotency_key=$2', [user.id, idempotencyKey]);
      if (ex.rows[0]) return { order: await getUserOrder(user.id, ex.rows[0].id), duplicate: true };
    }
    throw e;
  }
}

// ------------------------------------------------------------------ upgrade a free order to a paid plan
export async function upgradeOrder(user, orderId, plan) {
  if (!isUuid(orderId)) throw notFound();
  if (!['standard', 'express'].includes(plan)) throw bad('Выберите тариф Стандарт или Экспресс.', 'validation');
  const ids = [];
  await tx(async (c) => {
    const r = await c.query('SELECT * FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE', [orderId, user.id]);
    const o = r.rows[0];
    if (!o) throw notFound();
    if (o.plan_code !== 'free' || !WAITING.includes(o.eval_status)) throw new HttpError(409, 'Этот заказ больше нельзя улучшить.', 'not_upgradable');
    const pend = await c.query(`SELECT count(*) AS n FROM orders WHERE user_id=$1 AND payment_status='pending'`, [user.id]);
    if (Number(pend.rows[0].n) >= MAX_PENDING_PAYMENTS) throw new HttpError(409, 'У вас уже есть несколько неоплаченных заказов.', 'too_many_pending');
    const cfg = await getSettings((t, p) => c.query(t, p));
    const p = cfg.plans.find((x) => x.code === plan);
    await c.query(
      `UPDATE orders SET plan_code=$2, price=$3, currency=$4, payment_status='pending', eval_status='submitted', queue_rank=NULL, updated_at=now() WHERE id=$1`,
      [orderId, plan, p.price, cfg.currency]);
    await c.query(`INSERT INTO payments (order_id, user_id, amount, currency, method) VALUES ($1,$2,$3,$4,'manual')`, [orderId, user.id, p.price, cfg.currency]);
    ids.push(await queueNotification(c, { userId: user.id, orderId, type: 'order_upgraded',
      message: `<b>Заказ ${esc(o.order_code)} улучшен до «${esc(p.name)}»</b>\n${esc(fmtMoney(p.price, cfg.currency))} · ожидает оплаты.\nОткройте приложение, чтобы узнать, как оплатить.`, replyMarkup: myOrdersButton() }));
    ids.push(...await notifyAdmins(c, orderId, 'admin_new_order',
      `<b>${esc(o.order_code)} upgraded to ${esc(p.name)}</b>\n${esc(fmtMoney(p.price, cfg.currency))} · awaiting payment`, dashButton()));
  });
  deliverAll(ids);
  return getUserOrder(user.id, orderId);
}

// ------------------------------------------------------------------ payments
/** The user says they've paid. This NEVER marks the order as paid; it only flags it for admin review. */
export async function reportPayment(user, orderId, reference) {
  if (!isUuid(orderId)) throw notFound();
  const ref = String(reference ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) || null;
  const ids = [];
  await tx(async (c) => {
    const r = await c.query('SELECT o.*, s.nickname FROM orders o JOIN squad_submissions s ON s.id=o.submission_id WHERE o.id=$1 AND o.user_id=$2 FOR UPDATE OF o', [orderId, user.id]);
    const o = r.rows[0];
    if (!o) throw notFound();
    if (o.plan_code === 'free' || !['pending', 'rejected'].includes(o.payment_status) || o.eval_status === 'rejected') {
      throw new HttpError(409, 'Для этого заказа оплата не нужна.', 'no_payment_needed');
    }
    if (o.payment_status === 'rejected') {
      await c.query(`UPDATE orders SET payment_status='pending', updated_at=now() WHERE id=$1`, [orderId]);
      await c.query(`INSERT INTO payments (order_id, user_id, amount, currency, method, reference, user_reported_at) VALUES ($1,$2,$3,$4,'manual',$5,now())`,
        [orderId, user.id, o.price, o.currency, ref]);
    } else {
      await c.query(
        `UPDATE payments SET reference=$2, user_reported_at=now()
         WHERE id = (SELECT id FROM payments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1)`, [orderId, ref]);
    }
    ids.push(...await notifyAdmins(c, orderId, 'admin_payment_reported',
      `<b>Платёж отмечен · ${esc(o.order_code)}</b>\n${esc(o.nickname)} сообщает, что оплатил ${esc(fmtMoney(o.price, o.currency))}${ref ? `\nДанные платежа: <code>${esc(ref)}</code>` : ''}\n\nПроверьте поступление в своём платёжном аккаунте и подтвердите.`,
      { inline_keyboard: [[
        { text: 'Подтвердить платёж', callback_data: `pay:confirm:${orderId}` },
        { text: 'Отклонить', callback_data: `pay:reject:${orderId}` },
      ]] }));
  });
  deliverAll(ids);
  return getUserOrder(user.id, orderId);
}

export async function reviewPayment(adminId, orderId, action) {
  if (!isUuid(orderId)) throw notFound();
  if (!['confirm', 'reject'].includes(action)) throw bad('Действие должно быть confirm или reject.');
  const ids = [];
  await tx(async (c) => {
    const r = await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    const o = r.rows[0];
    if (!o) throw notFound();
    if (o.plan_code === 'free') throw new HttpError(409, 'Бесплатные заказы не требуют оплаты.', 'no_payment_needed');
    if (action === 'confirm') {
      if (o.payment_status === 'confirmed') throw new HttpError(409, 'Платёж уже подтверждён.', 'already_confirmed');
      await c.query(`UPDATE payments SET status='confirmed', reviewed_by=$2, reviewed_at=now()
                     WHERE id=(SELECT id FROM payments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1)`, [orderId, adminId]);
      const toQueue = o.eval_status === 'submitted';
      await c.query(
        `UPDATE orders SET payment_status='confirmed', payment_confirmed_at=now(), eval_status=CASE WHEN eval_status='submitted' THEN 'in_queue' ELSE eval_status END, updated_at=now() WHERE id=$1`, [orderId]);
      if (toQueue) await enqueue(c, orderId);
      ids.push(await queueNotification(c, { userId: o.user_id, orderId, type: 'payment_confirmed',
        message: `<b>Платёж подтверждён</b>\nЗаказ ${esc(o.order_code)} подтверждён и добавлен в очередь на видео. Мы сообщим, когда начнётся оценка.`, replyMarkup: myOrdersButton() }));
    } else {
      if (o.payment_status !== 'pending') throw new HttpError(409, `Статус платежа «${o.payment_status}», отклонить его нельзя.`, 'invalid_state');
      await c.query(`UPDATE payments SET status='rejected', reviewed_by=$2, reviewed_at=now()
                     WHERE id=(SELECT id FROM payments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1)`, [orderId, adminId]);
      await c.query(`UPDATE orders SET payment_status='rejected', queue_rank=NULL, updated_at=now() WHERE id=$1`, [orderId]);
      ids.push(await queueNotification(c, { userId: o.user_id, orderId, type: 'payment_rejected',
        message: `<b>Платёж не подтверждён</b>\nНе удалось подтвердить платёж по заказу ${esc(o.order_code)}. Откройте приложение и отправьте данные платежа ещё раз.`, replyMarkup: myOrdersButton() }));
    }
  });
  deliverAll(ids);
  return adminGetOrder(orderId);
}

// ------------------------------------------------------------------ admin: update / delete / read
function validVideoUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || !(h === 'tiktok.com' || h.endsWith('.tiktok.com'))) return null;
  return u.toString();
}

export async function updateOrder(orderId, patch) {
  if (!isUuid(orderId)) throw notFound();
  const ids = [];
  await tx(async (c) => {
    const r = await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    const o = r.rows[0];
    if (!o) throw notFound();
    const payOk = o.plan_code === 'free' || o.payment_status === 'confirmed';
    let ev = o.eval_status, pub = o.publish_status, url = o.video_url;
    let score = o.rating_score, rnote = o.rating_note, anote = o.admin_note;

    if (patch.evalStatus !== undefined) {
      if (!EVAL_STATUSES.includes(patch.evalStatus)) throw bad('Неверный статус оценки.');
      if (!payOk && !['submitted', 'rejected'].includes(patch.evalStatus)) throw new HttpError(409, 'Сначала подтвердите платёж, затем двигайте заказ дальше.', 'payment_required');
      ev = patch.evalStatus;
    }
    if (patch.videoUrl !== undefined) {
      if (patch.videoUrl === null || patch.videoUrl === '') url = null;
      else { url = validVideoUrl(patch.videoUrl); if (!url) throw bad('Ссылка на видео должна быть https-ссылкой на tiktok.com.'); }
    }
    if (patch.ratingScore !== undefined) {
      if (patch.ratingScore === null || patch.ratingScore === '') score = null;
      else { const n = Number(patch.ratingScore); if (!Number.isFinite(n) || n < 0 || n > 100) throw bad('Оценка должна быть от 0 до 100.'); score = Math.round(n * 10) / 10; }
    }
    if (patch.ratingNote !== undefined) { rnote = String(patch.ratingNote ?? '').trim().slice(0, 1000) || null; }
    if (patch.adminNote !== undefined) { anote = String(patch.adminNote ?? '').trim().slice(0, 1000) || null; }
    if (patch.publishStatus !== undefined) {
      if (!['not_published', 'published'].includes(patch.publishStatus)) throw bad('Неверный статус публикации.');
      pub = patch.publishStatus;
    }
    if (pub === 'published') {
      if (!payOk) throw new HttpError(409, 'Сначала подтвердите платёж, затем публикуйте.', 'payment_required');
      if (ev === 'rejected') throw new HttpError(409, 'Отклонённый заказ нельзя опубликовать.', 'invalid_state');
      if (!url) throw bad('Добавьте ссылку на видео TikTok перед публикацией.');
      if (patch.publishStatus === 'published' || o.publish_status === 'published') ev = 'evaluated';
    }

    const queued = payOk && WAITING.includes(ev);
    const becameEvaluated = ev === 'evaluated' && o.eval_status !== 'evaluated';
    const becamePublished = pub === 'published' && o.publish_status !== 'published';
    await c.query(
      `UPDATE orders SET eval_status=$2, publish_status=$3, video_url=$4, rating_score=$5, rating_note=$6, admin_note=$7,
         evaluated_at = CASE WHEN $2='evaluated' THEN COALESCE(evaluated_at, now()) ELSE evaluated_at END,
         published_at = CASE WHEN $3='published' THEN COALESCE(published_at, now()) ELSE NULL END,
         updated_at=now() WHERE id=$1`,
      [orderId, ev, pub, url, score, rnote, anote]);
    if (queued) { if (o.queue_rank == null) await enqueue(c, orderId); } else await dequeue(c, orderId);

    const code = esc(o.order_code);
    if (ev === 'being_evaluated' && o.eval_status !== 'being_evaluated') {
      ids.push(await queueNotification(c, { userId: o.user_id, orderId, type: 'evaluation_started',
        message: `<b>Оценка началась</b>\nВаш состав (заказ ${code}) сейчас оценивается.`, replyMarkup: myOrdersButton() }));
    }
    if (becameEvaluated && !becamePublished) {
      ids.push(await queueNotification(c, { userId: o.user_id, orderId, type: 'evaluation_completed',
        message: `<b>Ваш состав оценён</b>\nЗаказ ${code}${score != null ? ` · Оценка <b>${score}</b>/100` : ''}${rnote ? `\n\n${esc(rnote)}` : ''}`, replyMarkup: myOrdersButton() }));
    }
    if (becamePublished) {
      ids.push(await queueNotification(c, { userId: o.user_id, orderId, type: 'video_published',
        message: `<b>Ваш состав в видео на TikTok</b>\nЗаказ ${code}${score != null ? ` · Оценка <b>${score}</b>/100` : ''}\nСпасибо, что вы с NONCHALANT FC.`,
        replyMarkup: { inline_keyboard: [[{ text: 'Смотреть в TikTok', url }]] } }));
    }
    if (ev === 'rejected' && o.eval_status !== 'rejected') {
      ids.push(await queueNotification(c, { userId: o.user_id, orderId, type: 'order_rejected',
        message: `<b>Заказ ${code} отклонён</b>\nЭту заявку не удалось принять. Отправьте чёткий скриншот всего состава.`, replyMarkup: myOrdersButton() }));
    }
  });
  deliverAll(ids);
  return adminGetOrder(orderId);
}

export async function deleteOrder(orderId) {
  if (!isUuid(orderId)) throw notFound();
  const r = await query(
    `DELETE FROM squad_submissions WHERE id = (SELECT submission_id FROM orders WHERE id=$1) RETURNING image_key`, [orderId]);
  if (!r.rows[0]) throw notFound();
  await deleteImage(r.rows[0].image_key);
  return { ok: true };
}

export async function adminGetOrder(orderId) {
  if (!isUuid(orderId)) throw notFound();
  const r = await query(`${BASE_SELECT} WHERE o.id=$1`, [orderId]);
  if (!r.rows[0]) throw notFound();
  return serialize(r.rows[0], { admin: true });
}

export async function adminListOrders({ plan, q, paymentStatus, evalStatus, limit = 50, offset = 0 }) {
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (plan && PLAN_CODES.includes(plan)) add('o.plan_code = ?', plan);
  if (paymentStatus) add('o.payment_status = ?', String(paymentStatus));
  if (evalStatus) add('o.eval_status = ?', String(evalStatus));
  if (q && String(q).trim()) {
    const like = `%${String(q).trim().replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    params.push(like);
    const i = params.length;
    where.push(`(s.nickname ILIKE $${i} OR s.fc_uid ILIKE $${i} OR o.order_code ILIKE $${i})`);
  }
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await query(`SELECT count(*) AS n FROM orders o JOIN squad_submissions s ON s.id=o.submission_id ${w}`, params);
  const rows = await query(`${BASE_SELECT} ${w} ORDER BY o.created_at DESC LIMIT ${lim} OFFSET ${off}`, params);
  return { total: Number(total.rows[0].n), orders: rows.rows.map((x) => serialize(x, { admin: true })) };
}

export async function overview() {
  const c = (await query(`
    SELECT count(*) AS total,
      count(*) FILTER (WHERE plan_code='free') AS free,
      count(*) FILTER (WHERE plan_code<>'free' AND payment_status='confirmed') AS paid,
      count(*) FILTER (WHERE plan_code='standard' AND payment_status='confirmed') AS standard_paid,
      count(*) FILTER (WHERE plan_code='express' AND payment_status='confirmed') AS express_paid,
      count(*) FILTER (WHERE plan_code<>'free' AND payment_status='pending') AS pending_payments,
      count(*) FILTER (WHERE eval_status IN ('submitted','in_queue','being_evaluated') AND (plan_code='free' OR payment_status='confirmed')) AS awaiting,
      count(*) FILTER (WHERE publish_status='published') AS published
    FROM orders`)).rows[0];
  const rev = await query(`SELECT currency, sum(price) AS total FROM orders WHERE plan_code<>'free' AND payment_status='confirmed' GROUP BY currency ORDER BY currency`);
  const n = (k) => Number(c[k]);
  return {
    totalSubmissions: n('total'), freeSubmissions: n('free'), paidOrders: n('paid'),
    standardPaid: n('standard_paid'), expressPaid: n('express_paid'),
    pendingPayments: n('pending_payments'), awaitingEvaluation: n('awaiting'), published: n('published'),
    revenue: rev.rows.map((r) => ({ currency: r.currency, total: num(r.total) })),
  };
}

export async function imageForOrder(orderId) {
  if (!isUuid(orderId)) throw notFound();
  const r = await query(`SELECT s.image_key, s.image_mime FROM orders o JOIN squad_submissions s ON s.id=o.submission_id WHERE o.id=$1`, [orderId]);
  if (!r.rows[0]) throw notFound();
  return { key: r.rows[0].image_key, mime: r.rows[0].image_mime };
}
