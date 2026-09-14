# LexiGuard Security Engineering & Verification

## 1. Security Architecture Baseline

LexiGuard uses **OWASP ASVS 5.0** (Application Security Verification Standard) and the **OWASP Top 10 for LLM Applications 2025** as its core threat model.

---

## 2. Implemented Security Controls

### 2.1 File & Ingestion Security (`src/security/file-validation.ts`)

- **Magic-Byte Content Verification**: Validates actual binary file headers rather than trusting file extensions alone:
  - PDF files must begin with `%PDF-` (`0x25, 0x50, 0x44, 0x46, 0x2D`).
  - DOCX files must begin with the ZIP PK signature (`0x50, 0x4B, 0x03, 0x04`).
  - Plain text files must contain valid UTF-8/ASCII bytes and zero null bytes (`0x00`).
- **Path Traversal & Filename Sanitization**: Filenames are normalized with Unicode NFKC, stripped of control characters, and purged of directory traversal sequences (`../`, `..\`).
- **Resource Bounds & Streaming Body Limit**:
  - Byte-level streaming request limit: strictly 6 MB (`MAX_REQUEST_BODY_BYTES`) via `createBoundedBodyRequest` with early reader cancellation upon quota breach.
  - Upload limit: strictly 5 MB.
  - DOCX archive decompression limit: 20 MB max, ratio < 10:1.
  - Maximum document page limit: 50 pages.
  - Maximum extracted characters: 100,000 characters.

### 2.2 Systemic Prompt Injection Defenses (`src/security/prompt-sanitizer.ts`)

- **Prompt Segregation**: System instructions, user goals, and untrusted document text are segregated into isolated XML blocks:
  `<SYSTEM_INSTRUCTIONS>`, `<USER_GOAL>`, and `<UNTRUSTED_DOCUMENT_CONTENT>`.
- **Delimiter Neutralization**: Document text is stripped of control characters and escaped if it attempts to break out of XML prompt framing.
- **Passive Document Principle**: All document text is framed as passive legal text; documents have zero authority to invoke tools, override developer directives, or trigger privileged actions.
- **Output Leakage Guard**: Generated model output is scanned for system prompt confidentiality breaches before being rendered.

### 2.3 Secret Management, Logging Hygiene & Provider Timeouts

- **Zero Hardcoded Secrets**: Configuration is validated once via `src/infrastructure/config/env.ts` using Zod.
- **Server-Side Isolation**: External LLM keys (`GEMINI_API_KEY`) remain strictly on the Node.js server and are never serialized to client bundles.
- **Payload-Free Logging**: Application logs record only timing, HTTP status codes, and anonymized correlation IDs. Raw contract texts, user questions, and API keys are strictly excluded from logs.
- **Bounded Operation Timeouts**: Both structured and text LLM operations are bounded by `OPERATION_TIMEOUT_MS` (30s) with guaranteed `clearTimeout` cleanup in `finally` blocks, leaving zero orphaned timer handles.

### 2.4 Browser Security Headers & Nonce CSP (`src/middleware.ts`)

- `Content-Security-Policy`: Centralized per-request nonce-based CSP with `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and `frame-ancestors 'none'`.
- `X-Frame-Options: DENY`: Defends against clickjacking.
- `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin`: Minimizes referrer leakage.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Disables unused hardware APIs.

### 2.5 PDF Parsing & Processing Boundaries

**PDF capability boundary**:
LexiGuard currently supports a constrained extractable-text PDF subset. PDF files that use unsupported encodings, compressed object streams, complex font mappings, or image-only content may produce incomplete extraction or a safe rejection. The application must not present incomplete extraction as complete legal text. Scanned or low-text PDFs must be explicitly flagged, and unsupported extraction must fail closed.

### 2.6 External Provider Resiliency & Outage Policy

**Provider failure**: external LLM errors are bounded by retry and timeout policy. The request fails closed with a controlled error; no unverified live response is substituted.
