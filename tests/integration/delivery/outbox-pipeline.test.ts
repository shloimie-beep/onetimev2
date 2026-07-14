import { describe, expect, it } from 'vitest';
import type {
  ClaimedDelivery,
  ReminderPreference,
} from '../../../packages/contracts/src/delivery/types.ts';
import { SinkDeliveryRouter } from '../../../apps/worker/src/delivery/sink-router.ts';
import { runDeliveryBatch } from '../../../apps/worker/src/delivery/worker.ts';
import { captureLogger } from '../../support/delivery/logger.ts';
import {
  MemoryDeliveryRepository,
  type MemorySeed,
} from '../../support/delivery/memory-repository.ts';
import {
  BASE_TIME,
  claimedDelivery,
  deliveryContact,
  deliverySignup,
} from '../../support/delivery/fixtures.ts';

function seed(claim: ClaimedDelivery): MemorySeed {
  const { claimLeaseExpiresAt, ...row } = claim;
  void claimLeaseExpiresAt;
  return { ...row, status: 'pending', nextAttemptAt: new Date(0), attempts: 0 };
}

function preferenceRows(preference: ReminderPreference): MemorySeed[] {
  const contact = deliveryContact({ reminderPreference: preference });
  return [
    seed(
      claimedDelivery({
        id: `${preference}-email`,
        deliveryKey: `delivery_${preference}_email`,
        eventType: 'email_acknowledgement',
        channel: 'email',
        contact,
      }),
    ),
    seed(
      claimedDelivery({
        id: `${preference}-whatsapp`,
        deliveryKey: `delivery_${preference}_whatsapp`,
        eventType: 'whatsapp_confirmation',
        channel: 'whatsapp',
        contact,
      }),
    ),
    seed(
      claimedDelivery({
        id: `${preference}-internal`,
        deliveryKey: `delivery_${preference}_internal`,
        eventType: 'internal_lead_alert',
        channel: 'internal_email',
        contact,
      }),
    ),
  ];
}

const messageConfig = {
  emailFrom: 'One Time <delivery@example.test>',
  emailReplyTo: 'reply@example.test',
  protectedOwnerEmail: 'owner@protected.test',
  currentClassLink: 'https://example.test/current-class',
};

const options = {
  accountKey: 'one_time',
  productKey: 'one_time_mishnah_class',
  batchSize: 25,
  concurrency: 4,
  claimLeaseMs: 120_000,
  providerTimeoutMs: 100,
  maxAttempts: 5,
};

describe('transactional delivery pipeline', () => {
  it.each([
    ['email', 2, 1],
    ['whatsapp', 3, 0],
    ['both', 3, 0],
    ['none', 2, 1],
  ] as const)(
    'enforces the %s preference matrix after rereading contact state',
    async (preference, sinkDelivered, skipped) => {
      const repository = new MemoryDeliveryRepository(preferenceRows(preference));
      const { logger } = captureLogger();
      const summary = await runDeliveryBatch({
        repository,
        router: new SinkDeliveryRouter(),
        logger,
        messageConfig,
        options,
        clock: () => BASE_TIME,
      });
      expect(summary).toMatchObject({
        claimed: 3,
        sinkDelivered,
        skipped,
        retried: 0,
        deadLettered: 0,
      });
      expect(repository.snapshot(`${preference}-internal`)?.status).toBe('sink_delivered');
      expect(repository.snapshot(`${preference}-email`)?.status).toBe('sink_delivered');
      expect(repository.snapshot(`${preference}-whatsapp`)?.status).toBe(
        preference === 'whatsapp' || preference === 'both' ? 'sink_delivered' : 'skipped',
      );
    },
  );

  it('suppresses public family confirmations while retaining the separate owner alert', async () => {
    const suppressedContact = deliveryContact({
      suppressionState: 'suppressed',
    });
    const rows = [
      seed(
        claimedDelivery({
          id: 'suppressed-public',
          deliveryKey: 'delivery_suppressed_public',
          contact: suppressedContact,
        }),
      ),
      seed(
        claimedDelivery({
          id: 'suppressed-owner',
          deliveryKey: 'delivery_suppressed_owner',
          channel: 'internal_email',
          eventType: 'internal_lead_alert',
          contact: suppressedContact,
        }),
      ),
    ];
    const repository = new MemoryDeliveryRepository(rows);
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router: new SinkDeliveryRouter(),
      logger,
      messageConfig,
      options,
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ suppressed: 1, sinkDelivered: 1 });
    expect(repository.snapshot('suppressed-public')?.status).toBe('suppressed');
    expect(repository.snapshot('suppressed-owner')?.status).toBe('sink_delivered');
  });

  it('skips public School class-link rows while preserving the owner alert', async () => {
    const schoolContact = deliveryContact({ familySchoolClassification: 'school' });
    const schoolSignup = deliverySignup({ classification: 'school' });
    const repository = new MemoryDeliveryRepository([
      seed(
        claimedDelivery({
          id: 'school-email',
          deliveryKey: 'delivery_school_email',
          channel: 'email',
          eventType: 'email_acknowledgement',
          contact: schoolContact,
          signup: schoolSignup,
        }),
      ),
      seed(
        claimedDelivery({
          id: 'school-whatsapp',
          deliveryKey: 'delivery_school_whatsapp',
          channel: 'whatsapp',
          eventType: 'whatsapp_confirmation',
          contact: schoolContact,
          signup: schoolSignup,
        }),
      ),
      seed(
        claimedDelivery({
          id: 'school-owner',
          deliveryKey: 'delivery_school_owner',
          channel: 'internal_email',
          eventType: 'internal_lead_alert',
          contact: schoolContact,
          signup: schoolSignup,
        }),
      ),
    ]);
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router: new SinkDeliveryRouter(),
      logger,
      messageConfig,
      options,
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ claimed: 3, skipped: 2, sinkDelivered: 1 });
    expect(repository.snapshot('school-email')?.outcome).toMatchObject({
      kind: 'skipped',
      reason: 'school_follow_up_requires_manual_review',
    });
    expect(repository.snapshot('school-whatsapp')?.outcome).toMatchObject({
      kind: 'skipped',
      reason: 'school_follow_up_requires_manual_review',
    });
    expect(repository.snapshot('school-owner')?.status).toBe('sink_delivered');
  });

  it('skips WhatsApp when normalized phone is missing without failing the batch', async () => {
    const repository = new MemoryDeliveryRepository([
      seed(
        claimedDelivery({
          id: 'missing-phone',
          deliveryKey: 'delivery_missing_phone',
          channel: 'whatsapp',
          eventType: 'whatsapp_confirmation',
          contact: deliveryContact({
            phoneNormalized: null,
            reminderPreference: 'whatsapp',
          }),
        }),
      ),
    ]);
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router: new SinkDeliveryRouter(),
      logger,
      messageConfig,
      options,
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ claimed: 1, skipped: 1 });
    expect(repository.snapshot('missing-phone')?.outcome).toMatchObject({
      kind: 'skipped',
      reason: 'whatsapp_phone_missing_or_invalid',
    });
  });
});
