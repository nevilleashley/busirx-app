import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '../lib/domain.ts';
import type {
  AuditLogRecord,
  SystemReadinessStatus,
  UserProfile,
} from '../types/busirx.ts';

interface BillingSecurityViewProps {
  userProfile: UserProfile;
  businessName: string;
  readiness: SystemReadinessStatus | null;
  auditLogs: AuditLogRecord[];
  onStartCheckout: (planTier: 'starter_rx' | 'business_rx' | 'growth_rx') => Promise<void>;
  onOpenPortal: () => Promise<void>;
  onCancelSubscription: () => Promise<void>;
  onExportData: () => Promise<void>;
  onDeleteBusiness: () => Promise<void>;
}

export function BillingSecurityView({
  userProfile,
  businessName,
  readiness,
  auditLogs,
  onStartCheckout,
  onOpenPortal,
  onCancelSubscription,
  onExportData,
  onDeleteBusiness,
}: BillingSecurityViewProps) {
  const [billingError, setBillingError] = useState('');
  const [billingNotice, setBillingNotice] = useState('');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleCheckout = async (planId: 'starter_rx' | 'business_rx' | 'growth_rx') => {
    setBillingError('');
    setBillingNotice('');
    setBusyPlan(planId);
    try {
      await onStartCheckout(planId);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Unable to start Stripe Checkout.');
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subscription Plans */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#1C1B22]">
              Subscriptions &amp; Plan Entitlements
            </h2>
            <p className="text-sm text-[#6E6A7C] mt-0.5">
              Current plan:{' '}
              <span className="font-semibold text-[#4C1D95] capitalize">
                {userProfile.planTier.replace('_', ' ')}
              </span>{' '}
              · Status: <span className="capitalize">{userProfile.subscriptionStatus}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {userProfile.stripeCustomerId && (
              <button
                type="button"
                onClick={async () => {
                  setBillingError('');
                  try {
                    await onOpenPortal();
                  } catch (err) {
                    setBillingError(
                      err instanceof Error ? err.message : 'Billing portal unavailable.'
                    );
                  }
                }}
                className="px-3.5 py-2 text-xs font-medium border border-[#E6E2F0] rounded-lg text-[#1C1B22] hover:bg-[#F8F7FB] flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Stripe Billing Portal
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            {userProfile.stripeSubscriptionId && userProfile.subscriptionStatus === 'active' && (
              <button
                type="button"
                onClick={async () => {
                  setBillingError('');
                  try {
                    await onCancelSubscription();
                    setBillingNotice('Cancellation scheduled at period end.');
                  } catch (err) {
                    setBillingError(
                      err instanceof Error ? err.message : 'Unable to cancel subscription.'
                    );
                  }
                }}
                className="px-3.5 py-2 text-xs font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
              >
                Cancel at Period End
              </button>
            )}
          </div>
        </div>

        {billingError && (
          <div className="p-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Stripe Billing Configuration Notice</p>
              <p className="mt-1 leading-relaxed">{billingError}</p>
            </div>
          </div>
        )}

        {billingNotice && (
          <div className="p-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#065F46]">
            {billingNotice}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent =
              userProfile.planTier === plan.id && userProfile.subscriptionStatus === 'active';
            return (
              <div
                key={plan.id}
                className={`rounded-xl p-6 border flex flex-col justify-between ${
                  isCurrent
                    ? 'border-[#059669] bg-[#ECFDF5]/40'
                    : plan.id === 'business_rx'
                    ? 'border-[#4C1D95] bg-white'
                    : 'border-[#E6E2F0] bg-white'
                }`}
              >
                <div>
                  <p className="text-xs font-medium text-[#4C1D95]">{plan.audience}</p>
                  <h3 className="font-display text-lg font-bold text-[#1C1B22] mt-1">
                    {plan.name}
                  </h3>
                  <p className="font-mono-tabular text-2xl font-bold text-[#1C1B22] mt-3 mb-4">
                    ${plan.priceMonthlyUsd}
                    <span className="text-xs font-normal text-[#6E6A7C]"> / month</span>
                  </p>
                  <ul className="space-y-2 text-xs text-[#4A4756] mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={isCurrent || busyPlan === plan.id}
                  onClick={() => handleCheckout(plan.id)}
                  className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors ${
                    isCurrent
                      ? 'bg-[#059669] text-white cursor-default'
                      : 'bg-[#4C1D95] text-white hover:bg-[#3B1478]'
                  }`}
                >
                  {isCurrent
                    ? 'Current Active Plan'
                    : busyPlan === plan.id
                    ? 'Opening Stripe Checkout...'
                    : readiness?.stripeConfigured
                    ? `Subscribe to ${plan.name}`
                    : `Configure Stripe for ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Honest Environment & Integration Readiness Checklist */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#4C1D95]" />
          <h3 className="font-display text-base font-semibold text-[#1C1B22]">
            Production Readiness &amp; Integration Verification
          </h3>
        </div>
        <p className="text-xs text-[#6E6A7C]">
          Real live status of configured backend services. Unconfigured integrations are clearly
          labeled and never simulated.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {[
            {
              label: 'Firebase Auth & Hardened Firestore Rules',
              ok: Boolean(readiness?.firebaseClientConfigured),
              detail: readiness?.firebaseClientConfigured ? 'Active & Verified' : 'Needs Config',
            },
            {
              label: 'Google Gemini Blueprint & Advisor API',
              ok: Boolean(readiness?.geminiConfigured),
              detail: readiness?.geminiConfigured
                ? 'Configured on Server'
                : 'Set GEMINI_API_KEY in Secrets',
            },
            {
              label: 'Stripe Checkout & Price IDs',
              ok: Boolean(readiness?.stripeConfigured),
              detail: readiness?.stripeConfigured
                ? 'Live Keys Configured'
                : 'Requires STRIPE_SECRET_KEY + Price IDs',
            },
            {
              label: 'Stripe Webhook Verification',
              ok: Boolean(readiness?.stripeWebhookConfigured),
              detail: readiness?.stripeWebhookConfigured
                ? 'Signature Secret Active'
                : 'Requires STRIPE_WEBHOOK_SECRET',
            },
            {
              label: 'External Email Delivery (Resend)',
              ok: Boolean(readiness?.emailProviderConfigured),
              detail: readiness?.emailProviderConfigured
                ? 'Email Dispatch Enabled'
                : 'In-App Only until RESEND_API_KEY set',
            },
            {
              label: 'Scheduled Reminder Worker',
              ok: Boolean(readiness?.schedulerActive),
              detail: readiness?.schedulerActive ? 'Server Interval Active' : 'Inactive',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="p-3.5 rounded-lg border border-[#E6E2F0] bg-[#F8F7FB] space-y-1"
            >
              <p className="font-semibold text-[#1C1B22]">{item.label}</p>
              <p className={item.ok ? 'text-[#059669] font-medium' : 'text-[#B45309] font-medium'}>
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Governance: Export, Deletion & Immutable Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-5">
          <h3 className="font-display text-base font-semibold text-[#1C1B22]">
            Data Export &amp; Account Deletion
          </h3>
          <p className="text-xs text-[#6E6A7C] leading-relaxed">
            Download a complete JSON archive of your business profile, assessment answers,
            blueprint items, tasks, obligations, financial entries, and audit trail, or permanently
            delete this business workspace.
          </p>

          <button
            type="button"
            onClick={onExportData}
            className="w-full py-2.5 px-4 text-xs font-semibold bg-[#F3EFFC] text-[#4C1D95] rounded-lg hover:bg-[#E8E0FA] flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Export Business Data (JSON)
          </button>

          <div className="pt-4 border-t border-[#E6E2F0]">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 px-4 text-xs font-semibold border border-red-200 text-red-700 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Business Workspace
              </button>
            ) : (
              <div className="space-y-3 p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs text-red-800 font-medium">
                  Type <strong>DELETE</strong> to permanently remove <strong>{businessName}</strong>{' '}
                  and all associated tasks, blueprint items, and logs.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full px-3 py-2 text-xs border border-red-300 rounded-lg bg-white"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeleteConfirmText('');
                    }}
                    className="flex-1 py-2 text-xs bg-white border border-[#E6E2F0] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteConfirmText !== 'DELETE'}
                    onClick={onDeleteBusiness}
                    className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg disabled:opacity-40"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[#1C1B22]">
              Security &amp; Action Audit Log
            </h3>
            <span className="font-mono-tabular text-xs text-[#6E6A7C]">
              {auditLogs.length} events
            </span>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-[#6E6A7C] py-6">No audit events recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#F1EEF7] max-h-72 overflow-y-auto">
              {auditLogs.slice(0, 25).map((log) => (
                <div key={log.id} className="py-2.5 space-y-0.5">
                  <div className="flex items-center justify-between text-xs text-[#6E6A7C]">
                    <span className="font-mono-tabular font-semibold text-[#4C1D95]">
                      {log.action}
                    </span>
                    <span>{log.actorEmail}</span>
                  </div>
                  <p className="text-xs text-[#1C1B22]">{log.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
