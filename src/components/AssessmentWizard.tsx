import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, RefreshCw } from 'lucide-react';
import { BLUEPRINT_CATEGORIES } from '../lib/domain.ts';
import type {
  BlueprintCategoryId,
  BusinessAssessmentInput,
  BusinessRecord,
  LegalStructure,
} from '../types/busirx.ts';

interface AssessmentWizardProps {
  existingBusiness?: BusinessRecord | null;
  isSubmitting: boolean;
  errorMessage: string;
  onSubmit: (
    assessment: BusinessAssessmentInput,
    affectedCategoriesToRegenerate?: BlueprintCategoryId[]
  ) => Promise<void>;
  onCancel?: () => void;
}

const REGISTRATION_OPTIONS = [
  'EIN (Federal Tax ID)',
  'State LLC / Corp Filing',
  'City / County Business License',
  'Sales Tax Permit',
  'DBA / Trade Name',
  'General Liability Insurance',
  'Professional / E&O Insurance',
  'Workers Compensation Insurance',
  'Health / Industry Permit',
];

const MARKETING_CHANNEL_OPTIONS = [
  'Google Business Profile & Local SEO',
  'Website & Organic Search',
  'Referrals & Word of Mouth',
  'Social Media (Instagram / LinkedIn / TikTok)',
  'Email Newsletter',
  'Paid Search / Social Ads',
  'Wholesale / B2B Partnerships',
  'Not actively marketing yet',
];

const GOAL_OPTIONS = [
  'Complete legal formation & licensing cleanly',
  'Stay compliant on taxes & renewals',
  'Separate banking & automate bookkeeping',
  'Hire or onboard team safely',
  'Acquire consistent new customers',
  'Improve profit margins & cash reserves',
  'Prepare for funding or expansion',
];

export function AssessmentWizard({
  existingBusiness,
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
}: AssessmentWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [form, setForm] = useState<BusinessAssessmentInput>({
    name: existingBusiness?.name || '',
    industry: existingBusiness?.industry || '',
    activity: existingBusiness?.activity || '',
    country: existingBusiness?.country || 'United States',
    stateProvince: existingBusiness?.stateProvince || '',
    city: existingBusiness?.city || '',
    jurisdictions: existingBusiness?.jurisdictions || [],
    stage: existingBusiness?.stage || 'new',
    legalStructure: existingBusiness?.legalStructure || 'llc',
    employeeCount: existingBusiness?.employeeCount ?? 0,
    operatingModel: existingBusiness?.operatingModel || 'both',
    existingRegistrations: existingBusiness?.existingRegistrations || [],
    bankingEstablished: existingBusiness?.bankingEstablished ?? false,
    bookkeepingEstablished: existingBusiness?.bookkeepingEstablished ?? false,
    offeringType: existingBusiness?.offeringType || 'services',
    workerTypes: existingBusiness?.workerTypes || 'none',
    marketingChannels: existingBusiness?.marketingChannels || [],
    goals: existingBusiness?.goals || ['Complete legal formation & licensing cleanly'],
  });

  const [jurisdictionInput, setJurisdictionInput] = useState(
    existingBusiness?.jurisdictions?.join(', ') || ''
  );

  // When updating an existing business, automatically suggest affected categories based on changed sections
  const suggestedAffectedCategories = useMemo<BlueprintCategoryId[]>(() => {
    if (!existingBusiness) return [];
    const changed = new Set<BlueprintCategoryId>();
    if (
      existingBusiness.legalStructure !== form.legalStructure ||
      existingBusiness.stage !== form.stage
    ) {
      changed.add('formation');
    }
    if (
      existingBusiness.country !== form.country ||
      existingBusiness.stateProvince !== form.stateProvince ||
      existingBusiness.city !== form.city ||
      existingBusiness.operatingModel !== form.operatingModel ||
      JSON.stringify(existingBusiness.existingRegistrations) !==
        JSON.stringify(form.existingRegistrations)
    ) {
      changed.add('licenses');
      changed.add('tax_finance');
      changed.add('insurance_risk');
    }
    if (
      existingBusiness.bankingEstablished !== form.bankingEstablished ||
      existingBusiness.bookkeepingEstablished !== form.bookkeepingEstablished
    ) {
      changed.add('banking_bookkeeping');
    }
    if (
      existingBusiness.workerTypes !== form.workerTypes ||
      existingBusiness.employeeCount !== form.employeeCount
    ) {
      changed.add('employees_hr');
    }
    if (
      existingBusiness.offeringType !== form.offeringType ||
      existingBusiness.activity !== form.activity
    ) {
      changed.add('daily_operations');
      changed.add('contracts_documents');
    }
    if (
      JSON.stringify(existingBusiness.marketingChannels) !==
      JSON.stringify(form.marketingChannels)
    ) {
      changed.add('marketing_growth');
    }
    if (JSON.stringify(existingBusiness.goals) !== JSON.stringify(form.goals)) {
      changed.add('profitability_growth');
    }
    return Array.from(changed);
  }, [existingBusiness, form]);

  const [selectedRegenCategories, setSelectedRegenCategories] = useState<BlueprintCategoryId[]>([]);
  const activeRegenCategories =
    selectedRegenCategories.length > 0 ? selectedRegenCategories : suggestedAffectedCategories;

  const toggleArrayValue = (key: 'existingRegistrations' | 'marketingChannels' | 'goals', val: string) => {
    setForm((prev) => {
      const current = prev[key];
      const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
      return { ...prev, [key]: next };
    });
  };

  const toggleRegenCategory = (id: BlueprintCategoryId) => {
    setSelectedRegenCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const canProceedStep1 =
    form.name.trim().length >= 2 &&
    form.industry.trim().length >= 2 &&
    form.activity.trim().length >= 5 &&
    form.country.trim().length >= 2;

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedJurisdictions = jurisdictionInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 15);

    const payload: BusinessAssessmentInput = {
      ...form,
      employeeCount: form.workerTypes === 'none' ? 0 : Math.max(1, form.employeeCount || 1),
      jurisdictions: parsedJurisdictions,
    };

    if (existingBusiness) {
      const targetCats =
        activeRegenCategories.length > 0
          ? activeRegenCategories
          : (['formation', 'licenses', 'tax_finance'] as BlueprintCategoryId[]);
      await onSubmit(payload, targetCats);
    } else {
      await onSubmit(payload);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white border border-[#E6E2F0] rounded-xl p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E6E2F0] mb-7">
        <div>
          <p className="text-xs font-semibold text-[#4C1D95] mb-1">
            {existingBusiness ? 'Update Business Profile & Blueprint' : 'Business Assessment'}
          </p>
          <h2 className="font-display text-2xl font-bold text-[#1C1B22]">
            {existingBusiness
              ? `Refine answers for ${existingBusiness.name}`
              : 'Tell Busi Rx about your business'}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono-tabular text-[#6E6A7C]">
          <span>Step {step} of 3</span>
        </div>
      </div>

      {/* Progress Segmented Bar */}
      <div className="grid grid-cols-3 gap-2 mb-8">
        {[
          { num: 1 as const, label: '01. Identity & Location' },
          { num: 2 as const, label: '02. Structure & Finance' },
          { num: 3 as const, label: '03. Team & Goals' },
        ].map((item) => (
          <button
            key={item.num}
            type="button"
            onClick={() => {
              if (item.num === 1 || canProceedStep1) setStep(item.num);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-medium text-left transition-colors ${
              step === item.num
                ? 'bg-[#4C1D95] text-white'
                : step > item.num
                ? 'bg-[#F3EFFC] text-[#4C1D95]'
                : 'bg-[#F8F7FB] text-[#6E6A7C]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleFinalSubmit} className="space-y-6">
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1B22] mb-1.5">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Lavender Loom Studio LLC"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C1B22] mb-1.5">
                  Industry *
                </label>
                <input
                  type="text"
                  required
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  placeholder="e.g., Specialty Coffee Roastery, B2B SaaS, Dental Clinic"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1B22] mb-1.5">
                Specific Business Activity *
              </label>
              <textarea
                required
                rows={2}
                value={form.activity}
                onChange={(e) => setForm({ ...form, activity: e.target.value })}
                placeholder="Describe what your business sells, manufactures, or delivers day-to-day..."
                className="w-full px-3.5 py-2.5 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1B22] mb-1.5">
                  Country *
                </label>
                <input
                  type="text"
                  required
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C1B22] mb-1.5">
                  State / Province
                </label>
                <input
                  type="text"
                  value={form.stateProvince}
                  onChange={(e) => setForm({ ...form, stateProvince: e.target.value })}
                  placeholder="e.g., California, Texas, Ontario"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C1B22] mb-1.5">
                  City
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="e.g., Austin"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1B22] mb-1.5">
                Additional Counties or Jurisdictions (comma-separated, optional)
              </label>
              <input
                type="text"
                value={jurisdictionInput}
                onChange={(e) => setJurisdictionInput(e.target.value)}
                placeholder="e.g., Travis County, Delaware (formation), New York (sales nexus)"
                className="w-full px-3.5 py-2.5 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#1C1B22] mb-2">
                  Business Stage
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'new' as const, label: 'New Launch' },
                    { value: 'existing' as const, label: 'Existing Business' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, stage: opt.value })}
                      className={`py-2.5 px-3 text-xs font-medium rounded-lg border transition-colors ${
                        form.stage === opt.value
                          ? 'bg-[#F3EFFC] border-[#4C1D95] text-[#4C1D95]'
                          : 'bg-white border-[#E6E2F0] text-[#4A4756]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1B22] mb-2">
                  Operating Model
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'physical' as const, label: 'Physical' },
                    { value: 'online' as const, label: 'Online' },
                    { value: 'both' as const, label: 'Both' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, operatingModel: opt.value })}
                      className={`py-2.5 px-2 text-xs font-medium rounded-lg border transition-colors ${
                        form.operatingModel === opt.value
                          ? 'bg-[#F3EFFC] border-[#4C1D95] text-[#4C1D95]'
                          : 'bg-white border-[#E6E2F0] text-[#4A4756]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-[#1C1B22] mb-1.5">
                Legal Structure
              </label>
              <select
                value={form.legalStructure}
                onChange={(e) =>
                  setForm({ ...form, legalStructure: e.target.value as LegalStructure })
                }
                className="w-full px-3.5 py-2.5 text-sm border border-[#E6E2F0] rounded-lg bg-white focus:outline-none focus:border-[#4C1D95]"
              >
                <option value="llc">Limited Liability Company (LLC)</option>
                <option value="sole_proprietorship">Sole Proprietorship</option>
                <option value="corporation">C-Corporation (C-Corp)</option>
                <option value="s_corp">S-Corporation (S-Corp)</option>
                <option value="partnership">Partnership</option>
                <option value="nonprofit">Nonprofit Organization</option>
                <option value="undecided">Undecided / Need Comparison</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1B22] mb-1">
                {form.stage === 'new'
                  ? 'Registrations, Licenses & Insurance Already Completed (if any)'
                  : 'Active Registrations, Licenses, Permits & Insurance'}
              </label>
              <p className="text-xs text-[#6E6A7C] mb-3">
                {form.operatingModel === 'online'
                  ? 'Tailored for online operations — select any federal, state, or insurance items already in place.'
                  : 'Select all permits, filings, and policies currently active so Busi Rx focuses on gaps and renewals.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {REGISTRATION_OPTIONS.filter((opt) => {
                  if (form.operatingModel === 'online' && opt === 'Health / Industry Permit') {
                    return false;
                  }
                  return true;
                }).map((opt) => {
                  const selected = form.existingRegistrations.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleArrayValue('existingRegistrations', opt)}
                      className={`flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-lg border text-left transition-colors ${
                        selected
                          ? 'bg-[#ECFDF5] border-[#059669] text-[#065F46]'
                          : 'bg-white border-[#E6E2F0] text-[#4A4756] hover:border-[#C9C2DC]'
                      }`}
                    >
                      <span>{opt}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-[#059669] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-lg border border-[#E6E2F0] bg-[#F8F7FB]">
                <p className="text-xs font-semibold text-[#1C1B22] mb-2">
                  Dedicated Business Banking
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, bankingEstablished: true })}
                    className={`flex-1 py-2 text-xs font-medium rounded-md border ${
                      form.bankingEstablished
                        ? 'bg-white border-[#059669] text-[#065F46]'
                        : 'bg-transparent border-[#E6E2F0] text-[#6E6A7C]'
                    }`}
                  >
                    Established
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, bankingEstablished: false })}
                    className={`flex-1 py-2 text-xs font-medium rounded-md border ${
                      !form.bankingEstablished
                        ? 'bg-white border-[#4C1D95] text-[#4C1D95]'
                        : 'bg-transparent border-[#E6E2F0] text-[#6E6A7C]'
                    }`}
                  >
                    Not Yet
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-[#E6E2F0] bg-[#F8F7FB]">
                <p className="text-xs font-semibold text-[#1C1B22] mb-2">
                  Bookkeeping System
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, bookkeepingEstablished: true })}
                    className={`flex-1 py-2 text-xs font-medium rounded-md border ${
                      form.bookkeepingEstablished
                        ? 'bg-white border-[#059669] text-[#065F46]'
                        : 'bg-transparent border-[#E6E2F0] text-[#6E6A7C]'
                    }`}
                  >
                    Established
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, bookkeepingEstablished: false })}
                    className={`flex-1 py-2 text-xs font-medium rounded-md border ${
                      !form.bookkeepingEstablished
                        ? 'bg-white border-[#4C1D95] text-[#4C1D95]'
                        : 'bg-transparent border-[#E6E2F0] text-[#6E6A7C]'
                    }`}
                  >
                    Not Yet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-[#1C1B22] mb-2">
                  What You Sell
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'products' as const, label: 'Products' },
                    { value: 'services' as const, label: 'Services' },
                    { value: 'both' as const, label: 'Both' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, offeringType: opt.value })}
                      className={`py-2.5 text-xs font-medium rounded-lg border ${
                        form.offeringType === opt.value
                          ? 'bg-[#F3EFFC] border-[#4C1D95] text-[#4C1D95]'
                          : 'bg-white border-[#E6E2F0] text-[#4A4756]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1B22] mb-2">
                  Team &amp; Workforce Setup
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'none' as const, label: 'Solo / None' },
                    { value: 'employees' as const, label: 'Employees' },
                    { value: 'contractors' as const, label: 'Contractors' },
                    { value: 'both' as const, label: 'Both' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, workerTypes: opt.value })}
                      className={`py-2 text-xs font-medium rounded-lg border ${
                        form.workerTypes === opt.value
                          ? 'bg-[#F3EFFC] border-[#4C1D95] text-[#4C1D95]'
                          : 'bg-white border-[#E6E2F0] text-[#4A4756]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Conditional headcount question */}
            {form.workerTypes !== 'none' && (
              <div>
                <label className="block text-xs font-semibold text-[#1C1B22] mb-1.5">
                  Number of Employees / Active Team Members
                </label>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={form.employeeCount || 1}
                  onChange={(e) =>
                    setForm({ ...form, employeeCount: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="w-40 px-3.5 py-2 text-sm font-mono-tabular border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1C1B22] mb-2">
                Current Marketing Channels
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MARKETING_CHANNEL_OPTIONS.map((ch) => {
                  const active = form.marketingChannels.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleArrayValue('marketingChannels', ch)}
                      className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg border text-left ${
                        active
                          ? 'bg-[#F3EFFC] border-[#4C1D95] text-[#4C1D95] font-medium'
                          : 'bg-white border-[#E6E2F0] text-[#4A4756]'
                      }`}
                    >
                      <span>{ch}</span>
                      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1B22] mb-2">
                Main Business Goals
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GOAL_OPTIONS.map((g) => {
                  const active = form.goals.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleArrayValue('goals', g)}
                      className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg border text-left ${
                        active
                          ? 'bg-[#ECFDF5] border-[#059669] text-[#065F46] font-medium'
                          : 'bg-white border-[#E6E2F0] text-[#4A4756]'
                      }`}
                    >
                      <span>{g}</span>
                      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {existingBusiness && (
              <div className="p-4 rounded-xl bg-[#F8F7FB] border border-[#E6E2F0]">
                <p className="text-xs font-semibold text-[#1C1B22] mb-1">
                  Blueprint Sections to Regenerate
                </p>
                <p className="text-xs text-[#6E6A7C] mb-3">
                  Only selected categories are regenerated—your completed tasks and existing
                  approved sections stay intact.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BLUEPRINT_CATEGORIES.map((cat) => {
                    const checked = activeRegenCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleRegenCategory(cat.id)}
                        className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg border text-left ${
                          checked
                            ? 'bg-white border-[#4C1D95] text-[#4C1D95] font-medium'
                            : 'bg-transparent border-[#E6E2F0] text-[#6E6A7C]'
                        }`}
                      >
                        <span>
                          {cat.number}. {cat.name}
                        </span>
                        {checked && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Controls */}
        <div className="pt-6 border-t border-[#E6E2F0] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="px-4 py-2 text-xs font-medium border border-[#E6E2F0] rounded-lg text-[#4A4756] hover:text-[#1C1B22] flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 text-xs text-[#6E6A7C] hover:text-[#1C1B22]"
              >
                Cancel
              </button>
            )}
          </div>

          {step < 3 ? (
            <button
              type="button"
              disabled={step === 1 && !canProceedStep1}
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="px-5 py-2.5 text-sm font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Blueprint with Gemini...</span>
                </>
              ) : existingBusiness ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Save &amp; Regenerate Affected Blueprint</span>
                </>
              ) : (
                <>
                  <span>Generate My Busi Rx Blueprint</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
