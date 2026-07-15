import type { AppConfig } from '../../../config/src/index.ts';
import type {
  ClassOccurrenceDetail,
  ClassOccurrenceSummary,
  ClassReadiness,
} from '../../../contracts/src/classes/index.ts';
import {
  DELIVERY_EVENT_TYPES,
  type DeliveryChannel,
} from '../../../contracts/src/delivery/types.ts';
import type {
  ProtectedActionDescriptor,
  UpcomingClassSummary,
} from '../../../contracts/src/portals/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import type { LearnerClassAccessAdapter } from '../portals/services.ts';
import { stableKey } from '../lead/normalize.ts';
import {
  ONE_TIME_CLASS_TIME_ZONE,
  resolveDailyClassWindow,
  type DailyClassWindow,
} from './schedule.ts';

export const ONE_TIME_CLASS_SERIES_KEY = 'class_series_one_time_daily';
export const ONE_TIME_CLASS_TITLE = 'Daily One Time Mishnayos';

type SignupContactRow = {
  contact_key: string;
  signup_key: string;
  signup_classification: 'family' | 'school';
  contact_classification: 'family' | 'school';
  reminder_preference: 'email' | 'whatsapp' | 'both' | 'none';
  consent_recorded_at: Date | null;
  suppression_state: string;
  lead_status: string;
  archived_at: Date | null;
  email_normalized: string;
  phone_normalized: string | null;
};

export type ClassFulfillmentResult = {
  occurrenceKey: string | null;
  deliveryKeys: string[];
  dispatchMode: DailyClassWindow['dispatchMode'] | null;
};

export async function scheduleClassFulfillmentForLead(input: {
  pool: DbPool;
  config: AppConfig;
  contactKey: string;
  signupKey: string;
  now?: Date;
}): Promise<ClassFulfillmentResult> {
  return inTransaction(input.pool, async (client) => {
    const row = await loadSignupContact(client, input);
    if (!row || row.signup_classification !== 'family' || row.contact_classification !== 'family') {
      return { occurrenceKey: null, deliveryKeys: [], dispatchMode: null };
    }

    const window = resolveDailyClassWindow(input.now ?? new Date());
    await ensureClassSeries(client, input.config);
    const occurrenceKey = await ensureOccurrence(client, input.config, window);
    const channels = reminderChannels(row);
    const deliveryKeys: string[] = [];

    for (const channel of channels) {
      deliveryKeys.push(
        await enqueueReminderIntent(client, input.config, row, occurrenceKey, window, channel),
      );
    }

    return { occurrenceKey, deliveryKeys, dispatchMode: window.dispatchMode };
  });
}

export async function listClassOccurrences(input: {
  pool: DbPool;
  config: AppConfig;
  limit?: number;
  now?: Date;
}): Promise<ClassOccurrenceSummary[]> {
  const result = await input.pool.query(
    `SELECT occurrences.*, series.title, series.timezone
       FROM onetime.class_occurrences AS occurrences
       JOIN onetime.class_series AS series
         ON series.account_key = occurrences.account_key
        AND series.product_key = occurrences.product_key
        AND series.class_series_key = occurrences.class_series_key
      WHERE occurrences.account_key = $1
        AND occurrences.product_key = $2
      ORDER BY occurrences.starts_at ASC, occurrences.occurrence_key ASC
      LIMIT $3`,
    [input.config.accountKey, input.config.productKey, input.limit ?? 20],
  );
  return result.rows.map((row) => occurrenceSummary(row, input.now ?? new Date()));
}

export async function getClassOccurrenceDetail(input: {
  pool: DbPool;
  config: AppConfig;
  occurrenceKey: string;
  now?: Date;
}): Promise<ClassOccurrenceDetail | null> {
  const result = await input.pool.query(
    `SELECT occurrences.*, series.title, series.timezone
       FROM onetime.class_occurrences AS occurrences
       JOIN onetime.class_series AS series
         ON series.account_key = occurrences.account_key
        AND series.product_key = occurrences.product_key
        AND series.class_series_key = occurrences.class_series_key
      WHERE occurrences.account_key = $1
        AND occurrences.product_key = $2
        AND occurrences.occurrence_key = $3
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, input.occurrenceKey],
  );
  const row = result.rows[0];
  if (!row) return null;
  const counts = await fulfillmentCounts(input.pool, input.config, input.occurrenceKey);
  const summary = occurrenceSummary(row, input.now ?? new Date());
  return {
    ...summary,
    readiness: readinessForOccurrence(summary.occurrence_key),
    fulfillment_counts: counts,
  };
}

export function createClassPortalAccessAdapter(input: {
  pool: DbPool;
  config: AppConfig;
  now?: () => Date;
}): LearnerClassAccessAdapter {
  return {
    upcomingForLearner: async ({ actor }) => {
      const rows = await listClassOccurrences({
        pool: input.pool,
        config: {
          ...input.config,
          accountKey: actor.account_key,
          productKey: actor.product_key,
        },
        limit: 3,
        now: input.now?.() ?? new Date(),
      });
      if (rows.length > 0) return rows.map((row) => portalSummary(row));
      return [derivedPortalSummary(input.now?.() ?? new Date())];
    },
    protectedLaunch: async ({ class_key }) => providerUnavailableAction(class_key),
  };
}

async function loadSignupContact(
  client: Queryable,
  input: { config: AppConfig; contactKey: string; signupKey: string },
): Promise<SignupContactRow | null> {
  const result = await client.query(
    `SELECT contacts.contact_key,
            leads.signup_key,
            leads.classification AS signup_classification,
            contacts.family_school_classification AS contact_classification,
            contacts.reminder_preference,
            contacts.consent_recorded_at,
            contacts.suppression_state,
            contacts.lead_status,
            contacts.archived_at,
            contacts.email_normalized,
            contacts.phone_normalized
       FROM onetime.signup_leads AS leads
       JOIN onetime.contacts AS contacts
         ON contacts.contact_key = leads.contact_key
      WHERE leads.account_key = $1
        AND leads.product_key = $2
        AND leads.signup_key = $3
        AND contacts.contact_key = $4
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, input.signupKey, input.contactKey],
  );
  return (result.rows[0] as SignupContactRow | undefined) ?? null;
}

async function ensureClassSeries(client: Queryable, config: AppConfig) {
  await client.query(
    `INSERT INTO onetime.class_series
       (class_series_key, account_key, product_key, title, timezone, local_start_time, reminder_local_time)
     VALUES ($1, $2, $3, $4, $5, '19:00', '18:30')
     ON CONFLICT (account_key, product_key, class_series_key)
     DO UPDATE SET updated_at = now()
     RETURNING class_series_key`,
    [
      ONE_TIME_CLASS_SERIES_KEY,
      config.accountKey,
      config.productKey,
      ONE_TIME_CLASS_TITLE,
      ONE_TIME_CLASS_TIME_ZONE,
    ],
  );
}

async function ensureOccurrence(client: Queryable, config: AppConfig, window: DailyClassWindow) {
  const occurrenceKey = stableKey('class_occurrence', [
    config.accountKey,
    config.productKey,
    ONE_TIME_CLASS_SERIES_KEY,
    window.localDate,
  ]);
  await client.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
        starts_at, reminder_due_at, joinable_until, occurrence_state, reminder_state)
     VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, 'scheduled', 'pending')
     ON CONFLICT (account_key, product_key, class_series_key, local_class_date)
     DO UPDATE SET
       starts_at = EXCLUDED.starts_at,
       reminder_due_at = EXCLUDED.reminder_due_at,
       joinable_until = EXCLUDED.joinable_until,
       reminder_state = CASE
         WHEN onetime.class_occurrences.reminder_state = 'not_required' THEN 'pending'
         ELSE onetime.class_occurrences.reminder_state
       END,
       updated_at = now()`,
    [
      occurrenceKey,
      config.accountKey,
      config.productKey,
      ONE_TIME_CLASS_SERIES_KEY,
      window.localDate,
      window.startsAt,
      window.reminderDueAt,
      new Date(window.startsAt.getTime() + 90 * 60_000),
    ],
  );
  return occurrenceKey;
}

function reminderChannels(row: SignupContactRow): Extract<DeliveryChannel, 'email' | 'whatsapp'>[] {
  if (row.suppression_state !== 'active' || row.lead_status === 'archived' || row.archived_at) {
    return [];
  }
  if (!row.consent_recorded_at || row.reminder_preference === 'none') return [];
  if (row.reminder_preference === 'email') return ['email'];
  if (row.reminder_preference === 'whatsapp') return row.phone_normalized ? ['whatsapp'] : [];
  return row.phone_normalized ? ['email', 'whatsapp'] : ['email'];
}

async function enqueueReminderIntent(
  client: Queryable,
  config: AppConfig,
  row: SignupContactRow,
  occurrenceKey: string,
  window: DailyClassWindow,
  channel: Extract<DeliveryChannel, 'email' | 'whatsapp'>,
) {
  const eventType =
    channel === 'email'
      ? DELIVERY_EVENT_TYPES.familyClassReminderEmail
      : DELIVERY_EVENT_TYPES.familyClassReminderWhatsApp;
  const deliveryKey = stableKey('delivery', [row.signup_key, occurrenceKey, eventType]);
  const fulfillmentKey = stableKey('class_fulfillment', [
    row.signup_key,
    occurrenceKey,
    eventType,
    channel,
  ]);
  const payload = {
    policy_version: 'ot71-class-reminder-v1',
    occurrence_id: occurrenceKey,
    class_series_key: ONE_TIME_CLASS_SERIES_KEY,
    class_local_date: window.localDate,
    starts_at: window.startsAt.toISOString(),
    reminder_due_at: window.reminderDueAt.toISOString(),
    dispatch_mode: window.dispatchMode,
    deliver_by: window.startsAt.toISOString(),
    protected_launch_required: true,
    provider_state: 'provider_unavailable',
    raw_provider_target_included: false,
  };

  await client.query(
    `INSERT INTO onetime.class_fulfillment_intents
       (fulfillment_key, account_key, product_key, occurrence_key, contact_key, signup_key,
        intent_type, channel, fulfillment_state, delivery_key, reminder_due_at, idempotency_key, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, 'class_reminder', $7, 'queued', $8, $9, $8, $10::jsonb)
     ON CONFLICT (account_key, product_key, occurrence_key, signup_key, intent_type, channel)
     DO UPDATE SET updated_at = now()`,
    [
      fulfillmentKey,
      config.accountKey,
      config.productKey,
      occurrenceKey,
      row.contact_key,
      row.signup_key,
      channel,
      deliveryKey,
      window.reminderDueAt,
      JSON.stringify({
        dispatch_mode: window.dispatchMode,
        raw_provider_target_included: false,
      }),
    ],
  );

  await client.query(
    `INSERT INTO onetime.outbox_events
       (delivery_key, account_key, product_key, contact_key, signup_key, event_type, channel,
        transport_mode, payload, next_attempt_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     ON CONFLICT (delivery_key) DO NOTHING`,
    [
      deliveryKey,
      config.accountKey,
      config.productKey,
      row.contact_key,
      row.signup_key,
      eventType,
      channel,
      config.outboxTransportMode,
      JSON.stringify(payload),
      window.reminderDispatchAt,
    ],
  );

  return deliveryKey;
}

async function fulfillmentCounts(pool: DbPool, config: AppConfig, occurrenceKey: string) {
  const result = await pool.query(
    `SELECT fulfillment_state, count(*)::int AS count
       FROM onetime.class_fulfillment_intents
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3
      GROUP BY fulfillment_state`,
    [config.accountKey, config.productKey, occurrenceKey],
  );
  const counts = {
    queued: 0,
    satisfied: 0,
    suppressed: 0,
    skipped: 0,
    provider_unavailable: 0,
  };
  for (const row of result.rows) {
    const key = String(row.fulfillment_state) as keyof typeof counts;
    if (key in counts) counts[key] = Number(row.count);
  }
  return counts;
}

function occurrenceSummary(row: Record<string, unknown>, now: Date): ClassOccurrenceSummary {
  const startsAt = asDate(row.starts_at);
  const joinableUntil = asDate(row.joinable_until);
  return {
    occurrence_key: String(row.occurrence_key),
    class_series_key: String(row.class_series_key),
    title: String(row.title),
    local_class_date: localDateFromRow(row.local_class_date),
    timezone: String(row.timezone),
    starts_at: startsAt.toISOString(),
    reminder_due_at: asDate(row.reminder_due_at).toISOString(),
    status: statusForOccurrence(String(row.occurrence_state), startsAt, joinableUntil, now),
    acknowledgement_state: String(
      row.acknowledgement_state,
    ) as ClassOccurrenceSummary['acknowledgement_state'],
    reminder_state: String(row.reminder_state) as ClassOccurrenceSummary['reminder_state'],
    access_state: String(row.access_state) as ClassOccurrenceSummary['access_state'],
    attendance_state: String(row.attendance_state) as ClassOccurrenceSummary['attendance_state'],
    delivery_state: String(row.delivery_state) as ClassOccurrenceSummary['delivery_state'],
    recording_state: String(row.recording_state) as ClassOccurrenceSummary['recording_state'],
  };
}

function readinessForOccurrence(occurrenceKey: string): ClassReadiness {
  return {
    occurrence_key: occurrenceKey,
    provider_status: 'provider_unavailable',
    reason: 'Live class provider wiring is owned by the OT-72 provider sandbox train.',
    protected_launch_required: true,
    raw_provider_target_present: false,
    launch_descriptor: {
      kind: 'protected_launch',
      href: null,
      token_ref: 'provider_unavailable',
      expires_at: null,
    },
  };
}

function portalSummary(summary: ClassOccurrenceSummary): UpcomingClassSummary {
  return {
    class_key: summary.occurrence_key,
    title: summary.title,
    starts_at: summary.starts_at,
    status: summary.status === 'live' ? 'live' : 'upcoming',
    launch_action: providerUnavailableAction(summary.occurrence_key),
  };
}

function derivedPortalSummary(now: Date): UpcomingClassSummary {
  const window = resolveDailyClassWindow(now);
  const occurrenceKey = stableKey('class_occurrence', [
    'derived',
    ONE_TIME_CLASS_SERIES_KEY,
    window.localDate,
  ]);
  return {
    class_key: occurrenceKey,
    title: ONE_TIME_CLASS_TITLE,
    starts_at: window.startsAt.toISOString(),
    status: 'unavailable',
    launch_action: providerUnavailableAction(occurrenceKey),
  };
}

function providerUnavailableAction(classKey: string): ProtectedActionDescriptor {
  return {
    action_key: stableKey('class_launch_action', [classKey]),
    label: 'Class provider unavailable',
    kind: 'class_launch',
    method: 'POST',
    href: null,
    launch_token_ref: 'provider_unavailable',
    expires_at: null,
  };
}

function statusForOccurrence(
  state: string,
  startsAt: Date,
  joinableUntil: Date,
  now: Date,
): ClassOccurrenceSummary['status'] {
  if (state === 'cancelled') return 'cancelled';
  if (state === 'completed') return 'completed';
  if (now >= startsAt && now <= joinableUntil) return 'live';
  if (now > joinableUntil) return 'completed';
  return 'scheduled';
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error('Database returned an invalid class date.');
  return parsed;
}

function localDateFromRow(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

export { resolveDailyClassWindow };
