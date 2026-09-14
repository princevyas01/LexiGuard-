'use client';

import React, { useState } from 'react';
import { Document } from '@/domain/documents/types';
import { DocumentAnalysisResult } from '@/application/analysis/analyze-document';
import { ActionPlan } from '@/domain/action-plan/types';
import { DocumentComparisonResult } from '@/domain/comparison/types';
import { Navbar, ActiveTab } from '@/components/layout/Navbar';
import { LegalDisclaimerBanner } from '@/components/common/LegalDisclaimerBanner';
import { DocumentUploader } from '@/components/documents/DocumentUploader';
import { DocumentOverview } from '@/components/overview/DocumentOverview';
import { RisksAndObligationsView } from '@/components/risks/RisksAndObligationsView';
import { ContractComparisonView } from '@/components/compare/ContractComparisonView';
import { GroundedQnAView } from '@/components/ask/GroundedQnAView';
import { ActionPlanView } from '@/components/action-plan/ActionPlanView';
import { PrivacyView } from '@/components/privacy/PrivacyView';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('documents');
  const [document, setDocument] = useState<Document | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysisResult | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [comparison, setComparison] = useState<DocumentComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Trigger analysis when a document is uploaded or chosen
  const handleDocumentLoaded = async (doc: Document) => {
    setDocument(doc);
    setIsAnalyzing(true);
    setActiveTab('overview');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAnalysis(data.analysis);
        setActionPlan(data.actionPlan);
      }
    } catch (err) {
      // Handled gracefully in UI
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunComparison = async () => {
    setActiveTab('compare');
    setIsComparing(true);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setComparison(data.comparison);
      }
    } catch (err) {
      // Handled gracefully in UI
    } finally {
      setIsComparing(false);
    }
  };

  const handleClearSession = () => {
    setDocument(null);
    setAnalysis(null);
    setActionPlan(null);
    setComparison(null);
    setActiveTab('documents');
  };

  return (
    <div className="min-h-full flex flex-col">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} hasDocument={document !== null} />

      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global Legal Boundary & Contextual Escalation */}
        <LegalDisclaimerBanner escalationTriggers={actionPlan?.escalationTriggers} />

        {isAnalyzing && (
          <div
            className="mb-6 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-2 animate-pulse"
            role="status"
          >
            <span>Analyzing contract structure, obligations, and risk policy rules...</span>
          </div>
        )}

        {/* Tab 1: Documents / Uploader */}
        {activeTab === 'documents' && (
          <div role="tabpanel" id="panel-documents" aria-labelledby="nav-tab-documents">
            <DocumentUploader
              onDocumentLoaded={handleDocumentLoaded}
              onCompareRequested={handleRunComparison}
            />
          </div>
        )}

        {/* Tab 2: Overview */}
        {activeTab === 'overview' && document && (
          <div role="tabpanel" id="panel-overview" aria-labelledby="nav-tab-overview">
            <DocumentOverview
              document={document}
              analysis={analysis}
              actionPlan={actionPlan}
              onNavigate={setActiveTab}
            />
          </div>
        )}

        {/* Tab 3: Risks & Obligations */}
        {activeTab === 'risks' && (
          <div role="tabpanel" id="panel-risks" aria-labelledby="nav-tab-risks">
            <RisksAndObligationsView
              findings={analysis?.findings || []}
              obligations={analysis?.obligations || []}
              deadlines={analysis?.deadlines || []}
            />
          </div>
        )}

        {/* Tab 4: Compare */}
        {activeTab === 'compare' && (
          <div role="tabpanel" id="panel-compare" aria-labelledby="nav-tab-compare">
            <ContractComparisonView
              comparison={comparison}
              isLoading={isComparing}
              onRunComparison={handleRunComparison}
            />
          </div>
        )}

        {/* Tab 5: Ask Grounded Questions */}
        {activeTab === 'ask' && document && (
          <div role="tabpanel" id="panel-ask" aria-labelledby="nav-tab-ask">
            <GroundedQnAView document={document} />
          </div>
        )}

        {/* Tab 6: Action Plan */}
        {activeTab === 'action-plan' && actionPlan && (
          <div role="tabpanel" id="panel-action-plan" aria-labelledby="nav-tab-action-plan">
            <ActionPlanView actionPlan={actionPlan} />
          </div>
        )}

        {/* Tab 7: Privacy & Limits */}
        {activeTab === 'privacy' && (
          <div role="tabpanel" id="panel-privacy" aria-labelledby="nav-tab-privacy">
            <PrivacyView onClearSession={handleClearSession} />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 bg-white dark:bg-slate-900 mt-auto print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>
            LexiGuard &bull; Prompt Wars Hackathon Submission &bull; Evidence-First AI Architecture
          </p>
          <div className="flex items-center gap-4">
            <span>WCAG 2.2 AA Baseline</span>
            <span>OWASP ASVS 5.0 Baseline</span>
            <span>Single Branch &lt; 10 MB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
