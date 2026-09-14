import React, { useState } from 'react';
import { CheckSquare, Printer, HelpCircle, FileText } from 'lucide-react';
import type { ActionPlan } from '@/domain/action-plan/types';

interface ActionPlanViewProps {
  actionPlan: ActionPlan;
}

export const ActionPlanView: React.FC<ActionPlanViewProps> = ({ actionPlan }) => {
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});

  const toggleAction = (id: string) => {
    setCompletedActions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="space-y-10 print:m-0 print:p-0"
      aria-label="Action Navigator and Lawyer Preparation"
    >
      {/* Header and Print Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Action Navigator & Lawyer Consultation Sheet
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Practical checklist, records to gather, and structured questions for your legal
            consultation.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-800 dark:text-slate-200 font-semibold text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 print:hidden"
        >
          <Printer className="w-4 h-4" aria-hidden="true" />
          <span>Print / Export Preparation Sheet</span>
        </button>
      </div>

      {/* 1. Immediate Actions Checklist */}
      <section className="space-y-4" aria-labelledby="immediate-actions-heading">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-blue-600" aria-hidden="true" />
          <h3
            id="immediate-actions-heading"
            className="text-base font-bold text-slate-900 dark:text-white"
          >
            Immediate Actions Required by Document
          </h3>
        </div>

        <div className="space-y-2.5">
          {actionPlan.immediateActions.map((act) => {
            const isChecked = !!completedActions[act.id];

            return (
              <div
                key={act.id}
                className={`p-4 rounded-xl border transition-colors flex items-start gap-3.5 ${
                  isChecked
                    ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-70'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                }`}
              >
                <input
                  type="checkbox"
                  id={`action-${act.id}`}
                  checked={isChecked}
                  onChange={() => toggleAction(act.id)}
                  aria-label={act.action}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />

                <div className="space-y-1 flex-1 text-xs">
                  <label
                    htmlFor={`action-${act.id}`}
                    className={`font-bold cursor-pointer ${
                      isChecked ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {act.action}
                  </label>

                  {act.deadlineDescription && (
                    <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      Target Window: {act.deadlineDescription}
                    </p>
                  )}

                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    <strong>Reason:</strong> {act.reason}
                  </p>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    act.urgency === 'IMMEDIATE'
                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {act.urgency}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Questions to Ask a Lawyer */}
      <section className="space-y-4" aria-labelledby="lawyer-questions-heading">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-amber-600" aria-hidden="true" />
          <h3
            id="lawyer-questions-heading"
            className="text-base font-bold text-slate-900 dark:text-white"
          >
            Targeted Questions for Legal Counsel
          </h3>
        </div>

        <div className="space-y-3">
          {actionPlan.questionsForLawyer.map((q, idx) => (
            <div
              key={q.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1.5"
            >
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                  &ldquo;{q.question}&rdquo;
                </p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 pl-7 leading-relaxed">
                <strong>Legal Context / Underlying Risk:</strong> {q.contextAndRisk}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Information to Gather */}
      <section className="space-y-4" aria-labelledby="gather-heading">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" aria-hidden="true" />
          <h3 id="gather-heading" className="text-base font-bold text-slate-900 dark:text-white">
            Information & Documents to Gather Before Consultation
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {actionPlan.informationToGather.map((info) => (
            <div
              key={info.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {info.relatedTopic}
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">{info.item}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <strong>Why needed:</strong> {info.whyNeeded}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
