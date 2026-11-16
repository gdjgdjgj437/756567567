import { config } from './config.js';
import { tgApi, sendMessage, webAppButton, esc } from './telegram.js';
import { isAdminId } from './auth.js';
import { reviewPayment } from './orders.js';

const log = (...a) => console.log('[bot]', ...a);

async function onMessage(m) {
  const text = (m.text || '').trim();
  const chatId = m.chat.id;
  if (m.chat.type !== 'private') return;
  if (/^\/start\b/.test(text)) {
    const name = esc(m.from?.first_name || 'друг');
    if (!config.appUrl) return sendMessage(chatId, `Привет, ${name}. Приложение ещё не настроено (не задан APP_URL).`);
    return sendMessage(chatId,
      `<b>NONCHALANT FC · Оценка составов</b>\n\nПривет, ${name}. Отправьте свой состав FC Mobile на бесплатную оценку или попадите в видео на TikTok.`,
      webAppButton('Открыть приложение', config.appUrl));
  }
  if (/^\/admin\b/.test(text)) {
    if (!isAdminId(m.from?.id) || !config.appUrl) return sendMessage(chatId, 'Недоступно.');
    return sendMessage(chatId, '<b>Панель администратора</b>', webAppButton('Открыть панель', `${config.appUrl}/admin`));
  }
  if (/^\/id\b/.test(text)) {
    return sendMessage(chatId, `Ваш Telegram ID: <code>${esc(String(m.from?.id))}</code>`);
  }
  if (/^\/help\b/.test(text)) {
    return sendMessage(chatId, 'Команда /start открывает приложение. Ваши заказы и их статусы находятся во вкладке «Заказы».');
  }
}

async function onCallback(q) {
  const m = /^pay:(confirm|reject):([0-9a-f-]{36})$/.exec(q.data || '');
  if (!m) return tgApi('answerCallbackQuery', { callback_query_id: q.id });
  if (!isAdminId(q.from.id)) return tgApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Нет доступа.', show_alert: true });
  let result;
  try {
    const o = await reviewPayment(String(q.from.id), m[2], m[1]);
    result = `${o.code}: платёж ${o.paymentStatus === 'confirmed' ? 'подтверждён' : o.paymentStatus === 'rejected' ? 'отклонён' : o.paymentStatus}`;
  } catch (e) {
    result = e.status ? e.message : 'Что-то пошло не так.';
  }
  await tgApi('answerCallbackQuery', { callback_query_id: q.id, text: result, show_alert: false }).catch(() => {});
  if (q.message) {
    await tgApi('editMessageReplyMarkup', { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    await sendMessage(q.message.chat.id, esc(result)).catch(() => {});
  }
}

export async function handleUpdate(u) {
  try {
    if (u.message) await onMessage(u.message);
    else if (u.callback_query) await onCallback(u.callback_query);
  } catch (e) { console.error('[bot] update failed:', e.message); }
}

let stopped = false;
export function stopBot() { stopped = true; }

async function poll() {
  let offset = 0;
  while (!stopped) {
    try {
      const updates = await tgApi('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] }, { timeoutMs: 40000 });
      for (const u of updates) { offset = u.update_id + 1; await handleUpdate(u); }
    } catch (e) {
      if (!stopped) { console.error('[bot] polling error:', e.message); await new Promise((r) => setTimeout(r, 5000)); }
    }
  }
}

export async function startBot() {
  if (!config.botToken) { log('TELEGRAM_BOT_TOKEN not set: bot disabled, notifications will be recorded but not delivered.'); return; }
  try {
    await tgApi('setMyCommands', { commands: [{ command: 'start', description: 'Открыть приложение' }, { command: 'help', description: 'Как это работает' }] });
    if (config.appUrl) await tgApi('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Оценка составов', web_app: { url: config.appUrl } } });
    if (config.useWebhook) {
      await tgApi('setWebhook', { url: `${config.appUrl}/telegram/webhook`, secret_token: config.webhookSecret, allowed_updates: ['message', 'callback_query'] });
      log('webhook set');
    } else {
      await tgApi('deleteWebhook', {});
      poll();
      log('long polling started');
    }
  } catch (e) { console.error('[bot] startup failed:', e.message); }
}
