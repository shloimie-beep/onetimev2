import type {
  ClaimedDelivery,
  DeliveryChannel,
  DeliveryContact,
  DeliverySignup,
} from '../../../packages/contracts/src/delivery/types.ts';

export const BASE_TIME = new Date('2026-07-14T12:00:00.000Z');

export function deliveryContact(overrides: Partial<DeliveryContact> = {}): DeliveryContact {
  return {
    contactKey: 'contact_fixture',
    displayName: 'Fixture Parent',
    familySchoolClassification: 'family',
    familyOrSchool: 'Fixture Family',
    locationText: 'Ramat Beit Shemesh',
    timezone: 'Asia/Jerusalem',
    emailNormalized: 'recipient@example.test',
    phoneNormalized: '+12025550123',
    reminderPreference: 'both',
    consentRecordedAt: new Date('2026-07-14T11:00:00.000Z'),
    suppressionState: 'active',
    ...overrides,
  };
}

export function deliverySignup(overrides: Partial<DeliverySignup> = {}): DeliverySignup {
  return {
    signupKey: 'signup_fixture',
    classification: 'family',
    metadata: {},
    ...overrides,
  };
}

export function claimedDelivery(overrides: Partial<ClaimedDelivery> = {}): ClaimedDelivery {
  const channel = overrides.channel ?? 'email';
  return {
    id: '11111111-1111-4111-8111-111111111111',
    deliveryKey: 'delivery_fixture',
    accountKey: 'one_time',
    productKey: 'one_time_mishnah_class',
    contactKey: 'contact_fixture',
    signupKey: 'signup_fixture',
    eventType: defaultEventForChannel(channel),
    channel,
    transportMode: 'sink',
    payload: {},
    attempts: 1,
    createdAt: new Date('2026-07-14T10:00:00.000Z'),
    claimLeaseExpiresAt: new Date('2026-07-14T12:02:00.000Z'),
    contact: deliveryContact(),
    signup: deliverySignup(),
    ...overrides,
  };
}

function defaultEventForChannel(channel: DeliveryChannel): string {
  if (channel === 'whatsapp') return 'whatsapp_confirmation';
  if (channel === 'internal_email') return 'internal_lead_alert';
  return 'email_acknowledgement';
}
