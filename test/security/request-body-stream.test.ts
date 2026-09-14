import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { createBoundedBodyRequest, enforceRequestBodySizeLimit } from '@/security/request-schemas';
import { MAX_REQUEST_BODY_BYTES } from '@/security/quotas';

describe('Streaming Request-Body Bounding (Security Fix #1)', () => {
  it('1. rejects oversized declared Content-Length immediately', () => {
    const req = new NextRequest('http://localhost/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=x',
        'content-length': String(MAX_REQUEST_BODY_BYTES + 1),
      },
    });

    expect(() => enforceRequestBodySizeLimit(req)).toThrow(/exceeds maximum allowed size/i);
  });

  it('2. rejects an unknown-length body once the streaming cap is exceeded', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(5 * 1024 * 1024));
        controller.enqueue(new Uint8Array(1024 * 1024 + 1));
        controller.close();
      },
    });

    const inner = new Request('http://localhost/api/ingest', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const req = new NextRequest(inner);

    const bounded = createBoundedBodyRequest(req);
    await expect(bounded.arrayBuffer()).rejects.toThrow(/exceeds maximum allowed size/i);
  });

  it('3. rejects under-reported Content-Length when actual stream exceeds cap', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Lies about size in header (e.g. claims 100 bytes), but streams 7 MB
        controller.enqueue(new Uint8Array(4 * 1024 * 1024));
        controller.enqueue(new Uint8Array(3 * 1024 * 1024));
        controller.close();
      },
    });

    const inner = new Request('http://localhost/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=x',
        'content-length': '100', // Spoofed smaller content-length
      },
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const req = new NextRequest(inner);

    const bounded = createBoundedBodyRequest(req);
    await expect(bounded.arrayBuffer()).rejects.toThrow(/exceeds maximum allowed size/i);
  });

  it('4. rejects invalid/malformed non-numeric Content-Length safely', () => {
    const req = new NextRequest('http://localhost/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=x',
        'content-length': 'not-a-number',
      },
    });

    expect(() => enforceRequestBodySizeLimit(req)).toThrow(/Invalid Content-Length header/i);
  });

  it('5. cancels underlying reader immediately upon quota breach', async () => {
    let cancelCalled = false;
    let cancelReason: unknown = null;

    const sourceStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_REQUEST_BODY_BYTES + 1024));
      },
      cancel(reason) {
        cancelCalled = true;
        cancelReason = reason;
      },
    });

    const inner = new Request('http://localhost/api/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: sourceStream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const req = new NextRequest(inner);

    const bounded = createBoundedBodyRequest(req);
    await expect(bounded.arrayBuffer()).rejects.toThrow(/exceeds maximum allowed size/i);
    expect(cancelCalled).toBe(true);
    expect(String(cancelReason)).toContain('request body exceeds maximum size');
  });

  it('6. leaves valid body under quota fully functional', async () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(payload);
        controller.close();
      },
    });

    const inner = new Request('http://localhost/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': '5',
      },
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const req = new NextRequest(inner);

    const bounded = createBoundedBodyRequest(req);
    const buf = await bounded.arrayBuffer();
    expect(new Uint8Array(buf)).toEqual(payload);
  });
});
