import { describe, it, expect } from 'vitest';
import {
  detectMagicBytes,
  normalizeFileName,
  validateUploadedFile,
  validateZipContainer,
  FileValidationError,
} from '@/security/file-validation';

describe('File Validation Security Controls', () => {
  it('detects genuine PDF magic bytes (%PDF-)', () => {
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
    expect(detectMagicBytes(pdfHeader)).toBe('pdf');
  });

  it('detects genuine DOCX magic bytes (PK Zip signature) with valid container', () => {
    // A minimal valid zip header: 30 bytes
    const docxHeader = Buffer.alloc(30);
    docxHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    docxHeader.writeUInt32LE(100, 18); // compressed size 100
    docxHeader.writeUInt32LE(200, 22); // uncompressed size 200 (ratio 2:1)
    docxHeader.writeUInt16LE(0, 26); // name length
    docxHeader.writeUInt16LE(0, 28); // extra length

    expect(detectMagicBytes(docxHeader)).toBe('docx');
  });

  it('rejects DOCX with excessive compression ratio (zip bomb attack)', () => {
    const bombHeader = Buffer.alloc(30);
    bombHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    bombHeader.writeUInt32LE(10, 18); // compressed size 10
    bombHeader.writeUInt32LE(10_000_000, 22); // uncompressed 10MB (ratio 1,000,000:1)

    expect(() => validateZipContainer(bombHeader)).toThrow(/excessive compression ratio/);
  });

  it('detects clean UTF-8 text files', () => {
    const textBuffer = Buffer.from(
      'RESIDENTIAL LEASE AGREEMENT\nBetween Landlord and Tenant.',
      'utf8'
    );
    expect(detectMagicBytes(textBuffer)).toBe('txt');
  });

  it('rejects plain text files containing NUL bytes', () => {
    const textWithNul = Buffer.from('Contract text\x00with hidden exploit', 'utf8');
    expect(() => detectMagicBytes(textWithNul)).toThrow(/contains forbidden NUL/);
  });

  it('rejects executable / binary formats with null bytes or control codes', () => {
    const binaryBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01, 0x02]); // ELF executable
    expect(() => detectMagicBytes(binaryBuffer)).toThrow(FileValidationError);
  });

  it('normalizes filenames and prevents directory traversal attacks', () => {
    expect(normalizeFileName('../../../etc/passwd')).toBe('etc_passwd');
    expect(normalizeFileName('..\\..\\windows\\system32\\cmd.exe')).toBe(
      'windows_system32_cmd.exe'
    );
    expect(normalizeFileName('contract\x00_hidden.txt')).toBe('contract_hidden.txt');
    expect(normalizeFileName('  test-agreement.pdf  ')).toBe('test-agreement.pdf');
  });

  it('enforces allowlist on final normalized filename', () => {
    expect(normalizeFileName('legal;rm -rf;contract.txt')).toBe('legal_rm -rf_contract.txt');
  });

  it('rejects oversized files exceeding 5MB limit', () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    expect(() => validateUploadedFile(largeBuffer, 'large.txt')).toThrow(FileValidationError);
  });

  it('rejects empty files (0 bytes)', () => {
    const emptyBuffer = Buffer.alloc(0);
    expect(() => validateUploadedFile(emptyBuffer, 'empty.txt')).toThrow(FileValidationError);
  });
});
