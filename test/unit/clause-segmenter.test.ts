import { describe, it, expect } from 'vitest';
import { segmentDocument } from '@/infrastructure/parsing/clause-segmenter';

describe('Legal Clause & Section Segmenter', () => {
  const sampleContract = `RESIDENTIAL LEASE AGREEMENT

1. PREMISES AND TERM
1.1 Premises: Landlord leases to Tenant the apartment located at 404 Elm St.
1.2 Term: The lease shall commence on Feb 1, 2025.
1.3 Automatic Renewal: This agreement automatically renews unless cancelled 15 days prior.

2. RENT AND PAYMENTS
2.1 Monthly Rent: Tenant shall pay $2,400 monthly.
2.2 Late Fee: Tenant shall pay $250 penalty if late.`;

  it('correctly extracts numbered sections and preserves titles', () => {
    const { sections } = segmentDocument(sampleContract, 'test-doc');
    expect(sections.length).toBe(2);
    expect(sections[0].title).toBe('PREMISES AND TERM');
    expect(sections[1].title).toBe('RENT AND PAYMENTS');
  });

  it('correctly segments sub-clauses with clause numbers', () => {
    const { clauses } = segmentDocument(sampleContract, 'test-doc');
    expect(clauses.length).toBe(5);
    expect(clauses[0].clauseNumber).toBe('1.1');
    expect(clauses[2].clauseNumber).toBe('1.3');
    expect(clauses[4].clauseNumber).toBe('2.2');
  });

  it('preserves exact character offsets matching original raw text', () => {
    const { clauses } = segmentDocument(sampleContract, 'test-doc');
    for (const clause of clauses) {
      const slice = sampleContract.slice(clause.span.start, clause.span.end);
      expect(slice).toBe(clause.span.text);
      expect(clause.text).toContain(clause.title);
    }
  });

  it('falls back safely for unformatted legal text without crashing', () => {
    const unformatted =
      'This is a simple contract without section numbers.\n\nSecond paragraph here.';
    const { sections, clauses } = segmentDocument(unformatted, 'simple-doc');
    expect(sections.length).toBe(1);
    expect(clauses.length).toBe(2);
  });
});
