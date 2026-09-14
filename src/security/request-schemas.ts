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

/**
 * Enforces byte-level request body size limits from Content-Length header.
 */
export function enforceRequestBodySizeLimit(req: NextRequest): void {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_BODY_BYTES) {
    throw new Error(
      `Request payload exceeds maximum allowed limit of ${MAX_REQUEST_BODY_BYTES / (1024 * 1024)} MB (exceeds maximum allowed size).`
    );
  }
}

/**
 * Enforces byte-level body size limits before parsing JSON and applies strict schema validation.
 */
export async function parseBoundedJson<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
  enforceRequestBodySizeLimit(req);

  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_REQUEST_BODY_BYTES) {
    throw new Error(
      `Request payload exceeds maximum allowed limit of ${MAX_REQUEST_BODY_BYTES / (1024 * 1024)} MB (exceeds maximum allowed size).`
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Malformed JSON payload.');
  }

  return schema.parse(json);
}
