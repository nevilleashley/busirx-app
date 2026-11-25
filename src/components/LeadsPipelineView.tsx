import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  addDaysIso,
  daysUntilDate,
  formatCurrencyCents,
  formatIsoDate,
} from '../lib/domain.ts';
import type { LeadRecord, LeadStage } from '../types/busirx.ts';

interface LeadsPipelineViewProps {
  businessName: string;
  leads: LeadRecord[];
  preselectedDay?: { dayNumber: number; platform: string } | null;
  onClearPreselectedDay?: () => void;
  onCreateLead: (input: {
    fullName: string;
    companyOrHandle: string;
    email: string;
    phone: string;
    sourceChannel: string;
    sourcePostDay: number;
    interestSummary: string;
    estimatedValueCents: number;
    nextFollowUpDate: string;
    lastContactNote: string;
  }) => Promise<string | void>;
  onUpdateLead: (params: {
    lead: LeadRecord;
    stage: LeadStage;
    approvedForOutreach?: boolean;
    nextFollowUpDate?: string;
    lastContactNote?: string;
  }) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onDraftFollowUp: (lead: LeadRecord) => Promise<string>;
}

const STAGE_OPTIONS: Array<{ id: LeadStage; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

const SOURCE_CHANNEL_OPTIONS = [
  'Instagram',
  'Facebook',
  'LinkedIn',
  'Google Business Profile',
  'TikTok',
  'Referral',
  'Website Form',
  'Local Event / Walk-in',
  'Direct Outreach',
];

export function LeadsPipelineView({
  businessName,
  leads,
  preselectedDay,
  onClearPreselectedDay,
  onCreateLead,
  onUpdateLead,
  onDeleteLead,
  onDraftFollowUp,
}: LeadsPipelineViewProps) {
  // New lead form state
  const [fullName, setFullName] = useState('');
  const [companyOrHandle, setCompanyOrHandle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sourceChannel, setSourceChannel] = useState('Instagram');
  const [sourcePostDay, setSourcePostDay] = useState<number>(0);
  const [estimatedUsd, setEstimatedUsd] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState(
    addDaysIso(formatIsoDate(new Date()), 2)
  );
  const [interestSummary, setInterestSummary] = useState('');
  const [lastContactNote, setLastContactNote] = useState('');
  const [submittingLead, setSubmittingLead] = useState(false);

  // Filter & selection state
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Detail panel edit state
  const [editStage, setEditStage] = useState<LeadStage>('new');
  const [editFollowUp, setEditFollowUp] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);

  // AI follow-up draft composer
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [draftingFollowUp, setDraftingFollowUp] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (preselectedDay) {
      setSourcePostDay(preselectedDay.dayNumber);
      if (preselectedDay.platform) {
        setSourceChannel(preselectedDay.platform);
      }
      setStatusMessage(
        `Pre-linked new lead form to Social Calendar Day ${preselectedDay.dayNumber} (${preselectedDay.platform}).`
      );
      onClearPreselectedDay?.();
    }
  }, [preselectedDay, onClearPreselectedDay]);

  const metrics = useMemo(() => {
    let activeCount = 0;
    let openValueCents = 0;
    let wonCount = 0;
    let wonValueCents = 0;

    for (const l of leads) {
      if (l.stage === 'won') {
        wonCount += 1;
        wonValueCents += l.estimatedValueCents || 0;
      } else if (l.stage !== 'lost') {
        activeCount += 1;
        openValueCents += l.estimatedValueCents || 0;
      }
    }

    return {
      total: leads.length,
      activeCount,
      openValueCents,
      wonCount,
      wonValueCents,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...leads]
      .filter((l) => {
        if (stageFilter !== 'all' && l.stage !== stageFilter) return false;
        if (!q) return true;
        return (
          l.fullName.toLowerCase().includes(q) ||
          l.companyOrHandle.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.sourceChannel.toLowerCase().includes(q) ||
          l.interestSummary.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aDate = a.nextFollowUpDate || '9999-12-31';
        const bDate = b.nextFollowUpDate || '9999-12-31';
        return aDate.localeCompare(bDate);
      });
  }, [leads, stageFilter, searchQuery]);

  const activeLead = useMemo(() => {
    if (selectedLeadId) {
      const found = leads.find((l) => l.id === selectedLeadId);
      if (found) return found;
    }
    return filteredLeads[0] || leads[0] || null;
  }, [leads, filteredLeads, selectedLeadId]);

  useEffect(() => {
    if (activeLead) {
      setEditStage(activeLead.stage);
      setEditFollowUp(activeLead.nextFollowUpDate || '');
      setEditNote(activeLead.lastContactNote || '');
      setFollowUpDraft('');
    }
  }, [activeLead?.id, activeLead?.stage, activeLead?.nextFollowUpDate, activeLead?.lastContactNote]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setErrorMessage('');
    setSubmittingLead(true);
    try {
      const cents = Math.round((parseFloat(estimatedUsd) || 0) * 100);
      const newId = await onCreateLead({
        fullName: fullName.trim(),
        companyOrHandle: companyOrHandle.trim(),
        email: email.trim(),
        phone: phone.trim(),
        sourceChannel,
        sourcePostDay,
        interestSummary: interestSummary.trim(),
        estimatedValueCents: Math.max(0, cents),
        nextFollowUpDate,
        lastContactNote: lastContactNote.trim(),
      });
      if (typeof newId === 'string') {
        setSelectedLeadId(newId);
      }
      setFullName('');
      setCompanyOrHandle('');
      setEmail('');
      setPhone('');
      setSourcePostDay(0);
      setEstimatedUsd('');
      setInterestSummary('');
      setLastContactNote('');
      setStatusMessage('Lead saved to pipeline. Follow-up reminders will track its due date.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to save lead.');
    } finally {
      setSubmittingLead(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-2">
        <p className="text-xs font-semibold text-[#4C1D95]">
          Customer Pipeline · {businessName}
        </p>
        <h2 className="font-display text-xl font-bold text-[#1C1B22]">
          Generated Leads &amp; Follow-Up Space
        </h2>
        <p className="text-sm text-[#6E6A7C]">
          Capture every inquiry from your 30-day social media posts, referrals, and local outreach
          in one organized pipeline so advertising effort turns into tracked customers.
        </p>
      </div>

      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Total Captured Leads</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#1C1B22] mt-1">
            {metrics.total}
          </p>
          <p className="text-xs text-[#6E6A7C] mt-1">All recorded inquiries</p>
        </div>
        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Active Follow-Ups</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#4C1D95] mt-1">
            {metrics.activeCount}
          </p>
          <p className="text-xs text-[#6E6A7C] mt-1">In progress before close</p>
        </div>
        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Open Pipeline Value</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#1C1B22] mt-1">
            {formatCurrencyCents(metrics.openValueCents)}
          </p>
          <p className="text-xs text-[#6E6A7C] mt-1">Projected active deals</p>
        </div>
        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Won Customers</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#059669] mt-1">
            {metrics.wonCount}
          </p>
          <p className="font-mono-tabular text-xs text-[#059669] mt-1">
            {formatCurrencyCents(metrics.wonValueCents)} closed value
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#065F46] flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage('')}
            className="underline ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="underline ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split: Capture Form + Pipeline Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Add New Lead Form */}
        <form
          onSubmit={handleCreateSubmit}
          className="lg:col-span-5 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#4C1D95]" />
            <h3 className="font-display text-base font-semibold text-[#1C1B22]">
              Log Generated Lead
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Lead Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Jordan Taylor"
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Handle or Company
              </label>
              <input
                type="text"
                value={companyOrHandle}
                onChange={(e) => setCompanyOrHandle(e.target.value)}
                placeholder="e.g., @jordantaylor or Northside Co."
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@example.com"
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 234-5678"
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Lead Source Channel *
              </label>
              <select
                value={sourceChannel}
                onChange={(e) => setSourceChannel(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg bg-white"
              >
                {SOURCE_CHANNEL_OPTIONS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                From Social Calendar Day
              </label>
              <select
                value={sourcePostDay}
                onChange={(e) => setSourcePostDay(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg bg-white"
              >
                <option value={0}>Not tied to a specific day</option>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Day {String(d).padStart(2, '0')} Post
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Est. Deal Value (USD)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={estimatedUsd}
                onChange={(e) => setEstimatedUsd(e.target.value)}
                placeholder="e.g., 450"
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Next Follow-Up Date
              </label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A4756] mb-1">
              What They Need / Inquiry Summary
            </label>
            <textarea
              rows={2}
              value={interestSummary}
              onChange={(e) => setInterestSummary(e.target.value)}
              placeholder="e.g., Asked about starter package pricing after Day 4 post"
              className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A4756] mb-1">
              Initial Note
            </label>
            <input
              type="text"
              value={lastContactNote}
              onChange={(e) => setLastContactNote(e.target.value)}
              placeholder="e.g., Replied to DM, waiting on availability"
              className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={submittingLead}
            className="w-full py-2.5 px-4 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submittingLead ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving Lead...
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Add to Generated Leads
              </>
            )}
          </button>
        </form>

        {/* Right: Filter, Lead List, & Detail Workspace */}
        <div className="lg:col-span-7 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-5">
          {/* Search + Stage Filters */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-[#1C1B22]">
                Pipeline ({filteredLeads.length})
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#6E6A7C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search leads, handles, channels..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E6E2F0] rounded-lg"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-[#F8F7FB] border border-[#E6E2F0] rounded-lg p-1 w-fit">
              <button
                type="button"
                onClick={() => setStageFilter('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  stageFilter === 'all'
                    ? 'bg-[#4C1D95] text-white'
                    : 'text-[#4A4756] hover:text-[#1C1B22]'
                }`}
              >
                All ({leads.length})
              </button>
              {STAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStageFilter(opt.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                    stageFilter === opt.id
                      ? 'bg-[#4C1D95] text-white'
                      : 'text-[#4A4756] hover:text-[#1C1B22]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="py-10 text-center border-t border-[#F1EEF7] space-y-2">
              <p className="text-sm font-medium text-[#1C1B22]">
                {leads.length === 0
                  ? 'No leads captured yet'
                  : 'No leads match the selected filter'}
              </p>
              <p className="text-xs text-[#6E6A7C] max-w-md mx-auto">
                Whenever someone comments, DMs, fills out a form, or refers a prospect from your
                30-day social calendar, log them on the left to track follow-ups and close deals.
              </p>
            </div>
          ) : (
            <div className="space-y-5 border-t border-[#E6E2F0] pt-4">
              {/* Lead Rows */}
              <div className="divide-y divide-[#F1EEF7] max-h-64 overflow-y-auto">
                {filteredLeads.map((lead) => {
                  const isSelected = activeLead?.id === lead.id;
                  const followDays = daysUntilDate(lead.nextFollowUpDate);
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`w-full py-3 px-3 rounded-lg text-left transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isSelected ? 'bg-[#F3EFFC]' : 'hover:bg-[#FAF9FC]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1C1B22] truncate">
                          {lead.fullName}
                          {lead.companyOrHandle && (
                            <span className="text-xs font-normal text-[#6E6A7C]">
                              {' '}
                              · {lead.companyOrHandle}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#6E6A7C] truncate">
                          {lead.sourceChannel}
                          {lead.sourcePostDay > 0
                            ? ` · Day ${String(lead.sourcePostDay).padStart(2, '0')} Post`
                            : ''}
                          {lead.nextFollowUpDate ? ` · Follow up ${lead.nextFollowUpDate}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        {lead.estimatedValueCents > 0 && (
                          <span className="font-mono-tabular font-semibold text-[#1C1B22]">
                            {formatCurrencyCents(lead.estimatedValueCents)}
                          </span>
                        )}
                        <span
                          className={`font-medium capitalize ${
                            lead.stage === 'won'
                              ? 'text-[#059669]'
                              : lead.stage === 'lost'
                              ? 'text-[#6E6A7C]'
                              : followDays !== null && followDays < 0
                              ? 'text-red-600'
                              : 'text-[#4C1D95]'
                          }`}
                        >
                          {lead.stage.replace('_', ' ')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Lead Action & Follow-Up Section */}
              {activeLead && (
                <div className="border-t border-[#E6E2F0] pt-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#4C1D95] font-medium">
                        {activeLead.sourceChannel}
                        {activeLead.sourcePostDay > 0
                          ? ` · Generated from Social Day ${String(activeLead.sourcePostDay).padStart(2, '0')}`
                          : ''}
                        {activeLead.approvedForOutreach
                          ? ' · Outreach Approved'
                          : ' · Outreach Approval Pending'}
                      </p>
                      <h4 className="font-display text-lg font-bold text-[#1C1B22] mt-0.5">
                        {activeLead.fullName}
                      </h4>
                      <p className="text-xs text-[#6E6A7C]">
                        {[activeLead.companyOrHandle, activeLead.email, activeLead.phone]
                          .filter(Boolean)
                          .join(' · ') || 'No email/phone recorded yet'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteLead(activeLead.id);
                        setSelectedLeadId(null);
                        setStatusMessage(`Removed "${activeLead.fullName}" from pipeline.`);
                      }}
                      className="text-xs text-red-600 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>

                  {activeLead.interestSummary && (
                    <p className="text-xs text-[#4A4756] bg-[#F8F7FB] p-3 rounded-lg">
                      <span className="font-semibold text-[#1C1B22]">Inquiry: </span>
                      {activeLead.interestSummary}
                    </p>
                  )}

                  {/* Stage & Follow-Up Editor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#4A4756] mb-1">
                        Pipeline Stage
                      </label>
                      <select
                        value={editStage}
                        onChange={(e) => setEditStage(e.target.value as LeadStage)}
                        className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg bg-white"
                      >
                        {STAGE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#4A4756] mb-1">
                        Next Follow-Up Date
                      </label>
                      <input
                        type="date"
                        value={editFollowUp}
                        onChange={(e) => setEditFollowUp(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4A4756] mb-1">
                      Follow-Up &amp; Conversation Notes
                    </label>
                    <textarea
                      rows={2}
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={savingUpdate}
                      onClick={async () => {
                        setErrorMessage('');
                        setSavingUpdate(true);
                        try {
                          await onUpdateLead({
                            lead: activeLead,
                            stage: editStage,
                            approvedForOutreach:
                              editStage === 'proposal_sent'
                                ? true
                                : activeLead.approvedForOutreach,
                            nextFollowUpDate: editFollowUp,
                            lastContactNote: editNote,
                          });
                          setStatusMessage(`Updated pipeline details for ${activeLead.fullName}.`);
                        } catch (err) {
                          setErrorMessage(
                            err instanceof Error ? err.message : 'Unable to update lead.'
                          );
                        } finally {
                          setSavingUpdate(false);
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-50"
                    >
                      {savingUpdate ? 'Saving...' : 'Save Pipeline Update'}
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {!activeLead.approvedForOutreach ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await onUpdateLead({
                              lead: activeLead,
                              stage: editStage === 'new' ? 'contacted' : editStage,
                              approvedForOutreach: true,
                              nextFollowUpDate: editFollowUp,
                              lastContactNote: editNote,
                            });
                            setStatusMessage(
                              `Outreach approved for ${activeLead.fullName}.`
                            );
                          }}
                          className="px-3.5 py-2 text-xs font-semibold bg-[#F3EFFC] text-[#4C1D95] rounded-lg hover:bg-[#E8E0FA] flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Approve Outreach
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-[#059669] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Outreach Approved
                        </span>
                      )}

                      <button
                        type="button"
                        disabled={draftingFollowUp}
                        onClick={async () => {
                          setErrorMessage('');
                          setDraftingFollowUp(true);
                          try {
                            const text = await onDraftFollowUp(activeLead);
                            setFollowUpDraft(text);
                          } catch (err) {
                            setErrorMessage(
                              err instanceof Error
                                ? err.message
                                : 'Could not draft follow-up message.'
                            );
                          } finally {
                            setDraftingFollowUp(false);
                          }
                        }}
                        className="px-3.5 py-2 text-xs font-medium border border-[#E6E2F0] rounded-lg text-[#1C1B22] hover:bg-[#F8F7FB] flex items-center gap-1.5"
                      >
                        {draftingFollowUp ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Drafting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#4C1D95]" />
                            Draft Follow-Up with Gemini
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {followUpDraft && (
                    <div className="pt-3 border-t border-[#F1EEF7] space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-[#1C1B22]">
                          Follow-Up Message Draft (review before sending externally)
                        </label>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(followUpDraft);
                              setCopiedDraft(true);
                              setTimeout(() => setCopiedDraft(false), 2000);
                            } catch {
                              setStatusMessage('Copy manually from the text box.');
                            }
                          }}
                          className="text-xs font-medium text-[#4C1D95] hover:underline inline-flex items-center gap-1"
                        >
                          {copiedDraft ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#059669]" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Draft
                            </>
                          )}
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        value={followUpDraft}
                        onChange={(e) => setFollowUpDraft(e.target.value)}
                        className="w-full px-3 py-2 text-xs leading-relaxed border border-[#E6E2F0] rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
