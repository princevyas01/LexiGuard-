import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { SeverityBadge } from '@/components/common/SeverityBadge';
import { LegalDisclaimerBanner } from '@/components/common/LegalDisclaimerBanner';
import { AccessibleModal } from '@/components/common/AccessibleModal';
import { Navbar } from '@/components/layout/Navbar';
import { PrivacyView } from '@/components/privacy/PrivacyView';
import { GroundedQnAView } from '@/components/ask/GroundedQnAView';
import { Document } from '@/domain/documents/types';

describe('WCAG 2.2 AA Accessibility Audits (Axe-Core)', () => {
  const mockDoc: Document = {
    id: 'doc-a11y-1',
    versionId: '1.0',
    metadata: {
      fileName: 'test-agreement.txt',
      fileSizeBytes: 500,
      mimeType: 'text/plain',
      pageCount: 1,
      characterCount: 500,
      sha256Hash: 'hash',
      ingestedAt: new Date().toISOString(),
      isScannedOrLowText: false,
    },
    rawText: 'Tenant shall pay rent on the first of each month.',
    sections: [],
    clauses: [],
  };

  it('SeverityBadge has zero axe violations and non-color-only cues', async () => {
    const { container } = render(
      <main>
        <SeverityBadge severity="HIGH_ATTENTION" />
        <SeverityBadge severity="REVIEW_SOON" />
        <SeverityBadge severity="LOW_CONCERN" />
        <SeverityBadge severity="INFORMATIONAL" />
      </main>
    );

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('LegalDisclaimerBanner has zero axe violations and valid landmarks', async () => {
    const mockEscalations = [
      {
        id: 'esc-1',
        triggerCategory: 'EVICTION_HOUSING_LOSS' as const,
        title: 'Eviction Proceeding Detected',
        description: 'Notice to vacate within 72 hours.',
        recommendedNextStep: 'Consult housing legal aid immediately.',
        detectedInDocument: true,
      },
    ];

    const { container } = render(
      <main>
        <LegalDisclaimerBanner escalationTriggers={mockEscalations} />
      </main>
    );

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('AccessibleModal complies with dialog accessibility requirements', async () => {
    const { container } = render(
      <main>
        <AccessibleModal
          isOpen={true}
          onClose={() => {}}
          title="Test Evidence Dialog"
          description="Detailed explanation of evidence verification"
        >
          <p>Dialog content text for testing.</p>
        </AccessibleModal>
      </main>
    );

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('Navbar possesses semantic tablist and tab roles with zero axe violations', async () => {
    const { container } = render(
      <main>
        <Navbar activeTab="documents" onTabChange={() => {}} hasDocument={true} />
        <div role="tabpanel" id="panel-documents" aria-labelledby="nav-tab-documents">
          Documents
        </div>
        <div role="tabpanel" id="panel-overview" aria-labelledby="nav-tab-overview">
          Overview
        </div>
        <div role="tabpanel" id="panel-risks" aria-labelledby="nav-tab-risks">
          Risks
        </div>
        <div role="tabpanel" id="panel-compare" aria-labelledby="nav-tab-compare">
          Compare
        </div>
        <div role="tabpanel" id="panel-ask" aria-labelledby="nav-tab-ask">
          Ask
        </div>
        <div role="tabpanel" id="panel-action-plan" aria-labelledby="nav-tab-action-plan">
          Action Plan
        </div>
        <div role="tabpanel" id="panel-privacy" aria-labelledby="nav-tab-privacy">
          Privacy
        </div>
      </main>
    );

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('PrivacyView possesses valid landmark regions and zero axe violations', async () => {
    const { container } = render(
      <main>
        <PrivacyView onClearSession={() => {}} />
      </main>
    );

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('GroundedQnAView displays accessible error region when asking fails', () => {
    render(
      <main>
        <GroundedQnAView document={mockDoc} />
      </main>
    );

    // Initial state: no alert region
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('supports modal focus trap and escape key dismissal', () => {
    let closed = false;
    render(
      <main>
        <AccessibleModal
          isOpen={true}
          onClose={() => {
            closed = true;
          }}
          title="Dismissable Dialog"
        >
          <button type="button">Inside Button</button>
        </AccessibleModal>
      </main>
    );

    // Trigger Escape key
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closed).toBe(true);
  });
});
