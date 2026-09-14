import { Clause } from '../documents/types';
import { EvidenceSpan } from '../findings/types';

export type ClauseChangeType =
  | 'UNCHANGED'
  | 'ADDED'
  | 'REMOVED'
  | 'MODIFIED'
  | 'MOVED'
  | 'AMBIGUOUS';

export type MaterialityClassification =
  | 'MATERIAL_MEANING_CHANGE'
  | 'NEW_OBLIGATION'
  | 'REMOVED_PROTECTION'
  | 'CHANGED_DEADLINE'
  | 'CHANGED_FINANCIAL_TERM'
  | 'CHANGED_LIABILITY_ALLOCATION'
  | 'CHANGED_DISPUTE_MECHANISM'
  | 'CHANGED_RENEWAL_TERMINATION'
  | 'REWORDED_NON_MATERIAL';

export type DifferenceSeverity = 'HIGH_ATTENTION' | 'REVIEW_SOON' | 'LOW_CONCERN' | 'INFORMATIONAL';

export interface ComparisonFinding {
  id: string;
  clauseTopic: string;
  changeType: ClauseChangeType;
  materiality: MaterialityClassification;
  severity: DifferenceSeverity;
  versionAClause?: Clause;
  versionBClause?: Clause;
  originalText?: string;
  revisedText?: string;
  plainLanguageExplanation: string;
  commercialImpact: string;
  sourceSpans: EvidenceSpan[];
}

export interface DocumentComparisonResult {
  id: string;
  docAId: string;
  docBId: string;
  docATitle: string;
  docBTitle: string;
  summary: string;
  findings: ComparisonFinding[];
  unchangedCount: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
}
