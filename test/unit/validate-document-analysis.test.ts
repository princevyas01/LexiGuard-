import { describe, it, expect } from 'vitest';
import { Document } from '@/domain/documents/types';
import { DeadlineItem, Obligation } from '@/domain/obligations/types';
import { validateObligationsAndDeadlines } from '@/application/claim-validation/validate-document-analysis';
import { segmentDocument } from '@/infrastructure/parsing/clause-segmenter';

describe('validateObligationsAndDeadlines (Obligation and Deadline Validation)', () => {
  const rawText = `LEASE AGREEMENT
1. RENT OBLIGATIONS
1.1 Tenant must pay rent by the 1st of each month.
1.2 Tenant must provide 30 days written notice prior to vacating.`;

  const { sections, clauses } = segmentDocument(rawText, 'doc-test-obl');
  const mockDoc: Document = {
    id: 'doc-test-obl',
    versionId: '1.0',
    metadata: {
      fileName: 'lease.txt',
      fileSizeBytes: rawText.length,
      mimeType: 'text/plain',
      pageCount: 1,
      characterCount: rawText.length,
      sha256Hash: 'hash',
      ingestedAt: new Date().toISOString(),
      isScannedOrLowText: false,
    },
    rawText,
    sections,
    clauses,
  };

  it('preserves valid obligation with verifiable source span', () => {
    const obligations: Obligation[] = [
      {
        id: 'obl-1',
        actor: 'Tenant',
        obligation: 'Tenant must pay rent by the 1st of each month.',
        trigger: 'Start of monthly rental period',
        deadline: '1st of each month',
        status: 'MANDATORY',
        sourceSpan: {
          documentId: 'doc-test-obl',
          versionId: '1.0',
          pageNumber: 1,
          sectionId: 'sec-1',
          clauseId: 'cl-1.1',
          sourceTextSpan: 'Tenant must pay rent by the 1st of each month.',
          exactQuotedText: 'Tenant must pay rent by the 1st of each month.',
          startOffset: 0,
          endOffset: 46,
          claimType: 'DOCUMENT_FACT',
          confidenceState: 'DIRECTLY_STATED',
          evidenceSufficiencyState: 'SUFFICIENT',
        },
      },
    ];

    const result = validateObligationsAndDeadlines(obligations, [], mockDoc);
    expect(result.obligations).toHaveLength(1);
    expect(result.obligations[0].obligation).toBe('Tenant must pay rent by the 1st of each month.');
  });

  it('drops obligation with fabricated quote or unverified source', () => {
    const obligations: Obligation[] = [
      {
        id: 'obl-fake',
        actor: 'Tenant',
        obligation: 'Tenant must pay Landlord private gas bill',
        trigger: 'Utility billing',
        deadline: 'Immediately',
        status: 'MANDATORY',
        sourceSpan: {
          documentId: 'doc-test-obl',
          versionId: '1.0',
          pageNumber: 1,
          sectionId: 'sec-1',
          clauseId: 'cl-1.1',
          sourceTextSpan: 'Non-existent text',
          exactQuotedText: 'Tenant must pay Landlord private gas bill',
          startOffset: 0,
          endOffset: 50,
          claimType: 'DOCUMENT_FACT',
          confidenceState: 'DIRECTLY_STATED',
          evidenceSufficiencyState: 'SUFFICIENT',
        },
      },
    ];

    const result = validateObligationsAndDeadlines(obligations, [], mockDoc);
    expect(result.obligations).toHaveLength(0);
  });

  it('drops deadline if dueDateOrPeriod does not occur in verified source text', () => {
    const deadlines: DeadlineItem[] = [
      {
        id: 'dl-fake-date',
        title: 'Notice Period',
        type: 'TERMINATION_NOTICE',
        actor: 'Tenant',
        consequencesOfMissing: 'Lease renews automatically',
        isCalendarDate: false,
        dueDateOrPeriod: '60 days', // Source actually says 30 days!
        sourceSpan: {
          documentId: 'doc-test-obl',
          versionId: '1.0',
          pageNumber: 1,
          sectionId: 'sec-1',
          clauseId: 'cl-1.2',
          sourceTextSpan: 'Tenant must provide 30 days written notice prior to vacating.',
          exactQuotedText: 'Tenant must provide 30 days written notice prior to vacating.',
          startOffset: 0,
          endOffset: 61,
          claimType: 'DOCUMENT_FACT',
          confidenceState: 'DIRECTLY_STATED',
          evidenceSufficiencyState: 'SUFFICIENT',
        },
      },
    ];

    const result = validateObligationsAndDeadlines([], deadlines, mockDoc);
    expect(result.deadlines).toHaveLength(0);
  });

  it('accepts deadline where dueDateOrPeriod occurs verbatim in verified source text', () => {
    const deadlines: DeadlineItem[] = [
      {
        id: 'dl-valid',
        title: 'Notice Period',
        type: 'TERMINATION_NOTICE',
        actor: 'Tenant',
        consequencesOfMissing: 'Lease renews automatically',
        isCalendarDate: false,
        dueDateOrPeriod: '30 days',
        sourceSpan: {
          documentId: 'doc-test-obl',
          versionId: '1.0',
          pageNumber: 1,
          sectionId: 'sec-1',
          clauseId: 'cl-1.2',
          sourceTextSpan: 'Tenant must provide 30 days written notice prior to vacating.',
          exactQuotedText: 'Tenant must provide 30 days written notice prior to vacating.',
          startOffset: 0,
          endOffset: 61,
          claimType: 'DOCUMENT_FACT',
          confidenceState: 'DIRECTLY_STATED',
          evidenceSufficiencyState: 'SUFFICIENT',
        },
      },
    ];

    const result = validateObligationsAndDeadlines([], deadlines, mockDoc);
    expect(result.deadlines).toHaveLength(1);
    expect(result.deadlines[0].dueDateOrPeriod).toBe('30 days');
  });

  it('drops items with stale versionId', () => {
    const obligations: Obligation[] = [
      {
        id: 'obl-stale-version',
        actor: 'Tenant',
        obligation: 'Tenant must pay rent by the 1st of each month.',
        trigger: 'Start of monthly rental period',
        deadline: '1st of each month',
        status: 'MANDATORY',
        sourceSpan: {
          documentId: 'doc-test-obl',
          versionId: '2.0', // Document has versionId '1.0'
          pageNumber: 1,
          sectionId: 'sec-1',
          clauseId: 'cl-1.1',
          sourceTextSpan: 'Tenant must pay rent by the 1st of each month.',
          exactQuotedText: 'Tenant must pay rent by the 1st of each month.',
          startOffset: 0,
          endOffset: 46,
          claimType: 'DOCUMENT_FACT',
          confidenceState: 'DIRECTLY_STATED',
          evidenceSufficiencyState: 'SUFFICIENT',
        },
      },
    ];

    const result = validateObligationsAndDeadlines(obligations, [], mockDoc);
    expect(result.obligations).toHaveLength(0);
  });
});
