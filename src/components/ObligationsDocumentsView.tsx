import React, { useMemo, useState } from 'react';
import { ExternalLink, FileText, Plus, ShieldCheck, Upload } from 'lucide-react';
import { daysUntilDate, formatCurrencyCents, formatIsoDate } from '../lib/domain.ts';
import type {
  DocCategory,
  DocumentRecord,
  ObligationRecord,
  ObligationType,
} from '../types/busirx.ts';

interface ObligationsDocumentsViewProps {
  obligations: ObligationRecord[];
  documents: DocumentRecord[];
  onCreateObligation: (input: {
    recordType: ObligationType;
    title: string;
    issuerOrVendor: string;
    jurisdiction: string;
    referenceNumber: string;
    amountCents: number;
    currency: string;
    dueOrExpiryDate: string;
    recurrenceIntervalDays: number;
    officialSourceUrl: string;
    requiresExplicitApproval: boolean;
    notes: string;
  }) => Promise<void>;
  onApproveAndResolveObligation: (obl: ObligationRecord) => Promise<void>;
  onUploadDocument: (input: {
    title: string;
    docCategory: DocCategory;
    file: File;
    linkedObligationId?: string;
  }) => Promise<{ storageUploaded: boolean; warning?: string }>;
}

export function ObligationsDocumentsView({
  obligations,
  documents,
  onCreateObligation,
  onApproveAndResolveObligation,
  onUploadDocument,
}: ObligationsDocumentsViewProps) {
  const [filterType, setFilterType] = useState<'all' | ObligationType>('all');
  const [showOblForm, setShowOblForm] = useState(false);
  const [confirmObl, setConfirmObl] = useState<ObligationRecord | null>(null);
  const [notice, setNotice] = useState('');

  // Obligation fields
  const [recordType, setRecordType] = useState<ObligationType>('license');
  const [title, setTitle] = useState('');
  const [issuerOrVendor, setIssuerOrVendor] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [amountUsd, setAmountUsd] = useState('0');
  const [dueOrExpiryDate, setDueOrExpiryDate] = useState(formatIsoDate(new Date()));
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState(365);
  const [officialSourceUrl, setOfficialSourceUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Document fields
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocCategory>('license');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const visibleObligations = useMemo(() => {
    return obligations
      .filter((o) => filterType === 'all' || o.recordType === filterType)
      .sort((a, b) =>
        (a.dueOrExpiryDate || '9999-12-31').localeCompare(b.dueOrExpiryDate || '9999-12-31')
      );
  }, [obligations, filterType]);

  const handleAddObligation = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round((parseFloat(amountUsd) || 0) * 100);
    await onCreateObligation({
      recordType,
      title,
      issuerOrVendor,
      jurisdiction,
      referenceNumber,
      amountCents,
      currency: 'USD',
      dueOrExpiryDate,
      recurrenceIntervalDays,
      officialSourceUrl,
      requiresExplicitApproval: true,
      notes,
    });
    setTitle('');
    setIssuerOrVendor('');
    setReferenceNumber('');
    setNotes('');
    setShowOblForm(false);
    setNotice('Obligation saved with expiration and renewal tracking.');
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;
    setUploading(true);
    try {
      const res = await onUploadDocument({
        title: docTitle || docFile.name,
        docCategory,
        file: docFile,
      });
      setDocTitle('');
      setDocFile(null);
      setNotice(
        res.warning
          ? res.warning
          : `Document "${docTitle || docFile.name}" encrypted & stored privately.`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="bg-[#F3EFFC] border border-[#DDD6FE] rounded-xl px-4 py-3 text-xs text-[#4C1D95] flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Explicit Approval Modal for Payment / Renewal */}
      {confirmObl && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#1C1B22]">
              Confirm Payment / Filing Completion
            </h3>
            <p className="text-sm text-[#4A4756] leading-relaxed">
              Approve marking <strong>{confirmObl.title}</strong> ({confirmObl.recordType}) as paid
              or renewed? If recurring ({confirmObl.recurrenceIntervalDays} days), Busi Rx will
              advance the next due date automatically.
            </p>
            <div className="bg-[#F8F7FB] border border-[#E6E2F0] rounded-lg p-3 text-xs space-y-1 text-[#4A4756]">
              <p>Vendor / Issuer: {confirmObl.issuerOrVendor || 'Not specified'}</p>
              <p className="font-mono-tabular">
                Amount: {formatCurrencyCents(confirmObl.amountCents, confirmObl.currency)}
              </p>
              <p className="font-mono-tabular">Current Due Date: {confirmObl.dueOrExpiryDate || 'TBD'}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmObl(null)}
                className="px-4 py-2 text-xs border border-[#E6E2F0] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onApproveAndResolveObligation(confirmObl);
                  setConfirmObl(null);
                  setNotice(`Recorded approval & updated schedule for "${confirmObl.title}".`);
                }}
                className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg"
              >
                Approve &amp; Advance Cycle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bills, Licenses & Insurance Header */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#1C1B22]">
            Bills, Licenses &amp; Insurance
          </h2>
          <p className="text-sm text-[#6E6A7C] mt-0.5">
            Track renewal expirations, policy numbers, bill due dates, and official filing links.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowOblForm((v) => !v)}
          className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] flex items-center gap-1.5 whitespace-nowrap self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Bill / License / Policy
        </button>
      </div>

      {showOblForm && (
        <form
          onSubmit={handleAddObligation}
          className="bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Record Type</label>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as ObligationType)}
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg bg-white"
              >
                <option value="license">Business License / Permit</option>
                <option value="insurance">Insurance Policy</option>
                <option value="bill">Recurring Bill / Tax</option>
                <option value="certification">Certification</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., General Liability Policy or City Operating License"
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Issuer / Vendor</label>
              <input
                type="text"
                value={issuerOrVendor}
                onChange={(e) => setIssuerOrVendor(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Jurisdiction</label>
              <input
                type="text"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">Due / Expiry Date</label>
              <input
                type="date"
                value={dueOrExpiryDate}
                onChange={(e) => setDueOrExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-[#E6E2F0] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Policy / License #
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Renewal Cycle (Days, 0 = one-time)
              </label>
              <input
                type="number"
                min={0}
                max={3650}
                value={recurrenceIntervalDays}
                onChange={(e) => setRecurrenceIntervalDays(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono-tabular border border-[#E6E2F0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A4756] mb-1">
                Official Portal URL (optional)
              </label>
              <input
                type="url"
                value={officialSourceUrl}
                onChange={(e) => setOfficialSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowOblForm(false)}
              className="px-4 py-2 text-xs border border-[#E6E2F0] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg"
            >
              Save Record
            </button>
          </div>
        </form>
      )}

      {/* Type Filter */}
      <div className="flex flex-wrap gap-1.5 bg-white border border-[#E6E2F0] rounded-xl p-1.5 w-fit">
        {[
          { id: 'all' as const, label: 'All Records' },
          { id: 'bill' as const, label: 'Bills' },
          { id: 'license' as const, label: 'Licenses' },
          { id: 'insurance' as const, label: 'Insurance' },
          { id: 'certification' as const, label: 'Certifications' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterType(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
              filterType === tab.id ? 'bg-[#4C1D95] text-white' : 'text-[#4A4756]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Obligations Table */}
      <div className="bg-white border border-[#E6E2F0] rounded-xl overflow-hidden">
        {visibleObligations.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6E6A7C]">
            No bills, licenses, or insurance policies tracked yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6E2F0] text-xs font-semibold text-[#6E6A7C] bg-[#F8F7FB]">
                  <th className="py-3 px-4">Item &amp; Issuer</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Due / Expiry</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EEF7] text-sm">
                {visibleObligations.map((o) => {
                  const days = daysUntilDate(o.dueOrExpiryDate);
                  return (
                    <tr key={o.id} className="hover:bg-[#FAF9FC]">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[#1C1B22]">{o.title}</p>
                        <p className="text-xs text-[#6E6A7C]">
                          {o.issuerOrVendor || 'Issuer pending'}
                          {o.referenceNumber ? ` · #${o.referenceNumber}` : ''}
                          {o.officialSourceUrl && (
                            <>
                              {' · '}
                              <a
                                href={o.officialSourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#4C1D95] hover:underline inline-flex items-center gap-0.5"
                              >
                                Portal <ExternalLink className="w-3 h-3" />
                              </a>
                            </>
                          )}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-xs capitalize text-[#4A4756]">
                        {o.recordType}
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular text-xs">
                        <span
                          className={
                            days !== null && days < 0
                              ? 'text-red-600 font-semibold'
                              : days !== null && days <= 14
                              ? 'text-[#B45309] font-semibold'
                              : 'text-[#1C1B22]'
                          }
                        >
                          {o.dueOrExpiryDate || 'Needs Confirmation'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-tabular text-xs font-medium text-[#1C1B22]">
                        {formatCurrencyCents(o.amountCents, o.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setConfirmObl(o)}
                          className="px-3 py-1.5 text-xs font-medium bg-[#F3EFFC] text-[#4C1D95] rounded-lg hover:bg-[#E8E0FA] whitespace-nowrap"
                        >
                          Approve &amp; Renew
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Private Document Vault */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleUploadSubmit}
          className="lg:col-span-5 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#059669]" />
            <h3 className="font-display text-base font-semibold text-[#1C1B22]">
              Private Document Vault
            </h3>
          </div>
          <p className="text-xs text-[#6E6A7C]">
            Store articles of organization, EIN letters, insurance certificates, and signed contracts
            scoped strictly to your owner UID.
          </p>
          <div>
            <label className="block text-xs font-medium text-[#4A4756] mb-1">Document Title</label>
            <input
              type="text"
              required
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g., IRS CP 575 EIN Confirmation"
              className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A4756] mb-1">Category</label>
            <select
              value={docCategory}
              onChange={(e) => setDocCategory(e.target.value as DocCategory)}
              className="w-full px-3 py-2 text-sm border border-[#E6E2F0] rounded-lg bg-white"
            >
              <option value="formation">Formation &amp; Entity</option>
              <option value="license">Licenses &amp; Permits</option>
              <option value="tax">Tax Filings</option>
              <option value="insurance">Insurance Certificates</option>
              <option value="contract">Contracts &amp; NDAs</option>
              <option value="hr">HR &amp; Onboarding</option>
              <option value="financial">Banking &amp; Financial</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A4756] mb-1">Select File</label>
            <input
              type="file"
              required
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-[#4A4756]"
            />
          </div>
          <button
            type="submit"
            disabled={uploading || !docFile}
            className="w-full py-2.5 text-xs font-semibold bg-[#4C1D95] text-white rounded-lg hover:bg-[#3B1478] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Uploading...' : 'Upload to Private Vault'}
          </button>
        </form>

        <div className="lg:col-span-7 bg-white border border-[#E6E2F0] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-[#1C1B22]">
              Vault Records ({documents.length})
            </h3>
          </div>
          {documents.length === 0 ? (
            <p className="text-xs text-[#6E6A7C] py-8">
              No documents uploaded yet. Add formation records, licenses, or policy PDFs on the left.
            </p>
          ) : (
            <div className="divide-y divide-[#F1EEF7]">
              {documents.map((d) => (
                <div key={d.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-[#4C1D95] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1C1B22] truncate">{d.title}</p>
                      <p className="text-xs text-[#6E6A7C]">
                        {d.docCategory} · {d.fileName} ·{' '}
                        <span className="font-mono-tabular">
                          {Math.max(1, Math.round(d.sizeBytes / 1024))} KB
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-[#059669] shrink-0">
                    {d.storagePath ? 'Stored in Bucket' : 'Metadata Indexed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
