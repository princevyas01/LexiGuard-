import { Document } from '@/domain/documents/types';
import { MAX_DOCUMENT_STORE_ENTRIES } from '@/security/quotas';

interface StoreEntry {
  document: Document;
  accessSequence: number;
}

/**
 * Ephemeral In-Memory Document Store with bounded capacity and LRU eviction.
 * Scoped to local runtime lifecycle. Stores zero data permanently to disk.
 */
export class InMemoryDocumentStore {
  private documents: Map<string, StoreEntry> = new Map();
  private readonly maxEntries: number;
  private accessCounter: number = 0;

  constructor(maxEntries: number = MAX_DOCUMENT_STORE_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  public save(document: Document): void {
    const seq = ++this.accessCounter;

    // If already exists, update and touch
    if (this.documents.has(document.id)) {
      this.documents.set(document.id, { document, accessSequence: seq });
      return;
    }

    // If at capacity, evict least recently accessed entry
    if (this.documents.size >= this.maxEntries) {
      this.evictLRU();
    }

    this.documents.set(document.id, { document, accessSequence: seq });
  }

  public get(id: string): Document | undefined {
    const entry = this.documents.get(id);
    if (!entry) return undefined;

    // Update access sequence for strict LRU tracking
    entry.accessSequence = ++this.accessCounter;
    return entry.document;
  }

  public delete(id: string): boolean {
    return this.documents.delete(id);
  }

  public clear(): void {
    this.documents.clear();
  }

  public list(): Document[] {
    return Array.from(this.documents.values()).map((e) => e.document);
  }

  public size(): number {
    return this.documents.size;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestSeq = Infinity;

    for (const [key, entry] of this.documents.entries()) {
      if (entry.accessSequence < oldestSeq) {
        oldestSeq = entry.accessSequence;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.documents.delete(oldestKey);
    }
  }
}

const globalForStore = globalThis as unknown as {
  documentStore?: InMemoryDocumentStore;
};

export const documentStore = globalForStore.documentStore ?? new InMemoryDocumentStore();

globalForStore.documentStore = documentStore;
