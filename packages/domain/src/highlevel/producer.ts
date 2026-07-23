import type { AppConfig } from '../../../config/src/index.ts';
import {
  HIGHLEVEL_CONTRACT_VERSION,
  assertHighLevelPayloadSafe,
  highLevelOutboundEventSchema,
  type HighLevelEventName,
} from '../../../contracts/src/highlevel/index.ts';
import type { Queryable } from '../../../db/src/index.ts';
import { stableKey } from '../lead/normalize.ts';

type ActorKind = 'system' | 'admin' | 'parent';

export type HighLevelEventInput = {
  eventName: HighLevelEventName;
  contactKey: string;
  idempotencyKey: string;
  actor: { kind: ActorKind; reference: string };
  occurredAt: Date;
  protectedPath: '/signup' | '/app/parent' | '/login' | '/forgot-password';
  data?: {
    signup_key?: string;
    household_key?: string;
    occurrence_key?: string;
    content_item_key?: string;
    starts_at?: string;
    timezone?: string;
    classification?: 'family' | 'school';
    portal_status?: 'invited' | 'active';
  };
  confirmed?: boolean;
  entitled?: boolean;
  approved?: boolean;
};

export type HighLevelEnqueueResult =
  | { state: 'queued' | 'duplicate'; deliveryKey: string }
  | {
      state: 'blocked';
      code:
        | 'ADULT_CONTACT_NOT_FOUND'
        | 'CONSENT_MISSING'
        | 'SUPPRESSED'
        | 'DND_ACTIVE'
        | 'WRONG_SCOPE'
        | 'CLASS_NOT_CONFIRMED'
        | 'HOUSEHOLD_NOT_ENTITLED'
        | 'CONTENT_NOT_APPROVED';
    };

type AdultContactRow = {
  contact_key: string;
  family_school_classification: 'family' | 'school';
  reminder_preference: 'email' | 'whatsapp' | 'both' | 'none';
  consent_policy_version: string | null;
  consent_recorded_at: Date | string | null;
  suppression_state: string;
  email_dnd: boolean | null;
  whatsapp_dnd: boolean | null;
  all_dnd: boolean | null;
};

export async function enqueueHighLevelEvent(
  client: Queryable,
  config: AppConfig,
  input: HighLevelEventInput,
): Promise<HighLevelEnqueueResult> {
  if (config.accountKey.length < 1 || config.productKey.length < 1) {
    return { state: 'blocked', code: 'WRONG_SCOPE' };
  }
  const contact = await loadAdultContact(client, config, input.contactKey);
  if (!contact) return { state: 'blocked', code: 'ADULT_CONTACT_NOT_FOUND' };
  if (!contact.consent_recorded_at || !contact.consent_policy_version) {
    return { state: 'blocked', code: 'CONSENT_MISSING' };
  }
  if (contact.suppression_state !== 'active') {
    return { state: 'blocked', code: 'SUPPRESSED' };
  }
  if (contact.all_dnd || contact.email_dnd) {
    return { state: 'blocked', code: 'DND_ACTIVE' };
  }
  if (input.eventName === 'class.reminder.requested') {
    if (!input.confirmed) return { state: 'blocked', code: 'CLASS_NOT_CONFIRMED' };
    if (!input.entitled) return { state: 'blocked', code: 'HOUSEHOLD_NOT_ENTITLED' };
  }
  if (input.eventName === 'recording.available') {
    if (!input.approved) return { state: 'blocked', code: 'CONTENT_NOT_APPROVED' };
    if (!input.entitled) return { state: 'blocked', code: 'HOUSEHOLD_NOT_ENTITLED' };
  }

  const capturedAt = new Date(contact.consent_recorded_at).toISOString();
  const emailGranted = ['email', 'both'].includes(contact.reminder_preference);
  const whatsappGranted = ['whatsapp', 'both'].includes(contact.reminder_preference);
  if (!emailGranted) return { state: 'blocked', code: 'CONSENT_MISSING' };

  const deliveryKey = stableKey('highlevel_delivery', [
    config.accountKey,
    config.productKey,
    input.eventName,
    input.idempotencyKey,
  ]);
  const event = highLevelOutboundEventSchema.parse({
    contract_version: HIGHLEVEL_CONTRACT_VERSION,
    event_name: input.eventName,
    event_id: stableKey('highlevel_event', [deliveryKey]),
    idempotency_key: input.idempotencyKey,
    occurred_at: input.occurredAt.toISOString(),
    actor: input.actor,
    scope: {
      account_key: config.accountKey,
      product_key: config.productKey,
      location_id: config.highLevelLocationId,
    },
    adult_contact: { contact_key: contact.contact_key, adult_only: true },
    consent: {
      email: emailGranted ? 'granted' : 'not_granted',
      whatsapp: whatsappGranted ? 'granted' : 'not_granted',
      suppression_state: 'active',
      email_dnd: Boolean(contact.email_dnd || contact.all_dnd),
      whatsapp_dnd: Boolean(contact.whatsapp_dnd || contact.all_dnd),
      policy_version: contact.consent_policy_version,
      captured_at: capturedAt,
    },
    protected_reference: { kind: 'one_time_path', path: input.protectedPath },
    data: input.data ?? {},
  });
  assertHighLevelPayloadSafe(event);

  const inserted = await client.query(
    `INSERT INTO onetime.outbox_events
       (delivery_key, account_key, product_key, contact_key, event_type, channel,
         transport_mode, transport_authorization_state, payload, status, next_attempt_at)
     VALUES ($1, $2, $3, $4, $5, 'highlevel', $6, 'held', $7::jsonb, 'pending', $8)
     ON CONFLICT (delivery_key) DO NOTHING
     RETURNING delivery_key`,
    [
      deliveryKey,
      config.accountKey,
      config.productKey,
      contact.contact_key,
      `highlevel.${input.eventName}.v1`,
      config.highLevelEventSyncMode,
      JSON.stringify(event),
      input.occurredAt,
    ],
  );
  await client.query(
    `INSERT INTO onetime.audit_events
       (event_key, account_key, product_key, contact_key, event_type, metadata, created_at)
     VALUES ($1, $2, $3, $4, 'highlevel_event_recorded', $5::jsonb, $6)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      stableKey('audit_highlevel', [deliveryKey]),
      config.accountKey,
      config.productKey,
      contact.contact_key,
      JSON.stringify({ event_name: input.eventName, delivery_key: deliveryKey, adult_only: true }),
      input.occurredAt,
    ],
  );
  return { state: inserted.rowCount ? 'queued' : 'duplicate', deliveryKey };
}

export async function enqueueHighLevelEventForAdultEmail(
  client: Queryable,
  config: AppConfig,
  input: Omit<HighLevelEventInput, 'contactKey'> & { emailNormalized: string },
) {
  const result = await client.query(
    `SELECT contact_key
       FROM onetime.contacts
      WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3
        AND archived_at IS NULL
        AND family_school_classification IN ('family', 'school')
      LIMIT 1`,
    [config.accountKey, config.productKey, input.emailNormalized.trim().toLowerCase()],
  );
  const contactKey = result.rows[0]?.contact_key;
  if (typeof contactKey !== 'string') {
    return { state: 'blocked', code: 'ADULT_CONTACT_NOT_FOUND' } as const;
  }
  const { emailNormalized: _emailNormalized, ...event } = input;
  void _emailNormalized;
  return enqueueHighLevelEvent(client, config, { ...event, contactKey });
}

export async function enqueueRecordingAvailableForEntitledAdults(
  client: Queryable,
  config: AppConfig,
  input: { contentItemKey: string; occurredAt: Date; approved: boolean },
) {
  if (!input.approved) return [];
  const adults = await client.query(
    `SELECT DISTINCT contacts.contact_key, guardians.household_key
       FROM onetime.contacts AS contacts
       JOIN onetime.account_users AS users
         ON users.account_key = contacts.account_key
        AND users.product_key = contacts.product_key
        AND users.email_normalized = contacts.email_normalized
        AND users.role IN ('owner', 'admin', 'parent')
        AND users.status = 'active'
       JOIN onetime.portal_guardian_relationships AS guardians
         ON guardians.account_key = users.account_key
        AND guardians.product_key = users.product_key
        AND guardians.guardian_user_ref = users.user_key
        AND guardians.status = 'active'
        AND guardians.authority IN ('primary_guardian', 'guardian')
       JOIN onetime.portal_households AS households
         ON households.account_key = guardians.account_key
        AND households.product_key = guardians.product_key
        AND households.household_key = guardians.household_key
        AND households.status = 'active'
       JOIN onetime.account_access_projections AS access
         ON access.account_key = guardians.account_key
        AND access.product_key = guardians.product_key
        AND access.household_key = guardians.household_key
        AND access.state IN ('active', 'grace', 'scheduled_end')
        AND access.effective_at <= $3
        AND (access.expires_at IS NULL OR access.expires_at > $3)
      WHERE contacts.account_key = $1
        AND contacts.product_key = $2
        AND contacts.archived_at IS NULL`,
    [config.accountKey, config.productKey, input.occurredAt],
  );
  const results: HighLevelEnqueueResult[] = [];
  for (const row of adults.rows) {
    results.push(
      await enqueueHighLevelEvent(client, config, {
        eventName: 'recording.available',
        contactKey: String(row.contact_key),
        idempotencyKey: stableKey('recording_available', [
          input.contentItemKey,
          String(row.household_key),
          String(row.contact_key),
        ]),
        actor: { kind: 'system', reference: 'content_publication' },
        occurredAt: input.occurredAt,
        protectedPath: '/app/parent',
        data: {
          content_item_key: input.contentItemKey,
          household_key: String(row.household_key),
        },
        approved: true,
        entitled: true,
      }),
    );
  }
  return results;
}

async function loadAdultContact(client: Queryable, config: AppConfig, contactKey: string) {
  const result = await client.query(
    `SELECT contacts.contact_key,
            contacts.family_school_classification,
            contacts.reminder_preference,
            contacts.consent_policy_version,
            contacts.consent_recorded_at,
            contacts.suppression_state,
            preferences.email_dnd,
            preferences.whatsapp_dnd,
            preferences.all_dnd
       FROM onetime.contacts AS contacts
       LEFT JOIN onetime.highlevel_contact_preferences AS preferences
         ON preferences.account_key = contacts.account_key
        AND preferences.product_key = contacts.product_key
        AND preferences.contact_key = contacts.contact_key
      WHERE contacts.account_key = $1
        AND contacts.product_key = $2
        AND contacts.contact_key = $3
        AND contacts.archived_at IS NULL
        AND contacts.family_school_classification IN ('family', 'school')
      LIMIT 1`,
    [config.accountKey, config.productKey, contactKey],
  );
  return (result.rows[0] as AdultContactRow | undefined) ?? null;
}
