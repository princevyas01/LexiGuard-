import { describe, expect, it } from 'vitest';
import { BoundedLruCache } from '@/security/bounded-lru-cache';

describe('BoundedLruCache', () => {
  it('never exceeds configured capacity', () => {
    const cache = new BoundedLruCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size()).toBe(2);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });

  it('refreshes recency on get', () => {
    const cache = new BoundedLruCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });
});
