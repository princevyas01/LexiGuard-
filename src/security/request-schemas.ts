import { NextRequest } from 'next/server';
import { z } from 'zod';
import { MAX_QUESTION_LENGTH, MAX_REQUEST_BODY_BYTES } from './quotas';

/**
 * Strict server-side identifier validation: alphanumeric, dashes, and underscores only.
 * Safely accepts UUIDs and internal sample IDs while rejecting path traversals or control characters.
 */
export const DocumentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Document ID must be a valid alphanumeric identifier.');

export const AskRequestSchema = z.object({
  documentId: DocumentIdSchema,
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
});

export const CompareRequestSchema = z.object({
  docAId: DocumentIdSchema.optional(),
  docBId: DocumentIdSchema.optional(),
  leftDocumentId: DocumentIdSchema.optional(),
  rightDocumentId: DocumentIdSchema.optional(),
});

export const SampleRequestSchema = z.object({
  sampleName: z.enum([
    'residential-lease',
    'saas-agreement',
    'nda-v1',
    'nda-v2',
    'adversarial-contract',
    'urgent-notice',
  ]),
});

export const AnalyzeRequestSchema = z.object({
  documentId: DocumentIdSchema,
});

export type AskRequest = z.infer<typeof AskRequestSchema>;
export type CompareRequest = z.infer<typeof CompareRequestSchema>;
export type SampleRequest = z.infer<typeof SampleRequestSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

function bodyTooLargeError(): Error {
  return new Error(
    `Request payload exceeds maximum allowed limit of ${
      MAX_REQUEST_BODY_BYTES / (1024 * 1024)
    } MB (exceeds maximum allowed size).`
  );
}

function parseContentLength(req: Request): number | null {
  const raw = req.headers.get('content-length');
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Invalid Content-Length header.');
  }
  return parsed;
}

export function enforceRequestBodySizeLimit(req: Request): void {
  const contentLength = parseContentLength(req);
  if (contentLength !== null && contentLength > MAX_REQUEST_BODY_BYTES) {
    throw bodyTooLargeError();
  }
}

export function createBoundedBodyRequest(req: NextRequest | Request): Request {
  enforceRequestBodySizeLimit(req);
  if (!req.body) {
    return new Request(req.url, {
      method: req.method,
      headers: req.headers,
      signal: req.signal,
    });
  }
  const reader = req.body.getReader();
  let totalBytes = 0;
  const boundedBody = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        const chunk = value ?? new Uint8Array(0);
        totalBytes += chunk.byteLength;
        if (totalBytes > MAX_REQUEST_BODY_BYTES) {
          await reader.cancel('request body exceeds maximum size');
          controller.error(bodyTooLargeError());
          return;
        }
        controller.enqueue(chunk);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
  const init: RequestInit & { duplex: 'half' } = {
    method: req.method,
    headers: req.headers,
    body: boundedBody,
    duplex: 'half',
  };
  return new Request(req.url, init);
}

/**
 * Enforces byte-level body size limits before parsing JSON and applies strict schema validation.
 */
export async function parseBoundedJson<T>(
  req: NextRequest | Request,
  schema: z.ZodType<T>
): Promise<T> {
  const boundedReq = createBoundedBodyRequest(req);

  const text = await boundedReq.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_REQUEST_BODY_BYTES) {
    throw bodyTooLargeError();
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Malformed JSON payload.');
  }

  return schema.parse(json);
}
