import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../../packages/config/src/index.ts';
import {
  createMemoryPool,
  inTransaction,
  runMigrations,
  type DbPool,
} from '../../../packages/db/src/index.ts';
import { createAccountUser } from '../../../packages/domain/src/auth/service.ts';
import { enqueueRecordingAvailableForEntitledAdults } from '../../../packages/domain/src/highlevel/producer.ts';
import { captureLead } from '../../../packages/domain/src/lead/service.ts';

const now = new Date('2026-07-23T10:00:00.000Z');
const parentEmail = 'outbound.authority.parent@example.test';

let pool: DbPool;
let config: AppConfig;

beforeEach(async () => {
  config = loadConfig({
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: 'https://join.onetimeonetime.com',
    HIGHLEVEL_EVENT_SYNC_MODE: 'mock',
  });
  pool = createMemoryPool();
  await runMigrations(pool);
});

afterEach(async () => {
  await pool.end();
});

describe('HighLevel outbound household authority', () => {
  it.each([
    ['active guardian', 'active', 'primary_guardian', 1],
    ['support-only relationship', 'active', 'support_only', 0],
    ['archived household', 'archived', 'primary_guardian', 0],
  ] as const)(
    'queues recording work for %s only when household and guardian authority are active',
    async (_label, householdStatus, authority, expected) => {
      const lead = await captureLead({
        pool,
        config,
        now,
        payload: {
          contact_name: 'Outbound Parent',
          family_or_school: 'Outbound Family',
          audience_type: 'family',
          location: 'Jerusalem',
          timezone: 'Asia/Jerusalem',
          email: parentEmail,
          phone: '',
          reminder_preference: 'email',
          reminder_consent: true,
          consent_context: {
            policy_version: 'communications-2026-07-23.1',
            purpose: 'optional_class_reminders',
            source: 'public_signup',
            channels: ['email'],
            captured_at: now.toISOString(),
            withdrawal_state: 'not_withdrawn',
            suppression_state: 'active',
          },
          idempotency_key: 'outbound-authority-lead-0001',
          attribution: { landing_path: '/signup' },
        },
      });
      const parentUserKey = await createAccountUser({
        pool,
        config,
        email: parentEmail,
        password: 'OutboundParent!234',
        displayName: 'Outbound Parent',
        role: 'parent',
        mfaCapable: false,
      });
      await pool.query(
        `INSERT INTO onetime.portal_households
           (household_key, account_key, product_key, display_name, status)
         VALUES ('outbound_household',$1,$2,'Outbound Household',$3)`,
        [config.accountKey, config.productKey, householdStatus],
      );
      await pool.query(
        `INSERT INTO onetime.portal_guardian_relationships
           (relationship_key, account_key, product_key, household_key, guardian_user_ref,
            relationship_label, authority, status)
         VALUES ('outbound_relationship',$1,$2,'outbound_household',$3,'Parent',$4,'active')`,
        [config.accountKey, config.productKey, parentUserKey, authority],
      );
      await pool.query(
        `INSERT INTO onetime.account_access_projections
           (access_key, account_key, product_key, household_key, state, source_kind,
            effective_at, expires_at, opaque_source_reference, source_revision,
            source_updated_at, source_request_hash, policy_version, last_event_key)
         VALUES ('outbound_access',$1,$2,'outbound_household','active','free_pilot',
            $3,'2026-08-23T10:00:00.000Z','outbound-authority-fixture',1,$3,$4,
            'outbound-authority-v1','outbound_access_event')`,
        [config.accountKey, config.productKey, now, 'd'.repeat(64)],
      );

      const results = await inTransaction(pool, (client) =>
        enqueueRecordingAvailableForEntitledAdults(client, config, {
          contentItemKey: 'outbound_recording',
          occurredAt: now,
          approved: true,
        }),
      );
      expect(results).toHaveLength(expected);
      if (expected === 1) {
        expect(results[0]).toMatchObject({ state: 'queued' });
      }
      const recordingEvents = await pool.query(
        `SELECT payload
           FROM onetime.outbox_events
          WHERE event_type = 'highlevel.recording.available.v1'`,
      );
      expect(recordingEvents.rows).toHaveLength(expected);
      expect(JSON.stringify(recordingEvents.rows)).not.toMatch(/outbound\.authority\.parent/i);
      expect(lead.contact_key).toBeTruthy();
    },
  );
});
