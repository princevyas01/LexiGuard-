export type ClaimType =
  | 'DOCUMENT_FACT'
  | 'DERIVED_INTERPRETATION'
  | 'GENERAL_INFORMATION'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONFLICTING_EVIDENCE';

export type ConfidenceStatus = 'DIRECTLY_STATED' | 'STRONGLY_IMPLIED' | 'AMBIGUOUS' | 'NOT_FOUND';

export type EvidenceSufficiencyState = 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT';

export interface EvidenceSpan {
  documentId: string;
  versionId: string;
  pageNumber: number | null;
  sectionId: string;
  clauseId: string;
  sourceTextSpan: string;
  exactQuotedText: string;
  startOffset: number;
  endOffset: number;
  claimType: ClaimType;
  confidenceState: ConfidenceStatus;
  evidenceSufficiencyState: EvidenceSufficiencyState;
}

export type RiskSeverity = 'HIGH_ATTENTION' | 'REVIEW_SOON' | 'LOW_CONCERN' | 'INFORMATIONAL';

export type RiskCategory =
  | 'FINANCIAL_EXPOSURE'
  | 'TERMINATION_RENEWAL'
  | 'LIABILITY'
  | 'INDEMNITY'
  | 'PENALTIES_FEES'
  | 'DEADLINES_NOTICE_WINDOWS'
  | 'AUTO_RENEWAL'
  | 'EXCLUSIVITY'
  | 'CONFIDENTIALITY'
  | 'INTELLECTUAL_PROPERTY'
  | 'DATA_PRIVACY'
  | 'DISPUTE_RESOLUTION'
  | 'GOVERNING_LAW_JURISDICTION'
  | 'NON_COMPETE_RESTRICTIVE'
  | 'UNILATERAL_MODIFICATION'
  | 'AMBIGUOUS_LANGUAGE'
  | 'INTERNAL_INCONSISTENCY'
  | 'MISSING_EXPECTED_TERMS';

export interface AnalysisFinding {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  plainLanguageSummary: string;
  whyItMatters: string;
  sourceSpans: EvidenceSpan[];
  affectedParty: string;
  recommendedQuestion: string;
  confidence: ConfidenceStatus;
  isVerified: boolean;
  policyReason?: string;
}
