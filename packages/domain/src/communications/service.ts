import type {
  CommunicationsChannel,
  CommunicationsDirection,
  CommunicationsFilters,
  CommunicationsIntentType,
  CommunicationsListResponse,
  CommunicationsLocalState,
  CommunicationsProvenance,
  CommunicationsSource,
} from '../../../contracts/src/communications/index.ts';
import { communicationsCapabilities } from '../../../contracts/src/communications/index.ts';
import {
  CommunicationsCursorError,
  assertCursorBinding,
  decodeCommunicationsCursor,
  encodeCommunicationsCursor,
  hashCursorFilters,
  hashCursorScope,
} from './cursor.ts';
import { maskCommunicationsRecipient } from './masking.ts';
import {
  eventTypeForIntent,
  normalizeCommunicationsEvent,
  normalizeCommunicationsStatus,
} from './normalize.ts';

export type CommunicationsRole = 'owner' | 'admin' | 'crm_agent' | 'viewer' | string;

export type ReadOnlySessionScope = {
  accountKey: string;
  productKey: string;
  userKey: string;
  role: CommunicationsRole;
};

export type CommunicationsMode = { kind: 'global' } | { kind: 'contact'; contactId: string };

export type CommunicationsQuery = {
  from?: string | undefined;
  to?: string | undefined;
  channel?: string | undefined;
  direction?: string | undefined;
  intent_type?: string | undefined;
  status?: string | undefined;
  source?: string | undefined;
  limit?: string | number | undefined;
  cursor?: string | undefined;
};

export type CommunicationIntentRow = {
  id: string;
  accountKey: string;
  productKey: string;
  contactKey: string | null;
  eventType: string;
  channel: string;
  direction?: string | null | undefined;
  status: string | null;
  createdAt: string | Date;
  deliveredAt: string | Date | null;
  occurredAt?: string | Date | null | undefined;
  emailNormalized: string | null;
  phoneNormalized: string | null;
  householdKey?: string | null | undefined;
  threadId?: string | null | undefined;
  threadLabel?: string | null | undefined;
  source?: string | null | undefined;
  provenance?: string | null | undefined;
  previewRedacted?: string | null | undefined;
  providerReferenceDigest?: string | null | undefined;
  importBatchKey?: string | null | undefined;
  idempotencyKey?: string | null | undefined;
  participantKind?: string | null | undefined;
  participantLabel?: string | null | undefined;
  draftOnly?: boolean | null | undefined;
  transportAvailable?: boolean | null | undefined;
};

export type CommunicationIntentListInput = {
  scope: ReadOnlySessionScope;
  mode: CommunicationsMode;
  filters: CommunicationsFilters;
  cursor: { lastCreatedAt: string; lastId: string } | null;
  rawEventType?: string | undefined;
};

export type CommunicationContactLookupInput = {
  scope: ReadOnlySessionScope;
  contactId: string;
};

export type CommunicationIntentListResult = {
  rows: CommunicationIntentRow[];
  sourceAvailable: boolean;
};

export interface CommunicationsReadRepository {
  contactExists(input: CommunicationContactLookupInput): Promise<boolean>;
  list(input: CommunicationIntentListInput): Promise<CommunicationIntentListResult>;
}

export class CommunicationsAuthorizationError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN');
  }
}

export class CommunicationsValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class CommunicationsNotFoundError extends Error {
  constructor(message = 'Communications source was not found.') {
    super(message);
  }
}

export type BuildCommunicationsListInput = {
  session: ReadOnlySessionScope | null;
  repository: CommunicationsReadRepository;
  mode: CommunicationsMode;
  query: CommunicationsQuery;
  cursorSecret: string;
  now?: Date | undefined;
};

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_MS = 30 * 24 * 60 * 60 * 1000;
const CURSOR_TTL_MS = 30 * 60 * 1000;
const ACCOUNT_EMAIL_INTENT_TYPES = new Set<CommunicationsIntentType>([
  'password_reset',
  'account_activation',
  'student_pin_setup',
  'student_pin_reset',
]);

export function canReadCommunications(role: unknown) {
  return role === 'owner' || role === 'admin' || role === 'rabbi';
}

export async function buildCommunicationsListResponse({
  session,
  repository,
  mode,
  query,
  cursorSecret,
  now = new Date(),
}: BuildCommunicationsListInput): Promise<CommunicationsListResponse> {
  if (!session) throw new CommunicationsAuthorizationError(401);
  if (!canReadCommunications(session.role)) throw new CommunicationsAuthorizationError(403);

  const requestedFilters = parseCommunicationsFilters(query, now);
  if (
    mode.kind === 'global' &&
    requestedFilters.intent_type &&
    !ACCOUNT_EMAIL_INTENT_TYPES.has(requestedFilters.intent_type)
  ) {
    throw new CommunicationsValidationError(
      'ACCOUNT_EMAIL_INTENT_FORBIDDEN',
      'Only One Time account-email history is available here.',
    );
  }
  const filters: CommunicationsFilters =
    mode.kind === 'global'
      ? {
          ...requestedFilters,
          channel: 'email',
          direction: 'outbound',
          source: 'account_lifecycle_outbox',
        }
      : requestedFilters;
  if (mode.kind === 'contact') {
    const contactExists = await repository.contactExists({
      scope: session,
      contactId: mode.contactId,
    });
    if (!contactExists) throw new CommunicationsNotFoundError('Contact was not found.');
  }
  const rawEventType = filters.intent_type
    ? (eventTypeForIntent(filters.intent_type) ?? undefined)
    : undefined;
  const cursor = parseCursor({
    token: query.cursor,
    secret: cursorSecret,
    session,
    mode,
    filters,
    now,
  });
  const result = await repository.list({
    scope: session,
    mode,
    filters,
    cursor,
    rawEventType,
  });

  if (!result.sourceAvailable) {
    return {
      success: true,
      availability: 'unavailable',
      source_scope: 'canonical_communication_history',
      mailbox_complete: false,
      capabilities: communicationsCapabilities,
      applied_filters: filters,
      items: [],
      next_cursor: null,
    };
  }

  const pageRows = result.rows.slice(0, filters.limit);
  const items = pageRows.map((row) => {
    const event = normalizeCommunicationsEvent(row.eventType, row.channel);
    const status = normalizeCommunicationsStatus({
      status: row.status,
      deliveredAt: row.deliveredAt,
      eventType: row.eventType,
    });
    const occurredAt = row.occurredAt ?? row.createdAt;
    const source = normalizeSource(row.source);
    const provenance = normalizeProvenance(row.provenance);
    const direction = normalizeDirection(row.direction, event.channel);
    const contactPath = row.contactKey
      ? `/app/crm/contacts/${encodeURIComponent(row.contactKey)}`
      : null;
    const householdPath = row.householdKey
      ? `/app/parent/households/${encodeURIComponent(row.householdKey)}`
      : null;
    return {
      event_id: row.id,
      thread_id: row.threadId ?? defaultThreadId(row),
      thread_label: row.threadLabel ?? defaultThreadLabel(row),
      channel: event.channel,
      direction,
      intent_type: event.intentType,
      event_label: event.label,
      local_state: status.localState,
      state_label: status.stateLabel,
      source,
      source_label: sourceLabel(source),
      provenance,
      participant_kind: participantKind(row),
      participant_label: row.participantLabel ?? participantLabel(row),
      recipient_masked:
        source === 'account_lifecycle_outbox'
          ? 'Account email (hidden)'
          : maskCommunicationsRecipient({
              channel: event.channel,
              email: row.emailNormalized,
              phone: row.phoneNormalized,
            }),
      queued_at: toIso(occurredAt),
      occurred_at: toIso(occurredAt),
      state_at: status.stateAt,
      contact_path: contactPath,
      household_path: householdPath,
      preview_redacted: row.previewRedacted ?? previewFor(row, status.stateLabel),
      provider_reference_digest: row.providerReferenceDigest ?? null,
      import_batch_key: row.importBatchKey ?? null,
      idempotency_key: row.idempotencyKey ?? null,
      draft_only: Boolean(row.draftOnly ?? row.eventType === 'crm_single_recipient_reply_draft.v1'),
      transport_available: false as const,
    };
  });
  const last = pageRows.at(-1);
  const next_cursor =
    result.rows.length > filters.limit && last
      ? encodeCommunicationsCursor(cursorSecret, {
          v: 1,
          mode: mode.kind,
          scope_hash: scopeHash(cursorSecret, session),
          contact_hash:
            mode.kind === 'contact' ? contactHash(cursorSecret, mode.contactId) : undefined,
          filters_hash: hashCursorFilters(cursorSecret, filters),
          last_created_at: toIso(last.createdAt),
          last_id: last.id,
          expires_at: new Date(now.getTime() + CURSOR_TTL_MS).toISOString(),
        })
      : null;

  return {
    success: true,
    availability: 'available',
    source_scope: 'canonical_communication_history',
    mailbox_complete: false,
    capabilities: communicationsCapabilities,
    applied_filters: filters,
    items,
    next_cursor,
  };
}

export function parseCommunicationsFilters(
  query: CommunicationsQuery,
  now = new Date(),
): CommunicationsFilters {
  const hasFrom = query.from !== undefined && query.from !== '';
  const hasTo = query.to !== undefined && query.to !== '';
  if (hasFrom !== hasTo) {
    throw new CommunicationsValidationError('DATE_RANGE_UNBOUNDED', 'Provide both from and to.');
  }
  const from = hasFrom
    ? parseInstant(String(query.from), 'from')
    : new Date(now.getTime() - DEFAULT_RANGE_MS);
  const to = hasTo ? parseInstant(String(query.to), 'to') : now;
  if (from.getTime() >= to.getTime()) {
    throw new CommunicationsValidationError(
      'DATE_RANGE_REVERSED',
      'The from date must be before the to date.',
    );
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new CommunicationsValidationError(
      'DATE_RANGE_TOO_LARGE',
      'The date range may not exceed 90 days.',
    );
  }
  const limit =
    query.limit === undefined || query.limit === '' ? 25 : Number.parseInt(String(query.limit), 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new CommunicationsValidationError('LIMIT_INVALID', 'Limit must be between 1 and 25.');
  }
  const filters: CommunicationsFilters = {
    from: from.toISOString(),
    to: to.toISOString(),
    limit,
  };
  if (query.channel !== undefined && query.channel !== '') {
    if (!isChannel(query.channel))
      throw new CommunicationsValidationError('CHANNEL_INVALID', 'Channel is not supported.');
    filters.channel = query.channel;
  }
  if (query.direction !== undefined && query.direction !== '') {
    if (!isDirection(query.direction))
      throw new CommunicationsValidationError('DIRECTION_INVALID', 'Direction is not supported.');
    filters.direction = query.direction;
  }
  if (query.intent_type !== undefined && query.intent_type !== '') {
    if (!isIntentType(query.intent_type)) {
      throw new CommunicationsValidationError('INTENT_INVALID', 'Intent type is not supported.');
    }
    filters.intent_type = query.intent_type;
  }
  if (query.status !== undefined && query.status !== '') {
    if (!isLocalState(query.status)) {
      throw new CommunicationsValidationError('STATUS_INVALID', 'Local status is not supported.');
    }
    filters.status = query.status;
  }
  if (query.source !== undefined && query.source !== '') {
    if (!isSource(query.source)) {
      throw new CommunicationsValidationError('SOURCE_INVALID', 'Source is not supported.');
    }
    filters.source = query.source;
  }
  return filters;
}

function parseCursor(input: {
  token?: string | undefined;
  secret: string;
  session: ReadOnlySessionScope;
  mode: CommunicationsMode;
  filters: CommunicationsFilters;
  now: Date;
}) {
  if (!input.token) return null;
  const payload = decodeCommunicationsCursor(input.secret, input.token, input.now);
  if (payload.mode !== input.mode.kind) throw new CommunicationsCursorError('CURSOR_MODE_MISMATCH');
  assertCursorBinding(
    payload.scope_hash,
    scopeHash(input.secret, input.session),
    'CURSOR_SCOPE_MISMATCH',
  );
  assertCursorBinding(
    payload.filters_hash,
    hashCursorFilters(input.secret, input.filters),
    'CURSOR_FILTER_MISMATCH',
  );
  if (input.mode.kind === 'contact') {
    assertCursorBinding(
      payload.contact_hash ?? '',
      contactHash(input.secret, input.mode.contactId),
      'CURSOR_CONTACT_MISMATCH',
    );
  } else if (payload.contact_hash) {
    throw new CommunicationsCursorError('CURSOR_MODE_MISMATCH');
  }
  return { lastCreatedAt: payload.last_created_at, lastId: payload.last_id };
}

function parseInstant(value: string, field: string) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new CommunicationsValidationError(
      'DATE_INVALID',
      `${field} must be an RFC 3339 instant.`,
    );
  }
  return parsed;
}

function scopeHash(secret: string, session: ReadOnlySessionScope) {
  return hashCursorScope(secret, [session.accountKey, session.productKey]);
}

function contactHash(secret: string, contactId: string) {
  return hashCursorScope(secret, ['contact', contactId]);
}

function isChannel(value: string): value is CommunicationsChannel {
  return value === 'email' || value === 'whatsapp' || value === 'internal_email';
}

function isIntentType(value: string): value is CommunicationsIntentType {
  return (
    value === 'family_signup_email_ack' ||
    value === 'family_signup_whatsapp_confirmation' ||
    value === 'internal_lead_alert' ||
    value === 'single_recipient_reply' ||
    value === 'password_reset' ||
    value === 'account_activation' ||
    value === 'student_pin_setup' ||
    value === 'student_pin_reset' ||
    value === 'whatsapp_inbound_message' ||
    value === 'whatsapp_provider_event' ||
    value === 'historical_import_event' ||
    value === 'history_unavailable'
  );
}

function isLocalState(value: string): value is CommunicationsLocalState {
  return (
    value === 'queued' ||
    value === 'provider_accepted' ||
    value === 'provider_sent' ||
    value === 'delivered' ||
    value === 'read' ||
    value === 'received' ||
    value === 'processed' ||
    value === 'failed' ||
    value === 'bounced' ||
    value === 'complained' ||
    value === 'suppressed' ||
    value === 'draft_saved' ||
    value === 'sink_delivered' ||
    value === 'duplicate' ||
    value === 'unknown' ||
    value === 'retrying' ||
    value === 'expired' ||
    value === 'superseded' ||
    value === 'provider_off' ||
    value === 'cleared' ||
    value === 'history_unavailable'
  );
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isDirection(value: string): value is CommunicationsDirection {
  return value === 'inbound' || value === 'outbound' || value === 'internal';
}

function isSource(value: string): value is CommunicationsSource {
  return (
    value === 'canonical_history_event' ||
    value === 'local_outbox_intent' ||
    value === 'crm_reply_draft' ||
    value === 'stored_whatsapp_webhook' ||
    value === 'stored_provider_delivery_event' ||
    value === 'account_lifecycle_outbox' ||
    value === 'historical_import' ||
    value === 'provider_history_unavailable'
  );
}

function normalizeDirection(
  value: string | null | undefined,
  channel: CommunicationsChannel,
): CommunicationsDirection {
  if (value === 'inbound' || value === 'outbound' || value === 'internal') return value;
  return channel === 'internal_email' ? 'internal' : 'outbound';
}

function normalizeSource(value: string | null | undefined): CommunicationsSource {
  return isSource(String(value ?? '')) ? (value as CommunicationsSource) : 'local_outbox_intent';
}

function normalizeProvenance(value: string | null | undefined): CommunicationsProvenance {
  if (
    value === 'local_database' ||
    value === 'stored_webhook' ||
    value === 'stored_provider_event' ||
    value === 'redacted_export' ||
    value === 'capability_limitation'
  ) {
    return value;
  }
  return 'local_database';
}

function defaultThreadId(row: CommunicationIntentRow) {
  if (row.threadId) return row.threadId;
  if (row.contactKey) return `contact:${row.contactKey}:${row.channel}`;
  if (row.householdKey) return `household:${row.householdKey}:${row.channel}`;
  return `unlinked:${row.channel}:${row.id}`;
}

function defaultThreadLabel(row: CommunicationIntentRow) {
  if (row.threadLabel) return row.threadLabel;
  if (row.contactKey) return 'Contact communication history';
  if (row.householdKey) return 'Household communication history';
  return 'Unlinked communication history';
}

function participantKind(
  row: CommunicationIntentRow,
): 'account' | 'contact' | 'household' | 'unknown' {
  if (row.participantKind === 'account') return 'account';
  if (row.participantKind === 'contact' || row.contactKey) return 'contact';
  if (row.participantKind === 'household' || row.householdKey) return 'household';
  return 'unknown';
}

function participantLabel(row: CommunicationIntentRow) {
  if (row.source === 'account_lifecycle_outbox') return 'Active One Time account';
  if (row.contactKey) return 'Linked contact';
  if (row.householdKey) return 'Linked household';
  return 'Unlinked participant';
}

function sourceLabel(source: CommunicationsSource) {
  if (source === 'canonical_history_event') return 'Canonical history';
  if (source === 'local_outbox_intent') return 'Local outbound intent';
  if (source === 'crm_reply_draft') return 'Provider-off reply draft';
  if (source === 'stored_whatsapp_webhook') return 'Stored WhatsApp webhook';
  if (source === 'stored_provider_delivery_event') return 'Stored provider status';
  if (source === 'account_lifecycle_outbox') return 'Account security delivery';
  if (source === 'historical_import') return 'Historical import';
  return 'Provider history unavailable';
}

function previewFor(row: CommunicationIntentRow, stateLabel: string) {
  if (row.eventType === 'crm_single_recipient_reply_draft.v1') {
    return 'Provider-off reply draft saved locally. Message body is hidden.';
  }
  if (row.eventType === 'whatsapp_inbound_message.v1') {
    return 'Inbound WhatsApp message was stored. Body is encrypted and hidden.';
  }
  if (row.eventType === 'whatsapp_provider_delivery_event.v1') {
    return `Provider status recorded: ${stateLabel}.`;
  }
  if (
    row.eventType === 'account_password_reset.v1' ||
    row.eventType === 'account_activation.v1' ||
    row.eventType === 'student_pin_setup.v1' ||
    row.eventType === 'student_pin_reset.v1'
  ) {
    return `Account security delivery status: ${stateLabel}. Message body and secure link are hidden.`;
  }
  if (row.source === 'provider_history_unavailable') {
    return 'Provider history is not available from the configured source.';
  }
  return 'Redacted communication event.';
}
