# LexiGuard Testing Strategy & Pyramid

## 1. Testing Philosophy

Testing in LexiGuard is not "write a few tests." The project implements a complete, rigorous **Testing Pyramid** covering every level of the system architecture: from low-level byte and regex validators to end-to-end browser journeys and AI evaluation benchmarks.

---

## 2. The Testing Pyramid

```
        /  E2E Browser Tests  \       <- Playwright (23 scenarios, Flows 75-97)
       /   AI Evaluation Suite  \      <- Groundedness, citation accuracy, injection benchmarks
      /   Accessibility Audits   \     <- Axe-Core automated WCAG 2.2 AA rules (7 audit tests)
     /  Integration Test Suites   \    <- Full ingestion, analysis, Q&A, comparison pipelines
    /      Security Regressions     \  <- Injection fuzzing, path traversal, rate limiting
   /__________Unit Tests_____________\ <- Magic bytes, offsets, segmenter, Zod schemas, env, LRU store
```

---

## 3. Test Suites & Descriptions (96 Automated Tests Total: 73 Vitest + 23 Playwright)

| Test Suite                     | Path                                           | Primary Purpose & Coverage                                                                                                         |
| :----------------------------- | :--------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **Unit: File Validation**      | `test/unit/file-validation.test.ts`            | Tests magic-byte verification (`%PDF-`, `PK\x03\x04`), 5MB size limits, and path traversal sanitization (`../../`).                |
| **Unit: Clause Segmenter**     | `test/unit/clause-segmenter.test.ts`           | Tests section header parsing, clause numbering, and exact character offset preservation.                                           |
| **Unit: Evidence Verifier**    | `test/unit/evidence-verifier.test.ts`          | Tests verbatim substring matching, offset resolution, and rejection of hallucinated quotes.                                        |
| **Unit: Request Schemas**      | `test/unit/request-schemas.test.ts`            | Tests strict Zod validation across boundary payloads, query lengths, and document IDs.                                             |
| **Unit: Environment Config**   | `test/unit/env-validation.test.ts`             | Tests fail-closed environment validation, default fallback values, and provider enforcement.                                       |
| **Unit: Document Store**       | `test/unit/document-store.test.ts`             | Tests ephemeral in-memory document store bounded capacity and monotonic LRU cache eviction.                                        |
| **Unit: Analysis Validation**  | `test/unit/validate-document-analysis.test.ts` | Tests verification pipeline filtering out ungrounded obligations and unverified deadlines.                                         |
| **Security: Prompt Injection** | `test/security/injection-security.test.ts`     | Tests direct injection, jailbreak keywords, XML delimiter escaping, and output leakage guards.                                     |
| **Security: Rate Limiter**     | `test/security/rate-limit.test.ts`             | Tests token bucket rate limiting, quota exhaustion, and independent IP tracking.                                                   |
| **Integration: Ingestion**     | `test/integration/ingestion-pipeline.test.ts`  | Tests end-to-end pipeline: raw file buffer ➔ parser ➔ segmenter ➔ LLM ➔ claim verification.                                        |
| **Integration: Q&A**           | `test/integration/qna-pipeline.test.ts`        | Tests BM25 clause retrieval, grounded answers with citations, and missing evidence refusals.                                       |
| **Integration: Comparison**    | `test/integration/comparison-pipeline.test.ts` | Tests semantic diffing between NDA v1 and v2, added non-competes, and deleted indemnities.                                         |
| **Accessibility: Axe-Core**    | `test/a11y/accessibility.test.tsx`             | Tests automated axe rules on `SeverityBadge`, `LegalDisclaimerBanner`, and `AccessibleModal`.                                      |
| **AI Evaluation Benchmark**    | `test/ai-eval/ai-evaluation.test.ts`           | Tests deterministic grounding regression: 100% schema validity, $\ge 95\%$ citation verification, and refusal on missing evidence. |
| **Playwright E2E**             | `test/e2e/full-journey.spec.ts`                | Tests 23 complete user journeys (Flows 75-97) covering upload, analysis, citations, modal traps, 320px, and print.                 |

---

## 4. Test Execution Commands

```bash
# Run all unit tests
npm run test:unit

# Run integration pipelines
npm run test:integration

# Run security injection regression tests
npm run test:security

# Run automated axe accessibility audits
npm run test:a11y

# Run AI evaluation benchmark suite
npm run test:eval

# Run all Vitest suites in one command
npm run test:all

# Run Playwright end-to-end browser tests
npm run test:e2e

# Run master quality gate (typecheck, lint, test:all, build)
npm run quality

# Run complete pre-submission verification gate
npm run verify
```
