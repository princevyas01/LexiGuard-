import { Document } from '@/domain/documents/types';
import { Obligation, DeadlineItem } from '@/domain/obligations/types';
import { EvidenceVerifier } from '@/infrastructure/evidence/verifier';

/**
 * Validates model-extracted obligations and deadlines against source evidence.
 * Drops any obligations or deadlines whose source spans cannot be verified.
 * For deadlines, additionally enforces that the dueDateOrPeriod text occurs in the verified source.
 */
export function validateObligationsAndDeadlines(
  obligations: Obligation[],
  deadlines: DeadlineItem[],
  document: Document,
  verifier?: EvidenceVerifier
): { obligations: Obligation[]; deadlines: DeadlineItem[] } {
  const activeVerifier = verifier ?? new EvidenceVerifier(document);

  const validObligations = obligations.flatMap((item) => {
    const check = activeVerifier.verifySpan(item.sourceSpan);
    return check.isValid ? [{ ...item, sourceSpan: check.resolvedSpan }] : [];
  });

  const validDeadlines = deadlines.flatMap((item) => {
    const check = activeVerifier.verifySpan(item.sourceSpan);
    if (!check.isValid) return [];
    const source = check.resolvedSpan.sourceTextSpan;
    const dueText = item.dueDateOrPeriod.trim();
    if (!dueText || !source.includes(dueText)) return [];
    return [{ ...item, sourceSpan: check.resolvedSpan }];
  });

  return { obligations: validObligations, deadlines: validDeadlines };
}
