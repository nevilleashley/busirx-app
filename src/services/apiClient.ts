import { auth } from '../lib/firebase.ts';
import type {
  BlueprintItem,
  BusinessAssessmentInput,
  SocialCalendarDay,
  SystemReadinessStatus,
} from '../types/busirx.ts';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchSystemReadiness(): Promise<SystemReadinessStatus> {
  const res = await fetch('/api/system/readiness');
  if (!res.ok) {
    throw new Error('Unable to check system readiness.');
  }
  return res.json();
}

export interface GeneratedBlueprintResponse {
  summary: string;
  model: string;
  items: Array<
    Omit<
      BlueprintItem,
      'id' | 'businessId' | 'ownerUid' | 'completionStatus' | 'approvedByOwner' | 'assessmentVersion' | 'createdAt' | 'updatedAt'
    >
  >;
}

export async function generateBlueprintApi(
  businessId: string,
  assessment: BusinessAssessmentInput,
  affectedCategoryIds?: string[]
): Promise<GeneratedBlueprintResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/blueprint/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ businessId, assessment, affectedCategoryIds }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate business blueprint.');
  }
  return data;
}

export async function sendAssistantMessageApi(params: {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  businessContext: {
    name: string;
    industry: string;
    country: string;
    stateProvince: string;
    city: string;
    stage: string;
    legalStructure: string;
    openTasksCount: number;
    overdueCount: number;
    upcomingItems: string[];
  };
}): Promise<{ reply: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Assistant request failed.');
  }
  return data;
}

export async function createStripeCheckoutApi(
  planTier: 'starter_rx' | 'business_rx' | 'growth_rx'
): Promise<{ url: string; sessionId: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/billing/create-checkout-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ planTier }),
  });
  const data = await res.json();
  if (!res.ok) {
    const missing = Array.isArray(data.missingEnvVars) && data.missingEnvVars.length
      ? ` Missing: ${data.missingEnvVars.join(', ')}`
      : '';
    throw new Error((data.error || 'Checkout unavailable.') + missing);
  }
  return data;
}

export async function syncStripeSessionApi(sessionId: string): Promise<{
  planTier: 'starter_rx' | 'business_rx' | 'growth_rx';
  subscriptionStatus: 'active' | 'inactive';
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/billing/sync-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Unable to verify checkout session.');
  }
  return data;
}

export async function openStripePortalApi(stripeCustomerId: string): Promise<{ url: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/billing/portal', {
    method: 'POST',
    headers,
    body: JSON.stringify({ stripeCustomerId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Unable to open Stripe billing portal.');
  }
  return data;
}

export async function cancelStripeSubscriptionApi(stripeSubscriptionId: string): Promise<{
  status: string;
  cancelAtPeriodEnd: boolean;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/billing/cancel', {
    method: 'POST',
    headers,
    body: JSON.stringify({ stripeSubscriptionId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Unable to cancel subscription.');
  }
  return data;
}

export async function dispatchRemindersApi(params: {
  recipientEmail: string;
  businessName: string;
  reminders: Array<{
    dedupeKey: string;
    title: string;
    message: string;
    dueDate: string;
  }>;
}): Promise<{
  checkedAt: string;
  results: Array<{
    dedupeKey: string;
    emailStatus: 'delivered' | 'skipped_no_email_provider' | 'failed';
    detail?: string;
  }>;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/automation/dispatch-reminders', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Reminder check failed.');
  }
  return data;
}

export interface GeneratedSocialCalendarResponse {
  strategyNote: string;
  days: Array<
    Omit<
      SocialCalendarDay,
      | 'id'
      | 'businessId'
      | 'ownerUid'
      | 'completedMiniTasks'
      | 'requiresExternalPublishApproval'
      | 'approvedToPublish'
      | 'dayStatus'
      | 'createdAt'
      | 'updatedAt'
    >
  >;
}

export async function generateSocialCalendarApi(params: {
  businessId: string;
  assessment: BusinessAssessmentInput;
  startDate?: string;
  focusGoal?: string;
}): Promise<GeneratedSocialCalendarResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/marketing/generate-social-calendar', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate 30-day social media calendar.');
  }
  return data;
}
