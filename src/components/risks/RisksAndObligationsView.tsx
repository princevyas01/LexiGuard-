import React, { useState, useRef } from 'react';
import { ExternalLink, Filter, Calendar, ShieldCheck } from 'lucide-react';
import { AnalysisFinding, EvidenceSpan } from '@/domain/findings/types';
import { DeadlineItem, Obligation } from '@/domain/obligations/types';
import { AccessibleModal } from '../common/AccessibleModal';
import { SeverityBadge } from '../common/SeverityBadge';

interface RisksAndObligationsViewProps {
  findings: AnalysisFinding[];
  obligations: Obligation[];
  deadlines: DeadlineItem[];
}

export const RisksAndObligationsView: React.FC<RisksAndObligationsViewProps> = ({
  findings,
  obligations,
  deadlines,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<EvidenceSpan | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const filteredFindings = findings.filter((f) => {
    if (selectedSeverity === 'ALL') return true;
    return f.severity === selectedSeverity;
  });

  return (
    <div className="space-y-10" aria-label="Risks and Obligations Analysis">
      {/* 1. Risk Findings Section */}
      <section className="space-y-5" aria-labelledby="risks-heading">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2
              id="risks-heading"
              className="text-xl font-bold text-slate-900 dark:text-white tracking-tight"
            >
              Risk Findings & Clause Explanations
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Structured analysis distinguishing what the contract says from why it matters.
            </p>
          </div>

          {/* Severity Filter Controls */}
          <div
            className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs"
            role="toolbar"
            aria-label="Filter risk findings by severity"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5" aria-hidden="true" />
            <button
              onClick={() => setSelectedSeverity('ALL')}
              aria-pressed={selectedSeverity === 'ALL'}
              className={`px-2.5 py-1 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selectedSeverity === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All ({findings.length})
            </button>
            <button
              onClick={() => setSelectedSeverity('HIGH_ATTENTION')}
              aria-pressed={selectedSeverity === 'HIGH_ATTENTION'}
              className={`px-2.5 py-1 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selectedSeverity === 'HIGH_ATTENTION'
                  ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-red-600'
              }`}
            >
              High Attention
            </button>
            <button
              onClick={() => setSelectedSeverity('REVIEW_SOON')}
              aria-pressed={selectedSeverity === 'REVIEW_SOON'}
              className={`px-2.5 py-1 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selectedSeverity === 'REVIEW_SOON'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
              }`}
            >
              Review Soon
            </button>
          </div>
        </div>

        {/* Findings Grid */}
        <div className="space-y-4">
          {filteredFindings.map((finding) => (
            <article
              key={finding.id}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-4"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <SeverityBadge severity={finding.severity} />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {finding.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Target: {finding.affectedParty}
                  </span>
                  {finding.isVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      Verified In Doc
                    </span>
                  )}
                </div>
              </div>

              {/* Two-Column Pattern: What Document Says vs Why It Matters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: What the document says */}
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                    What The Document Says
                  </p>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    {finding.sourceSpans[0]?.exactQuotedText || finding.plainLanguageSummary}
                  </p>
                  {finding.sourceSpans[0] && (
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">
                        Clause: {finding.sourceSpans[0].clauseId}
                      </span>
                      <button
                        ref={triggerRef}
                        onClick={() => setActiveEvidenceModal(finding.sourceSpans[0])}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        aria-label={`View verified source excerpt for ${finding.title}`}
                      >
                        <span>Inspect Evidence</span>
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Column 2: Why it matters */}
                <div className="p-3.5 rounded-lg bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-1.5">
                  <p className="text-[11px] font-bold tracking-wider uppercase text-amber-800 dark:text-amber-300">
                    Why It Matters
                  </p>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                    {finding.whyItMatters}
                  </p>
                  <div className="pt-2">
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      <strong>Recommended Question:</strong> &ldquo;{finding.recommendedQuestion}
                      &rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 2. Structured Obligations Table */}
      <section className="space-y-4" aria-labelledby="obligations-heading">
        <div>
          <h2
            id="obligations-heading"
            className="text-xl font-bold text-slate-900 dark:text-white tracking-tight"
          >
            Mandatory Obligations & Trigger Conditions
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Who must act, trigger prerequisites, and compliance time windows.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table
            className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs"
            aria-label="Extracted Contract Obligations"
          >
            <thead className="bg-slate-50 dark:bg-slate-950">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"
                >
                  Actor
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"
                >
                  Obligation
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"
                >
                  Trigger
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"
                >
                  Deadline
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300"
                >
                  Evidence
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {obligations.map((ob) => (
                <tr
                  key={ob.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {ob.actor}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-xs">
                    {ob.obligation}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs">
                    {ob.trigger}
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                    {ob.deadline}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {ob.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => setActiveEvidenceModal(ob.sourceSpan)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 text-xs"
                      aria-label={`View evidence for obligation of ${ob.actor}`}
                    >
                      Clause Quote
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Deadlines & Timeline Section */}
      <section className="space-y-4" aria-labelledby="deadlines-heading">
        <div>
          <h2
            id="deadlines-heading"
            className="text-xl font-bold text-slate-900 dark:text-white tracking-tight"
          >
            Key Dates & Deadlines
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Notice periods, renewal deadlines, and penalty triggers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {deadlines.map((dl) => (
            <div
              key={dl.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{dl.title}</h3>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {dl.type.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Due: {dl.dueDateOrPeriod}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                <strong>Consequences of Missing:</strong> {dl.consequencesOfMissing}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Verified Evidence Modal Dialog */}
      <AccessibleModal
        isOpen={activeEvidenceModal !== null}
        onClose={() => setActiveEvidenceModal(null)}
        title="Verified Contract Evidence"
        triggerElementRef={triggerRef}
      >
        {activeEvidenceModal && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2">
              <span>Section: {activeEvidenceModal.sectionId}</span>
              <span>Clause: {activeEvidenceModal.clauseId}</span>
              <span>Page: {activeEvidenceModal.pageNumber ?? 1}</span>
              <span className="font-semibold text-emerald-600">
                Status: {activeEvidenceModal.confidenceState}
              </span>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Verbatim Quoted Excerpt:
              </p>
              <blockquote className="mt-2 p-3 bg-slate-100 dark:bg-slate-800/80 rounded border-l-4 border-blue-600 text-xs italic text-slate-800 dark:text-slate-200 leading-relaxed font-serif">
                &ldquo;{activeEvidenceModal.exactQuotedText}&rdquo;
              </blockquote>
            </div>

            <div className="pt-2 text-xs text-slate-500">
              <p>
                <strong>Character Offset:</strong> {activeEvidenceModal.startOffset} to{' '}
                {activeEvidenceModal.endOffset}
              </p>
              <p className="mt-0.5">
                <strong>Evidence Sufficiency:</strong>{' '}
                {activeEvidenceModal.evidenceSufficiencyState}
              </p>
            </div>
          </div>
        )}
      </AccessibleModal>
    </div>
  );
};
