import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const useSupabase = () => Boolean(config.supabaseUrl && config.supabaseServiceKey);

/** Detect real image type from magic bytes (never trust client MIME / filename). */
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

const sbHeaders = (extra = {}) => ({
  Authorization: `Bearer ${config.supabaseServiceKey}`,
  apikey: config.supabaseServiceKey,
  ...extra,
});

export async function saveImage(buf, ext, mime) {
  const key = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  if (useSupabase()) {
    const r = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}/${key}`, {
      method: 'POST', headers: sbHeaders({ 'Content-Type': mime, 'x-upsert': 'false' }), body: buf,
    });
    if (!r.ok) throw new Error(`Supabase upload failed: ${r.status} ${await r.text()}`);
  } else {
    const file = path.join(config.uploadDir, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buf, { mode: 0o600 });
  }
  return key;
}

export async function readImage(key) {
  if (key.includes('..')) throw new Error('bad key');
  if (useSupabase()) {
    const r = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}/${key}`, { headers: sbHeaders() });
    if (!r.ok) throw new Error(`Supabase read failed: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  return fs.readFile(path.join(config.uploadDir, key));
}

export async function deleteImage(key) {
  try {
    if (useSupabase()) {
      await fetch(`${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}/${key}`, { method: 'DELETE', headers: sbHeaders() });
    } else {
      await fs.unlink(path.join(config.uploadDir, key));
    }
  } catch { /* best effort */ }
}
