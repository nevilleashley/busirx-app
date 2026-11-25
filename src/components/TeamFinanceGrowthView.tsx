import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Megaphone, Plus, ShieldAlert, Users, Wallet } from 'lucide-react';
import { daysUntilDate, formatCurrencyCents, formatIsoDate } from '../lib/domain.ts';
import type {
  FinancialEntryRecord,
  MarketingCampaignRecord,
  TeamMemberRecord,
} from '../types/busirx.ts';

interface TeamFinanceGrowthViewProps {
  teamMembers: TeamMemberRecord[];
  financialEntries: FinancialEntryRecord[];
  campaigns: MarketingCampaignRecord[];
  onCreateTeamMember: (input: {
    fullName: string;
    email: string;
    roleTitle: string;
    workerClassification: TeamMemberRecord['workerClassification'];
    certificationName: string;
    certificationExpiry: string;
  }) => Promise<void>;
  onCreateFinancialEntry: (input: {
    entryType: FinancialEntryRecord['entryType'];
    category: string;
    description: string;
    amountCents: number;
    entryDate: string;
  }) => Promise<void>;
  onCreateCampaign: (input: {
    channel: string;
    campaignName: string;
    goal: string;
    targetMetric: string;
    requiresExternalSendApproval: boolean;
  }) => Promise<void>;
  onApproveCampaign: (campaignId: string) => Promise<void>;
  onOpenSocialCalendar?: () => void;
}

export function TeamFinanceGrowthView({
  teamMembers,
  financialEntries,
  campaigns,
  onCreateTeamMember,
  onCreateFinancialEntry,
  onCreateCampaign,
  onApproveCampaign,
  onOpenSocialCalendar,
}: TeamFinanceGrowthViewProps) {
  const [activeTab, setActiveTab] = useState<'finance' | 'team' | 'marketing'>('finance');

  // Team Form
  const [fullName, setFullName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [workerClassification, setWorkerClassification] =
    useState<TeamMemberRecord['workerClassification']>('employee_w2');
  const [certificationName, setCertificationName] = useState('');
  const [certificationExpiry, setCertificationExpiry] = useState('');

  // Finance Form
  const [entryType, setEntryType] = useState<FinancialEntryRecord['entryType']>('revenue');
  const [finCategory, setFinCategory] = useState('Client Sales');
  const [finDesc, setFinDesc] = useState('');
  const [finAmountUsd, setFinAmountUsd] = useState('');
  const [entryDate, setEntryDate] = useState(formatIsoDate(new Date()));

  // Marketing Form
  const [channel, setChannel] = useState('Local SEO & Google Business');
  const [campaignName, setCampaignName] = useState('');
  const [goal, setGoal] = useState('');
  const [targetMetric, setTargetMetric] = useState('');

  const totals = useMemo(() => {
    let revenue = 0;
    let expense = 0;
    let taxReserve = 0;
    for (const e of financialEntries) {
      if (e.entryType === 'revenue') revenue += e.amountCents;
      else if (e.entryType === 'expense') expense += e.amountCents;
      else if (e.entryType === 'tax_reserve') taxReserve += e.amountCents;
    }
    return {
      revenue,
      expense,
      taxReserve,
      net: revenue - expense,
    };
  }, [financialEntries]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E6E2F0] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#1C1B22]">
            Finance, Team &amp; Growth Operations
          </h2>
          <p className="text-sm text-[#6E6A7C] mt-0.5">
            Track revenue, tax reserves, employee/contractor certifications, and approved acquisition
            campaigns.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F3EFFC] rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('finance')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'finance' ? 'bg-white text-[#1C1B22]' : 'text-[#4A4756]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Financial Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'team' ? 'bg-white text-[#1C1B22]' : 'text-[#4A4756]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Team &amp; Certifications
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('marketing')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'marketing' ? 'bg-white text-[#1C1B22]' : 'text-[#4A4756]'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Marketing &amp; Growth
          </button>
        </div>
      </div>

      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
              <p className="text-xs text-[#6E6A7C]">Recorded Revenue</p>
              <p className="font-mono-tabular text-2xl font-bold text-[#059669] mt-1">
                {formatCurrencyCents(totals.revenue)}
              </p>
            </div>
            <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
              <p className="text-xs text-[#6E6A7C]">Recorded Expenses</p>
              <p className="font-mono-tabular text-2xl font-bold text-[#1C1B22] mt-1">
                {formatCurrencyCents(totals.expense)}
              </p>
            </div>
            <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
              <p className="text-xs text-[#6E6A7C]">Net Operating Cash</p>
              <p className="font-mono-tabular text-2xl font-bold text-[#4C1D95] mt-1">
                {formatCurrencyCents(totals.net)}
              </p>
            </div>
            <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
              <p className="text-xs text-[#6E6A7C]">Tax Reserve Set Aside</p>
              <p className="font-mono-tabular text-2xl font-bold text-[#1C1B22] mt-1">
                {formatCurrencyCents(totals.taxReserve)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const cents = Math.round((parseFloat(finAmountUsd) || 0) * 100);
                if (cents <= 0) return;
                await onCreateFinancialEntry({
                  entryType,
                  category: finCategory,
                  description: finDesc,
                  amountCents: cents,
                  entryDate,
                });
                setFinDesc('');
                setFinAmountUsd('');
              }}
              className="lg:col-span-4 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4"
            >
              <h3 className="font-display text-base font-semibold text-[#1C1B22]">
                Log Financial Entry
              </h3>
              <div>
                <label className="block text-xs font-medium text-[#4A4756] mb-1">Type</label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as FinancialEntryRecord['entryType'])}
                  className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg bg-white"
                >
                  <option value="revenue">Revenue</option>
                  <option value="expense">Operating Expense</option>
                  <option value="tax_reserve">Tax Reserve Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A4756] mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={finCategory}
                  onChange={(e) => setFinCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#4A4756] mb-1">
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    value={finAmountUsd}
                    onChange={(e) => setFinAmountUsd(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono-tabular border border-[#E6E2F0] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4A4756] mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A4756] mb-1">Notes</label>
                <input
                  type="text"
                  value={finDesc}
                  onChange={(e) => setFinDesc(e.target.value)}
                  placeholder="Invoice # or expense note"
                  className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Entry
              </button>
            </form>

            <div className="lg:col-span-8 bg-white border border-[#E6E2F0] rounded-xl overflow-hidden">
              {financialEntries.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#6E6A7C]">
                  No financial entries recorded yet. Log revenue, expenses, or tax reserves to track
                  margins.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E6E2F0] text-xs font-semibold text-[#6E6A7C] bg-[#F8F7FB]">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1EEF7] text-sm">
                      {financialEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-[#FAF9FC]">
                          <td className="py-3 px-4 font-mono-tabular text-xs text-[#6E6A7C]">
                            {entry.entryDate}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-[#1C1B22]">{entry.category}</p>
                            {entry.description && (
                              <p className="text-xs text-[#6E6A7C]">{entry.description}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs capitalize text-[#4A4756]">
                            {entry.entryType.replace('_', ' ')}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono-tabular text-xs font-semibold ${
                              entry.entryType === 'revenue' ? 'text-[#059669]' : 'text-[#1C1B22]'
                            }`}
                          >
                            {entry.entryType === 'expense' ? '-' : ''}
                            {formatCurrencyCents(entry.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onCreateTeamMember({
                fullName,
                email: memberEmail,
                roleTitle,
                workerClassification,
                certificationName,
                certificationExpiry,
              });
              setFullName('');
              setMemberEmail('');
              setRoleTitle('');
              setCertificationName('');
              setCertificationExpiry('');
            }}
            className="lg:col-span-4 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-[#1C1B22]">
              Add Team Member or Contractor
            </h3>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Email</label>
              <input
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#4A4756] mb-1">Role</label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g., Manager"
                  className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A4756] mb-1">Class</label>
                <select
                  value={workerClassification}
                  onChange={(e) =>
                    setWorkerClassification(
                      e.target.value as TeamMemberRecord['workerClassification']
                    )
                  }
                  className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg bg-white"
                >
                  <option value="employee_w2">Employee (W-2)</option>
                  <option value="contractor_1099">Contractor (1099)</option>
                  <option value="owner">Owner / Partner</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Required Certification / License (optional)
              </label>
              <input
                type="text"
                value={certificationName}
                onChange={(e) => setCertificationName(e.target.value)}
                placeholder="e.g., Food Handler Permit, OSHA-10, CPA"
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Certification Expiration Date
              </label>
              <input
                type="date"
                value={certificationExpiry}
                onChange={(e) => setCertificationExpiry(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478]"
            >
              Add to Roster
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-[#E6E2F0] rounded-xl p-6">
            <h3 className="font-display text-base font-semibold text-[#1C1B22] mb-4">
              Workforce &amp; Certification Roster ({teamMembers.length})
            </h3>
            {teamMembers.length === 0 ? (
              <p className="text-sm text-[#6E6A7C] py-8">
                No employees or contractors added yet. Add workers to track onboarding and
                certification renewal alerts.
              </p>
            ) : (
              <div className="divide-y divide-[#F1EEF7]">
                {teamMembers.map((m) => {
                  const certDays = daysUntilDate(m.certificationExpiry);
                  return (
                    <div key={m.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1C1B22]">
                          {m.fullName}{' '}
                          <span className="text-xs font-normal text-[#6E6A7C]">
                            · {m.roleTitle || 'Team Member'} ·{' '}
                            {m.workerClassification.replace('_', ' ')}
                          </span>
                        </p>
                        <p className="text-xs text-[#6E6A7C]">{m.email || 'No email provided'}</p>
                      </div>
                      <div className="text-xs text-right">
                        {m.certificationName ? (
                          <div>
                            <p className="font-medium text-[#1C1B22]">{m.certificationName}</p>
                            <p
                              className={`font-mono-tabular ${
                                certDays !== null && certDays <= 14
                                  ? 'text-[#B45309] font-semibold'
                                  : 'text-[#6E6A7C]'
                              }`}
                            >
                              Expires: {m.certificationExpiry || 'Not set'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[#6E6A7C]">No certification tracked</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'marketing' && (
        <div className="space-y-6">
          {onOpenSocialCalendar && (
            <div className="bg-[#F3EFFC] border border-[#DDD6FE] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CalendarDays className="w-5 h-5 text-[#4C1D95] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#1C1B22]">
                    Need daily customer-getting steps? Open your 30-Day Social Media Calendar
                  </p>
                  <p className="text-xs text-[#4A4756] mt-0.5">
                    Includes 30 ready-to-edit post drafts paired with daily mini-task checklists.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenSocialCalendar}
                className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                Open 30-Day Calendar
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onCreateCampaign({
                channel,
                campaignName,
                goal,
                targetMetric,
                requiresExternalSendApproval: true,
              });
              setCampaignName('');
              setGoal('');
              setTargetMetric('');
            }}
            className="lg:col-span-4 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-[#1C1B22]">
              Plan Growth Campaign
            </h3>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Channel</label>
              <input
                type="text"
                required
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Campaign Name *
              </label>
              <input
                type="text"
                required
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Q4 Local Referral Offer"
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Goal</label>
              <textarea
                rows={2}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Target Metric</label>
              <input
                type="text"
                value={targetMetric}
                onChange={(e) => setTargetMetric(e.target.value)}
                placeholder="e.g., 20 qualified consultations / mo"
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478]"
            >
              Save Campaign Draft
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-[#E6E2F0] rounded-xl p-6">
            <h3 className="font-display text-base font-semibold text-[#1C1B22] mb-4">
              Customer Acquisition Campaigns ({campaigns.length})
            </h3>
            {campaigns.length === 0 ? (
              <p className="text-sm text-[#6E6A7C] py-8">
                No campaigns planned yet. Draft customer acquisition initiatives on the left—all
                external outreach requires explicit owner approval before activation.
              </p>
            ) : (
              <div className="divide-y divide-[#F1EEF7]">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs text-[#4C1D95] font-medium">
                        {c.channel} · Status: <span className="capitalize">{c.status}</span>
                      </p>
                      <p className="text-sm font-semibold text-[#1C1B22]">{c.campaignName}</p>
                      <p className="text-xs text-[#6E6A7C]">
                        {c.goal || 'No goal notes'} {c.targetMetric ? `· Target: ${c.targetMetric}` : ''}
                      </p>
                    </div>
                    {!c.approvedByOwner ? (
                      <button
                        type="button"
                        onClick={() => onApproveCampaign(c.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E] rounded-lg flex items-center gap-1.5 shrink-0"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Approve External Launch
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-[#059669] shrink-0">
                        Owner Approved
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
