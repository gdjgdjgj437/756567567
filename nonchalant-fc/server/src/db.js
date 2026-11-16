import pg from 'pg';
import { config } from './config.js';

// NUMERIC -> JS number (prices are small, 2 decimals)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// BIGINT -> string (Telegram ids)
pg.types.setTypeParser(20, (v) => v);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

export const query = (text, params) => pool.query(text, params);

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}
