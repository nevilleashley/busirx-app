import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import { BLUEPRINT_CATEGORIES, daysUntilDate, formatCurrencyCents } from '../lib/domain.ts';
import type {
  BlueprintItem,
  BusinessRecord,
  LeadRecord,
  NotificationLogRecord,
  ObligationRecord,
  SocialCalendarDay,
  TaskItem,
} from '../types/busirx.ts';

export type WorkspaceNavSection =
  | 'dashboard'
  | 'blueprint'
  | 'tasks'
  | 'obligations'
  | 'operations'
  | 'social_calendar'
  | 'leads'
  | 'voice_studio'
  | 'assessment'
  | 'billing';

interface DashboardOverviewProps {
  business: BusinessRecord;
  blueprintItems: BlueprintItem[];
  tasks: TaskItem[];
  obligations: ObligationRecord[];
  notifications: NotificationLogRecord[];
  socialDays?: SocialCalendarDay[];
  leads?: LeadRecord[];
  onNavigate: (section: WorkspaceNavSection) => void;
  onMarkNotificationRead: (notifId: string) => Promise<void>;
}

export function DashboardOverview({
  business,
  blueprintItems,
  tasks,
  obligations,
  notifications,
  socialDays = [],
  leads = [],
  onNavigate,
  onMarkNotificationRead,
}: DashboardOverviewProps) {
  const stats = useMemo(() => {
    const activeBlueprint = blueprintItems.filter((b) => b.completionStatus !== 'dismissed');
    const pendingApproval = activeBlueprint.filter((b) => b.completionStatus === 'pending_approval');
    const openTasks = tasks.filter((t) => t.status !== 'completed');
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const awaitingOwnerApproval = openTasks.filter(
      (t) => t.requiresExplicitApproval && !t.explicitlyApproved
    );
    const overdueTasks = openTasks.filter((t) => {
      const d = daysUntilDate(t.dueDate);
      return d !== null && d < 0;
    });
    const dueSoonObligations = obligations.filter((o) => {
      if (o.status === 'paid_or_renewed') return false;
      const d = daysUntilDate(o.dueOrExpiryDate);
      return d !== null && d <= 21;
    });

    return {
      activeBlueprintCount: activeBlueprint.length,
      pendingApprovalCount: pendingApproval.length,
      openTasksCount: openTasks.length,
      completedTasksCount: completedTasks.length,
      awaitingApprovalCount: awaitingOwnerApproval.length,
      overdueCount: overdueTasks.length,
      dueSoonObligationsCount: dueSoonObligations.length,
    };
  }, [blueprintItems, tasks, obligations]);

  const unreadAlerts = useMemo(
    () => notifications.filter((n) => n.channel === 'in_app' && n.deliveryStatus === 'delivered'),
    [notifications]
  );

  const socialSummary = useMemo(() => {
    let totalMini = 0;
    let doneMini = 0;
    let published = 0;
    for (const d of socialDays) {
      totalMini += d.miniTasks?.length || 0;
      doneMini += d.completedMiniTasks?.length || 0;
      if (d.dayStatus === 'published') published += 1;
    }
    return {
      hasCalendar: socialDays.length > 0,
      totalDays: socialDays.length,
      totalMini,
      doneMini,
      published,
    };
  }, [socialDays]);

  const leadsSummary = useMemo(() => {
    let activeCount = 0;
    let openValueCents = 0;
    let wonCount = 0;
    for (const l of leads) {
      if (l.stage === 'won') wonCount += 1;
      else if (l.stage !== 'lost') {
        activeCount += 1;
        openValueCents += l.estimatedValueCents || 0;
      }
    }
    return {
      total: leads.length,
      activeCount,
      openValueCents,
      wonCount,
    };
  }, [leads]);

  const upcomingDeadlines = useMemo(() => {
    const combined: Array<{
      id: string;
      kind: string;
      title: string;
      dueDate: string;
      needsApproval: boolean;
      section: WorkspaceNavSection;
    }> = [];

    for (const t of tasks) {
      if (t.status === 'completed' || !t.dueDate) continue;
      combined.push({
        id: t.id,
        kind: t.taskType === 'recurring' ? 'Recurring Task' : 'Task',
        title: t.title,
        dueDate: t.dueDate,
        needsApproval: t.requiresExplicitApproval && !t.explicitlyApproved,
        section: 'tasks',
      });
    }

    for (const o of obligations) {
      if (o.status === 'paid_or_renewed' || !o.dueOrExpiryDate) continue;
      combined.push({
        id: o.id,
        kind: o.recordType.charAt(0).toUpperCase() + o.recordType.slice(1),
        title: o.title,
        dueDate: o.dueOrExpiryDate,
        needsApproval: o.requiresExplicitApproval && !o.approvedForAction,
        section: 'obligations',
      });
    }

    return combined.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8);
  }, [tasks, obligations]);

  return (
    <div className="space-y-6">
      {/* Banner if blueprint items are waiting for approval */}
      {stats.pendingApprovalCount > 0 && (
        <div className="bg-[#F3EFFC] border border-[#DDD6FE] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <FileCheck2 className="w-5 h-5 text-[#4C1D95] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1C1B22]">
                {stats.pendingApprovalCount} Blueprint recommendations awaiting your approval
              </p>
              <p className="text-xs text-[#4A4756] mt-0.5">
                Review generated items and approve what you want converted into active tasks and
                reminders.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('blueprint')}
            className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            Review Blueprint
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Open Responsibilities</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#1C1B22] mt-1">
            {stats.openTasksCount}
          </p>
          <p className="text-xs text-[#059669] mt-1">
            {stats.completedTasksCount} completed to date
          </p>
        </div>

        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Awaiting Owner Approval</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#4C1D95] mt-1">
            {stats.awaitingApprovalCount}
          </p>
          <p className="text-xs text-[#6E6A7C] mt-1">Payments, filings &amp; external sends</p>
        </div>

        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Overdue Tasks</p>
          <p
            className={`font-mono-tabular text-2xl font-bold mt-1 ${
              stats.overdueCount > 0 ? 'text-red-600' : 'text-[#059669]'
            }`}
          >
            {stats.overdueCount}
          </p>
          <p className="text-xs text-[#6E6A7C] mt-1">
            {stats.overdueCount === 0 ? 'All scheduled tasks on track' : 'Action needed'}
          </p>
        </div>

        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5">
          <p className="text-xs text-[#6E6A7C]">Renewals &amp; Bills (21d)</p>
          <p className="font-mono-tabular text-2xl font-bold text-[#1C1B22] mt-1">
            {stats.dueSoonObligationsCount}
          </p>
          <p className="text-xs text-[#6E6A7C] mt-1">Licenses, insurance &amp; bills</p>
        </div>
      </div>

      {/* Main Split: Upcoming Deadlines + Unread Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#4C1D95]" />
              <h3 className="font-display text-base font-semibold text-[#1C1B22]">
                Upcoming Deadlines &amp; Approvals
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="text-xs font-medium text-[#4C1D95] hover:underline"
            >
              Manage all tasks
            </button>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[#4A4756] mb-3">
                No scheduled tasks or obligations yet.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('blueprint')}
                className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg"
              >
                Approve Blueprint Items
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#F1EEF7]">
              {upcomingDeadlines.map((row) => {
                const days = daysUntilDate(row.dueDate);
                return (
                  <div
                    key={row.id}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-[#6E6A7C]">
                        {row.kind}
                        {row.needsApproval && (
                          <span className="text-[#B45309] font-medium">
                            {' '}
                            · Explicit Approval Required
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigate(row.section)}
                        className="text-sm font-medium text-[#1C1B22] hover:text-[#4C1D95] text-left truncate block max-w-full"
                      >
                        {row.title}
                      </button>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono-tabular text-xs font-medium ${
                          days !== null && days < 0
                            ? 'text-red-600'
                            : days !== null && days <= 7
                            ? 'text-[#B45309]'
                            : 'text-[#4A4756]'
                        }`}
                      >
                        {row.dueDate}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#4C1D95]" />
              <h3 className="font-display text-base font-semibold text-[#1C1B22]">
                Active In-App Alerts ({unreadAlerts.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="text-xs font-medium text-[#4C1D95] hover:underline"
            >
              Reminder settings
            </button>
          </div>

          {unreadAlerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6E6A7C] space-y-2">
              <CheckCircle2 className="w-5 h-5 text-[#059669] mx-auto" />
              <p>No unread deadline alerts right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1EEF7] max-h-72 overflow-y-auto">
              {unreadAlerts.slice(0, 8).map((n) => (
                <div key={n.id} className="py-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-[#1C1B22]">{n.title}</p>
                    <button
                      type="button"
                      onClick={() => onMarkNotificationRead(n.id)}
                      className="text-xs text-[#4C1D95] hover:underline shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-xs text-[#6E6A7C]">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Growth Row: 30-Day Social Calendar + Generated Leads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CalendarDays className="w-5 h-5 text-[#4C1D95] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1C1B22]">
                30-Day Social Media Posts
              </p>
              {socialSummary.hasCalendar ? (
                <p className="text-xs text-[#6E6A7C] mt-0.5 font-mono-tabular">
                  {socialSummary.doneMini}/{socialSummary.totalMini} mini-tasks done ·{' '}
                  {socialSummary.published}/30 published
                </p>
              ) : (
                <p className="text-xs text-[#6E6A7C] mt-0.5">
                  30 days of ready-to-post captions &amp; daily customer-getting checklists.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('social_calendar')}
            className="px-4 py-2 text-xs font-semibold bg-[#F3EFFC] text-[#4C1D95] rounded-lg hover:bg-[#E8E0FA] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            Open 30-Day Posts
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white border border-[#E6E2F0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-[#059669] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1C1B22]">
                Lead CRM Kanban Board
              </p>
              {leadsSummary.total > 0 ? (
                <p className="text-xs text-[#6E6A7C] mt-0.5 font-mono-tabular">
                  {leadsSummary.activeCount} active ·{' '}
                  {formatCurrencyCents(leadsSummary.openValueCents)} open · {leadsSummary.wonCount} won
                </p>
              ) : (
                <p className="text-xs text-[#6E6A7C] mt-0.5">
                  Track leads across New, Contacted, Qualified, Closed-Won &amp; Closed-Lost.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('leads')}
            className="px-4 py-2 text-xs font-semibold bg-[#ECFDF5] text-[#065F46] rounded-lg hover:bg-[#D1FAE5] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            Open Lead CRM
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 10-Category Operating Coverage Grid */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-[#1C1B22]">
              10-Pillar Business Health Coverage
            </h3>
            <p className="text-xs text-[#6E6A7C]">
              Profile: {business.industry} ·{' '}
              {[business.city, business.stateProvince, business.country].filter(Boolean).join(', ')}{' '}
              · Assessment v{business.assessmentVersion}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('assessment')}
            className="text-xs font-medium text-[#4C1D95] hover:underline self-start"
          >
            Update answers &amp; regenerate affected parts
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BLUEPRINT_CATEGORIES.map((cat) => {
            const catItems = blueprintItems.filter(
              (b) => b.categoryId === cat.id && b.completionStatus !== 'dismissed'
            );
            const catTasks = tasks.filter((t) => t.categoryId === cat.id);
            const doneTasks = catTasks.filter((t) => t.status === 'completed').length;
            const needsConfirm = catItems.filter(
              (b) => b.verificationStatus === 'needs_confirmation'
            ).length;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onNavigate('blueprint')}
                className="p-4 rounded-lg border border-[#E6E2F0] hover:border-[#4C1D95] text-left transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1C1B22] truncate">
                    <span className="font-mono-tabular text-[#4C1D95] mr-1.5">
                      {String(cat.number).padStart(2, '0')}.
                    </span>
                    {cat.name}
                  </p>
                  <p className="text-xs text-[#6E6A7C] mt-0.5">
                    {catItems.length} blueprint items · {doneTasks}/{catTasks.length} tasks done
                  </p>
                </div>
                {needsConfirm > 0 ? (
                  <span className="text-xs text-[#B45309] font-medium inline-flex items-center gap-1 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {needsConfirm} verify
                  </span>
                ) : catItems.length > 0 ? (
                  <ShieldAlert className="w-4 h-4 text-[#059669] shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
