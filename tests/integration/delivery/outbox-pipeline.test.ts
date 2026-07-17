import { describe, expect, it } from 'vitest';
import { DELIVERY_EVENT_TYPES } from '../../../packages/contracts/src/delivery/types.ts';
import type {
  ClaimedDelivery,
  DeliveryProviderRouter,
  DeliveryRequest,
  ProviderReceipt,
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
        eventType: DELIVERY_EVENT_TYPES.familySignupEmailAck,
        channel: 'email',
        contact,
      }),
    ),
    seed(
      claimedDelivery({
        id: `${preference}-whatsapp`,
        deliveryKey: `delivery_${preference}_whatsapp`,
        eventType: DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation,
        channel: 'whatsapp',
        contact,
      }),
    ),
    seed(
      claimedDelivery({
        id: `${preference}-internal`,
        deliveryKey: `delivery_${preference}_internal`,
        eventType: DELIVERY_EVENT_TYPES.internalLeadAlert,
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

class CapturingRouter implements DeliveryProviderRouter {
  readonly requests: DeliveryRequest[] = [];

  async send(request: DeliveryRequest): Promise<ProviderReceipt> {
    this.requests.push(request);
    return {
      provider: 'sink',
      acceptedAt: BASE_TIME,
      sink: true,
    };
  }
}

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
          eventType: DELIVERY_EVENT_TYPES.internalLeadAlert,
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

  it('delivers Family immediate receipts without resolving a class URL', async () => {
    const router = new CapturingRouter();
    const repository = new MemoryDeliveryRepository([
      seed(
        claimedDelivery({
          id: 'family-email',
          deliveryKey: 'delivery_family_email',
          eventType: DELIVERY_EVENT_TYPES.familySignupEmailAck,
          channel: 'email',
          contact: deliveryContact({ reminderPreference: 'none', consentRecordedAt: null }),
        }),
      ),
      seed(
        claimedDelivery({
          id: 'family-whatsapp',
          deliveryKey: 'delivery_family_whatsapp',
          eventType: DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation,
          channel: 'whatsapp',
          contact: deliveryContact({ reminderPreference: 'whatsapp' }),
        }),
      ),
    ]);
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router,
      logger,
      messageConfig,
      options,
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ claimed: 2, skipped: 0, sinkDelivered: 2 });
    const publicText = router.requests.map((request) => request.text).join('\n');
    expect(publicText).toContain('Your Family signup has been saved.');
    expect(publicText).not.toContain('https://example.test/current-class');
    expect(publicText).not.toMatch(/open the current class|class details|access is ready|join/i);
  });

  it('skips School public receipt rows while preserving the owner alert', async () => {
    const schoolContact = deliveryContact({ familySchoolClassification: 'school' });
    const schoolSignup = deliverySignup({ classification: 'school' });
    const router = new CapturingRouter();
    const repository = new MemoryDeliveryRepository([
      seed(
        claimedDelivery({
          id: 'school-email',
          deliveryKey: 'delivery_school_email',
          channel: 'email',
          eventType: DELIVERY_EVENT_TYPES.schoolSignupEmailAck,
          contact: schoolContact,
          signup: schoolSignup,
        }),
      ),
      seed(
        claimedDelivery({
          id: 'school-whatsapp',
          deliveryKey: 'delivery_school_whatsapp',
          channel: 'whatsapp',
          eventType: DELIVERY_EVENT_TYPES.schoolSignupWhatsAppReceipt,
          contact: schoolContact,
          signup: schoolSignup,
        }),
      ),
      seed(
        claimedDelivery({
          id: 'school-owner',
          deliveryKey: 'delivery_school_owner',
          channel: 'internal_email',
          eventType: DELIVERY_EVENT_TYPES.internalLeadAlert,
          contact: schoolContact,
          signup: schoolSignup,
        }),
      ),
    ]);
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router,
      logger,
      messageConfig,
      options,
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ claimed: 1, skipped: 0, sinkDelivered: 1 });
    expect(repository.snapshot('school-email')?.status).toBe('pending');
    expect(repository.snapshot('school-whatsapp')?.status).toBe('pending');
    expect(repository.snapshot('school-owner')?.status).toBe('sink_delivered');
    expect(router.requests.filter((request) => request.recipientClass === 'public')).toHaveLength(
      0,
    );
    const internalText = router.requests.map((request) => request.text).join('\n');
    expect(internalText).toContain('A new School lead was committed successfully.');
    expect(internalText).not.toMatch(/class details|reminder|access|join|https?:\/\//i);
  });

  it('skips WhatsApp when normalized phone is missing without failing the batch', async () => {
    const repository = new MemoryDeliveryRepository([
      seed(
        claimedDelivery({
          id: 'missing-phone',
          deliveryKey: 'delivery_missing_phone',
          channel: 'whatsapp',
          eventType: DELIVERY_EVENT_TYPES.familySignupWhatsAppConfirmation,
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

  it.each(['email', 'none'] as const)(
    'skips School WhatsApp receipt when preference is %s',
    async (preference) => {
      const repository = new MemoryDeliveryRepository([
        seed(
          claimedDelivery({
            id: `school-whatsapp-${preference}`,
            deliveryKey: `delivery_school_whatsapp_${preference}`,
            eventType: DELIVERY_EVENT_TYPES.schoolSignupWhatsAppReceipt,
            channel: 'whatsapp',
            contact: deliveryContact({
              familySchoolClassification: 'school',
              reminderPreference: preference,
            }),
            signup: deliverySignup({ classification: 'school' }),
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
      expect(summary).toMatchObject({ claimed: 0, skipped: 0, sinkDelivered: 0 });
      expect(repository.snapshot(`school-whatsapp-${preference}`)?.status).toBe('pending');
    },
  );

  it('skips class reminders until a protected One Time route is available', async () => {
    const router = new CapturingRouter();
    const repository = new MemoryDeliveryRepository([
      seed(
        claimedDelivery({
          id: 'class-reminder-missing-link',
          deliveryKey: 'delivery_class_reminder_missing_link',
          eventType: DELIVERY_EVENT_TYPES.familyClassReminderEmail,
          channel: 'email',
          payload: { starts_at: '2026-07-15T16:00:00.000Z' },
        }),
      ),
    ]);
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router,
      logger,
      messageConfig,
      options,
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ claimed: 1, skipped: 1, sinkDelivered: 0 });
    expect(router.requests).toHaveLength(0);
    expect(repository.snapshot('class-reminder-missing-link')?.outcome).toMatchObject({
      kind: 'skipped',
      reason: 'protected_link_missing',
    });
  });

  it('renders class reminders only with protected One Time routes', async () => {
    const router = new CapturingRouter();
    const repository = new MemoryDeliveryRepository([
      seed(
        claimedDelivery({
          id: 'class-reminder-protected-link',
          deliveryKey: 'delivery_class_reminder_protected_link',
          eventType: DELIVERY_EVENT_TYPES.familyClassReminderEmail,
          channel: 'email',
          payload: {
            starts_at: '2026-07-15T16:00:00.000Z',
            protected_join_url: 'https://join.onetimeonetime.com/app/classes/today',
          },
        }),
      ),
    ]);
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router,
      logger,
      messageConfig,
      options,
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ claimed: 1, skipped: 0, sinkDelivered: 1 });
    expect(router.requests[0]?.text).toContain('https://join.onetimeonetime.com/app/classes/today');
    expect(JSON.stringify(router.requests)).not.toMatch(/zoom|vimeo|drive|token|secret/i);
  });

  it('skips an expired deliver_by row without sending', async () => {
    const router = new CapturingRouter();
    const repository = new MemoryDeliveryRepository([
      seed(
        claimedDelivery({
          id: 'expired-email',
          deliveryKey: 'delivery_expired_email',
          payload: { deliver_by: '2026-07-14T11:59:00.000Z', policy_version: 'test' },
        }),
      ),
    ]);
    const { logger } = captureLogger();
    const summary = await runDeliveryBatch({
      repository,
      router,
      logger,
      messageConfig,
      options,
      clock: () => BASE_TIME,
    });
    expect(summary).toMatchObject({ claimed: 1, skipped: 1, sinkDelivered: 0 });
    expect(router.requests).toHaveLength(0);
    expect(repository.snapshot('expired-email')?.outcome).toMatchObject({
      kind: 'skipped',
      reason: 'delivery_window_expired',
    });
  });
});
