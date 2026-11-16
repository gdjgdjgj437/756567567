export type PlanCode = 'free' | 'standard' | 'express';
export type PaymentStatus = 'not_required' | 'pending' | 'confirmed' | 'rejected';
export type EvalStatus = 'submitted' | 'in_queue' | 'being_evaluated' | 'evaluated' | 'rejected';
export type PublishStatus = 'not_published' | 'published';

export interface Plan { code: PlanCode; name: string; price: number; priority: number; guaranteedFeature: boolean }
export interface AppConfig { currency: string; paymentInstructions: string; plans: Plan[]; botUsername: string; maxUploadMb: number }
export interface HallEntry { nickname: string; ratingScore: number; plan: { code: PlanCode; name: string }; videoUrl: string | null; publishedAt: string }
export interface Hall { stats: { evaluated: number; published: number }; entries: HallEntry[] }
export interface User { id: string; username: string | null; firstName: string; isAdmin: boolean }

export interface Order {
  id: string; code: string; createdAt: string; nickname: string; uid: string;
  plan: { code: PlanCode; name: string };
  price: number; currency: string;
  paymentStatus: PaymentStatus; evalStatus: EvalStatus; publishStatus: PublishStatus;
  videoUrl: string | null; ratingScore: number | null; ratingNote: string | null;
  queuePosition: number | null; paymentReference: string | null; paymentReportedAt: string | null;
  canReportPayment: boolean; canUpgrade: boolean; imageUrl: string;
  // admin-only
  userId?: string; username?: string | null; firstName?: string | null; adminNote?: string | null;
  paymentConfirmedAt?: string | null; evaluatedAt?: string | null; publishedAt?: string | null;
}

export interface Overview {
  totalSubmissions: number; freeSubmissions: number; paidOrders: number; standardPaid: number; expressPaid: number;
  pendingPayments: number; awaitingEvaluation: number; published: number;
  revenue: { currency: string; total: number }[];
}
export interface Settings { currency: string; paymentInstructions: string; plans: Plan[] }
