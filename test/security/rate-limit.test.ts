import { describe, it, expect } from 'vitest';
import { InMemoryRateLimiter } from '@/security/rate-limiter';

describe('In-Memory Token Bucket Rate Limiter', () => {
  it('allows requests up to the maximum token limit', () => {
    const limiter = new InMemoryRateLimiter(5, 60_000);
    const ip = '192.168.1.10';

    for (let i = 0; i < 5; i++) {
      const result = limiter.checkLimit(ip);
      expect(result.isAllowed).toBe(true);
    }

    // 6th request should be blocked
    const blocked = limiter.checkLimit(ip);
    expect(blocked.isAllowed).toBe(false);
    expect(blocked.remainingTokens).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('maintains independent rate counters per client IP', () => {
    const limiter = new InMemoryRateLimiter(2, 60_000);
    const ipA = '10.0.0.1';
    const ipB = '10.0.0.2';

    expect(limiter.checkLimit(ipA).isAllowed).toBe(true);
    expect(limiter.checkLimit(ipA).isAllowed).toBe(true);
    expect(limiter.checkLimit(ipA).isAllowed).toBe(false);

    // IP B still has full quota
    expect(limiter.checkLimit(ipB).isAllowed).toBe(true);
    expect(limiter.checkLimit(ipB).isAllowed).toBe(true);
    expect(limiter.checkLimit(ipB).isAllowed).toBe(false);
  });

  it('bounds memory and evicts oldest entries under unique-identifier attack traffic', () => {
    // Construct limiter with a small maximum identifier bound of 10
    const maxBound = 10;
    const limiter = new InMemoryRateLimiter(5, 60_000, maxBound);

    // Flooding with 100 unique client identifiers
    for (let i = 0; i < 100; i++) {
      limiter.checkLimit(`attacker-ip-${i}`);
    }

    // The active tracked map must not exceed the configured maximum bound
    expect(limiter.getIdentifierCount()).toBeLessThanOrEqual(maxBound);
  });

  it('does not evict an active victim bucket when identifier capacity is saturated', () => {
    const limiter = new InMemoryRateLimiter(2, 60_000, 3);
    const victim = 'victim-ip';
    expect(limiter.checkLimit(victim).isAllowed).toBe(true);
    expect(limiter.checkLimit(victim).isAllowed).toBe(true);
    expect(limiter.checkLimit(victim).isAllowed).toBe(false);

    expect(limiter.checkLimit('attacker-1').isAllowed).toBe(true);
    expect(limiter.checkLimit('attacker-2').isAllowed).toBe(true);

    const capacityBlocked = limiter.checkLimit('attacker-3');
    expect(capacityBlocked.isAllowed).toBe(false);
    expect(capacityBlocked.capacityLimited).toBe(true);

    const victimStillBlocked = limiter.checkLimit(victim);
    expect(victimStillBlocked.isAllowed).toBe(false);
    expect(victimStillBlocked.capacityLimited).toBe(false);
  });
});
