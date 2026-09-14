import {
  MAX_DOCUMENT_PAGES,
  MAX_EXTRACTED_CHARACTERS,
  MAX_PDF_STREAM_BYTES,
  MIN_TEXT_CHARACTERS_FOR_SCANNED_CHECK,
} from '@/security/quotas';

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentParseError';
  }
}

export interface ExtractedDocumentContent {
  rawText: string;
  pageCount: number;
  characterCount: number;
  isScannedOrLowText: boolean;
}

/**
 * Stream-based PDF text extractor for text-based legal documents.
 * Parses PDF streams, extracts text operands (BT...ET / Tj / TJ),
 * counts pages, enforces resource quotas, detects encrypted files, and flags scanned documents.
 * Note: Scanned image-only PDFs require OCR which is beyond this lightweight parser's scope.
 */
export async function extractPdfText(buffer: Buffer): Promise<ExtractedDocumentContent> {
  if (!buffer || buffer.length === 0) {
    throw new DocumentParseError('PDF buffer is empty');
  }

  if (buffer.length > MAX_PDF_STREAM_BYTES) {
    throw new DocumentParseError(
      `PDF file size (${(buffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds stream parsing limit of ${
        MAX_PDF_STREAM_BYTES / (1024 * 1024)
      } MB.`
    );
  }

  try {
    const rawContent = buffer.toString('binary');

    // Reject encrypted or password-protected PDFs
    if (rawContent.includes('/Encrypt')) {
      throw new DocumentParseError('Encrypted or password-protected PDF files are not supported.');
    }

    // 1. Calculate page count via /Type /Page references
    const pageMatches = rawContent.match(/\/Type\s*\/Page[^s]/g) || [];
    let pageCount = pageMatches.length;
    if (pageCount === 0) {
      // Fallback: check /Count N in Pages dict
      const countMatch = rawContent.match(/\/Count\s+(\d+)/);
      if (countMatch && countMatch[1]) {
        pageCount = parseInt(countMatch[1], 10);
      } else {
        pageCount = 1;
      }
    }

    if (pageCount > MAX_DOCUMENT_PAGES) {
      throw new DocumentParseError(
        `PDF page count (${pageCount}) exceeds maximum allowed limit of ${MAX_DOCUMENT_PAGES} pages.`
      );
    }

    // 2. Extract text streams between BT (Begin Text) and ET (End Text)
    const textPieces: string[] = [];
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    // Hoist regexes outside stream loop to avoid per-iteration recompilation
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    const arrayRegex = /\[([^\]]+)\]\s*TJ/g;
    const innerLiteralRegex = /\(([^)]+)\)/g;
    let streamMatch: RegExpExecArray | null;

    while ((streamMatch = streamRegex.exec(rawContent)) !== null) {
      const streamData = streamMatch[1];

      // Extract string literals in parentheses (text) Tj or TJ
      tjRegex.lastIndex = 0;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(streamData)) !== null) {
        textPieces.push(tjMatch[1]);
      }

      // Extract array text in TJ arrays: [(text) 20 (more text)] TJ
      arrayRegex.lastIndex = 0;
      let arrMatch: RegExpExecArray | null;
      while ((arrMatch = arrayRegex.exec(streamData)) !== null) {
        const innerArray = arrMatch[1];
        innerLiteralRegex.lastIndex = 0;
        let litMatch: RegExpExecArray | null;
        while ((litMatch = innerLiteralRegex.exec(innerArray)) !== null) {
          textPieces.push(litMatch[1]);
        }
      }
    }

    let extractedText = textPieces.join(' ').replace(/\\([()\\])/g, '$1');

    // If stream search didn't yield text, check for text strings between delimiters
    if (extractedText.trim().length === 0) {
      const textMatches = rawContent.match(/\(([a-zA-Z0-9\s.,;:'"!?()\-–—]{4,})\)/g) || [];
      extractedText = textMatches
        .map((m) => m.slice(1, -1))
        .join(' ')
        .replace(/\\([()\\])/g, '$1');
    }

    // 3. Enforce character quotas
    if (extractedText.length > MAX_EXTRACTED_CHARACTERS) {
      extractedText = extractedText.slice(0, MAX_EXTRACTED_CHARACTERS);
    }

    // 4. Scanned/image-only document detection — cache trimmed text
    const trimmedText = extractedText.trim();
    const isScannedOrLowText = trimmedText.length < MIN_TEXT_CHARACTERS_FOR_SCANNED_CHECK;

    return {
      rawText: trimmedText,
      pageCount: Math.max(1, pageCount),
      characterCount: extractedText.length,
      isScannedOrLowText,
    };
  } catch (error) {
    if (error instanceof DocumentParseError) {
      throw error;
    }
    throw new DocumentParseError(
      `Failed to parse PDF document safely: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
