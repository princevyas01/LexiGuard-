import { NextRequest, NextResponse } from 'next/server';
import { answerDocumentQuestion } from '@/application/qna/answer-document-question';
import { documentStore } from '@/infrastructure/storage/in-memory-store';
import { globalRateLimiter } from '@/security/rate-limiter';
import { extractClientIdentity } from '@/security/request-identity';
import { AskRequestSchema, parseBoundedJson } from '@/security/request-schemas';
import { ConcurrencyLimitError } from '@/security/concurrency-gate';

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
    const { documentId, question } = await parseBoundedJson(req, AskRequestSchema);

    const document = documentStore.get(documentId);
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found or session has expired.' },
        { status: 404 }
      );
    }

    const answer = await answerDocumentQuestion(document, question);

    return NextResponse.json({
      success: true,
      answer,
    });
  } catch (err) {
    if (err instanceof ConcurrencyLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 503, headers: { 'Retry-After': '2' } }
      );
    }
    const message = err instanceof Error ? err.message : 'Question answering failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
