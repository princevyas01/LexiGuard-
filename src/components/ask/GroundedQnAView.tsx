import React, { useState, useRef } from 'react';
import { Send, MessageSquare, ShieldCheck, HelpCircle, ExternalLink } from 'lucide-react';
import { Document } from '@/domain/documents/types';
import { EvidenceSpan } from '@/domain/findings/types';
import { AskResponse } from '@/application/qna/answer-document-question';
import { AccessibleModal } from '../common/AccessibleModal';

interface GroundedQnAViewProps {
  document: Document;
}

export const GroundedQnAView: React.FC<GroundedQnAViewProps> = ({ document }) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState<AskResponse[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<EvidenceSpan | null>(null);
  const modalTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleAsk = async (queryToAsk?: string) => {
    const q = queryToAsk || question;
    if (!q.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          question: q,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to obtain grounded answer.');
      }

      setResponses((prev) => [data.answer, ...prev]);
      setQuestion('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error asking question');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8" aria-label="Grounded Question Answering">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Ask Questions Grounded in Document Evidence
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Answers are strictly verified against source clauses. When evidence is missing, LexiGuard
          explicitly refuses to fabricate answers.
        </p>
      </div>

      {/* Accessible Error Announcement Region */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-sm text-red-800 dark:text-red-200 flex items-start justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">Error:</span>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-xs font-medium px-2 py-1 rounded focus:ring-2 focus:ring-red-500"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Question Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="space-y-3"
      >
        <div className="relative">
          <label htmlFor="user-legal-question" className="sr-only">
            Ask a question about this contract
          </label>
          <input
            id="user-legal-question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., What happens if rent is paid late? Does the contract auto-renew?"
            disabled={isLoading}
            className="w-full px-4 py-3 pr-12 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 shadow-sm"
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            aria-label="Submit question"
            className="absolute right-2 top-2 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Quick Suggested Prompts */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-slate-500 flex items-center gap-1 font-medium">
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Try asking:
          </span>
          <button
            type="button"
            onClick={() => handleAsk('What happens if rent is paid late?')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors text-xs"
          >
            &ldquo;What happens if rent is late?&rdquo;
          </button>
          <button
            type="button"
            onClick={() => handleAsk('Does this contract allow pets or animals?')}
            className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors text-xs"
          >
            &ldquo;Does it allow pets?&rdquo; (Missing Info Test)
          </button>
        </div>
      </form>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 text-xs text-blue-600 animate-pulse">
          <MessageSquare className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>Retrieving clauses and verifying evidence...</span>
        </div>
      )}

      {/* Answers Stream */}
      <div className="space-y-6">
        {responses.map((resp, idx) => (
          <article
            key={idx}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4"
          >
            {/* Header Question & Claim Type Tag */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Q: {resp.question}
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    resp.claimType === 'DOCUMENT_FACT'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : resp.claimType === 'INSUFFICIENT_EVIDENCE'
                        ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {resp.claimType.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Confidence: {resp.confidence}
                </span>
              </div>
            </div>

            {/* Answer Text */}
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-line">
              {resp.answer}
            </p>

            {/* Cited Evidence Chips */}
            {resp.supportingSpans && resp.supportingSpans.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Cited Source Excerpts:
                </p>
                <div className="flex flex-wrap gap-2">
                  {resp.supportingSpans.map((span, sIdx) => (
                    <button
                      key={sIdx}
                      ref={modalTriggerRef}
                      onClick={() => setActiveEvidenceModal(span)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 text-xs hover:bg-blue-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 text-left"
                      aria-label={`View cited excerpt from Clause ${span.clauseId}`}
                    >
                      <ShieldCheck
                        className="w-3.5 h-3.5 text-blue-600 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate max-w-xs font-mono">
                        Clause {span.clauseId}: &ldquo;{span.exactQuotedText.slice(0, 45)}...&rdquo;
                      </span>
                      <ExternalLink
                        className="w-3 h-3 text-blue-500 flex-shrink-0"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Legal Boundary Notice on Answer */}
            <div className="text-[11px] text-slate-500 border-l-2 border-slate-300 dark:border-slate-700 pl-2.5 italic">
              {resp.legalBoundaryDisclaimer}
            </div>
          </article>
        ))}
      </div>

      {/* Verified Evidence Modal */}
      <AccessibleModal
        isOpen={activeEvidenceModal !== null}
        onClose={() => setActiveEvidenceModal(null)}
        title="Verified Grounding Excerpt"
        triggerElementRef={modalTriggerRef}
      >
        {activeEvidenceModal && (
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-slate-500 border-b pb-2">
              <span>Section: {activeEvidenceModal.sectionId}</span>
              <span>Clause: {activeEvidenceModal.clauseId}</span>
              <span className="font-semibold text-emerald-600">
                {activeEvidenceModal.confidenceState}
              </span>
            </div>
            <blockquote className="p-3 bg-slate-100 dark:bg-slate-800 rounded border-l-4 border-blue-600 text-xs italic font-serif">
              &ldquo;{activeEvidenceModal.exactQuotedText}&rdquo;
            </blockquote>
          </div>
        )}
      </AccessibleModal>
    </div>
  );
};
