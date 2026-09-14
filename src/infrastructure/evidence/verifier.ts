import { Document } from '@/domain/documents/types';
import { EvidenceSpan } from '@/domain/findings/types';

export interface VerificationResult {
  isValid: boolean;
  resolvedSpan: EvidenceSpan;
  rejectionReason?: string;
}

function normalizeForComparison(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export class EvidenceVerifier {
  /** Precomputed normalized clause text cache for O(1) fuzzy lookup */
  private readonly normalizedClauses: Map<string, string>;

  constructor(private readonly document: Document) {
    // Precompute normalized text for all clauses during construction
    // instead of re-normalizing on every verifySpan call
    this.normalizedClauses = new Map();
    for (const clause of document.clauses) {
      this.normalizedClauses.set(clause.id, normalizeForComparison(clause.text));
    }
  }

  public verifySpan(span: Partial<EvidenceSpan>): VerificationResult {
    const base: EvidenceSpan = {
      documentId: this.document.id,
      versionId: this.document.versionId,
      pageNumber: span.pageNumber ?? 1,
      sectionId: span.sectionId ?? 'unknown',
      clauseId: span.clauseId ?? 'unknown',
      sourceTextSpan: '',
      exactQuotedText: span.exactQuotedText ?? '',
      startOffset: span.startOffset ?? 0,
      endOffset: span.endOffset ?? 0,
      claimType: span.claimType ?? 'DERIVED_INTERPRETATION',
      confidenceState: 'AMBIGUOUS',
      evidenceSufficiencyState: 'INSUFFICIENT',
    };

    if (span.documentId !== undefined && span.documentId !== this.document.id) {
      return this.reject(base, 'Evidence documentId does not match the current document.');
    }

    if (span.versionId !== undefined && span.versionId !== this.document.versionId) {
      return this.reject(base, 'Evidence versionId does not match the current document version.');
    }

    const quote = span.exactQuotedText?.trim() ?? '';
    if (!quote) {
      return this.reject(base, 'Claim has empty or missing quote text.');
    }

    const start = span.startOffset;
    const end = span.endOffset;
    if (
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      (start as number) >= 0 &&
      (end as number) > (start as number) &&
      (end as number) <= this.document.rawText.length
    ) {
      const sourceSlice = this.document.rawText.slice(start as number, end as number);
      if (sourceSlice.includes(quote)) {
        return this.resolve(base, {
          startOffset: start as number,
          endOffset: end as number,
          sourceTextSpan: sourceSlice,
          exactQuotedText: quote,
          claimType: 'DOCUMENT_FACT',
        });
      }
    }

    const exactIndex = this.document.rawText.indexOf(quote);
    if (exactIndex >= 0) {
      const endOffset = exactIndex + quote.length;
      const clause = this.findMatchingClause(exactIndex, endOffset);
      return this.resolve(base, {
        pageNumber: clause?.pageNumber ?? base.pageNumber,
        sectionId: clause?.sectionId ?? base.sectionId,
        clauseId: clause?.id ?? base.clauseId,
        startOffset: exactIndex,
        endOffset,
        sourceTextSpan: clause?.text ?? quote,
        exactQuotedText: quote,
        claimType: 'DOCUMENT_FACT',
      });
    }

    const normalizedQuote = normalizeForComparison(quote);
    if (normalizedQuote.length >= 15) {
      // Use precomputed normalized clause text instead of re-normalizing per call
      const matches = this.document.clauses.filter((clause) => {
        const cached = this.normalizedClauses.get(clause.id);
        return cached !== undefined && cached.includes(normalizedQuote);
      });
      if (matches.length === 1) {
        const clause = matches[0];
        return this.resolve(base, {
          pageNumber: clause.pageNumber,
          sectionId: clause.sectionId,
          clauseId: clause.id,
          startOffset: clause.span.start,
          endOffset: clause.span.end,
          sourceTextSpan: clause.text,
          exactQuotedText: quote,
          claimType: 'DERIVED_INTERPRETATION',
          confidenceState: 'STRONGLY_IMPLIED',
        });
      }
    }

    return this.reject(
      base,
      `Quoted text "${quote.slice(0, 40)}..." not found unambiguously in the current source.`
    );
  }

  private resolve(base: EvidenceSpan, patch: Partial<EvidenceSpan>): VerificationResult {
    return {
      isValid: true,
      resolvedSpan: {
        ...base,
        ...patch,
        documentId: this.document.id,
        versionId: this.document.versionId,
        confidenceState: patch.confidenceState ?? 'DIRECTLY_STATED',
        evidenceSufficiencyState: 'SUFFICIENT',
      },
    };
  }

  private reject(base: EvidenceSpan, reason: string): VerificationResult {
    return {
      isValid: false,
      resolvedSpan: {
        ...base,
        documentId: this.document.id,
        versionId: this.document.versionId,
        claimType: 'INSUFFICIENT_EVIDENCE',
        confidenceState: 'NOT_FOUND',
        evidenceSufficiencyState: 'INSUFFICIENT',
      },
      rejectionReason: reason,
    };
  }

  private findMatchingClause(start: number, end: number) {
    const clauses = this.document.clauses;
    let low = 0;
    let high = clauses.length - 1;
    let bestIdx = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (clauses[mid].span.start <= start) {
        bestIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestIdx >= 0 && clauses[bestIdx].span.end >= end) {
      return clauses[bestIdx];
    }

    return clauses.find((clause) => clause.span.start <= start && clause.span.end >= end);
  }
}
