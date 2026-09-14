import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { compareContracts } from '@/application/comparison/compare-contracts';
import { parseDocument } from '@/infrastructure/parsing/document-parser';
import { documentStore } from '@/infrastructure/storage/in-memory-store';
import { validateUploadedFile } from '@/security/file-validation';
import { globalRateLimiter } from '@/security/rate-limiter';
import { extractClientIdentity } from '@/security/request-identity';
import { CompareRequestSchema, parseBoundedJson } from '@/security/request-schemas';
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
    const body = await parseBoundedJson(req, CompareRequestSchema);
    let docAId = body.docAId || body.leftDocumentId;
    let docBId = body.docBId || body.rightDocumentId;

    // Support automatic loading of sample comparison fixtures (NDA v1 vs v2) ONLY when both IDs are omitted
    if (!docAId && !docBId) {
      const v1Path = path.join(process.cwd(), 'fixtures/contracts/nda-v1.txt');
      const v2Path = path.join(process.cwd(), 'fixtures/contracts/nda-v2.txt');

      const v1Buf = fs.readFileSync(v1Path);
      const v2Buf = fs.readFileSync(v2Path);

      const val1 = validateUploadedFile(v1Buf, 'nda-v1.txt', 'text/plain');
      const val2 = validateUploadedFile(v2Buf, 'nda-v2.txt', 'text/plain');

      const doc1 = await parseDocument(v1Buf, val1, 'sample-nda-v1');
      const doc2 = await parseDocument(v2Buf, val2, 'sample-nda-v2');

      documentStore.save(doc1);
      documentStore.save(doc2);

      docAId = doc1.id;
      docBId = doc2.id;
    }

    if (!docAId || !docBId) {
      return NextResponse.json(
        { error: 'Both document IDs must be supplied for comparison.' },
        { status: 404 }
      );
    }

    const docA = documentStore.get(docAId);
    const docB = documentStore.get(docBId);

    if (!docA || !docB) {
      return NextResponse.json(
        { error: 'One or both documents could not be resolved for comparison.' },
        { status: 404 }
      );
    }

    const comparison = await globalConcurrencyGate.run(() => compareContracts(docA, docB));

    return NextResponse.json({
      success: true,
      comparison,
    });
  } catch (err) {
    if (err instanceof ConcurrencyLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 503, headers: { 'Retry-After': '2' } }
      );
    }
    const message = err instanceof Error ? err.message : 'Document comparison failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
