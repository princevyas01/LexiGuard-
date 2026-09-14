import { NextRequest, NextResponse } from 'next/server';
import { generateActionPlan } from '@/application/action-plan/generate-action-plan';
import { analyzeDocument } from '@/application/analysis/analyze-document';
import { documentStore } from '@/infrastructure/storage/in-memory-store';
import { globalRateLimiter } from '@/security/rate-limiter';
import { extractClientIdentity } from '@/security/request-identity';
import { AnalyzeRequestSchema, parseBoundedJson } from '@/security/request-schemas';
import { ConcurrencyLimitError, globalConcurrencyGate } from '@/security/concurrency-gate';

export async function POST(req: NextRequest) {
  // 1. Rate Limiting Check via centralized trusted identity
  const clientId = extractClientIdentity(req);
  const rateCheck = globalRateLimiter.checkLimit(clientId);
  if (!rateCheck.isAllowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfterSec} seconds.` },
      { status: 429 }
    );
  }

  try {
    const { documentId } = await parseBoundedJson(req, AnalyzeRequestSchema);

    const document = documentStore.get(documentId);
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or session has expired.' },
        { status: 404 }
      );
    }

    const { analysis, actionPlan } = await globalConcurrencyGate.run(async () => {
      const analysis = await analyzeDocument(document);
      const actionPlan = generateActionPlan(document, analysis);
      return { analysis, actionPlan };
    });

    return NextResponse.json({
      success: true,
      analysis,
      actionPlan,
    });
  } catch (err) {
    if (err instanceof ConcurrencyLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 503, headers: { 'Retry-After': '2' } }
      );
    }
    const message = err instanceof Error ? err.message : 'Document analysis failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
