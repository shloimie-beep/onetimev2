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
import { normalizeEmail, stableKey } from '../lead/normalize.ts';
import {
  TISHA_BAV_COMMUNICATION_CATALOG_VERSION,
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
export const TISHA_BAV_EVENT_EMAIL_DISCLOSURE_VERSION = 'tisha-bav-2026-event-email-v1';
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
const TISHA_BAV_REGISTERED_TAG = "OT | Event | Tisha B'Av 2026 | Registered";
const TISHA_BAV_DIRECT_CONFIRMATION_TEMPLATE = 'tisha_bav_2026_registration_confirmation_direct_v2';
const TISHA_BAV_DIRECT_CONFIRMATION_SUBJECT =
  "You're registered for Rabbi Eli Scheller's live Tisha B'Av Zoom class";
const TISHA_BAV_DIRECT_CONFIRMATION_BODY = [
  'Hi {{default contact.first_name "there"}},',
  '',
  "Your son's place is saved for Rabbi Eli Scheller's live Tisha B'Av Zoom class for boys.",
  '',
  'Thursday, July 23, 2026',
  '3:00 PM Eastern',
  '10:00 PM Israel',
  '',
  'The direct Zoom class link is below.',
  '',
  '[Join the Zoom Class]',
  '',
  'Please do not forward the class link.',
  '',
  'One Time Mishnayos',
  'info@onetimeonetime.com',
].join('\n');

type RegistrationResult = TishaBavRegistrationSuccessResponse & {
  highLevelDeliveryKey: string | null;
};

type HighLevelSyncAttemptStatus =
  TishaBavRegistrationSuccessResponse['ghl_sync_status'] | 'in_flight' | null;

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

class HighLevelProviderRequestError extends Error {
  constructor(
    readonly status: number,
    readonly category: string,
  ) {
    super(`HighLevel API request failed with status ${status}: ${category}.`);
    this.name = 'HighLevelProviderRequestError';
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
  }): Promise<HighLevelWorkflowEnrollmentOutcome>;
};

export type HighLevelWorkflowEnrollmentOutcome =
  { outcome: 'enrolled' } | { outcome: 'already_active' };

export class MockHighLevelEventClient implements HighLevelEventClient {
  readonly tags = new Set<string>();
  readonly contacts = new Map<string, { contactId: string; tags: string[] }>();
  readonly workflowRequests: string[] = [];
  readonly operationLog: string[] = [];

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
    this.operationLog.push(`tags:${input.tags.map(normalizeTagName).sort().join('|')}`);
    for (const contact of this.contacts.values()) {
      if (contact.contactId !== input.contactId) continue;
      contact.tags = [...new Set([...contact.tags, ...input.tags])];
      return;
    }
  }

  async addToWorkflow(input: {
    contactId: string;
    workflowId: string;
    idempotencyKey: string;
  }): Promise<HighLevelWorkflowEnrollmentOutcome> {
    this.operationLog.push('workflow:accepted');
    this.workflowRequests.push(
      `${input.contactId}:${input.workflowId}:${stableKey('workflow', [input.idempotencyKey])}`,
    );
    return { outcome: 'enrolled' as const };
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
        allowConflict: 'resource_exists',
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
    await this.request(`/contacts/${encodeURIComponent(input.contactId)}/tags`, {
      method: 'POST',
      body: { tags: input.tags },
      apiVersion: '2023-02-21',
    });
    const expectedTags = input.tags.map(normalizeTagName);
    let readbackFailure: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const readback = await this.request(`/contacts/${encodeURIComponent(input.contactId)}`, {
          method: 'GET',
        });
        const contact = (readback.contact ?? readback) as Record<string, unknown>;
        const currentTags = new Set(
          (Array.isArray(contact.tags) ? contact.tags : []).map((tag) =>
            normalizeTagName(String(tag)),
          ),
        );
        if (expectedTags.every((tag) => currentTags.has(tag))) return;
        readbackFailure = new Error('Required tags were not visible on contact readback.');
      } catch (error) {
        readbackFailure = error;
      }
      if (attempt < 2) await boundedProviderReadbackDelay(attempt);
    }
    throw new Error('HighLevel contact tag verification failed.', { cause: readbackFailure });
  }

  async addToWorkflow(input: { contactId: string; workflowId: string; idempotencyKey: string }) {
    void input.idempotencyKey;
    try {
      await this.request(
        `/contacts/${encodeURIComponent(input.contactId)}/workflow/${encodeURIComponent(
          input.workflowId,
        )}`,
        {
          method: 'POST',
          body: {},
        },
      );
      return { outcome: 'enrolled' as const };
    } catch (error) {
      if (
        error instanceof HighLevelProviderRequestError &&
        [409, 422].includes(error.status) &&
        error.category === 'workflow_already_enrolled'
      ) {
        return { outcome: 'already_active' as const };
      }
      throw error;
    }
  }

  private async request(
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
      allowConflict?: 'resource_exists';
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
    const responseBody = ((await response.json().catch(() => ({}))) ?? {}) as Record<
      string,
      unknown
    >;
    if (
      options.allowConflict &&
      (response.status === 409 || response.status === 422) &&
      exactProviderConflict(responseBody)
    ) {
      return responseBody;
    }
    if (!response.ok) {
      const providerCode = providerErrorCode(responseBody);
      throw new HighLevelProviderRequestError(
        response.status,
        /already_(?:enrolled|in_(?:(?:the|this)_)?workflow|part_of_(?:(?:the|this)_)?workflow)/i.test(
          providerCode,
        )
          ? 'workflow_already_enrolled'
          : providerCode,
      );
    }
    return responseBody;
  }
}

function exactProviderConflict(response: Record<string, unknown>) {
  const message = Array.isArray(response.message)
    ? response.message.map(String).join(' ')
    : String(response.message ?? response.error ?? '');
  return /already exists|duplicate/i.test(message);
}

function normalizeTagName(value: string) {
  return value.trim().toLocaleLowerCase();
}

async function boundedProviderReadbackDelay(attempt: number) {
  await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
}

function providerErrorCode(response: Record<string, unknown>) {
  const message = Array.isArray(response.message)
    ? response.message.map(String).join(' ')
    : String(response.message ?? response.error ?? 'provider_error');
  return message.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80) || 'provider_error';
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
  const syncAttempt = await maybeSyncHighLevel({
    pool: input.pool,
    config: input.config,
    deliveryKey: response.highLevelDeliveryKey,
    registrationKey: response.registration_key ?? '',
    now,
    ...(input.highLevelClient === undefined ? {} : { highLevelClient: input.highLevelClient }),
  });
  const syncStatus = syncAttempt === 'in_flight' ? 'pending' : syncAttempt;
  const fallbackQueued =
    syncAttempt === 'in_flight' || syncStatus === 'succeeded'
      ? false
      : await queueFallbackAfterHighLevelFailure({
          pool: input.pool,
          config: input.config,
          registrationKey: response.registration_key ?? '',
          highLevelDeliveryKey: response.highLevelDeliveryKey,
          now,
        });
  const confirmationQueued = syncStatus === 'succeeded' || fallbackQueued;

  return {
    ...withoutInternalKeys(response),
    confirmation_queued: confirmationQueued,
    ghl_sync_status: syncStatus ?? response.ghl_sync_status,
    message: registrationMessage(
      response.registration_key,
      response.duplicate_submission,
      confirmationQueued,
    ).message,
  };
}

export async function reprocessTishaBavRegistrationDelivery(input: {
  pool: DbPool;
  config: AppConfig;
  registrationKey: string;
  now?: Date;
  highLevelClient?: HighLevelEventClient | null;
  allowAlreadyEnrolledRecovery?: boolean;
}) {
  const now = input.now ?? new Date();
  const delivery = await input.pool.query<{
    delivery_key: string;
    status: string;
    public_metadata: Record<string, unknown>;
  }>(
    `SELECT delivery_key, status, public_metadata
       FROM onetime.event_delivery_events
      WHERE account_key = $1
        AND product_key = $2
        AND event_code = $3
        AND registration_key = $4
        AND provider = 'highlevel'
      LIMIT 1`,
    [input.config.accountKey, input.config.productKey, TISHA_BAV_EVENT_CODE, input.registrationKey],
  );
  const row = delivery.rows[0];
  if (!row) return { status: 'missing' as const, fallback_queued: false };
  await materializeLegacyEventEmailPermission(input.pool, input.config, input.registrationKey);
  const rowMetadata = normalizeJsonRecord(row.public_metadata);
  const legacyFalseSuccessRecovery =
    input.allowAlreadyEnrolledRecovery === true &&
    highLevelDeliveryVerified(rowMetadata) &&
    rowMetadata.new_enrollment_accepted !== true;
  if (
    row.status === 'succeeded' &&
    highLevelDeliveryVerified(rowMetadata) &&
    !legacyFalseSuccessRecovery
  ) {
    return { status: 'succeeded' as const, fallback_queued: false };
  }
  if (row.status === 'succeeded') {
    const reopened = await input.pool.query(
      `UPDATE onetime.event_delivery_events
          SET status = 'pending',
              completed_at = NULL,
              updated_at = $3
        WHERE delivery_key = $1
          AND status = 'succeeded'
          AND public_metadata = $2::jsonb
        RETURNING delivery_key`,
      [row.delivery_key, JSON.stringify(normalizeJsonRecord(row.public_metadata)), now],
    );
    if (!reopened.rowCount) {
      return { status: 'blocked' as const, fallback_queued: false };
    }
    row.status = 'pending';
  }
  if (!['provider_off', 'failed', 'pending', 'skipped'].includes(row.status)) {
    return { status: 'blocked' as const, fallback_queued: false };
  }
  const retryReservation = await reserveHighLevelReprocess(
    input.pool,
    input.config,
    row.delivery_key,
    input.registrationKey,
    now,
  );
  if (!retryReservation.allowed) {
    return { status: 'blocked' as const, fallback_queued: false };
  }
  let syncAttempt: HighLevelSyncAttemptStatus = null;
  const knownExistingMembership =
    normalizeJsonRecord(row.public_metadata).membership_existing === true;
  try {
    syncAttempt =
      knownExistingMembership && input.allowAlreadyEnrolledRecovery === true
        ? 'skipped'
        : await maybeSyncHighLevel({
            pool: input.pool,
            config: input.config,
            deliveryKey: row.delivery_key,
            registrationKey: input.registrationKey,
            now,
            allowPendingFallbackRetry: true,
            reprocessLeaseOwnerHash: retryReservation.leaseOwnerHash,
            ...(input.highLevelClient === undefined
              ? {}
              : { highLevelClient: input.highLevelClient }),
          });
  } finally {
    if (retryReservation.leaseOwnerHash) {
      await releaseReprocessReservation(
        input.pool,
        input.config,
        input.registrationKey,
        retryReservation.leaseOwnerHash,
      );
    }
  }
  if (syncAttempt === 'in_flight') {
    return { status: 'blocked' as const, fallback_queued: false };
  }
  const syncStatus = syncAttempt;
  const fallbackQueued =
    syncStatus === 'succeeded'
      ? false
      : await queueFallbackAfterHighLevelFailure({
          pool: input.pool,
          config: input.config,
          registrationKey: input.registrationKey,
          highLevelDeliveryKey: row.delivery_key,
          now,
          allowAlreadyEnrolledRecovery: input.allowAlreadyEnrolledRecovery === true,
        });
  return { status: syncStatus ?? 'blocked', fallback_queued: fallbackQueued };
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
       newsletter_opt_in = false,
       marketing_consent_policy_version = NULL,
       marketing_consent_recorded_at = NULL,
       latest_source = EXCLUDED.latest_source,
       last_seen_at = EXCLUDED.last_seen_at,
       last_registered_at = EXCLUDED.last_registered_at,
       metadata = EXCLUDED.metadata,
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
  const highLevelDeliveryKey = await upsertHighLevelDelivery(client, config, row, payload, now);
  await insertAudit(client, config, row.registration_key, payload, now);

  const responseBase: RegistrationResult = {
    ...registrationMessage(row.registration_key, false),
    confirmation_queued: false,
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
        AND email_normalized = $4
      LIMIT 1`,
    [config.accountKey, config.productKey, TISHA_BAV_EVENT_CODE, registration.email_normalized],
  );
  const contact = await client.query<{ suppression_state: string }>(
    `SELECT suppression_state
       FROM onetime.contacts
      WHERE account_key = $1
        AND product_key = $2
        AND email_normalized = $3
      LIMIT 1`,
    [config.accountKey, config.productKey, registration.email_normalized],
  );
  const current = existing.rows[0];
  const contactSuppressed =
    (contact.rowCount ?? 0) > 0 &&
    String(contact.rows[0]?.suppression_state ?? 'unknown') !== 'active';
  const status: EventEmailPermissionStatus =
    current && EVENT_EMAIL_DENY_STATUSES.has(current.status)
      ? current.status
      : contactSuppressed
        ? 'suppressed'
        : 'granted';
  const reasonCode =
    current && EVENT_EMAIL_DENY_STATUSES.has(current.status)
      ? (current.deny_reason ?? `existing_${current.status}`)
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
    registration.email_normalized,
  ]);
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
      registration.registration_key,
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
       email_normalized, permission_scope, status, disclosure_version, source,
       granted_at, denied_at, deny_reason, latest_permission_event_key
     ) VALUES (
       $1,$2,$3,$4,$5,$6,'event_service_email',$7,$8,$9,
       CASE WHEN $7 = 'granted' THEN $10::timestamptz ELSE NULL END,
       CASE WHEN $7 = 'granted' THEN NULL ELSE $10::timestamptz END,
       $11,$12
     )
     ON CONFLICT (account_key, product_key, event_code, email_normalized)
     DO UPDATE SET
       registration_key = EXCLUDED.registration_key,
       status = CASE
         WHEN onetime.event_email_permissions.status IN
           ('withdrawn','suppressed','unsubscribed','complained','hard_bounced')
           THEN onetime.event_email_permissions.status
         ELSE EXCLUDED.status
       END,
       disclosure_version = EXCLUDED.disclosure_version,
       source = EXCLUDED.source,
       granted_at = CASE
         WHEN onetime.event_email_permissions.status IN
           ('withdrawn','suppressed','unsubscribed','complained','hard_bounced')
           THEN onetime.event_email_permissions.granted_at
         ELSE COALESCE(onetime.event_email_permissions.granted_at, EXCLUDED.granted_at)
       END,
       denied_at = COALESCE(onetime.event_email_permissions.denied_at, EXCLUDED.denied_at),
       deny_reason = COALESCE(onetime.event_email_permissions.deny_reason, EXCLUDED.deny_reason),
       latest_permission_event_key = EXCLUDED.latest_permission_event_key,
       updated_at = now()`,
    [
      permissionKey,
      config.accountKey,
      config.productKey,
      TISHA_BAV_EVENT_CODE,
      registration.registration_key,
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
        public_metadata = CASE
           WHEN onetime.event_delivery_events.status = 'succeeded'
            AND onetime.event_delivery_events.public_metadata->>'tags_verified' = 'true'
            AND onetime.event_delivery_events.public_metadata->>'workflow_enrollment_verified' = 'true'
            AND onetime.event_delivery_events.public_metadata->>'new_enrollment_accepted' = 'true'
           THEN onetime.event_delivery_events.public_metadata
          WHEN onetime.event_delivery_events.public_metadata->>'membership_existing' = 'true'
           THEN onetime.event_delivery_events.public_metadata
          WHEN onetime.event_delivery_events.public_metadata->>'new_enrollment_accepted' = 'true'
          THEN onetime.event_delivery_events.public_metadata
          ELSE EXCLUDED.public_metadata
        END,
       payload_digest = EXCLUDED.payload_digest,
        status = CASE
           WHEN onetime.event_delivery_events.status = 'succeeded'
            AND onetime.event_delivery_events.public_metadata->>'tags_verified' = 'true'
            AND onetime.event_delivery_events.public_metadata->>'workflow_enrollment_verified' = 'true'
            AND onetime.event_delivery_events.public_metadata->>'new_enrollment_accepted' = 'true'
           THEN 'succeeded'
          WHEN onetime.event_delivery_events.public_metadata->>'membership_existing' = 'true'
           THEN 'skipped'
          WHEN onetime.event_delivery_events.public_metadata->>'new_enrollment_accepted' = 'true'
          THEN onetime.event_delivery_events.status
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
  allowAlreadyEnrolledRecovery?: boolean;
}) {
  if (input.config.oneTimeEventEmailFallback !== 'resend') return false;
  if (input.now > new Date('2026-07-24T23:59:59.000Z')) return false;
  const protectedJoinUrl = input.config.tishaBavZoomJoinUrl;
  if (!protectedJoinUrl) return false;
  const highLevel = await input.pool.query<{
    status: string;
    public_metadata: Record<string, unknown>;
  }>(
    `SELECT status, public_metadata
       FROM onetime.event_delivery_events
      WHERE delivery_key = $1
        AND registration_key = $2
        AND provider = 'highlevel'
      LIMIT 1`,
    [input.highLevelDeliveryKey, input.registrationKey],
  );
  const highLevelRow = highLevel.rows[0];
  if (!fallbackIsSafeAfterHighLevel(highLevelRow, input.allowAlreadyEnrolledRecovery === true)) {
    return false;
  }
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
    template: TISHA_BAV_DIRECT_CONFIRMATION_TEMPLATE,
    subject: TISHA_BAV_DIRECT_CONFIRMATION_SUBJECT,
    body: TISHA_BAV_DIRECT_CONFIRMATION_BODY,
    cta: { label: 'Join the Zoom Class', kind: 'protected_runtime_url' },
    join_url: protectedJoinUrl,
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
        protected_direct_link_present: true,
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
    const marked = await markHighLevelDelivery(
      input.pool,
      input.deliveryKey,
      'skipped',
      {
        workflow_configured: Boolean(input.config.highLevelTishaBavWorkflowId),
        blocked_reason: eligibility.reason,
      },
      input.reprocessLeaseOwnerHash,
    );
    if (!marked) return 'in_flight';
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
    public_metadata: Record<string, unknown>;
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
    `SELECT status, lease_owner_hash, public_metadata, protected_payload
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
  const deliveryRow = rows.rows[0];
  const deliveryMetadata = normalizeJsonRecord(deliveryRow?.public_metadata);
  if (
    deliveryRow?.status === 'skipped' &&
    deliveryMetadata.membership_existing === true &&
    !input.allowPendingFallbackRetry
  ) {
    return 'skipped';
  }
  if (
    deliveryRow?.status === 'succeeded' &&
    highLevelDeliveryVerified(deliveryRow.public_metadata) &&
    deliveryMetadata.new_enrollment_accepted === true
  ) {
    return 'succeeded';
  }
  if (
    deliveryRow?.status === 'succeeded' &&
    (!highLevelDeliveryVerified(deliveryRow.public_metadata) ||
      deliveryMetadata.new_enrollment_accepted !== true) &&
    !input.allowPendingFallbackRetry
  ) {
    return 'skipped';
  }
  if (deliveryRow?.status === 'succeeded') {
    const reopened = await input.pool.query(
      `UPDATE onetime.event_delivery_events
          SET status = 'pending',
              completed_at = NULL,
              updated_at = $3
        WHERE delivery_key = $1
          AND status = 'succeeded'
          AND public_metadata = $2::jsonb
        RETURNING delivery_key`,
      [
        input.deliveryKey,
        JSON.stringify(normalizeJsonRecord(deliveryRow.public_metadata)),
        input.now ?? new Date(),
      ],
    );
    if (!reopened.rowCount) return 'in_flight';
  }
  const payload = normalizeHighLevelPayload(deliveryRow?.protected_payload);
  if (!payload) return null;
  const workflowId = payload.workflow_id ?? input.config.highLevelTishaBavWorkflowId;
  if (!workflowId) {
    const marked = await markHighLevelDelivery(
      input.pool,
      input.deliveryKey,
      'provider_off',
      {
        workflow_configured: false,
      },
      input.reprocessLeaseOwnerHash,
    );
    if (!marked) return 'in_flight';
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
    const preEnrollmentTags = payload.tags.filter(
      (tag) => normalizeTagName(tag) !== normalizeTagName(TISHA_BAV_REGISTERED_TAG),
    );
    if (preEnrollmentTags.length) {
      providerStage = 'add_pre_enrollment_tags';
      await client.addTags({
        locationId: payload.location_id,
        contactId: contact.contactId,
        tags: preEnrollmentTags,
      });
    }
    const enrollmentWasPreviouslyAccepted =
      deliveryMetadata.new_enrollment_accepted === true &&
      deliveryMetadata.workflow_enrollment_verified === true &&
      deliveryMetadata.membership_existing !== true;
    if (!enrollmentWasPreviouslyAccepted) {
      providerStage = 'add_to_workflow';
      const enrollment = await client.addToWorkflow({
        contactId: contact.contactId,
        workflowId,
        idempotencyKey: payload.workflow_request_key,
      });
      const progressRecorded = await recordHighLevelDeliveryProgress(
        input.pool,
        input.deliveryKey,
        enrollment.outcome === 'enrolled'
          ? {
              workflow_configured: true,
              contact_reference_hash: sha256(contact.contactId),
              workflow_request_accepted: true,
              workflow_enrollment_verified: true,
              new_enrollment_accepted: true,
              membership_existing: false,
              confirmation_queued: true,
            }
          : {
              workflow_configured: true,
              contact_reference_hash: sha256(contact.contactId),
              workflow_request_accepted: false,
              workflow_enrollment_verified: false,
              new_enrollment_accepted: false,
              membership_existing: true,
              confirmation_queued: false,
              provider_result_category: 'workflow_already_enrolled',
            },
        leaseOwnerHash,
      );
      if (!progressRecorded) return 'in_flight';
      if (enrollment.outcome === 'already_active') {
        providerStage = 'add_post_enrollment_tags';
        await client.addTags({
          locationId: payload.location_id,
          contactId: contact.contactId,
          tags: payload.tags,
        });
        const marked = await markHighLevelDelivery(
          input.pool,
          input.deliveryKey,
          'skipped',
          {
            workflow_configured: true,
            contact_reference_hash: sha256(contact.contactId),
            tags_verified: true,
            workflow_request_accepted: false,
            workflow_enrollment_verified: false,
            new_enrollment_accepted: false,
            membership_existing: true,
            confirmation_queued: false,
            provider_result_category: 'workflow_already_enrolled',
          },
          leaseOwnerHash,
        );
        if (!marked) return 'in_flight';
        return 'skipped';
      }
    }
    providerStage = 'add_post_enrollment_tags';
    await client.addTags({
      locationId: payload.location_id,
      contactId: contact.contactId,
      tags: payload.tags,
    });
    const marked = await markHighLevelDelivery(
      input.pool,
      input.deliveryKey,
      'succeeded',
      {
        workflow_configured: true,
        contact_reference_hash: sha256(contact.contactId),
        tags_verified: true,
        workflow_request_accepted: true,
        workflow_enrollment_verified: true,
        new_enrollment_accepted: true,
        membership_existing: false,
        confirmation_queued: true,
      },
      leaseOwnerHash,
    );
    if (!marked) return 'in_flight';
    await cancelUnsentFallback(
      input.pool,
      input.config,
      input.registrationKey,
      leaseOwnerHash,
      input.now ?? new Date(),
    );
    return 'succeeded';
  } catch (error) {
    const marked = await markHighLevelDelivery(
      input.pool,
      input.deliveryKey,
      'failed',
      {
        error_class: error instanceof Error ? error.name : 'Error',
        failed_stage: providerStage,
        provider_http_status: highLevelErrorStatus(error),
        provider_result_category: highLevelErrorCategory(error),
      },
      leaseOwnerHash,
    );
    if (!marked) return 'in_flight';
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
    const updated = await pool.query(`${baseSql} AND lease_owner_hash = $4`, [
      deliveryKey,
      status,
      JSON.stringify(publicMetadata),
      leaseOwnerHash,
    ]);
    return Boolean(updated.rowCount);
  }
  await pool.query(baseSql, [deliveryKey, status, JSON.stringify(publicMetadata)]);
  return true;
}

async function recordHighLevelDeliveryProgress(
  pool: Queryable,
  deliveryKey: string,
  metadata: Record<string, unknown>,
  leaseOwnerHash: string,
) {
  const current = await pool.query<{ public_metadata: Record<string, unknown> }>(
    `SELECT public_metadata
       FROM onetime.event_delivery_events
      WHERE delivery_key = $1
        AND lease_owner_hash = $2
      LIMIT 1`,
    [deliveryKey, leaseOwnerHash],
  );
  if (!current.rowCount) return false;
  const publicMetadata = {
    ...normalizeJsonRecord(current.rows[0]?.public_metadata),
    ...metadata,
  };
  const updated = await pool.query(
    `UPDATE onetime.event_delivery_events
        SET public_metadata = $3::jsonb,
            updated_at = now()
      WHERE delivery_key = $1
        AND lease_owner_hash = $2`,
    [deliveryKey, leaseOwnerHash, JSON.stringify(publicMetadata)],
  );
  return Boolean(updated.rowCount);
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
  if (error instanceof HighLevelProviderRequestError) return error.status;
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/status (\d{3})\b/);
  return match ? Number(match[1]) : null;
}

function highLevelErrorCategory(error: unknown) {
  if (error instanceof HighLevelProviderRequestError) return error.category;
  if (
    error instanceof Error &&
    /already_(?:enrolled|in_(?:(?:the|this)_)?workflow|part_of_(?:(?:the|this)_)?workflow)|already (?:enrolled|in (?:(?:the|this) )?workflow|part of (?:(?:the|this) )?workflow)/i.test(
      error.message,
    )
  ) {
    return 'workflow_already_enrolled';
  }
  return error instanceof Error ? error.name : 'provider_error';
}

function fallbackIsSafeAfterHighLevel(
  row: { status: string; public_metadata: Record<string, unknown> } | undefined,
  allowAlreadyEnrolledRecovery: boolean,
) {
  if (!row) return false;
  if (row.status === 'provider_off') return true;
  const metadata = normalizeJsonRecord(row.public_metadata);
  const stage = String(metadata.failed_stage ?? '');
  const category = String(metadata.provider_result_category ?? '');
  const status = Number(metadata.provider_http_status);
  if (metadata.membership_existing === true || category === 'workflow_already_enrolled') {
    return allowAlreadyEnrolledRecovery;
  }
  if (row.status !== 'failed') return false;
  if (['ensure_tags', 'upsert_contact', 'add_pre_enrollment_tags'].includes(stage)) return true;
  if (stage === 'add_to_workflow') {
    return status >= 400 && status < 500 && ![409, 422].includes(status);
  }
  return false;
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

function highLevelDeliveryVerified(value: unknown) {
  const metadata = normalizeJsonRecord(value);
  return metadata.tags_verified === true && metadata.workflow_enrollment_verified === true;
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

function isMemoryPool(pool: DbPool) {
  return Boolean((pool as DbPool & { __memory?: boolean }).__memory);
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
