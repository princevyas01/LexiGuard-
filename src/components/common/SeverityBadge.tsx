import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { RiskSeverity } from '@/domain/findings/types';

interface SeverityBadgeProps {
  severity: RiskSeverity;
  className?: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, className = '' }) => {
  switch (severity) {
    case 'HIGH_ATTENTION':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800 ${className}`}
          role="status"
          aria-label="High Attention Risk"
        >
          <AlertTriangle
            className="w-3.5 h-3.5 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
          <span>High Attention</span>
        </span>
      );

    case 'REVIEW_SOON':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800 ${className}`}
          role="status"
          aria-label="Review Soon Risk"
        >
          <AlertCircle
            className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <span>Review Soon</span>
        </span>
      );

    case 'LOW_CONCERN':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800 ${className}`}
          role="status"
          aria-label="Low Concern Notice"
        >
          <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span>Low Concern</span>
        </span>
      );

    case 'INFORMATIONAL':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 ${className}`}
          role="status"
          aria-label="Informational Notice"
        >
          <CheckCircle2
            className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400"
            aria-hidden="true"
          />
          <span>Informational</span>
        </span>
      );
  }
};
