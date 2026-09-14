export class BoundedLruCache<K, V> {
  private readonly entries = new Map<K, V>();
  public constructor(private readonly maxEntries: number) {
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new Error('BoundedLruCache maxEntries must be a positive integer.');
    }
  }
  public get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }
  public has(key: K): boolean {
    return this.entries.has(key);
  }
  public set(key: K, value: V): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as K | undefined;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }
    this.entries.set(key, value);
  }
  public delete(key: K): boolean {
    return this.entries.delete(key);
  }
  public clear(): void {
    this.entries.clear();
  }
  public size(): number {
    return this.entries.size;
  }
  public keys(): K[] {
    return Array.from(this.entries.keys());
  }
}
