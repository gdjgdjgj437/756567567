import { query } from './db.js';
import { config } from './config.js';
import { sendMessage } from './telegram.js';

/** Insert a notification row (call inside a transaction). Returns its id. */
export async function queueNotification(client, { userId, orderId = null, type, message, replyMarkup = null }) {
  const r = await client.query(
    `INSERT INTO notifications (user_id, order_id, type, message, reply_markup)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [String(userId), orderId, type, message, replyMarkup ? JSON.stringify(replyMarkup) : null],
  );
  return r.rows[0].id;
}

/** Try to deliver one notification. Claims it atomically so it is never sent twice. */
export async function deliver(id) {
  const c = await query(
    `UPDATE notifications SET status='sending', attempts = attempts + 1
     WHERE id=$1 AND status IN ('pending','failed') RETURNING *`, [id]);
  const n = c.rows[0];
  if (!n) return;
  try {
    if (!config.botToken) throw new Error('bot not configured');
    await sendMessage(n.user_id, n.message, n.reply_markup);
    await query(`UPDATE notifications SET status='sent', sent_at=now(), error=NULL WHERE id=$1`, [id]);
  } catch (e) {
    // 403 = user blocked the bot / never started it: retrying is pointless.
    const final = e.tgCode === 403 || e.tgCode === 400;
    await query(`UPDATE notifications SET status='failed', error=$2, attempts = CASE WHEN $3 THEN 99 ELSE attempts END WHERE id=$1`,
      [id, String(e.message).slice(0, 300), final]);
  }
}

export const deliverAll = (ids) => Promise.all(ids.filter(Boolean).map((i) => deliver(i).catch(() => {})));

/** Background retry for notifications that failed or were left pending (e.g. server restart). */
export function startNotificationWorker() {
  const t = setInterval(async () => {
    try {
      const r = await query(
        `SELECT id FROM notifications
         WHERE ((status='pending' AND created_at < now() - interval '30 seconds')
             OR (status='failed' AND attempts < 5 AND created_at > now() - interval '1 day')
             OR (status='sending' AND created_at < now() - interval '5 minutes'))
         ORDER BY id LIMIT 20`);
      for (const row of r.rows) {
        await query(`UPDATE notifications SET status='failed' WHERE id=$1 AND status='sending'`, [row.id]);
        await deliver(row.id);
      }
    } catch { /* DB hiccup, try next tick */ }
  }, 30000);
  t.unref();
  return t;
}
