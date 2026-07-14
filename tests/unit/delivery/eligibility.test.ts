import { describe, expect, it } from 'vitest';
import { evaluateDeliveryEligibility } from '../../../packages/domain/src/delivery/eligibility.ts';
import {
  claimedDelivery,
  deliveryContact,
  deliverySignup,
} from '../../support/delivery/fixtures.ts';

describe('delivery eligibility', () => {
  it.each([
    ['email', 'whatsapp_preference_not_selected'],
    ['none', 'whatsapp_preference_not_selected'],
  ] as const)('rejects a WhatsApp outbox row for %s preference', (preference, reason) => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        channel: 'whatsapp',
        eventType: 'whatsapp_confirmation',
        contact: deliveryContact({ reminderPreference: preference }),
      }),
      'owner@protected.test',
    );
    expect(result).toMatchObject({ kind: 'skipped', reason });
  });

  it.each(['whatsapp', 'both'] as const)(
    'allows an eligible public WhatsApp recipient for %s preference',
    (preference) => {
      const result = evaluateDeliveryEligibility(
        claimedDelivery({
          channel: 'whatsapp',
          eventType: 'whatsapp_confirmation',
          contact: deliveryContact({ reminderPreference: preference }),
        }),
        'owner@protected.test',
      );
      expect(result).toEqual({
        kind: 'eligible',
        channel: 'whatsapp',
        recipientClass: 'public',
        to: '+12025550123',
      });
    },
  );

  it('requires recorded consent for WhatsApp', () => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        channel: 'whatsapp',
        eventType: 'whatsapp_confirmation',
        contact: deliveryContact({ consentRecordedAt: null }),
      }),
      undefined,
    );
    expect(result).toMatchObject({
      kind: 'skipped',
      reason: 'whatsapp_consent_missing',
    });
  });

  it.each([null, '', '+12', '020 555 0123'])(
    'rejects a missing or invalid normalized WhatsApp phone: %s',
    (phone) => {
      const result = evaluateDeliveryEligibility(
        claimedDelivery({
          channel: 'whatsapp',
          eventType: 'whatsapp_confirmation',
          contact: deliveryContact({ phoneNormalized: phone }),
        }),
        undefined,
      );
      expect(result).toMatchObject({
        kind: 'skipped',
        reason: 'whatsapp_phone_missing_or_invalid',
      });
    },
  );

  it.each(['suppressed', 'unsubscribed', 'blocked'])(
    'suppresses public family delivery for state %s',
    (state) => {
      const result = evaluateDeliveryEligibility(
        claimedDelivery({
          contact: deliveryContact({ suppressionState: state }),
        }),
        undefined,
      );
      expect(result).toEqual({
        kind: 'suppressed',
        channel: 'email',
        reason: 'contact_suppressed',
      });
    },
  );

  it('allows school public email acknowledgement through the generic template path', () => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        contact: deliveryContact({ familySchoolClassification: 'school' }),
        signup: deliverySignup({ classification: 'school' }),
      }),
      'owner@protected.test',
    );
    expect(result).toEqual({
      kind: 'eligible',
      channel: 'email',
      recipientClass: 'public',
      to: 'recipient@example.test',
    });
  });

  it('allows eligible school WhatsApp receipts through the generic template path', () => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        channel: 'whatsapp',
        eventType: 'whatsapp_confirmation',
        contact: deliveryContact({
          familySchoolClassification: 'school',
          reminderPreference: 'both',
        }),
        signup: deliverySignup({ classification: 'school' }),
      }),
      'owner@protected.test',
    );
    expect(result).toEqual({
      kind: 'eligible',
      channel: 'whatsapp',
      recipientClass: 'public',
      to: '+12025550123',
    });
  });

  it('keeps school owner alerts eligible through the protected destination only', () => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        channel: 'internal_email',
        eventType: 'internal_lead_alert',
        contact: deliveryContact({
          familySchoolClassification: 'school',
          emailNormalized: 'public@example.test',
        }),
        signup: deliverySignup({ classification: 'school' }),
      }),
      'Owner.Alert@Protected.Test',
    );
    expect(result).toEqual({
      kind: 'eligible',
      channel: 'internal_email',
      recipientClass: 'internal_owner',
      to: 'owner.alert@protected.test',
    });
  });

  it('rejects provider-mode and event/channel mismatches before message building', () => {
    const providerMode = evaluateDeliveryEligibility(
      claimedDelivery({ transportMode: 'provider' }),
      undefined,
    );
    expect(providerMode).toMatchObject({ kind: 'skipped', reason: 'unsupported_event_type' });

    const mismatch = evaluateDeliveryEligibility(
      claimedDelivery({ channel: 'email', eventType: 'whatsapp_confirmation' }),
      undefined,
    );
    expect(mismatch).toMatchObject({ kind: 'skipped', reason: 'unsupported_event_type' });
  });

  it('fails closed for archived contacts before public delivery', () => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        contact: deliveryContact({
          leadStatus: 'archived',
          archivedAt: new Date('2026-07-14T11:30:00.000Z'),
        }),
      }),
      undefined,
    );
    expect(result).toEqual({
      kind: 'skipped',
      channel: 'email',
      reason: 'contact_archived',
    });
  });
});
