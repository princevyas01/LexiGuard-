import { describe, expect, it } from 'vitest';
import { AsyncConcurrencyGate, ConcurrencyLimitError } from '@/security/concurrency-gate';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('AsyncConcurrencyGate', () => {
  it('never exceeds max concurrency', async () => {
    const gate = new AsyncConcurrencyGate(2, 10);
    let active = 0;
    let peak = 0;

    const task = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active--;
    };

    await Promise.all(Array.from({ length: 8 }, () => gate.run(task)));

    expect(peak).toBeLessThanOrEqual(2);
    expect(gate.getActiveJobs()).toBe(0);
    expect(gate.getWaitingJobs()).toBe(0);
  });

  it('rejects when the waiter queue is full', async () => {
    const gate = new AsyncConcurrencyGate(1, 0);
    const blocker = deferred<void>();
    const running = gate.run(() => blocker.promise);

    await expect(gate.run(async () => undefined)).rejects.toBeInstanceOf(ConcurrencyLimitError);

    blocker.resolve();
    await running;
  });
});
