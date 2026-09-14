import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { EscalationTrigger } from '@/domain/action-plan/types';

interface LegalDisclaimerBannerProps {
  escalationTriggers?: EscalationTrigger[];
}

export const LegalDisclaimerBanner: React.FC<LegalDisclaimerBannerProps> = ({
  escalationTriggers = [],
}) => {
  const activeTriggers = escalationTriggers.filter((t) => t.detectedInDocument);

  return (
    <aside className="mb-6 space-y-3" aria-label="Legal Disclaimers and Escalations">
      {/* Contextual High-Risk Escalation Banner */}
      {activeTriggers.length > 0 && (
        <div
          className="p-4 rounded-lg bg-red-50 border-2 border-red-500 text-red-950 dark:bg-red-950 dark:text-red-100 dark:border-red-600 flex items-start gap-3 shadow-sm"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle
            className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-1 text-sm">
            <p className="font-bold text-base text-red-900 dark:text-red-100">
              URGENT LEGAL ESCALATION REQUIRED
            </p>
            {activeTriggers.map((trig) => (
              <p key={trig.id} className="leading-relaxed">
                <strong>{trig.title}:</strong> {trig.description} —{' '}
                <span className="font-semibold underline">{trig.recommendedNextStep}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Standard Legal Information Boundary */}
      <div
        className="p-3.5 rounded-md bg-slate-50 border border-slate-300 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 flex items-center gap-3 text-xs leading-normal"
        role="note"
        aria-label="Legal Information Boundary"
      >
        <ShieldAlert className="w-5 h-5 text-slate-500 flex-shrink-0" aria-hidden="true" />
        <p>
          <strong>Notice & Legal Information Boundary:</strong> LexiGuard is an analytical
          document-navigation assistant. It explains document wording and prepares questions for
          legal counsel. It is not an attorney, law firm, or court, and does not provide legal
          advice or definitive outcome predictions.
        </p>
      </div>
    </aside>
  );
};
