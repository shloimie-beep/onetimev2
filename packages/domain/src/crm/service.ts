import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  contactListQuerySchema,
  createContactSchema,
  updateContactSchema,
  type ContactDetail,
  type ContactListItem,
  type ContactListQuery,
  type CreateContactPayload,
  type UpdateContactPayload,
  type UserRole,
} from '../../../contracts/src/index.ts';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { normalizeEmail, normalizePhone, stableKey } from '../lead/normalize.ts';
import { canAssignContacts } from '../auth/service.ts';

const CURSOR_VERSION = 1;
const CURSOR_TTL_MS = 24 * 60 * 60 * 1000;

export type ContactListResult = {
  contacts: ContactListItem[];
  next_cursor: string | null;
  applied_filters: {
    search?: string;
    classification?: string;
    lead_status?: string;
    source?: string;
    assigned_user_key?: string;
    sort: string;
  };
};

export class CrmDuplicateError extends Error {
  constructor(
    message: string,
    readonly existingContactId: string,
  ) {
    super(message);
  }
}

export class CrmVersionConflictError extends Error {
  constructor(readonly currentVersion: number) {
    super('Contact was updated by another session.');
  }
}

export class CrmCursorError extends Error {
  constructor() {
    super('CRM cursor is invalid for this query.');
  }
}

export class CrmAssigneeScopeError extends Error {
  constructor() {
    super('Assigned user is not active in this account and product.');
  }
}

export async function listContacts({
  pool,
  config,
  query,
}: {
  pool: DbPool;
  config: AppConfig;
  query: Partial<ContactListQuery>;
}): Promise<ContactListResult> {
  const parsed = contactListQuerySchema.parse(query);
  const params: unknown[] = [config.accountKey, config.productKey];
  const where = [
    'contacts.account_key = $1',
    'contacts.product_key = $2',
    'contacts.archived_at IS NULL',
  ];

  if (parsed.search) {
    params.push(`%${parsed.search.toLowerCase()}%`);
    where.push(
      `(lower(contacts.display_name) LIKE $${params.length}
        OR lower(contacts.family_or_school) LIKE $${params.length}
        OR lower(contacts.email_normalized) LIKE $${params.length}
        OR lower(COALESCE(contacts.phone_normalized, '')) LIKE $${params.length})`,
    );
  }
  if (parsed.classification) {
    params.push(parsed.classification);
    where.push(`contacts.family_school_classification = $${params.length}`);
  }
  if (parsed.lead_status) {
    params.push(parsed.lead_status);
    where.push(`contacts.lead_status = $${params.length}`);
  }
  if (parsed.source) {
    params.push(parsed.source);
    where.push(`contacts.source = $${params.length}`);
  }
  if (parsed.assigned_user_key) {
    await assertActiveAssignee(pool, config, parsed.assigned_user_key);
    params.push(parsed.assigned_user_key);
    where.push(`contacts.assigned_user_key = $${params.length}`);
  }

  const cursor = decodeCursor(config, cursorContext(config, parsed), parsed.cursor);
  if (cursor) {
    if (parsed.sort === 'name_asc') {
      params.push(cursor.value, cursor.contact_id);
      where.push(
        `(contacts.display_name > $${params.length - 1}
          OR (contacts.display_name = $${params.length - 1} AND contacts.contact_key > $${params.length}))`,
      );
    } else if (parsed.sort === 'created_desc') {
      params.push(cursor.value, cursor.contact_id);
      where.push(
        `(contacts.created_at < $${params.length - 1}
          OR (contacts.created_at = $${params.length - 1} AND contacts.contact_key < $${params.length}))`,
      );
    } else {
      params.push(cursor.value, cursor.contact_id);
      where.push(
        `(contacts.updated_at < $${params.length - 1}
          OR (contacts.updated_at = $${params.length - 1} AND contacts.contact_key < $${params.length}))`,
      );
    }
  }

  const orderBy =
    parsed.sort === 'name_asc'
      ? 'contacts.display_name ASC, contacts.contact_key ASC'
      : parsed.sort === 'created_desc'
        ? 'contacts.created_at DESC, contacts.contact_key DESC'
        : 'contacts.updated_at DESC, contacts.contact_key DESC';

  params.push(parsed.limit + 1);
  const result = await pool.query(
    `SELECT contacts.contact_key, contacts.display_name, contacts.family_school_classification,
            contacts.lead_status, contacts.email_normalized, contacts.phone_normalized,
            contacts.source, contacts.last_activity_at, contacts.updated_at, contacts.created_at,
            contacts.version, contacts.assigned_user_key, users.display_name AS assigned_name
       FROM onetime.contacts AS contacts
       LEFT JOIN onetime.account_users AS users
         ON users.account_key = contacts.account_key
        AND users.product_key = contacts.product_key
        AND users.user_key = contacts.assigned_user_key
        AND users.status = 'active'
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${params.length}`,
    params,
  );

  const rows = result.rows.slice(0, parsed.limit);
  const last = rows.at(-1);
  const cursorValue = last
    ? parsed.sort === 'name_asc'
      ? last.display_name
      : parsed.sort === 'created_desc'
        ? toIso(last.created_at)
        : toIso(last.updated_at)
    : null;

  const appliedFilters: ContactListResult['applied_filters'] = { sort: parsed.sort };
  if (parsed.search) appliedFilters.search = parsed.search;
  if (parsed.classification) appliedFilters.classification = parsed.classification;
  if (parsed.lead_status) appliedFilters.lead_status = parsed.lead_status;
  if (parsed.source) appliedFilters.source = parsed.source;
  if (parsed.assigned_user_key) appliedFilters.assigned_user_key = parsed.assigned_user_key;

  return {
    contacts: rows.map(rowToListItem),
    next_cursor:
      result.rows.length > parsed.limit && last && cursorValue
        ? encodeCursor(config, cursorContext(config, parsed), {
            value: cursorValue,
            contact_id: last.contact_key,
          })
        : null,
    applied_filters: appliedFilters,
  };
}

export async function getContactDetail({
  pool,
  config,
  contactId,
}: {
  pool: DbPool;
  config: AppConfig;
  contactId: string;
}): Promise<ContactDetail | null> {
  const result = await pool.query(
    `SELECT contacts.*, users.display_name AS assigned_name,
            leads.signup_key, leads.created_at AS signup_created_at
       FROM onetime.contacts AS contacts
       LEFT JOIN onetime.account_users AS users
         ON users.account_key = contacts.account_key
        AND users.product_key = contacts.product_key
        AND users.user_key = contacts.assigned_user_key
        AND users.status = 'active'
       LEFT JOIN onetime.signup_leads AS leads ON leads.contact_key = contacts.contact_key
      WHERE contacts.account_key = $1
        AND contacts.product_key = $2
        AND contacts.contact_key = $3
        AND contacts.archived_at IS NULL
      ORDER BY leads.created_at DESC
      LIMIT 1`,
    [config.accountKey, config.productKey, contactId],
  );
  const row = result.rows[0];
  return row ? rowToDetail(row) : null;
}

export async function createContact({
  pool,
  config,
  payload,
  actorUserKey,
  actorRole,
}: {
  pool: DbPool;
  config: AppConfig;
  payload: CreateContactPayload;
  actorUserKey: string;
  actorRole: UserRole;
}) {
  const parsed = createContactSchema.parse(payload);
  const email = normalizeEmail(parsed.email);
  const phone = normalizePhone(parsed.phone);
  const contactKey = stableKey('contact', [config.accountKey, config.productKey, email]);

  return inTransaction(pool, async (client) => {
    const assignedUserKey = canAssignContacts(actorRole)
      ? await assertActiveAssignee(client, config, parsed.assigned_user_key ?? null)
      : null;
    const duplicate = await findDuplicate(client, config, email, phone);
    if (duplicate) throw new CrmDuplicateError('A matching contact already exists.', duplicate);

    const result = await client.query(
      `INSERT INTO onetime.contacts
       (contact_key, account_key, product_key, display_name, family_school_classification,
        family_or_school, location_text, timezone, email_normalized, phone_normalized,
        reminder_preference, suppression_state, source, lead_status, assigned_user_key,
        internal_note, last_activity_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'none','suppressed_no_consent','manual_crm',$11,$12,$13,now())
       RETURNING *`,
      [
        contactKey,
        config.accountKey,
        config.productKey,
        parsed.display_name,
        parsed.family_school_classification,
        parsed.display_name,
        parsed.location,
        parsed.timezone,
        email,
        phone,
        parsed.lead_status,
        assignedUserKey,
        parsed.internal_note,
      ],
    );
    await insertCrmAudit(client, config, {
      contactKey,
      actorUserKey,
      eventType: 'crm_contact_created',
      metadata: { source: 'manual_crm', no_external_side_effects: true },
    });
    return rowToDetail(await attachAssignedName(client, config, result.rows[0]));
  });
}

export async function updateContact({
  pool,
  config,
  contactId,
  payload,
  actorUserKey,
  actorRole,
}: {
  pool: DbPool;
  config: AppConfig;
  contactId: string;
  payload: UpdateContactPayload;
  actorUserKey: string;
  actorRole: UserRole;
}) {
  const parsed = updateContactSchema.parse(payload);
  return inTransaction(pool, async (client) => {
    const current = await client.query(
      `SELECT * FROM onetime.contacts
        WHERE account_key = $1 AND product_key = $2 AND contact_key = $3 AND archived_at IS NULL
        FOR UPDATE`,
      [config.accountKey, config.productKey, contactId],
    );
    const row = current.rows[0];
    if (!row) return null;
    if (Number(row.version) !== parsed.version) {
      throw new CrmVersionConflictError(Number(row.version));
    }

    const nextEmail = parsed.email ? normalizeEmail(parsed.email) : row.email_normalized;
    const nextPhone =
      parsed.phone !== undefined ? normalizePhone(parsed.phone) : row.phone_normalized;
    const duplicate = await findDuplicate(client, config, nextEmail, nextPhone, contactId);
    if (duplicate) throw new CrmDuplicateError('A matching contact already exists.', duplicate);

    const assignedUserKey = canAssignContacts(actorRole)
      ? parsed.assigned_user_key === undefined
        ? row.assigned_user_key
        : await assertActiveAssignee(client, config, parsed.assigned_user_key || null)
      : row.assigned_user_key;

    const result = await client.query(
      `UPDATE onetime.contacts
          SET display_name = $4,
              family_school_classification = $5,
              family_or_school = $4,
              location_text = $6,
              timezone = $7,
              email_normalized = $8,
              phone_normalized = $9,
              lead_status = $10,
              assigned_user_key = $11,
              internal_note = $12,
              updated_at = now(),
              last_activity_at = now(),
              version = version + 1
        WHERE account_key = $1 AND product_key = $2 AND contact_key = $3
        RETURNING *`,
      [
        config.accountKey,
        config.productKey,
        contactId,
        parsed.display_name ?? row.display_name,
        parsed.family_school_classification ?? row.family_school_classification,
        parsed.location ?? row.location_text,
        parsed.timezone ?? row.timezone,
        nextEmail,
        nextPhone,
        parsed.lead_status ?? row.lead_status,
        assignedUserKey,
        parsed.internal_note ?? row.internal_note,
      ],
    );
    await insertCrmAudit(client, config, {
      contactKey: contactId,
      actorUserKey,
      eventType: 'crm_contact_updated',
      metadata: {
        changed_fields: changedFields(row, parsed, assignedUserKey),
        no_external_side_effects: true,
      },
    });
    return rowToDetail(await attachAssignedName(client, config, result.rows[0]));
  });
}

async function findDuplicate(
  client: Queryable,
  config: AppConfig,
  email: string,
  phone: string | null,
  excludeContactId?: string,
) {
  const params: unknown[] = [config.accountKey, config.productKey, email];
  const predicates = ['email_normalized = $3'];
  if (phone) {
    params.push(phone);
    predicates.push(`phone_normalized = $${params.length}`);
  }
  if (excludeContactId) {
    params.push(excludeContactId);
  }
  const result = await client.query(
    `SELECT contact_key
       FROM onetime.contacts
      WHERE account_key = $1
        AND product_key = $2
        AND (${predicates.join(' OR ')})
        ${excludeContactId ? `AND contact_key <> $${params.length}` : ''}
      LIMIT 1`,
    params,
  );
  return result.rows[0]?.contact_key as string | undefined;
}

async function insertCrmAudit(
  client: Queryable,
  config: AppConfig,
  event: {
    contactKey: string;
    actorUserKey: string;
    eventType: string;
    metadata: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO onetime.audit_events
     (event_key, account_key, product_key, contact_key, event_type, metadata)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [
      stableKey('audit', [
        config.accountKey,
        config.productKey,
        event.contactKey,
        event.eventType,
        randomUUID(),
      ]),
      config.accountKey,
      config.productKey,
      event.contactKey,
      event.eventType,
      JSON.stringify({ ...event.metadata, actor_user_key: event.actorUserKey }),
    ],
  );
}

function rowToListItem(row: Record<string, unknown>): ContactListItem {
  return {
    contact_id: String(row.contact_key),
    display_name: String(row.display_name),
    family_school_classification:
      row.family_school_classification as ContactListItem['family_school_classification'],
    lead_status: row.lead_status as ContactListItem['lead_status'],
    email: row.email_normalized ? String(row.email_normalized) : null,
    phone: row.phone_normalized ? String(row.phone_normalized) : null,
    source: String(row.source),
    assigned_team_member: row.assigned_name ? String(row.assigned_name) : null,
    last_activity_at: toIso(row.last_activity_at ?? row.updated_at),
    updated_at: toIso(row.updated_at),
    version: Number(row.version),
  };
}

function rowToDetail(row: Record<string, unknown>): ContactDetail {
  return {
    ...rowToListItem(row),
    location: String(row.location_text),
    timezone: String(row.timezone),
    reminder_preference: row.reminder_preference as ContactDetail['reminder_preference'],
    consent_state: row.consent_recorded_at ? 'recorded' : 'not_recorded',
    suppression_state: String(row.suppression_state),
    offer_version: row.offer_version ? String(row.offer_version) : null,
    content_version: row.content_version ? String(row.content_version) : null,
    created_at: toIso(row.created_at),
    audit_safe_signup_provenance: {
      source: String(row.source),
      signup_key: row.signup_key ? String(row.signup_key) : null,
      captured_at: row.signup_created_at ? toIso(row.signup_created_at) : null,
    },
    internal_note: String(row.internal_note ?? ''),
  };
}

function changedFields(
  current: Record<string, unknown>,
  next: UpdateContactPayload,
  assignedUserKey: string | null,
) {
  const fields: string[] = [];
  const comparisons: Array<[string, unknown, unknown]> = [
    ['display_name', current.display_name, next.display_name],
    [
      'family_school_classification',
      current.family_school_classification,
      next.family_school_classification,
    ],
    ['location_text', current.location_text, next.location],
    ['timezone', current.timezone, next.timezone],
    ['email_normalized', current.email_normalized, next.email && normalizeEmail(next.email)],
    [
      'phone_normalized',
      current.phone_normalized,
      next.phone !== undefined ? normalizePhone(next.phone) : undefined,
    ],
    ['lead_status', current.lead_status, next.lead_status],
    ['assigned_user_key', current.assigned_user_key, assignedUserKey],
    ['internal_note', current.internal_note, next.internal_note],
  ];
  for (const [name, before, after] of comparisons) {
    if (after !== undefined && String(before ?? '') !== String(after ?? '')) fields.push(name);
  }
  return fields;
}

async function assertActiveAssignee(
  target: DbPool | Queryable,
  config: AppConfig,
  assignedUserKey: string | null,
) {
  if (!assignedUserKey) return null;
  const result = await target.query(
    `SELECT user_key
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND status = 'active'
      LIMIT 1`,
    [config.accountKey, config.productKey, assignedUserKey],
  );
  if (!result.rowCount) throw new CrmAssigneeScopeError();
  return assignedUserKey;
}

async function attachAssignedName(
  target: Queryable,
  config: AppConfig,
  row: Record<string, unknown>,
) {
  if (!row.assigned_user_key) return row;
  const result = await target.query(
    `SELECT display_name
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND status = 'active'
      LIMIT 1`,
    [config.accountKey, config.productKey, row.assigned_user_key],
  );
  return { ...row, assigned_name: result.rows[0]?.display_name ?? null };
}

function encodeCursor(
  config: AppConfig,
  context: Record<string, unknown>,
  cursor: { value: unknown; contact_id: string },
) {
  const body = Buffer.from(
    JSON.stringify({
      v: CURSOR_VERSION,
      issued_at: new Date().toISOString(),
      context_hash: cursorContextHash(config, context),
      value: cursor.value,
      contact_id: cursor.contact_id,
    }),
    'utf8',
  ).toString('base64url');
  return `${body}.${signCursorBody(config, body)}`;
}

function decodeCursor(config: AppConfig, context: Record<string, unknown>, cursor?: string) {
  if (!cursor) return null;
  try {
    const [body, signature, extra] = cursor.split('.');
    if (!body || !signature || extra !== undefined) throw new CrmCursorError();
    if (!safeSignatureEquals(signature, signCursorBody(config, body))) {
      throw new CrmCursorError();
    }
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      v?: number;
      issued_at?: string;
      context_hash?: string;
      value?: string;
      contact_id?: string;
    };
    if (
      parsed.v !== CURSOR_VERSION ||
      parsed.context_hash !== cursorContextHash(config, context) ||
      !parsed.value ||
      !parsed.contact_id
    ) {
      throw new CrmCursorError();
    }
    const issuedAt = new Date(String(parsed.issued_at)).getTime();
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > CURSOR_TTL_MS) {
      throw new CrmCursorError();
    }
    return { value: parsed.value, contact_id: parsed.contact_id };
  } catch (error) {
    if (error instanceof CrmCursorError) throw error;
    throw new CrmCursorError();
  }
}

function cursorContext(config: AppConfig, query: ContactListQuery) {
  return {
    account_key: config.accountKey,
    product_key: config.productKey,
    sort: query.sort,
    limit: query.limit,
    search: query.search || '',
    classification: query.classification ?? '',
    lead_status: query.lead_status ?? '',
    source: query.source ?? '',
    assigned_user_key: query.assigned_user_key ?? '',
  };
}

function cursorContextHash(config: AppConfig, context: Record<string, unknown>) {
  return createHmac('sha256', config.crmCursorSecret)
    .update(JSON.stringify(context))
    .digest('base64url');
}

function signCursorBody(config: AppConfig, body: string) {
  return createHmac('sha256', config.crmCursorSecret).update(body).digest('base64url');
}

function safeSignatureEquals(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
