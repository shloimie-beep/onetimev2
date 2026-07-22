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
import { COMMUNICATION_CONSENT_POLICY_VERSION } from '../legal/policies.ts';
import { normalizeEmail, stableKey } from '../lead/normalize.ts';
import {
  TISHA_BAV_COMMUNICATION_CATALOG_VERSION,
  TISHA_BAV_EMAIL_CATALOG,
  TISHA_BAV_EMAIL_SENDER,
  TISHA_BAV_EVENT_START,
  TISHA_BAV_JOIN_PATH,
  TISHA_BAV_LANDING_PATH,
  TISHA_BAV_WORKFLOW_SCHEDULE,
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
export const TISHA_BAV_SOURCE_VALUE = "Tisha B'Av 2026 Landing";
export const TISHA_BAV_REQUIRED_TAGS = [
  "OT | Event | Tisha B'Av 2026 | Invited",
  "OT | Event | Tisha B'Av 2026 | Registered",
  "OT | Event | Tisha B'Av 2026 | Attended",
  "OT | Event | Tisha B'Av 2026 | No Show",
  "OT | Event | Tisha B'Av 2026 | Replay Sent",
  "OT | Source | Tisha B'Av 2026",
] as const;
export const TISHA_BAV_NEWSLETTER_TAG = 'OT | Weekly Newsletter';

type RegistrationResult = TishaBavRegistrationSuccessResponse & {
  highLevelDeliveryKey: string | null;
};

type RegistrationRow = {
  registration_key: string;
  email_normalized: string;
  first_name: string | null;
  newsletter_opt_in: boolean;
};

type EventDefinitionRow = {
  event_definition_key: string;
  registration_open: boolean;
  join_open_at: string | Date;
  join_close_at: string | Date;
};

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

export type HighLevelEventClient = {
  ensureTags(input: { locationId: string; tags: readonly string[] }): Promise<void>;
  upsertContact(input: {
    locationId: string;
    email: string;
    firstName?: string;
    source: string;
    customFields: Record<string, string>;
  }): Promise<{ contactId: string }>;
  addTags(input: { locationId: string; contactId: string; tags: readonly string[] }): Promise<void>;
  addToWorkflow(input: {
    contactId: string;
    workflowId: string;
    idempotencyKey: string;
  }): Promise<void>;
};

export class MockHighLevelEventClient implements HighLevelEventClient {
  readonly tags = new Set<string>();
  readonly contacts = new Map<string, { contactId: string; tags: string[] }>();
  readonly workflowRequests: string[] = [];

  async ensureTags(input: { locationId: string; tags: readonly string[] }) {
    void input.locationId;
    input.tags.forEach((tag) => this.tags.add(tag));
  }

  async upsertContact(input: {
    locationId: string;
    email: string;
    firstName?: string;
    source: string;
    customFields: Record<string, string>;
  }) {
    void input.locationId;
    void input.firstName;
    void input.source;
    void input.customFields;
    const key = normalizeEmail(input.email);
    const existing = this.contacts.get(key);
    if (existing) return { contactId: existing.contactId };
    const contactId = `mock_hl_${stableKey('contact', [key])}`;
    this.contacts.set(key, { contactId, tags: [] });
    return { contactId };
  }

  async addTags(input: { contactId: string; tags: readonly string[] }) {
    for (const contact of this.contacts.values()) {
      if (contact.contactId !== input.contactId) continue;
      contact.tags = [...new Set([...contact.tags, ...input.tags])];
      return;
    }
  }

  async addToWorkflow(input: { contactId: string; workflowId: string; idempotencyKey: string }) {
    this.workflowRequests.push(
      `${input.contactId}:${input.workflowId}:${stableKey('workflow', [input.idempotencyKey])}`,
    );
  }
}

export class HttpHighLevelEventClient implements HighLevelEventClient {
  constructor(
    private readonly options: {
      baseUrl: string;
      token: string;
      apiVersion: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async ensureTags(input: { locationId: string; tags: readonly string[] }) {
    const response = await this.request(`/locations/${encodeURIComponent(input.locationId)}/tags`, {
      method: 'GET',
    });
    const existingTags = new Set(
      (Array.isArray(response.tags) ? response.tags : [])
        .map((tag) =>
          tag && typeof tag === 'object' && 'name' in tag
            ? String((tag as { name?: unknown }).name ?? '')
                .trim()
                .toLocaleLowerCase()
            : '',
        )
        .filter(Boolean),
    );
    for (const tag of input.tags) {
      if (existingTags.has(tag.trim().toLocaleLowerCase())) continue;
      await this.request(`/locations/${encodeURIComponent(input.locationId)}/tags`, {
        method: 'POST',
        body: { name: tag },
        allowConflict: true,
      });
    }
  }

  async upsertContact(input: {
    locationId: string;
    email: string;
    firstName?: string;
    source: string;
    customFields: Record<string, string>;
  }) {
    const response = await this.request('/contacts/upsert', {
      method: 'POST',
      body: {
        locationId: input.locationId,
        email: input.email,
        source: input.source,
        ...(input.firstName ? { firstName: input.firstName } : {}),
        customFields: Object.entries(input.customFields).map(([key, fieldValue]) => ({
          key,
          fieldValue,
        })),
      },
    });
    const contact = (response.contact ?? response) as Record<string, unknown>;
    const contactId = String(contact.id ?? contact.contactId ?? '');
    if (!contactId)
      throw new Error('HighLevel contact upsert response did not include a contact id.');
    return { contactId };
  }

  async addTags(input: { locationId: string; contactId: string; tags: readonly string[] }) {
    void input.locationId;
    const response = await this.request(`/contacts/${encodeURIComponent(input.contactId)}/tags`, {
      method: 'POST',
      body: { tags: input.tags },
      apiVersion: '2023-02-21',
    });
    const currentTags = new Set(Array.isArray(response.tags) ? response.tags.map(String) : []);
    if (input.tags.some((tag) => !currentTags.has(tag))) {
      throw new Error('HighLevel contact tag verification failed.');
    }
  }

  async addToWorkflow(input: { contactId: string; workflowId: string; idempotencyKey: string }) {
    void input.idempotencyKey;
    await this.request(
      `/contacts/${encodeURIComponent(input.contactId)}/workflow/${encodeURIComponent(
        input.workflowId,
      )}`,
      {
        method: 'POST',
        body: {},
        allowConflict: true,
      },
    );
  }

  private async request(
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
      allowConflict?: boolean;
      apiVersion?: string;
    },
  ): Promise<Record<string, unknown>> {
    const base = this.options.baseUrl.replace(/\/$/, '');
    const response = await (this.options.fetchImpl ?? fetch)(`${base}${path}`, {
      method: options.method,
      headers: {
        authorization: `Bearer ${this.options.token}`,
        version: options.apiVersion ?? this.options.apiVersion,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    if (options.allowConflict && (response.status === 409 || response.status === 422)) return {};
    if (!response.ok) {
      throw new Error(`HighLevel API request failed with status ${response.status}.`);
    }
    return ((await response.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  }
}

export function createHighLevelEventClient(config: AppConfig): HighLevelEventClient | null {
  if (config.highLevelEventSyncMode === 'disabled') return null;
  if (config.highLevelEventSyncMode === 'mock') return new MockHighLevelEventClient();
  return new HttpHighLevelEventClient({
    baseUrl: config.highLevelApiBaseUrl,
    token: config.highLevelPrivateIntegrationsToken ?? '',
    apiVersion: config.highLevelApiVersion,
  });
}

export async function captureTishaBavRegistration(input: {
  pool: DbPool;
  config: AppConfig;
  payload: TishaBavRegistrationPayload;
  now?: Date;
  highLevelClient?: HighLevelEventClient | null;
}): Promise<TishaBavRegistrationSuccessResponse> {
  const parsed = tishaBavRegistrationPayloadSchema.parse(input.payload);
  if (parsed.homepage.trim()) return genericBotRegistrationResponse();

  const now = input.now ?? new Date();
  const response = await inTransaction(input.pool, async (client) =>
    persistRegistration(client, input.config, parsed, now),
  );

  if (!response.highLevelDeliveryKey) return withoutInternalKeys(response);
  const syncStatus = await maybeSyncHighLevel({
    pool: input.pool,
    config: input.config,
    deliveryKey: response.highLevelDeliveryKey,
    registrationKey: response.registration_key ?? '',
    ...(input.highLevelClient === undefined ? {} : { highLevelClient: input.highLevelClient }),
  });

  return {
    ...withoutInternalKeys(response),
    ghl_sync_status: syncStatus ?? response.ghl_sync_status,
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
  const marketingPolicy = payload.newsletter_opt_in ? COMMUNICATION_CONSENT_POLICY_VERSION : null;
  const registration = await client.query<RegistrationRow>(
    `INSERT INTO onetime.event_registrations (
       registration_key, event_definition_key, account_key, product_key, event_code,
       email_normalized, first_name, newsletter_opt_in, event_service_consent_policy_version,
       marketing_consent_policy_version, marketing_consent_recorded_at, initial_source,
       latest_source, first_seen_at, last_seen_at, registered_at, last_registered_at, metadata
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
       CASE WHEN $8 THEN $11::timestamptz ELSE NULL::timestamptz END,
       $12,$12,$11::timestamptz,$11::timestamptz,$11::timestamptz,$11::timestamptz,$13::jsonb
     )
     ON CONFLICT (account_key, product_key, event_code, email_normalized)
     DO UPDATE SET
       first_name = COALESCE(EXCLUDED.first_name, onetime.event_registrations.first_name),
       newsletter_opt_in = onetime.event_registrations.newsletter_opt_in OR EXCLUDED.newsletter_opt_in,
       marketing_consent_policy_version = CASE
         WHEN EXCLUDED.newsletter_opt_in THEN EXCLUDED.marketing_consent_policy_version
         ELSE onetime.event_registrations.marketing_consent_policy_version
       END,
       marketing_consent_recorded_at = CASE
         WHEN EXCLUDED.newsletter_opt_in AND onetime.event_registrations.marketing_consent_recorded_at IS NULL
           THEN EXCLUDED.marketing_consent_recorded_at
         ELSE onetime.event_registrations.marketing_consent_recorded_at
       END,
       latest_source = EXCLUDED.latest_source,
       last_seen_at = EXCLUDED.last_seen_at,
       last_registered_at = EXCLUDED.last_registered_at,
       metadata = onetime.event_registrations.metadata || EXCLUDED.metadata,
       updated_at = now()
     RETURNING registration_key, email_normalized, first_name, newsletter_opt_in`,
    [
      registrationKey,
      event.event_definition_key,
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      email,
      payload.first_name ?? null,
      payload.newsletter_opt_in,
      TISHA_BAV_SERVICE_CONSENT_POLICY,
      marketingPolicy,
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
          policy_version: marketingPolicy,
          purpose: 'weekly_newsletter',
          source: normalizeSource(payload.source),
          channels: payload.newsletter_opt_in ? ['email'] : [],
          captured_at: payload.newsletter_opt_in ? registeredAt : null,
          granted: payload.newsletter_opt_in,
        },
      }),
    ],
  );
  const row = requireRow(registration.rows[0], 'Event registration write failed.');
  const highLevelDeliveryKey = await upsertHighLevelDelivery(client, config, row, payload, now);
  if (
    config.oneTimeEventEmailFallback === 'resend' &&
    now <= new Date('2026-07-24T23:59:59.000Z')
  ) {
    await upsertFallbackDelivery(client, config, row, payload, now);
  }
  await insertAudit(client, config, row.registration_key, payload, now);

  const responseBase: RegistrationResult = {
    ...registrationMessage(row.registration_key, false),
    confirmation_queued: true,
    ghl_sync_status: config.highLevelEventSyncMode === 'disabled' ? 'provider_off' : 'pending',
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

async function upsertFallbackDelivery(
  client: Queryable,
  config: AppConfig,
  registration: RegistrationRow,
  payload: TishaBavRegistrationPayload,
  now: Date,
) {
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
    source: normalizeSource(payload.source),
    expires_after: '2026-07-24T23:59:59.000Z',
  };
  await client.query(
    `INSERT INTO onetime.event_delivery_events (
       delivery_key, account_key, product_key, event_code, registration_key, event_type, provider,
       transport_mode, status, idempotency_key, payload_digest, protected_payload, public_metadata,
       next_attempt_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,'resend_fallback','resend','pending',$7,$8,$9::jsonb,$10::jsonb,$11)
     ON CONFLICT (account_key, product_key, event_code, idempotency_key) DO NOTHING`,
    [
      stableKey('event_delivery', [idempotencyKey]),
      config.accountKey,
      config.productKey,
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
      now,
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

async function maybeSyncHighLevel(input: {
  pool: DbPool;
  config: AppConfig;
  deliveryKey: string;
  registrationKey: string;
  highLevelClient?: HighLevelEventClient | null;
}): Promise<TishaBavRegistrationSuccessResponse['ghl_sync_status'] | null> {
  if (input.config.highLevelEventSyncMode === 'disabled') return 'provider_off';
  const client = input.highLevelClient ?? createHighLevelEventClient(input.config);
  if (!client) return 'provider_off';
  const rows = await input.pool.query<{
    status: string;
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
    `SELECT status, protected_payload
       FROM onetime.event_delivery_events
      WHERE delivery_key = $1
        AND registration_key = $2
      LIMIT 1`,
    [input.deliveryKey, input.registrationKey],
  );
  if (rows.rows[0]?.status === 'succeeded') return 'succeeded';
  const payload = normalizeHighLevelPayload(rows.rows[0]?.protected_payload);
  if (!payload) return null;
  if (!payload.workflow_id) {
    await markHighLevelDelivery(input.pool, input.deliveryKey, 'provider_off', {
      workflow_configured: false,
    });
    return 'provider_off';
  }
  let providerStage = 'ensure_tags';
  try {
    await client.ensureTags({
      locationId: payload.location_id,
      tags: [
        ...TISHA_BAV_REQUIRED_TAGS,
        ...(payload.tags.includes(TISHA_BAV_NEWSLETTER_TAG) ? [TISHA_BAV_NEWSLETTER_TAG] : []),
      ],
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
      workflowId: payload.workflow_id,
      idempotencyKey: payload.workflow_request_key,
    });
    await markHighLevelDelivery(input.pool, input.deliveryKey, 'succeeded', {
      workflow_configured: true,
      contact_reference_hash: sha256(contact.contactId),
    });
    return 'succeeded';
  } catch (error) {
    await markHighLevelDelivery(input.pool, input.deliveryKey, 'failed', {
      error_class: error instanceof Error ? error.name : 'Error',
      failed_stage: providerStage,
      provider_http_status: highLevelErrorStatus(error),
    });
    return 'pending';
  }
}

async function markHighLevelDelivery(
  pool: DbPool,
  deliveryKey: string,
  status: 'succeeded' | 'failed' | 'provider_off',
  metadata: Record<string, unknown>,
) {
  await pool.query(
    `UPDATE onetime.event_delivery_events
        SET status = $2,
            attempts = attempts + 1,
            completed_at = CASE WHEN $2 = 'succeeded' THEN now() ELSE completed_at END,
            public_metadata = $3::jsonb,
            updated_at = now()
      WHERE delivery_key = $1`,
    [deliveryKey, status, JSON.stringify(metadata)],
  );
}

function highLevelProtectedPayload(
  config: AppConfig,
  registration: RegistrationRow,
  payload: TishaBavRegistrationPayload,
) {
  const tags = [
    "OT | Event | Tisha B'Av 2026 | Registered",
    "OT | Source | Tisha B'Av 2026",
    ...(registration.newsletter_opt_in ? [TISHA_BAV_NEWSLETTER_TAG] : []),
  ];
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

function registrationMessage(
  registrationKey: string | null,
  duplicate: boolean,
): TishaBavRegistrationSuccessResponse {
  return {
    success: true,
    duplicate_submission: duplicate,
    event_code: TISHA_BAV_EVENT_CODE,
    registration_key: registrationKey,
    confirmation_queued: true,
    ghl_sync_status: 'pending',
    message: {
      heading: 'Thank you — your spot has been reserved.',
      body: "We'll send your Zoom link and event details by email.",
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
