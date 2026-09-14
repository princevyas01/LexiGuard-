import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { compareContracts } from '@/application/comparison/compare-contracts';
import { parseDocument } from '@/infrastructure/parsing/document-parser';
import { validateUploadedFile } from '@/security/file-validation';

describe('Semantic Contract Comparison Pipeline (Integration)', () => {
  it('compares NDA v1 and NDA v2 and detects substantive clause changes', async () => {
    const v1Path = path.join(process.cwd(), 'fixtures/contracts/nda-v1.txt');
    const v2Path = path.join(process.cwd(), 'fixtures/contracts/nda-v2.txt');

    const buf1 = fs.readFileSync(v1Path);
    const buf2 = fs.readFileSync(v2Path);

    const val1 = validateUploadedFile(buf1, 'nda-v1.txt', 'text/plain');
    const val2 = validateUploadedFile(buf2, 'nda-v2.txt', 'text/plain');

    const doc1 = await parseDocument(buf1, val1, 'doc-nda-1');
    const doc2 = await parseDocument(buf2, val2, 'doc-nda-2');

    const result = await compareContracts(doc1, doc2);

    expect(result.findings.length).toBeGreaterThanOrEqual(3);
    expect(result.summary).toContain('Version 2.0');

    // Verify change types
    const addedFinding = result.findings.find((f) => f.changeType === 'ADDED');
    const removedFinding = result.findings.find((f) => f.changeType === 'REMOVED');
    const modifiedFinding = result.findings.find((f) => f.changeType === 'MODIFIED');

    expect(addedFinding).toBeDefined();
    expect(removedFinding).toBeDefined();
    expect(modifiedFinding).toBeDefined();

    // Verify that added finding is classified cautiously
    expect(addedFinding?.materiality).toBe('NEW_OBLIGATION');
    expect(addedFinding?.severity).toBe('HIGH_ATTENTION');
  });
});
