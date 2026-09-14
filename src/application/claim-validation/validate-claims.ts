import { Document } from '@/domain/documents/types';
import { AnalysisFinding, EvidenceSpan, RiskSeverity } from '@/domain/findings/types';
import { EvidenceVerifier } from '@/infrastructure/evidence/verifier';

export function validateAnalysisFindings(
  findings: AnalysisFinding[],
  document: Document
): AnalysisFinding[] {
  const verifier = new EvidenceVerifier(document);
  return findings.map((finding) => {
    const verifiedSpans: EvidenceSpan[] = [];
    let hasDirectProof = false;

    for (const rawSpan of finding.sourceSpans) {
      const check = verifier.verifySpan(rawSpan);
      if (!check.isValid) continue;
      verifiedSpans.push(check.resolvedSpan);
      hasDirectProof ||= check.resolvedSpan.confidenceState === 'DIRECTLY_STATED';
    }

    const verifiedSource = verifiedSpans
      .map((span) => span.sourceTextSpan)
      .join('\n')
      .toLowerCase();
    const policy = deriveRiskPolicyFromVerifiedSource(finding, verifiedSource);
    const isVerified = verifiedSpans.length > 0;

    return {
      ...finding,
      sourceSpans: verifiedSpans,
      severity: isVerified ? policy.severity : 'REVIEW_SOON',
      confidence: hasDirectProof
        ? 'DIRECTLY_STATED'
        : isVerified
          ? 'STRONGLY_IMPLIED'
          : 'NOT_FOUND',
      isVerified,
      policyReason: isVerified
        ? policy.reason
        : 'Evidence rejected: no supplied evidence span could be verified against the current document.',
    };
  });
}

function deriveRiskPolicyFromVerifiedSource(
  finding: AnalysisFinding,
  verifiedSource: string
): { severity: RiskSeverity; reason: string } {
  if (
    verifiedSource.includes('unlimited liability') ||
    verifiedSource.includes('uncapped liability')
  ) {
    return {
      severity: 'HIGH_ATTENTION',
      reason: 'Verified source text contains uncapped liability language.',
    };
  }

  if (
    finding.category === 'AUTO_RENEWAL' &&
    /(notice|notify|written notice|non-renew)/i.test(verifiedSource)
  ) {
    return {
      severity: 'HIGH_ATTENTION',
      reason: 'Verified source text contains an auto-renewal notice requirement.',
    };
  }

  if (/late fee|penalty/i.test(verifiedSource)) {
    return {
      severity: 'HIGH_ATTENTION',
      reason: 'Verified source text contains recurring fee or penalty language.',
    };
  }

  return {
    severity: finding.severity,
    reason:
      'Severity preserved because no stronger deterministic policy rule was triggered by verified source text.',
  };
}
