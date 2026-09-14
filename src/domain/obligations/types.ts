import { EvidenceSpan } from '../findings/types';

export type ObligationStatus = 'MANDATORY' | 'CONDITIONAL' | 'RECURRING' | 'DISCRETIONARY';

export interface Obligation {
  id: string;
  actor: string;
  obligation: string;
  trigger: string;
  deadline: string;
  exceptions?: string;
  status: ObligationStatus;
  sourceSpan: EvidenceSpan;
}

export type DeadlineType =
  | 'NOTICE_PERIOD'
  | 'PAYMENT_DUE_DATE'
  | 'RENEWAL_DEADLINE'
  | 'TERMINATION_NOTICE'
  | 'CURE_PERIOD'
  | 'CONTRACT_END_DATE'
  | 'RESPONSE_DEADLINE'
  | 'OTHER';

export interface DeadlineItem {
  id: string;
  title: string;
  dueDateOrPeriod: string;
  type: DeadlineType;
  actor: string;
  consequencesOfMissing: string;
  isCalendarDate: boolean;
  sourceSpan: EvidenceSpan;
}
