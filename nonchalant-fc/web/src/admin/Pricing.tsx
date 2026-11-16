import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Button, Card, Field, Input, Notice, PageTitle, Skeleton, Textarea, useToast } from '../components/ui';

export function Pricing() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [std, setStd] = useState(''); const [exp, setExp] = useState('');
  const [currency, setCurrency] = useState(''); const [instr, setInstr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.admin.settings().then((s) => {
      setStd(String(s.plans.find((p) => p.code === 'standard')?.price ?? '')); setExp(String(s.plans.find((p) => p.code === 'express')?.price ?? ''));
      setCurrency(s.currency); setInstr(s.paymentInstructions); setLoaded(true);
    }).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  async function save() {
    if (busy) return; setBusy(true);
    try {
      await api.admin.saveSettings({ standardPrice: std, expressPrice: exp, currency, paymentInstructions: instr });
      toast('Сохранено. Игроки сразу увидят новые цены.', 'success');
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Не удалось сохранить.', 'error'); }
    setBusy(false);
  }
  if (!loaded) return <div><PageTitle title="Цены" /><Skeleton className="h-64" /></div>;
  return (
    <div className="animate-rise">
      <PageTitle title="Цены" subtitle="Цены и инструкция по оплате, которые видны в приложении." />
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Цена Стандарта"><Input type="number" inputMode="decimal" min={0} step="0.01" value={std} onChange={(e) => setStd(e.target.value)} /></Field>
          <Field label="Цена Экспресса"><Input type="number" inputMode="decimal" min={0} step="0.01" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
        </div>
        <Field label="Валюта" hint="Код, например USD, EUR, UAH или USDT."><Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={6} autoCapitalize="characters" /></Field>
        <Field label="Инструкция по оплате" hint="Показывается игрокам после создания платного заказа. Укажите карту, кошелёк или ссылку на оплату.">
          <Textarea className="!min-h-40" value={instr} onChange={(e) => setInstr(e.target.value)} maxLength={2000} />
        </Field>
        <Button block loading={busy} onClick={save}>Сохранить цены</Button>
      </Card>
      <div className="mt-4"><Notice icon="info">Уже созданные заказы сохраняют свою цену. Новые заказы используют эти цены.</Notice></div>
    </div>
  );
}
