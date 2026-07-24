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
       (contact_key, account_key, product_key, display_name, family_school_classification,
        family_or_school, location_text, timezone, email_normalized, phone_normalized,
        reminder_preference, consent_policy_version, consent_recorded_at, suppression_state,
        source, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'family','Event registrant','Unknown','Asia/Jerusalem',$5,NULL,
             'none',NULL,NULL,'active',$6,$7,$7)
     ON CONFLICT (account_key, product_key, email_normalized) DO NOTHING`,
    [
      contactKey,
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

/*
 * Historical direct-delivery implementation retired by GHL-006.
 *
 * Git history preserves the forensic implementation. Keeping this block outside the compiled
 * program ensures registration and inspection cannot reach a direct HighLevel or fallback path.
async function eventEmailPermissionEligibility(
  pool: Queryable,
  config: AppConfig,
  registrationKey: string,
) {
  const result = await pool.query<{
    status: EventEmailPermissionStatus;
    contact_suppression_state: string | null;
  }>(
    `SELECT permissions.status,
            contacts.suppression_state AS contact_suppression_state
       FROM onetime.event_email_permissions AS permissions
       LEFT JOIN onetime.contacts AS contacts
         ON contacts.account_key = permissions.account_key
        AND contacts.product_key = permissions.product_key
        AND contacts.email_normalized = permissions.email_normalized
      WHERE permissions.account_key = $1
        AND permissions.product_key = $2
        AND permissions.event_code = $3
        AND permissions.registration_key = $4
      LIMIT 1`,
    [config.accountKey, config.productKey, TISHA_BAV_EVENT_CODE, registrationKey],
  );
  const row = result.rows[0];
  if (!row) return { allowed: false, reason: 'event_permission_missing' } as const;
  if (EVENT_EMAIL_DENY_STATUSES.has(row.status)) {
    return { allowed: false, reason: `event_permission_${row.status}` } as const;
  }
  if (row.contact_suppression_state && row.contact_suppression_state !== 'active') {
    return { allowed: false, reason: 'contact_suppression_active' } as const;
  }
  return { allowed: true, reason: null } as const;
}

async function materializeLegacyEventEmailPermission(
  pool: DbPool,
  config: AppConfig,
  registrationKey: string,
) {
  await inTransaction(pool, async (client) => {
    const current = await client.query<{ permission_key: string }>(
      `SELECT permission_key
         FROM onetime.event_email_permissions
        WHERE account_key = $1
          AND product_key = $2
          AND event_code = $3
          AND registration_key = $4
        LIMIT 1`,
      [config.accountKey, config.productKey, TISHA_BAV_EVENT_CODE, registrationKey],
    );
    if (current.rows[0]) return;
    const registration = await client.query<{
      registration_key: string;
      email_normalized: string;
      event_service_consent_policy_version: string;
      latest_source: string;
      registered_at: Date | string;
      metadata: Record<string, unknown> | string;
    }>(
      `SELECT registration_key, email_normalized, event_service_consent_policy_version,
              latest_source, registered_at, metadata
         FROM onetime.event_registrations
        WHERE account_key = $1
          AND product_key = $2
          AND event_code = $3
          AND registration_key = $4
        LIMIT 1`,
      [config.accountKey, config.productKey, TISHA_BAV_EVENT_CODE, registrationKey],
    );
    const row = registration.rows[0];
    if (!row) return;
    const metadata = normalizeJsonRecord(row.metadata);
    const serviceConsent = normalizeJsonRecord(metadata.event_service_consent);
    const channels = Array.isArray(serviceConsent.channels)
      ? serviceConsent.channels.map(String)
      : [];
    const capturedAt =
      typeof serviceConsent.captured_at === 'string'
        ? new Date(serviceConsent.captured_at)
        : new Date(Number.NaN);
    const hasStoredProof =
      row.event_service_consent_policy_version === TISHA_BAV_SERVICE_CONSENT_POLICY &&
      serviceConsent.policy_version === TISHA_BAV_SERVICE_CONSENT_POLICY &&
      serviceConsent.purpose === 'event_access_communication' &&
      channels.includes('email') &&
      !Number.isNaN(capturedAt.getTime());
    if (!hasStoredProof) return;
    const contact = await client.query<{ suppression_state: string }>(
      `SELECT suppression_state
         FROM onetime.contacts
        WHERE account_key = $1
          AND product_key = $2
          AND email_normalized = $3
        LIMIT 1`,
      [config.accountKey, config.productKey, row.email_normalized],
    );
    const suppressed =
      (contact.rowCount ?? 0) > 0 &&
      String(contact.rows[0]?.suppression_state ?? 'unknown') !== 'active';
    const action: EventEmailPermissionStatus = suppressed ? 'suppressed' : 'granted';
    const permissionEventKey = stableKey('event_email_permission_event', [
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      registrationKey,
      'legacy_reprocess',
    ]);
    const permissionKey = stableKey('event_email_permission', [
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      row.email_normalized,
    ]);
    const idempotencyKey = `legacy_reprocess:${registrationKey}`;
    const disclosureVersion = `legacy:${row.event_service_consent_policy_version}`;
    const registeredAt = new Date(row.registered_at);
    if (Number.isNaN(registeredAt.getTime())) return;
    const recordedAt = capturedAt;
    await client.query(
      `INSERT INTO onetime.event_email_permission_events (
         permission_event_key, account_key, product_key, event_code, registration_key,
         email_normalized, permission_scope, action, disclosure_version, source,
         idempotency_key, reason_code, metadata, recorded_at
       ) VALUES ($1,$2,$3,$4,$5,$6,'event_service_email',$7,$8,$9,$10,$11,$12::jsonb,$13)
       ON CONFLICT (account_key, product_key, event_code, idempotency_key) DO NOTHING`,
      [
        permissionEventKey,
        config.accountKey,
        config.productKey,
        TISHA_BAV_EVENT_CODE,
        row.registration_key,
        row.email_normalized,
        action,
        disclosureVersion,
        normalizeSource(row.latest_source),
        idempotencyKey,
        suppressed ? 'contact_suppression_active' : 'legacy_registration_service_consent_proof',
        JSON.stringify({
          materialized_from_existing_registration: true,
          original_registered_at: registeredAt.toISOString(),
          original_consent_captured_at: capturedAt.toISOString(),
          event_only: true,
          newsletter_permission_granted: false,
          student_contact: false,
        }),
        recordedAt,
      ],
    );
    await client.query(
      `INSERT INTO onetime.event_email_permissions (
         permission_key, account_key, product_key, event_code, registration_key,
         email_normalized, permission_scope, status, disclosure_version, source,
         granted_at, denied_at, deny_reason, latest_permission_event_key
       ) VALUES (
         $1,$2,$3,$4,$5,$6,'event_service_email',$7,$8,$9,
         CASE WHEN $7 = 'granted' THEN $10::timestamptz ELSE NULL END,
         CASE WHEN $7 = 'granted' THEN NULL ELSE $10::timestamptz END,
         $11,$12
       )
       ON CONFLICT (account_key, product_key, event_code, email_normalized) DO NOTHING`,
      [
        permissionKey,
        config.accountKey,
        config.productKey,
        TISHA_BAV_EVENT_CODE,
        row.registration_key,
        row.email_normalized,
        action,
        disclosureVersion,
        normalizeSource(row.latest_source),
        recordedAt,
        suppressed ? 'contact_suppression_active' : null,
        permissionEventKey,
      ],
    );
  });
}

async function reserveHighLevelReprocess(
  pool: DbPool,
  config: AppConfig,
  highLevelDeliveryKey: string,
  registrationKey: string,
  now: Date,
) {
  return inTransaction(pool, async (client) => {
    const lockClause = isMemoryPool(pool) ? '' : 'FOR UPDATE';
    const fallback = await client.query<{
      delivery_key: string;
      status: string;
      lease_expires_at: Date | string | null;
    }>(
      `SELECT delivery_key, status, lease_expires_at
         FROM onetime.event_delivery_events
        WHERE account_key = $1
          AND product_key = $2
          AND event_code = $3
          AND registration_key = $4
          AND provider = 'resend_fallback'
        LIMIT 1
        ${lockClause}`,
      [config.accountKey, config.productKey, TISHA_BAV_EVENT_CODE, registrationKey],
    );
    const row = fallback.rows[0];
    if (row?.status === 'succeeded') return { allowed: false as const, leaseOwnerHash: null };
    const fallbackLeaseExpiresAt = row?.lease_expires_at ? new Date(row.lease_expires_at) : null;
    if (fallbackLeaseExpiresAt && fallbackLeaseExpiresAt > now) {
      return { allowed: false as const, leaseOwnerHash: null };
    }
    const leaseOwnerHash = sha256(`highlevel-reprocess:${registrationKey}:${randomUUID()}`);
    const leaseDurationMs = Math.max(
      120_000,
      config.deliveryProviderTimeoutMs + config.deliveryProviderTimeoutLeaseSafetyMs,
    );
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
    if (row && ['pending', 'failed'].includes(row.status)) {
      const fallbackUpdated = await client.query(
        `UPDATE onetime.event_delivery_events
          SET lease_owner_hash = $5,
              lease_expires_at = $6,
              updated_at = $4
        WHERE delivery_key = $1
          AND account_key = $2
          AND product_key = $3
          AND status IN ('pending','failed')
          AND (lease_expires_at IS NULL OR lease_expires_at <= $4)
        RETURNING delivery_key`,
        [
          row.delivery_key,
          config.accountKey,
          config.productKey,
          now,
          leaseOwnerHash,
          leaseExpiresAt,
        ],
      );
      if (!fallbackUpdated.rowCount) {
        return { allowed: false as const, leaseOwnerHash: null };
      }
    }
    const highLevelUpdated = await client.query(
      `UPDATE onetime.event_delivery_events
          SET lease_owner_hash = $5,
              lease_expires_at = $6,
              updated_at = $4
        WHERE delivery_key = $1
          AND account_key = $2
          AND product_key = $3
          AND provider = 'highlevel'
          AND status IN ('provider_off','failed','pending','skipped')
          AND (lease_expires_at IS NULL OR lease_expires_at <= $4)
        RETURNING delivery_key`,
      [
        highLevelDeliveryKey,
        config.accountKey,
        config.productKey,
        now,
        leaseOwnerHash,
        leaseExpiresAt,
      ],
    );
    if (highLevelUpdated.rowCount) return { allowed: true as const, leaseOwnerHash };
    if (row && ['pending', 'failed'].includes(row.status)) {
      await client.query(
        `UPDATE onetime.event_delivery_events
            SET lease_owner_hash = NULL,
                lease_expires_at = NULL,
                updated_at = $4
          WHERE delivery_key = $1
            AND account_key = $2
            AND product_key = $3
            AND lease_owner_hash = $5`,
        [row.delivery_key, config.accountKey, config.productKey, now, leaseOwnerHash],
      );
    }
    return { allowed: false as const, leaseOwnerHash: null };
  });
}

async function releaseReprocessReservation(
  pool: Queryable,
  config: AppConfig,
  registrationKey: string,
  leaseOwnerHash: string,
) {
  await pool.query(
    `UPDATE onetime.event_delivery_events
        SET lease_owner_hash = NULL,
            lease_expires_at = NULL,
            updated_at = now()
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
        AND registration_key = $4
        AND provider IN ('highlevel', 'resend_fallback')
        AND lease_owner_hash = $5`,
    [config.accountKey, config.productKey, TISHA_BAV_EVENT_CODE, registrationKey, leaseOwnerHash],
  );
}

async function upsertHighLevelDelivery(
  client: Queryable,
  config: AppConfig,
  registration: RegistrationRow,
  payload: TishaBavRegistrationPayload,
  now: Date,
) {
  const idempotencyKey = `highlevel:${TISHA_BAV_EVENT_CODE}:${registration.registration_key}`;
  const deliveryKey = stableKey('event_delivery', [idempotencyKey]);
  const protectedPayload = highLevelProtectedPayload(config, registration, payload);
  const status = config.highLevelEventSyncMode === 'disabled' ? 'provider_off' : 'pending';
  await client.query(
    `INSERT INTO onetime.event_delivery_events (
       delivery_key, account_key, product_key, event_code, registration_key, event_type, provider,
       transport_mode, status, idempotency_key, payload_digest, protected_payload, public_metadata,
       next_attempt_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,'highlevel',$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13)
     ON CONFLICT (account_key, product_key, event_code, idempotency_key)
     DO UPDATE SET
       protected_payload = EXCLUDED.protected_payload,
       public_metadata = EXCLUDED.public_metadata,
       payload_digest = EXCLUDED.payload_digest,
       status = CASE
         WHEN onetime.event_delivery_events.status = 'succeeded' THEN 'succeeded'
         ELSE EXCLUDED.status
       END,
       updated_at = now()
     RETURNING delivery_key`,
    [
      deliveryKey,
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      registration.registration_key,
      'tisha_bav_2026.highlevel_registration_sync.v1',
      config.highLevelEventSyncMode,
      status,
      idempotencyKey,
      sha256(canonicalJson(protectedPayload)),
      JSON.stringify(protectedPayload),
      JSON.stringify({
        tag_count: protectedPayload.tags.length,
        newsletter_tag_requested: registration.newsletter_opt_in,
        workflow_configured: Boolean(config.highLevelTishaBavWorkflowId),
        communication_catalog_version: TISHA_BAV_COMMUNICATION_CATALOG_VERSION,
        source_custom_field_value: TISHA_BAV_SOURCE_VALUE,
        raw_zoom_url_present: false,
      }),
      now,
    ],
  );
  return deliveryKey;
}

async function queueFallbackAfterHighLevelFailure(input: {
  pool: DbPool;
  config: AppConfig;
  registrationKey: string;
  highLevelDeliveryKey: string;
  now: Date;
}) {
  if (input.config.oneTimeEventEmailFallback !== 'resend') return false;
  if (input.now > new Date('2026-07-24T23:59:59.000Z')) return false;
  const highLevel = await input.pool.query<{ status: string }>(
    `SELECT status
       FROM onetime.event_delivery_events
      WHERE delivery_key = $1
        AND registration_key = $2
        AND provider = 'highlevel'
      LIMIT 1`,
    [input.highLevelDeliveryKey, input.registrationKey],
  );
  if (highLevel.rows[0]?.status === 'succeeded') return false;
  const eligibility = await eventEmailPermissionEligibility(
    input.pool,
    input.config,
    input.registrationKey,
  );
  if (!eligibility.allowed) return false;
  const registrationResult = await input.pool.query<RegistrationRow & { latest_source: string }>(
    `SELECT registration_key, email_normalized, first_name, newsletter_opt_in, latest_source
       FROM onetime.event_registrations
      WHERE registration_key = $1
        AND account_key = $2
        AND product_key = $3
        AND event_code = $4
      LIMIT 1`,
    [input.registrationKey, input.config.accountKey, input.config.productKey, TISHA_BAV_EVENT_CODE],
  );
  const registration = registrationResult.rows[0];
  if (!registration) return false;
  const idempotencyKey = `resend_fallback:${TISHA_BAV_EVENT_CODE}:${registration.registration_key}`;
  const protectedPayload = {
    email_normalized: registration.email_normalized,
    first_name: registration.first_name,
    communication_catalog_version: TISHA_BAV_COMMUNICATION_CATALOG_VERSION,
    template: TISHA_BAV_EMAIL_CATALOG.registration_confirmation.templateId,
    subject: TISHA_BAV_EMAIL_CATALOG.registration_confirmation.subject,
    body: TISHA_BAV_EMAIL_CATALOG.registration_confirmation.body,
    cta: TISHA_BAV_EMAIL_CATALOG.registration_confirmation.cta,
    reply_to: TISHA_BAV_EMAIL_SENDER.replyTo,
    sender: TISHA_BAV_EMAIL_SENDER.visibleName,
    from: TISHA_BAV_EMAIL_SENDER.from,
    source: normalizeSource(registration.latest_source),
    expires_after: '2026-07-24T23:59:59.000Z',
  };
  const inserted = await input.pool.query(
    `INSERT INTO onetime.event_delivery_events (
       delivery_key, account_key, product_key, event_code, registration_key, event_type, provider,
       transport_mode, status, idempotency_key, payload_digest, protected_payload, public_metadata,
       next_attempt_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,'resend_fallback','resend','pending',$7,$8,$9::jsonb,$10::jsonb,$11)
     ON CONFLICT (account_key, product_key, event_code, idempotency_key) DO NOTHING`,
    [
      stableKey('event_delivery', [idempotencyKey]),
      input.config.accountKey,
      input.config.productKey,
      TISHA_BAV_EVENT_CODE,
      registration.registration_key,
      'tisha_bav_2026.resend_fallback_confirmation.v1',
      idempotencyKey,
      sha256(canonicalJson(protectedPayload)),
      JSON.stringify(protectedPayload),
      JSON.stringify({
        bounded: true,
        confirmation_only: true,
        warm_list_invitation: false,
        expires_after: '2026-07-24T23:59:59.000Z',
      }),
      input.now,
    ],
  );
  if (inserted.rowCount) return true;
  const existing = await input.pool.query<{ status: string }>(
    `SELECT status
       FROM onetime.event_delivery_events
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
        AND idempotency_key = $4
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, TISHA_BAV_EVENT_CODE, idempotencyKey],
  );
  return ['pending', 'succeeded'].includes(existing.rows[0]?.status ?? '');
}

*/

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

/*
 * Historical direct-provider and fallback synchronization implementation retired by GHL-006.
 * The only compiled outbound path is the canonical held HighLevel outbox dispatcher.
async function maybeSyncHighLevel(input: {
  pool: DbPool;
  config: AppConfig;
  deliveryKey: string;
  registrationKey: string;
  highLevelClient?: HighLevelEventClient | null;
  allowPendingFallbackRetry?: boolean;
  now?: Date;
  reprocessLeaseOwnerHash?: string | null;
}): Promise<HighLevelSyncAttemptStatus> {
  const eligibility = await eventEmailPermissionEligibility(
    input.pool,
    input.config,
    input.registrationKey,
  );
  if (!eligibility.allowed) {
    await markHighLevelDelivery(
      input.pool,
      input.deliveryKey,
      'skipped',
      {
        workflow_configured: Boolean(input.config.highLevelTishaBavWorkflowId),
        blocked_reason: eligibility.reason,
      },
      input.reprocessLeaseOwnerHash,
    );
    return 'skipped';
  }
  if (input.config.highLevelEventSyncMode === 'disabled') return 'provider_off';
  const fallback = await input.pool.query<{
    status: string;
    lease_expires_at: Date | string | null;
    lease_owner_hash: string | null;
  }>(
    `SELECT status, lease_expires_at, lease_owner_hash
       FROM onetime.event_delivery_events
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
        AND registration_key = $4
        AND provider = 'resend_fallback'
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, TISHA_BAV_EVENT_CODE, input.registrationKey],
  );
  const fallbackStatus = fallback.rows[0]?.status ?? '';
  const fallbackLease = fallback.rows[0]?.lease_expires_at
    ? new Date(fallback.rows[0].lease_expires_at)
    : null;
  const fallbackLeaseOwnedByRetry = Boolean(
    input.reprocessLeaseOwnerHash &&
    fallback.rows[0]?.lease_owner_hash === input.reprocessLeaseOwnerHash,
  );
  if (
    fallbackStatus === 'succeeded' ||
    (fallbackLease && fallbackLease > (input.now ?? new Date()) && !fallbackLeaseOwnedByRetry) ||
    (!input.allowPendingFallbackRetry && ['pending', 'failed'].includes(fallbackStatus))
  ) {
    return 'skipped';
  }
  const client = input.highLevelClient ?? createHighLevelEventClient(input.config);
  if (!client) return 'provider_off';
  const rows = await input.pool.query<{
    status: string;
    lease_owner_hash: string | null;
    protected_payload: {
      location_id: string;
      email_normalized: string;
      first_name: string | null;
      tags: string[];
      custom_fields: Record<string, string>;
      workflow_id: string | null;
      workflow_request_key: string;
    };
  }>(
    `SELECT status, lease_owner_hash, protected_payload
       FROM onetime.event_delivery_events
      WHERE delivery_key = $1
        AND registration_key = $2
      LIMIT 1`,
    [input.deliveryKey, input.registrationKey],
  );
  if (
    input.reprocessLeaseOwnerHash &&
    rows.rows[0]?.lease_owner_hash !== input.reprocessLeaseOwnerHash
  ) {
    return 'skipped';
  }
  if (rows.rows[0]?.status === 'succeeded') return 'succeeded';
  const payload = normalizeHighLevelPayload(rows.rows[0]?.protected_payload);
  if (!payload) return null;
  const workflowId = payload.workflow_id ?? input.config.highLevelTishaBavWorkflowId;
  if (!workflowId) {
    await markHighLevelDelivery(
      input.pool,
      input.deliveryKey,
      'provider_off',
      {
        workflow_configured: false,
      },
      input.reprocessLeaseOwnerHash,
    );
    return 'provider_off';
  }
  const leaseOwnerHash =
    input.reprocessLeaseOwnerHash ??
    (await claimHighLevelDeliveryForSync(
      input.pool,
      input.config,
      input.deliveryKey,
      input.registrationKey,
      input.now ?? new Date(),
    ));
  if (!leaseOwnerHash) return 'in_flight';
  let providerStage = 'ensure_tags';
  try {
    await client.ensureTags({
      locationId: payload.location_id,
      tags: payload.tags,
    });
    providerStage = 'upsert_contact';
    const contact = await client.upsertContact({
      locationId: payload.location_id,
      email: payload.email_normalized,
      source: TISHA_BAV_SOURCE_VALUE,
      customFields: payload.custom_fields,
      ...(payload.first_name ? { firstName: payload.first_name } : {}),
    });
    providerStage = 'add_tags';
    await client.addTags({
      locationId: payload.location_id,
      contactId: contact.contactId,
      tags: payload.tags,
    });
    providerStage = 'add_to_workflow';
    await client.addToWorkflow({
      contactId: contact.contactId,
      workflowId,
      idempotencyKey: payload.workflow_request_key,
    });
    await markHighLevelDelivery(
      input.pool,
      input.deliveryKey,
      'succeeded',
      {
        workflow_configured: true,
        contact_reference_hash: sha256(contact.contactId),
        tags_verified: true,
      },
      leaseOwnerHash,
    );
    await cancelUnsentFallback(
      input.pool,
      input.config,
      input.registrationKey,
      leaseOwnerHash,
      input.now ?? new Date(),
    );
    return 'succeeded';
  } catch (error) {
    await markHighLevelDelivery(
      input.pool,
      input.deliveryKey,
      'failed',
      {
        error_class: error instanceof Error ? error.name : 'Error',
        failed_stage: providerStage,
        provider_http_status: highLevelErrorStatus(error),
      },
      leaseOwnerHash,
    );
    return 'pending';
  } finally {
    await releaseHighLevelSyncReservation(
      input.pool,
      input.config,
      input.registrationKey,
      leaseOwnerHash,
    );
  }
}

async function claimHighLevelDeliveryForSync(
  pool: Queryable,
  config: AppConfig,
  deliveryKey: string,
  registrationKey: string,
  now: Date,
) {
  const leaseOwnerHash = sha256(`highlevel-sync:${registrationKey}:${randomUUID()}`);
  const leaseDurationMs = Math.max(
    120_000,
    config.deliveryProviderTimeoutMs + config.deliveryProviderTimeoutLeaseSafetyMs,
  );
  const claimed = await pool.query(
    `UPDATE onetime.event_delivery_events
        SET lease_owner_hash = $5,
            lease_expires_at = $6,
            updated_at = $4
      WHERE delivery_key = $1
        AND account_key = $2
        AND product_key = $3
        AND registration_key = $7
        AND provider = 'highlevel'
        AND status IN ('provider_off','failed','pending','skipped')
        AND (lease_expires_at IS NULL OR lease_expires_at <= $4)
      RETURNING delivery_key`,
    [
      deliveryKey,
      config.accountKey,
      config.productKey,
      now,
      leaseOwnerHash,
      new Date(now.getTime() + leaseDurationMs),
      registrationKey,
    ],
  );
  return claimed.rowCount ? leaseOwnerHash : null;
}

async function releaseHighLevelSyncReservation(
  pool: Queryable,
  config: AppConfig,
  registrationKey: string,
  leaseOwnerHash: string,
) {
  await pool.query(
    `UPDATE onetime.event_delivery_events
        SET lease_owner_hash = NULL,
            lease_expires_at = NULL,
            updated_at = now()
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
        AND registration_key = $4
        AND provider = 'highlevel'
        AND lease_owner_hash = $5`,
    [config.accountKey, config.productKey, TISHA_BAV_EVENT_CODE, registrationKey, leaseOwnerHash],
  );
}

async function markHighLevelDelivery(
  pool: DbPool,
  deliveryKey: string,
  status: 'succeeded' | 'failed' | 'provider_off' | 'skipped',
  metadata: Record<string, unknown>,
  leaseOwnerHash?: string | null,
) {
  const current = await pool.query<{ public_metadata: Record<string, unknown> }>(
    `SELECT public_metadata
       FROM onetime.event_delivery_events
      WHERE delivery_key = $1
      LIMIT 1`,
    [deliveryKey],
  );
  const publicMetadata = {
    ...normalizeJsonRecord(current.rows[0]?.public_metadata),
    ...metadata,
  };
  const baseSql = `UPDATE onetime.event_delivery_events
        SET status = $2,
            attempts = attempts + 1,
            completed_at = CASE WHEN $2 = 'succeeded' THEN now() ELSE completed_at END,
            public_metadata = $3::jsonb,
            lease_owner_hash = NULL,
            lease_expires_at = NULL,
            updated_at = now()
      WHERE delivery_key = $1`;
  if (leaseOwnerHash) {
    await pool.query(`${baseSql} AND lease_owner_hash = $4`, [
      deliveryKey,
      status,
      JSON.stringify(publicMetadata),
      leaseOwnerHash,
    ]);
    return;
  }
  await pool.query(baseSql, [deliveryKey, status, JSON.stringify(publicMetadata)]);
}

async function cancelUnsentFallback(
  pool: Queryable,
  config: AppConfig,
  registrationKey: string,
  leaseOwnerHash: string | null | undefined,
  now: Date,
) {
  if (leaseOwnerHash) {
    await pool.query(
      `UPDATE onetime.event_delivery_events
          SET status = 'skipped',
              public_metadata = '{"blocked_reason":"highlevel_succeeded"}'::jsonb,
              lease_owner_hash = NULL,
              lease_expires_at = NULL,
              updated_at = $6
        WHERE account_key = $1
          AND product_key = $2
          AND event_code = $3
          AND registration_key = $4
          AND provider = 'resend_fallback'
          AND status IN ('pending', 'failed')
          AND lease_owner_hash = $5`,
      [
        config.accountKey,
        config.productKey,
        TISHA_BAV_EVENT_CODE,
        registrationKey,
        leaseOwnerHash,
        now,
      ],
    );
    return;
  }
  await pool.query(
    `UPDATE onetime.event_delivery_events
        SET status = 'skipped',
            public_metadata = '{"blocked_reason":"highlevel_succeeded"}'::jsonb,
            lease_owner_hash = NULL,
            lease_expires_at = NULL,
            updated_at = $5
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
        AND registration_key = $4
        AND provider = 'resend_fallback'
        AND status IN ('pending', 'failed')
        AND (lease_expires_at IS NULL OR lease_expires_at <= $5)`,
    [config.accountKey, config.productKey, TISHA_BAV_EVENT_CODE, registrationKey, now],
  );
}

function highLevelProtectedPayload(
  config: AppConfig,
  registration: RegistrationRow,
  payload: TishaBavRegistrationPayload,
) {
  const tags = ["OT | Event | Tisha B'Av 2026 | Registered", "OT | Source | Tisha B'Av 2026"];
  return {
    location_id: config.highLevelLocationId,
    email_normalized: registration.email_normalized,
    first_name: registration.first_name,
    source: normalizeSource(payload.source),
    signup_source: TISHA_BAV_SOURCE_VALUE,
    tags,
    custom_fields: {
      'contact.one_time_signup_source': TISHA_BAV_SOURCE_VALUE,
    },
    communication_catalog_version: TISHA_BAV_COMMUNICATION_CATALOG_VERSION,
    workflow_id: config.highLevelTishaBavWorkflowId ?? null,
    workflow_schedule: TISHA_BAV_WORKFLOW_SCHEDULE,
    workflow_request_key: stableKey('ghl_workflow_request', [
      TISHA_BAV_EVENT_CODE,
      registration.registration_key,
    ]),
    preserve_unrelated_tags: true,
    student_contact: false,
  };
}

function highLevelErrorStatus(error: unknown) {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/status (\d{3})\b/);
  return match ? Number(match[1]) : null;
}

function normalizeHighLevelPayload(value: unknown) {
  const parsed =
    typeof value === 'string'
      ? (JSON.parse(value) as Record<string, unknown>)
      : value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : null;
  if (!parsed) return null;
  return {
    location_id: String(parsed.location_id ?? ''),
    email_normalized: String(parsed.email_normalized ?? ''),
    first_name: typeof parsed.first_name === 'string' ? parsed.first_name : null,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    custom_fields:
      parsed.custom_fields && typeof parsed.custom_fields === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.custom_fields as Record<string, unknown>).map(([key, value]) => [
              key,
              String(value),
            ]),
          )
        : {},
    workflow_id: typeof parsed.workflow_id === 'string' ? parsed.workflow_id : null,
    workflow_request_key: String(parsed.workflow_request_key ?? ''),
  };
}

function normalizeJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

*/

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
