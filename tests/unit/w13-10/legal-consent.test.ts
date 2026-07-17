import { describe, expect, it } from 'vitest';
import { leadPayloadSchema } from '../../../packages/contracts/src/index.ts';
import {
  COMMUNICATION_CONSENT_POLICY_VERSION,
  legalNotices,
} from '../../../packages/domain/src/legal/policies.ts';

const basePayload = {
  contact_name: 'Parent Person',
  family_or_school: 'Dratler',
  audience_type: 'family',
  location: 'Jerusalem',
  timezone: 'Asia/Jerusalem',
  email: 'parent@example.com',
  phone: '',
  reminder_preference: 'none',
  reminder_consent: false,
  idempotency_key: 'unit-key-123',
};

describe('W13-10 legal and consent contracts', () => {
  it('publishes versioned counsel-review-ready notices without billing claims', () => {
    const copy = JSON.stringify(legalNotices);
    expect(legalNotices.privacy.reviewStatus).toBe('counsel_review_required');
    expect(legalNotices.communicationConsent.version).toBe(COMMUNICATION_CONSENT_POLICY_VERSION);
    expect(copy).toMatch(/retention, deletion, export/i);
    expect(copy).not.toMatch(/\$67|three seats|paid production checkout is active/i);
  });

  it('allows no optional reminders without inferring channel opt-in', () => {
    const result = leadPayloadSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reminder_preference).toBe('none');
      expect(result.data.reminder_consent).toBe(false);
    }
  });

  it('records channel-specific optional reminder consent metadata', () => {
    const result = leadPayloadSchema.safeParse({
      ...basePayload,
      phone: '+12025550123',
      reminder_preference: 'both',
      reminder_consent: true,
      consent_context: {
        policy_version: COMMUNICATION_CONSENT_POLICY_VERSION,
        purpose: 'optional_class_reminders',
        source: 'public_signup',
        channels: ['email', 'whatsapp'],
        captured_at: '2026-07-17T10:00:00.000Z',
        withdrawal_state: 'not_withdrawn',
        suppression_state: 'active',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.consent_context?.channels).toEqual(['email', 'whatsapp']);
    }
  });

  it('rejects optional reminder delivery when consent is absent', () => {
    const result = leadPayloadSchema.safeParse({
      ...basePayload,
      reminder_preference: 'email',
      reminder_consent: false,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === 'reminder_consent')).toBe(true);
  });
});
