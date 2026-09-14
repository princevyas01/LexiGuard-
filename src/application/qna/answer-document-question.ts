import { Document } from '@/domain/documents/types';
import { AskResponseSchema } from '@/domain/schemas';
import { EvidenceVerifier } from '@/infrastructure/evidence/verifier';
import { getLLMProvider } from '@/infrastructure/llm/provider-factory';
import { ClauseRetriever } from '@/infrastructure/retrieval/bm25-retriever';
import {
  buildIsolatedPrompt,
  sanitizeUntrustedText,
  verifyOutputSafety,
} from '@/security/prompt-sanitizer';
import {
  MAX_QUESTION_LENGTH,
  MAX_RETRIEVER_CACHE_ENTRIES,
  MAX_RETRIEVAL_TOP_K,
} from '@/security/quotas';
import { BoundedLruCache } from '@/security/bounded-lru-cache';
import { globalConcurrencyGate } from '@/security/concurrency-gate';
import { z } from 'zod';

export type AskResponse = z.infer<typeof AskResponseSchema>;

export const LEGAL_ADVICE_DISCLAIMER =
  'I can explain what the document says and help you prepare questions. I cannot determine the legal outcome or replace advice from a qualified lawyer.';

const retrieverCache = new BoundedLruCache<string, ClauseRetriever>(MAX_RETRIEVER_CACHE_ENTRIES);
const verifierCache = new BoundedLruCache<string, EvidenceVerifier>(MAX_RETRIEVER_CACHE_ENTRIES);

export function getCachedRetriever(document: Document): ClauseRetriever {
  const cacheKey = `${document.id}:${document.versionId}`;
  const existing = retrieverCache.get(cacheKey);
  if (existing) {
    return existing;
  }
  const retriever = new ClauseRetriever(document);
  retrieverCache.set(cacheKey, retriever);
  return retriever;
}

export function getCachedVerifier(document: Document): EvidenceVerifier {
  const cacheKey = `${document.id}:${document.versionId}`;
  const existing = verifierCache.get(cacheKey);
  if (existing) {
    return existing;
  }
  const verifier = new EvidenceVerifier(document);
  verifierCache.set(cacheKey, verifier);
  return verifier;
}

export function clearRetrieverCache(): void {
  retrieverCache.clear();
  verifierCache.clear();
}

export function getRetrieverCacheSize(): number {
  return retrieverCache.size();
}

export async function answerDocumentQuestion(
  document: Document,
  rawQuestion: string
): Promise<AskResponse> {
  // Normalize Unicode and strip control characters before applying the hard question limit.
  // eslint-disable-next-line no-control-regex
  const controlCharsRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  const trimmed = rawQuestion.normalize('NFKC').replace(controlCharsRegex, '').trim();
  const boundedQuestion = trimmed.slice(0, MAX_QUESTION_LENGTH);
  const cleanQuestion = sanitizeUntrustedText(boundedQuestion);

  if (!cleanQuestion) {
    return {
      question: '',
      answer:
        'Insufficient evidence in the provided document. Please provide a non-empty question.',
      claimType: 'INSUFFICIENT_EVIDENCE',
      confidence: 'NOT_FOUND',
      isEvidenceSufficient: false,
      supportingSpans: [],
      legalBoundaryDisclaimer: LEGAL_ADVICE_DISCLAIMER,
      suggestedQuestions: [
        'What are the main obligations under this agreement?',
        'What are the termination notice requirements?',
      ],
    };
  }

  const legalAdviceRegex =
    /(should i sue|will i win|is this illegal|can i break this lease without penalty|give me legal advice)/i;
  const isAdviceRequest = legalAdviceRegex.test(cleanQuestion);

  const retriever = getCachedRetriever(document);
  const retrieved = retriever.search(cleanQuestion, MAX_RETRIEVAL_TOP_K);

  if (retrieved.length === 0) {
    return {
      question: cleanQuestion,
      answer:
        'Insufficient evidence in the provided document. I could not verify a supporting passage for this answer.',
      claimType: 'INSUFFICIENT_EVIDENCE',
      confidence: 'NOT_FOUND',
      isEvidenceSufficient: false,
      supportingSpans: [],
      legalBoundaryDisclaimer: LEGAL_ADVICE_DISCLAIMER,
      suggestedQuestions: [
        'What are the main obligations under this agreement?',
        'What are the termination notice requirements?',
      ],
    };
  }

  const contextSnippet = retrieved
    .map((r) => `[Clause ${r.clause.clauseNumber || r.clause.id}] ${r.clause.text}`)
    .join('\n\n');

  const systemInstruction =
    'You are LexiGuard. Answer the user question using ONLY the provided clauses. ' +
    'If the answer cannot be found in those clauses, state: "Insufficient evidence in the provided document." ' +
    'Always include exact quoted evidence and preserve the legal-information boundary. ' +
    'Response JSON must contain fields: question, answer (string), claimType ("DOCUMENT_FACT" | "DERIVED_INTERPRETATION" | "INSUFFICIENT_EVIDENCE"), confidence ("DIRECTLY_STATED" | "STRONGLY_IMPLIED" | "NOT_FOUND"), isEvidenceSufficient (boolean), supportingSpans (array of EvidenceSpan with clauseId, exactQuotedText, startOffset, endOffset), legalBoundaryDisclaimer (string), and suggestedQuestions (string[]).';

  const userGoal = `Answer: ${cleanQuestion} Document ID: ${document.id} Version: ${document.versionId}`;

  const prompt = buildIsolatedPrompt(systemInstruction, userGoal, contextSnippet);

  const rawResult = await globalConcurrencyGate.run(async () => {
    const provider = getLLMProvider();
    return provider.generateStructured({
      systemPrompt: systemInstruction,
      userPrompt: prompt,
      schema: AskResponseSchema,
      temperature: 0.1,
    });
  });

  const safetyCheck = verifyOutputSafety(JSON.stringify(rawResult));
  if (!safetyCheck.isSafe) {
    throw new Error(`Output safety violation: ${safetyCheck.warning}`);
  }

  const verifier = getCachedVerifier(document);
  const verifiedSpans = (rawResult.supportingSpans ?? []).flatMap((span) => {
    const check = verifier.verifySpan(span);
    return check.isValid ? [check.resolvedSpan] : [];
  });

  const isEvidenceSufficient = verifiedSpans.length > 0;
  let finalAnswer = isEvidenceSufficient
    ? rawResult.answer
    : 'Insufficient evidence in the provided document. I could not verify a supporting passage for this answer.';

  if (isAdviceRequest && !finalAnswer.includes('I cannot determine the legal outcome')) {
    finalAnswer = `${LEGAL_ADVICE_DISCLAIMER}\n\n${finalAnswer}`;
  }

  return {
    ...rawResult,
    question: cleanQuestion,
    answer: finalAnswer,
    claimType: isEvidenceSufficient ? rawResult.claimType : 'INSUFFICIENT_EVIDENCE',
    confidence: isEvidenceSufficient ? rawResult.confidence : 'NOT_FOUND',
    isEvidenceSufficient,
    supportingSpans: verifiedSpans,
    legalBoundaryDisclaimer: LEGAL_ADVICE_DISCLAIMER,
  };
}
