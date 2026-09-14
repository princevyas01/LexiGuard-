# LexiGuard: Evidence-First Legal Document Intelligence & Action Navigation

**Prompt Wars Hackathon Submission** | **AI for Legal Assistance & Access**

LexiGuard is an evidence-grounded legal assistance system engineered to eliminate black-box hallucinations in legal analysis. Rather than producing casual or unsubstantiated summaries, LexiGuard connects every material AI assertion directly to verified, verbatim text excerpts within the uploaded document, extracts obligations and deadlines into structured tables, and generates a concrete action plan for professional legal consultation.

---

## 1. Problem Statement & Legal Information Friction
Non-lawyers, small business operators, and individuals regularly encounter dense legal documents (residential leases, vendor agreements, NDAs, and statutory notices) that present severe informational friction:
* **Ambiguous Terms & Concealed Risks**: Critical obligations (e.g. 15-day auto-renewal traps, unilateral modification clauses, uncapped indemnities) are buried inside legal jargon.
* **Black-Box AI Hallucinations**: Standard GenAI chat tools frequently confabulate deadlines, invent non-existent statutory protections, or advise users with false legal certainty.
* **Unstructured Output**: Generic chatbots produce blocks of unstructured prose that do not prepare the user with actionable next steps or targeted questions for legal counsel.
* **Security & Prompt Injection Risks**: Contracts uploaded to AI systems may contain embedded adversarial instructions attempting to compromise application prompts and extract confidential data.

LexiGuard solves these problems by surrounding generative models with deterministic parsing, strict XML prompt containment, lexical clause retrieval, verbatim evidence validation, and policy-driven risk rules.

---

## 2. Core Implemented Workflows

LexiGuard implements five tightly integrated workflows:

1. **Understand (Plain-Language Explanation)**:
   Translates complex legalese into clear, plain language while preserving legal modal force (*must*, *shall*, *may*), conditional dependencies, negations, and exact party definitions.
2. **Inspect (Structured Risk & Obligation Taxonomy)**:
   Detects risks across 17 distinct categories (Termination, Auto-Renewal, Unlimited Liability, Penalty Fees, Unilateral Modifications, etc.) in a two-column pattern: **"What the Document Says"** vs. **"Why It Matters"**, with clickable citations linking to the exact source clause.
3. **Compare (Semantic Clause-Level Contract Diff)**:
   Performs structural alignment between two contract versions (e.g. NDA v1.0 baseline vs v2.0 revision), classifying changes as `ADDED`, `REMOVED`, or `MODIFIED`, and highlighting material shifts in non-competes, liability caps, and dispute forums.
4. **Ask (Retrieval-Grounded Document Q&A)**:
   Answers user questions strictly from retrieved document clauses. Every answer categorizes claims as `DOCUMENT_FACT`, `DERIVED_INTERPRETATION`, or `GENERAL_INFORMATION`. If information is missing from the document, LexiGuard explicitly states: *"Insufficient evidence in the provided document."*
5. **Act (Action Navigator & Lawyer Consultation Sheet)**:
   Synthesizes immediate compliance deadlines into an interactive checklist, outlines records to gather, drafts targeted questions for legal counsel, and triggers emergency escalation warnings for high-stakes situations (eviction, 72-hour notices, court hearings).

---

## 3. System Architecture & Boundaries

LexiGuard strictly separates responsibilities into five layers:

```mermaid
graph TD
    UI[Next.js Accessible UI - A11y Focused]
    API[Server API Gateway]
    Security[Security Boundary: Magic Bytes, Quotas, Prompt Sanitizer]
    Parser[In-Memory Document Parser & Clause Segmenter]
    Retrieval[In-Memory BM25 Lexical Retriever]
    LLMPort[LLM Provider Port]
    Mock[Mock Provider - Offline Synthetic Fixtures]
    Live[Gemini Live Provider Adapter]
    Verifier[6-Layer Evidence Verifier]
    Policy[Deterministic Risk Policy Engine]

    UI -->|DTOs & User Events| API
    API -->|Validation & Rate Limiting| Security
    Security -->|Safe Buffer| Parser
    Parser -->|Structured Document| Retrieval
    Retrieval -->|Top-K Clause Chunks| LLMPort
    LLMPort -.->|Offline Mode| Mock
    LLMPort -.->|Live Mode| Live
    LLMPort -->|Raw JSON Draft| Verifier
    Verifier -->|Verbatim Offset Match| Policy
    Policy -->|Validated Findings & Action Plan| API
    API -->|Typed Responses| UI
```

### End-to-End Data Flow
```
Upload File / Choose Fixture
  │
  ▼
Security Validation (Magic bytes: %PDF-, PK Zip, UTF-8 text; 5MB size limit; Unicode NFKC normalization)
  │
  ▼
Safe Parsing & Segmentation (Isolates sections, sub-clauses, and exact character offsets)
  │
  ▼
Prompt Isolation (<SYSTEM_INSTRUCTIONS> + <USER_GOAL> + <UNTRUSTED_DOCUMENT_CONTENT>)
  │
  ▼
LLM Generation (Port-based invocation returning structured JSON conforming to Zod schemas)
  │
  ▼
Evidence Verification (Checks quoted text exists verbatim in source document at recorded offsets)
  │
  ▼
Deterministic Risk Policy (Normalizes severity for auto-renewal, uncapped liability, and penalties)
  │
  ▼
Accessible UI Rendering (Displays findings with clickable source quotes, obligations table, and action sheet)
```

---

## 4. Security Engineering Baseline (OWASP ASVS 5.0 & LLM Top 10)

* **Magic-Byte Content Validation**: File content is validated by inspection of binary signatures (`%PDF-`, `PK\x03\x04`), preventing disguised executable uploads regardless of extension.
* **Path Traversal & Injection Defense**: Filenames are normalized with Unicode NFKC and stripped of traversal characters (`../`, `..\`) and null bytes (`\x00`).
* **Decompression Limits (ZIP Bomb Defense)**: DOCX extractions are bounded to 20 MB uncompressed size with a strict 10:1 ratio budget.
* **Systemic Prompt Injection Defense**: Document text is treated as untrusted data. Escapes XML delimiters and neutralizes system override directives. Model output is scanned for system prompt confidentiality leaks.
* **Zero Secrets in Repository or Bundles**: Configuration is centralized in `src/infrastructure/config/env.ts`. No API keys or secrets are logged, committed to git, or sent to browser bundles.
* **Security Headers**: Production responses enforce strict Content-Security-Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.
* **Single-Process Rate Limiting**: In-memory token bucket limits requests to 30 req/min per IP to prevent automated flooding.

---

## 5. AI Safety & Hallucination Defense

LexiGuard implements a 6-layer hallucination defense architecture:
1. **Retrieval Grounding**: Generation prompts are bounded exclusively to relevant clauses retrieved by BM25 search.
2. **Explicit Evidence Fields**: Structured outputs mandate `exactQuotedText`, `startOffset`, `endOffset`, and `clauseId`.
3. **Verbatim Evidence Verifier**: The `EvidenceVerifier` ensures cited quotes exist character-for-character within the ground-truth document.
4. **Unsupported Claim Detector**: Findings lacking verbatim evidence are flagged as `INSUFFICIENT_EVIDENCE` and confidence `NOT_FOUND`.
5. **UI Confidence Treatment**: Unverified claims are prominently distinguished with warning indicators.
6. **Explicit Refusal Boundary**: When a user asks about topics unaddressed by the document (e.g. pet policies in a lease that mentions no animals), the system returns: *"Insufficient evidence in the provided document."*

---

## 6. Accessibility Engineering Baseline

* **Full Keyboard Operability**: Complete workflow (uploading, filtering, modal inspection, asking questions, print export) operable via `Tab`, `Shift+Tab`, `Enter`, `Space`, and `Escape`.
* **Accessible Modals**: Dialogs implement `role="dialog"`, `aria-modal="true"`, internal focus trapping, Escape key dismissal, and focus restoration to trigger elements.
* **Non-Color-Only Indicators**: Risk severity is communicated via `Icon + Text Label + Color` (`SeverityBadge`).
* **Screen Reader Live Regions**: Dynamic analysis progress and upload status use `aria-live="polite"` and `role="status"`.
* **Automated Axe-Core Audits**: Verified via automated `vitest-axe` component tests with 0 violations.
* **Responsive & Reduced Motion**: Full support for 200% browser zoom, 320px viewports, and `prefers-reduced-motion: reduce`.

---

## 7. Evaluator Demo Mode (100% Offline, Zero API Keys Required)

LexiGuard includes five pre-packaged synthetic contract fixtures in `fixtures/contracts/`:
1. **Residential Lease Agreement**: Demonstrates 15-day auto-renewal, $250 penalty fees, and landlord entry terms.
2. **Enterprise SaaS Agreement**: Demonstrates asymmetric liability ($100 cap vs unlimited customer liability), AI data training rights, and unilateral price adjustments.
3. **NDA Version Comparison**: Demonstrates side-by-side comparison of Apex NDA v1.0 vs v2.0 (added 2-year non-compete, deleted mutual indemnity, shifted jurisdiction to London).
4. **Trojan Prompt Injection Agreement**: Demonstrates defense against embedded jailbreak commands and system prompt overrides.
5. **Urgent Notice to Vacate**: Demonstrates contextual emergency escalation alerts for 72-hour eviction proceedings.

Judges can test all five contracts with 1-click buttons on the homepage without configuring any API keys or infrastructure.

---

## 8. Local Setup & Verification Commands

### Prerequisites
* Node.js `20.x` or `24.x`
* npm `10.x` or `11.x`

### Installation
```bash
# Clone repository
git clone <repo-url>
cd bold-brahmagupta

# Install pinned dependencies
npm ci
```

### Environment Configuration (Optional)
```bash
# Copy example environment file
cp .env.example .env.local

# Default mode is "mock" which requires ZERO credentials:
# LLM_PROVIDER=mock

# Optional: To use live Gemini models, set:
# LLM_PROVIDER=gemini
# GEMINI_API_KEY=your_gemini_api_key_here
```

### Verification & Quality Commands
```bash
# Run all unit tests
npm run test:unit

# Run integration pipeline tests
npm run test:integration

# Run security injection regression tests
npm run test:security

# Run axe-core accessibility audits
npm run test:a11y

# Run AI evaluation benchmark suite
npm run test:eval

# Run all test suites
npm run test:all

# Run complete quality gate (typecheck, lint, tests, build)
npm run quality

# Run submission verification gate (verifies branch count, repo size < 10MB, zero secrets)
npm run verify

# Run development server
npm run dev
# Open http://localhost:3000
```

---

## 9. Evaluation Alignment Matrix

| Hackathon Evaluation Criterion | Concrete Implementation Artifacts | Status |
| :--- | :--- | :---: |
| **Code Quality** | Strict TypeScript (`noImplicitAny`, zero `any`), ESLint 0 warnings, layered architecture (`src/domain/`, `src/application/`, `src/infrastructure/`). | **Verified Pass** |
| **Security** | Magic-byte file validation, ZIP-bomb protection, XML prompt injection containment, CSP headers, zero secrets in git. | **Verified Pass** |
| **Efficiency** | Lightweight pure TS parsing, BM25 retrieval, sub-second responses, bounded memory and token quotas. | **Verified Pass** |
| **Testing** | 88 Vitest tests + 24 Playwright flows (112 tests total) across unit, integration, security, axe accessibility, and AI evaluation benchmarks. | **Verified Pass** |
| **Accessibility** | WCAG 2.2 AA technical baseline, automated `axe-core` 0 violations, keyboard focus trap/restoration, non-color-only risk tags. | **Verified Pass** |
| **Product Utility** | 5 core legal workflows, two-column plain language explanations, obligations table, and lawyer consultation sheet. | **Verified Pass** |
| **AI Reliability** | 6-layer hallucination control, exact verbatim quote verifier, deterministic refusal on unmentioned topics, strict boundary disclaimers. | **Verified Pass** |
| **Demo Readiness** | 100% offline self-contained mock mode with 5 synthetic fixtures. Instant 1-click evaluator experience. | **Verified Pass** |
| **Repository Hygiene** | Single git branch (`master`), tracked repository size strictly `< 10 MB`, zero committed `.env` secrets. | **Verified Pass** |

---

## 10. Responsible Use & Legal Information Boundary
LexiGuard is an analytical document intelligence tool designed to assist users in understanding contract language and preparing informed questions for legal counsel. **LexiGuard does not provide formal legal advice, does not establish an attorney-client relationship, and does not replace the counsel of a licensed attorney.** High-stakes legal disputes (e.g. criminal matters, imminent eviction proceedings, court deadlines) trigger prominent contextual escalation warnings urging immediate consultation with professional legal aid.
