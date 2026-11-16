import http from 'node:http';
import { config, assertProductionConfig } from './config.js';
import { pool } from './db.js';
import { migrate } from './migrate.js';
import { router } from './routes.js';
import { HttpError, sendJson, serveStatic, securityHeaders } from './http.js';
import { startBot, stopBot } from './bot.js';
import { startNotificationWorker } from './notify.js';

export function createServer() {
  return http.createServer(async (req, res) => {
    securityHeaders(res);
    const url = new URL(req.url, 'http://x');
    const pathname = url.pathname;
    try {
      if (pathname.startsWith('/api/') || pathname.startsWith('/telegram/')) {
        const { route, params, pathMatched } = router.match(req.method, pathname);
        if (!route) throw new HttpError(pathMatched ? 405 : 404, pathMatched ? 'Метод не поддерживается.' : 'Не найдено.');
        const ctx = { req, res, params, query: url.searchParams, status: 200, handled: Symbol('handled') };
        const out = await route.handler(ctx);
        if (out === ctx.handled) return;
        return sendJson(res, ctx.status, out);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
      return serveStatic(req, res, pathname, config.webDist);
    } catch (e) {
      if (res.headersSent) return res.end();
      if (e instanceof HttpError) return sendJson(res, e.status, { error: e.code, message: e.message });
      console.error('[error]', req.method, pathname, e);
      return sendJson(res, 500, { error: 'server_error', message: 'Something went wrong. Please try again.' });
    }
  });
}

export async function main() {
  const missing = assertProductionConfig();
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}\nSee .env.example`);
    if (config.isProd || missing.includes('DATABASE_URL')) process.exit(1);
  }
  if ((process.env.RUN_MIGRATIONS ?? 'true') !== 'false') await migrate();
  const server = createServer();
  server.requestTimeout = 60_000;
  await new Promise((r) => server.listen(config.port, r));
  console.log(`[server] listening on :${config.port}`);
  startBot();
  const worker = startNotificationWorker();
  const shutdown = () => {
    stopBot(); clearInterval(worker);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  return server;
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
