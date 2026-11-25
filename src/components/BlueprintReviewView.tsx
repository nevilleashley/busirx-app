import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { BLUEPRINT_CATEGORIES } from '../lib/domain.ts';
import type { BlueprintCategoryId, BlueprintItem, VerificationStatus } from '../types/busirx.ts';

interface BlueprintReviewViewProps {
  businessName: string;
  items: BlueprintItem[];
  isGenerating: boolean;
  onApproveSelected: (selectedItems: BlueprintItem[]) => Promise<void>;
  onDismissItem: (itemId: string) => Promise<void>;
  onRegenerateAll: () => Promise<void>;
}

const VERIFICATION_LABELS: Record<
  VerificationStatus,
  { label: string; textClass: string }
> = {
  verified_requirement: {
    label: 'Verified Requirement',
    textClass: 'text-[#059669]',
  },
  recommendation: {
    label: 'Recommended Practice',
    textClass: 'text-[#4C1D95]',
  },
  needs_confirmation: {
    label: 'Requires Local Confirmation',
    textClass: 'text-[#B45309]',
  },
};

export function BlueprintReviewView({
  businessName,
  items,
  isGenerating,
  onApproveSelected,
  onDismissItem,
  onRegenerateAll,
}: BlueprintReviewViewProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | BlueprintCategoryId>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(
      items.filter((i) => i.completionStatus === 'pending_approval').map((i) => i.id)
    );
  });
  const [approving, setApproving] = useState(false);

  const pendingItems = useMemo(
    () => items.filter((i) => i.completionStatus === 'pending_approval'),
    [items]
  );

  const visibleItems = useMemo(() => {
    return items
      .filter((i) => i.completionStatus !== 'dismissed')
      .filter((i) => activeCategory === 'all' || i.categoryId === activeCategory)
      .sort((a, b) => a.categoryNumber - b.categoryNumber);
  }, [items, activeCategory]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllPending = () => {
    setSelectedIds(new Set(pendingItems.map((i) => i.id)));
  };

  const handleApproveAction = async () => {
    const toApprove = pendingItems.filter((i) => selectedIds.has(i.id));
    if (toApprove.length === 0) return;
    setApproving(true);
    try {
      await onApproveSelected(toApprove);
      setSelectedIds(new Set());
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Approval Action Bar */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#4C1D95] mb-1">
            Structured Operating Blueprint · {businessName}
          </p>
          <h2 className="font-display text-xl font-bold text-[#1C1B22]">
            Review &amp; approve responsibilities before creating tasks
          </h2>
          <p className="text-sm text-[#6E6A7C] mt-1">
            Busi Rx distinguishes statutory requirements from operational recommendations. Items
            marked Requires Local Confirmation should be verified with your local agency or CPA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={isGenerating}
            onClick={onRegenerateAll}
            className="px-4 py-2 text-xs font-medium border border-[#E6E2F0] rounded-lg text-[#4A4756] hover:text-[#1C1B22] hover:bg-[#F8F7FB] flex items-center gap-1.5 whitespace-nowrap"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Regenerate Full Blueprint
          </button>

          {pendingItems.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleSelectAllPending}
                className="px-3 py-2 text-xs font-medium text-[#4C1D95] hover:bg-[#F3EFFC] rounded-lg whitespace-nowrap"
              >
                Select All Pending ({pendingItems.length})
              </button>
              <button
                type="button"
                disabled={approving || selectedIds.size === 0}
                onClick={handleApproveAction}
                className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
              >
                {approving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileCheck2 className="w-3.5 h-3.5" />
                )}
                Approve &amp; Create Tasks ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
            activeCategory === 'all'
              ? 'bg-[#1C1B22] text-white'
              : 'bg-white border border-[#E6E2F0] text-[#4A4756] hover:text-[#1C1B22]'
          }`}
        >
          All 10 Categories ({items.filter((i) => i.completionStatus !== 'dismissed').length})
        </button>
        {BLUEPRINT_CATEGORIES.map((cat) => {
          const count = items.filter(
            (i) => i.categoryId === cat.id && i.completionStatus !== 'dismissed'
          ).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                activeCategory === cat.id
                  ? 'bg-[#4C1D95] text-white'
                  : 'bg-white border border-[#E6E2F0] text-[#4A4756] hover:text-[#1C1B22]'
              }`}
            >
              {cat.number}. {cat.name.split(' ')[0]} ({count})
            </button>
          );
        })}
      </div>

      {/* Empty / Generating State */}
      {visibleItems.length === 0 ? (
        <div className="bg-white border border-[#E6E2F0] rounded-xl p-12 text-center">
          <p className="text-sm font-medium text-[#1C1B22] mb-2">
            {isGenerating
              ? 'Gemini is analyzing your business profile across all 10 categories...'
              : 'No blueprint items match this category yet.'}
          </p>
          <p className="text-xs text-[#6E6A7C]">
            Use Regenerate Full Blueprint or switch categories to inspect your plan.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => {
            const isPending = item.completionStatus === 'pending_approval';
            const isSelected = selectedIds.has(item.id);
            const verif = VERIFICATION_LABELS[item.verificationStatus];

            return (
              <div
                key={item.id}
                className={`bg-white border rounded-xl p-5 transition-colors ${
                  isSelected && isPending ? 'border-[#4C1D95]' : 'border-[#E6E2F0]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    {isPending ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Select ${item.title}`}
                        className="mt-1 h-4 w-4 rounded border-[#C9C2DC] text-[#4C1D95] focus:ring-[#4C1D95]"
                      />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-[#059669] mt-1 shrink-0" />
                    )}

                    <div className="space-y-1.5">
                      {/* Clean zero-pill metadata line */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6A7C]">
                        <span className="font-mono-tabular font-semibold text-[#4C1D95]">
                          {String(item.categoryNumber).padStart(2, '0')}. {item.categoryName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-medium ${verif.textClass}`}>{verif.label}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">Priority: {item.priority}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {item.cadenceType === 'recurring' ? 'Recurring' : 'One-time'} (
                          {item.suggestedDeadlineOrFrequency})
                        </span>
                      </div>

                      <h3 className="font-display text-base font-semibold text-[#1C1B22]">
                        {item.title}
                      </h3>
                      <p className="text-sm text-[#4A4756] leading-relaxed">{item.description}</p>
                      <p className="text-xs text-[#6E6A7C] leading-relaxed">
                        <span className="font-medium text-[#1C1B22]">Why it matters:</span>{' '}
                        {item.whyItMatters}
                      </p>

                      <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6E6A7C]">
                        <span>Owner: {item.responsiblePerson}</span>
                        <span aria-hidden="true">·</span>
                        <span>Jurisdiction: {item.applicableJurisdiction}</span>
                        {item.requiresExplicitApproval && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[#B45309] font-medium">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Requires explicit approval before filing/payment
                            </span>
                          </>
                        )}
                        {item.officialSourceUrl && (
                          <>
                            <span aria-hidden="true">·</span>
                            <a
                              href={item.officialSourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#4C1D95] hover:underline font-medium"
                            >
                              Official Source
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
                    {isPending ? (
                      <button
                        type="button"
                        onClick={() => onDismissItem(item.id)}
                        className="p-2 text-xs text-[#6E6A7C] hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Dismiss item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-[#059669] whitespace-nowrap">
                        Approved &amp; Tracked
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.some((i) => i.verificationStatus === 'needs_confirmation') && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 flex items-start gap-3 text-xs text-[#92400E]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Some items are flagged <strong>Requires Local Confirmation</strong> because exact city,
            county, or state licensing rules depend on local zoning and municipal portals. Verify
            those dates and fees directly with your local clerk or licensed CPA.
          </p>
        </div>
      )}
    </div>
  );
}
