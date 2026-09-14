import React, { useState, useRef } from 'react';
import { Upload, FileCheck, AlertCircle, Sparkles, ShieldAlert } from 'lucide-react';
import { Document } from '@/domain/documents/types';

interface DocumentUploaderProps {
  onDocumentLoaded: (doc: Document) => void;
  onCompareRequested: () => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onDocumentLoaded,
  onCompareRequested,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>('Ready to upload document.');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setErrorMessage(null);
    setAnnouncement(`Uploading and validating ${file.name}...`);

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File exceeds 5 MB limit. Please select a smaller document.');
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload document.');
      }

      setAnnouncement(`Document ${file.name} successfully parsed and verified.`);
      onDocumentLoaded(data.document);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setErrorMessage(msg);
      setAnnouncement(`Upload error: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSampleSelect = async (sampleKey: string, sampleLabel: string) => {
    setIsUploading(true);
    setErrorMessage(null);
    setAnnouncement(`Loading sample fixture: ${sampleLabel}...`);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleName: sampleKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load sample fixture.');
      }

      setAnnouncement(`Loaded sample: ${sampleLabel}`);
      onDocumentLoaded(data.document);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load sample.';
      setErrorMessage(msg);
      setAnnouncement(`Error: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="space-y-8" aria-labelledby="uploader-heading">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h1
          id="uploader-heading"
          className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight"
        >
          Evidence-First Legal Document Intelligence
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          Upload any contract (PDF, DOCX, TXT) or load a synthetic test fixture to extract
          obligations, verify risk claims against exact text excerpts, and generate a lawyer
          consultation action plan.
        </p>
      </div>

      {/* Live Region for Screen Readers */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Upload Drag & Drop Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Upload legal document file input area. Maximum size 5 megabytes."
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
          isUploading
            ? 'bg-blue-50/50 border-blue-400 dark:bg-blue-950/20'
            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
          }}
        />

        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-full">
            <Upload className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <span className="font-semibold text-slate-900 dark:text-white text-sm">
              Click to choose a file or drag and drop
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports text-based PDF, DOCX, or TXT (Max 5 MB, up to 50 pages)
            </p>
          </div>
          {isUploading && (
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 animate-pulse">
              Parsing and verifying document...
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="font-semibold">Validation Error</p>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Pre-packaged Evaluator Synthetic Fixtures */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-slate-50 dark:bg-slate-950/40 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Evaluator Demo Fixtures (1-Click Offline Analysis)
            </h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Zero API Keys Required
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Select any pre-configured synthetic agreement to evaluate deterministic parsing, risk
          detection, grounded Q&A, and emergency escalations.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          <button
            onClick={() => handleSampleSelect('residential-lease', 'Residential Lease')}
            disabled={isUploading}
            className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 text-xs space-y-1"
          >
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <FileCheck className="w-4 h-4 text-blue-600" aria-hidden="true" />
              Residential Lease
            </div>
            <p className="text-slate-500 text-[11px]">
              Tests 15-day auto-renewal, late penalty fees, and landlord entry rights.
            </p>
          </button>

          <button
            onClick={() => handleSampleSelect('saas-agreement', 'Enterprise SaaS MSA')}
            disabled={isUploading}
            className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 text-xs space-y-1"
          >
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <FileCheck className="w-4 h-4 text-blue-600" aria-hidden="true" />
              B2B SaaS Agreement
            </div>
            <p className="text-slate-500 text-[11px]">
              Tests asymmetric liability, unilateral price increases, and AI data training rights.
            </p>
          </button>

          <button
            onClick={() => handleSampleSelect('urgent-notice', 'Urgent Notice to Vacate')}
            disabled={isUploading}
            className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-red-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 text-xs space-y-1"
          >
            <div className="flex items-center gap-2 font-semibold text-red-600 dark:text-red-400">
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              Notice to Vacate (Escalation)
            </div>
            <p className="text-slate-500 text-[11px]">
              Triggers emergency legal safety escalation for 72-hour eviction proceedings.
            </p>
          </button>

          <button
            onClick={() => handleSampleSelect('adversarial-contract', 'Trojan Injection Agreement')}
            disabled={isUploading}
            className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 text-xs space-y-1"
          >
            <div className="flex items-center gap-2 font-semibold text-purple-600 dark:text-purple-400">
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              Adversarial Prompt Injection
            </div>
            <p className="text-slate-500 text-[11px]">
              Tests defense against jailbreak instructions, prompt leakage, and hidden scripts.
            </p>
          </button>

          <button
            onClick={onCompareRequested}
            disabled={isUploading}
            className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 text-xs space-y-1"
          >
            <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
              <FileCheck className="w-4 h-4" aria-hidden="true" />
              Compare NDA v1 vs v2
            </div>
            <p className="text-slate-500 text-[11px]">
              Demonstrates clause-level comparison, new non-compete, and deleted indemnity.
            </p>
          </button>
        </div>
      </div>
    </section>
  );
};
