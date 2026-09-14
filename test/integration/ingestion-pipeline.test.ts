import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { analyzeDocument } from '@/application/analysis/analyze-document';
import { parseDocument } from '@/infrastructure/parsing/document-parser';
import { validateUploadedFile } from '@/security/file-validation';

describe('Document Ingestion & Analysis Pipeline (Integration)', () => {
  it('parses, validates, and analyzes the synthetic residential lease fixture', async () => {
    const filePath = path.join(process.cwd(), 'fixtures/contracts/residential-lease.txt');
    const buffer = fs.readFileSync(filePath);

    // 1. File Validation
    const validation = validateUploadedFile(buffer, 'residential-lease.txt', 'text/plain');
    expect(validation.isValid).toBe(true);
    expect(validation.fileType).toBe('txt');

    // 2. Parse & Segment
    const document = await parseDocument(buffer, validation, 'lease-test-doc');
    expect(document.clauses.length).toBeGreaterThan(0);
    expect(document.metadata.fileName).toBe('residential-lease.txt');

    // 3. Analyze with Mock Provider
    const result = await analyzeDocument(document);
    expect(result.documentId).toBe('lease-test-doc');
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.obligations.length).toBeGreaterThan(0);
    expect(result.deadlines.length).toBeGreaterThan(0);

    // Verify that high attention risks were flagged
    const highRisks = result.findings.filter((f) => f.severity === 'HIGH_ATTENTION');
    expect(highRisks.length).toBeGreaterThan(0);

    // Verify evidence is attached
    for (const finding of highRisks) {
      expect(finding.sourceSpans.length).toBeGreaterThan(0);
      expect(finding.isVerified).toBe(true);
    }
  });

  it('detects prompt injection attempt in adversarial contract fixture', async () => {
    const filePath = path.join(process.cwd(), 'fixtures/contracts/adversarial-contract.txt');
    const buffer = fs.readFileSync(filePath);

    const validation = validateUploadedFile(buffer, 'adversarial-contract.txt', 'text/plain');
    const document = await parseDocument(buffer, validation, 'adversarial-doc');

    const result = await analyzeDocument(document);
    expect(result.isHostilePromptDetected).toBe(true);
    expect(result.detectedPromptThreats.length).toBeGreaterThan(0);
  });
});
