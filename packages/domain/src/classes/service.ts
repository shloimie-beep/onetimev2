import type { AppConfig } from '../../../config/src/index.ts';
import type {
  ClassOccurrenceDetail,
  ClassOccurrenceSummary,
  ClassProductState,
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
import { householdHasLearningAccess } from '../billing/portal-access.ts';
import { stableKey } from '../lead/normalize.ts';
import { enqueueHighLevelEvent } from '../highlevel/producer.ts';
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

type ClassSummaryBase = Omit<
  ClassOccurrenceSummary,
  'product_state' | 'protected_access_state' | 'next_action'
>;

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
    if (!(await adultPortalRelationshipAllowsClassWork(client, input.config, row.contact_key))) {
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

    const householdKey = await entitledHouseholdForAdultContact(
      client,
      input.config,
      row.contact_key,
      input.now ?? new Date(),
    );
    if (householdKey && channels.length > 0) {
      const highLevel = await enqueueHighLevelEvent(client, input.config, {
        eventName: 'class.reminder.requested',
        contactKey: row.contact_key,
        idempotencyKey: stableKey('class_reminder_requested', [occurrenceKey, row.contact_key]),
        actor: { kind: 'system', reference: 'class_fulfillment' },
        occurredAt: input.now ?? new Date(),
        protectedPath: '/app/parent',
        data: {
          household_key: householdKey,
          occurrence_key: occurrenceKey,
          starts_at: window.startsAt.toISOString(),
          timezone: ONE_TIME_CLASS_TIME_ZONE,
        },
        confirmed: true,
        entitled: true,
      });
      if (highLevel.state !== 'blocked') deliveryKeys.push(highLevel.deliveryKey);
    }

    return { occurrenceKey, deliveryKeys, dispatchMode: window.dispatchMode };
  });
}

async function adultPortalRelationshipAllowsClassWork(
  client: Queryable,
  config: AppConfig,
  contactKey: string,
) {
  const result = await client.query(
    `SELECT guardians.status AS relationship_status,
            guardians.authority,
            households.status AS household_status
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
       JOIN onetime.portal_households AS households
         ON households.account_key = guardians.account_key
        AND households.product_key = guardians.product_key
        AND households.household_key = guardians.household_key
      WHERE contacts.account_key = $1
        AND contacts.product_key = $2
        AND contacts.contact_key = $3`,
    [config.accountKey, config.productKey, contactKey],
  );
  if (result.rows.length === 0) return true;
  return result.rows.some(
    (row) =>
      String(row.relationship_status) === 'active' &&
      ['primary_guardian', 'guardian'].includes(String(row.authority)) &&
      String(row.household_status) === 'active',
  );
}

async function entitledHouseholdForAdultContact(
  client: Queryable,
  config: AppConfig,
  contactKey: string,
  now: Date,
) {
  const result = await client.query(
    `SELECT guardians.household_key
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
        AND access.effective_at <= $4
        AND (access.expires_at IS NULL OR access.expires_at > $4)
      WHERE contacts.account_key = $1
        AND contacts.product_key = $2
        AND contacts.contact_key = $3
      ORDER BY guardians.updated_at DESC
      LIMIT 1`,
    [config.accountKey, config.productKey, contactKey, now],
  );
  const householdKey = result.rows[0]?.household_key;
  return typeof householdKey === 'string' ? householdKey : null;
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
  const [counts, enrollment, attendance, content, questions] = await Promise.all([
    fulfillmentCounts(input.pool, input.config, input.occurrenceKey),
    enrollmentCounts(input.pool, input.config),
    attendanceSummary(input.pool, input.config, input.occurrenceKey),
    contentSummary(input.pool, input.config, input.occurrenceKey),
    questionSummary(input.pool, input.config, input.occurrenceKey),
  ]);
  const summary = occurrenceSummary(row, input.now ?? new Date());
  return {
    ...summary,
    readiness: readinessForOccurrence(summary.occurrence_key),
    enrollment_counts: enrollment,
    attendance_summary: attendance,
    content_summary: content,
    question_summary: questions,
    fulfillment_counts: counts,
  };
}

export async function listClassOccurrencesForLearner(input: {
  pool: DbPool;
  config: AppConfig;
  householdKey: string;
  learnerKey: string;
  limit?: number;
  now?: Date;
}): Promise<ClassOccurrenceSummary[]> {
  const now = input.now ?? new Date();
  const result = await input.pool.query(
    `SELECT occurrences.*, series.title, series.timezone
       FROM onetime.classroom_occurrence_learner_entitlements AS enrollment
       JOIN onetime.portal_learners AS learner
         ON learner.account_key = enrollment.account_key
        AND learner.product_key = enrollment.product_key
        AND learner.household_key = enrollment.household_key
        AND learner.learner_key = enrollment.learner_key
        AND learner.learner_status = 'active'
       JOIN onetime.class_occurrences AS occurrences
         ON occurrences.account_key = enrollment.account_key
        AND occurrences.product_key = enrollment.product_key
        AND occurrences.occurrence_key = enrollment.occurrence_key
       JOIN onetime.class_series AS series
         ON series.account_key = occurrences.account_key
        AND series.product_key = occurrences.product_key
        AND series.class_series_key = occurrences.class_series_key
      WHERE enrollment.account_key = $1
        AND enrollment.product_key = $2
        AND enrollment.household_key = $3
        AND enrollment.learner_key = $4
        AND enrollment.entitlement_state = 'active'
        AND occurrences.joinable_until >= $5
      ORDER BY occurrences.starts_at ASC, occurrences.occurrence_key ASC
      LIMIT $6`,
    [
      input.config.accountKey,
      input.config.productKey,
      input.householdKey,
      input.learnerKey,
      now,
      input.limit ?? 3,
    ],
  );
  return result.rows.map((row) => occurrenceSummary(row, now));
}

export function createClassPortalAccessAdapter(input: {
  pool: DbPool;
  config: AppConfig;
  now?: () => Date;
}): LearnerClassAccessAdapter {
  return {
    upcomingForLearner: async ({ actor, learner }) => {
      const hasAccess = await householdHasLearningAccess({
        pool: input.pool,
        accountKey: actor.account_key,
        productKey: actor.product_key,
        householdKey: learner.household_key,
      });
      if (!hasAccess) return [];
      const rows = await listClassOccurrencesForLearner({
        pool: input.pool,
        config: {
          ...input.config,
          accountKey: actor.account_key,
          productKey: actor.product_key,
        },
        householdKey: learner.household_key,
        learnerKey: learner.learner_key,
        limit: 3,
        now: input.now?.() ?? new Date(),
      });
      return rows.map((row) => portalSummary(row, true));
    },
    protectedLaunch: async ({ actor, learner, class_key }) => {
      const hasAccess = await householdHasLearningAccess({
        pool: input.pool,
        accountKey: actor.account_key,
        productKey: actor.product_key,
        householdKey: learner.household_key,
      });
      if (!hasAccess) return billingRequiredAction(class_key);
      const enrollment = await input.pool.query(
        `SELECT occurrences.occurrence_state
           FROM onetime.classroom_occurrence_learner_entitlements AS enrollment
           JOIN onetime.class_occurrences AS occurrences
             ON occurrences.account_key = enrollment.account_key
            AND occurrences.product_key = enrollment.product_key
            AND occurrences.occurrence_key = enrollment.occurrence_key
          WHERE enrollment.account_key = $1
            AND enrollment.product_key = $2
            AND enrollment.household_key = $3
            AND enrollment.learner_key = $4
            AND enrollment.occurrence_key = $5
            AND enrollment.entitlement_state = 'active'
          LIMIT 1`,
        [
          actor.account_key,
          actor.product_key,
          learner.household_key,
          learner.learner_key,
          class_key,
        ],
      );
      if (!enrollment.rows[0] || enrollment.rows[0].occurrence_state === 'cancelled') {
        return classAccessDeniedAction(class_key);
      }
      return providerUnavailableAction(class_key);
    },
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
  const scheduledEndsAt = new Date(window.startsAt.getTime() + 60 * 60_000);
  const joinOpensAt = new Date(window.startsAt.getTime() - 10 * 60_000);
  const joinClosesAt = new Date(window.startsAt.getTime() + 75 * 60_000);
  await client.query(
    `INSERT INTO onetime.class_occurrences
       (occurrence_key, account_key, product_key, class_series_key, local_class_date,
         starts_at, reminder_due_at, joinable_until, occurrence_state, reminder_state,
         scheduled_ends_at, join_opens_at, join_closes_at)
     VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, 'scheduled', 'pending', $9, $10, $11)
     ON CONFLICT (account_key, product_key, class_series_key, local_class_date)
     DO UPDATE SET
       starts_at = EXCLUDED.starts_at,
       reminder_due_at = EXCLUDED.reminder_due_at,
       joinable_until = EXCLUDED.joinable_until,
       scheduled_ends_at = EXCLUDED.scheduled_ends_at,
       join_opens_at = EXCLUDED.join_opens_at,
       join_closes_at = EXCLUDED.join_closes_at,
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
      joinClosesAt,
      scheduledEndsAt,
      joinOpensAt,
      joinClosesAt,
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

async function enrollmentCounts(pool: DbPool, config: AppConfig) {
  const result = await pool.query(
    `SELECT
        (SELECT count(*)::int
           FROM onetime.portal_households
          WHERE account_key = $1
            AND product_key = $2
            AND status = 'active') AS households,
        (SELECT count(*)::int
           FROM onetime.portal_learners
          WHERE account_key = $1
            AND product_key = $2
            AND learner_status = 'active') AS learners`,
    [config.accountKey, config.productKey],
  );
  const row = result.rows[0] ?? {};
  return {
    households: numberFromRow(row.households),
    learners: numberFromRow(row.learners),
  };
}

async function attendanceSummary(pool: DbPool, config: AppConfig, occurrenceKey: string) {
  const result = await pool.query(
    `SELECT
        (SELECT count(*)::int
           FROM onetime.class_attendance_marks
          WHERE account_key = $1
            AND product_key = $2
            AND occurrence_key = $3) AS manual_marks,
        (SELECT count(*)::int
           FROM onetime.classroom_attendance_attempts
          WHERE account_key = $1
            AND product_key = $2
            AND occurrence_key = $3) AS launch_attempts,
        (SELECT count(*)::int
           FROM onetime.classroom_attendance_attempts
          WHERE account_key = $1
            AND product_key = $2
            AND occurrence_key = $3
            AND status IN ('joining', 'joined', 'left')) AS joined_attempts`,
    [config.accountKey, config.productKey, occurrenceKey],
  );
  const row = result.rows[0] ?? {};
  return {
    manual_marks: numberFromRow(row.manual_marks),
    launch_attempts: numberFromRow(row.launch_attempts),
    joined_attempts: numberFromRow(row.joined_attempts),
  };
}

async function contentSummary(pool: DbPool, config: AppConfig, occurrenceKey: string) {
  const result = await pool.query(
    `SELECT
        count(*) FILTER (WHERE item_type = 'video')::int AS videos,
        count(*) FILTER (WHERE item_type IN ('sheet', 'review'))::int AS review_sheets,
        count(*) FILTER (WHERE lifecycle_state IN ('received', 'transcribing', 'processing'))::int
          AS processing,
        count(*) FILTER (WHERE lifecycle_state IN ('review_needed', 'failed'))::int AS needs_review
       FROM onetime.content_items
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3
        AND retention_state = 'active'`,
    [config.accountKey, config.productKey, occurrenceKey],
  );
  const row = result.rows[0] ?? {};
  return {
    videos: numberFromRow(row.videos),
    review_sheets: numberFromRow(row.review_sheets),
    processing: numberFromRow(row.processing),
    needs_review: numberFromRow(row.needs_review),
  };
}

async function questionSummary(pool: DbPool, config: AppConfig, occurrenceKey: string) {
  const result = await pool.query(
    `SELECT
        count(*) FILTER (WHERE status = 'new')::int AS new_questions,
        count(*) FILTER (WHERE status = 'featured')::int AS featured_questions,
        count(*) FILTER (WHERE status = 'answered')::int AS answered_questions
       FROM onetime.classroom_student_questions
      WHERE account_key = $1
        AND product_key = $2
        AND occurrence_key = $3`,
    [config.accountKey, config.productKey, occurrenceKey],
  );
  const row = result.rows[0] ?? {};
  return {
    new_questions: numberFromRow(row.new_questions),
    featured_questions: numberFromRow(row.featured_questions),
    answered_questions: numberFromRow(row.answered_questions),
  };
}

function occurrenceSummary(row: Record<string, unknown>, now: Date): ClassOccurrenceSummary {
  const startsAt = asDate(row.starts_at);
  const joinableUntil = asDate(row.joinable_until);
  const base: ClassSummaryBase = {
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
  const protectedAccess = protectedAccessProductState(base.access_state);
  const productState = classProductState(base, protectedAccess);
  return {
    ...base,
    product_state: productState,
    protected_access_state: protectedAccess,
    next_action: productState.action_label,
  };
}

function readinessForOccurrence(occurrenceKey: string): ClassReadiness {
  return {
    occurrence_key: occurrenceKey,
    provider_status: 'provider_unavailable',
    reason: 'Protected classroom access is not connected yet.',
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

function portalSummary(summary: ClassOccurrenceSummary, hasAccess: boolean): UpcomingClassSummary {
  return {
    class_key: summary.occurrence_key,
    title: summary.title,
    starts_at: summary.starts_at,
    local_time: '19:00',
    timezone: 'Asia/Jerusalem',
    protected_launch_required: true,
    provider_state: 'not_configured',
    status: hasAccess ? (summary.status === 'live' ? 'live' : 'upcoming') : 'unavailable',
    launch_action: hasAccess
      ? providerUnavailableAction(summary.occurrence_key)
      : billingRequiredAction(summary.occurrence_key),
  };
}

function providerUnavailableAction(classKey: string): ProtectedActionDescriptor {
  return {
    action_key: stableKey('class_launch_action', [classKey]),
    label: 'Class access not connected',
    kind: 'class_launch',
    method: 'POST',
    href: null,
    launch_token_ref: 'provider_unavailable',
    expires_at: null,
  };
}

function classAccessDeniedAction(classKey: string): ProtectedActionDescriptor {
  return {
    action_key: stableKey('class_access_denied_action', [classKey]),
    label: 'Class access unavailable',
    kind: 'class_launch',
    method: 'POST',
    href: null,
    launch_token_ref: 'class_access_denied',
    expires_at: null,
  };
}

function protectedAccessProductState(accessState: string): ClassProductState {
  if (accessState === 'ready' || accessState === 'available') {
    return {
      label: 'Ready',
      explanation: 'Protected classroom access is ready.',
      action_label: 'Open classroom access',
    };
  }
  if (accessState === 'pending' || accessState === 'issued') {
    return {
      label: 'Processing',
      explanation: 'Protected classroom access is being prepared.',
      action_label: 'Check access',
    };
  }
  if (accessState === 'provider_unavailable' || accessState === 'unavailable') {
    return {
      label: 'Not connected',
      explanation: 'Protected classroom access is not connected yet.',
      action_label: 'Review classroom setup',
    };
  }
  if (accessState === 'failed' || accessState === 'expired') {
    return {
      label: 'Action needed',
      explanation: 'Protected classroom access needs owner review before families can join.',
      action_label: 'Review access issue',
    };
  }
  return {
    label: 'No data yet',
    explanation: 'No protected classroom access state has been recorded yet.',
    action_label: 'Review classroom setup',
  };
}

function classProductState(
  summary: ClassSummaryBase,
  protectedAccess: ClassProductState,
): ClassProductState {
  if (summary.status === 'cancelled') {
    return {
      label: 'Temporarily unavailable',
      explanation: 'This class occurrence is cancelled.',
      action_label: null,
    };
  }
  if (summary.recording_state === 'failed' || summary.attendance_state === 'failed') {
    return {
      label: 'Action needed',
      explanation: 'This class has a recording or attendance issue that needs review.',
      action_label: 'Review class issue',
    };
  }
  if (protectedAccess.label === 'Not connected' || protectedAccess.label === 'Action needed') {
    return protectedAccess;
  }
  if (summary.delivery_state === 'pending' || summary.reminder_state === 'pending') {
    return {
      label: 'Processing',
      explanation: 'Class reminders or delivery records are still being prepared.',
      action_label: 'Check reminder status',
    };
  }
  if (summary.status === 'completed' && summary.recording_state === 'not_expected') {
    return {
      label: 'No data yet',
      explanation: 'The class ended, but no recording or review content is associated yet.',
      action_label: 'Review class content',
    };
  }
  return {
    label: 'Ready',
    explanation: 'The class schedule and current classroom records are ready to review.',
    action_label: 'Open class details',
  };
}

function numberFromRow(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function billingRequiredAction(classKey: string): ProtectedActionDescriptor {
  return {
    action_key: stableKey('class_billing_required_action', [classKey]),
    label: 'Billing required',
    kind: 'class_launch',
    method: 'POST',
    href: null,
    launch_token_ref: 'billing_required',
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
