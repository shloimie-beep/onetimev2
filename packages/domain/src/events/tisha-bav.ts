import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  tishaBavJoinPayloadSchema,
  tishaBavRegistrationPayloadSchema,
  type TishaBavJoinPayload,
  type TishaBavJoinSuccessResponse,
  type TishaBavRegistrationPayload,
  type TishaBavRegistrationSuccessResponse,
} from '../../../contracts/src/index.ts';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { enqueueHighLevelEvent } from '../highlevel/producer.ts';
import { normalizeEmail, stableKey } from '../lead/normalize.ts';
import { evaluateEventServiceEmailEligibility } from './event-email-permission.ts';
import {
  TISHA_BAV_EVENT_START,
  TISHA_BAV_JOIN_PATH,
  TISHA_BAV_LANDING_PATH,
} from './tisha-bav-communications.ts';

export const TISHA_BAV_EVENT_CODE = 'tisha-bav-2026';
export const TISHA_BAV_EVENT_DEFINITION_KEY = 'event_tisha_bav_2026_rabbi_sheller_provider';
export const TISHA_BAV_EVENT_TITLE = "A Live Tisha B'Av Program with Rabbi Eli Scheller";
export { TISHA_BAV_EVENT_START, TISHA_BAV_JOIN_PATH, TISHA_BAV_LANDING_PATH };
export const TISHA_BAV_REDIRECT_PATH = '/api/v1/events/tisha-bav-2026/redirect';
export const TISHA_BAV_JOIN_OPEN_AT = new Date(
  new Date(TISHA_BAV_EVENT_START).getTime() - 45 * 60_000,
).toISOString();
export const TISHA_BAV_JOIN_CLOSE_AT = new Date(
  new Date(TISHA_BAV_EVENT_START).getTime() + 180 * 60_000,
).toISOString();
export const TISHA_BAV_SERVICE_CONSENT_POLICY = 'tisha-bav-2026-service-v1';
export const TISHA_BAV_EVENT_EMAIL_DISCLOSURE_VERSION = 'tisha-bav-2026-event-email-v1';
type RegistrationResult = TishaBavRegistrationSuccessResponse & {
  highLevelDeliveryKey: string | null;
};

type RegistrationRow = {
  registration_key: string;
  contact_key: string;
  email_normalized: string;
  first_name: string | null;
  newsletter_opt_in: boolean;
  identity_status: 'verified' | 'ambiguous' | 'invalid' | 'unverified';
};

type EventDefinitionRow = {
  event_definition_key: string;
  registration_open: boolean;
  join_open_at: string | Date;
  join_close_at: string | Date;
};

type EventEmailPermissionStatus =
  'granted' | 'withdrawn' | 'suppressed' | 'unsubscribed' | 'complained' | 'hard_bounced';

type EventEmailPermissionRow = {
  status: EventEmailPermissionStatus;
  deny_reason: string | null;
};

const EVENT_EMAIL_DENY_STATUSES = new Set<EventEmailPermissionStatus>([
  'withdrawn',
  'suppressed',
  'unsubscribed',
  'complained',
  'hard_bounced',
]);

export class TishaBavIdempotencyConflictError extends Error {
  constructor() {
    super('Event request key was already used for a different payload.');
  }
}

export class TishaBavJoinError extends Error {
  constructor(
    readonly status: number,
    readonly code:
      | 'REGISTRATION_NOT_FOUND'
      | 'EVENT_NOT_OPEN'
      | 'EVENT_ENDED'
      | 'EVENT_UNAVAILABLE'
      | 'SESSION_NOT_FOUND',
    readonly publicMessage: string,
  ) {
    super(publicMessage);
  }
}

export async function captureTishaBavRegistration(input: {
  pool: DbPool;
  config: AppConfig;
  payload: TishaBavRegistrationPayload;
  now?: Date;
}): Promise<TishaBavRegistrationSuccessResponse> {
  const parsed = tishaBavRegistrationPayloadSchema.parse(input.payload);
  if (parsed.homepage.trim()) return genericBotRegistrationResponse();

  const now = input.now ?? new Date();
  const response = await inTransaction(input.pool, async (client) =>
    persistRegistration(client, input.config, parsed, now),
  );
  return withoutInternalKeys(response);
}

export async function inspectTishaBavRegistrationDelivery(input: {
  pool: DbPool;
  config: AppConfig;
  registrationKey: string;
}) {
  const registration = await input.pool.query<{
    registration_key: string;
    contact_key: string | null;
    registration_status: string;
    identity_status: string;
  }>(
    `SELECT registration_key, contact_key, registration_status, identity_status
       FROM onetime.event_registrations
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
        AND registration_key = $4
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, TISHA_BAV_EVENT_CODE, input.registrationKey],
  );
  const row = registration.rows[0];
  if (!row?.contact_key) {
    return {
      status: 'missing' as const,
      would_enqueue: false,
      eligibility_reason: 'identity_missing' as const,
    };
  }
  const delivery = await input.pool.query<{
    delivery_key: string;
    status: string;
    transport_mode: string;
    transport_authorization_state: string;
  }>(
    `SELECT delivery_key, status, transport_mode, transport_authorization_state
       FROM onetime.outbox_events
      WHERE account_key = $1
        AND product_key = $2
        AND channel = 'highlevel'
        AND event_type = 'highlevel.event.registration.recorded.v1'
        AND contact_key = $3
        AND payload->'data'->>'registration_key' = $4
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, row.contact_key, input.registrationKey],
  );
  const eligibility = await evaluateEventServiceEmailEligibility(input.pool, input.config, {
    eventCode: TISHA_BAV_EVENT_CODE,
    registrationKey: input.registrationKey,
    contactKey: row.contact_key,
  });
  return {
    status: delivery.rows[0] ? ('recorded' as const) : ('missing' as const),
    would_enqueue: eligibility.allowed && !delivery.rows[0],
    eligibility_reason: eligibility.reason,
    delivery_state: delivery.rows[0]
      ? {
          status: delivery.rows[0].status,
          transport_mode: delivery.rows[0].transport_mode,
          authorization_state: delivery.rows[0].transport_authorization_state,
        }
      : null,
  };
}

export async function requestTishaBavJoin(input: {
  pool: DbPool;
  config: AppConfig;
  payload: TishaBavJoinPayload;
  now?: Date;
  ip?: string;
  userAgent?: string;
}): Promise<{ response: TishaBavJoinSuccessResponse; sessionToken: string }> {
  const parsed = tishaBavJoinPayloadSchema.parse(input.payload);
  if (parsed.homepage.trim()) {
    throw new TishaBavJoinError(
      404,
      'REGISTRATION_NOT_FOUND',
      'Use the email address you registered with.',
    );
  }
  const now = input.now ?? new Date();
  const email = normalizeEmail(parsed.email);
  return inTransaction(input.pool, async (client) => {
    const event = await loadEventDefinition(client, input.config);
    assertJoinWindow(event, now, input.config);
    const registration = await client.query<RegistrationRow>(
      `SELECT registration_key, email_normalized, first_name, newsletter_opt_in
         FROM onetime.event_registrations
        WHERE account_key = $1
          AND product_key = $2
          AND event_code = $3
          AND email_normalized = $4
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, TISHA_BAV_EVENT_CODE, email],
    );
    if (!registration.rowCount) {
      throw new TishaBavJoinError(
        404,
        'REGISTRATION_NOT_FOUND',
        'Use the email address you registered with.',
      );
    }
    const registrationRow = requireRow(registration.rows[0], 'Event registration lookup failed.');
    const registrationKey = String(registrationRow.registration_key);
    const sessionToken = randomToken();
    const sessionKey = `event_session_${randomUUID()}`;
    const expiresAt = new Date(
      Math.min(now.getTime() + 15 * 60_000, new Date(String(event.join_close_at)).getTime()),
    );
    await client.query(
      `INSERT INTO onetime.event_sessions
       (session_key, account_key, product_key, event_code, registration_key, token_hash,
        ip_hash, user_agent_hash, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        sessionKey,
        input.config.accountKey,
        input.config.productKey,
        TISHA_BAV_EVENT_CODE,
        registrationKey,
        sha256(sessionToken),
        input.ip ? sha256(input.ip) : null,
        input.userAgent ? sha256(input.userAgent) : null,
        expiresAt,
      ],
    );
    return {
      sessionToken,
      response: {
        success: true,
        event_code: TISHA_BAV_EVENT_CODE,
        redirect_path: TISHA_BAV_REDIRECT_PATH,
        expires_at: expiresAt.toISOString(),
      },
    };
  });
}

export async function resolveTishaBavRedirect(input: {
  pool: DbPool;
  config: AppConfig;
  sessionToken?: string;
  now?: Date;
}) {
  if (!input.sessionToken) {
    throw new TishaBavJoinError(404, 'SESSION_NOT_FOUND', 'This access session is not active.');
  }
  const now = input.now ?? new Date();
  const tokenHash = sha256(input.sessionToken);
  return inTransaction(input.pool, async (client) => {
    const event = await loadEventDefinition(client, input.config);
    assertJoinWindow(event, now, input.config);
    const session = await client.query<{ session_key: string }>(
      `SELECT session_key
         FROM onetime.event_sessions
        WHERE account_key = $1
          AND product_key = $2
          AND event_code = $3
          AND token_hash = $4
          AND state = 'active'
          AND expires_at > $5
        LIMIT 1`,
      [input.config.accountKey, input.config.productKey, TISHA_BAV_EVENT_CODE, tokenHash, now],
    );
    if (!session.rowCount) {
      throw new TishaBavJoinError(404, 'SESSION_NOT_FOUND', 'This access session is not active.');
    }
    const sessionRow = requireRow(session.rows[0], 'Event session lookup failed.');
    await client.query(
      'UPDATE onetime.event_sessions SET last_used_at = $1 WHERE session_key = $2',
      [now, sessionRow.session_key],
    );
    const joinUrl = input.config.tishaBavZoomJoinUrl;
    if (!joinUrl) {
      throw new TishaBavJoinError(503, 'EVENT_UNAVAILABLE', 'Private access is not available yet.');
    }
    return { joinUrl };
  });
}

export async function tishaBavEventState(input: { pool: DbPool; config: AppConfig; now?: Date }) {
  const event = await loadEventDefinition(input.pool, input.config);
  const now = input.now ?? new Date();
  if (!input.config.tishaBavZoomJoinUrl) return 'unavailable' as const;
  if (now < new Date(String(event.join_open_at))) return 'not-yet-open' as const;
  if (now > new Date(String(event.join_close_at))) return 'ended' as const;
  return 'open' as const;
}

async function persistRegistration(
  client: Queryable,
  config: AppConfig,
  payload: TishaBavRegistrationPayload,
  now: Date,
): Promise<RegistrationResult> {
  const email = normalizeEmail(payload.email);
  const idempotencyKey = eventIdempotencyKey(payload.idempotency_key);
  const reqHash = registrationRequestHash(payload, email);
  await client.query('SELECT pg_advisory_xact_lock($1)', [
    idempotencyLockKey(config, idempotencyKey),
  ]);
  const duplicate = await client.query<{ request_hash: string; response_json: RegistrationResult }>(
    `SELECT request_hash, response_json
       FROM onetime.idempotency_records
      WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3`,
    [config.accountKey, config.productKey, idempotencyKey],
  );
  if (duplicate.rowCount) {
    const row = requireRow(duplicate.rows[0], 'Event idempotency lookup failed.');
    if (row.request_hash !== reqHash) throw new TishaBavIdempotencyConflictError();
    return { ...row.response_json, duplicate_submission: true };
  }

  const event = await loadEventDefinition(client, config);
  if (!event.registration_open) {
    return {
      ...registrationMessage(null, false),
      confirmation_queued: false,
      ghl_sync_status: 'provider_off',
      highLevelDeliveryKey: null,
    };
  }

  const registrationKey = stableKey('event_registration', [
    config.accountKey,
    config.productKey,
    TISHA_BAV_EVENT_CODE,
    email,
  ]);
  const registeredAt = now.toISOString();
  const contact = await resolveEventAdultContact(client, config, {
    email,
    firstName: payload.first_name ?? null,
    source: normalizeSource(payload.source),
    now,
  });
  const identityStatus =
    contact.archived_at || contact.email_normalized !== email ? 'invalid' : 'verified';
  const registration = await client.query<RegistrationRow>(
    `INSERT INTO onetime.event_registrations (
       registration_key, event_definition_key, account_key, product_key, event_code,
       contact_key, registration_status, identity_status,
       email_normalized, first_name, newsletter_opt_in, event_service_consent_policy_version,
       marketing_consent_policy_version, marketing_consent_recorded_at, initial_source,
       latest_source, first_seen_at, last_seen_at, registered_at, last_registered_at, metadata
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,$12,
       CASE WHEN $10 THEN $13::timestamptz ELSE NULL::timestamptz END,
       $14,$14,$13::timestamptz,$13::timestamptz,$13::timestamptz,$13::timestamptz,$15::jsonb
     )
     ON CONFLICT (account_key, product_key, event_code, email_normalized)
     DO UPDATE SET
       contact_key = EXCLUDED.contact_key,
       registration_status = CASE
         WHEN onetime.event_registrations.registration_status = 'cancelled' THEN 'cancelled'
         ELSE EXCLUDED.registration_status
       END,
       identity_status = CASE
         WHEN onetime.event_registrations.identity_status IN ('ambiguous', 'invalid')
           THEN onetime.event_registrations.identity_status
         ELSE EXCLUDED.identity_status
       END,
       first_name = COALESCE(EXCLUDED.first_name, onetime.event_registrations.first_name),
       newsletter_opt_in = false,
       marketing_consent_policy_version = NULL,
       marketing_consent_recorded_at = NULL,
       latest_source = EXCLUDED.latest_source,
       last_seen_at = EXCLUDED.last_seen_at,
       last_registered_at = EXCLUDED.last_registered_at,
       metadata = EXCLUDED.metadata,
       updated_at = now()
     RETURNING registration_key, contact_key, email_normalized, first_name, newsletter_opt_in,
               identity_status`,
    [
      registrationKey,
      event.event_definition_key,
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      contact.contact_key,
      identityStatus,
      email,
      payload.first_name ?? null,
      false,
      TISHA_BAV_SERVICE_CONSENT_POLICY,
      null,
      registeredAt,
      normalizeSource(payload.source),
      JSON.stringify({
        source: normalizeSource(payload.source),
        event_service_consent: {
          policy_version: TISHA_BAV_SERVICE_CONSENT_POLICY,
          purpose: 'event_access_communication',
          source: normalizeSource(payload.source),
          channels: ['email'],
          captured_at: registeredAt,
        },
        marketing_consent: {
          policy_version: null,
          purpose: 'weekly_newsletter',
          source: normalizeSource(payload.source),
          channels: [],
          captured_at: null,
          granted: false,
        },
      }),
    ],
  );
  const row = requireRow(registration.rows[0], 'Event registration write failed.');
  await recordEventEmailPermission(client, config, row, payload, now);
  const highLevel = await enqueueHighLevelEvent(client, config, {
    eventName: 'event.registration.recorded',
    contactKey: row.contact_key,
    idempotencyKey: stableKey('event_registration_projection', [
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      row.registration_key,
    ]),
    actor: { kind: 'system', reference: 'tisha_bav_registration' },
    occurredAt: now,
    protectedPath: '/tisha-bav',
    data: {
      event_code: TISHA_BAV_EVENT_CODE,
      registration_key: row.registration_key,
      permission_scope: 'event_service_email',
    },
  });
  const highLevelDeliveryKey =
    highLevel.state === 'queued' || highLevel.state === 'duplicate' ? highLevel.deliveryKey : null;
  await insertAudit(client, config, row.registration_key, payload, now);

  const responseBase: RegistrationResult = {
    ...registrationMessage(row.registration_key, false),
    confirmation_queued: false,
    ghl_sync_status: 'provider_off',
    highLevelDeliveryKey,
  };
  await client.query(
    `INSERT INTO onetime.idempotency_records
     (account_key, product_key, idempotency_key, request_hash, response_json)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [config.accountKey, config.productKey, idempotencyKey, reqHash, JSON.stringify(responseBase)],
  );
  return responseBase;
}

async function resolveEventAdultContact(
  client: Queryable,
  config: AppConfig,
  input: { email: string; firstName: string | null; source: string; now: Date },
) {
  const contactKey = stableKey('event_adult_contact', [
    config.accountKey,
    config.productKey,
    input.email,
  ]);
  await client.query(
    `INSERT INTO onetime.contacts
       (contact_key, public_contact_id, account_key, product_key, display_name,
        family_school_classification,
        family_or_school, location_text, timezone, email_normalized, phone_normalized,
        reminder_preference, consent_policy_version, consent_recorded_at, suppression_state,
        source, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'family','Event registrant','Unknown','Asia/Jerusalem',$6,NULL,
             'none',NULL,NULL,'active',$7,$8,$8)
     ON CONFLICT (account_key, product_key, email_normalized) DO NOTHING`,
    [
      contactKey,
      randomUUID(),
      config.accountKey,
      config.productKey,
      input.firstName?.trim() || 'Event registrant',
      input.email,
      input.source,
      input.now,
    ],
  );
  const result = await client.query<{
    contact_key: string;
    email_normalized: string;
    archived_at: Date | string | null;
  }>(
    `SELECT contact_key, email_normalized, archived_at
       FROM onetime.contacts
      WHERE account_key = $1 AND product_key = $2 AND email_normalized = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, input.email],
  );
  return requireRow(result.rows[0], 'Event adult contact resolution failed.');
}

async function loadEventDefinition(
  client: Queryable,
  config: AppConfig,
): Promise<EventDefinitionRow> {
  const result = await client.query<EventDefinitionRow>(
    `SELECT event_definition_key, registration_open, join_open_at, join_close_at
       FROM onetime.event_definitions
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, TISHA_BAV_EVENT_CODE],
  );
  if (result.rowCount) return requireRow(result.rows[0], 'Tisha BAv event definition is missing.');
  throw new Error('Tisha BAv event definition is missing.');
}

function assertJoinWindow(event: EventDefinitionRow, now: Date, config: AppConfig) {
  if (now < new Date(String(event.join_open_at))) {
    throw new TishaBavJoinError(
      409,
      'EVENT_NOT_OPEN',
      'The private access window is not open yet.',
    );
  }
  if (now > new Date(String(event.join_close_at))) {
    throw new TishaBavJoinError(410, 'EVENT_ENDED', 'This live program has ended.');
  }
  if (!config.tishaBavZoomJoinUrl) {
    throw new TishaBavJoinError(503, 'EVENT_UNAVAILABLE', 'Private access is not available yet.');
  }
}

async function recordEventEmailPermission(
  client: Queryable,
  config: AppConfig,
  registration: RegistrationRow,
  payload: TishaBavRegistrationPayload,
  now: Date,
) {
  const existing = await client.query<EventEmailPermissionRow>(
    `SELECT status, deny_reason
       FROM onetime.event_email_permissions
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
        AND (
          contact_key = $4
          OR (contact_key IS NULL AND email_normalized = $5)
        )
      ORDER BY CASE WHEN contact_key = $4 THEN 0 ELSE 1 END, updated_at DESC
      LIMIT 1`,
    [
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      registration.contact_key,
      registration.email_normalized,
    ],
  );
  const contact = await client.query<{
    suppression_state: string;
    email_dnd: boolean | null;
    all_dnd: boolean | null;
  }>(
    `SELECT contacts.suppression_state, preferences.email_dnd, preferences.all_dnd
       FROM onetime.contacts AS contacts
       LEFT JOIN onetime.highlevel_contact_preferences AS preferences
         ON preferences.account_key = contacts.account_key
        AND preferences.product_key = contacts.product_key
        AND preferences.contact_key = contacts.contact_key
      WHERE contacts.account_key = $1
        AND contacts.product_key = $2
        AND contacts.contact_key = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, registration.contact_key],
  );
  const restrictions = await client.query<{ restriction_type: string }>(
    `SELECT restriction_type
       FROM onetime.contact_email_restrictions
      WHERE account_key = $1 AND product_key = $2 AND contact_key = $3 AND active = true`,
    [config.accountKey, config.productKey, registration.contact_key],
  );
  const activeRestrictions = new Set(restrictions.rows.map((row) => row.restriction_type));
  const current = existing.rows[0];
  const contactSuppressed =
    (contact.rowCount ?? 0) > 0 &&
    String(contact.rows[0]?.suppression_state ?? 'unknown') !== 'active';
  const contactDnd = Boolean(contact.rows[0]?.email_dnd || contact.rows[0]?.all_dnd);
  const globalDeniedStatus: EventEmailPermissionStatus | null = activeRestrictions.has('complaint')
    ? 'complained'
    : activeRestrictions.has('hard_bounce')
      ? 'hard_bounced'
      : activeRestrictions.has('global_suppression') ||
          activeRestrictions.has('global_dnd') ||
          contactDnd
        ? 'suppressed'
        : activeRestrictions.has('global_unsubscribe')
          ? 'unsubscribed'
          : null;
  const status: EventEmailPermissionStatus =
    current && EVENT_EMAIL_DENY_STATUSES.has(current.status)
      ? current.status
      : registration.identity_status !== 'verified'
        ? 'withdrawn'
        : globalDeniedStatus
          ? globalDeniedStatus
          : contactSuppressed
            ? 'suppressed'
            : 'granted';
  const reasonCode =
    current && EVENT_EMAIL_DENY_STATUSES.has(current.status)
      ? (current.deny_reason ?? `existing_${current.status}`)
      : registration.identity_status !== 'verified'
        ? `identity_${registration.identity_status}`
        : globalDeniedStatus
          ? `contact_${globalDeniedStatus}`
          : contactSuppressed
            ? 'contact_suppression_active'
            : null;
  const permissionEventKey = stableKey('event_email_permission_event', [
    config.accountKey,
    config.productKey,
    TISHA_BAV_EVENT_CODE,
    registration.registration_key,
    eventIdempotencyKey(payload.idempotency_key),
  ]);
  const permissionKey = stableKey('event_email_permission', [
    config.accountKey,
    config.productKey,
    TISHA_BAV_EVENT_CODE,
    registration.contact_key,
  ]);
  await client.query(
    `INSERT INTO onetime.event_email_permission_events (
       permission_event_key, account_key, product_key, event_code, registration_key,
       contact_key, email_normalized, permission_scope, action, disclosure_version, source,
       idempotency_key, reason_code, metadata, recorded_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'event_service_email',$8,$9,$10,$11,$12,$13::jsonb,$14)
     ON CONFLICT (account_key, product_key, event_code, idempotency_key) DO NOTHING`,
    [
      permissionEventKey,
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      registration.registration_key,
      registration.contact_key,
      registration.email_normalized,
      status,
      TISHA_BAV_EVENT_EMAIL_DISCLOSURE_VERSION,
      normalizeSource(payload.source),
      eventIdempotencyKey(payload.idempotency_key),
      reasonCode,
      JSON.stringify({
        channel: 'email',
        event_only: true,
        newsletter_permission_granted: false,
        student_contact: false,
      }),
      now,
    ],
  );
  await client.query(
    `INSERT INTO onetime.event_email_permissions (
       permission_key, account_key, product_key, event_code, registration_key,
       contact_key, email_normalized, permission_scope, status, disclosure_version, source,
       granted_at, denied_at, deny_reason, latest_permission_event_key
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,'event_service_email',$8,$9,$10,
       CASE WHEN $8 = 'granted' THEN $11::timestamptz ELSE NULL END,
       CASE WHEN $8 = 'granted' THEN NULL ELSE $11::timestamptz END,
       $12,$13
     )
     ON CONFLICT DO NOTHING`,
    [
      permissionKey,
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      registration.registration_key,
      registration.contact_key,
      registration.email_normalized,
      status,
      TISHA_BAV_EVENT_EMAIL_DISCLOSURE_VERSION,
      normalizeSource(payload.source),
      now,
      reasonCode,
      permissionEventKey,
    ],
  );
  await client.query(
    `UPDATE onetime.event_email_permissions
        SET registration_key = $5,
            email_normalized = $7,
            status = CASE
              WHEN status IN
                ('withdrawn','suppressed','unsubscribed','complained','hard_bounced')
                THEN status
              ELSE $8
            END,
            disclosure_version = $9,
            source = $10,
            granted_at = CASE
              WHEN status IN
                ('withdrawn','suppressed','unsubscribed','complained','hard_bounced')
                THEN granted_at
              ELSE COALESCE(
                granted_at,
                CASE WHEN $8 = 'granted' THEN $11::timestamptz ELSE NULL END
              )
            END,
            denied_at = COALESCE(
              denied_at,
              CASE WHEN $8 = 'granted' THEN NULL ELSE $11::timestamptz END
            ),
            deny_reason = COALESCE(deny_reason, $12),
            latest_permission_event_key = $13,
            updated_at = now()
      WHERE account_key = $2
        AND product_key = $3
        AND event_code = $4
        AND (contact_key = $6 OR permission_key = $1)`,
    [
      permissionKey,
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      registration.registration_key,
      registration.contact_key,
      registration.email_normalized,
      status,
      TISHA_BAV_EVENT_EMAIL_DISCLOSURE_VERSION,
      normalizeSource(payload.source),
      now,
      reasonCode,
      permissionEventKey,
    ],
  );
}

async function insertAudit(
  client: Queryable,
  config: AppConfig,
  registrationKey: string,
  payload: TishaBavRegistrationPayload,
  now: Date,
) {
  const eventKey = stableKey('audit', [
    registrationKey,
    'tisha_bav_registered',
    payload.idempotency_key,
  ]);
  await client.query(
    `INSERT INTO onetime.audit_events
     (event_key, account_key, product_key, signup_key, event_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (event_key) DO NOTHING`,
    [
      eventKey,
      config.accountKey,
      config.productKey,
      registrationKey,
      'tisha_bav_2026_event_registered',
      JSON.stringify({
        event_code: TISHA_BAV_EVENT_CODE,
        source: normalizeSource(payload.source),
        newsletter_opt_in: payload.newsletter_opt_in,
        student_data_allowed: false,
        payment_required: false,
        raw_zoom_url_present: false,
        captured_at: now.toISOString(),
      }),
    ],
  );
}

function registrationMessage(
  registrationKey: string | null,
  duplicate: boolean,
  confirmationQueued = false,
): TishaBavRegistrationSuccessResponse {
  return {
    success: true,
    duplicate_submission: duplicate,
    event_code: TISHA_BAV_EVENT_CODE,
    registration_key: registrationKey,
    confirmation_queued: confirmationQueued,
    ghl_sync_status: 'pending',
    message: {
      heading: 'Thank you — your spot has been reserved.',
      body: confirmationQueued
        ? "We'll send your Zoom link and event details by email."
        : 'Your spot is reserved, but event email delivery is not confirmed yet.',
      schedule: 'Thursday, July 23\n3:00 PM Eastern / 10:00 PM Israel',
    },
  };
}

function genericBotRegistrationResponse(): TishaBavRegistrationSuccessResponse {
  return {
    ...registrationMessage(null, false),
    confirmation_queued: false,
    ghl_sync_status: 'skipped',
  };
}

function withoutInternalKeys(response: RegistrationResult): TishaBavRegistrationSuccessResponse {
  return {
    success: response.success,
    duplicate_submission: response.duplicate_submission,
    event_code: response.event_code,
    registration_key: response.registration_key,
    confirmation_queued: response.confirmation_queued,
    ghl_sync_status: response.ghl_sync_status,
    message: response.message,
  };
}

function eventIdempotencyKey(idempotencyKey: string) {
  return `event:${TISHA_BAV_EVENT_CODE}:${idempotencyKey}`;
}

function registrationRequestHash(payload: TishaBavRegistrationPayload, email: string) {
  return sha256(
    canonicalJson({
      event_code: TISHA_BAV_EVENT_CODE,
      email,
      first_name: payload.first_name ?? null,
      newsletter_opt_in: payload.newsletter_opt_in,
      source: normalizeSource(payload.source),
    }),
  );
}

function idempotencyLockKey(config: AppConfig, idempotencyKey: string) {
  const raw = createHash('sha256')
    .update(`${config.accountKey}\0${config.productKey}\0${idempotencyKey}`)
    .digest('hex')
    .slice(0, 8);
  const value = Number.parseInt(raw, 16);
  return value > 0x7fffffff ? value - 0x100000000 : value;
}

function normalizeSource(source: string) {
  return source.trim().slice(0, 120) || 'tisha_bav_2026_landing';
}

function randomToken() {
  return randomBytes(32).toString('base64url');
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown) {
  return JSON.stringify(value, Object.keys(flattenKeys(value)).sort());
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);
  return row;
}

function flattenKeys(value: unknown, output: Record<string, true> = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value)) {
      output[key] = true;
      flattenKeys(nested, output);
    }
  }
  return output;
}
