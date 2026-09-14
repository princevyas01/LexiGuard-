import { MAX_RATE_LIMIT_IDENTIFIERS, RATE_LIMIT_PER_MINUTE } from './quotas';

export const ENTRY_TTL_MS = 15 * 60 * 1000;

interface Bucket {
  tokens: number;
  lastRefillAt: number;
  touchedAt: number;
}

export interface RateLimitResult {
  isAllowed: boolean;
  remainingTokens: number;
  retryAfterSec?: number;
  capacityLimited?: boolean;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private readonly refillRatePerMs: number;
  private readonly maxIdentifiers: number;

  constructor(
    maxTokens: number = RATE_LIMIT_PER_MINUTE,
    refillIntervalMs: number = 60_000,
    maxIdentifiers: number = MAX_RATE_LIMIT_IDENTIFIERS
  ) {
    if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
      throw new Error('Rate limiter maxTokens must be a positive integer.');
    }
    if (!Number.isInteger(refillIntervalMs) || refillIntervalMs <= 0) {
      throw new Error('Rate limiter refillIntervalMs must be a positive integer.');
    }
    if (!Number.isInteger(maxIdentifiers) || maxIdentifiers <= 0) {
      throw new Error('Rate limiter maxIdentifiers must be a positive integer.');
    }
    this.maxTokens = maxTokens;
    this.refillIntervalMs = refillIntervalMs;
    this.refillRatePerMs = maxTokens / refillIntervalMs;
    this.maxIdentifiers = maxIdentifiers;
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.touchedAt >= ENTRY_TTL_MS) {
        this.buckets.delete(key);
      }
    }
  }

  private retryAfterForCapacity(now: number): number {
    let earliestExpiry = Infinity;
    for (const bucket of this.buckets.values()) {
      earliestExpiry = Math.min(earliestExpiry, bucket.touchedAt + ENTRY_TTL_MS);
    }
    if (!Number.isFinite(earliestExpiry)) {
      return Math.ceil(this.refillIntervalMs / 1000);
    }
    return Math.max(1, Math.ceil((earliestExpiry - now) / 1000));
  }

  public checkLimit(identifier: string): RateLimitResult {
    const normalizedIdentifier = identifier.trim() || 'local-client';
    const now = Date.now();
    this.prune(now);

    let bucket = this.buckets.get(normalizedIdentifier);
    if (!bucket) {
      if (this.buckets.size >= this.maxIdentifiers) {
        return {
          isAllowed: false,
          remainingTokens: 0,
          retryAfterSec: this.retryAfterForCapacity(now),
          capacityLimited: true,
        };
      }
      bucket = {
        tokens: this.maxTokens - 1,
        lastRefillAt: now,
        touchedAt: now,
      };
      this.buckets.set(normalizedIdentifier, bucket);
      return {
        isAllowed: true,
        remainingTokens: Math.floor(bucket.tokens),
      };
    }

    const elapsed = Math.max(0, now - bucket.lastRefillAt);
    bucket.lastRefillAt = now;
    bucket.touchedAt = now;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillRatePerMs);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        isAllowed: true,
        remainingTokens: Math.floor(bucket.tokens),
      };
    }

    const missingTokens = 1 - bucket.tokens;
    const retryAfterSec = Math.max(1, Math.ceil(missingTokens / (this.refillRatePerMs * 1000)));
    return {
      isAllowed: false,
      remainingTokens: 0,
      retryAfterSec,
      capacityLimited: false,
    };
  }

  public getIdentifierCount(): number {
    return this.buckets.size;
  }

  public reset(): void {
    this.buckets.clear();
  }
}

const configuredTokens = process.env.RATE_LIMIT_PER_MINUTE
  ? Number.parseInt(process.env.RATE_LIMIT_PER_MINUTE, 10)
  : RATE_LIMIT_PER_MINUTE;

const globalForRateLimiter = globalThis as unknown as {
  globalRateLimiter?: InMemoryRateLimiter;
};

export const globalRateLimiter =
  globalForRateLimiter.globalRateLimiter ??
  new InMemoryRateLimiter(
    Number.isFinite(configuredTokens) && configuredTokens > 0
      ? configuredTokens
      : RATE_LIMIT_PER_MINUTE
  );

globalForRateLimiter.globalRateLimiter = globalRateLimiter;
