import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { Document } from '@/domain/documents/types';
import type { DocumentAnalysisResult } from '@/application/analysis/analyze-document';
import type { ActionPlan } from '@/domain/action-plan/types';
import type { ActiveTab } from '../layout/Navbar';

interface DocumentOverviewProps {
  document: Document;
  analysis: DocumentAnalysisResult | null;
  actionPlan: ActionPlan | null;
  onNavigate: (tab: ActiveTab) => void;
}

export const DocumentOverview: React.FC<DocumentOverviewProps> = ({
  document,
  analysis,
  actionPlan,
  onNavigate,
}) => {
  const highRiskCount =
    analysis?.findings.filter((f) => f.severity === 'HIGH_ATTENTION').length || 0;
  const reviewSoonCount =
    analysis?.findings.filter((f) => f.severity === 'REVIEW_SOON').length || 0;
  const totalObligations = analysis?.obligations.length || 0;
  const totalDeadlines = analysis?.deadlines.length || 0;

  return (
    <div className="space-y-8" aria-label="Document Overview">
      {/* Hero Overview Card */}
      <div className="p-6 rounded-xl bg-slate-900 text-white shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              ACTIVE CONTRACT
            </span>
            {document.metadata.isScannedOrLowText && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                SCANNED / LOW TEXT
              </span>
            )}
            {analysis?.isHostilePromptDetected && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                INJECTION ATTEMPT NEUTRALIZED
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">
            Ingested: {new Date(document.metadata.ingestedAt).toLocaleTimeString()}
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {document.metadata.detectedTitle || document.metadata.fileName}
          </h1>
          <p className="text-slate-300 text-xs mt-1 font-mono">
            SHA-256: {document.metadata.sha256Hash.slice(0, 24)}...
          </p>
        </div>

        {/* 3 Core Questions: What it means, What to worry about, What to do next */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 space-y-1">
            <p className="text-xs font-semibold text-blue-400">WHAT THIS DOCUMENT IS</p>
            <p className="text-xs text-slate-200 leading-relaxed">
              Contains {document.sections.length} sections and {document.clauses.length} clauses.
              Structured for legal evaluation.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 space-y-1">
            <p className="text-xs font-semibold text-red-400">WHAT TO WORRY ABOUT</p>
            <p className="text-xs text-slate-200 leading-relaxed">
              {highRiskCount} High-Attention risk findings flagged. Review auto-renewal and
              liability terms promptly.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 space-y-1">
            <p className="text-xs font-semibold text-emerald-400">WHAT TO DO NEXT</p>
            <p className="text-xs text-slate-200 leading-relaxed">
              {actionPlan?.immediateActions.length || 0} immediate action items and{' '}
              {actionPlan?.questionsForLawyer.length || 0} questions prepared for counsel.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            High Attention Risks
          </p>
          <p className="text-2xl font-extrabold text-red-600 dark:text-red-400">{highRiskCount}</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Review Soon Items
          </p>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {reviewSoonCount}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Obligations</p>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {totalObligations}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Tracked Deadlines
          </p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {totalDeadlines}
          </p>
        </div>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onNavigate('risks')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <span>Inspect Risks & Obligations</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          onClick={() => onNavigate('ask')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <span>Ask Grounded Questions</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          onClick={() => onNavigate('action-plan')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 font-semibold text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <span>View Action Plan & Lawyer Prep</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Document Integrity & Grounding Evidence Card */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Evidence-First Architecture Invariant
          </h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Every claim in LexiGuard is verified against the document’s exact text spans and character
          offsets. Unverified model assertions are strictly downgraded or rejected.
        </p>
      </div>
    </div>
  );
};
