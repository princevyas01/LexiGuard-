import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { answerDocumentQuestion } from '@/application/qna/answer-document-question';
import { parseDocument } from '@/infrastructure/parsing/document-parser';
import { validateUploadedFile } from '@/security/file-validation';

describe('Document Q&A Retrieval Pipeline (Integration)', () => {
  const filePath = path.join(process.cwd(), 'fixtures/contracts/residential-lease.txt');
  const buffer = fs.readFileSync(filePath);
  const validation = validateUploadedFile(buffer, 'residential-lease.txt', 'text/plain');

  it('answers a grounded question with verbatim cited evidence', async () => {
    const document = await parseDocument(buffer, validation, 'qna-test-doc');
    const response = await answerDocumentQuestion(document, 'What happens if rent is paid late?');

    expect(response.answer).toContain('late penalty');
    expect(response.claimType).toBe('DOCUMENT_FACT');
    expect(response.confidence).toBe('DIRECTLY_STATED');
    expect(response.isEvidenceSufficient).toBe(true);
    expect(response.supportingSpans.length).toBeGreaterThan(0);
    expect(response.legalBoundaryDisclaimer).toContain('cannot determine the legal outcome');
  });

  it('returns explicit missing evidence response when question asks about absent topics', async () => {
    const document = await parseDocument(buffer, validation, 'qna-test-doc');
    const response = await answerDocumentQuestion(
      document,
      'Does the contract allow pets or dogs?'
    );

    expect(response.answer).toContain('Insufficient evidence in the provided document');
    expect(response.claimType).toBe('INSUFFICIENT_EVIDENCE');
    expect(response.confidence).toBe('NOT_FOUND');
    expect(response.isEvidenceSufficient).toBe(false);
  });

  it('enforces legal advice boundary when user asks whether to sue', async () => {
    const document = await parseDocument(buffer, validation, 'qna-test-doc');
    const response = await answerDocumentQuestion(document, 'Should I sue the landlord?');

    expect(response.answer).toContain('cannot determine the legal outcome');
    expect(response.answer).toContain('qualified lawyer');
  });
});
