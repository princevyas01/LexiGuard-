import { MAX_DECOMPRESSED_ARCHIVE_BYTES, MAX_UPLOAD_BYTES } from './quotas';

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

export type SupportedFileType = 'pdf' | 'docx' | 'txt';

export interface FileValidationResult {
  isValid: boolean;
  fileType: SupportedFileType;
  normalizedFileName: string;
  fileSizeBytes: number;
}

const FILENAME_ALLOWLIST = /^[a-zA-Z0-9_\-. ]+$/;

/**
 * Normalizes filename to prevent directory traversal, control characters, and validate against allowlist.
 */
export function normalizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return 'document.txt';
  }

  // Unicode NFKC normalization
  let clean = fileName.normalize('NFKC');

  // Strip control characters and non-printable characters
  // eslint-disable-next-line no-control-regex
  clean = clean.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

  // Strip path traversal sequences (../, ..\, etc.)
  clean = clean.replace(/(\.\.[/\\])+/g, '');
  clean = clean.replace(/[/\\]/g, '_');

  // Trim whitespace and collapse consecutive underscores
  clean = clean.trim().replace(/_+/g, '_');

  if (!clean || clean === '.') {
    return 'document.txt';
  }

  // Enforce allowlist on the final normalized basename
  if (!FILENAME_ALLOWLIST.test(clean)) {
    // Replace any remaining disallowed characters with underscore
    clean = clean.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  }

  return clean.slice(0, 255);
}

/**
 * Inspects ZIP container headers to enforce entry count, total decompressed size,
 * and compression ratio limits BEFORE decompression occurs.
 */
export function validateZipContainer(buffer: Buffer): void {
  const MAX_ENTRIES = 500;
  const MAX_RATIO = 100;

  let offset = 0;
  let entryCount = 0;
  let totalUncompressedBytes = 0;

  while (offset + 30 <= buffer.length) {
    // Check Local File Header signature 0x04034b50 (PK\x03\x04)
    if (
      buffer[offset] === 0x50 &&
      buffer[offset + 1] === 0x4b &&
      buffer[offset + 2] === 0x03 &&
      buffer[offset + 3] === 0x04
    ) {
      entryCount++;
      if (entryCount > MAX_ENTRIES) {
        throw new FileValidationError(
          `DOCX archive contains too many files (${entryCount} > ${MAX_ENTRIES}), potential zip bomb rejected.`
        );
      }

      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const fileNameLength = buffer.readUInt16LE(offset + 26);
      const extraFieldLength = buffer.readUInt16LE(offset + 28);

      totalUncompressedBytes += uncompressedSize;
      if (totalUncompressedBytes > MAX_DECOMPRESSED_ARCHIVE_BYTES) {
        throw new FileValidationError(
          `DOCX aggregate decompressed size (${(totalUncompressedBytes / (1024 * 1024)).toFixed(
            1
          )} MB) exceeds maximum allowed decompression budget of ${
            MAX_DECOMPRESSED_ARCHIVE_BYTES / (1024 * 1024)
          } MB.`
        );
      }

      if (compressedSize > 0) {
        const ratio = uncompressedSize / compressedSize;
        if (ratio > MAX_RATIO) {
          throw new FileValidationError(
            `DOCX file entry has excessive compression ratio (${ratio.toFixed(1)}:1 > ${MAX_RATIO}:1), potential zip bomb rejected.`
          );
        }
      }

      // Jump to next local header
      offset += 30 + fileNameLength + extraFieldLength + compressedSize;
    } else {
      // Advance to search for central directory or next header
      offset++;
    }
  }
}

/**
 * Validates file magic bytes to verify genuine file format rather than relying on extension.
 */
export function detectMagicBytes(buffer: Buffer): SupportedFileType {
  if (!buffer || buffer.length === 0) {
    throw new FileValidationError('File buffer is empty');
  }

  // PDF Magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return 'pdf';
  }

  // DOCX (ZIP PK signature): 0x50 0x4B 0x03 0x04
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    // Validate zip container budgets
    validateZipContainer(buffer);
    return 'docx';
  }

  // Plain text validation: reject NUL bytes and ensure valid UTF-8
  if (buffer.includes(0x00)) {
    throw new FileValidationError('Plain text file rejected: contains forbidden NUL (0x00) bytes.');
  }

  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(buffer);
    return 'txt';
  } catch {
    throw new FileValidationError(
      'Unsupported or dangerous file content. Only text-based PDF, DOCX, and valid UTF-8 TXT files are accepted.'
    );
  }
}

/**
 * Comprehensive file security validation.
 */
export function validateUploadedFile(
  buffer: Buffer,
  declaredFileName: string,
  _declaredMimeType?: string
): FileValidationResult {
  // 1. Size validation
  if (buffer.length === 0) {
    throw new FileValidationError('File is empty (0 bytes).');
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new FileValidationError(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${
        MAX_UPLOAD_BYTES / (1024 * 1024)
      } MB.`
    );
  }

  // 2. Normalized filename with allowlist
  const normalizedFileName = normalizeFileName(declaredFileName);

  // 3. Content-based magic byte detection & zip bomb defense
  const detectedType = detectMagicBytes(buffer);

  // 4. Extension check against detected content type
  const lowerName = normalizedFileName.toLowerCase();
  if (detectedType === 'pdf' && !lowerName.endsWith('.pdf')) {
    throw new FileValidationError(
      'File content is PDF, but filename does not have .pdf extension.'
    );
  }
  if (detectedType === 'docx' && !lowerName.endsWith('.docx')) {
    throw new FileValidationError(
      'File content is DOCX, but filename does not have .docx extension.'
    );
  }

  return {
    isValid: true,
    fileType: detectedType,
    normalizedFileName,
    fileSizeBytes: buffer.length,
  };
}
