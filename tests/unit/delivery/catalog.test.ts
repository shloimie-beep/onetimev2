import { describe, expect, it } from 'vitest';
import { DELIVERY_EVENT_TYPES } from '../../../packages/contracts/src/delivery/types.ts';
import {
  ACTIVE_DELIVERY_MESSAGE_KEYS,
  DAY_ONE_COMMUNICATIONS_CATALOG,
  DAY_ONE_MESSAGE_KEYS,
  messageKeyForDeliveryEvent,
  protectedAppUrlFromPayload,
} from '../../../packages/domain/src/delivery/catalog.ts';

describe('OT80 Day-One communications catalog', () => {
  it('preserves the 19-record archive coverage while exposing only active delivery keys', () => {
    expect(DAY_ONE_MESSAGE_KEYS).toHaveLength(19);
    expect(DAY_ONE_COMMUNICATIONS_CATALOG.source.archive_sha256).toBe(
      'ba1ffe027c4f89e93133fdb3a1a4511b971e52d4441b06b758022cbd1876440d',
    );
    expect(ACTIVE_DELIVERY_MESSAGE_KEYS).toEqual([
      'family.ack.email',
      'family.ack.whatsapp',
      'class.reminder.t30.email',
      'class.reminder.t30.whatsapp',
      'owner.alert.family_lead',
      'owner.alert.school_lead',
    ]);
  });

  it('maps delivery events without creating School public delivery templates', () => {
    expect(messageKeyForDeliveryEvent(DELIVERY_EVENT_TYPES.familySignupEmailAck, 'family')).toBe(
      'family.ack.email',
    );
    expect(messageKeyForDeliveryEvent(DELIVERY_EVENT_TYPES.internalLeadAlert, 'school')).toBe(
      'owner.alert.school_lead',
    );
    expect(messageKeyForDeliveryEvent(DELIVERY_EVENT_TYPES.schoolSignupEmailAck, 'school')).toBe(
      null,
    );
  });

  it('allows only protected One Time app routes for class access copy', () => {
    expect(
      protectedAppUrlFromPayload({
        protected_join_url: 'https://join.onetimeonetime.com/app/classes/today',
      }),
    ).toBe('https://join.onetimeonetime.com/app/classes/today');
    expect(protectedAppUrlFromPayload({ protected_join_url: '/app/classes/today' })).toBe(
      '/app/classes/today',
    );
    expect(protectedAppUrlFromPayload({ protected_join_url: 'https://zoom.us/j/123' })).toBeNull();
    expect(
      protectedAppUrlFromPayload({
        protected_join_url: 'https://join.onetimeonetime.com/app/classes/today?token=secret',
      }),
    ).toBeNull();
  });
});
