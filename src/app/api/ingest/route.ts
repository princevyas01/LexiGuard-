import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parseDocument } from '@/infrastructure/parsing/document-parser';
import { documentStore } from '@/infrastructure/storage/in-memory-store';
import { FileValidationError, validateUploadedFile } from '@/security/file-validation';
import { globalRateLimiter } from '@/security/rate-limiter';
import { extractClientIdentity } from '@/security/request-identity';
import {
  SampleRequestSchema,
  createBoundedBodyRequest,
  parseBoundedJson,
} from '@/security/request-schemas';
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
    const contentType = req.headers.get('content-type') || '';

    // A. Demo Sample Loading
    if (contentType.includes('application/json')) {
      const { sampleName } = await parseBoundedJson(req, SampleRequestSchema);

      const allowedSamples: Record<string, string> = {
        'residential-lease': 'fixtures/contracts/residential-lease.txt',
        'saas-agreement': 'fixtures/contracts/saas-agreement.txt',
        'nda-v1': 'fixtures/contracts/nda-v1.txt',
        'nda-v2': 'fixtures/contracts/nda-v2.txt',
        'adversarial-contract': 'fixtures/contracts/adversarial-contract.txt',
        'urgent-notice': 'fixtures/contracts/urgent-notice.txt',
      };

      const relativePath = allowedSamples[sampleName];
      if (!relativePath) {
        return NextResponse.json(
          { error: 'Invalid or unknown demo sample contract requested.' },
          { status: 400 }
        );
      }

      const filePath = path.join(process.cwd(), relativePath);
      const fileBuffer = fs.readFileSync(filePath);
      const validation = validateUploadedFile(fileBuffer, `${sampleName}.txt`, 'text/plain');
      const document = await globalConcurrencyGate.run(async () => {
        const parsedDocument = await parseDocument(fileBuffer, validation, `sample-${sampleName}`);
        documentStore.save(parsedDocument);
        return parsedDocument;
      });

      return NextResponse.json({ success: true, document });
    }

    // B. File Upload (FormData)
    if (contentType.includes('multipart/form-data')) {
      const boundedRequest = createBoundedBodyRequest(req);
      const formData = await boundedRequest.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file was provided in the upload.' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const validation = validateUploadedFile(buffer, file.name, file.type);
      const document = await globalConcurrencyGate.run(async () => {
        const parsedDocument = await parseDocument(buffer, validation);
        documentStore.save(parsedDocument);
        return parsedDocument;
      });

      return NextResponse.json({ success: true, document });
    }

    return NextResponse.json(
      { error: 'Unsupported Content-Type. Use multipart/form-data or application/json.' },
      { status: 415 }
    );
  } catch (err) {
    if (err instanceof ConcurrencyLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 503, headers: { 'Retry-After': '2' } }
      );
    }

    if (err instanceof FileValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : 'Document ingestion failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
