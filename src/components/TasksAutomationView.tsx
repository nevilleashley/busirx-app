import React, { useMemo, useState } from 'react';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCw,
  ShieldAlert,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { BLUEPRINT_CATEGORIES, daysUntilDate, formatIsoDate } from '../lib/domain.ts';
import type {
  NotificationLogRecord,
  TaskItem,
  UserProfile,
} from '../types/busirx.ts';

interface TasksAutomationViewProps {
  tasks: TaskItem[];
  notifications: NotificationLogRecord[];
  userProfile: UserProfile;
  onCreateTask: (input: {
    title: string;
    description: string;
    categoryId: string;
    priority: TaskItem['priority'];
    taskType: TaskItem['taskType'];
    recurrenceIntervalDays: number;
    dueDate: string;
    assignee: string;
    requiresExplicitApproval: boolean;
    consequentialActionType: TaskItem['consequentialActionType'];
  }) => Promise<void>;
  onApproveTask: (task: TaskItem) => Promise<void>;
  onCompleteTask: (task: TaskItem) => Promise<{ rolledForwardTo?: string }>;
  onUpdateAssignee: (taskId: string, assignee: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onRunReminderCheck: () => Promise<{ createdCount: number; duplicatesSkipped: number }>;
  onMarkNotifRead: (notifId: string) => Promise<void>;
  onUpdateReminderPrefs: (prefs: {
    displayName: string;
    reminderEmailEnabled: boolean;
    reminderInAppEnabled: boolean;
    reminderLeadDays: number;
  }) => Promise<void>;
}

export function TasksAutomationView({
  tasks,
  notifications,
  userProfile,
  onCreateTask,
  onApproveTask,
  onCompleteTask,
  onUpdateAssignee,
  onDeleteTask,
  onRunReminderCheck,
  onMarkNotifRead,
  onUpdateReminderPrefs,
}: TasksAutomationViewProps) {
  const [filter, setFilter] = useState<'all' | 'open' | 'recurring' | 'awaiting_approval' | 'completed'>('open');
  const [showNewForm, setShowNewForm] = useState(false);
  const [approvalCandidate, setApprovalCandidate] = useState<TaskItem | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkingReminders, setCheckingReminders] = useState(false);

  // New Task Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('daily_operations');
  const [priority, setPriority] = useState<TaskItem['priority']>('medium');
  const [taskType, setTaskType] = useState<TaskItem['taskType']>('one_time');
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState(30);
  const [dueDate, setDueDate] = useState(formatIsoDate(new Date()));
  const [assignee, setAssignee] = useState(userProfile.displayName || 'Business Owner');
  const [requiresExplicitApproval, setRequiresExplicitApproval] = useState(false);
  const [consequentialActionType, setConsequentialActionType] =
    useState<TaskItem['consequentialActionType']>('payment');

  // Reminder Preferences
  const [emailEnabled, setEmailEnabled] = useState(userProfile.reminderEmailEnabled);
  const [inAppEnabled, setInAppEnabled] = useState(userProfile.reminderInAppEnabled);
  const [leadDays, setLeadDays] = useState(userProfile.reminderLeadDays);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (filter === 'open') return t.status !== 'completed';
        if (filter === 'recurring') return t.taskType === 'recurring';
        if (filter === 'awaiting_approval')
          return t.requiresExplicitApproval && !t.explicitlyApproved;
        if (filter === 'completed') return t.status === 'completed';
        return true;
      })
      .sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'));
  }, [tasks, filter]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyId('create');
    try {
      await onCreateTask({
        title,
        description,
        categoryId,
        priority,
        taskType,
        recurrenceIntervalDays,
        dueDate,
        assignee,
        requiresExplicitApproval,
        consequentialActionType,
      });
      setTitle('');
      setDescription('');
      setShowNewForm(false);
      setStatusNote('Task created and added to your operating schedule.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCompleteClick = async (task: TaskItem) => {
    if (task.requiresExplicitApproval && !task.explicitlyApproved) {
      setApprovalCandidate(task);
      return;
    }
    setBusyId(task.id);
    try {
      const res = await onCompleteTask(task);
      if (res.rolledForwardTo) {
        setStatusNote(
          `Completed "${task.title}". Next recurring due date automatically scheduled for ${res.rolledForwardTo}.`
        );
      } else {
        setStatusNote(`Marked "${task.title}" completed.`);
      }
    } catch (err) {
      setStatusNote(err instanceof Error ? err.message : 'Unable to complete task.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmApproval = async () => {
    if (!approvalCandidate) return;
    setBusyId(approvalCandidate.id);
    try {
      await onApproveTask(approvalCandidate);
      setStatusNote(
        `Explicit approval recorded for "${approvalCandidate.title}". You may now execute and complete it.`
      );
      setApprovalCandidate(null);
    } finally {
      setBusyId(null);
    }
  };

  const handleRunCheck = async () => {
    setCheckingReminders(true);
    try {
      const res = await onRunReminderCheck();
      setStatusNote(
        `Reminder scan complete: ${res.createdCount} new notifications logged (${res.duplicatesSkipped} already deduplicated).`
      );
    } finally {
      setCheckingReminders(false);
    }
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      await onUpdateReminderPrefs({
        displayName: userProfile.displayName,
        reminderEmailEnabled: emailEnabled,
        reminderInAppEnabled: inAppEnabled,
        reminderLeadDays: leadDays,
      });
      setStatusNote('Reminder configuration saved.');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusNote && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl px-4 py-3 text-xs font-medium text-[#065F46] flex items-center justify-between">
          <span>{statusNote}</span>
          <button type="button" onClick={() => setStatusNote('')} className="underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Explicit Consequential Action Approval Modal */}
      {approvalCandidate && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#B45309]">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-display text-lg font-bold text-[#1C1B22]">
                Explicit Owner Approval Required
              </h3>
            </div>
            <p className="text-sm text-[#4A4756] leading-relaxed">
              <strong>{approvalCandidate.title}</strong> involves a consequential action (
              <span className="capitalize">
                {approvalCandidate.consequentialActionType.replace('_', ' ')}
              </span>
              ). Busi Rx requires your explicit confirmation before proceeding or marking it
              complete.
            </p>
            <div className="text-xs text-[#6E6A7C] bg-[#F8F7FB] border border-[#E6E2F0] rounded-lg p-3 space-y-1">
              <p>Assignee: {approvalCandidate.assignee}</p>
              <p className="font-mono-tabular">Due Date: {approvalCandidate.dueDate || 'Unscheduled'}</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApprovalCandidate(null)}
                className="px-4 py-2 text-xs font-medium text-[#4A4756] border border-[#E6E2F0] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === approvalCandidate.id}
                onClick={handleConfirmApproval}
                className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478]"
              >
                Approve Consequential Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Controls */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#1C1B22]">
            Tasks &amp; Recurring Schedule
          </h2>
          <p className="text-sm text-[#6E6A7C] mt-0.5">
            Assign responsibilities, approve consequential actions, and auto-recalculate recurring cycles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={checkingReminders}
            onClick={handleRunCheck}
            className="px-4 py-2 text-xs font-medium border border-[#E6E2F0] rounded-lg text-[#1C1B22] hover:bg-[#F8F7FB] flex items-center gap-1.5 whitespace-nowrap"
          >
            {checkingReminders ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-[#4C1D95]" />
            )}
            Run Deadline &amp; Reminder Check
          </button>
          <button
            type="button"
            onClick={() => setShowNewForm((v) => !v)}
            className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </button>
        </div>
      </div>

      {/* New Task Form */}
      {showNewForm && (
        <form
          onSubmit={handleAddTask}
          className="bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4"
        >
          <h3 className="font-display text-base font-semibold text-[#1C1B22]">
            Create Custom Task
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Task Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Reconcile monthly merchant deposits"
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Assignee</label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A4756] mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg bg-white"
              >
                {BLUEPRINT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number}. {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskItem['priority'])}
                className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg bg-white"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Schedule Type</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskItem['taskType'])}
                className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg bg-white"
              >
                <option value="one_time">One-time</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg"
              />
            </div>
          </div>

          {taskType === 'recurring' && (
            <div className="w-48">
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Recurrence Interval (Days)
              </label>
              <input
                type="number"
                min={1}
                max={3650}
                value={recurrenceIntervalDays}
                onChange={(e) => setRecurrenceIntervalDays(Number(e.target.value) || 30)}
                className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-[#1C1B22]">
              <input
                type="checkbox"
                checked={requiresExplicitApproval}
                onChange={(e) => setRequiresExplicitApproval(e.target.checked)}
              />
              Requires explicit owner approval (payment, legal filing, or external send)
            </label>
            {requiresExplicitApproval && (
              <select
                value={consequentialActionType}
                onChange={(e) =>
                  setConsequentialActionType(
                    e.target.value as TaskItem['consequentialActionType']
                  )
                }
                className="px-3 py-1.5 text-xs border border-[#E6E2F0] rounded-lg bg-white"
              >
                <option value="payment">Payment</option>
                <option value="legal_filing">Legal / Tax Filing</option>
                <option value="external_communication">External Communication</option>
              </select>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 text-xs border border-[#E6E2F0] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busyId === 'create'}
              className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg"
            >
              Save Task
            </button>
          </div>
        </form>
      )}

      {/* Segmented Filter */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white border border-[#E6E2F0] rounded-xl p-1.5 w-fit">
        {[
          { id: 'open' as const, label: 'Open' },
          { id: 'recurring' as const, label: 'Recurring' },
          { id: 'awaiting_approval' as const, label: 'Needs Approval' },
          { id: 'completed' as const, label: 'Completed' },
          { id: 'all' as const, label: 'All' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              filter === tab.id
                ? 'bg-[#4C1D95] text-white'
                : 'text-[#4A4756] hover:text-[#1C1B22]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks Table / List */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6E6A7C]">
            No tasks match this filter. Approve items in your Blueprint or add a custom task above.
          </div>
        ) : (
          <div className="divide-y divide-[#F1EEF7]">
            {filteredTasks.map((task) => {
              const daysLeft = daysUntilDate(task.dueDate);
              const needsApproval = task.requiresExplicitApproval && !task.explicitlyApproved;
              return (
                <div
                  key={task.id}
                  className="p-4 lg:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#FAF9FC] transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6A7C]">
                      <span className="capitalize font-medium text-[#4C1D95]">
                        {task.priority}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        {task.taskType === 'recurring' ? (
                          <>
                            <RotateCw className="w-3 h-3 text-[#059669]" />
                            Every {task.recurrenceIntervalDays}d
                          </>
                        ) : (
                          'One-time'
                        )}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-mono-tabular ${
                          daysLeft !== null && daysLeft < 0 && task.status !== 'completed'
                            ? 'text-red-600 font-semibold'
                            : 'text-[#4A4756]'
                        }`}
                      >
                        Due {task.dueDate || 'TBD'}
                      </span>
                      {needsApproval && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#B45309] font-medium inline-flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            Approval Required ({task.consequentialActionType.replace('_', ' ')})
                          </span>
                        </>
                      )}
                    </div>

                    <p
                      className={`text-sm font-semibold ${
                        task.status === 'completed'
                          ? 'line-through text-[#6E6A7C]'
                          : 'text-[#1C1B22]'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-[#6E6A7C] line-clamp-2">{task.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <input
                      type="text"
                      aria-label={`Assignee for ${task.title}`}
                      defaultValue={task.assignee}
                      onBlur={(e) => {
                        if (e.target.value !== task.assignee) {
                          onUpdateAssignee(task.id, e.target.value);
                        }
                      }}
                      className="w-36 px-2.5 py-1.5 text-xs border border-[#E6E2F0] rounded-lg bg-white text-[#4A4756]"
                    />

                    {needsApproval ? (
                      <button
                        type="button"
                        onClick={() => setApprovalCandidate(task)}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E] rounded-lg hover:bg-[#FEF3C7] whitespace-nowrap flex items-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Review &amp; Approve
                      </button>
                    ) : task.status !== 'completed' ? (
                      <button
                        type="button"
                        disabled={busyId === task.id}
                        onClick={() => handleCompleteClick(task)}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] rounded-lg hover:bg-[#D1FAE5] whitespace-nowrap flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {task.taskType === 'recurring' ? 'Complete Cycle' : 'Mark Done'}
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-[#059669] px-2">Completed</span>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 text-[#6E6A7C] hover:text-red-600 rounded-lg"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reminder Configuration & Notification Delivery Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#4C1D95]" />
            <h3 className="font-display text-base font-semibold text-[#1C1B22]">
              Reminder Preferences
            </h3>
          </div>
          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 rounded-lg border border-[#E6E2F0]">
              <span className="font-medium text-[#1C1B22]">In-app deadline alerts</span>
              <input
                type="checkbox"
                checked={inAppEnabled}
                onChange={(e) => setInAppEnabled(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border border-[#E6E2F0]">
              <span className="font-medium text-[#1C1B22]">
                Email reminders ({userProfile.email})
              </span>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
              />
            </label>
            <div className="p-3 rounded-lg border border-[#E6E2F0] flex items-center justify-between">
              <span className="font-medium text-[#1C1B22]">Notify days before due</span>
              <input
                type="number"
                min={1}
                max={90}
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value) || 7)}
                className="w-20 px-2 py-1 text-right font-mono-tabular border border-[#E6E2F0] rounded"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={savingPrefs}
            onClick={handleSavePrefs}
            className="w-full py-2 text-xs font-semibold bg-[#1C1B22] text-white rounded-lg hover:bg-[#2B2933]"
          >
            {savingPrefs ? 'Saving...' : 'Save Reminder Settings'}
          </button>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[#1C1B22]">
              Notification Delivery Log (Deduplicated)
            </h3>
            <span className="font-mono-tabular text-xs text-[#6E6A7C]">
              {notifications.length} logged
            </span>
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-[#6E6A7C] py-6">
              No reminders dispatched yet. Click &ldquo;Run Deadline &amp; Reminder Check&rdquo; above
              to evaluate upcoming deadlines.
            </p>
          ) : (
            <div className="divide-y divide-[#F1EEF7] max-h-72 overflow-y-auto">
              {notifications.slice(0, 20).map((n) => (
                <div key={n.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#6E6A7C]">
                      <span className="uppercase font-mono-tabular font-medium text-[#4C1D95]">
                        {n.channel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {n.deliveryStatus === 'skipped_no_email_provider'
                          ? 'Skipped (No Email Provider Configured)'
                          : n.deliveryStatus}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">{n.scheduledFor}</span>
                    </div>
                    <p className="text-xs font-semibold text-[#1C1B22]">{n.title}</p>
                    <p className="text-xs text-[#6E6A7C]">{n.message}</p>
                  </div>
                  {n.channel === 'in_app' && n.deliveryStatus === 'delivered' && (
                    <button
                      type="button"
                      onClick={() => onMarkNotifRead(n.id)}
                      className="text-xs font-medium text-[#4C1D95] hover:underline shrink-0"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
