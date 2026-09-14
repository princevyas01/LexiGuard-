import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  AskRequestSchema,
  CompareRequestSchema,
  DocumentIdSchema,
  SampleRequestSchema,
  enforceRequestBodySizeLimit,
  parseBoundedJson,
} from '@/security/request-schemas';
import { extractClientIdentity } from '@/security/request-identity';

describe('Request Schemas & Identity Validation', () => {
  it('validates clean alphanumeric and dash document IDs', () => {
    expect(DocumentIdSchema.parse('doc-123_abc')).toBe('doc-123_abc');
    expect(DocumentIdSchema.parse('sample-residential-lease')).toBe('sample-residential-lease');
  });

  it('rejects path traversal or malicious characters in document IDs', () => {
    expect(() => DocumentIdSchema.parse('../../../etc/passwd')).toThrow();
    expect(() => DocumentIdSchema.parse('doc id with spaces')).toThrow();
    expect(() => DocumentIdSchema.parse('doc<script>')).toThrow();
  });

  it('validates AskRequestSchema question length limits', () => {
    const valid = {
      documentId: 'doc-123',
      question: 'What is the rent amount?',
    };
    expect(AskRequestSchema.parse(valid)).toEqual(valid);

    const tooLong = {
      documentId: 'doc-123',
      question: 'a'.repeat(2500), // Max is 2000
    };
    expect(() => AskRequestSchema.parse(tooLong)).toThrow();
  });

  it('validates CompareRequestSchema', () => {
    const valid = {
      leftDocumentId: 'doc-a',
      rightDocumentId: 'doc-b',
    };
    expect(CompareRequestSchema.parse(valid)).toEqual(valid);
  });

  it('validates SampleRequestSchema against allowed samples', () => {
    expect(SampleRequestSchema.parse({ sampleName: 'residential-lease' })).toEqual({
      sampleName: 'residential-lease',
    });
    expect(() => SampleRequestSchema.parse({ sampleName: 'malicious-file' })).toThrow();
  });

  it('extractClientIdentity safely returns local-client by default when not behind trusted proxy', () => {
    const req = new NextRequest('http://localhost:3000/api/ask', {
      headers: {
        'x-forwarded-for': '198.51.100.1', // Attacker attempting spoofing
      },
    });

    delete process.env.TRUSTED_PROXY;
    const id = extractClientIdentity(req);
    expect(id).toBe('local-client');
  });

  it('extractClientIdentity extracts first forwarded IP when TRUSTED_PROXY is enabled', () => {
    process.env.TRUSTED_PROXY = 'true';
    const req = new NextRequest('http://localhost:3000/api/ask', {
      headers: {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18',
      },
    });

    const id = extractClientIdentity(req);
    expect(id).toBe('203.0.113.195');
    delete process.env.TRUSTED_PROXY;
  });

  it('parseBoundedJson enforces body size limits before parsing JSON', async () => {
    const oversizedBody = JSON.stringify({ data: 'x'.repeat(7 * 1024 * 1024) });
    const req = new NextRequest('http://localhost:3000/api/ask', {
      method: 'POST',
      body: oversizedBody,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    await expect(parseBoundedJson(req, AskRequestSchema)).rejects.toThrow(
      /exceeds maximum allowed size/
    );
  });

  it('enforceRequestBodySizeLimit throws on oversized Content-Length header', () => {
    const req = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: {
        'content-length': String(10 * 1024 * 1024),
      },
    });

    expect(() => enforceRequestBodySizeLimit(req)).toThrow(/exceeds maximum allowed limit/);
  });
});
