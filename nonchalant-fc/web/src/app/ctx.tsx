import { createContext, useContext } from 'react';
import type { AppConfig, Order, User } from '../lib/types';

export type Tab = 'home' | 'submit' | 'featured' | 'hall' | 'orders';
export interface AppCtx {
  user: User;
  config: AppConfig;
  orders: Order[] | null;
  refreshOrders: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  upsertOrder: (o: Order) => void;
  go: (tab: Tab, opts?: { upgrade?: Order }) => void;
  upgrade: Order | null;
}
export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
export const planOf = (c: AppConfig, code: string) => c.plans.find((p) => p.code === code);
