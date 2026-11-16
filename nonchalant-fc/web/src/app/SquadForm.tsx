import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { uuid } from '../lib/format';
import type { Order, PlanCode } from '../lib/types';
import { cn } from '../components/ui';
import { Button, Field, Input, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { haptic } from '../lib/tg';
import { useApp } from './ctx';

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function SquadForm({ plan, submitLabel, onCreated }: { plan: PlanCode; submitLabel: string; onCreated: (o: Order) => void }) {
  const { config, upsertOrder } = useApp();
  const toast = useToast();
  const [nickname, setNickname] = useState('');
  const [uid, setUid] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ nickname?: string; uid?: string; file?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);               // hard guard against rapid double taps
  const keyRef = useRef(uuid());               // same key on retry => server never creates duplicates
  const input = useRef<HTMLInputElement>(null);
  const maxMb = config.maxUploadMb || 8;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!OK_TYPES.includes(f.type) && !/\.(jpe?g|png|webp)$/i.test(f.name)) return setErrors((e) => ({ ...e, file: 'Выберите изображение JPG, PNG или WEBP.' }));
    if (f.size > maxMb * 1024 * 1024) return setErrors((e) => ({ ...e, file: `Изображение слишком большое. Максимум ${maxMb} МБ.` }));
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
    setErrors((e) => ({ ...e, file: undefined, form: undefined }));
  }

  function validate() {
    const e: typeof errors = {};
    const n = nickname.trim(); const u = uid.trim();
    if (!n) e.nickname = 'Введите ваш никнейм в FC Mobile.'; else if (n.length > 40) e.nickname = 'Не более 40 символов.';
    if (!u) e.uid = 'Введите ваш UID в FC Mobile.'; else if (!/^[A-Za-z0-9]{4,24}$/.test(u)) e.uid = 'UID: от 4 до 24 букв или цифр, без пробелов.';
    if (!file) e.file = 'Загрузите скриншот вашего состава.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (busyRef.current) return;
    if (!validate()) { haptic('error'); return; }
    busyRef.current = true; setBusy(true);
    try {
      const fd = new FormData();
      fd.set('nickname', nickname.trim()); fd.set('uid', uid.trim()); fd.set('plan', plan);
      fd.set('idempotencyKey', keyRef.current); fd.set('screenshot', file!, file!.name);
      const order = await api.createOrder(fd);
      upsertOrder(order);
      haptic('success');
      onCreated(order);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Что-то пошло не так. Попробуйте ещё раз.';
      setErrors((e) => ({ ...e, form: msg })); toast(msg, 'error');
    } finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      <Field label="Никнейм в FC Mobile" error={errors.nickname}>
        <Input value={nickname} onChange={(e) => setNickname(e.target.value)} invalid={!!errors.nickname} placeholder="например, NonchalantKing" autoComplete="off" autoCapitalize="off" maxLength={60} />
      </Field>
      <Field label="UID в FC Mobile" error={errors.uid} hint="Его можно найти в профиле игры.">
        <Input value={uid} onChange={(e) => setUid(e.target.value.replace(/\s/g, ''))} invalid={!!errors.uid} placeholder="например, 1234567890" inputMode="text" autoComplete="off" maxLength={24} />
      </Field>

      <div>
        <span className="mb-1.5 block px-1 text-[13px] font-medium text-mute">Скриншот состава</span>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        {preview ? (
          <div className="animate-fade overflow-hidden rounded-card border border-line bg-surface">
            <div className="relative">
              <img src={preview} alt="Предпросмотр скриншота состава" className={cn('max-h-[240px] w-full object-contain transition', busy && 'brightness-75')} />
              {busy && <span aria-hidden className="animate-scan absolute inset-x-0 h-[3px] bg-[#5ac8fa] shadow-[0_0_18px_6px_rgb(10_132_255/0.7)]" />}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line bg-card px-4 py-3">
              <span className="min-w-0 truncate text-[14px] text-mute">{file?.name} · {((file?.size ?? 0) / 1048576).toFixed(1)} МБ</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()}>Заменить</Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => input.current?.click()}
            className={`flex h-48 w-full flex-col items-center justify-center gap-3 rounded-card border border-dashed bg-surface text-mute transition active:scale-[0.99] active:bg-surface-2 ${errors.file ? 'border-bad/50' : 'border-ink/20'}`}>
            <span className="grid size-12 place-items-center rounded-full bg-raised shadow-sm"><Icon name="image" size={24} strokeWidth={1.4} /></span>
            <span className="text-[16px] font-medium text-ink">Выбрать из галереи</span>
            <span className="text-[13px]">JPG, PNG или WEBP · до {maxMb} МБ</span>
          </button>
        )}
        {errors.file && <span role="alert" className="mt-1.5 block px-1 text-[13px] text-bad">{errors.file}</span>}
      </div>

      {errors.form && <div role="alert" className="rounded-2xl bg-bad-bg p-4 text-[14px] text-bad">{errors.form}</div>}
      <Button type="submit" block loading={busy}>{submitLabel}</Button>
    </form>
  );
}
