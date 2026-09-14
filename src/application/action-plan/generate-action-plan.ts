import { Document } from '@/domain/documents/types';
import { ActionPlan, EscalationTrigger } from '@/domain/action-plan/types';
import { EvidenceSpan } from '@/domain/findings/types';
import { DocumentAnalysisResult } from '../analysis/analyze-document';

interface VerifiedEvidence {
  sourceSpan: EvidenceSpan;
  sourceText: string;
}

function collectVerifiedEvidence(analysis: DocumentAnalysisResult): VerifiedEvidence[] {
  const entries: VerifiedEvidence[] = [];

  for (const finding of analysis.findings) {
    if (!finding.isVerified) continue;
    for (const span of finding.sourceSpans) {
      entries.push({
        sourceSpan: span,
        sourceText: span.sourceTextSpan.toLowerCase(),
      });
    }
  }

  for (const deadline of analysis.deadlines) {
    if (!deadline.sourceSpan?.evidenceSufficiencyState) continue;
    entries.push({
      sourceSpan: deadline.sourceSpan,
      sourceText: deadline.sourceSpan.sourceTextSpan.toLowerCase(),
    });
  }

  for (const obligation of analysis.obligations) {
    if (!obligation.sourceSpan?.evidenceSufficiencyState) continue;
    entries.push({
      sourceSpan: obligation.sourceSpan,
      sourceText: obligation.sourceSpan.sourceTextSpan.toLowerCase(),
    });
  }

  return entries;
}

function findEvidence(
  evidence: VerifiedEvidence[],
  predicate: (sourceText: string) => boolean
): EvidenceSpan | undefined {
  return evidence.find((item) => predicate(item.sourceText))?.sourceSpan;
}

function detectEscalationTriggers(analysis: DocumentAnalysisResult): EscalationTrigger[] {
  const evidence = collectVerifiedEvidence(analysis);
  const triggers: EscalationTrigger[] = [];

  const evictionSpan = findEvidence(evidence, (text) =>
    /(vacate|eviction|unlawful detainer|surrender possession)/i.test(text)
  );
  if (evictionSpan) {
    triggers.push({
      id: 'esc-eviction',
      triggerCategory: 'EVICTION_HOUSING_LOSS',
      title: 'Housing Loss or Eviction Proceeding Detected',
      description:
        'A verified source clause contains a demand involving vacating, eviction, unlawful detainer, or surrender of possession.',
      recommendedNextStep:
        'Consult a qualified local tenant attorney or housing legal aid service immediately.',
      detectedInDocument: true,
      sourceSpan: evictionSpan,
    });
  }

  const courtSpan = findEvidence(
    evidence,
    (text) =>
      /(court|hearing|unlawful detainer)/i.test(text) &&
      /(within|hours|days|deadline|must|shall|notice|file|proceeding)/i.test(text)
  );
  if (courtSpan) {
    triggers.push({
      id: 'esc-court',
      triggerCategory: 'COURT_DEADLINE',
      title: 'Potentially Imminent Legal Deadline or Court Proceeding',
      description:
        'A verified clause contains judicial or hearing language together with a procedural deadline or mandatory action.',
      recommendedNextStep:
        'Review the exact source deadline and seek qualified legal representation or legal aid promptly.',
      detectedInDocument: true,
      sourceSpan: courtSpan,
    });
  }

  const financialSpan = findEvidence(evidence, (text) =>
    /(unlimited liability|uncapped liability|indemnify|consequential damages)/i.test(text)
  );
  if (financialSpan) {
    triggers.push({
      id: 'esc-financial',
      triggerCategory: 'SEVERE_FINANCIAL_EXPOSURE',
      title: 'Potentially Severe Financial Exposure Detected',
      description:
        'A verified source clause contains uncapped liability or unusually broad indemnity/damages language.',
      recommendedNextStep:
        'Have qualified commercial counsel review the allocation of liability before signing or accepting the agreement.',
      detectedInDocument: true,
      sourceSpan: financialSpan,
    });
  }

  return triggers;
}

function buildReviewPriorities(analysis: DocumentAnalysisResult) {
  return analysis.findings
    .filter((finding) => finding.isVerified && finding.sourceSpans.length > 0)
    .sort((a, b) => {
      const rank = {
        HIGH_ATTENTION: 0,
        REVIEW_SOON: 1,
        LOW_CONCERN: 2,
        INFORMATIONAL: 3,
      } as const;
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 5)
    .map((finding, index) => ({
      id: `prio-${index + 1}`,
      priorityOrder: index + 1,
      topic: finding.category,
      suggestedFocus: finding.plainLanguageSummary,
      potentialExposure: finding.whyItMatters,
    }));
}

export function generateActionPlan(
  document: Document,
  analysis: DocumentAnalysisResult
): ActionPlan {
  const escalationTriggers = detectEscalationTriggers(analysis);

  const immediateActions = analysis.deadlines.map((deadline, index) => ({
    id: `act-imm-${index + 1}`,
    action: `Comply with deadline: ${deadline.title}`,
    deadlineDescription: deadline.dueDateOrPeriod,
    urgency:
      deadline.type === 'RENEWAL_DEADLINE' || deadline.type === 'TERMINATION_NOTICE'
        ? ('IMMEDIATE' as const)
        : ('HIGH' as const),
    reason: deadline.consequencesOfMissing,
    sourceSpan: deadline.sourceSpan,
  }));

  const verifiedFindings = analysis.findings.filter(
    (finding) => finding.isVerified && finding.sourceSpans.length > 0
  );

  const questionsForLawyer = verifiedFindings.map((finding, index) => ({
    id: `q-lawyer-${index + 1}`,
    question: finding.recommendedQuestion,
    contextAndRisk: finding.whyItMatters,
    targetClauseId: finding.sourceSpans[0].clauseId,
    sourceSpan: finding.sourceSpans[0],
  }));

  return {
    id: `plan-${document.id}`,
    documentId: document.id,
    generatedAt: new Date().toISOString(),
    immediateActions,
    informationToGather: [
      {
        id: 'info-1',
        item: 'Payment receipts and bank confirmation records',
        whyNeeded: 'Useful evidence for payment timing and fee disputes.',
        relatedTopic: 'Billing and Payments',
      },
      {
        id: 'info-2',
        item: 'Prior correspondence and amendment notices',
        whyNeeded: 'Useful evidence for changes, notices, and communications.',
        relatedTopic: 'Notices and Modifications',
      },
    ],
    questionsForLawyer,
    reviewPriorities: buildReviewPriorities(analysis),
    escalationTriggers,
  };
}
