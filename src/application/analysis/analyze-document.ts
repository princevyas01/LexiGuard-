import { z } from 'zod';
import { Document } from '@/domain/documents/types';
import { AnalysisFinding } from '@/domain/findings/types';
import { DeadlineItem, Obligation } from '@/domain/obligations/types';
import { AnalysisFindingSchema, DeadlineItemSchema, ObligationSchema } from '@/domain/schemas';
import { getLLMProvider } from '@/infrastructure/llm/provider-factory';
import {
  buildIsolatedPrompt,
  inspectForPromptInjection,
  verifyOutputSafety,
} from '@/security/prompt-sanitizer';
import { MAX_EXTRACTED_CHARACTERS } from '@/security/quotas';
import { validateAnalysisFindings } from '../claim-validation/validate-claims';
import { validateObligationsAndDeadlines } from '../claim-validation/validate-document-analysis';

const RawDocumentAnalysisSchema = z.object({
  findings: z.array(AnalysisFindingSchema),
  obligations: z.array(ObligationSchema),
  deadlines: z.array(DeadlineItemSchema),
});

export interface DocumentAnalysisResult {
  documentId: string;
  isHostilePromptDetected: boolean;
  detectedPromptThreats: string[];
  findings: AnalysisFinding[];
  obligations: Obligation[];
  deadlines: DeadlineItem[];
  analyzedAt: string;
}

/**
 * Executes full document analysis workflow with prompt isolation,
 * schema validation, bounded context, and complete validation of findings,
 * obligations, and deadlines before return.
 */
export async function analyzeDocument(document: Document): Promise<DocumentAnalysisResult> {
  // 1. Security Check: Inspect untrusted document content for prompt injection (telemetry signal)
  const injectionCheck = inspectForPromptInjection(document.rawText);

  // 2. Build isolated prompt with bounded context
  const boundedText = document.rawText.slice(0, MAX_EXTRACTED_CHARACTERS);
  const systemInstruction = `You are LexiGuard, an evidence-grounded legal assistant. Analyze the legal document for material risks, obligations, deadlines, and unusual terms. Every finding, obligation, and deadline must include exact quoted excerpts.
Return a JSON object strictly matching: { findings: AnalysisFinding[], obligations: Obligation[], deadlines: DeadlineItem[] }.
Each finding: { id: string, category: string, severity: 'HIGH_ATTENTION' | 'REVIEW_SOON' | 'LOW_CONCERN' | 'INFORMATIONAL', title: string, plainLanguageSummary: string, whyItMatters: string, affectedParty: string, recommendedQuestion: string, confidence: 'DIRECTLY_STATED' | 'STRONGLY_IMPLIED', isVerified: boolean, sourceSpans: [{ clauseId: string, exactQuotedText: string, startOffset: number, endOffset: number, claimType: 'DOCUMENT_FACT', confidenceState: 'DIRECTLY_STATED', evidenceSufficiencyState: 'SUFFICIENT' }] }.
Each obligation: { id: string, actor: string, obligation: string, trigger: string, deadline: string, status: 'MANDATORY' | 'CONDITIONAL', sourceSpan: { clauseId: string, exactQuotedText: string, startOffset: number, endOffset: number, claimType: 'DOCUMENT_FACT', confidenceState: 'DIRECTLY_STATED', evidenceSufficiencyState: 'SUFFICIENT' } }.
Each deadline: { id: string, title: string, dueDateOrPeriod: string, type: 'NOTICE_PERIOD' | 'PAYMENT_DUE_DATE' | 'TERMINATION_NOTICE' | 'OTHER', actor: string, consequencesOfMissing: string, isCalendarDate: boolean, sourceSpan: { clauseId: string, exactQuotedText: string, startOffset: number, endOffset: number, claimType: 'DOCUMENT_FACT', confidenceState: 'DIRECTLY_STATED', evidenceSufficiencyState: 'SUFFICIENT' } }.`;
  const userGoal = `Analyze this document for material legal risks, mandatory obligations, and key deadlines. Document ID: ${document.id} Version: ${document.versionId}`;
  const isolatedPrompt = buildIsolatedPrompt(systemInstruction, userGoal, boundedText);

  // 3. Invoke LLM Provider via port with single retry authority (maxRetries: 1 = max 2 attempts total)
  const provider = getLLMProvider();
  const rawAnalysis = await provider.generateStructured({
    systemPrompt: systemInstruction,
    userPrompt: isolatedPrompt,
    schema: RawDocumentAnalysisSchema,
    temperature: 0.1,
    maxRetries: 1,
  });

  if (!rawAnalysis) {
    throw new Error('Analysis failed: provider returned no valid analysis result.');
  }

  // 4. Output Safety Check: fail closed immediately on unsafe or leaked output
  const safetyCheck = verifyOutputSafety(JSON.stringify(rawAnalysis));
  if (!safetyCheck.isSafe) {
    throw new Error(`Analysis output safety violation: ${safetyCheck.warning}`);
  }

  // 5. Claim-Level Validation Pipeline: findings, obligations, and deadlines all cross the verification boundary
  const {
    findings: rawFindings,
    obligations: rawObligations,
    deadlines: rawDeadlines,
  } = rawAnalysis;
  const validatedFindings = validateAnalysisFindings(rawFindings, document);
  const { obligations: validatedObligations, deadlines: validatedDeadlines } =
    validateObligationsAndDeadlines(rawObligations, rawDeadlines, document);

  return {
    documentId: document.id,
    isHostilePromptDetected: injectionCheck.isSuspicious,
    detectedPromptThreats: injectionCheck.detectedPatterns,
    findings: validatedFindings,
    obligations: validatedObligations,
    deadlines: validatedDeadlines,
    analyzedAt: new Date().toISOString(),
  };
}
