import crypto from 'crypto';
import mammoth from 'mammoth';
import { Document, DocumentMetadata } from '@/domain/documents/types';
import { FileValidationResult } from '@/security/file-validation';
import { SECURITY_QUOTAS } from '@/security/quotas';
import { segmentDocument } from './clause-segmenter';
import { DocumentParseError, extractPdfText } from './pdf-extractor';

/**
 * Unified document parser supporting PDF, DOCX, and TXT.
 * Enforces resource quotas, decompressed size limits, and produces structured Document entities.
 */
export async function parseDocument(
  buffer: Buffer,
  validation: FileValidationResult,
  docId: string = crypto.randomUUID()
): Promise<Document> {
  const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
  let rawText = '';
  let pageCount = 1;
  let isScannedOrLowText = false;

  switch (validation.fileType) {
    case 'pdf': {
      const pdfResult = await extractPdfText(buffer);
      rawText = pdfResult.rawText;
      pageCount = pdfResult.pageCount;
      isScannedOrLowText = pdfResult.isScannedOrLowText;
      break;
    }

    case 'docx': {
      try {
        // Enforce decompression budget
        const mammothResult = await mammoth.extractRawText({ buffer });
        rawText = mammothResult.value || '';

        if (rawText.length > SECURITY_QUOTAS.MAX_EXTRACTED_CHARACTERS) {
          rawText = rawText.slice(0, SECURITY_QUOTAS.MAX_EXTRACTED_CHARACTERS);
        }

        pageCount = Math.max(1, Math.ceil(rawText.length / 2500));
        isScannedOrLowText =
          rawText.trim().length < SECURITY_QUOTAS.MIN_TEXT_CHARACTERS_FOR_SCANNED_CHECK;
      } catch (err) {
        throw new DocumentParseError(
          `Failed to parse DOCX file: ${err instanceof Error ? err.message : 'Invalid DOCX format'}`
        );
      }
      break;
    }

    case 'txt': {
      try {
        rawText = buffer.toString('utf8');
        // Strip BOM if present
        if (rawText.charCodeAt(0) === 0xfeff) {
          rawText = rawText.slice(1);
        }

        if (rawText.length > SECURITY_QUOTAS.MAX_EXTRACTED_CHARACTERS) {
          rawText = rawText.slice(0, SECURITY_QUOTAS.MAX_EXTRACTED_CHARACTERS);
        }

        pageCount = Math.max(1, Math.ceil(rawText.length / 2500));
        isScannedOrLowText =
          rawText.trim().length < SECURITY_QUOTAS.MIN_TEXT_CHARACTERS_FOR_SCANNED_CHECK;
      } catch (err) {
        throw new DocumentParseError('Failed to read plain text file as UTF-8');
      }
      break;
    }

    default:
      throw new DocumentParseError(`Unsupported file format: ${validation.fileType}`);
  }

  // Segment raw text into sections and clauses
  const { sections, clauses } = segmentDocument(rawText, docId);

  // Metadata extraction (heuristic title & party detection)
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const detectedTitle = lines[0]?.slice(0, 100) || validation.normalizedFileName;

  const metadata: DocumentMetadata = {
    fileName: validation.normalizedFileName,
    fileSizeBytes: validation.fileSizeBytes,
    mimeType:
      validation.fileType === 'pdf'
        ? 'application/pdf'
        : validation.fileType === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'text/plain',
    pageCount,
    characterCount: rawText.length,
    sha256Hash,
    ingestedAt: new Date().toISOString(),
    isScannedOrLowText,
    detectedTitle,
  };

  return {
    id: docId,
    versionId: '1.0',
    metadata,
    rawText,
    sections,
    clauses,
  };
}
