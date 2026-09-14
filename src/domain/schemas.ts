import { z } from 'zod';

export const ClaimTypeSchema = z.enum([
  'DOCUMENT_FACT',
  'DERIVED_INTERPRETATION',
  'GENERAL_INFORMATION',
  'INSUFFICIENT_EVIDENCE',
  'CONFLICTING_EVIDENCE',
]);

export const ConfidenceStatusSchema = z.enum([
  'DIRECTLY_STATED',
  'STRONGLY_IMPLIED',
  'AMBIGUOUS',
  'NOT_FOUND',
]);

export const EvidenceSufficiencyStateSchema = z.enum(['SUFFICIENT', 'PARTIAL', 'INSUFFICIENT']);

export const EvidenceSpanSchema = z.object({
  documentId: z.string().min(1),
  versionId: z.string().min(1),
  pageNumber: z.number().nullable(),
  sectionId: z.string().min(1),
  clauseId: z.string().min(1),
  sourceTextSpan: z.string().min(1),
  exactQuotedText: z.string(),
  startOffset: z.number().nonnegative(),
  endOffset: z.number().nonnegative(),
  claimType: ClaimTypeSchema,
  confidenceState: ConfidenceStatusSchema,
  evidenceSufficiencyState: EvidenceSufficiencyStateSchema,
});

export const RiskSeveritySchema = z.enum([
  'HIGH_ATTENTION',
  'REVIEW_SOON',
  'LOW_CONCERN',
  'INFORMATIONAL',
]);

export const RiskCategorySchema = z.enum([
  'FINANCIAL_EXPOSURE',
  'TERMINATION_RENEWAL',
  'LIABILITY',
  'INDEMNITY',
  'PENALTIES_FEES',
  'DEADLINES_NOTICE_WINDOWS',
  'AUTO_RENEWAL',
  'EXCLUSIVITY',
  'CONFIDENTIALITY',
  'INTELLECTUAL_PROPERTY',
  'DATA_PRIVACY',
  'DISPUTE_RESOLUTION',
  'GOVERNING_LAW_JURISDICTION',
  'NON_COMPETE_RESTRICTIVE',
  'UNILATERAL_MODIFICATION',
  'AMBIGUOUS_LANGUAGE',
  'INTERNAL_INCONSISTENCY',
  'MISSING_EXPECTED_TERMS',
]);

export const AnalysisFindingSchema = z.object({
  id: z.string().min(1),
  category: RiskCategorySchema,
  severity: RiskSeveritySchema,
  title: z.string().min(1),
  plainLanguageSummary: z.string().min(1),
  whyItMatters: z.string().min(1),
  sourceSpans: z.array(EvidenceSpanSchema),
  affectedParty: z.string().min(1),
  recommendedQuestion: z.string().min(1),
  confidence: ConfidenceStatusSchema,
  isVerified: z.boolean(),
  policyReason: z.string().optional(),
});

export const ObligationStatusSchema = z.enum([
  'MANDATORY',
  'CONDITIONAL',
  'RECURRING',
  'DISCRETIONARY',
]);

export const ObligationSchema = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  obligation: z.string().min(1),
  trigger: z.string().min(1),
  deadline: z.string().min(1),
  exceptions: z.string().optional(),
  status: ObligationStatusSchema,
  sourceSpan: EvidenceSpanSchema,
});

export const DeadlineTypeSchema = z.enum([
  'NOTICE_PERIOD',
  'PAYMENT_DUE_DATE',
  'RENEWAL_DEADLINE',
  'TERMINATION_NOTICE',
  'CURE_PERIOD',
  'CONTRACT_END_DATE',
  'RESPONSE_DEADLINE',
  'OTHER',
]);

export const DeadlineItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  dueDateOrPeriod: z.string().min(1),
  type: DeadlineTypeSchema,
  actor: z.string().min(1),
  consequencesOfMissing: z.string().min(1),
  isCalendarDate: z.boolean(),
  sourceSpan: EvidenceSpanSchema,
});

export const ClauseChangeTypeSchema = z.enum([
  'UNCHANGED',
  'ADDED',
  'REMOVED',
  'MODIFIED',
  'MOVED',
  'AMBIGUOUS',
]);

export const MaterialityClassificationSchema = z.enum([
  'MATERIAL_MEANING_CHANGE',
  'NEW_OBLIGATION',
  'REMOVED_PROTECTION',
  'CHANGED_DEADLINE',
  'CHANGED_FINANCIAL_TERM',
  'CHANGED_LIABILITY_ALLOCATION',
  'CHANGED_DISPUTE_MECHANISM',
  'CHANGED_RENEWAL_TERMINATION',
  'REWORDED_NON_MATERIAL',
]);

export const ComparisonFindingSchema = z.object({
  id: z.string().min(1),
  clauseTopic: z.string().min(1),
  changeType: ClauseChangeTypeSchema,
  materiality: MaterialityClassificationSchema,
  severity: RiskSeveritySchema,
  originalText: z.string().optional(),
  revisedText: z.string().optional(),
  plainLanguageExplanation: z.string().min(1),
  commercialImpact: z.string().min(1),
  sourceSpans: z.array(EvidenceSpanSchema),
});

export const ActionUrgencySchema = z.enum(['IMMEDIATE', 'HIGH', 'MEDIUM', 'LOW']);

export const ImmediateActionSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  deadlineDescription: z.string().optional(),
  urgency: ActionUrgencySchema,
  reason: z.string().min(1),
  relatedClauseId: z.string().optional(),
  sourceSpan: EvidenceSpanSchema.optional(),
});

export const InformationToGatherSchema = z.object({
  id: z.string().min(1),
  item: z.string().min(1),
  whyNeeded: z.string().min(1),
  relatedTopic: z.string().min(1),
});

export const QuestionForLawyerSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  contextAndRisk: z.string().min(1),
  targetClauseId: z.string().optional(),
  sourceSpan: EvidenceSpanSchema.optional(),
});

export const ReviewPrioritySchema = z.object({
  id: z.string().min(1),
  priorityOrder: z.number().int().positive(),
  topic: z.string().min(1),
  suggestedFocus: z.string().min(1),
  potentialExposure: z.string().min(1),
});

export const EscalationTriggerSchema = z.object({
  id: z.string().min(1),
  triggerCategory: z.enum([
    'COURT_DEADLINE',
    'EVICTION_HOUSING_LOSS',
    'CRIMINAL_ALLEGATIONS',
    'IMMIGRATION_STATUS',
    'DOMESTIC_SAFETY',
    'SEVERE_FINANCIAL_EXPOSURE',
    'EMPLOYMENT_TERMINATION',
    'REGULATORY_INVESTIGATION',
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  recommendedNextStep: z.string().min(1),
  detectedInDocument: z.boolean(),
  sourceSpan: EvidenceSpanSchema.optional(),
});

export const ActionPlanSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  generatedAt: z.string().min(1),
  immediateActions: z.array(ImmediateActionSchema),
  informationToGather: z.array(InformationToGatherSchema),
  questionsForLawyer: z.array(QuestionForLawyerSchema),
  reviewPriorities: z.array(ReviewPrioritySchema),
  escalationTriggers: z.array(EscalationTriggerSchema),
});

export const AskResponseSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  claimType: ClaimTypeSchema,
  confidence: ConfidenceStatusSchema,
  isEvidenceSufficient: z.boolean(),
  supportingSpans: z.array(EvidenceSpanSchema),
  legalBoundaryDisclaimer: z.string(),
  suggestedQuestions: z.array(z.string()),
});
