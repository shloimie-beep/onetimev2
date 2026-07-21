import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../packages/config/src/index.ts';
import {
  buildHighLevelSupportProducerEvent,
  signHighLevelSupportEvent,
} from '../../../packages/domain/src/highlevel/support-producer.ts';
import {
  applyHighLevelEntitlementEvent,
  createInitialEntitlementProjection,
} from '../../../packages/domain/src/highlevel/entitlements.ts';
import {
  buildHighLevelContactUrl,
  HighLevelProviderError,
  HttpHighLevelClient,
  MockHighLevelClient,
} from '../../../packages/domain/src/highlevel/client.ts';
import {
  assertHighLevelProviderReady,
  inspectHighLevelReadiness,
} from '../../../packages/domain/src/highlevel/config.ts';
import {
  assertNoStudentPayload,
  decideHighLevelContactMatch,
  normalizeHighLevelEmail,
  normalizeHighLevelPhone,
} from '../../../packages/domain/src/highlevel/normalization.ts';
import {
  buildHighLevelLeadOutboxIntent,
  enqueueHighLevelOutbox,
} from '../../../packages/domain/src/highlevel/outbox.ts';
import {
  signHighLevelWebhook,
  verifyHighLevelWebhook,
} from '../../../packages/domain/src/highlevel/webhook.ts';
import {
  buildResendBacklogInventory,
  planResendBackfill,
} from '../../../packages/domain/src/highlevel/resend-backlog.ts';
import { planManualUploadMapping } from '../../../packages/domain/src/highlevel/mapping.ts';
import {
  isHighLevelReconciliationCronAllowed,
  runHighLevelReconciliation,
} from '../../../packages/domain/src/highlevel/reconciliation.ts';
import {
  botActionWorkflows,
  businessWorkflows,
  contactFields,
  customValues,
  eventDefinitions,
  lowercaseTagDeprecations,
  messageClasses,
  pipelineDefinitions,
  registryMetadata,
  senderProfiles,
  tags,
} from '../../../scripts/highlevel/canonical-registry-data.ts';
import { createMemoryPool, runMigrations } from '../../../packages/db/src/index.ts';

const baseEnv = {
  NODE_ENV: 'test',
  PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
  APP_VERSION: 'test',
  COMMIT_SHA: 'test',
};

function config(overrides: Record<string, string> = {}) {
  return loadConfig({ ...baseEnv, ...overrides });
}

function providerConfig() {
  return config({
    HIGHLEVEL_MODE: 'provider',
    HIGHLEVEL_LOCATION_ID: 'loc_test_123',
    HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'pit_test_token_123456',
    HIGHLEVEL_OUTBOUND_WEBHOOK_SECRET: 'test-highlevel-webhook-secret',
    HIGHLEVEL_SYNC_ENABLED: 'true',
  });
}

describe('HighLevel configuration modes', () => {
  it('defaults disabled without requiring credentials', () => {
    const loaded = config();
    expect(loaded.highLevelMode).toBe('disabled');
    expect(loaded.highLevelSyncEnabled).toBe(false);
    expect(inspectHighLevelReadiness(loaded)).toMatchObject({
      ready: true,
      mode: 'disabled',
      tokenConfigured: false,
      locationConfigured: false,
    });
  });

  it('fails closed when disabled mode tries to sync', () => {
    expect(() => config({ HIGHLEVEL_SYNC_ENABLED: 'true' })).toThrow(/HighLevel sync/);
  });

  it('fails closed when provider mode is missing protected config', () => {
    expect(() => config({ HIGHLEVEL_MODE: 'provider' })).toThrow(
      /HIGHLEVEL_LOCATION_ID, HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN/,
    );
  });

  it('accepts provider mode only with exact protected config', () => {
    const loaded = providerConfig();
    expect(() => assertHighLevelProviderReady(loaded)).not.toThrow();
    expect(inspectHighLevelReadiness(loaded)).toMatchObject({
      ready: true,
      mode: 'provider',
      tokenConfigured: true,
      locationConfigured: true,
    });
  });
});

describe('HighLevel contact contract', () => {
  it('normalizes contact identity and matches email before phone', () => {
    expect(normalizeHighLevelEmail(' Parent@Example.COM ')).toBe('parent@example.com');
    expect(normalizeHighLevelPhone('050-123-4567')).toBe('+972501234567');
    expect(
      decideHighLevelContactMatch({
        identity: { email: 'parent@example.com', phone: '+972501234567' },
        byEmail: { id: 'contact_email' },
        byPhone: { id: 'contact_email' },
      }),
    ).toEqual({ disposition: 'match_email', contactId: 'contact_email' });
  });

  it('detects email and phone conflicts and never matches by name', () => {
    expect(
      decideHighLevelContactMatch({
        identity: { email: 'parent@example.com', phone: '+972501234567' },
        byEmail: { id: 'contact_email' },
        byPhone: { id: 'contact_phone' },
      }),
    ).toEqual({
      disposition: 'sync_conflict',
      emailContactId: 'contact_email',
      phoneContactId: 'contact_phone',
    });
    expect(decideHighLevelContactMatch({ identity: { email: null, phone: null } })).toEqual({
      disposition: 'no_identity',
    });
  });

  it('excludes students from HighLevel payloads', () => {
    expect(() => assertNoStudentPayload({ studentKeys: ['student_1'] })).toThrow(/Students/);
    expect(() =>
      buildHighLevelLeadOutboxIntent({
        config: config({ HIGHLEVEL_MODE: 'mock', HIGHLEVEL_SYNC_ENABLED: 'true' }),
        contactKey: 'contact_1',
        signupKey: 'signup_1',
        email: 'parent@example.com',
        phone: null,
        source: 'website',
        marketing: { emailOptIn: true, whatsappOptIn: false, suppressed: false },
        studentKeys: ['student_1'],
      }),
    ).toThrow(/Students/);
  });

  it('mocks upsert, dedicated tag changes, and workflow enrollment', async () => {
    const client = new MockHighLevelClient();
    const contact = await client.upsertContact({
      identity: { email: ' Parent@Example.COM ', phone: '050-123-4567' },
      customFields: { 'One Time Parent ID': 'contact_1' },
    });
    await client.addTags(contact.id, ['OT | Lead', 'OT | Prelaunch']);
    await client.removeTags(contact.id, ['OT | Prelaunch']);
    await client.addContactToWorkflow(contact.id, 'workflow_new_lead');

    expect(await client.searchContact({ email: 'parent@example.com' })).toHaveLength(1);
    expect((await client.getContact(contact.id))?.tags).toEqual(['OT | Lead']);
    expect(client.workflowEnrollments).toEqual([
      { contactId: contact.id, workflowId: 'workflow_new_lead', action: 'add' },
    ]);
  });

  it('redacts provider errors and retries only retryable failures', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) return new Response('{}', { status: 429 });
      return new Response(JSON.stringify({ contact: { id: 'contact_retry' } }), { status: 200 });
    };
    const client = new HttpHighLevelClient(
      config({
        HIGHLEVEL_MODE: 'provider',
        HIGHLEVEL_LOCATION_ID: 'loc_test_123',
        HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: 'pit_secret_should_not_leak',
        HIGHLEVEL_OUTBOUND_WEBHOOK_SECRET: 'test-highlevel-webhook-secret',
        HIGHLEVEL_MAX_RETRIES: '1',
      }),
      fetchImpl,
    );

    await expect(client.getContact('contact_retry')).resolves.toMatchObject({
      id: 'contact_retry',
    });
    expect(calls).toBe(2);

    const unauthorized = new HttpHighLevelClient(providerConfig(), async () => {
      return new Response('{}', { status: 401 });
    });
    await expect(unauthorized.getContact('contact_1')).rejects.toMatchObject({
      code: 'highlevel_unauthorized',
      retryable: false,
    } satisfies Partial<HighLevelProviderError>);
    await expect(unauthorized.getContact('contact_1')).rejects.not.toThrow(/pit_test_token/);
  });

  it('builds a safe Open in HighLevel URL', () => {
    expect(buildHighLevelContactUrl('loc 1', 'contact/1')).toContain(
      '/v2/location/loc%201/contacts/detail/contact%2F1',
    );
  });
});

describe('HighLevel outbox and webhook contract', () => {
  it('builds minimized signup outbox payloads with dedicated tags', async () => {
    const pool = createMemoryPool();
    await runMigrations(pool);
    try {
      const intent = buildHighLevelLeadOutboxIntent({
        config: config({ HIGHLEVEL_MODE: 'mock', HIGHLEVEL_SYNC_ENABLED: 'true' }),
        contactKey: 'contact_1',
        signupKey: 'signup_1',
        email: 'parent@example.com',
        phone: '+972501234567',
        source: 'website',
        marketing: { emailOptIn: true, whatsappOptIn: true, suppressed: false },
      });
      expect(await enqueueHighLevelOutbox(pool, intent)).toBe('inserted');
      expect(await enqueueHighLevelOutbox(pool, intent)).toBe('duplicate');
      const countRows = await pool.query(
        'SELECT count(*)::int AS count FROM onetime.highlevel_outbox_events',
      );
      const payloadRows = await pool.query(
        'SELECT protected_payload FROM onetime.highlevel_outbox_events LIMIT 1',
      );
      expect(rowCount(countRows.rows[0].count)).toBe(1);
      expect(JSON.stringify(payloadRows.rows[0].protected_payload)).not.toMatch(/student/i);
    } finally {
      await pool.end();
    }
  });

  it('verifies strict webhook signatures, timestamps, allowlists, and content type', () => {
    const loaded = providerConfig();
    const now = new Date('2026-07-20T10:00:00.000Z');
    const payload = {
      provider_event_id: 'evt_payment_failed_1',
      event_type: 'payment.failed',
      location_id: 'loc_test_123',
      contact_id: 'contact_123',
      subscription_id: 'sub_123',
      occurred_at: now.toISOString(),
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const signature = signHighLevelWebhook({
      rawBody,
      timestamp,
      secret: String(loaded.highLevelOutboundWebhookSecret),
    });

    expect(
      verifyHighLevelWebhook({
        config: loaded,
        rawBody,
        headers: {
          contentType: 'application/json',
          signature,
          timestamp,
          eventId: 'evt_payment_failed_1',
        },
        now,
      }),
    ).toMatchObject({ ok: true });
    expect(
      verifyHighLevelWebhook({
        config: loaded,
        rawBody,
        headers: { contentType: 'text/plain', signature, timestamp },
        now,
      }),
    ).toEqual({ ok: false, code: 'CONTENT_TYPE_REJECTED', status: 415 });
  });
});

describe('HighLevel entitlement rules', () => {
  it('applies prelaunch, grace, recovered, cancellation, refund, and chargeback rules', () => {
    const initial = createInitialEntitlementProjection({
      householdKey: 'household_1',
      ghlContactId: 'contact_1',
      now: new Date('2026-07-20T10:00:00.000Z'),
    });
    expect(initial).toMatchObject({
      status: 'complimentary',
      complimentaryUntil: '2026-09-13T23:59:00+03:00',
    });

    const failed = applyHighLevelEntitlementEvent(initial, {
      eventType: 'payment.failed',
      occurredAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    expect(failed).toMatchObject({
      status: 'grace',
      reason: 'failed_renewal_7_day_grace',
      graceUntil: '2026-10-08T00:00:00.000Z',
    });

    const recovered = applyHighLevelEntitlementEvent(failed, {
      eventType: 'payment.recovered',
      occurredAt: new Date('2026-10-03T00:00:00.000Z'),
    });
    expect(recovered.status).toBe('active');
    expect(recovered.graceUntil).toBeNull();

    const canceled = applyHighLevelEntitlementEvent(recovered, {
      eventType: 'subscription.canceled',
      occurredAt: new Date('2026-10-04T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-10-20T00:00:00.000Z'),
    });
    expect(canceled).toMatchObject({
      status: 'active',
      reason: 'canceled_through_current_period_end',
    });

    expect(
      applyHighLevelEntitlementEvent(canceled, {
        eventType: 'refund.full',
        occurredAt: new Date('2026-10-05T00:00:00.000Z'),
      }),
    ).toMatchObject({ status: 'inactive', reason: 'full_refund' });
    expect(
      applyHighLevelEntitlementEvent(canceled, {
        eventType: 'chargeback',
        occurredAt: new Date('2026-10-05T00:00:00.000Z'),
      }),
    ).toMatchObject({ status: 'inactive', reason: 'chargeback_immediate_revoke' });
    expect(
      applyHighLevelEntitlementEvent(canceled, {
        eventType: 'refund.partial',
        occurredAt: new Date('2026-10-05T00:00:00.000Z'),
      }),
    ).toMatchObject({ status: 'active', reason: 'partial_refund_manual_review' });
  });

  it('allows only Owner/Rabbi complimentary grants', () => {
    const initial = createInitialEntitlementProjection({
      householdKey: 'household_1',
      ghlContactId: 'contact_1',
      now: new Date('2026-07-20T10:00:00.000Z'),
    });
    expect(() =>
      applyHighLevelEntitlementEvent(initial, {
        eventType: 'complimentary.granted',
        occurredAt: new Date('2026-08-01T00:00:00.000Z'),
        actorRole: 'admin',
      }),
    ).toThrow(/forbidden/);
    expect(
      applyHighLevelEntitlementEvent(initial, {
        eventType: 'complimentary.granted',
        occurredAt: new Date('2026-08-01T00:00:00.000Z'),
        actorRole: 'rabbi',
      }),
    ).toMatchObject({ status: 'complimentary' });
  });
});

describe('HighLevel recovery and import models', () => {
  it('bounds nightly reconciliation by cron, cursor, page, and item budgets', async () => {
    expect(isHighLevelReconciliationCronAllowed('0 3 * * *')).toBe(true);
    expect(isHighLevelReconciliationCronAllowed('0 2 * * *')).toBe(false);
    const result = await runHighLevelReconciliation({
      config: config({
        HIGHLEVEL_MODE: 'mock',
        HIGHLEVEL_RECONCILIATION_ENABLED: 'true',
        HIGHLEVEL_RECONCILIATION_MAX_ITEMS: '1',
        HIGHLEVEL_RECONCILIATION_MAX_PAGES: '2',
      }),
      client: new MockHighLevelClient(),
      cursor: {
        lastSubscriptionCursor: null,
        lastTransactionCursor: null,
        lastSeenAt: null,
      },
      now: new Date('2026-07-20T10:00:00.000Z'),
    });
    expect(result).toMatchObject({
      status: 'circuit_open',
      externalMutations: 0,
    });
  });

  it('plans manual upload mapping as counts-only and never creates duplicates', () => {
    const plan = planManualUploadMapping({
      localParents: [
        {
          parentUserKey: 'parent_1',
          householdKey: 'household_1',
          email: 'parent@example.com',
          phone: '050-123-4567',
        },
        {
          parentUserKey: 'parent_2',
          householdKey: 'household_2',
          email: 'missing@example.com',
          phone: null,
        },
      ],
      highLevelContacts: [
        { id: 'contact_email', email: 'parent@example.com', phone: null, tags: [] },
        { id: 'contact_phone', email: null, phone: '+972501234567', tags: [] },
      ],
    });
    expect(plan.mode).toBe('counts_only');
    expect(plan.createsContacts).toBe(false);
    expect(plan.updatesHighLevel).toBe(false);
    expect(plan.counts).toEqual({ link: 0, sync_conflict: 1, not_found: 1 });
  });

  it('builds Resend backlog inventory and later backfill model without public bodies', () => {
    const inventory = buildResendBacklogInventory({
      receivingEnabled: true,
      messages: [
        {
          messageId: 'msg_1',
          from: 'parent@example.com',
          subject: 'Parent class signup',
          receivedAt: '2026-07-19T10:00:00.000Z',
          hasAttachments: false,
        },
        {
          messageId: 'msg_1',
          from: 'parent@example.com',
          subject: 'Parent class signup',
          receivedAt: '2026-07-19T10:00:00.000Z',
          hasAttachments: false,
        },
        {
          messageId: 'msg_2',
          from: 'mailer@example.net',
          subject: 'newsletter unsubscribe',
          receivedAt: '2026-07-18T10:00:00.000Z',
          hasAttachments: true,
        },
      ],
    });
    expect(inventory.publicOutputContainsBodies).toBe(false);
    expect(inventory.attachmentDownloads).toBe(0);
    expect(inventory.rows).toHaveLength(2);
    expect(inventory.countsByClass).toMatchObject({ lead_parent: 1, newsletter: 1 });
    expect(planResendBackfill({ inventory, ghlCredentialsReady: true })).toMatchObject({
      ready: true,
      suppressNewLeadAndNewMessageAutomations: true,
      excluded: 1,
    });
  });

  it('redacts support producer events before signing', () => {
    const event = buildHighLevelSupportProducerEvent({
      ticketId: 'ticket_123456',
      accountKey: 'one_time',
      productKey: 'one_time_mishnah_class',
      parentRef: 'parent_opaque_1',
      householdRef: 'house_opaque_1',
      category: 'technical',
      rawSummary: 'Login fails for parent@example.com token=abc123',
      route: '/app/support',
      steps: ['Use email parent@example.com'],
      expected: 'Portal opens',
      actual: 'token=abc123 leaked in error',
      attachments: [],
      entitlementStatus: 'active',
      occurredAt: new Date('2026-07-20T10:00:00.000Z'),
      idempotencyKey: 'support_idem_1',
      signingKeyId: 'bna_support_v1',
    });
    expect(event.redacted_summary).not.toContain('parent@example.com');
    expect(JSON.stringify(event)).not.toContain('abc123');
    expect(signHighLevelSupportEvent({ event, secret: 'support-secret-32-bytes' })).toMatch(
      /^v1=[a-f0-9]{64}$/,
    );
  });
});

describe('HighLevel canonical registry model', () => {
  it('converges One Time bot, workflow, field, tag, and pricing boundaries', () => {
    expect(registryMetadata).toMatchObject({
      schemaId: 'one-time-highlevel',
      schemaVersion: '1.1.0',
      status: 'active',
    });
    expect(duplicates(contactFields.map((field) => field.normalizedName))).toEqual([]);
    expect(duplicates(tags.map((tag) => tag.normalizedName))).toEqual([]);
    expect(contactFields.some((field) => /student/i.test(field.canonicalName))).toBe(false);
    expect(tags.some((tag) => /student/i.test(tag.canonicalName))).toBe(false);
    expect(businessWorkflows.map((workflow) => workflow.key)).not.toContain('OT-11');
    expect(businessWorkflows.map((workflow) => workflow.key)).not.toContain('OT-12');
    expect(botActionWorkflows.map((workflow) => workflow.key)).toEqual([
      'OT-B01',
      'OT-B02',
      'OT-B03',
      'OT-B04',
      'OT-B05',
    ]);
    expect(senderProfiles).toHaveLength(5);
    expect(messageClasses).toHaveLength(35);
    expect(
      pipelineDefinitions.filter((pipeline) => pipeline.status !== 'compatibility_alias'),
    ).toHaveLength(3);
    expect(eventDefinitions.map((event) => event.eventCode)).toEqual(['tisha-bav-2026']);
    expect([...businessWorkflows, ...botActionWorkflows]).toHaveLength(19);
    expect(
      [...businessWorkflows, ...botActionWorkflows].every(
        (workflow) => workflow.senderKey && workflow.messageClass && workflow.exactTrigger,
      ),
    ).toBe(true);
    expect(tags.find((tag) => tag.canonicalName === 'OT | Support Requested')).toMatchObject({
      deprecationState: 'deprecated_existing',
    });
    expect(
      customValues.find((value) => value.canonicalName === 'One Time Pricing Display Status'),
    ).toMatchObject({ value: 'hidden' });
    expect(
      customValues.find((value) => value.canonicalName === 'One Time Published Price Label'),
    ).toMatchObject({ value: '' });
    expect(lowercaseTagDeprecations.map((entry) => entry.legacy)).toContain(
      'one-time-human-handoff',
    );
  });
});

function rowCount(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return Array.from(repeated).sort();
}
