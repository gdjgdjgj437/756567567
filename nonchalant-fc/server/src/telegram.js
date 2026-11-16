import { config } from './config.js';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function tgApi(method, payload = {}, { timeoutMs = 15000 } = {}) {
  if (!config.botToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const r = await fetch(`${config.tgApiBase}/bot${config.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let data;
  try { data = await r.json(); } catch { throw new Error(`Telegram ${method}: bad response (${r.status})`); }
  if (!data.ok) {
    const err = new Error(`Telegram ${method}: ${data.description || r.status}`);
    err.tgCode = data.error_code;
    throw err;
  }
  return data.result;
}

export const sendMessage = (chatId, html, replyMarkup) =>
  tgApi('sendMessage', {
    chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });

export const webAppButton = (text, url) => ({ inline_keyboard: [[{ text, web_app: { url } }]] });
