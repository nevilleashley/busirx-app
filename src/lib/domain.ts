import type {
  BlueprintCategoryId,
  ConsequentialActionType,
  PlanTier,
} from '../types/busirx.ts';

export const BLUEPRINT_CATEGORIES: Array<{
  id: BlueprintCategoryId;
  number: number;
  name: string;
  summary: string;
}> = [
  {
    id: 'formation',
    number: 1,
    name: 'Business formation and registration',
    summary: 'Entity structure, EIN/tax IDs, registered agent, and founding filings.',
  },
  {
    id: 'licenses',
    number: 2,
    name: 'Licenses and permits',
    summary: 'Federal, state, county, and municipal operating permits and renewals.',
  },
  {
    id: 'tax_finance',
    number: 3,
    name: 'Tax and financial administration',
    summary: 'Estimated quarterly taxes, sales tax nexus, payroll tax, and annual filings.',
  },
  {
    id: 'banking_bookkeeping',
    number: 4,
    name: 'Banking and bookkeeping',
    summary: 'Dedicated business accounts, chart of accounts, reconciliation, and cash flow.',
  },
  {
    id: 'insurance_risk',
    number: 5,
    name: 'Insurance and risk management',
    summary: 'General liability, professional/E&O, workers compensation, and policy renewals.',
  },
  {
    id: 'employees_hr',
    number: 6,
    name: 'Employees and HR',
    summary: 'Worker classification, onboarding compliance, handbooks, and certifications.',
  },
  {
    id: 'daily_operations',
    number: 7,
    name: 'Daily operations',
    summary: 'Standard operating procedures, vendor cadence, safety, and quality controls.',
  },
  {
    id: 'contracts_documents',
    number: 8,
    name: 'Contracts and documents',
    summary: 'Client MSAs, vendor agreements, NDAs, privacy policies, and record retention.',
  },
  {
    id: 'marketing_growth',
    number: 9,
    name: 'Marketing and customer acquisition',
    summary: 'Positioning, local & digital presence, lead pipelines, and retention workflows.',
  },
  {
    id: 'profitability_growth',
    number: 10,
    name: 'Profitability and growth',
    summary: 'Unit economics, pricing reviews, KPI cadence, and quarterly strategic reviews.',
  },
];

export interface SubscriptionPlanSpec {
  id: Exclude<PlanTier, 'free'>;
  name: string;
  priceMonthlyUsd: number;
  audience: string;
  maxActiveTasks: number | null;
  maxBusinesses: number;
  automatedReminders: boolean;
  documentVault: boolean;
  teamAndFinancialTools: boolean;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanSpec[] = [
  {
    id: 'starter_rx',
    name: 'Starter Rx',
    priceMonthlyUsd: 8,
    audience: 'For solo founders & new launches',
    maxActiveTasks: 30,
    maxBusinesses: 1,
    automatedReminders: false,
    documentVault: false,
    teamAndFinancialTools: false,
    features: [
      '1 business profile & full assessment',
      '10-category Gemini operating blueprint',
      'Up to 30 active compliance & launch tasks',
      'In-app deadline dashboard',
    ],
  },
  {
    id: 'business_rx',
    name: 'Business Rx',
    priceMonthlyUsd: 17,
    audience: 'For active operating businesses',
    maxActiveTasks: null,
    maxBusinesses: 3,
    automatedReminders: true,
    documentVault: true,
    teamAndFinancialTools: true,
    features: [
      'Up to 3 business profiles',
      'Unlimited one-time & recurring tasks',
      'Bills, licenses & insurance renewal tracker',
      'Private document vault & configurable reminders',
    ],
  },
  {
    id: 'growth_rx',
    name: 'Growth Rx',
    priceMonthlyUsd: 26,
    audience: 'For scaling teams & multi-site operators',
    maxActiveTasks: null,
    maxBusinesses: 10,
    automatedReminders: true,
    documentVault: true,
    teamAndFinancialTools: true,
    features: [
      'Up to 10 business profiles',
      'Employee & contractor certification tracking',
      'Financial ledger, marketing planner & Busi Rx Advisor',
      'Full audit trail & one-click JSON data export',
    ],
  },
];

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const base = isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
    ? new Date(`${isoDate}T00:00:00.000Z`)
    : new Date();
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return formatIsoDate(next);
}

export function inferRecurrenceDays(cadenceType: 'one_time' | 'recurring', suggestedText: string, explicitDays?: number): number {
  if (cadenceType === 'one_time') return 0;
  if (explicitDays && explicitDays > 0) return Math.min(3650, Math.round(explicitDays));
  const lower = suggestedText.toLowerCase();
  if (lower.includes('week')) return 7;
  if (lower.includes('biweekly') || lower.includes('bi-weekly')) return 14;
  if (lower.includes('quarter')) return 90;
  if (lower.includes('semi-annual') || lower.includes('6 month')) return 180;
  if (lower.includes('annual') || lower.includes('year')) return 365;
  return 30;
}

export function inferInitialDueDate(cadenceType: 'one_time' | 'recurring', recurrenceDays: number, suggestedText: string): string {
  const today = new Date();
  const lower = suggestedText.toLowerCase();
  if (lower.includes('immediate') || lower.includes('week 1') || lower.includes('7 day')) {
    return addDaysIso(formatIsoDate(today), 7);
  }
  if (lower.includes('14 day') || lower.includes('2 week')) {
    return addDaysIso(formatIsoDate(today), 14);
  }
  if (cadenceType === 'recurring' && recurrenceDays > 0) {
    return addDaysIso(formatIsoDate(today), Math.min(recurrenceDays, 30));
  }
  return addDaysIso(formatIsoDate(today), 21);
}

export function inferConsequentialActionType(
  categoryId: string,
  title: string,
  requiresExplicitApproval: boolean
): ConsequentialActionType {
  if (!requiresExplicitApproval) return 'none';
  const text = `${categoryId} ${title}`.toLowerCase();
  if (text.includes('pay') || text.includes('tax') || text.includes('fee') || text.includes('bill') || text.includes('premium')) {
    return 'payment';
  }
  if (
    text.includes('file') ||
    text.includes('register') ||
    text.includes('incorporat') ||
    text.includes('ein') ||
    text.includes('license') ||
    text.includes('permit') ||
    text.includes('contract')
  ) {
    return 'legal_filing';
  }
  if (text.includes('email') || text.includes('campaign') || text.includes('outreach') || text.includes('publish')) {
    return 'external_communication';
  }
  return 'legal_filing';
}

export function buildTaskDedupeKey(businessId: string, blueprintItemId: string): string {
  return `bp:${businessId}:${blueprintItemId}`;
}

export function buildReminderDedupeKey(
  entityType: 'task' | 'obligation' | 'certification' | 'blueprint',
  entityId: string,
  dueDate: string,
  channel: 'in_app' | 'email'
): string {
  return `rem:${entityType}:${entityId}:${dueDate || 'undated'}:${channel}`;
}

export function daysUntilDate(isoDate: string, now: Date = new Date()): number | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const target = new Date(`${isoDate}T00:00:00.000Z`).getTime();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - todayUtc) / (24 * 60 * 60 * 1000));
}

export function formatCurrencyCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format((cents || 0) / 100);
}

export function sanitizeId(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96);
  return cleaned || `id_${Date.now()}`;
}
