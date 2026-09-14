import React from 'react';
import { Lock, ShieldCheck, Server, AlertCircle, Trash2 } from 'lucide-react';

interface PrivacyViewProps {
  onClearSession: () => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({ onClearSession }) => {
  return (
    <div className="space-y-8 max-w-4xl" aria-label="Privacy and Architecture Limitations">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Privacy Architecture & System Limitations
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Explicit, verifiable disclosures regarding data handling, persistence, and external
          boundaries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Persistence Disclosure */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
            <Server className="w-5 h-5" aria-hidden="true" />
            <span>Ephemeral In-Memory Storage</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Uploaded documents and extracted text reside strictly in memory within the active
            application process. No uploaded contracts are written to a permanent disk database.
            Restarting the server clears all documents.
          </p>
        </div>

        {/* AI Provider Transmission */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            <span>Zero-Credential Offline Mock Mode</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            In default Mock mode, 100% of processing and synthetic legal analysis occurs locally
            without external network transmission. If an optional external model provider (Google
            Gemini) is configured via environment variables, only retrieved relevant clauses are
            transmitted via encrypted HTTPS.
          </p>
        </div>

        {/* System Limitations */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
            <span>Known Technical Limitations</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            LexiGuard uses a deterministic BM25 lexical retriever and clause segmentation. Purely
            scanned image-only PDFs require external OCR, which is disabled by default to maintain
            repository size below 10 MB without heavy C++ binaries.
          </p>
        </div>

        {/* Logging Standards */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
            <Lock className="w-5 h-5" aria-hidden="true" />
            <span>Strict Zero-Secret Logging Policy</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Application logs record only operational metadata (timing, status codes, and anonymized
            correlation IDs). Full document contents, raw prompt texts, and API keys are strictly
            excluded from logs.
          </p>
        </div>
      </div>

      {/* Ephemeral Reset Action */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Reset Active Session
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Immediately purges the active document and analysis state from local application memory.
          </p>
        </div>

        <button
          onClick={onClearSession}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          <span>Clear Session Memory</span>
        </button>
      </div>
    </div>
  );
};
