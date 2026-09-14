import { EvidenceSpan } from '../findings/types';

export type ActionUrgency = 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ImmediateAction {
  id: string;
  action: string;
  deadlineDescription?: string;
  urgency: ActionUrgency;
  reason: string;
  relatedClauseId?: string;
  sourceSpan?: EvidenceSpan;
}

export interface InformationToGather {
  id: string;
  item: string;
  whyNeeded: string;
  relatedTopic: string;
}

export interface QuestionForLawyer {
  id: string;
  question: string;
  contextAndRisk: string;
  targetClauseId?: string;
  sourceSpan?: EvidenceSpan;
}

export interface ReviewPriority {
  id: string;
  priorityOrder: number;
  topic: string;
  suggestedFocus: string;
  potentialExposure: string;
}

export interface EscalationTrigger {
  id: string;
  triggerCategory:
    | 'COURT_DEADLINE'
    | 'EVICTION_HOUSING_LOSS'
    | 'CRIMINAL_ALLEGATIONS'
    | 'IMMIGRATION_STATUS'
    | 'DOMESTIC_SAFETY'
    | 'SEVERE_FINANCIAL_EXPOSURE'
    | 'EMPLOYMENT_TERMINATION'
    | 'REGULATORY_INVESTIGATION';
  title: string;
  description: string;
  recommendedNextStep: string;
  detectedInDocument: boolean;
  sourceSpan?: EvidenceSpan;
}

export interface ActionPlan {
  id: string;
  documentId: string;
  generatedAt: string;
  immediateActions: ImmediateAction[];
  informationToGather: InformationToGather[];
  questionsForLawyer: QuestionForLawyer[];
  reviewPriorities: ReviewPriority[];
  escalationTriggers: EscalationTrigger[];
}
