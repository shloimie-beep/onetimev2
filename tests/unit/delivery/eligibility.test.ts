import { describe, expect, it } from 'vitest';
import { DELIVERY_EVENT_TYPES } from '../../../packages/contracts/src/delivery/types.ts';
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
        eventType: DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation,
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
          eventType: DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation,
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

  it('allows family class reminder events only for family signup scope', () => {
    const email = evaluateDeliveryEligibility(
      claimedDelivery({
        eventType: DELIVERY_EVENT_TYPES.familyClassReminderEmail,
      }),
      'owner@protected.test',
    );
    const whatsapp = evaluateDeliveryEligibility(
      claimedDelivery({
        channel: 'whatsapp',
        eventType: DELIVERY_EVENT_TYPES.familyClassReminderWhatsApp,
      }),
      'owner@protected.test',
    );
    const schoolMismatch = evaluateDeliveryEligibility(
      claimedDelivery({
        eventType: DELIVERY_EVENT_TYPES.familyClassReminderEmail,
        contact: deliveryContact({ familySchoolClassification: 'school' }),
        signup: deliverySignup({ classification: 'school' }),
      }),
      'owner@protected.test',
    );

    expect(email).toMatchObject({ kind: 'eligible', channel: 'email' });
    expect(whatsapp).toMatchObject({ kind: 'eligible', channel: 'whatsapp' });
    expect(schoolMismatch).toMatchObject({ kind: 'skipped', reason: 'unsupported_event_type' });
  });

  it('requires recorded consent for WhatsApp', () => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        channel: 'whatsapp',
        eventType: DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation,
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
          eventType: DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation,
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

  it('rejects School public email rows because School gets only web ack and internal alert', () => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        contact: deliveryContact({ familySchoolClassification: 'school' }),
        eventType: DELIVERY_EVENT_TYPES.schoolSignupEmailAck,
        signup: deliverySignup({ classification: 'school' }),
      }),
      'owner@protected.test',
    );
    expect(result).toMatchObject({ kind: 'skipped', reason: 'unsupported_event_type' });
  });

  it('rejects School WhatsApp rows because WhatsApp is not a School receipt channel', () => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        channel: 'whatsapp',
        eventType: DELIVERY_EVENT_TYPES.schoolSignupWhatsAppReceipt,
        contact: deliveryContact({
          familySchoolClassification: 'school',
          reminderPreference: 'both',
        }),
        signup: deliverySignup({ classification: 'school' }),
      }),
      'owner@protected.test',
    );
    expect(result).toMatchObject({ kind: 'skipped', reason: 'unsupported_event_type' });
  });

  it('keeps school owner alerts eligible through the protected destination only', () => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        channel: 'internal_email',
        eventType: DELIVERY_EVENT_TYPES.internalLeadAlert,
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
      claimedDelivery({
        channel: 'email',
        eventType: DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation,
      }),
      undefined,
    );
    expect(mismatch).toMatchObject({ kind: 'skipped', reason: 'unsupported_event_type' });
  });

  it('rejects legacy generic event names and event/audience mismatches', () => {
    const legacy = evaluateDeliveryEligibility(
      claimedDelivery({ channel: 'email', eventType: 'email_acknowledgement' }),
      undefined,
    );
    expect(legacy).toMatchObject({ kind: 'skipped', reason: 'unsupported_event_type' });

    const audienceMismatch = evaluateDeliveryEligibility(
      claimedDelivery({
        channel: 'email',
        eventType: DELIVERY_EVENT_TYPES.schoolSignupEmailAck,
        signup: deliverySignup({ classification: 'family' }),
      }),
      undefined,
    );
    expect(audienceMismatch).toMatchObject({
      kind: 'skipped',
      reason: 'unsupported_event_type',
    });
  });

  it('requires the signup row to still be committed before public dispatch', () => {
    const result = evaluateDeliveryEligibility(
      claimedDelivery({
        signup: deliverySignup({ status: 'draft' }),
      }),
      undefined,
    );
    expect(result).toEqual({
      kind: 'skipped',
      channel: 'email',
      reason: 'signup_not_committed',
    });
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
