import { NextRequest } from 'next/server';

/**
 * Extracts a trusted client identifier for rate limiting.
 * Avoids raw spoofable forwarded headers unless explicitly configured behind a trusted reverse proxy.
 */
export function extractClientIdentity(request: NextRequest): string {
  const isTrustedProxy = process.env.TRUSTED_PROXY === 'true';

  if (isTrustedProxy) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      const ip = forwardedFor.split(',')[0]?.trim();
      if (ip && ip.length > 0) return ip;
    }
    const realIp = request.headers.get('x-real-ip');
    if (realIp && realIp.trim().length > 0) return realIp.trim();
  }

  if (request.ip) {
    return request.ip;
  }

  return 'local-client';
}
