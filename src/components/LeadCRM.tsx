import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  GripVertical,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  addDaysIso,
  daysUntilDate,
  formatCurrencyCents,
  formatIsoDate,
} from '../lib/domain.ts';
import type { LeadRecord, LeadStage } from '../types/busirx.ts';

export interface LeadCreateInput {
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
}

export interface LeadEditInput {
  fullName: string;
  companyOrHandle: string;
  email: string;
  phone: string;
  sourceChannel: string;
  sourcePostDay: number;
  interestSummary: string;
  estimatedValueCents: number;
  stage: LeadStage;
  nextFollowUpDate: string;
  lastContactNote: string;
  approvedForOutreach: boolean;
}

interface LeadCRMProps {
  businessName: string;
  leads: LeadRecord[];
  preselectedDay?: { dayNumber: number; platform: string } | null;
  onClearPreselectedDay?: () => void;
  onCreateLead: (input: LeadCreateInput) => Promise<string | void>;
  onUpdateLeadStage: (lead: LeadRecord, nextStage: LeadStage) => Promise<void>;
  onUpdateLeadDetails: (lead: LeadRecord, updates: LeadEditInput) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onDraftFollowUp: (lead: LeadRecord) => Promise<string>;
}

interface KanbanColumnDef {
  id: LeadStage;
  label: string;
  emptyHint: string;
  headerAccentClass: string;
}

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'new',
    label: 'New',
    emptyHint: 'Fresh inquiries from posts & forms',
    headerAccentClass: 'text-[#4C1D95]',
  },
  {
    id: 'contacted',
    label: 'Contacted',
    emptyHint: 'Initial reply or DM sent',
    headerAccentClass: 'text-[#1D4ED8]',
  },
  {
    id: 'qualified',
    label: 'Qualified',
    emptyHint: 'Ready for scope or proposal',
    headerAccentClass: 'text-[#B45309]',
  },
  {
    id: 'won',
    label: 'Closed-Won',
    emptyHint: 'Converted paying customers',
    headerAccentClass: 'text-[#059669]',
  },
  {
    id: 'lost',
    label: 'Closed-Lost',
    emptyHint: 'Paused or declined leads',
    headerAccentClass: 'text-[#6E6A7C]',
  },
];

const MODAL_STAGE_OPTIONS: Array<{ id: LeadStage; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal_sent', label: 'Qualified · Proposal Sent' },
  { id: 'won', label: 'Closed-Won' },
  { id: 'lost', label: 'Closed-Lost' },
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

function mapStageToColumn(stage: LeadStage): LeadStage {
  if (stage === 'proposal_sent') return 'qualified';
  return stage;
}

export function LeadCRM({
  businessName,
  leads,
  preselectedDay,
  onClearPreselectedDay,
  onCreateLead,
  onUpdateLeadStage,
  onUpdateLeadDetails,
  onDeleteLead,
  onDraftFollowUp,
}: LeadCRMProps) {
  // Quick-add form state
  const [quickName, setQuickName] = useState('');
  const [quickCompany, setQuickCompany] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickSource, setQuickSource] = useState('Instagram');
  const [quickPostDay, setQuickPostDay] = useState<number>(0);
  const [quickUsd, setQuickUsd] = useState('');
  const [quickFollowUp, setQuickFollowUp] = useState(addDaysIso(formatIsoDate(new Date()), 2));
  const [quickInterest, setQuickInterest] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [showMoreQuickFields, setShowMoreQuickFields] = useState(false);
  const [submittingQuick, setSubmittingQuick] = useState(false);

  // Board filter & drag state
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStage | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);

  // Feedback state
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Edit modal state
  const [editingLead, setEditingLead] = useState<LeadRecord | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSource, setEditSource] = useState('Instagram');
  const [editPostDay, setEditPostDay] = useState(0);
  const [editUsd, setEditUsd] = useState('');
  const [editStage, setEditStage] = useState<LeadStage>('new');
  const [editFollowUp, setEditFollowUp] = useState('');
  const [editInterest, setEditInterest] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editApprovedOutreach, setEditApprovedOutreach] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);

  // Gemini follow-up draft inside edit modal
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [draftingFollowUp, setDraftingFollowUp] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  useEffect(() => {
    if (preselectedDay) {
      setQuickPostDay(preselectedDay.dayNumber);
      if (preselectedDay.platform) {
        setQuickSource(preselectedDay.platform);
      }
      setShowMoreQuickFields(true);
      setStatusMessage(
        `Quick-add pre-linked to Social Calendar Day ${String(preselectedDay.dayNumber).padStart(
          2,
          '0'
        )} (${preselectedDay.platform}).`
      );
      onClearPreselectedDay?.();
    }
  }, [preselectedDay, onClearPreselectedDay]);

  useEffect(() => {
    if (!editingLead) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingLead(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingLead]);

  const openEditModal = (lead: LeadRecord) => {
    setEditingLead(lead);
    setEditFullName(lead.fullName);
    setEditCompany(lead.companyOrHandle);
    setEditEmail(lead.email);
    setEditPhone(lead.phone);
    setEditSource(lead.sourceChannel || 'Instagram');
    setEditPostDay(lead.sourcePostDay || 0);
    setEditUsd(lead.estimatedValueCents > 0 ? String(Math.round(lead.estimatedValueCents / 100)) : '');
    setEditStage(lead.stage);
    setEditFollowUp(lead.nextFollowUpDate || '');
    setEditInterest(lead.interestSummary || '');
    setEditNote(lead.lastContactNote || '');
    setEditApprovedOutreach(Boolean(lead.approvedForOutreach));
    setConfirmingDelete(false);
    setFollowUpDraft('');
    setCopiedDraft(false);
  };

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

  const availableChannels = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      if (l.sourceChannel) set.add(l.sourceChannel);
    }
    return Array.from(set).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return leads.filter((l) => {
      if (channelFilter !== 'all' && l.sourceChannel !== channelFilter) return false;
      if (!q) return true;
      return (
        l.fullName.toLowerCase().includes(q) ||
        l.companyOrHandle.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.sourceChannel.toLowerCase().includes(q) ||
        l.interestSummary.toLowerCase().includes(q) ||
        l.lastContactNote.toLowerCase().includes(q)
      );
    });
  }, [leads, searchQuery, channelFilter]);

  const leadsByColumn = useMemo(() => {
    const map: Record<LeadStage, LeadRecord[]> = {
      new: [],
      contacted: [],
      qualified: [],
      proposal_sent: [],
      won: [],
      lost: [],
    };
    for (const lead of filteredLeads) {
      const col = mapStageToColumn(lead.stage);
      map[col].push(lead);
    }
    for (const key of Object.keys(map) as LeadStage[]) {
      map[key].sort((a, b) => {
        const aDate = a.nextFollowUpDate || '9999-12-31';
        const bDate = b.nextFollowUpDate || '9999-12-31';
        return aDate.localeCompare(bDate);
      });
    }
    return map;
  }, [filteredLeads]);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;
    setErrorMessage('');
    setSubmittingQuick(true);
    try {
      const cents = Math.max(0, Math.round((parseFloat(quickUsd) || 0) * 100));
      await onCreateLead({
        fullName: quickName.trim(),
        companyOrHandle: quickCompany.trim(),
        email: quickEmail.trim(),
        phone: quickPhone.trim(),
        sourceChannel: quickSource,
        sourcePostDay: quickPostDay,
        interestSummary: quickInterest.trim(),
        estimatedValueCents: cents,
        nextFollowUpDate: quickFollowUp,
        lastContactNote: quickNote.trim(),
      });
      setQuickName('');
      setQuickCompany('');
      setQuickEmail('');
      setQuickPhone('');
      setQuickPostDay(0);
      setQuickUsd('');
      setQuickInterest('');
      setQuickNote('');
      setStatusMessage('Lead added to the New column.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to add lead.');
    } finally {
      setSubmittingQuick(false);
    }
  };

  const handleStageTransition = async (lead: LeadRecord, nextStage: LeadStage) => {
    if (lead.stage === nextStage) return;
    setErrorMessage('');
    setMovingLeadId(lead.id);
    try {
      await onUpdateLeadStage(lead, nextStage);
      const targetLabel =
        KANBAN_COLUMNS.find((c) => c.id === mapStageToColumn(nextStage))?.label || nextStage;
      setStatusMessage(`Moved ${lead.fullName} to ${targetLabel}.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to move lead.');
    } finally {
      setMovingLeadId(null);
    }
  };

  const handleDropOnColumn = async (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = draggedLeadId || e.dataTransfer.getData('text/plain');
    setDraggedLeadId(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    await handleStageTransition(lead, targetStage);
  };

  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead || !editFullName.trim()) return;
    setErrorMessage('');
    setSavingEdit(true);
    try {
      const cents = Math.max(0, Math.round((parseFloat(editUsd) || 0) * 100));
      await onUpdateLeadDetails(editingLead, {
        fullName: editFullName.trim(),
        companyOrHandle: editCompany.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        sourceChannel: editSource,
        sourcePostDay: editPostDay,
        interestSummary: editInterest.trim(),
        estimatedValueCents: cents,
        stage: editStage,
        nextFollowUpDate: editFollowUp,
        lastContactNote: editNote.trim(),
        approvedForOutreach: editStage === 'proposal_sent' ? true : editApprovedOutreach,
      });
      setStatusMessage(`Saved changes for ${editFullName.trim()}.`);
      setEditingLead(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to save lead changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#4C1D95]">
            Lead CRM · {businessName}
          </p>
          <h2 className="font-display text-xl font-bold text-[#1C1B22]">
            Lead Pipeline Kanban Board
          </h2>
          <p className="text-sm text-[#6E6A7C]">
            Drag leads across stages from New to Closed-Won, quick-add inquiries in seconds, or
            click any card to edit contact details and notes.
          </p>
        </div>
      </div>

      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Total Leads</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#1C1B22] mt-1">
            {metrics.total}
          </p>
          <p className="text-xs text-[#6E6A7C] mt-1">Across all 5 pipeline stages</p>
        </div>

        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Active Pipeline</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#4C1D95] mt-1">
            {metrics.activeCount}
          </p>
          <p className="text-xs text-[#6E6A7C] mt-1">New, Contacted &amp; Qualified</p>
        </div>

        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Open Pipeline Value</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#1C1B22] mt-1">
            {formatCurrencyCents(metrics.openValueCents)}
          </p>
          <p className="text-xs text-[#6E6A7C] mt-1">Projected active deals</p>
        </div>

        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Closed-Won</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#059669] mt-1">
            {metrics.wonCount}
          </p>
          <p className="font-mono-tabular text-xs text-[#059669] mt-1">
            {formatCurrencyCents(metrics.wonValueCents)} closed revenue
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

      {/* Quick-Add Lead Form */}
      <form
        onSubmit={handleQuickAddSubmit}
        className="bg-white border border-[#E6E2F0] rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#4C1D95]" />
            <h3 className="font-display text-sm font-semibold text-[#1C1B22]">
              Quick-Add Lead
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowMoreQuickFields((prev) => !prev)}
            className="text-xs font-medium text-[#4C1D95] hover:underline inline-flex items-center gap-1"
          >
            {showMoreQuickFields ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Hide extra details
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Add email, phone, day &amp; notes
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-3">
            <label htmlFor="quick-lead-name" className="block text-xs font-medium text-[#4A4756] mb-1">
              Lead Name *
            </label>
            <input
              id="quick-lead-name"
              type="text"
              required
              maxLength={140}
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="e.g., Jordan Taylor"
              className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
            />
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="quick-lead-company" className="block text-xs font-medium text-[#4A4756] mb-1">
              Company or @Handle
            </label>
            <input
              id="quick-lead-company"
              type="text"
              maxLength={140}
              value={quickCompany}
              onChange={(e) => setQuickCompany(e.target.value)}
              placeholder="e.g., @jordantaylor or Northside Co."
              className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="quick-lead-source" className="block text-xs font-medium text-[#4A4756] mb-1">
              Source Channel
            </label>
            <select
              id="quick-lead-source"
              value={quickSource}
              onChange={(e) => setQuickSource(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg bg-white focus:outline-none focus:border-[#4C1D95]"
            >
              {SOURCE_CHANNEL_OPTIONS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="quick-lead-value" className="block text-xs font-medium text-[#4A4756] mb-1">
              Est. Value (USD)
            </label>
            <input
              id="quick-lead-value"
              type="number"
              min="0"
              step="1"
              value={quickUsd}
              onChange={(e) => setQuickUsd(e.target.value)}
              placeholder="450"
              className="w-full px-3 py-2 text-sm font-mono-tabular border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
            />
          </div>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={submittingQuick}
              className="w-full py-2.5 px-4 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {submittingQuick ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Add Lead
                </>
              )}
            </button>
          </div>
        </div>

        {showMoreQuickFields && (
          <div className="pt-3 border-t border-[#F1EEF7] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Email</label>
              <input
                type="email"
                maxLength={254}
                value={quickEmail}
                onChange={(e) => setQuickEmail(e.target.value)}
                placeholder="jordan@example.com"
                className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Phone</label>
              <input
                type="tel"
                maxLength={40}
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
                placeholder="(555) 234-5678"
                className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Social Calendar Day
              </label>
              <select
                value={quickPostDay}
                onChange={(e) => setQuickPostDay(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg bg-white"
              >
                <option value={0}>Not linked to a day</option>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Day {String(d).padStart(2, '0')} Post
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
                value={quickFollowUp}
                onChange={(e) => setQuickFollowUp(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Inquiry Summary
              </label>
              <input
                type="text"
                maxLength={500}
                value={quickInterest}
                onChange={(e) => setQuickInterest(e.target.value)}
                placeholder="e.g., Asked about starter package pricing after Day 4 post"
                className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Initial Note
              </label>
              <input
                type="text"
                maxLength={1000}
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="e.g., Replied via DM, send quote Friday"
                className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg"
              />
            </div>
          </div>
        )}
      </form>

      {/* Search & Channel Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#6E6A7C] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads by name, handle, email, or notes..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#E6E2F0] rounded-lg focus:outline-none focus:border-[#4C1D95]"
          />
        </div>

        <div className="flex items-center gap-3">
          {availableChannels.length > 0 && (
            <select
              aria-label="Filter leads by channel"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-[#E6E2F0] rounded-lg"
            >
              <option value="all">All Channels ({leads.length})</option>
              {availableChannels.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          )}
          <span className="font-mono-tabular text-xs text-[#6E6A7C] whitespace-nowrap">
            Showing {filteredLeads.length} of {leads.length}
          </span>
        </div>
      </div>

      {/* 5-Column Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
        {KANBAN_COLUMNS.map((col) => {
          const colLeads = leadsByColumn[col.id] || [];
          const colValueCents = colLeads.reduce((sum, l) => sum + (l.estimatedValueCents || 0), 0);
          const isDropTarget = dragOverColumn === col.id;

          return (
            <section
              key={col.id}
              aria-label={`${col.label} stage column`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverColumn !== col.id) setDragOverColumn(col.id);
              }}
              onDragLeave={() => {
                if (dragOverColumn === col.id) setDragOverColumn(null);
              }}
              onDrop={(e) => handleDropOnColumn(e, col.id)}
              className={`rounded-xl border transition-colors p-3 space-y-3 min-h-[260px] ${
                isDropTarget
                  ? 'bg-[#F3EFFC] border-[#4C1D95]'
                  : 'bg-[#F4F2F8] border-[#E6E2F0]'
              }`}
            >
              {/* Column Header */}
              <div className="px-1 pb-2 border-b border-[#E6E2F0] flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <h3 className={`font-display text-sm font-bold truncate ${col.headerAccentClass}`}>
                    {col.label}
                  </h3>
                  <p className="font-mono-tabular text-[11px] text-[#6E6A7C]">
                    {formatCurrencyCents(colValueCents)}
                  </p>
                </div>
                <span className="font-mono-tabular text-xs font-semibold text-[#1C1B22] shrink-0">
                  {colLeads.length}
                </span>
              </div>

              {/* Column Cards */}
              {colLeads.length === 0 ? (
                <div className="py-8 px-2 text-center">
                  <p className="text-xs font-medium text-[#6E6A7C]">No {col.label} leads</p>
                  <p className="text-[11px] text-[#8E8A9C] mt-1">{col.emptyHint}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {colLeads.map((lead) => {
                    const followDays = daysUntilDate(lead.nextFollowUpDate);
                    const isOverdue =
                      lead.stage !== 'won' &&
                      lead.stage !== 'lost' &&
                      followDays !== null &&
                      followDays < 0;
                    const isBusy = movingLeadId === lead.id;

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedLeadId(lead.id);
                          e.dataTransfer.setData('text/plain', lead.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggedLeadId(null);
                          setDragOverColumn(null);
                        }}
                        onClick={() => openEditModal(lead)}
                        className={`bg-white border border-[#E6E2F0] hover:border-[#4C1D95] rounded-lg p-3 space-y-2 cursor-pointer transition-colors ${
                          draggedLeadId === lead.id ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Top row: Name + Drag handle */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#1C1B22] truncate">
                              {lead.fullName}
                            </p>
                            {lead.companyOrHandle && (
                              <p className="text-xs text-[#6E6A7C] truncate">
                                {lead.companyOrHandle}
                              </p>
                            )}
                          </div>
                          <GripVertical
                            className="w-3.5 h-3.5 text-[#9A95AA] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                        </div>

                        {/* Unboxed metadata row */}
                        <p className="text-[11px] text-[#6E6A7C] truncate">
                          {lead.sourceChannel}
                          {lead.sourcePostDay > 0
                            ? ` · Day ${String(lead.sourcePostDay).padStart(2, '0')}`
                            : ''}
                          {lead.stage === 'proposal_sent' ? ' · Proposal Sent' : ''}
                        </p>

                        {/* Value & Follow-Up Date */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono-tabular font-semibold text-[#1C1B22]">
                            {lead.estimatedValueCents > 0
                              ? formatCurrencyCents(lead.estimatedValueCents)
                              : 'Value TBD'}
                          </span>
                          {lead.nextFollowUpDate && (
                            <span
                              className={`font-mono-tabular text-[11px] inline-flex items-center gap-1 ${
                                isOverdue ? 'text-[#DC2626] font-semibold' : 'text-[#6E6A7C]'
                              }`}
                            >
                              {isOverdue && <AlertCircle className="w-3 h-3 shrink-0" />}
                              {isOverdue ? `Overdue · ${lead.nextFollowUpDate}` : lead.nextFollowUpDate}
                            </span>
                          )}
                        </div>

                        {/* Brief note preview if available */}
                        {(lead.lastContactNote || lead.interestSummary) && (
                          <p className="text-[11px] text-[#4A4756] line-clamp-2 pt-1 border-t border-[#F1EEF7]">
                            {lead.lastContactNote || lead.interestSummary}
                          </p>
                        )}

                        {/* Card footer: stage selector + edit trigger */}
                        <div
                          className="pt-2 border-t border-[#F1EEF7] flex items-center justify-between gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            aria-label={`Stage for ${lead.fullName}`}
                            disabled={isBusy}
                            value={mapStageToColumn(lead.stage)}
                            onChange={(e) =>
                              handleStageTransition(lead, e.target.value as LeadStage)
                            }
                            className="text-[11px] font-medium text-[#4A4756] bg-[#F8F7FB] border border-[#E6E2F0] rounded px-1.5 py-1 max-w-[125px] focus:outline-none focus:border-[#4C1D95]"
                          >
                            {KANBAN_COLUMNS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => openEditModal(lead)}
                            className="text-[11px] font-medium text-[#4C1D95] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Lead Edit Modal */}
      {editingLead && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-lead-modal-title"
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingLead(null)}
        >
          <div
            className="bg-white border border-[#E6E2F0] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E6E2F0]">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#4C1D95]">
                  Edit Lead Details &amp; Notes
                </p>
                <h3
                  id="edit-lead-modal-title"
                  className="font-display text-lg font-bold text-[#1C1B22] truncate mt-0.5"
                >
                  {editingLead.fullName}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setEditingLead(null)}
                className="p-1.5 rounded-lg text-[#6E6A7C] hover:text-[#1C1B22] hover:bg-[#F8F7FB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A4756] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={140}
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A4756] mb-1">
                    Company or @Handle
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A4756] mb-1">Email</label>
                  <input
                    type="email"
                    maxLength={254}
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A4756] mb-1">Phone</label>
                  <input
                    type="tel"
                    maxLength={40}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="(555) 234-5678"
                    className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A4756] mb-1">
                    Kanban Stage
                  </label>
                  <select
                    value={editStage}
                    onChange={(e) => setEditStage(e.target.value as LeadStage)}
                    className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg bg-white"
                  >
                    {MODAL_STAGE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#4A4756] mb-1">
                    Est. Deal Value (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editUsd}
                    onChange={(e) => setEditUsd(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-[#E6E2F0] rounded-lg"
                  />
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A4756] mb-1">
                    Source Channel
                  </label>
                  <select
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
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
                    Social Calendar Day
                  </label>
                  <select
                    value={editPostDay}
                    onChange={(e) => setEditPostDay(Number(e.target.value))}
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

              <div>
                <label className="block text-xs font-medium text-[#4A4756] mb-1">
                  Inquiry Summary / What They Need
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={editInterest}
                  onChange={(e) => setEditInterest(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4A4756] mb-1">
                  Conversation &amp; Follow-Up Notes
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Log calls, DMs, objections, pricing discussed, and next steps..."
                  className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg"
                />
              </div>

              {/* Outreach Approval & Gemini Follow-Up Helper */}
              <div className="pt-2 border-t border-[#F1EEF7] flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-[#1C1B22] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editStage === 'proposal_sent' ? true : editApprovedOutreach}
                    onChange={(e) => setEditApprovedOutreach(e.target.checked)}
                    className="rounded border-[#E6E2F0] text-[#4C1D95]"
                  />
                  <ShieldCheck className="w-3.5 h-3.5 text-[#4C1D95]" />
                  <span>Owner approved for external outreach / proposals</span>
                </label>

                <button
                  type="button"
                  disabled={draftingFollowUp}
                  onClick={async () => {
                    setErrorMessage('');
                    setDraftingFollowUp(true);
                    try {
                      const draft = await onDraftFollowUp({
                        ...editingLead,
                        fullName: editFullName || editingLead.fullName,
                        companyOrHandle: editCompany,
                        sourceChannel: editSource,
                        sourcePostDay: editPostDay,
                        interestSummary: editInterest,
                        stage: editStage,
                      });
                      setFollowUpDraft(draft);
                    } catch (err) {
                      setErrorMessage(
                        err instanceof Error
                          ? err.message
                          : 'Could not generate follow-up message.'
                      );
                    } finally {
                      setDraftingFollowUp(false);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium border border-[#E6E2F0] rounded-lg text-[#1C1B22] hover:bg-[#F8F7FB] inline-flex items-center gap-1.5 whitespace-nowrap"
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

              {followUpDraft && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1C1B22]">
                      Suggested Follow-Up (review and copy to send)
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(followUpDraft);
                          setCopiedDraft(true);
                          setTimeout(() => setCopiedDraft(false), 2000);
                        } catch {
                          setStatusMessage('Copy manually from the draft field.');
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
                    rows={3}
                    value={followUpDraft}
                    onChange={(e) => setFollowUpDraft(e.target.value)}
                    className="w-full px-3 py-2 text-xs leading-relaxed border border-[#E6E2F0] rounded-lg"
                  />
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-[#E6E2F0] flex flex-wrap items-center justify-between gap-3">
                <div>
                  {!confirmingDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="text-xs font-medium text-red-600 hover:underline inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Lead
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={deletingLead}
                        onClick={async () => {
                          setDeletingLead(true);
                          try {
                            await onDeleteLead(editingLead.id);
                            setStatusMessage(`Deleted "${editingLead.fullName}" from Lead CRM.`);
                            setEditingLead(null);
                          } catch (err) {
                            setErrorMessage(
                              err instanceof Error ? err.message : 'Unable to delete lead.'
                            );
                          } finally {
                            setDeletingLead(false);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingLead ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        className="text-xs text-[#6E6A7C] hover:text-[#1C1B22]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLead(null)}
                    className="px-4 py-2 text-xs font-medium text-[#4A4756] border border-[#E6E2F0] rounded-lg hover:bg-[#F8F7FB]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {savingEdit ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
