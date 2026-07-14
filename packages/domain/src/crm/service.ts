import { createHash, randomUUID } from 'node:crypto';
import {
  contactSearchCommandSchema,
  createContactSchema,
  updateContactSchema,
  type Assignee,
  type ContactDetail,
  type ContactListItem,
  type ContactSearchCommand,
  type CreateContactPayload,
  type UpdateContactPayload,
  type UserRole,
} from '../../../contracts/src/index.ts';
import type { AppConfig } from '../../../config/src/index.ts';
import type { DbPool, Queryable } from '../../../db/src/index.ts';
import { inTransaction } from '../../../db/src/index.ts';
import { normalizeEmail, normalizePhone, stableKey } from '../lead/normalize.ts';
import { canAssignContacts } from '../auth/service.ts';
import { IdempotencyConflictError } from '../lead/service.ts';

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

export async function listContacts({
  pool,
  config,
  query,
}: {
  pool: DbPool;
  config: AppConfig;
  query: Partial<ContactSearchCommand>;
}): Promise<ContactListResult> {
  const parsed = contactSearchCommandSchema.parse(query);
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
    params.push(parsed.assigned_user_key);
    where.push(`contacts.assigned_user_key = $${params.length}`);
  }

  const cursor = decodeCursor(parsed.cursor);
  if (cursor) {
    if (parsed.sort === 'name_asc') {
      params.push(cursor.value, cursor.contact_id);
      where.push(
        `(contacts.display_name > $${params.length - 1}
          OR (contacts.display_name = $${params.length - 1} AND contacts.public_contact_id > $${params.length}))`,
      );
    } else if (parsed.sort === 'created_desc') {
      params.push(cursor.value, cursor.contact_id);
      where.push(
        `(contacts.created_at < $${params.length - 1}
          OR (contacts.created_at = $${params.length - 1} AND contacts.public_contact_id < $${params.length}))`,
      );
    } else {
      params.push(cursor.value, cursor.contact_id);
      where.push(
        `(contacts.updated_at < $${params.length - 1}
          OR (contacts.updated_at = $${params.length - 1} AND contacts.public_contact_id < $${params.length}))`,
      );
    }
  }

  const orderBy =
    parsed.sort === 'name_asc'
      ? 'contacts.display_name ASC, contacts.public_contact_id ASC'
      : parsed.sort === 'created_desc'
        ? 'contacts.created_at DESC, contacts.public_contact_id DESC'
        : 'contacts.updated_at DESC, contacts.public_contact_id DESC';

  params.push(parsed.limit + 1);
  const result = await pool.query(
    `SELECT contacts.contact_key, contacts.public_contact_id, contacts.display_name, contacts.family_school_classification,
            contacts.lead_status, contacts.email_normalized, contacts.phone_normalized,
            contacts.source, contacts.last_activity_at, contacts.updated_at, contacts.created_at,
            contacts.version, contacts.assigned_user_key, users.display_name AS assigned_name
       FROM onetime.contacts AS contacts
       LEFT JOIN onetime.account_users AS users ON users.user_key = contacts.assigned_user_key
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
        ? encodeCursor({
            sort: parsed.sort,
            value: cursorValue,
            contact_id: last.public_contact_id,
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
       LEFT JOIN onetime.account_users AS users ON users.user_key = contacts.assigned_user_key
       LEFT JOIN onetime.signup_leads AS leads ON leads.contact_key = contacts.contact_key
      WHERE contacts.account_key = $1
        AND contacts.product_key = $2
        AND (contacts.public_contact_id = $3 OR contacts.contact_key = $3)
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
  const assignedUserKey = canAssignContacts(actorRole) ? (parsed.assigned_user_key ?? null) : null;
  const idempotencyKey = `crm_create:${parsed.idempotency_key}`;
  const reqHash = crmRequestHash(parsed);

  return inTransaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [advisoryLockValue(idempotencyKey)]);
    const replay = await client.query(
      `SELECT request_hash, response_json
         FROM onetime.idempotency_records
        WHERE account_key = $1 AND product_key = $2 AND idempotency_key = $3`,
      [config.accountKey, config.productKey, idempotencyKey],
    );
    if (replay.rowCount) {
      if (replay.rows[0].request_hash !== reqHash) throw new IdempotencyConflictError();
      return (replay.rows[0].response_json as { contact: ContactDetail }).contact;
    }

    await assertAssignableUser(client, config, assignedUserKey);
    const contactKey = `contact_${randomUUID()}`;
    const publicContactId = randomUUID();

    const result = await client.query(
      `INSERT INTO onetime.contacts
       (contact_key, public_contact_id, account_key, product_key, display_name, family_school_classification,
        family_or_school, location_text, timezone, email_normalized, phone_normalized,
        reminder_preference, suppression_state, source, lead_status, assigned_user_key,
        internal_note, last_activity_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'email','active','manual_crm',$12,$13,$14,now())
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        contactKey,
        publicContactId,
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
    if (!result.rowCount) {
      const duplicate = await findDuplicate(client, config, email, phone);
      throw new CrmDuplicateError('A matching contact already exists.', duplicate ?? '/app/crm');
    }
    await insertCrmAudit(client, config, {
      contactKey,
      actorUserKey,
      eventType: 'crm_contact_created',
      metadata: { source: 'manual_crm', no_external_side_effects: true },
    });
    const contact = rowToDetail(result.rows[0]);
    await client.query(
      `INSERT INTO onetime.idempotency_records
       (account_key, product_key, idempotency_key, request_hash, response_json)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [config.accountKey, config.productKey, idempotencyKey, reqHash, JSON.stringify({ contact })],
    );
    return contact;
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
        WHERE account_key = $1
          AND product_key = $2
          AND (public_contact_id = $3 OR contact_key = $3)
          AND archived_at IS NULL
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
    const duplicate = await findDuplicate(client, config, nextEmail, nextPhone, row.contact_key);
    if (duplicate) throw new CrmDuplicateError('A matching contact already exists.', duplicate);

    const assignedUserKey = canAssignContacts(actorRole)
      ? parsed.assigned_user_key === undefined
        ? row.assigned_user_key
        : parsed.assigned_user_key || null
      : row.assigned_user_key;
    await assertAssignableUser(client, config, assignedUserKey);

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
        row.contact_key,
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
      contactKey: row.contact_key,
      actorUserKey,
      eventType: 'crm_contact_updated',
      metadata: {
        changed_fields: changedFields(row, parsed, assignedUserKey),
        no_external_side_effects: true,
      },
    });
    return rowToDetail(result.rows[0]);
  });
}

export async function listAssignableUsers({
  pool,
  config,
}: {
  pool: DbPool;
  config: AppConfig;
}): Promise<Assignee[]> {
  const result = await pool.query(
    `SELECT user_key, display_name, role
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND status = 'active'
        AND role IN ('owner', 'admin', 'crm_agent')
      ORDER BY display_name ASC, user_key ASC
      LIMIT 50`,
    [config.accountKey, config.productKey],
  );
  return result.rows.map((row) => {
    const role = row.role as UserRole;
    return {
      user_key: String(row.user_key),
      display_name: String(row.display_name),
      role,
      role_label: role === 'crm_agent' ? 'CRM Agent' : 'Administrator',
    };
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
    `SELECT public_contact_id
       FROM onetime.contacts
      WHERE account_key = $1
        AND product_key = $2
        AND (${predicates.join(' OR ')})
        ${excludeContactId ? `AND contact_key <> $${params.length}` : ''}
      LIMIT 1`,
    params,
  );
  return result.rows[0]?.public_contact_id as string | undefined;
}

async function assertAssignableUser(client: Queryable, config: AppConfig, userKey: string | null) {
  if (!userKey) return;
  const result = await client.query(
    `SELECT 1
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND user_key = $3
        AND status = 'active'
        AND role IN ('owner', 'admin', 'crm_agent')`,
    [config.accountKey, config.productKey, userKey],
  );
  if (!result.rowCount) throw new CrmDuplicateError('Assignee was not found.', '/app/crm');
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
    contact_id: String(row.public_contact_id ?? row.contact_key),
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

function encodeCursor(cursor: { sort: string; value: unknown; contact_id: string }) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      sort?: string;
      value?: string;
      contact_id?: string;
    };
    if (!parsed.value || !parsed.contact_id) return null;
    return { value: parsed.value, contact_id: parsed.contact_id };
  } catch {
    return null;
  }
}

function crmRequestHash(payload: CreateContactPayload) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        display_name: payload.display_name.trim(),
        family_school_classification: payload.family_school_classification,
        email: normalizeEmail(payload.email),
        phone: normalizePhone(payload.phone),
        location: payload.location.trim(),
        timezone: payload.timezone,
        lead_status: payload.lead_status,
        assigned_user_key: payload.assigned_user_key ?? null,
        internal_note: payload.internal_note ?? '',
      }),
    )
    .digest('hex');
}

function advisoryLockValue(value: string) {
  const digest = createHash('sha256').update(value).digest();
  return digest.readInt32BE(0);
}

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
