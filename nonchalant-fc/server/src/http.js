import fs from 'node:fs';
import path from 'node:path';

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || 'error';
  }
}
export const bad = (m, code) => new HttpError(400, m, code || 'bad_request');

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler, opts = {}) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handler, opts });
  }
  get(p, h, o) { this.add('GET', p, h, o); }
  post(p, h, o) { this.add('POST', p, h, o); }
  put(p, h, o) { this.add('PUT', p, h, o); }
  patch(p, h, o) { this.add('PATCH', p, h, o); }
  delete(p, h, o) { this.add('DELETE', p, h, o); }
  match(method, pathname) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
    return { route: null, pathMatched };
  }
}

export function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body), ...headers });
  res.end(body);
}

export async function readBody(req, limit) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > limit) throw new HttpError(413, 'Запрос слишком большой.', 'too_large');
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, 'Запрос слишком большой.', 'too_large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req, limit = 64 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { throw bad('Некорректное тело запроса.'); }
}

/** Minimal multipart/form-data parser (buffers the whole body; size is capped by readBody). */
export function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) throw bad('Ожидается multipart/form-data.');
  const boundary = Buffer.from('--' + (m[1] || m[2]));
  const fields = {};
  const files = {};
  let pos = buf.indexOf(boundary);
  while (pos !== -1) {
    const next = buf.indexOf(boundary, pos + boundary.length);
    if (next === -1) break;
    // part = after boundary + CRLF, until CRLF before next boundary
    const part = buf.subarray(pos + boundary.length + 2, next - 2);
    const headEnd = part.indexOf('\r\n\r\n');
    if (headEnd !== -1) {
      const head = part.subarray(0, headEnd).toString('utf8');
      const data = part.subarray(headEnd + 4);
      const name = /name="([^"]*)"/i.exec(head)?.[1];
      const filename = /filename="([^"]*)"/i.exec(head)?.[1];
      const ctype = /content-type:\s*([^\r\n;]+)/i.exec(head)?.[1];
      if (name) {
        if (filename !== undefined) files[name] = { filename, contentType: ctype || '', data: Buffer.from(data) };
        else fields[name] = data.toString('utf8');
      }
    }
    pos = next;
  }
  return { fields, files };
}

// ---- tiny in-memory rate limiter ----
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { buckets.set(key, arr); throw new HttpError(429, 'Слишком много запросов. Попробуйте чуть позже.', 'rate_limited'); }
  arr.push(now);
  buckets.set(key, arr);
}
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (!v.some((t) => now - t < 3600e3)) buckets.delete(k); }, 600e3).unref();

export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://telegram.org",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors https://web.telegram.org https://*.telegram.org",
    "base-uri 'none'",
    "object-src 'none'",
  ].join('; '));
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.map': 'application/json' };

export function serveStatic(req, res, pathname, root) {
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    return res.end('Frontend not built. Run: npm run build');
  }
  let rel = decodeURIComponent(pathname);
  let file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
  let isAsset = false;
  try {
    const st = fs.statSync(file);
    if (st.isDirectory()) file = path.join(file, 'index.html');
    else isAsset = true;
  } catch { file = path.join(root, 'index.html'); }
  if (!fs.existsSync(file)) file = path.join(root, 'index.html');
  const ext = path.extname(file);
  const immutable = isAsset && rel.startsWith('/assets/');
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}
