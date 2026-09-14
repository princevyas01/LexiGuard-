import { Clause, Document } from '@/domain/documents/types';
import { SECURITY_QUOTAS } from '@/security/quotas';

export interface RetrievedClauseResult {
  clause: Clause;
  score: number;
  matchedTerms: string[];
}

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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/** Posting entry: numeric clause index + precomputed term frequency */
interface PostingEntry {
  clauseIndex: number;
  tf: number;
}

export class ClauseRetriever {
  public readonly document: Document;
  private readonly indexedClauses: Clause[];

  // Inverted index: term → posting list sorted by clauseIndex
  private readonly postings = new Map<string, PostingEntry[]>();

  // Precomputed per-term IDF values
  private readonly idfValues = new Map<string, number>();

  // Precomputed per-clause data (indexed by clause position)
  private readonly clauseLengths: number[] = [];
  private readonly lengthNorm: number[] = []; // k1 * (1 - b + b * clauseLen / avgLen)

  // Forward index preserved for matchedTerms construction
  private readonly termFrequencies = new Map<string, Map<string, number>>();

  // Indexed clauses possessing clause numbers for fast query-matching
  private readonly numberedClauses: Array<{ index: number; clauseNumber: string }> = [];

  constructor(document: Document) {
    this.document = document;
    this.indexedClauses = document.clauses.slice(0, SECURITY_QUOTAS.MAX_INDEXED_CHUNKS);
    this.buildIndex();
  }

  private buildIndex(): void {
    const k1 = 1.5;
    const b = 0.75;
    let totalLength = 0;
    const totalClauses = this.indexedClauses.length;
    const docFreqs = new Map<string, number>();

    // Pass 1: tokenize, compute term frequencies, document frequencies, clause lengths
    for (let idx = 0; idx < totalClauses; idx++) {
      const clause = this.indexedClauses[idx];
      const fullText = `${clause.title || ''} ${clause.text}`;
      const tokens = tokenize(fullText);
      const tokenCount = tokens.length;
      this.clauseLengths.push(tokenCount);
      totalLength += tokenCount;

      const frequencies = new Map<string, number>();
      for (const term of tokens) {
        frequencies.set(term, (frequencies.get(term) || 0) + 1);
      }
      this.termFrequencies.set(clause.id, frequencies);

      for (const term of frequencies.keys()) {
        docFreqs.set(term, (docFreqs.get(term) || 0) + 1);
      }

      if (clause.clauseNumber) {
        this.numberedClauses.push({ index: idx, clauseNumber: clause.clauseNumber });
      }
    }

    const avgClauseLength = totalClauses > 0 ? totalLength / totalClauses : 1;

    // Pass 2: precompute IDF values and BM25 length normalization per clause
    for (const [term, df] of docFreqs.entries()) {
      this.idfValues.set(term, Math.log(1 + (totalClauses - df + 0.5) / (df + 0.5)));
    }

    for (let idx = 0; idx < totalClauses; idx++) {
      this.lengthNorm.push(k1 * (1 - b + (b * this.clauseLengths[idx]) / avgClauseLength));
    }

    // Pass 3: build inverted index (posting lists)
    for (let idx = 0; idx < totalClauses; idx++) {
      const clause = this.indexedClauses[idx];
      const frequencies = this.termFrequencies.get(clause.id);
      if (!frequencies) continue;
      for (const [term, tf] of frequencies.entries()) {
        let postingList = this.postings.get(term);
        if (!postingList) {
          postingList = [];
          this.postings.set(term, postingList);
        }
        postingList.push({ clauseIndex: idx, tf });
      }
    }
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

    // Accumulate scores per clause using the inverted index
    // scoreMap: clauseIndex → accumulated BM25 score
    const scoreMap = new Map<number, number>();
    // matchedMap: clauseIndex → matched query terms
    const matchedMap = new Map<number, string[]>();

    for (const qTerm of queryTokens) {
      const idf = this.idfValues.get(qTerm);
      if (idf === undefined) continue; // term not in any clause

      const postingList = this.postings.get(qTerm);
      if (!postingList) continue;

      for (const posting of postingList) {
        const numerator = posting.tf * (k1 + 1);
        const denominator = posting.tf + this.lengthNorm[posting.clauseIndex];
        const contribution = idf * (numerator / denominator);

        const prevScore = scoreMap.get(posting.clauseIndex);
        if (prevScore !== undefined) {
          scoreMap.set(posting.clauseIndex, prevScore + contribution);
        } else {
          scoreMap.set(posting.clauseIndex, contribution);
        }

        let terms = matchedMap.get(posting.clauseIndex);
        if (!terms) {
          terms = [];
          matchedMap.set(posting.clauseIndex, terms);
        }
        terms.push(qTerm);
      }
    }

    // Apply clauseNumber boost (only inspecting clauses that possess clause numbers)
    for (let i = 0; i < this.numberedClauses.length; i++) {
      const item = this.numberedClauses[i];
      if (query.includes(item.clauseNumber)) {
        const prevScore = scoreMap.get(item.index);
        if (prevScore !== undefined) {
          scoreMap.set(item.index, prevScore + 5);
          const terms = matchedMap.get(item.index);
          if (terms) terms.push(item.clauseNumber);
        } else {
          scoreMap.set(item.index, 5);
          matchedMap.set(item.index, [item.clauseNumber]);
        }
      }
    }

    // Collect results in ascending clauseIndex order to preserve stable tie-breaking identical to reference
    const matchingIndices = Array.from(scoreMap.keys()).sort((a, b) => a - b);
    const results: RetrievedClauseResult[] = [];

    for (const idx of matchingIndices) {
      const score = scoreMap.get(idx)!;
      if (score > 0) {
        results.push({
          clause: this.indexedClauses[idx],
          score,
          matchedTerms: matchedMap.get(idx) || [],
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, safeTopK);
  }
}
