import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(here, '../..');

// Load .env (root or server/) without overriding real environment variables.
for (const p of [path.join(rootDir, '.env'), path.join(rootDir, 'server', '.env')]) {
  if (fs.existsSync(p)) {
    try { process.loadEnvFile(p); } catch { /* ignore malformed file */ }
  }
}

const env = process.env;
const bool = (v, d = false) => (v == null || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

export const config = {
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT || 3000),

  databaseUrl: env.DATABASE_URL || '',
  databaseSsl: bool(env.DATABASE_SSL, false),

  botToken: env.TELEGRAM_BOT_TOKEN || '',
  botUsername: (env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, ''),
  adminIds: (env.ADMIN_TELEGRAM_IDS || '')
    .split(',').map((s) => s.trim()).filter(Boolean).map(String),
  tgApiBase: (env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/+$/, ''),
  appUrl: (env.APP_URL || '').replace(/\/+$/, ''),
  useWebhook: bool(env.TELEGRAM_USE_WEBHOOK, false),
  webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || '',
  initDataMaxAgeSec: Number(env.INIT_DATA_MAX_AGE_SEC || 86400),

  // Secret used to sign short-lived screenshot URLs. Falls back to the bot token.
  appSecret: env.APP_SECRET || env.TELEGRAM_BOT_TOKEN || '',

  // Storage
  uploadDir: path.resolve(rootDir, env.UPLOAD_DIR || 'uploads'),
  supabaseUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
  supabaseServiceKey: env.SUPABASE_SERVICE_KEY || '',
  supabaseBucket: env.SUPABASE_BUCKET || 'squads',
  ordersPerHour: Number(env.ORDERS_PER_HOUR_LIMIT || 10),
  maxUploadBytes: Number(env.MAX_UPLOAD_MB || 8) * 1024 * 1024,

  // Local development only: lets you use the app in a normal browser.
  devAuthBypass: !(env.NODE_ENV === 'production') && bool(env.DEV_AUTH_BYPASS, false),

  webDist: path.resolve(rootDir, 'web', 'dist'),
};

export function assertProductionConfig() {
  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.botToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!config.adminIds.length) missing.push('ADMIN_TELEGRAM_IDS');
  if (config.isProd && !config.appUrl) missing.push('APP_URL');
  if (config.useWebhook && !config.webhookSecret) missing.push('TELEGRAM_WEBHOOK_SECRET');
  return missing;
}
