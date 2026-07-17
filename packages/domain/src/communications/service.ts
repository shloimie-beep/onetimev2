import type {
  CommunicationsChannel,
  CommunicationsFilters,
  CommunicationsIntentType,
  CommunicationsListResponse,
  CommunicationsLocalState,
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
  intent_type?: string | undefined;
  status?: string | undefined;
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
  status: string | null;
  createdAt: string | Date;
  deliveredAt: string | Date | null;
  emailNormalized: string | null;
  phoneNormalized: string | null;
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

export function canReadCommunications(role: unknown) {
  return role === 'owner' || role === 'admin';
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

  const filters = parseCommunicationsFilters(query, now);
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
      source_scope: 'local_communication_intents_only',
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
    });
    return {
      channel: event.channel,
      intent_type: event.intentType,
      event_label: event.label,
      local_state: status.localState,
      state_label: status.stateLabel,
      recipient_masked: maskCommunicationsRecipient({
        channel: event.channel,
        email: row.emailNormalized,
        phone: row.phoneNormalized,
      }),
      queued_at: toIso(row.createdAt),
      state_at: status.stateAt,
      contact_path: row.contactKey
        ? `/app/crm/contacts/${encodeURIComponent(row.contactKey)}`
        : null,
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
    source_scope: 'local_communication_intents_only',
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
    value === 'single_recipient_reply'
  );
}

function isLocalState(value: string): value is CommunicationsLocalState {
  return (
    value === 'queued' ||
    value === 'provider_accepted' ||
    value === 'delivered' ||
    value === 'failed' ||
    value === 'bounced' ||
    value === 'complained' ||
    value === 'suppressed' ||
    value === 'draft_saved' ||
    value === 'unknown'
  );
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
