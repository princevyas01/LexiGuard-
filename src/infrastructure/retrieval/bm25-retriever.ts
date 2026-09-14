import { Clause, Document } from '@/domain/documents/types';
import { SECURITY_QUOTAS } from '@/security/quotas';

export interface RetrievedClauseResult {
  clause: Clause;
  score: number;
  matchedTerms: string[];
}

function tokenize(text: string): string[] {
  const stopWords = new Set([
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

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

export class ClauseRetriever {
  public readonly document: Document;
  private readonly indexedClauses: Clause[];
  private readonly clauseTokens = new Map<string, string[]>();
  private readonly docFreqs = new Map<string, number>();
  private avgClauseLength = 1;

  constructor(document: Document) {
    this.document = document;
    this.indexedClauses = document.clauses.slice(0, SECURITY_QUOTAS.MAX_INDEXED_CHUNKS);
    this.buildIndex();
  }

  private buildIndex(): void {
    let totalLength = 0;
    const totalClauses = this.indexedClauses.length;

    for (const clause of this.indexedClauses) {
      const fullText = `${clause.title || ''} ${clause.text}`;
      const tokens = tokenize(fullText);
      this.clauseTokens.set(clause.id, tokens);
      totalLength += tokens.length;

      for (const term of new Set(tokens)) {
        this.docFreqs.set(term, (this.docFreqs.get(term) || 0) + 1);
      }
    }

    this.avgClauseLength = totalClauses > 0 ? totalLength / totalClauses : 1;
  }

  public search(
    query: string,
    topK: number = SECURITY_QUOTAS.MAX_RETRIEVAL_TOP_K
  ): RetrievedClauseResult[] {
    const safeTopK = Math.min(Math.max(0, Math.floor(topK)), SECURITY_QUOTAS.MAX_RETRIEVAL_TOP_K);

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 || this.indexedClauses.length === 0) {
      return [];
    }

    const k1 = 1.5;
    const b = 0.75;
    const N = this.indexedClauses.length;
    const results: RetrievedClauseResult[] = [];

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
