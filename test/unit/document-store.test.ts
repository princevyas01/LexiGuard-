import { describe, it, expect } from 'vitest';
import { InMemoryDocumentStore } from '@/infrastructure/storage/in-memory-store';
import { Document } from '@/domain/documents/types';

describe('InMemoryDocumentStore (Bounded Memory & LRU Eviction)', () => {
  function makeMockDoc(id: string): Document {
    return {
      id,
      versionId: '1.0',
      metadata: {
        fileName: `${id}.txt`,
        fileSizeBytes: 100,
        mimeType: 'text/plain',
        pageCount: 1,
        characterCount: 100,
        sha256Hash: `hash-${id}`,
        ingestedAt: new Date().toISOString(),
        isScannedOrLowText: false,
      },
      rawText: `Document content for ${id}`,
      sections: [],
      clauses: [],
    };
  }

  it('bounds total entries and evicts least recently accessed document', () => {
    // Capacity of 3 entries
    const store = new InMemoryDocumentStore(3);

    store.save(makeMockDoc('doc-1'));
    store.save(makeMockDoc('doc-2'));
    store.save(makeMockDoc('doc-3'));

    expect(store.size()).toBe(3);

    // Access doc-1 so it is recently accessed
    store.get('doc-1');

    // Adding 4th document should evict doc-2 (the least recently used)
    store.save(makeMockDoc('doc-4'));

    expect(store.size()).toBe(3);
    expect(store.get('doc-1')).toBeDefined();
    expect(store.get('doc-2')).toBeUndefined();
    expect(store.get('doc-3')).toBeDefined();
    expect(store.get('doc-4')).toBeDefined();
  });
});
