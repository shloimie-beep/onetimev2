import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AudienceReconciliationPanel } from '../../apps/web/src/client/features/audience-reconciliation/AudienceReconciliationPanel.tsx';
import { legacyAudienceSegmentContracts } from '../../packages/domain/src/audience-reconciliation/service.ts';
import type { LegacyAudienceSummary } from '../../packages/contracts/src/audience-reconciliation/index.ts';

describe('OT-74 audience reconciliation panel', () => {
  it('renders dry-run metrics and prepared segments without raw row values', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AudienceReconciliationPanel, {
        summary: summary(),
        segments: legacyAudienceSegmentContracts,
      }),
    );

    expect(markup).toContain('Audience Reconciliation');
    expect(markup).toContain('Dry-run only');
    expect(markup).toContain('Migration invite eligible');
    expect(markup).toContain('ot74_do_not_contact');
    expect(markup).toContain('Blocked');
    expect(markup).not.toContain('person@example.test');
    expect(markup).not.toContain('052-555');
  });
});

function summary(): LegacyAudienceSummary {
  return {
    total_rows: 4,
    unique_rows: 3,
    duplicate_rows: 1,
    matched_existing_contacts: 1,
    staged_new_contacts: 1,
    manual_review_rows: 1,
    school_follow_up_rows: 1,
    do_not_contact_rows: 1,
    migration_invite_eligible_rows: 1,
    active_legacy_user_rows: 2,
    reason_counts: {
      duplicate_input: 1,
      matched_by_email: 1,
      school_requires_follow_up: 1,
    },
    disposition_counts: {
      duplicate_input: 1,
      manual_review: 1,
      matched_existing_contact: 1,
      stage_new_contact: 1,
    },
    segment_counts: {
      active_legacy_user: 2,
      do_not_contact: 1,
      migration_invite_eligible: 1,
      school_follow_up: 1,
    },
  };
}
