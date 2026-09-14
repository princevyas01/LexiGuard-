import { z } from 'zod';
import { Document } from '@/domain/documents/types';
import { ComparisonFinding, DocumentComparisonResult } from '@/domain/comparison/types';
import { ComparisonFindingSchema } from '@/domain/schemas';
import { EvidenceSpan } from '@/domain/findings/types';
import { EvidenceVerifier } from '@/infrastructure/evidence/verifier';
import { getLLMProvider } from '@/infrastructure/llm/provider-factory';
import { buildIsolatedPrompt, verifyOutputSafety } from '@/security/prompt-sanitizer';
import { MAX_COMPARISON_DOCUMENT_CHARACTERS } from '@/security/quotas';

const ComparisonResponseSchema = z.object({
  findings: z.array(ComparisonFindingSchema),
  summary: z.string(),
  unchangedCount: z.number().nonnegative(),
  addedCount: z.number().nonnegative(),
  removedCount: z.number().nonnegative(),
  modifiedCount: z.number().nonnegative(),
});

function normalizeTokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function lexicalOverlapFromSets(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection++;
  }
  return intersection / Math.max(left.size, right.size);
}

/**
 * Compares two documents at the semantic clause level, classifying materiality
 * and verifying every finding against version-aware EvidenceVerifier instances.
 * Recomputes change counters from validated findings.
 */
export async function compareContracts(
  docA: Document,
  docB: Document
): Promise<DocumentComparisonResult> {
  const systemInstruction = `You are LexiGuard. Compare two versions of an agreement (Version A vs Version B). Perform structural alignment, identify substantive differences at the clause level, and classify materiality. Use cautious language such as "Potentially material difference for review" and never state that a clause is legally invalid. Every finding must include exact quoted excerpts from the relevant version.
Return a JSON object matching: { findings: ComparisonFinding[], summary: string, unchangedCount: number, addedCount: number, removedCount: number, modifiedCount: number }.
Each finding: { id: string, clauseTopic: string, changeType: 'UNCHANGED' | 'ADDED' | 'REMOVED' | 'MODIFIED' | 'MOVED' | 'AMBIGUOUS', materiality: string, severity: 'HIGH_ATTENTION' | 'REVIEW_SOON' | 'LOW_CONCERN' | 'INFORMATIONAL', originalText?: string, revisedText?: string, plainLanguageExplanation: string, commercialImpact: string, sourceSpans: EvidenceSpan[] }.`;

  // Precompute token sets for all clauses in both documents
  const tokenSetCacheA = new Map<string, Set<string>>();
  for (const clause of docA.clauses) {
    tokenSetCacheA.set(clause.id, normalizeTokenSet(clause.text));
  }

  const tokenSetCacheB = new Map<string, Set<string>>();
  for (const clause of docB.clauses) {
    tokenSetCacheB.set(clause.id, normalizeTokenSet(clause.text));
  }

  // Pre-index docB clauses by clauseNumber for O(1) lookup
  const docBByNumber = new Map<string, (typeof docB.clauses)[number]>();
  for (const clauseB of docB.clauses) {
    if (clauseB.clauseNumber) {
      docBByNumber.set(clauseB.clauseNumber, clauseB);
    }
  }

  const allCandidates: Array<{
    a?: (typeof docA.clauses)[number];
    b?: (typeof docB.clauses)[number];
    score: number;
  }> = [];

  const usedB = new Set<string>();

  for (const clauseA of docA.clauses) {
    // O(1) clause-number lookup instead of O(M) linear .find()
    const sameNumber = clauseA.clauseNumber ? docBByNumber.get(clauseA.clauseNumber) : undefined;

    let best: { clause: (typeof docB.clauses)[number]; score: number } | undefined;

    if (sameNumber) {
      best = { clause: sameNumber, score: 1 };
    } else {
      // Linear-max search instead of .map().sort()[0] — O(M) instead of O(M log M)
      const tokenSetA = tokenSetCacheA.get(clauseA.id) || new Set<string>();
      let bestScore = -1;
      let bestClause: (typeof docB.clauses)[number] | undefined;

      for (const clauseB of docB.clauses) {
        const tokenSetB = tokenSetCacheB.get(clauseB.id) || new Set<string>();
        const score = lexicalOverlapFromSets(tokenSetA, tokenSetB);
        if (score > bestScore) {
          bestScore = score;
          bestClause = clauseB;
        }
      }

      if (bestClause && bestScore >= 0) {
        best = { clause: bestClause, score: bestScore };
      }
    }

    if (best && best.score >= 0.05) {
      usedB.add(best.clause.id);
      allCandidates.push({
        a: clauseA,
        b: best.clause,
        score: best.score,
      });
    } else {
      allCandidates.push({
        a: clauseA,
        score: 1,
      });
    }
  }

  for (const clauseB of docB.clauses) {
    if (!usedB.has(clauseB.id)) {
      allCandidates.push({
        b: clauseB,
        score: 1,
      });
    }
  }

  allCandidates.sort((a, b) => b.score - a.score);

  // Build candidate text with array join instead of quadratic string concatenation
  const fragments: string[] = [];
  let totalLength = 0;

  for (const candidate of allCandidates) {
    const parts: string[] = [];
    if (candidate.a) {
      parts.push(`[A ${candidate.a.clauseNumber || candidate.a.id}] ${candidate.a.text}`);
    }
    if (candidate.b) {
      parts.push(`[B ${candidate.b.clauseNumber || candidate.b.id}] ${candidate.b.text}`);
    }
    const fragment = parts.join('\n');
    const addedLength = totalLength === 0 ? fragment.length : fragment.length + 2; // +2 for '\n\n'

    if (totalLength + addedLength > MAX_COMPARISON_DOCUMENT_CHARACTERS) break;
    fragments.push(fragment);
    totalLength += addedLength;
  }

  const candidateText = fragments.join('\n\n');

  const comparisonPayload =
    `VERSION A: ${docA.metadata.fileName}\n` +
    `VERSION B: ${docB.metadata.fileName}\n\n` +
    candidateText;

  const prompt = buildIsolatedPrompt(
    systemInstruction,
    `Compare Version A and Version B for material changes in obligations, risks, and dispute terms.`,
    comparisonPayload
  );

  // 2. Invoke provider
  const provider = getLLMProvider();
  const rawComparison = await provider.generateStructured({
    systemPrompt: systemInstruction,
    userPrompt: prompt,
    schema: ComparisonResponseSchema,
    temperature: 0.1,
  });

  const safetyCheck = verifyOutputSafety(JSON.stringify(rawComparison));
  if (!safetyCheck.isSafe) {
    throw new Error(`Comparison output safety violation: ${safetyCheck.warning}`);
  }

  // 3. Verify every comparison finding against the corresponding document version
  const verifierA = new EvidenceVerifier(docA);
  const verifierB = new EvidenceVerifier(docB);
  const validatedFindings: ComparisonFinding[] = [];

  for (const finding of rawComparison.findings) {
    const verifiedSpans: EvidenceSpan[] = [];
    let hasValidA = false;
    let hasValidB = false;

    for (const span of finding.sourceSpans) {
      if (
        span.documentId === docA.id ||
        (!span.documentId &&
          (finding.changeType === 'REMOVED' || finding.changeType === 'UNCHANGED'))
      ) {
        const checkA = verifierA.verifySpan({
          ...span,
          documentId: docA.id,
          versionId: docA.versionId,
        });
        if (checkA.isValid) {
          verifiedSpans.push(checkA.resolvedSpan);
          hasValidA = true;
        }
      } else if (
        span.documentId === docB.id ||
        (!span.documentId && finding.changeType === 'ADDED')
      ) {
        const checkB = verifierB.verifySpan({
          ...span,
          documentId: docB.id,
          versionId: docB.versionId,
        });
        if (checkB.isValid) {
          verifiedSpans.push(checkB.resolvedSpan);
          hasValidB = true;
        }
      } else {
        // Test against docA first, then docB
        const checkA = verifierA.verifySpan({
          ...span,
          documentId: docA.id,
          versionId: docA.versionId,
        });
        if (checkA.isValid) {
          verifiedSpans.push(checkA.resolvedSpan);
          hasValidA = true;
        } else {
          const checkB = verifierB.verifySpan({
            ...span,
            documentId: docB.id,
            versionId: docB.versionId,
          });
          if (checkB.isValid) {
            verifiedSpans.push(checkB.resolvedSpan);
            hasValidB = true;
          }
        }
      }
    }

    // Check originalText / revisedText directly against documents if spans were not provided
    if (!hasValidA && finding.originalText && finding.originalText.trim().length > 0) {
      const checkA = verifierA.verifySpan({
        documentId: docA.id,
        versionId: docA.versionId,
        exactQuotedText: finding.originalText,
      });
      if (checkA.isValid) {
        verifiedSpans.push(checkA.resolvedSpan);
        hasValidA = true;
      }
    }

    if (!hasValidB && finding.revisedText && finding.revisedText.trim().length > 0) {
      const checkB = verifierB.verifySpan({
        documentId: docB.id,
        versionId: docB.versionId,
        exactQuotedText: finding.revisedText,
      });
      if (checkB.isValid) {
        verifiedSpans.push(checkB.resolvedSpan);
        hasValidB = true;
      }
    }

    // Fail closed: enforce that required sides are verified
    let isValidFinding = false;
    if (finding.changeType === 'ADDED') {
      isValidFinding = hasValidB;
    } else if (finding.changeType === 'REMOVED') {
      isValidFinding = hasValidA;
    } else if (finding.changeType === 'MODIFIED') {
      isValidFinding = hasValidA && hasValidB;
    } else {
      isValidFinding = hasValidA || hasValidB;
    }

    if (isValidFinding && verifiedSpans.length > 0) {
      validatedFindings.push({
        ...finding,
        sourceSpans: verifiedSpans,
      });
    }
  }

  // 4. Recompute changed counters in a single pass instead of 4 separate .filter() calls
  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let unchangedCount = 0;

  for (const f of validatedFindings) {
    switch (f.changeType) {
      case 'ADDED':
        addedCount++;
        break;
      case 'REMOVED':
        removedCount++;
        break;
      case 'MODIFIED':
        modifiedCount++;
        break;
      case 'UNCHANGED':
        unchangedCount++;
        break;
    }
  }

  return {
    id: `cmp-${docA.id}-${docB.id}`,
    docAId: docA.id,
    docBId: docB.id,
    docATitle: docA.metadata.detectedTitle || docA.metadata.fileName,
    docBTitle: docB.metadata.detectedTitle || docB.metadata.fileName,
    summary: rawComparison.summary,
    findings: validatedFindings,
    unchangedCount,
    addedCount,
    removedCount,
    modifiedCount,
  };
}
