import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { ClauseRetriever } from '@/infrastructure/retrieval/bm25-retriever';
import { Clause, Document } from '@/domain/documents/types';
import { SECURITY_QUOTAS } from '@/security/quotas';

// Test-local reference implementation representing previous unoptimized search behavior
class ReferenceClauseRetriever {
  private readonly indexedClauses: Clause[];
  private readonly clauseTokens = new Map<string, string[]>();
  private readonly docFreqs = new Map<string, number>();
  private avgClauseLength = 1;

  constructor(document: Document) {
    this.indexedClauses = document.clauses.slice(0, SECURITY_QUOTAS.MAX_INDEXED_CHUNKS);
    this.buildIndex();
  }

  private buildIndex(): void {
    const STOP_WORDS = new Set([
      'a',
      'an',
      'the',
      'and',
      'or',
      'but',
      'if',
      'then',
      'else',
      'when',
      'at',
      'by',
      'from',
      'for',
      'in',
      'out',
      'on',
      'off',
      'over',
      'under',
      'to',
      'of',
      'up',
      'down',
      'with',
      'as',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
    ]);

    let totalLength = 0;
    const totalClauses = this.indexedClauses.length;

    for (const clause of this.indexedClauses) {
      const fullText = `${clause.title || ''} ${clause.text}`;
      const tokens = fullText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
      this.clauseTokens.set(clause.id, tokens);
      totalLength += tokens.length;

      for (const term of new Set(tokens)) {
        this.docFreqs.set(term, (this.docFreqs.get(term) || 0) + 1);
      }
    }

    this.avgClauseLength = totalClauses > 0 ? totalLength / totalClauses : 1;
  }

  public search(query: string, topK: number = SECURITY_QUOTAS.MAX_RETRIEVAL_TOP_K) {
    const safeTopK = Math.min(Math.max(0, Math.floor(topK)), SECURITY_QUOTAS.MAX_RETRIEVAL_TOP_K);

    const STOP_WORDS = new Set([
      'a',
      'an',
      'the',
      'and',
      'or',
      'but',
      'if',
      'then',
      'else',
      'when',
      'at',
      'by',
      'from',
      'for',
      'in',
      'out',
      'on',
      'off',
      'over',
      'under',
      'to',
      'of',
      'up',
      'down',
      'with',
      'as',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
    ]);

    const queryTokens = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

    if (queryTokens.length === 0 || this.indexedClauses.length === 0) return [];

    const k1 = 1.5;
    const b = 0.75;
    const N = this.indexedClauses.length;
    const results: Array<{ clause: Clause; score: number; matchedTerms: string[] }> = [];

    // The unoptimized pattern: allocates and populates a new Map for every clause on every search
    for (const clause of this.indexedClauses) {
      const tokens = this.clauseTokens.get(clause.id) || [];
      const clauseLength = tokens.length;
      const termCounts = new Map<string, number>();

      for (const token of tokens) {
        termCounts.set(token, (termCounts.get(token) || 0) + 1);
      }

      let score = 0;
      const matchedTerms: string[] = [];

      for (const qTerm of queryTokens) {
        const tf = termCounts.get(qTerm) || 0;
        if (tf <= 0) continue;

        matchedTerms.push(qTerm);
        const df = this.docFreqs.get(qTerm) || 1;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + (b * clauseLength) / this.avgClauseLength);
        score += idf * (numerator / denominator);
      }

      if (clause.clauseNumber && query.includes(clause.clauseNumber)) {
        score += 5;
        matchedTerms.push(clause.clauseNumber);
      }

      if (score > 0) {
        results.push({ clause, score, matchedTerms });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, safeTopK);
  }
}

function makeBenchmarkDocument(clauseCount: number): Document {
  const clauses: Clause[] = [];
  const vocabulary = [
    'rent',
    'renewal',
    'notice',
    'landlord',
    'tenant',
    'premises',
    'payment',
    'fee',
    'inspection',
    'maintenance',
    'repair',
    'liability',
    'indemnity',
    'dispute',
    'arbitration',
    'governing',
    'law',
    'confidential',
    'information',
    'termination',
    'intellectual',
    'property',
  ];

  for (let i = 1; i <= clauseCount; i++) {
    const word1 = vocabulary[i % vocabulary.length];
    const word2 = vocabulary[(i * 3) % vocabulary.length];
    const word3 = vocabulary[(i * 7) % vocabulary.length];
    const text = `Clause text for section ${i}. The ${word1} party shall adhere to ${word2} requirements and ensure ${word3} compliance.`;

    clauses.push({
      id: `clause-${i}`,
      clauseNumber: `${i}.0`,
      title: `Section ${i}: ${word1} and ${word2}`,
      text,
      pageNumber: Math.floor(i / 10) + 1,
      sectionId: `sec-${Math.floor(i / 10) + 1}`,
      span: {
        start: (i - 1) * 100,
        end: i * 100,
        text,
      },
    });
  }

  return {
    id: 'benchmark-doc-4000',
    versionId: 'v1',
    metadata: {
      fileName: 'benchmark-doc.txt',
      fileSizeBytes: clauseCount * 100,
      mimeType: 'text/plain',
      pageCount: Math.ceil(clauseCount / 10),
      characterCount: clauseCount * 100,
      sha256Hash: 'hash-benchmark',
      ingestedAt: new Date().toISOString(),
      isScannedOrLowText: false,
    },
    rawText: clauses.map((c) => c.text).join('\n'),
    sections: [],
    clauses,
  };
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

describe('BM25 ClauseRetriever Efficiency & Correctness Benchmark', () => {
  const clauseCount = 2000;
  const doc = makeBenchmarkDocument(clauseCount);

  it('preserves exact ranking, clause IDs, matched terms, and scores within tolerance', () => {
    const optRetriever = new ClauseRetriever(doc);
    const refRetriever = new ReferenceClauseRetriever(doc);

    const testQueries = [
      'rent renewal notice',
      'confidential information disclosure',
      'arbitration liability dispute',
    ];

    for (const query of testQueries) {
      const optResults = optRetriever.search(query, 8);
      const refResults = refRetriever.search(query, 8);

      expect(optResults.length).toBeGreaterThan(0);
      expect(optResults.length).toBe(refResults.length);
      expect(optResults.map((r) => r.clause.id)).toEqual(refResults.map((r) => r.clause.id));
      expect(optResults.map((r) => r.matchedTerms)).toEqual(refResults.map((r) => r.matchedTerms));

      for (let i = 0; i < optResults.length; i++) {
        expect(Math.abs(optResults[i].score - refResults[i].score)).toBeLessThan(1e-5);
      }
    }
  });

  it('demonstrates measurable per-query latency reduction over reference implementation', () => {
    const optRetriever = new ClauseRetriever(doc);
    const refRetriever = new ReferenceClauseRetriever(doc);

    const query = 'rent renewal notice';
    const iterations = 100;

    // Warm up both retrievers
    optRetriever.search(query, 8);
    refRetriever.search(query, 8);

    // Benchmark Reference (Old) Implementation
    const refTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      refRetriever.search(query, 8);
      refTimes.push(performance.now() - t0);
    }

    // Benchmark Optimized Implementation
    const optTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      optRetriever.search(query, 8);
      optTimes.push(performance.now() - t0);
    }

    const refMedian = percentile(refTimes, 50);
    const refP95 = percentile(refTimes, 95);
    const optMedian = percentile(optTimes, 50);
    const optP95 = percentile(optTimes, 95);

    // Verify speedup invariants without console warnings
    expect(optMedian).toBeLessThanOrEqual(refMedian * 0.85);
    expect(optP95).toBeLessThanOrEqual(refP95 * 0.9);
  });
});
