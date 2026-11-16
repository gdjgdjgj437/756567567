import crypto from 'node:crypto';
import { config } from './config.js';
import { query } from './db.js';
import { HttpError } from './http.js';

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

/**
 * Verify Telegram Mini App initData.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Returns { user, authDate } or throws Error with a short reason.
 */
export function verifyInitData(initData, botToken, maxAgeSec = 86400, now = Date.now()) {
  if (!initData || typeof initData !== 'string') throw new Error('missing initData');
  if (!botToken) throw new Error('bot token not configured');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('missing hash');
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = hmac('WebAppData', botToken);
  const expected = hmac(secret, dataCheckString).toString('hex');
  const a = Buffer.from(expected, 'hex');
  let b;
  try { b = Buffer.from(hash, 'hex'); } catch { throw new Error('bad hash'); }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('invalid signature');

  const authDate = Number(params.get('auth_date'));
  if (!authDate) throw new Error('missing auth_date');
  if (maxAgeSec > 0 && now / 1000 - authDate > maxAgeSec) throw new Error('initData expired');

  let user;
  try { user = JSON.parse(params.get('user') || ''); } catch { throw new Error('missing user'); }
  if (!user || !user.id) throw new Error('missing user');
  return { user, authDate };
}

// ---- short-lived signed tokens (used for <img> screenshot URLs) ----
export function signToken(payload, ttlSec = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = hmac(config.appSecret, `${payload}.${exp}`).toString('base64url');
  return `${exp}.${sig}`;
}
export function checkToken(payload, token) {
  if (!token || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const good = hmac(config.appSecret, `${payload}.${exp}`).toString('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(good);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const isAdminId = (id) => config.adminIds.includes(String(id));

const lastUpsert = new Map();
async function upsertUser(u) {
  const key = String(u.id);
  const t = lastUpsert.get(key);
  if (t && Date.now() - t < 5 * 60 * 1000) return;
  await query(
    `INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (telegram_id) DO UPDATE SET
       username = EXCLUDED.username, first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name, language_code = EXCLUDED.language_code,
       last_seen_at = now()`,
    [key, u.username || null, u.first_name || null, u.last_name || null, u.language_code || null],
  );
  lastUpsert.set(key, Date.now());
}

/** Authenticates a request via `Authorization: tma <initData>`; returns the user or throws HttpError(401). */
export async function authenticate(req) {
  let tgUser;
  const h = req.headers['authorization'] || '';
  try {
    if (h.startsWith('tma ')) {
      tgUser = verifyInitData(h.slice(4), config.botToken, config.initDataMaxAgeSec).user;
    } else if (config.devAuthBypass && req.headers['x-dev-user']) {
      tgUser = JSON.parse(req.headers['x-dev-user']);
      if (!tgUser?.id) throw new Error('bad dev user');
    } else {
      throw new HttpError(401, 'Откройте приложение через Telegram-бота.', 'unauthorized');
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, 'Не удалось проверить сессию Telegram. Откройте приложение заново через бота.', 'unauthorized');
  }
  await upsertUser(tgUser);
  return {
    id: String(tgUser.id),
    username: tgUser.username || null,
    firstName: tgUser.first_name || '',
    isAdmin: isAdminId(tgUser.id),
  };
}

export function assertAdmin(user) {
  if (!user?.isAdmin) throw new HttpError(403, 'Только для администраторов.', 'forbidden');
}
