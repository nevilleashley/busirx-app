import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { formatIsoDate } from '../lib/domain.ts';
import type { SocialCalendarDay } from '../types/busirx.ts';

interface SocialCalendarViewProps {
  businessName: string;
  days: SocialCalendarDay[];
  isGenerating: boolean;
  errorMessage: string;
  onGenerateCalendar: (params: { startDate: string; focusGoal: string }) => Promise<void>;
  onToggleMiniTask: (day: SocialCalendarDay, taskText: string) => Promise<void>;
  onSaveDraftEdits: (params: {
    dayId: string;
    hookOrAngle: string;
    captionDraft: string;
    callToAction: string;
    scheduledDate: string;
  }) => Promise<void>;
  onApproveAndSetStatus: (
    day: SocialCalendarDay,
    targetStatus: 'ready' | 'published'
  ) => Promise<void>;
}

export function SocialCalendarView({
  businessName,
  days,
  isGenerating,
  errorMessage,
  onGenerateCalendar,
  onToggleMiniTask,
  onSaveDraftEdits,
  onApproveAndSetStatus,
}: SocialCalendarViewProps) {
  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.dayNumber - b.dayNumber),
    [days]
  );

  const [weekFilter, setWeekFilter] = useState<'all' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5'>('w1');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(formatIsoDate(new Date()));
  const [focusGoal, setFocusGoal] = useState('');

  // Local editable draft fields synced to the selected day
  const [draftHook, setDraftHook] = useState('');
  const [draftCaption, setDraftCaption] = useState('');
  const [draftCta, setDraftCta] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const platforms = useMemo(() => {
    return Array.from(new Set(sortedDays.map((d) => d.platform).filter(Boolean)));
  }, [sortedDays]);

  const filteredDays = useMemo(() => {
    return sortedDays.filter((d) => {
      if (platformFilter !== 'all' && d.platform !== platformFilter) return false;
      if (weekFilter === 'w1') return d.dayNumber >= 1 && d.dayNumber <= 7;
      if (weekFilter === 'w2') return d.dayNumber >= 8 && d.dayNumber <= 14;
      if (weekFilter === 'w3') return d.dayNumber >= 15 && d.dayNumber <= 21;
      if (weekFilter === 'w4') return d.dayNumber >= 22 && d.dayNumber <= 28;
      if (weekFilter === 'w5') return d.dayNumber >= 29 && d.dayNumber <= 30;
      return true;
    });
  }, [sortedDays, weekFilter, platformFilter]);

  const activeDay = useMemo(() => {
    if (selectedDayId) {
      const match = sortedDays.find((d) => d.id === selectedDayId);
      if (match) return match;
    }
    return filteredDays[0] || sortedDays[0] || null;
  }, [sortedDays, filteredDays, selectedDayId]);

  useEffect(() => {
    if (activeDay) {
      setDraftHook(activeDay.hookOrAngle);
      setDraftCaption(activeDay.captionDraft);
      setDraftCta(activeDay.callToAction);
      setDraftDate(activeDay.scheduledDate);
    }
  }, [activeDay?.id, activeDay?.hookOrAngle, activeDay?.captionDraft, activeDay?.callToAction, activeDay?.scheduledDate]);

  const progress = useMemo(() => {
    let totalMini = 0;
    let doneMini = 0;
    let published = 0;
    for (const d of sortedDays) {
      totalMini += d.miniTasks?.length || 0;
      doneMini += d.completedMiniTasks?.length || 0;
      if (d.dayStatus === 'published') published += 1;
    }
    return { totalMini, doneMini, published };
  }, [sortedDays]);

  const handleCopyCaption = async (day: SocialCalendarDay) => {
    const fullText = `${draftCaption}\n\n${draftCta}`.trim();
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedId(day.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setActionMessage('Clipboard unavailable in this browser context; select and copy the text manually.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Generator & Progress Header */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#4C1D95] mb-1">
              Customer Acquisition Playbook · {businessName}
            </p>
            <h3 className="font-display text-xl font-bold text-[#1C1B22]">
              30-Day Social Media Content Calendar
            </h3>
            <p className="text-sm text-[#6E6A7C] mt-0.5">
              Every day pairs a platform-specific post draft with a step-by-step mini-task checklist
              so you always know exactly what to execute to bring in customers.
            </p>
          </div>

          {sortedDays.length > 0 && (
            <div className="flex items-center gap-6 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-[#E6E2F0]">
              <div>
                <p className="text-[11px] text-[#6E6A7C]">Mini-Tasks Done</p>
                <p className="font-mono-tabular text-lg font-bold text-[#4C1D95]">
                  {progress.doneMini} / {progress.totalMini}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#6E6A7C]">Days Published</p>
                <p className="font-mono-tabular text-lg font-bold text-[#059669]">
                  {progress.published} / 30
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Generation Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-[#F1EEF7] items-end">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-[#4A4756] mb-1">
              Calendar Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg"
            />
          </div>
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-[#4A4756] mb-1">
              Primary 30-Day Customer Goal (optional)
            </label>
            <input
              type="text"
              value={focusGoal}
              onChange={(e) => setFocusGoal(e.target.value)}
              placeholder="e.g., Book 15 discovery calls or drive weekend foot traffic"
              className="w-full px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg"
            />
          </div>
          <div className="md:col-span-4">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => onGenerateCalendar({ startDate, focusGoal })}
              className="w-full py-2.5 px-4 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating 30-Day Calendar...
                </>
              ) : sortedDays.length > 0 ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate 30-Day Calendar
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate 30-Day Calendar
                </>
              )}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {errorMessage}
          </div>
        )}
        {actionMessage && (
          <div className="p-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-xs text-[#065F46] flex items-center justify-between">
            <span>{actionMessage}</span>
            <button type="button" onClick={() => setActionMessage('')} className="underline ml-4">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {sortedDays.length === 0 ? (
        <div className="bg-white border border-[#E6E2F0] rounded-xl p-12 text-center space-y-3">
          <CalendarDays className="w-8 h-8 text-[#4C1D95] mx-auto" />
          <h4 className="font-display text-base font-semibold text-[#1C1B22]">
            No 30-day calendar generated yet
          </h4>
          <p className="text-xs text-[#6E6A7C] max-w-md mx-auto leading-relaxed">
            Click &ldquo;Generate 30-Day Calendar&rdquo; above and Gemini will build 30 tailored
            posts and daily customer-getting mini-task checklists for {businessName}.
          </p>
        </div>
      ) : (
        <>
          {/* Week & Platform Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 bg-white border border-[#E6E2F0] rounded-xl p-1 w-fit">
              {[
                { id: 'w1' as const, label: 'Days 1–7' },
                { id: 'w2' as const, label: 'Days 8–14' },
                { id: 'w3' as const, label: 'Days 15–21' },
                { id: 'w4' as const, label: 'Days 22–28' },
                { id: 'w5' as const, label: 'Days 29–30' },
                { id: 'all' as const, label: 'All 30 Days' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setWeekFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    weekFilter === tab.id
                      ? 'bg-[#4C1D95] text-white'
                      : 'text-[#4A4756] hover:text-[#1C1B22]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              aria-label="Filter by platform"
              className="px-3 py-2 text-xs border border-[#E6E2F0] rounded-lg bg-white text-[#1C1B22] w-fit"
            >
              <option value="all">All Platforms</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Master-Detail Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Day List */}
            <div className="lg:col-span-5 bg-white border border-[#E6E2F0] rounded-xl divide-y divide-[#F1EEF7] max-h-[680px] overflow-y-auto">
              {filteredDays.map((day) => {
                const isSelected = activeDay?.id === day.id;
                const doneCount = day.completedMiniTasks?.length || 0;
                const totalCount = day.miniTasks?.length || 0;
                const allMiniDone = totalCount > 0 && doneCount >= totalCount;

                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedDayId(day.id)}
                    className={`w-full p-4 text-left transition-colors ${
                      isSelected ? 'bg-[#F3EFFC]' : 'hover:bg-[#FAF9FC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#6E6A7C] mb-1">
                      <span className="font-mono-tabular font-semibold text-[#4C1D95]">
                        Day {String(day.dayNumber).padStart(2, '0')} · {day.scheduledDate}
                      </span>
                      <span
                        className={`font-medium ${
                          day.dayStatus === 'published'
                            ? 'text-[#059669]'
                            : day.dayStatus === 'ready'
                            ? 'text-[#4C1D95]'
                            : 'text-[#6E6A7C]'
                        }`}
                      >
                        {day.dayStatus === 'published'
                          ? 'Published'
                          : day.dayStatus === 'ready'
                          ? 'Approved'
                          : 'Planned'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#1C1B22] line-clamp-1">
                      {day.topicTitle}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-[#6E6A7C]">
                      <span>
                        {day.platform} · {day.contentPillar}
                      </span>
                      <span
                        className={`font-mono-tabular ${
                          allMiniDone ? 'text-[#059669] font-semibold' : ''
                        }`}
                      >
                        {doneCount}/{totalCount} mini-tasks
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Day Playbook & Mini-Task Checklist */}
            {activeDay && (
              <div className="lg:col-span-7 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#E6E2F0]">
                  <div>
                    <p className="text-xs text-[#4C1D95] font-medium">
                      <span className="font-mono-tabular font-semibold">
                        Day {String(activeDay.dayNumber).padStart(2, '0')}
                      </span>{' '}
                      · {activeDay.platform} · {activeDay.contentPillar}
                    </p>
                    <h4 className="font-display text-lg font-bold text-[#1C1B22] mt-1">
                      {activeDay.topicTitle}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyCaption(activeDay)}
                      className="px-3 py-1.5 text-xs font-medium border border-[#E6E2F0] rounded-lg text-[#1C1B22] hover:bg-[#F8F7FB] flex items-center gap-1.5"
                    >
                      {copiedId === activeDay.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#059669]" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Caption
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Daily Mini-Task Checklist */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-[#1C1B22]">
                      Daily Customer-Getting Mini-Task Checklist
                    </h5>
                    <span className="font-mono-tabular text-xs text-[#6E6A7C]">
                      {activeDay.completedMiniTasks?.length || 0} of{' '}
                      {activeDay.miniTasks?.length || 0} completed
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(activeDay.miniTasks || []).map((taskText, idx) => {
                      const isDone = (activeDay.completedMiniTasks || []).includes(taskText);
                      return (
                        <label
                          key={`${activeDay.id}_mt_${idx}`}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isDone
                              ? 'bg-[#ECFDF5]/60 border-[#A7F3D0]'
                              : 'bg-[#F8F7FB] border-[#E6E2F0] hover:border-[#C9C2DC]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => onToggleMiniTask(activeDay, taskText)}
                            className="mt-0.5 h-4 w-4 rounded border-[#C9C2DC] text-[#059669] focus:ring-[#059669]"
                          />
                          <span
                            className={`text-xs leading-relaxed ${
                              isDone ? 'line-through text-[#6E6A7C]' : 'text-[#1C1B22]'
                            }`}
                          >
                            {taskText}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Editable Post Draft */}
                <div className="space-y-3 pt-2 border-t border-[#E6E2F0]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#4A4756] mb-1">
                        Scheduled Date
                      </label>
                      <input
                        type="date"
                        value={draftDate}
                        onChange={(e) => setDraftDate(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono-tabular border border-[#E6E2F0] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#4A4756] mb-1">
                        Opening Hook / Visual Angle
                      </label>
                      <input
                        type="text"
                        value={draftHook}
                        onChange={(e) => setDraftHook(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-[#E6E2F0] rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4A4756] mb-1">
                      Post Caption Draft (review &amp; customize with your real details)
                    </label>
                    <textarea
                      rows={4}
                      value={draftCaption}
                      onChange={(e) => setDraftCaption(e.target.value)}
                      className="w-full px-3 py-2 text-xs leading-relaxed border border-[#E6E2F0] rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#4A4756] mb-1">
                      Call-To-Action (Customer Conversion Step)
                    </label>
                    <input
                      type="text"
                      value={draftCta}
                      onChange={(e) => setDraftCta(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-[#E6E2F0] rounded-lg"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      disabled={savingDraft}
                      onClick={async () => {
                        setSavingDraft(true);
                        try {
                          await onSaveDraftEdits({
                            dayId: activeDay.id,
                            hookOrAngle: draftHook,
                            captionDraft: draftCaption,
                            callToAction: draftCta,
                            scheduledDate: draftDate,
                          });
                          setActionMessage(`Saved edits for Day ${activeDay.dayNumber}.`);
                        } finally {
                          setSavingDraft(false);
                        }
                      }}
                      className="px-3.5 py-2 text-xs font-medium border border-[#E6E2F0] rounded-lg text-[#1C1B22] hover:bg-[#F8F7FB]"
                    >
                      {savingDraft ? 'Saving...' : 'Save Draft Edits'}
                    </button>

                    <div className="flex items-center gap-2">
                      {!activeDay.approvedToPublish && (
                        <button
                          type="button"
                          onClick={async () => {
                            await onApproveAndSetStatus(activeDay, 'ready');
                            setActionMessage(
                              `Day ${activeDay.dayNumber} approved and marked ready to post.`
                            );
                          }}
                          className="px-3.5 py-2 text-xs font-semibold bg-[#F3EFFC] text-[#4C1D95] rounded-lg hover:bg-[#E8E0FA] flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Approve Copy
                        </button>
                      )}

                      {activeDay.dayStatus !== 'published' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await onApproveAndSetStatus(activeDay, 'published');
                            setActionMessage(
                              `Day ${activeDay.dayNumber} approved and marked published.`
                            );
                          }}
                          className="px-4 py-2 text-xs font-semibold bg-[#059669] text-white rounded-lg hover:bg-[#047857] flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve &amp; Mark Published
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-[#059669] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Published &amp; Logged
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
