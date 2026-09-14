import { MAX_CONCURRENT_JOBS, MAX_CONCURRENT_WAITERS } from './quotas';

export class ConcurrencyLimitError extends Error {
  constructor(message = 'Server is temporarily busy. Please retry shortly.') {
    super(message);
    this.name = 'ConcurrencyLimitError';
  }
}

interface Waiter<T> {
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export class AsyncConcurrencyGate {
  private activeJobs = 0;
  private readonly queue: Array<Waiter<unknown>> = [];

  constructor(
    private readonly maxConcurrent: number = MAX_CONCURRENT_JOBS,
    private readonly maxWaiters: number = MAX_CONCURRENT_WAITERS
  ) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent <= 0) {
      throw new Error('maxConcurrent must be a positive integer.');
    }
    if (!Number.isInteger(maxWaiters) || maxWaiters < 0) {
      throw new Error('maxWaiters must be a non-negative integer.');
    }
  }

  public getActiveJobs(): number {
    return this.activeJobs;
  }

  public getWaitingJobs(): number {
    return this.queue.length;
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeJobs < this.maxConcurrent) {
      return this.execute(task);
    }
    if (this.queue.length >= this.maxWaiters) {
      throw new ConcurrencyLimitError();
    }
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
      } as Waiter<unknown>);
    });
  }

  private async execute<T>(task: () => Promise<T>): Promise<T> {
    this.activeJobs += 1;
    try {
      return await task();
    } finally {
      this.activeJobs -= 1;
      this.drain();
    }
  }

  private drain(): void {
    while (this.activeJobs < this.maxConcurrent && this.queue.length > 0) {
      const waiter = this.queue.shift();
      if (!waiter) return;
      void this.execute(waiter.task).then(waiter.resolve, waiter.reject);
    }
  }

  public reset(): void {
    this.activeJobs = 0;
    while (this.queue.length > 0) {
      const waiter = this.queue.shift();
      waiter?.reject(new ConcurrencyLimitError('Queued operation was cancelled.'));
    }
  }
}

const globalForGate = globalThis as unknown as {
  globalConcurrencyGate?: AsyncConcurrencyGate;
};

export const globalConcurrencyGate =
  globalForGate.globalConcurrencyGate ?? new AsyncConcurrencyGate();

globalForGate.globalConcurrencyGate = globalConcurrencyGate;
