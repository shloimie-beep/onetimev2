import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../packages/config/src/index.ts';
import {
  highLevelOutboundEventSchema,
  type HighLevelOutboundEvent,
  type TishaBavRegistrationPayload,
} from '../../packages/contracts/src/index.ts';
import { createMemoryPool, runMigrations, type DbPool } from '../../packages/db/src/index.ts';
import {
  captureTishaBavRegistration,
  DeterministicFakeHighLevelAdapter,
  evaluateEventServiceEmailEligibility,
  inspectTishaBavRegistrationDelivery,
  prepareEventRegistrationCanary,
  recordContactEmailRestriction,
  requestTishaBavJoin,
  resolveTishaBavRedirect,
  runHighLevelProjectionBatch,
  stableKey,
  type EventServiceEmailDenialReason,
  type HighLevelAdapter,
  type HighLevelProjection,
  type HighLevelProviderOperationContext,
} from '../../packages/domain/src/index.ts';
import { createApp } from '../../apps/web/src/server/app.ts';

let pool: DbPool;

const openWindow = new Date('2026-07-23T18:30:00.000Z');
const beforeWindow = new Date('2026-07-23T18:00:00.000Z');
const eventPayloadTamperCases: Array<[string, (event: HighLevelOutboundEvent) => void]> = [
  ['account', (event) => (event.scope.account_key = 'wrong-account')],
  ['product', (event) => (event.scope.product_key = 'wrong-product')],
  ['location', (event) => (event.scope.location_id = 'wrong-location')],
  ['contact', (event) => (event.adult_contact.contact_key = 'wrong-contact')],
];

beforeEach(async () => {
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('Tisha BAv event-only email permission convergence', () => {
  it('atomically records an adult contact, scoped permission, and one held HighLevel event', async () => {
    const result = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('parent@example.test'),
      now: openWindow,
    });

    expect(result).toMatchObject({
      success: true,
      duplicate_submission: false,
      event_code: 'tisha-bav-2026',
      confirmation_queued: false,
      ghl_sync_status: 'provider_off',
    });
    expect(JSON.stringify(result)).not.toMatch(/zoom\.us|join_url|start_url/i);

    const registration = await pool.query(
      `SELECT contact_key, registration_status, identity_status, newsletter_opt_in
         FROM onetime.event_registrations
        WHERE registration_key = $1`,
      [result.registration_key],
    );
    expect(registration.rows).toEqual([
      expect.objectContaining({
        registration_status: 'active',
        identity_status: 'verified',
        newsletter_opt_in: false,
      }),
    ]);
    const contactKey = String(registration.rows[0]?.contact_key);
    const contact = await pool.query(
      `SELECT reminder_preference, consent_policy_version, consent_recorded_at
         FROM onetime.contacts
        WHERE contact_key = $1`,
      [contactKey],
    );
    expect(contact.rows).toEqual([
      {
        reminder_preference: 'none',
        consent_policy_version: null,
        consent_recorded_at: null,
      },
    ]);
    const permission = await pool.query(
      `SELECT contact_key, status, permission_scope, disclosure_version
         FROM onetime.event_email_permissions
        WHERE registration_key = $1`,
      [result.registration_key],
    );
    expect(permission.rows).toEqual([
      {
        contact_key: contactKey,
        status: 'granted',
        permission_scope: 'event_service_email',
        disclosure_version: 'tisha-bav-2026-event-email-v1',
      },
    ]);
    const outbox = await pool.query(
      `SELECT event_type, transport_mode, transport_authorization_state, status, payload
         FROM onetime.outbox_events
        WHERE contact_key = $1 AND channel = 'highlevel'`,
      [contactKey],
    );
    expect(outbox.rows).toEqual([
      expect.objectContaining({
        event_type: 'highlevel.event.registration.recorded.v1',
        transport_mode: 'disabled',
        transport_authorization_state: 'held',
        status: 'pending',
      }),
    ]);
    expect(outbox.rows[0]?.payload).toMatchObject({
      event_name: 'event.registration.recorded',
      protected_reference: { kind: 'one_time_path', path: '/tisha-bav' },
      data: {
        event_code: 'tisha-bav-2026',
        registration_key: result.registration_key,
        permission_scope: 'event_service_email',
      },
    });
    expect(outbox.rows[0]?.payload).not.toHaveProperty('consent');
    expect(JSON.stringify(outbox.rows[0]?.payload)).not.toMatch(/newsletter|marketing|whatsapp/i);
    await expectCount('event_delivery_events', 0);
    await expectCount('account_lifecycle_delivery_outbox', 0);
    await expectCount('auth_email_challenge_delivery_outbox', 0);
  });

  it('replays idempotently and never creates a second outbox row', async () => {
    const payload = registrationPayload('same@example.test', {
      idempotency_key: 'event-same-1',
    });
    const first = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload,
      now: openWindow,
    });
    const replay = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload,
      now: openWindow,
    });
    expect(replay).toMatchObject({
      duplicate_submission: true,
      registration_key: first.registration_key,
      confirmation_queued: false,
      ghl_sync_status: 'provider_off',
    });
    await expectCount('event_registrations', 1);
    await expectCount('event_email_permissions', 1);
    await expectCount('event_email_permission_events', 1);
    await expectCount('outbox_events', 1);
    await expectCount('event_delivery_events', 0);
  });

  it('preserves a prior denial and does not create a fallback or direct provider effect', async () => {
    const first = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('denied@example.test', {
        idempotency_key: 'denied-first',
      }),
      now: openWindow,
    });
    const identity = await registrationIdentity(first.registration_key ?? '');
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: identity.contactKey,
      restrictionType: 'hard_bounce',
      action: 'applied',
      source: 'synthetic_test',
      reasonCode: 'provider_hard_bounce',
      idempotencyKey: 'hard-bounce-1',
      recordedAt: openWindow,
    });
    await pool.query(
      `UPDATE onetime.event_email_permissions
          SET status = 'hard_bounced', deny_reason = 'provider_hard_bounce'
        WHERE registration_key = $1`,
      [first.registration_key],
    );

    const second = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('denied@example.test', {
        idempotency_key: 'denied-second',
      }),
      now: openWindow,
    });
    expect(second).toMatchObject({ confirmation_queued: false, ghl_sync_status: 'provider_off' });
    const permission = await pool.query(
      `SELECT status FROM onetime.event_email_permissions WHERE registration_key = $1`,
      [first.registration_key],
    );
    expect(permission.rows[0]?.status).toBe('hard_bounced');
    await expectCount('event_delivery_events', 0);
    await expectCount('outbox_events', 1);
  });

  it('enforces the typed deny precedence when denial states collide', async () => {
    const registration = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('precedence@example.test'),
      now: openWindow,
    });
    const identity = await registrationIdentity(registration.registration_key ?? '');
    await pool.query(
      `UPDATE onetime.event_email_permissions SET status = 'withdrawn'
        WHERE registration_key = $1`,
      [registration.registration_key],
    );
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: identity.contactKey,
      restrictionType: 'global_unsubscribe',
      action: 'applied',
      source: 'synthetic_test',
      idempotencyKey: 'unsubscribe-1',
      recordedAt: openWindow,
    });
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: identity.contactKey,
      restrictionType: 'global_dnd',
      action: 'applied',
      source: 'synthetic_test',
      idempotencyKey: 'dnd-1',
      recordedAt: openWindow,
    });
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: identity.contactKey,
      restrictionType: 'complaint',
      action: 'applied',
      source: 'synthetic_test',
      idempotencyKey: 'complaint-1',
      recordedAt: openWindow,
    });
    await expectEligibility(registration.registration_key ?? '', identity.contactKey, 'complaint');

    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: identity.contactKey,
      restrictionType: 'complaint',
      action: 'cleared',
      source: 'synthetic_test',
      idempotencyKey: 'complaint-clear-1',
      recordedAt: new Date(openWindow.getTime() + 1),
    });
    await expectEligibility(registration.registration_key ?? '', identity.contactKey, 'global_dnd');
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: identity.contactKey,
      restrictionType: 'global_dnd',
      action: 'cleared',
      source: 'synthetic_test',
      idempotencyKey: 'dnd-clear-1',
      recordedAt: new Date(openWindow.getTime() + 2),
    });
    await expectEligibility(
      registration.registration_key ?? '',
      identity.contactKey,
      'global_unsubscribe',
    );
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: identity.contactKey,
      restrictionType: 'global_unsubscribe',
      action: 'cleared',
      source: 'synthetic_test',
      idempotencyKey: 'unsubscribe-clear-1',
      recordedAt: new Date(openWindow.getTime() + 3),
    });
    await expectEligibility(
      registration.registration_key ?? '',
      identity.contactKey,
      'event_withdrawal',
    );
  });

  it('returns every typed denial reason from an isolated authoritative state', async () => {
    const denialReasons = [
      'complaint',
      'hard_bounce',
      'global_suppression',
      'global_dnd',
      'global_unsubscribe',
      'event_withdrawal',
      'event_cancelled',
      'identity_missing',
      'identity_archived',
      'identity_ambiguous',
      'identity_invalid',
      'identity_mismatch',
      'permission_missing',
      'permission_inactive',
    ] as const satisfies readonly EventServiceEmailDenialReason[];

    for (const [index, reason] of denialReasons.entries()) {
      const fixture = await eligibilityFixture(`typed-${index}-${reason}`);
      const evaluationInput = await applyEligibilityDenial(fixture, reason, `typed-${index}`);
      await expect(
        evaluateEventServiceEmailEligibility(pool, testConfig(), {
          eventCode: 'tisha-bav-2026',
          ...evaluationInput,
        }),
      ).resolves.toEqual({ allowed: false, reason });
    }
  });

  it('enforces every pairwise cross-tier denial collision', async () => {
    const tierRepresentatives = [
      'complaint',
      'global_suppression',
      'global_unsubscribe',
      'event_withdrawal',
      'identity_invalid',
      'permission_inactive',
    ] as const satisfies readonly EventServiceEmailDenialReason[];
    let collision = 0;

    for (let higherIndex = 0; higherIndex < tierRepresentatives.length; higherIndex += 1) {
      for (
        let lowerIndex = higherIndex + 1;
        lowerIndex < tierRepresentatives.length;
        lowerIndex += 1
      ) {
        const higher = tierRepresentatives[higherIndex];
        const lower = tierRepresentatives[lowerIndex];
        if (!higher || !lower) throw new Error('missing denial tier fixture');
        const fixture = await eligibilityFixture(`tier-${collision}-${higher}-${lower}`);
        await applyEligibilityDenial(fixture, lower, `tier-${collision}-lower`);
        await applyEligibilityDenial(fixture, higher, `tier-${collision}-higher`);
        await expectEligibility(fixture.registrationKey, fixture.contactKey, higher);
        collision += 1;
      }
    }

    expect(collision).toBe(15);
  });

  it('fails closed for wrong account, product, event, registration, and contact scope', async () => {
    const fixture = await eligibilityFixture('wrong-scope-primary');
    const other = await eligibilityFixture('wrong-scope-other');
    const cases: Array<{
      config: AppConfig;
      eventCode: string;
      registrationKey: string;
      contactKey: string;
      reason: EventServiceEmailDenialReason;
    }> = [
      {
        config: testConfig({ ONE_TIME_ACCOUNT_KEY: 'wrong_account' }),
        eventCode: 'tisha-bav-2026',
        registrationKey: fixture.registrationKey,
        contactKey: fixture.contactKey,
        reason: 'identity_missing',
      },
      {
        config: testConfig({ ONE_TIME_PRODUCT_KEY: 'wrong_product' }),
        eventCode: 'tisha-bav-2026',
        registrationKey: fixture.registrationKey,
        contactKey: fixture.contactKey,
        reason: 'identity_missing',
      },
      {
        config: testConfig(),
        eventCode: 'wrong-event',
        registrationKey: fixture.registrationKey,
        contactKey: fixture.contactKey,
        reason: 'identity_missing',
      },
      {
        config: testConfig(),
        eventCode: 'tisha-bav-2026',
        registrationKey: 'missing-registration',
        contactKey: fixture.contactKey,
        reason: 'identity_missing',
      },
      {
        config: testConfig(),
        eventCode: 'tisha-bav-2026',
        registrationKey: fixture.registrationKey,
        contactKey: other.contactKey,
        reason: 'identity_mismatch',
      },
    ];

    for (const testCase of cases) {
      await expect(
        evaluateEventServiceEmailEligibility(pool, testCase.config, {
          eventCode: testCase.eventCode,
          registrationKey: testCase.registrationKey,
          contactKey: testCase.contactKey,
        }),
      ).resolves.toEqual({ allowed: false, reason: testCase.reason });
    }
  });

  it('preserves ambiguous and invalid identity state across re-registration', async () => {
    for (const identityStatus of ['ambiguous', 'invalid'] as const) {
      const email = `reregister-${identityStatus}@example.test`;
      const first = await captureTishaBavRegistration({
        pool,
        config: testConfig(),
        payload: registrationPayload(email, {
          idempotency_key: `reregister-${identityStatus}-first`,
        }),
        now: openWindow,
      });
      await pool.query(
        `UPDATE onetime.event_registrations
            SET identity_status = $1
          WHERE registration_key = $2`,
        [identityStatus, first.registration_key],
      );

      await captureTishaBavRegistration({
        pool,
        config: testConfig(),
        payload: registrationPayload(email, {
          idempotency_key: `reregister-${identityStatus}-second`,
        }),
        now: new Date(openWindow.getTime() + 1_000),
      });

      const state = await pool.query<{ identity_status: string; permission_status: string }>(
        `SELECT registrations.identity_status,
                permissions.status AS permission_status
           FROM onetime.event_registrations AS registrations
           JOIN onetime.event_email_permissions AS permissions
             ON permissions.account_key = registrations.account_key
            AND permissions.product_key = registrations.product_key
            AND permissions.event_code = registrations.event_code
            AND permissions.registration_key = registrations.registration_key
          WHERE registrations.registration_key = $1`,
        [first.registration_key],
      );
      expect(state.rows).toEqual([
        {
          identity_status: identityStatus,
          permission_status: 'withdrawn',
        },
      ]);
    }
    await expectCount('event_registrations', 2);
    await expectCount('outbox_events', 2);
  });

  it('rolls back restriction history and projection atomically, then retries safely', async () => {
    const fixture = await eligibilityFixture('restriction-rollback');
    const failingPool = failRestrictionProjectionPool(pool, 'restriction-rollback-retry');
    const input = {
      contactKey: fixture.contactKey,
      restrictionType: 'global_dnd' as const,
      action: 'applied' as const,
      source: 'synthetic_test',
      idempotencyKey: 'restriction-rollback-retry',
      recordedAt: openWindow,
    };

    await expect(recordContactEmailRestriction(failingPool, testConfig(), input)).rejects.toThrow(
      'SYNTHETIC_RESTRICTION_PROJECTION_FAILURE',
    );
    await expectRestrictionCounts(fixture.contactKey, 'global_dnd', 0, 0);

    await expect(recordContactEmailRestriction(pool, testConfig(), input)).resolves.toMatchObject({
      state: 'recorded',
    });
    await expectRestrictionCounts(fixture.contactKey, 'global_dnd', 1, 1);
  });

  it('appends stale restriction clears without rolling the current projection backward', async () => {
    const fixture = await eligibilityFixture('restriction-ordering');
    const appliedAt = new Date(openWindow.getTime() + 120_000);
    const staleClearAt = new Date(openWindow.getTime() + 60_000);
    const currentClearAt = new Date(openWindow.getTime() + 180_000);
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: fixture.contactKey,
      restrictionType: 'global_unsubscribe',
      action: 'applied',
      source: 'synthetic_test',
      idempotencyKey: 'restriction-ordering-applied',
      recordedAt: appliedAt,
    });
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: fixture.contactKey,
      restrictionType: 'global_unsubscribe',
      action: 'cleared',
      source: 'synthetic_test',
      idempotencyKey: 'restriction-ordering-stale-clear',
      recordedAt: staleClearAt,
    });

    const afterStale = await restrictionProjection(fixture.contactKey, 'global_unsubscribe');
    expect(afterStale).toMatchObject({
      active: true,
      effective_at: appliedAt,
    });
    await expectRestrictionCounts(fixture.contactKey, 'global_unsubscribe', 2, 1);

    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: fixture.contactKey,
      restrictionType: 'global_unsubscribe',
      action: 'cleared',
      source: 'synthetic_test',
      idempotencyKey: 'restriction-ordering-current-clear',
      recordedAt: currentClearAt,
    });
    expect(await restrictionProjection(fixture.contactKey, 'global_unsubscribe')).toMatchObject({
      active: false,
      effective_at: currentClearAt,
    });
    await expectRestrictionCounts(fixture.contactKey, 'global_unsubscribe', 3, 1);
  });

  it('resolves equal-time restriction events fail closed regardless of arrival order', async () => {
    const fixture = await eligibilityFixture('restriction-equal-time');
    const recordedAt = new Date(openWindow.getTime() + 240_000);

    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: fixture.contactKey,
      restrictionType: 'complaint',
      action: 'cleared',
      source: 'synthetic_test',
      idempotencyKey: 'restriction-equal-time-clear-first',
      recordedAt,
    });
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: fixture.contactKey,
      restrictionType: 'complaint',
      action: 'applied',
      source: 'synthetic_test',
      idempotencyKey: 'restriction-equal-time-apply-second',
      recordedAt,
    });
    expect(await restrictionProjection(fixture.contactKey, 'complaint')).toMatchObject({
      active: true,
      effective_at: recordedAt,
    });

    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: fixture.contactKey,
      restrictionType: 'hard_bounce',
      action: 'applied',
      source: 'synthetic_test',
      idempotencyKey: 'restriction-equal-time-apply-first',
      recordedAt,
    });
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: fixture.contactKey,
      restrictionType: 'hard_bounce',
      action: 'cleared',
      source: 'synthetic_test',
      idempotencyKey: 'restriction-equal-time-clear-second',
      recordedAt,
    });
    expect(await restrictionProjection(fixture.contactKey, 'hard_bounce')).toMatchObject({
      active: true,
      effective_at: recordedAt,
    });
    await expectRestrictionCounts(fixture.contactKey, 'complaint', 2, 1);
    await expectRestrictionCounts(fixture.contactKey, 'hard_bounce', 2, 1);
  });

  it('fails closed for archived, ambiguous, mismatched, and missing permission identities', async () => {
    const registration = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('identity@example.test'),
      now: openWindow,
    });
    const identity = await registrationIdentity(registration.registration_key ?? '');
    await pool.query(`UPDATE onetime.contacts SET archived_at = $1 WHERE contact_key = $2`, [
      openWindow,
      identity.contactKey,
    ]);
    await expectEligibility(
      registration.registration_key ?? '',
      identity.contactKey,
      'identity_archived',
    );
    await pool.query(`UPDATE onetime.contacts SET archived_at = NULL WHERE contact_key = $1`, [
      identity.contactKey,
    ]);
    await pool.query(
      `UPDATE onetime.event_registrations SET identity_status = 'ambiguous'
        WHERE registration_key = $1`,
      [registration.registration_key],
    );
    await expectEligibility(
      registration.registration_key ?? '',
      identity.contactKey,
      'identity_ambiguous',
    );
    await pool.query(
      `UPDATE onetime.event_registrations SET identity_status = 'verified', contact_key = NULL
        WHERE registration_key = $1`,
      [registration.registration_key],
    );
    await expectEligibility(
      registration.registration_key ?? '',
      identity.contactKey,
      'identity_mismatch',
    );
    await pool.query(
      `UPDATE onetime.event_registrations SET contact_key = $1 WHERE registration_key = $2`,
      [identity.contactKey, registration.registration_key],
    );
    await pool.query(`DELETE FROM onetime.event_email_permissions WHERE registration_key = $1`, [
      registration.registration_key,
    ]);
    await expectEligibility(
      registration.registration_key ?? '',
      identity.contactKey,
      'permission_missing',
    );
  });

  it('keeps the inspection CLI boundary read-only and does not infer legacy permission', async () => {
    const registration = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('inspection@example.test'),
      now: openWindow,
    });
    await pool.query(
      `DELETE FROM onetime.outbox_events
        WHERE payload->'data'->>'registration_key' = $1`,
      [registration.registration_key],
    );
    await pool.query(`DELETE FROM onetime.event_email_permissions WHERE registration_key = $1`, [
      registration.registration_key,
    ]);
    await pool.query(
      `DELETE FROM onetime.event_email_permission_events WHERE registration_key = $1`,
      [registration.registration_key],
    );
    const before = await stateSnapshot();
    const result = await inspectTishaBavRegistrationDelivery({
      pool,
      config: testConfig(),
      registrationKey: registration.registration_key ?? '',
    });
    expect(result).toMatchObject({
      status: 'missing',
      would_enqueue: false,
      eligibility_reason: 'permission_missing',
    });
    expect(await stateSnapshot()).toEqual(before);
  });

  it('requires an explicit exact-row canary prepare before synthetic dispatch and exact tag readback', async () => {
    const registration = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('canary@example.test'),
      now: openWindow,
    });
    const deliveryKey = await registrationDeliveryKey(registration.registration_key ?? '');
    const config = canaryConfig(deliveryKey);
    const adapter = new DeterministicFakeHighLevelAdapter();

    const beforePrepare = await runHighLevelProjectionBatch({
      pool,
      config,
      adapter,
      now: openWindow,
    });
    expect(beforePrepare).toMatchObject({ claimed: 0, delivered: 0, adapterCalls: 0 });

    await expect(
      prepareEventRegistrationCanary({
        pool,
        config,
        deliveryKey,
        now: openWindow,
      }),
    ).resolves.toMatchObject({ prepared: true, deliveryKey });
    const dispatched = await runHighLevelProjectionBatch({
      pool,
      config,
      adapter,
      now: openWindow,
    });
    expect(dispatched).toMatchObject({ claimed: 1, delivered: 1, adapterCalls: 1 });
    expect(adapter.calls).toEqual([
      expect.objectContaining({
        eventName: 'event.registration.recorded',
        tagsToAdd: ["OT | Event | Tisha B'Av 2026 | Registered", "OT | Source | Tisha B'Av 2026"],
      }),
    ]);
  });

  it('rejects canary preparation without the exact run, allowlist, budget, eligibility, or pristine row', async () => {
    const registration = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('prepare-negative@example.test'),
      now: openWindow,
    });
    const registrationKey = registration.registration_key ?? '';
    const identity = await registrationIdentity(registrationKey);
    const deliveryKey = await registrationDeliveryKey(registrationKey);
    await expect(
      prepareEventRegistrationCanary({
        pool,
        config: testConfig(),
        deliveryKey,
        now: openWindow,
      }),
    ).resolves.toEqual({
      prepared: false,
      reason: 'canary_configuration_missing',
    });
    await expect(
      prepareEventRegistrationCanary({
        pool,
        config: canaryConfig('different-delivery-key'),
        deliveryKey,
        now: openWindow,
      }),
    ).resolves.toEqual({
      prepared: false,
      reason: 'canary_configuration_missing',
    });
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: identity.contactKey,
      restrictionType: 'global_unsubscribe',
      action: 'applied',
      source: 'synthetic_test',
      idempotencyKey: 'prepare-negative-unsubscribe',
      recordedAt: openWindow,
    });
    await expect(
      prepareEventRegistrationCanary({
        pool,
        config: canaryConfig(deliveryKey),
        deliveryKey,
        now: openWindow,
      }),
    ).resolves.toMatchObject({
      prepared: false,
      reason: 'contact_ineligible',
      blocker: 'global_unsubscribe',
    });
  });

  it.each(eventPayloadTamperCases)(
    'rejects a held event whose %s payload scope disagrees with the claimed row',
    async (label, tamper) => {
      const fixture = await eligibilityFixture(`prepare-scope-${label}`);
      const deliveryKey = await registrationDeliveryKey(fixture.registrationKey);
      const config = canaryConfig(deliveryKey, `prepare-scope-${label}-run`);
      const event = await readHighLevelEventPayload(deliveryKey);
      tamper(event);
      await writeHighLevelEventPayload(deliveryKey, event);

      await expect(
        prepareEventRegistrationCanary({ pool, config, deliveryKey, now: openWindow }),
      ).resolves.toEqual({
        prepared: false,
        reason: 'event_scope_mismatch',
      });
      expect(await outboxAuthorizationState(deliveryKey)).toEqual({
        status: 'pending',
        transport_mode: 'disabled',
        transport_authorization_state: 'held',
      });
      const run = await pool.query(
        `SELECT run_id FROM onetime.highlevel_canary_runs
          WHERE account_key = $1 AND product_key = $2 AND run_id = $3`,
        [config.accountKey, config.productKey, config.highLevelCanaryRunId],
      );
      expect(run.rows).toHaveLength(0);
    },
  );

  it.each(eventPayloadTamperCases)(
    'revokes an authorized event whose %s payload scope changes before provider dispatch',
    async (label, tamper) => {
      const fixture = await eligibilityFixture(`dispatch-scope-${label}`);
      const deliveryKey = await registrationDeliveryKey(fixture.registrationKey);
      const config = canaryConfig(deliveryKey, `dispatch-scope-${label}-run`);
      await expect(
        prepareEventRegistrationCanary({ pool, config, deliveryKey, now: openWindow }),
      ).resolves.toMatchObject({ prepared: true });
      const event = await readHighLevelEventPayload(deliveryKey);
      tamper(event);
      await writeHighLevelEventPayload(deliveryKey, event);
      const adapter = new DeterministicFakeHighLevelAdapter();

      await expect(
        runHighLevelProjectionBatch({ pool, config, adapter, now: openWindow }),
      ).resolves.toMatchObject({
        claimed: 1,
        delivered: 0,
        quarantined: 1,
        adapterCalls: 0,
      });
      expect(adapter.upsertCalls).toHaveLength(0);
      expect(adapter.calls).toHaveLength(0);
      expect(await outboxAuthorizationState(deliveryKey)).toEqual({
        status: 'dead_letter',
        transport_mode: 'mock',
        transport_authorization_state: 'revoked',
      });
      const audit = await revocationAudit(deliveryKey);
      expect(audit).toMatchObject({
        eligibility_reason: 'payload_scope_mismatch',
        provider_effect_performed: false,
        provider_effect_stage: 'none',
        tags_written: false,
      });
    },
  );

  it('rejects prior receipts, attempts, non-pristine rows, and stored canary-run mismatches', async () => {
    const prior = await eligibilityFixture('canary-prior-receipt');
    const priorDeliveryKey = await registrationDeliveryKey(prior.registrationKey);
    await pool.query(
      `INSERT INTO onetime.highlevel_provider_operation_receipts
         (operation_key, account_key, product_key, delivery_key, run_id, operation_name,
          request_hash, status, claim_token, provider_contact_id, started_at, completed_at,
          updated_at)
       VALUES ($1,$2,$3,$4,$5,'contact_upsert',$6,'completed',$7,$8,$9,$9,$9)`,
      [
        'prior-receipt-operation',
        testConfig().accountKey,
        testConfig().productKey,
        priorDeliveryKey,
        'prior-receipt-run',
        'synthetic-request-hash',
        'prior-receipt-claim',
        'synthetic-provider-contact',
        openWindow,
      ],
    );
    await expect(
      prepareEventRegistrationCanary({
        pool,
        config: canaryConfig(priorDeliveryKey, 'prior-receipt-run'),
        deliveryKey: priorDeliveryKey,
        now: openWindow,
      }),
    ).resolves.toEqual({ prepared: false, reason: 'prior_provider_effect' });

    const attempted = await eligibilityFixture('canary-attempted');
    const attemptedDeliveryKey = await registrationDeliveryKey(attempted.registrationKey);
    await pool.query(`UPDATE onetime.outbox_events SET attempts = 1 WHERE delivery_key = $1`, [
      attemptedDeliveryKey,
    ]);
    await expect(
      prepareEventRegistrationCanary({
        pool,
        config: canaryConfig(attemptedDeliveryKey, 'attempted-row-run'),
        deliveryKey: attemptedDeliveryKey,
        now: openWindow,
      }),
    ).resolves.toEqual({ prepared: false, reason: 'row_not_pristine' });

    const revoked = await eligibilityFixture('canary-revoked');
    const revokedDeliveryKey = await registrationDeliveryKey(revoked.registrationKey);
    await pool.query(
      `UPDATE onetime.outbox_events
          SET transport_authorization_state = 'revoked'
        WHERE delivery_key = $1`,
      [revokedDeliveryKey],
    );
    await expect(
      prepareEventRegistrationCanary({
        pool,
        config: canaryConfig(revokedDeliveryKey, 'revoked-row-run'),
        deliveryKey: revokedDeliveryKey,
        now: openWindow,
      }),
    ).resolves.toEqual({ prepared: false, reason: 'row_not_pristine' });

    const mismatch = await eligibilityFixture('canary-run-mismatch');
    const mismatchDeliveryKey = await registrationDeliveryKey(mismatch.registrationKey);
    const mismatchConfig = canaryConfig(mismatchDeliveryKey, 'stored-mismatch-run');
    await pool.query(
      `INSERT INTO onetime.highlevel_canary_runs
         (account_key, product_key, run_id, transport_mode, allowlist_hash, budget, state,
          created_at, updated_at)
       VALUES ($1,$2,$3,'mock','intentionally-wrong-hash',1,'active',$4,$4)`,
      [
        mismatchConfig.accountKey,
        mismatchConfig.productKey,
        mismatchConfig.highLevelCanaryRunId,
        openWindow,
      ],
    );
    await expect(
      prepareEventRegistrationCanary({
        pool,
        config: mismatchConfig,
        deliveryKey: mismatchDeliveryKey,
        now: openWindow,
      }),
    ).resolves.toEqual({ prepared: false, reason: 'canary_run_mismatch' });
    const mismatchRow = await pool.query(
      `SELECT transport_mode, transport_authorization_state
         FROM onetime.outbox_events
        WHERE delivery_key = $1`,
      [mismatchDeliveryKey],
    );
    expect(mismatchRow.rows).toEqual([
      {
        transport_mode: 'disabled',
        transport_authorization_state: 'held',
      },
    ]);
  });

  it('rechecks eligibility before provider construction and revokes with zero adapter calls', async () => {
    const cases = [
      ['complaint', 'complaint'],
      ['hard-bounce', 'hard_bounce'],
      ['unsubscribe', 'global_unsubscribe'],
      ['dnd', 'global_dnd'],
      ['withdrawal', 'event_withdrawal'],
    ] as const;
    const rows: Array<{
      registrationKey: string;
      contactKey: string;
      deliveryKey: string;
    }> = [];
    for (const [label] of cases) {
      const registration = await captureTishaBavRegistration({
        pool,
        config: testConfig(),
        payload: registrationPayload(`${label}@example.test`),
        now: openWindow,
      });
      const registrationKey = registration.registration_key ?? '';
      rows.push({
        registrationKey,
        contactKey: (await registrationIdentity(registrationKey)).contactKey,
        deliveryKey: await registrationDeliveryKey(registrationKey),
      });
    }
    const config = canaryConfigForKeys(rows.map((row) => row.deliveryKey));
    for (const row of rows) {
      await expect(
        prepareEventRegistrationCanary({
          pool,
          config,
          deliveryKey: row.deliveryKey,
          now: openWindow,
        }),
      ).resolves.toMatchObject({ prepared: true });
    }
    for (const [index, [label, denial]] of cases.entries()) {
      const row = rows[index];
      if (!row) throw new Error('missing denial fixture');
      if (denial === 'event_withdrawal') {
        await pool.query(
          `UPDATE onetime.event_email_permissions SET status = 'withdrawn'
            WHERE registration_key = $1`,
          [row.registrationKey],
        );
      } else {
        await recordContactEmailRestriction(pool, config, {
          contactKey: row.contactKey,
          restrictionType: denial,
          action: 'applied',
          source: 'synthetic_test',
          idempotencyKey: `late-${label}-1`,
          recordedAt: openWindow,
        });
      }
    }
    const adapter = new DeterministicFakeHighLevelAdapter();
    const result = await runHighLevelProjectionBatch({
      pool,
      config,
      adapter,
      now: openWindow,
    });
    expect(result).toMatchObject({ claimed: 5, delivered: 0, quarantined: 5, adapterCalls: 0 });
    expect(adapter.calls).toHaveLength(0);
    expect(adapter.upsertCalls).toHaveLength(0);
    const row = await pool.query(
      `SELECT status, transport_authorization_state FROM onetime.outbox_events
        WHERE event_type = 'highlevel.event.registration.recorded.v1'
        ORDER BY delivery_key`,
    );
    expect(row.rows).toHaveLength(5);
    expect(row.rows).toEqual(
      expect.arrayContaining(
        Array.from({ length: 5 }, () => ({
          status: 'dead_letter',
          transport_authorization_state: 'revoked',
        })),
      ),
    );
  });

  it('rechecks a denial arriving during contact upsert before adding any tag', async () => {
    const fixture = await eligibilityFixture('denial-during-upsert');
    const deliveryKey = await registrationDeliveryKey(fixture.registrationKey);
    const config = canaryConfig(deliveryKey, 'denial-during-upsert-run');
    await prepareEventRegistrationCanary({ pool, config, deliveryKey, now: openWindow });
    const adapter = new DenyDuringUpsertAdapter(async () => {
      await recordContactEmailRestriction(pool, config, {
        contactKey: fixture.contactKey,
        restrictionType: 'complaint',
        action: 'applied',
        source: 'synthetic_test',
        idempotencyKey: 'denial-during-upsert-complaint',
        recordedAt: openWindow,
      });
    });

    const result = await runHighLevelProjectionBatch({
      pool,
      config,
      adapter,
      now: openWindow,
    });
    expect(result).toMatchObject({ claimed: 1, delivered: 0, quarantined: 1, adapterCalls: 1 });
    expect(adapter.upserts).toBe(1);
    expect(adapter.tagWrites).toBe(0);
    expect(adapter.readbacks).toBe(0);
    const row = await pool.query(
      `SELECT status, transport_authorization_state
         FROM onetime.outbox_events
        WHERE delivery_key = $1`,
      [deliveryKey],
    );
    expect(row.rows).toEqual([
      {
        status: 'dead_letter',
        transport_authorization_state: 'revoked',
      },
    ]);
    expect(await revocationAudit(deliveryKey)).toMatchObject({
      eligibility_reason: 'complaint',
      provider_effect_performed: true,
      provider_effect_stage: 'contact_upsert_completed',
      tags_written: false,
      retry_authorized: false,
    });
  });

  it('reports a completed contact upsert after crash recovery when pre-call eligibility revokes', async () => {
    const fixture = await eligibilityFixture('completed-upsert-crash-recovery');
    const deliveryKey = await registrationDeliveryKey(fixture.registrationKey);
    const runId = 'completed-upsert-crash-recovery-run';
    const config = canaryConfig(deliveryKey, runId);
    await prepareEventRegistrationCanary({ pool, config, deliveryKey, now: openWindow });
    await pool.query(
      `INSERT INTO onetime.highlevel_provider_operation_receipts
         (operation_key, account_key, product_key, delivery_key, run_id, operation_name,
          request_hash, status, claim_token, provider_contact_id, started_at, completed_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'contact_upsert',$6,'completed',$7,$8,$9,$9,$9)`,
      [
        stableKey('highlevel_provider_operation', [deliveryKey, 'contact_upsert']),
        config.accountKey,
        config.productKey,
        deliveryKey,
        runId,
        'synthetic-completed-upsert-request-hash',
        'expired-prior-claim',
        'synthetic-provider-contact',
        openWindow,
      ],
    );
    await pool.query(
      `UPDATE onetime.outbox_events
          SET attempts = 1
        WHERE account_key = $1 AND product_key = $2 AND delivery_key = $3`,
      [config.accountKey, config.productKey, deliveryKey],
    );
    await recordContactEmailRestriction(pool, config, {
      contactKey: fixture.contactKey,
      restrictionType: 'complaint',
      action: 'applied',
      source: 'synthetic_test',
      idempotencyKey: 'completed-upsert-crash-recovery-complaint',
      recordedAt: openWindow,
    });
    const adapter = new DeterministicFakeHighLevelAdapter();

    const result = await runHighLevelProjectionBatch({
      pool,
      config,
      adapter,
      now: openWindow,
    });

    expect(result).toMatchObject({ claimed: 1, delivered: 0, quarantined: 1, adapterCalls: 0 });
    expect(adapter.upsertCalls).toHaveLength(0);
    expect(adapter.calls).toHaveLength(0);
    expect(await revocationAudit(deliveryKey)).toMatchObject({
      eligibility_reason: 'complaint',
      provider_effect_performed: true,
      provider_effect_stage: 'contact_upsert_completed',
      tags_written: false,
      retry_authorized: false,
    });
  });

  it.each([
    ['missing canonical tag', ["OT | Event | Tisha B'Av 2026 | Registered"]],
    [
      'duplicate canonical tag',
      [
        "OT | Event | Tisha B'Av 2026 | Registered",
        "OT | Event | Tisha B'Av 2026 | Registered",
        "OT | Source | Tisha B'Av 2026",
      ],
    ],
    [
      'wrong apostrophe punctuation',
      ['OT | Event | Tisha B’Av 2026 | Registered', "OT | Source | Tisha B'Av 2026"],
    ],
    [
      'ambiguous normalized near-duplicate',
      [
        "OT | Event | Tisha B'Av 2026 | Registered",
        "OT | Source | Tisha B'Av 2026",
        'OT | Event | Tisha B’Av 2026 | Registered',
      ],
    ],
  ])('quarantines %s readback as uncertain without automatic replay', async (_label, tags) => {
    const registration = await captureTishaBavRegistration({
      pool,
      config: testConfig(),
      payload: registrationPayload('uncertain@example.test'),
      now: openWindow,
    });
    const deliveryKey = await registrationDeliveryKey(registration.registration_key ?? '');
    const config = canaryConfig(deliveryKey);
    await prepareEventRegistrationCanary({ pool, config, deliveryKey, now: openWindow });
    const adapter = new ControlledTagReadbackAdapter(tags);
    const first = await runHighLevelProjectionBatch({
      pool,
      config,
      adapter,
      now: openWindow,
    });
    expect(first).toMatchObject({ claimed: 1, delivered: 0, quarantined: 1 });
    expect(adapter.upserts).toBe(1);
    expect(adapter.tagWrites).toBe(1);
    const second = await runHighLevelProjectionBatch({
      pool,
      config,
      adapter,
      now: new Date(openWindow.getTime() + 60_000),
    });
    expect(second).toMatchObject({ claimed: 0, adapterCalls: 0 });
    expect(adapter.upserts).toBe(1);
    expect(adapter.tagWrites).toBe(1);
  });

  it('rejects newsletter permission on the event registration contract', async () => {
    await expect(
      captureTishaBavRegistration({
        pool,
        config: testConfig(),
        payload: registrationPayload('newsletter@example.test', {
          newsletter_opt_in: true,
          idempotency_key: 'newsletter-yes-1',
        }),
        now: openWindow,
      }),
    ).rejects.toThrow();
    await expectCount('event_registrations', 0);
    await expectCount('event_email_permissions', 0);
    await expectCount('outbox_events', 0);
  });
});

describe('Tisha BAv event join access', () => {
  it('verifies registration, creates a short session, and resolves only by server redirect', async () => {
    const config = testConfig({
      ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL: 'https://zoom.example.test/j/123?pwd=protected',
    });
    await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('join@example.test'),
      now: openWindow,
    });

    const join = await requestTishaBavJoin({
      pool,
      config,
      payload: { email: 'join@example.test', idempotency_key: 'join-idem-1', homepage: '' },
      now: openWindow,
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(join.response.redirect_path).toBe('/api/v1/events/tisha-bav-2026/redirect');
    expect(JSON.stringify(join.response)).not.toContain('zoom.example.test');

    const redirect = await resolveTishaBavRedirect({
      pool,
      config,
      sessionToken: join.sessionToken,
      now: openWindow,
    });
    expect(redirect.joinUrl).toBe('https://zoom.example.test/j/123?pwd=protected');
  });

  it('blocks join before the configured window and when Zoom is not mapped', async () => {
    const config = testConfig();
    await captureTishaBavRegistration({
      pool,
      config,
      payload: registrationPayload('blocked@example.test'),
      now: beforeWindow,
    });

    await expect(
      requestTishaBavJoin({
        pool,
        config,
        payload: { email: 'blocked@example.test', idempotency_key: 'join-idem-2', homepage: '' },
        now: beforeWindow,
      }),
    ).rejects.toMatchObject({ code: 'EVENT_NOT_OPEN' });

    await expect(
      requestTishaBavJoin({
        pool,
        config,
        payload: { email: 'blocked@example.test', idempotency_key: 'join-idem-3', homepage: '' },
        now: openWindow,
      }),
    ).rejects.toMatchObject({ code: 'EVENT_UNAVAILABLE' });
  });
});

describe('Tisha BAv event HTTP routes', () => {
  it('serves the production landing HTML with immediate revalidation headers', async () => {
    const config = testConfig({
      NODE_ENV: 'production',
      AUTH_CSRF_SECRET: 'test-only-auth-csrf-secret-for-production-cache-proof',
      MFA_SECRET_ENCRYPTION_KEY: 'test-only-32-byte-mfa-key-do-not-use',
    });
    const distDir = await mkdtemp(path.join(tmpdir(), 'tisha-cache-proof-'));
    await writeFile(
      path.join(distDir, 'tisha-bav.html'),
      [
        '<!doctype html><html><head><title>Tisha</title>',
        '<meta property="og:image" content="https://join.onetimeonetime.com/assets/events/tisha-bav-2026/tisha-bav-social-card-v20260722.png">',
        '<meta property="og:image:secure_url" content="https://join.onetimeonetime.com/assets/events/tisha-bav-2026/tisha-bav-social-card-v20260722.png">',
        '<meta property="og:image:type" content="image/png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="One Time logo for the Tisha B&#39;Av live Zoom class">',
        '<meta name="twitter:image" content="https://join.onetimeonetime.com/assets/events/tisha-bav-2026/tisha-bav-social-card-v20260722.png">',
        '<link rel="icon" type="image/png" href="/assets/events/tisha-bav-2026/tisha-bav-favicon-v20260722.png">',
        '<link rel="apple-touch-icon" href="/assets/events/tisha-bav-2026/tisha-bav-apple-touch-icon-v20260722.png">',
        '</head><body><p lang="he" dir="rtl">כי מלאה הארץ דעה את השם</p><h1>Bringing Knowledge of Hashem into the World</h1><p>Live class with Rabbi Eli Scheller</p><p>3 p.m. Eastern Time</p><p>No charge</p><button>Reserve My Spot</button><p>By reserving, you’ll receive emails about this event.</p></body></html>',
      ].join(''),
    );
    const server = await startServer(config, openWindow, distDir);
    try {
      for (const routePath of ['/tisha-bav', '/tisha-bav.html']) {
        const response = await fetch(`${server.baseUrl}${routePath}`);
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-cache, max-age=0, must-revalidate');
        expect(response.headers.get('pragma')).toBe('no-cache');
        expect(response.headers.get('expires')).toBe('0');

        const html = await response.text();
        expect(html).toContain('כי מלאה הארץ דעה את השם');
        expect(html).toContain('Bringing Knowledge of Hashem into the World');
        expect(html).toContain('Live class with Rabbi Eli Scheller');
        expect(html).toContain('3 p.m. Eastern Time');
        expect(html).toContain('No charge');
        expect(html).toContain('By reserving, you’ll receive emails about this event.');
        expect(html).toContain('tisha-bav-social-card-v20260722.png');
        expect(html).toContain('<meta property="og:image:type" content="image/png">');
        expect(html).toContain('<meta property="og:image:width" content="1200">');
        expect(html).toContain('<meta property="og:image:height" content="630">');
        expect(html).toContain('tisha-bav-favicon-v20260722.png');
        expect(html).toContain('tisha-bav-apple-touch-icon-v20260722.png');
        expect(html).not.toContain('10:00 PM Israel');
        expect(html).not.toContain('Ki Mala Haaretz Deas Hashem');
        expect(html).not.toContain('Filling the World with Knowledge of Hashem');
        expect(html).not.toContain('Rabbi Elly');
      }
    } finally {
      await server.close();
      await rm(distDir, { recursive: true, force: true });
    }
  });

  it('registers, rate limits, joins, and server-redirects through Express routes', async () => {
    const config = testConfig({
      ONE_TIME_TISHA_BAV_2026_ZOOM_JOIN_URL: 'https://zoom.example.test/j/456?pwd=protected',
      LEAD_RATE_LIMIT_MAX: '20',
      LEAD_IDENTIFIER_RATE_LIMIT_MAX: '20',
    });
    const server = await startServer(config, openWindow);
    try {
      const register = await fetch(`${server.baseUrl}/api/v1/events/tisha-bav-2026/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(registrationPayload('route@example.test')),
      });
      expect(register.status).toBe(200);
      expect(await register.json()).toMatchObject({ success: true });

      const join = await fetch(`${server.baseUrl}/api/v1/events/tisha-bav-2026/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'route@example.test',
          idempotency_key: 'route-join-1',
          homepage: '',
        }),
      });
      expect(join.status).toBe(200);
      const cookie = join.headers.get('set-cookie');
      expect(cookie).toContain('ot_tisha_bav_2026_session');
      const joinJson = await join.json();
      expect(joinJson.redirect_path).toBe('/api/v1/events/tisha-bav-2026/redirect');

      const redirect = await fetch(`${server.baseUrl}${joinJson.redirect_path}`, {
        redirect: 'manual',
        headers: { cookie: cookie ?? '' },
      });
      expect(redirect.status).toBe(302);
      expect(redirect.headers.get('location')).toBe(
        'https://zoom.example.test/j/456?pwd=protected',
      );
    } finally {
      await server.close();
    }
  });

  it('uses the event route rate-limit scopes', async () => {
    const config = testConfig({ LEAD_RATE_LIMIT_MAX: '1', LEAD_IDENTIFIER_RATE_LIMIT_MAX: '20' });
    const server = await startServer(config, openWindow);
    try {
      const first = await fetch(`${server.baseUrl}/api/v1/events/tisha-bav-2026/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          registrationPayload('rate1@example.test', { idempotency_key: 'rate-one-1' }),
        ),
      });
      const second = await fetch(`${server.baseUrl}/api/v1/events/tisha-bav-2026/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          registrationPayload('rate2@example.test', { idempotency_key: 'rate-two-2' }),
        ),
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
      expect(await second.json()).toMatchObject({ success: false, code: 'RATE_LIMITED' });
    } finally {
      await server.close();
    }
  });
});

class ControlledTagReadbackAdapter implements HighLevelAdapter {
  upserts = 0;
  tagWrites = 0;

  constructor(private readonly observedTags: string[]) {}

  async upsertContact(_input: HighLevelProjection, _context: HighLevelProviderOperationContext) {
    this.upserts += 1;
    return { providerContactId: 'synthetic-provider-contact' };
  }

  async addTags() {
    this.tagWrites += 1;
  }

  async readTags() {
    return [...this.observedTags];
  }
}

class DenyDuringUpsertAdapter implements HighLevelAdapter {
  upserts = 0;
  tagWrites = 0;
  readbacks = 0;

  constructor(private readonly deny: () => Promise<void>) {}

  async upsertContact(_input: HighLevelProjection, _context: HighLevelProviderOperationContext) {
    this.upserts += 1;
    await this.deny();
    return { providerContactId: 'synthetic-provider-contact' };
  }

  async addTags() {
    this.tagWrites += 1;
  }

  async readTags() {
    this.readbacks += 1;
    return ["OT | Event | Tisha B'Av 2026 | Registered", "OT | Source | Tisha B'Av 2026"];
  }
}

function testConfig(overrides: NodeJS.ProcessEnv = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    APP_VERSION: 'test',
    COMMIT_SHA: 'test',
    ONE_TIME_ACCOUNT_KEY: 'rabbi_sheller_provider',
    ONE_TIME_PRODUCT_KEY: 'one_time_mishnah_class',
    ...overrides,
  });
}

function canaryConfig(deliveryKey: string, runId?: string) {
  return canaryConfigForKeys([deliveryKey], runId);
}

function canaryConfigForKeys(deliveryKeys: string[], runId = 'event-permission-synthetic-run') {
  return {
    ...testConfig({
      HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
      HIGHLEVEL_CANARY_RUN_ID: runId,
      HIGHLEVEL_CANARY_DELIVERY_KEYS: deliveryKeys.join(','),
      HIGHLEVEL_CANARY_BUDGET: String(deliveryKeys.length),
    }),
  };
}

function registrationPayload(
  email: string,
  overrides: Record<string, unknown> = {},
): TishaBavRegistrationPayload {
  return {
    email,
    first_name: 'Miriam',
    newsletter_opt_in: false as const,
    source: 'tisha_bav_2026_landing',
    idempotency_key: `event-${email}`,
    homepage: '',
    ...overrides,
  } as TishaBavRegistrationPayload;
}

async function registrationIdentity(registrationKey: string) {
  const result = await pool.query<{ contact_key: string }>(
    `SELECT contact_key FROM onetime.event_registrations WHERE registration_key = $1`,
    [registrationKey],
  );
  return { contactKey: String(result.rows[0]?.contact_key) };
}

async function eligibilityFixture(label: string) {
  const registration = await captureTishaBavRegistration({
    pool,
    config: testConfig(),
    payload: registrationPayload(`${label}@example.test`, {
      idempotency_key: `eligibility-${label}`,
    }),
    now: openWindow,
  });
  const registrationKey = registration.registration_key ?? '';
  return {
    registrationKey,
    contactKey: (await registrationIdentity(registrationKey)).contactKey,
  };
}

async function applyEligibilityDenial(
  fixture: { registrationKey: string; contactKey: string },
  reason: EventServiceEmailDenialReason,
  suffix: string,
) {
  if (
    reason === 'complaint' ||
    reason === 'hard_bounce' ||
    reason === 'global_suppression' ||
    reason === 'global_dnd' ||
    reason === 'global_unsubscribe'
  ) {
    await recordContactEmailRestriction(pool, testConfig(), {
      contactKey: fixture.contactKey,
      restrictionType: reason,
      action: 'applied',
      source: 'synthetic_test',
      idempotencyKey: `${suffix}-${reason}`,
      recordedAt: openWindow,
    });
  } else if (reason === 'event_withdrawal') {
    await pool.query(
      `UPDATE onetime.event_email_permissions
          SET status = 'withdrawn', denied_at = $1, deny_reason = 'synthetic_withdrawal'
        WHERE registration_key = $2`,
      [openWindow, fixture.registrationKey],
    );
  } else if (reason === 'event_cancelled') {
    await pool.query(
      `UPDATE onetime.event_registrations
          SET registration_status = 'cancelled', cancelled_at = $1,
              cancellation_reason = 'synthetic_cancellation'
        WHERE registration_key = $2`,
      [openWindow, fixture.registrationKey],
    );
  } else if (reason === 'identity_archived') {
    await pool.query(`UPDATE onetime.contacts SET archived_at = $1 WHERE contact_key = $2`, [
      openWindow,
      fixture.contactKey,
    ]);
  } else if (reason === 'identity_ambiguous') {
    await pool.query(
      `UPDATE onetime.event_registrations
          SET identity_status = 'ambiguous'
        WHERE registration_key = $1`,
      [fixture.registrationKey],
    );
  } else if (reason === 'identity_invalid') {
    await pool.query(
      `UPDATE onetime.event_registrations
          SET identity_status = 'invalid'
        WHERE registration_key = $1`,
      [fixture.registrationKey],
    );
  } else if (reason === 'identity_mismatch') {
    await pool.query(
      `UPDATE onetime.event_registrations SET contact_key = NULL WHERE registration_key = $1`,
      [fixture.registrationKey],
    );
  } else if (reason === 'permission_missing') {
    await pool.query(`DELETE FROM onetime.event_email_permissions WHERE registration_key = $1`, [
      fixture.registrationKey,
    ]);
  } else if (reason === 'permission_inactive') {
    await pool.query(
      `UPDATE onetime.event_email_permissions
          SET status = 'granted', granted_at = NULL
        WHERE registration_key = $1`,
      [fixture.registrationKey],
    );
  } else if (reason === 'identity_missing') {
    return {
      registrationKey: `${fixture.registrationKey}-missing`,
      contactKey: fixture.contactKey,
    };
  }
  return fixture;
}

function failRestrictionProjectionPool(sourcePool: DbPool, idempotencyKey: string): DbPool {
  return {
    query: sourcePool.query.bind(sourcePool),
    end: sourcePool.end.bind(sourcePool),
    connect: async () => {
      const client = await sourcePool.connect();
      const query = (async (text: string, values?: unknown[]) => {
        if (/^\s*ROLLBACK\s*$/i.test(text)) {
          const result = await client.query(text);
          // pg-mem accepts ROLLBACK but does not revert DML. Mirror PostgreSQL rollback semantics
          // in this injected client; the PG16/PG18 assurance executes the service on real engines.
          await client.query(
            `DELETE FROM onetime.contact_email_restriction_events
              WHERE idempotency_key = $1`,
            [idempotencyKey],
          );
          return result;
        }
        if (/INSERT\s+INTO\s+onetime\.contact_email_restrictions\s*\(/i.test(text)) {
          throw new Error('SYNTHETIC_RESTRICTION_PROJECTION_FAILURE');
        }
        return client.query(text, values);
      }) as typeof client.query;
      return {
        query,
        release: () => client.release(),
      } as typeof client;
    },
  };
}

async function restrictionProjection(contactKey: string, restrictionType: string) {
  const result = await pool.query<{ active: boolean; effective_at: Date | string }>(
    `SELECT active, effective_at
       FROM onetime.contact_email_restrictions
      WHERE contact_key = $1 AND restriction_type = $2`,
    [contactKey, restrictionType],
  );
  const row = result.rows[0];
  return row
    ? {
        active: row.active,
        effective_at: new Date(row.effective_at),
      }
    : null;
}

async function expectRestrictionCounts(
  contactKey: string,
  restrictionType: string,
  eventCount: number,
  projectionCount: number,
) {
  const result = await pool.query<{
    event_count: number | number[];
    projection_count: number | number[];
  }>(
    `SELECT
       (SELECT count(*)::int
          FROM onetime.contact_email_restriction_events
         WHERE contact_key = $1 AND restriction_type = $2) AS event_count,
       (SELECT count(*)::int
          FROM onetime.contact_email_restrictions
         WHERE contact_key = $1 AND restriction_type = $2) AS projection_count`,
    [contactKey, restrictionType],
  );
  const row = result.rows[0];
  const count = (value: number | number[] | undefined) =>
    Number(Array.isArray(value) ? value[0] : (value ?? 0));
  expect({
    event_count: count(row?.event_count),
    projection_count: count(row?.projection_count),
  }).toEqual({ event_count: eventCount, projection_count: projectionCount });
}

async function registrationDeliveryKey(registrationKey: string) {
  const result = await pool.query<{ delivery_key: string }>(
    `SELECT delivery_key
       FROM onetime.outbox_events
      WHERE event_type = 'highlevel.event.registration.recorded.v1'
        AND payload->'data'->>'registration_key' = $1`,
    [registrationKey],
  );
  return String(result.rows[0]?.delivery_key);
}

async function readHighLevelEventPayload(deliveryKey: string) {
  const result = await pool.query<{ payload: unknown }>(
    `SELECT payload FROM onetime.outbox_events WHERE delivery_key = $1`,
    [deliveryKey],
  );
  return highLevelOutboundEventSchema.parse(result.rows[0]?.payload);
}

async function writeHighLevelEventPayload(deliveryKey: string, event: HighLevelOutboundEvent) {
  await pool.query(`UPDATE onetime.outbox_events SET payload = $2::jsonb WHERE delivery_key = $1`, [
    deliveryKey,
    JSON.stringify(event),
  ]);
}

async function outboxAuthorizationState(deliveryKey: string) {
  const result = await pool.query<{
    status: string;
    transport_mode: string;
    transport_authorization_state: string;
  }>(
    `SELECT status, transport_mode, transport_authorization_state
       FROM onetime.outbox_events
      WHERE delivery_key = $1`,
    [deliveryKey],
  );
  return result.rows[0];
}

async function revocationAudit(deliveryKey: string) {
  const result = await pool.query<{ metadata: unknown }>(
    `SELECT metadata
       FROM onetime.audit_events
      WHERE event_type = 'event_registration_highlevel_revoked'
        AND metadata->>'delivery_key' = $1
      LIMIT 1`,
    [deliveryKey],
  );
  const metadata = result.rows[0]?.metadata;
  return typeof metadata === 'string'
    ? (JSON.parse(metadata) as Record<string, unknown>)
    : (metadata as Record<string, unknown> | undefined);
}

async function expectEligibility(registrationKey: string, contactKey: string, reason: string) {
  await expect(
    evaluateEventServiceEmailEligibility(pool, testConfig(), {
      eventCode: 'tisha-bav-2026',
      registrationKey,
      contactKey,
    }),
  ).resolves.toEqual({ allowed: false, reason });
}

async function stateSnapshot() {
  const queries = [
    `SELECT * FROM onetime.event_registrations ORDER BY registration_key`,
    `SELECT * FROM onetime.event_email_permission_events ORDER BY permission_event_key`,
    `SELECT * FROM onetime.event_email_permissions ORDER BY permission_key`,
    `SELECT * FROM onetime.outbox_events ORDER BY delivery_key`,
    `SELECT * FROM onetime.audit_events ORDER BY event_key`,
  ];
  return JSON.stringify(
    await Promise.all(queries.map(async (query) => (await pool.query(query)).rows)),
  );
}

async function expectCount(table: string, expected: number) {
  const counts = await pool.query(`SELECT count(*)::int AS count FROM onetime.${table}`);
  const count = Array.isArray(counts.rows[0].count)
    ? counts.rows[0].count[0]
    : counts.rows[0].count;
  expect(count).toBe(expected);
}

async function startServer(config: AppConfig, now: Date, distDir?: string) {
  const app = createApp({
    config,
    pool,
    clock: () => now,
    ...(distDir ? { distDir } : {}),
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listening = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve(listening);
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('missing server address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
