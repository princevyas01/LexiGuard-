import React, { useState } from 'react';
import { GitCompare, RefreshCw, ArrowRight } from 'lucide-react';
import { DocumentComparisonResult } from '@/domain/comparison/types';
import { SeverityBadge } from '../common/SeverityBadge';

interface ContractComparisonViewProps {
  comparison: DocumentComparisonResult | null;
  isLoading: boolean;
  onRunComparison: () => void;
}

export const ContractComparisonView: React.FC<ContractComparisonViewProps> = ({
  comparison,
  isLoading,
  onRunComparison,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  if (!comparison && !isLoading) {
    return (
      <div className="text-center py-16 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
          <GitCompare className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Semantic Contract Comparison
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            Compare two versions of an agreement (e.g. Apex NDA v1.0 baseline vs v2.0 revision) to
            detect added non-competes, deleted indemnities, and modified dispute forums.
          </p>
        </div>
        <button
          onClick={onRunComparison}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <span>Run NDA v1 vs v2 Comparison</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-20 space-y-3" role="status" aria-live="polite">
        <RefreshCw className="w-8 h-8 mx-auto text-blue-600 animate-spin" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Performing semantic clause alignment and materiality analysis...
        </p>
      </div>
    );
  }

  if (!comparison) return null;

  const filteredFindings = comparison.findings.filter((f) => {
    if (selectedFilter === 'ALL') return true;
    return f.changeType === selectedFilter;
  });

  return (
    <div className="space-y-8" aria-label="Contract Comparison Results">
      {/* Summary Header Card */}
      <div className="p-6 rounded-xl bg-slate-900 text-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            SEMANTIC COMPARISON COMPLETE
          </span>
          <span className="text-xs text-slate-400">
            Comparing: {comparison.docATitle} ➔ {comparison.docBTitle}
          </span>
        </div>

        <div>
          <h2 className="text-xl font-extrabold tracking-tight">
            Comparison Summary & Materiality Overview
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{comparison.summary}</p>
        </div>

        {/* Change Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-center">
            <p className="text-[11px] text-emerald-400 font-semibold">Added Clauses</p>
            <p className="text-xl font-bold text-white">{comparison.addedCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-center">
            <p className="text-[11px] text-red-400 font-semibold">Removed Clauses</p>
            <p className="text-xl font-bold text-white">{comparison.removedCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-center">
            <p className="text-[11px] text-amber-400 font-semibold">Modified Clauses</p>
            <p className="text-xl font-bold text-white">{comparison.modifiedCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-center">
            <p className="text-[11px] text-blue-400 font-semibold">Unchanged Clauses</p>
            <p className="text-xl font-bold text-white">{comparison.unchangedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs border-b border-slate-200 dark:border-slate-800 pb-2">
        <span className="font-semibold text-slate-500 dark:text-slate-400 mr-2">
          Filter Changes:
        </span>
        {['ALL', 'ADDED', 'REMOVED', 'MODIFIED'].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedFilter(type)}
            className={`px-3 py-1 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              selectedFilter === type
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Clause-by-Clause Side-by-Side Comparison */}
      <div className="space-y-6">
        {filteredFindings.map((finding) => (
          <article
            key={finding.id}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <SeverityBadge severity={finding.severity} />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {finding.clauseTopic}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {finding.materiality.replace(/_/g, ' ')}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    finding.changeType === 'ADDED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : finding.changeType === 'REMOVED'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {finding.changeType}
                </span>
              </div>
            </div>

            {/* Side-by-Side Text Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Version A (Baseline)
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-serif leading-relaxed italic">
                  {finding.originalText || '(No corresponding clause in Version A - newly added)'}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Version B (Revised)
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-serif leading-relaxed italic">
                  {finding.revisedText || '(Clause deleted in Version B)'}
                </p>
              </div>
            </div>

            {/* Plain Language Explanation & Commercial Impact */}
            <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs space-y-1">
              <p className="text-slate-800 dark:text-slate-200">
                <strong>Plain-Language Explanation:</strong> {finding.plainLanguageExplanation}
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Commercial Exposure:</strong> {finding.commercialImpact}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
