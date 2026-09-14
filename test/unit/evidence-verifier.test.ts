import { describe, it, expect } from 'vitest';
import { Document } from '@/domain/documents/types';
import { EvidenceVerifier } from '@/infrastructure/evidence/verifier';
import { segmentDocument } from '@/infrastructure/parsing/clause-segmenter';

describe('Evidence Verification Engine (Fail-Closed Hallucination Defense)', () => {
  const rawText = `CONFIDENTIALITY AGREEMENT

1. DEFINITION
1.1 Confidential Information: Recipient shall protect all proprietary information.

2. PENALTIES
2.1 Breach Damages: Recipient agrees to pay liquidated damages of $50,000 upon any willful breach.

3. REPEATED TERMS
3.1 Repeated Clause: Recipient shall protect all proprietary information.`;

  const { sections, clauses } = segmentDocument(rawText, 'doc-test-1');
  const mockDoc: Document = {
    id: 'doc-test-1',
    versionId: '1.0',
    metadata: {
      fileName: 'test.txt',
      fileSizeBytes: rawText.length,
      mimeType: 'text/plain',
      pageCount: 1,
      characterCount: rawText.length,
      sha256Hash: 'dummy-hash',
      ingestedAt: new Date().toISOString(),
      isScannedOrLowText: false,
    },
    rawText,
    sections,
    clauses,
  };

  const verifier = new EvidenceVerifier(mockDoc);

  it('validates verbatim quoted excerpt and identifies exact clause and offsets', () => {
    const result = verifier.verifySpan({
      exactQuotedText: 'liquidated damages of $50,000',
    });

    expect(result.isValid).toBe(true);
    expect(result.resolvedSpan.claimType).toBe('DOCUMENT_FACT');
    expect(result.resolvedSpan.confidenceState).toBe('DIRECTLY_STATED');
    expect(result.resolvedSpan.startOffset).toBeGreaterThan(0);
    expect(result.resolvedSpan.sourceTextSpan).toContain('liquidated damages of $50,000');
    expect(result.resolvedSpan.documentId).toBe('doc-test-1');
    expect(result.resolvedSpan.versionId).toBe('1.0');
  });

  it('validates valid offset-based match where quote is inside slice', () => {
    const quote = 'liquidated damages of $50,000';
    const start = rawText.indexOf(quote);
    const end = start + quote.length + 10;

    const result = verifier.verifySpan({
      exactQuotedText: quote,
      startOffset: start,
      endOffset: end,
    });

    expect(result.isValid).toBe(true);
    expect(result.resolvedSpan.startOffset).toBe(start);
  });

  it('rejects stale documentId', () => {
    const result = verifier.verifySpan({
      documentId: 'different-doc-999',
      exactQuotedText: 'liquidated damages of $50,000',
    });

    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain('documentId does not match');
  });

  it('rejects stale versionId', () => {
    const result = verifier.verifySpan({
      versionId: '2.0',
      exactQuotedText: 'liquidated damages of $50,000',
    });

    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain('versionId does not match');
  });

  it('rejects out-of-range or negative offsets safely', () => {
    const result = verifier.verifySpan({
      exactQuotedText: 'liquidated damages of $50,000',
      startOffset: -5,
      endOffset: 50,
    });

    // Should fall back to exact search, but if offsets invalid, exact search still resolves correct offsets
    expect(result.isValid).toBe(true);
    expect(result.resolvedSpan.startOffset).toBeGreaterThanOrEqual(0);
  });

  it('rejects empty or missing quote requests safely', () => {
    const result = verifier.verifySpan({
      exactQuotedText: '',
    });

    expect(result.isValid).toBe(false);
    expect(result.resolvedSpan.claimType).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.rejectionReason).toContain('empty or missing');
  });

  it('rejects fabricated superset quote attack (where quote is larger than source slice)', () => {
    // Attack: Model provides slice offsets [100, 120] which is "liquidated damages",
    // but provides a fabricated candidate quote: "liquidated damages of $5,000,000 and forfeiture of home"
    // The previous bug `quote.includes(slicedText)` accepted this!
    const sliceStart = rawText.indexOf('liquidated damages');
    const sliceEnd = sliceStart + 'liquidated damages'.length;

    const fabricatedSupersetQuote = 'liquidated damages of $5,000,000 and forfeiture of home';

    const result = verifier.verifySpan({
      exactQuotedText: fabricatedSupersetQuote,
      startOffset: sliceStart,
      endOffset: sliceEnd,
    });

    expect(result.isValid).toBe(false);
    expect(result.resolvedSpan.claimType).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('rejects quote with fabricated prefix or suffix not present in document', () => {
    const result = verifier.verifySpan({
      exactQuotedText: 'UNAUTHORIZED_PREFIX liquidated damages of $50,000',
    });

    expect(result.isValid).toBe(false);
    expect(result.resolvedSpan.claimType).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('rejects ambiguous normalized quote that appears in multiple clauses', () => {
    // "Recipient shall protect all proprietary information." appears in clause 1.1 and clause 3.1
    const ambiguousQuote = 'recipient   shall   protect   all   proprietary   information.';
    const result = verifier.verifySpan({
      exactQuotedText: ambiguousQuote,
    });

    // Since it appears in 2 clauses and isn't an exact match (different spaces), ambiguous normalization must reject
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain('not found unambiguously');
  });

  it('rejects completely fabricated or hallucinated quotes not found in document', () => {
    const result = verifier.verifySpan({
      exactQuotedText: 'Tenant shall surrender all intellectual property rights immediately',
    });

    expect(result.isValid).toBe(false);
    expect(result.resolvedSpan.claimType).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.resolvedSpan.confidenceState).toBe('NOT_FOUND');
  });
});
