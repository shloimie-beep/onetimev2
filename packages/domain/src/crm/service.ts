import { createHash, randomUUID } from 'node:crypto';
import {
  contactSearchCommandSchema,
  createContactSchema,
  updateContactSchema,
  type Assignee,
  type ContactDetail,
  type ContactListItem,
  type ContactNote,
  type ContactRelationship,
  type ContactSupportTicket,
  type ContactSystemFact,
  type ContactTag,
  type ContactTask,
  type ContactTimelineItem,
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

export class CrmReplyError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
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
  const where = ['contacts.account_key = $1', 'contacts.product_key = $2'];
  where.push(
    parsed.lead_status === 'archived'
      ? 'contacts.archived_at IS NOT NULL'
      : 'contacts.archived_at IS NULL',
  );

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

  const hydration = await hydrateContactList(pool, config, rows);

  return {
    contacts: rows.map((row) =>
      rowToListItem(
        row,
        hydration.tags.get(String(row.contact_key)) ?? [],
        hydration.facts.get(String(row.contact_key)) ?? [],
      ),
    ),
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
      ORDER BY leads.created_at DESC
      LIMIT 1`,
    [config.accountKey, config.productKey, contactId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const hydration = await hydrateContactList(pool, config, [row]);
  const detail = await hydrateContactDetail(pool, config, row);
  return rowToDetail(
    row,
    hydration.tags.get(String(row.contact_key)) ?? [],
    hydration.facts.get(String(row.contact_key)) ?? [],
    detail,
  );
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
    if (parsed.internal_note) {
      await insertContactNote(client, config, {
        contactKey,
        actorUserKey,
        body: parsed.internal_note,
        source: 'manual_crm',
      });
    }
    const contact = rowToDetail(result.rows[0], [], systemFactsForContact(result.rows[0], []));
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
    const hydration = await hydrateContactList(client, config, [result.rows[0]]);
    const detail = await hydrateContactDetail(client, config, result.rows[0]);
    return rowToDetail(
      result.rows[0],
      hydration.tags.get(String(row.contact_key)) ?? [],
      hydration.facts.get(String(row.contact_key)) ?? [],
      detail,
    );
  });
}

export async function archiveContact({
  pool,
  config,
  contactId,
  actorUserKey,
  reason,
}: {
  pool: DbPool;
  config: AppConfig;
  contactId: string;
  actorUserKey: string;
  reason?: string | undefined;
}) {
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `UPDATE onetime.contacts
          SET archived_at = now(),
              archived_by_user_key = $4,
              archive_reason = $5,
              prior_lead_status = lead_status,
              lead_status = 'archived',
              updated_at = now(),
              version = version + 1
        WHERE account_key = $1
          AND product_key = $2
          AND (public_contact_id = $3 OR contact_key = $3)
          AND archived_at IS NULL
        RETURNING *`,
      [config.accountKey, config.productKey, contactId, actorUserKey, reason ?? 'operator_archive'],
    );
    const row = result.rows[0];
    if (!row) return null;
    await insertCrmAudit(client, config, {
      contactKey: String(row.contact_key),
      actorUserKey,
      eventType: 'crm_contact_archived',
      metadata: { reason: reason ?? 'operator_archive', no_external_side_effects: true },
    });
    return { contact_id: String(row.public_contact_id), archived: true };
  });
}

export async function reactivateContact({
  pool,
  config,
  contactId,
  actorUserKey,
}: {
  pool: DbPool;
  config: AppConfig;
  contactId: string;
  actorUserKey: string;
}) {
  return inTransaction(pool, async (client) => {
    const result = await client.query(
      `UPDATE onetime.contacts
          SET archived_at = NULL,
              archived_by_user_key = NULL,
              archive_reason = NULL,
              lead_status = CASE
                WHEN prior_lead_status IN ('new', 'in_review', 'contacted', 'scheduled', 'closed')
                  THEN prior_lead_status
                ELSE 'new'
              END,
              prior_lead_status = NULL,
              reactivated_at = now(),
              reactivated_by_user_key = $4,
              updated_at = now(),
              last_activity_at = now(),
              version = version + 1
        WHERE account_key = $1
          AND product_key = $2
          AND (public_contact_id = $3 OR contact_key = $3)
          AND archived_at IS NOT NULL
        RETURNING *`,
      [config.accountKey, config.productKey, contactId, actorUserKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    await insertCrmAudit(client, config, {
      contactKey: String(row.contact_key),
      actorUserKey,
      eventType: 'crm_contact_reactivated',
      metadata: { no_external_side_effects: true },
    });
    return { contact_id: String(row.public_contact_id), reactivated: true };
  });
}

export async function appendContactNote({
  pool,
  config,
  contactId,
  body,
  actorUserKey,
}: {
  pool: DbPool;
  config: AppConfig;
  contactId: string;
  body: string;
  actorUserKey: string;
}) {
  const noteBody = body.trim();
  if (!noteBody) throw new CrmReplyError('VALIDATION_ERROR', 400, 'Note cannot be empty.');
  return inTransaction(pool, async (client) => {
    const contact = await findContactRow(client, config, contactId, true);
    if (!contact) return null;
    const note = await insertContactNote(client, config, {
      contactKey: String(contact.contact_key),
      actorUserKey,
      body: noteBody.slice(0, 4000),
      source: 'manual_crm',
    });
    await client.query(
      `UPDATE onetime.contacts
          SET updated_at = now(), last_activity_at = now(), version = version + 1
        WHERE account_key = $1 AND product_key = $2 AND contact_key = $3`,
      [config.accountKey, config.productKey, contact.contact_key],
    );
    await insertCrmAudit(client, config, {
      contactKey: String(contact.contact_key),
      actorUserKey,
      eventType: 'crm_contact_note_appended',
      metadata: { note_key: note.note_id, no_external_side_effects: true },
    });
    return note;
  });
}

export async function listCrmTags({ pool, config }: { pool: DbPool; config: AppConfig }) {
  const result = await pool.query(
    `SELECT tag_key, display_name, visual_token, version
       FROM onetime.crm_tags
      WHERE account_key = $1
        AND product_key = $2
        AND archived_at IS NULL
      ORDER BY lower(display_name) ASC, tag_key ASC`,
    [config.accountKey, config.productKey],
  );
  return result.rows.map((row) => ({
    tag_id: String(row.tag_key),
    display_name: String(row.display_name),
    visual_token: row.visual_token ? String(row.visual_token) : null,
    version: Number(row.version),
  }));
}

export async function createCrmTag({
  pool,
  config,
  displayName,
  actorUserKey,
}: {
  pool: DbPool;
  config: AppConfig;
  displayName: string;
  actorUserKey: string;
}) {
  const normalized = normalizeTagName(displayName);
  if (!normalized) throw new CrmReplyError('VALIDATION_ERROR', 400, 'Tag name is required.');
  const tagKey = `tag_${randomUUID()}`;
  const inserted = await pool.query(
    `INSERT INTO onetime.crm_tags
       (tag_key, account_key, product_key, display_name, normalized_name,
        visual_token, created_by_user_key, updated_by_user_key)
     VALUES ($1,$2,$3,$4,$5,'yellow',$6,$6)
      ON CONFLICT DO NOTHING
      RETURNING tag_key, display_name, visual_token, version`,
    [
      tagKey,
      config.accountKey,
      config.productKey,
      displayName.trim().slice(0, 60),
      normalized,
      actorUserKey,
    ],
  );
  const result = inserted.rowCount
    ? inserted
    : await pool.query(
        `SELECT tag_key, display_name, visual_token, version
           FROM onetime.crm_tags
          WHERE account_key = $1
            AND product_key = $2
            AND normalized_name = $3
            AND archived_at IS NULL
          LIMIT 1`,
        [config.accountKey, config.productKey, normalized],
      );
  const row = result.rows[0];
  return {
    tag_id: String(row.tag_key),
    display_name: String(row.display_name),
    visual_token: row.visual_token ? String(row.visual_token) : null,
    version: Number(row.version),
  };
}

export async function assignCrmTag({
  pool,
  config,
  contactId,
  tagId,
  actorUserKey,
}: {
  pool: DbPool;
  config: AppConfig;
  contactId: string;
  tagId: string;
  actorUserKey: string;
}) {
  return inTransaction(pool, async (client) => {
    const contact = await findContactRow(client, config, contactId, true);
    if (!contact) return null;
    const tag = await findTagRow(client, config, tagId);
    if (!tag) throw new CrmReplyError('TAG_NOT_FOUND', 404, 'Tag was not found.');
    await client.query(
      `INSERT INTO onetime.crm_contact_tags
       (assignment_key, account_key, product_key, contact_key, tag_key, assigned_by_user_key)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [
        `tag_assignment_${randomUUID()}`,
        config.accountKey,
        config.productKey,
        contact.contact_key,
        tag.tag_key,
        actorUserKey,
      ],
    );
    await insertCrmAudit(client, config, {
      contactKey: String(contact.contact_key),
      actorUserKey,
      eventType: 'crm_contact_tag_assigned',
      metadata: { tag_key: tag.tag_key, no_external_side_effects: true },
    });
    return { assigned: true };
  });
}

export async function removeCrmTag({
  pool,
  config,
  contactId,
  tagId,
  actorUserKey,
}: {
  pool: DbPool;
  config: AppConfig;
  contactId: string;
  tagId: string;
  actorUserKey: string;
}) {
  return inTransaction(pool, async (client) => {
    const contact = await findContactRow(client, config, contactId, true);
    if (!contact) return null;
    const tag = await findTagRow(client, config, tagId);
    if (!tag) throw new CrmReplyError('TAG_NOT_FOUND', 404, 'Tag was not found.');
    await client.query(
      `UPDATE onetime.crm_contact_tags
          SET removed_at = now(), removed_by_user_key = $5, version = version + 1
        WHERE account_key = $1
          AND product_key = $2
          AND contact_key = $3
          AND tag_key = $4
          AND removed_at IS NULL`,
      [config.accountKey, config.productKey, contact.contact_key, tag.tag_key, actorUserKey],
    );
    await insertCrmAudit(client, config, {
      contactKey: String(contact.contact_key),
      actorUserKey,
      eventType: 'crm_contact_tag_removed',
      metadata: { tag_key: tag.tag_key, no_external_side_effects: true },
    });
    return { removed: true };
  });
}

export async function previewSingleRecipientReply({
  pool,
  config,
  contactId,
  channel,
  body,
}: {
  pool: DbPool;
  config: AppConfig;
  contactId: string;
  channel: 'email' | 'whatsapp';
  body: string;
}) {
  const contact = await findContactRow(pool, config, contactId, false);
  if (!contact) return null;
  const bodyText = body.trim();
  if (bodyText.length < 2 || bodyText.length > 4000) {
    throw new CrmReplyError('VALIDATION_ERROR', 400, 'Reply body must be 2 to 4000 characters.');
  }
  const blockers = replyBlockers(contact, channel);
  const destinationMasked = maskedReplyDestination(contact, channel);
  const bodyRevision = sha256Hex(bodyText).slice(0, 16);
  return {
    success: true,
    preview: {
      preview_id: `preview_${bodyRevision}`,
      contact_id: String(contact.public_contact_id),
      channel,
      destination_masked: destinationMasked,
      body_revision: bodyRevision,
      provider_ready: false,
      external_send_allowed: false,
      confirmation_required: blockers.length === 0,
      send_mode: 'provider_off_draft',
      blockers,
      message:
        blockers.length === 0
          ? 'Provider transport is off. Confirmation saves a draft only and does not send externally.'
          : 'Resolve the listed blockers before saving a reply draft.',
    },
  };
}

export async function confirmSingleRecipientReply({
  pool,
  config,
  contactId,
  channel,
  body,
  bodyRevision,
  idempotencyKey,
  actorUserKey,
}: {
  pool: DbPool;
  config: AppConfig;
  contactId: string;
  channel: 'email' | 'whatsapp';
  body: string;
  bodyRevision: string;
  idempotencyKey: string;
  actorUserKey: string;
}) {
  const bodyText = body.trim();
  const expectedRevision = sha256Hex(bodyText).slice(0, 16);
  if (bodyRevision !== expectedRevision) {
    throw new CrmReplyError('BODY_REVISION_MISMATCH', 409, 'Preview the current reply body again.');
  }
  return inTransaction(pool, async (client) => {
    const contact = await findContactRow(client, config, contactId, true);
    if (!contact) return null;
    const blockers = replyBlockers(contact, channel);
    if (blockers.length > 0) {
      throw new CrmReplyError('REPLY_BLOCKED', 409, blockers[0] ?? 'Reply is blocked.');
    }
    const replay = await client.query(
      `SELECT draft_key, destination_masked, body_revision, outbox_delivery_key
         FROM onetime.crm_reply_drafts
        WHERE account_key = $1
          AND product_key = $2
          AND actor_user_key = $3
          AND idempotency_key = $4
        LIMIT 1`,
      [config.accountKey, config.productKey, actorUserKey, idempotencyKey],
    );
    if (replay.rowCount) {
      const row = replay.rows[0];
      return replyConfirmationBody(row);
    }
    const draftKey = `reply_${randomUUID()}`;
    const deliveryKey = `reply_draft_${randomUUID()}`;
    const destinationMasked = maskedReplyDestination(contact, channel);
    const previewFingerprint = sha256Hex(
      stableJson({
        contact_key: contact.contact_key,
        channel,
        destination_masked: destinationMasked,
        body_revision: bodyRevision,
      }),
    );
    await client.query(
      `INSERT INTO onetime.crm_reply_drafts
       (draft_key, account_key, product_key, contact_key, channel, destination_masked,
        body_revision, body_text, preview_fingerprint, idempotency_key, actor_user_key,
        outbox_delivery_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        draftKey,
        config.accountKey,
        config.productKey,
        contact.contact_key,
        channel,
        destinationMasked,
        bodyRevision,
        bodyText,
        previewFingerprint,
        idempotencyKey,
        actorUserKey,
        deliveryKey,
      ],
    );
    await client.query(
      `INSERT INTO onetime.outbox_events
       (delivery_key, account_key, product_key, contact_key, event_type, channel,
        transport_mode, payload, status)
       VALUES ($1,$2,$3,$4,'crm_single_recipient_reply_draft.v1',$5,'sink',$6::jsonb,'pending')`,
      [
        deliveryKey,
        config.accountKey,
        config.productKey,
        contact.contact_key,
        channel,
        JSON.stringify({
          draft_key: draftKey,
          destination_masked: destinationMasked,
          body_revision: bodyRevision,
          external_send_attempted: false,
        }),
      ],
    );
    await insertCrmAudit(client, config, {
      contactKey: String(contact.contact_key),
      actorUserKey,
      eventType: 'crm_single_recipient_reply_draft_saved',
      metadata: {
        draft_key: draftKey,
        channel,
        body_revision: bodyRevision,
        external_send_attempted: false,
      },
    });
    return replyConfirmationBody({
      draft_key: draftKey,
      destination_masked: destinationMasked,
      body_revision: bodyRevision,
      outbox_delivery_key: deliveryKey,
    });
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

async function findContactRow(
  target: Queryable,
  config: AppConfig,
  contactId: string,
  forUpdate: boolean,
) {
  const result = await target.query(
    `SELECT *
       FROM onetime.contacts
      WHERE account_key = $1
        AND product_key = $2
        AND (public_contact_id = $3 OR contact_key = $3)
        AND archived_at IS NULL
      ${forUpdate ? 'FOR UPDATE' : ''}`,
    [config.accountKey, config.productKey, contactId],
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

async function findTagRow(target: Queryable, config: AppConfig, tagId: string) {
  const result = await target.query(
    `SELECT *
       FROM onetime.crm_tags
      WHERE account_key = $1
        AND product_key = $2
        AND tag_key = $3
        AND archived_at IS NULL
      LIMIT 1`,
    [config.accountKey, config.productKey, tagId],
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

async function hydrateContactList(
  target: Queryable,
  config: AppConfig,
  rows: Record<string, unknown>[],
) {
  const contactKeys = rows.map((row) => String(row.contact_key)).filter(Boolean);
  const tags = new Map<string, ContactTag[]>();
  const explicitFacts = new Map<string, ContactSystemFact[]>();
  if (contactKeys.length === 0) return { tags, facts: explicitFacts };

  const tagRows = await target.query(
    `SELECT assignments.contact_key, tags.tag_key, tags.display_name, tags.visual_token
       FROM onetime.crm_contact_tags AS assignments
       JOIN onetime.crm_tags AS tags
         ON tags.account_key = assignments.account_key
        AND tags.product_key = assignments.product_key
        AND tags.tag_key = assignments.tag_key
      WHERE assignments.account_key = $1
        AND assignments.product_key = $2
        AND assignments.contact_key = ANY($3::text[])
        AND assignments.removed_at IS NULL
        AND tags.archived_at IS NULL
      ORDER BY tags.display_name ASC`,
    [config.accountKey, config.productKey, contactKeys],
  );
  for (const row of tagRows.rows) {
    const key = String(row.contact_key);
    const list = tags.get(key) ?? [];
    list.push({
      tag_id: String(row.tag_key),
      display_name: String(row.display_name),
      visual_token: row.visual_token ? String(row.visual_token) : null,
    });
    tags.set(key, list);
  }

  const factRows = await target.query(
    `SELECT contact_key, dimension, value_code, source
       FROM onetime.crm_contact_facts
      WHERE account_key = $1
        AND product_key = $2
        AND contact_key = ANY($3::text[])
        AND ended_at IS NULL
      ORDER BY dimension ASC, value_code ASC`,
    [config.accountKey, config.productKey, contactKeys],
  );
  for (const row of factRows.rows) {
    const key = String(row.contact_key);
    const list = explicitFacts.get(key) ?? [];
    list.push(systemFact(String(row.dimension), String(row.value_code), String(row.source)));
    explicitFacts.set(key, list);
  }

  const userRows = await target.query(
    `SELECT email_normalized, role
       FROM onetime.account_users
      WHERE account_key = $1
        AND product_key = $2
        AND status = 'active'
        AND email_normalized = ANY($3::text[])`,
    [
      config.accountKey,
      config.productKey,
      rows.map((row) => String(row.email_normalized ?? '')).filter(Boolean),
    ],
  );
  const rolesByEmail = new Map<string, string[]>();
  for (const row of userRows.rows) {
    const email = String(row.email_normalized);
    const list = rolesByEmail.get(email) ?? [];
    list.push(String(row.role));
    rolesByEmail.set(email, list);
  }

  const subscriberRows = await target.query(
    `SELECT DISTINCT users.email_normalized
       FROM onetime.account_users AS users
       JOIN onetime.portal_guardian_relationships AS guardians
         ON guardians.account_key = users.account_key
        AND guardians.product_key = users.product_key
        AND guardians.guardian_user_ref = users.user_key
        AND guardians.status = 'active'
       JOIN onetime.account_access_projections AS access
         ON access.account_key = guardians.account_key
        AND access.product_key = guardians.product_key
        AND access.household_key = guardians.household_key
        AND access.state IN ('active', 'grace', 'scheduled_end')
        AND access.effective_at <= $4
        AND (access.expires_at IS NULL OR access.expires_at > $4)
      WHERE users.account_key = $1
        AND users.product_key = $2
        AND users.status = 'active'
        AND users.email_normalized = ANY($3::text[])`,
    [
      config.accountKey,
      config.productKey,
      rows.map((row) => String(row.email_normalized ?? '')).filter(Boolean),
      new Date(),
    ],
  );
  const subscriberEmails = new Set(subscriberRows.rows.map((row) => String(row.email_normalized)));

  const facts = new Map<string, ContactSystemFact[]>();
  for (const row of rows) {
    const contactKey = String(row.contact_key);
    facts.set(contactKey, [
      ...systemFactsForContact(row, rolesByEmail.get(String(row.email_normalized)) ?? []),
      ...(subscriberEmails.has(String(row.email_normalized))
        ? [systemFact('subscriber', 'active', 'account_access_projection')]
        : []),
      ...(explicitFacts.get(contactKey) ?? []),
    ]);
  }
  return { tags, facts };
}

async function hydrateContactDetail(
  target: Queryable,
  config: AppConfig,
  row: Record<string, unknown>,
): Promise<{
  enrollment_summary: ContactDetail['enrollment_summary'];
  managed_household: ContactDetail['managed_household'];
  relationships: ContactRelationship[];
  notes: ContactNote[];
  tasks: ContactTask[];
  support_tickets: ContactSupportTicket[];
  timeline: ContactTimelineItem[];
}> {
  const contactKey = String(row.contact_key);
  const email = String(row.email_normalized ?? '');
  const user = email
    ? await target.query(
        `SELECT user_key, role, status
           FROM onetime.account_users
          WHERE account_key = $1
            AND product_key = $2
            AND email_normalized = $3
          ORDER BY created_at DESC
          LIMIT 1`,
        [config.accountKey, config.productKey, email],
      )
    : { rows: [] };
  const userKey = user.rows[0]?.user_key ? String(user.rows[0].user_key) : null;

  const [
    relationshipRows,
    noteRows,
    taskRows,
    supportRows,
    outboxRows,
    auditRows,
    managedHouseholdRows,
  ] = await Promise.all([
    target.query(
      `SELECT relationships.relationship_key, relationships.relationship_type, relationships.label,
                target.public_contact_id, target.display_name
           FROM onetime.crm_relationships AS relationships
           JOIN onetime.contacts AS target
             ON target.account_key = relationships.account_key
            AND target.product_key = relationships.product_key
            AND target.contact_key = relationships.target_contact_key
          WHERE relationships.account_key = $1
            AND relationships.product_key = $2
            AND relationships.source_contact_key = $3
            AND relationships.unlinked_at IS NULL
          ORDER BY relationships.updated_at DESC
          LIMIT 20`,
      [config.accountKey, config.productKey, contactKey],
    ),
    target.query(
      `SELECT notes.note_key, notes.body, notes.source, notes.created_at,
                users.display_name AS author_name
           FROM onetime.crm_contact_notes AS notes
           LEFT JOIN onetime.account_users AS users ON users.user_key = notes.author_user_key
          WHERE notes.account_key = $1
            AND notes.product_key = $2
            AND notes.contact_key = $3
          ORDER BY notes.created_at DESC, notes.note_key DESC
          LIMIT 20`,
      [config.accountKey, config.productKey, contactKey],
    ),
    target.query(
      `SELECT tasks.task_key, tasks.title, tasks.detail, tasks.status, tasks.due_at,
                users.display_name AS owner_name
           FROM onetime.crm_tasks AS tasks
           LEFT JOIN onetime.account_users AS users ON users.user_key = tasks.owner_user_key
          WHERE tasks.account_key = $1
            AND tasks.product_key = $2
            AND tasks.contact_key = $3
          ORDER BY tasks.due_at ASC, tasks.task_key ASC
          LIMIT 20`,
      [config.accountKey, config.productKey, contactKey],
    ),
    userKey
      ? target.query(
          `SELECT receipt_id, status, delivery_state, public_summary, updated_at
               FROM onetime.support_status_projection
              WHERE account_key = $1
                AND product_key = $2
                AND actor_user_key = $3
              ORDER BY updated_at DESC
              LIMIT 10`,
          [config.accountKey, config.productKey, userKey],
        )
      : Promise.resolve({ rows: [] }),
    target.query(
      `SELECT delivery_key, event_type, channel, status, created_at, delivered_at, payload
           FROM onetime.outbox_events
          WHERE account_key = $1
            AND product_key = $2
            AND contact_key = $3
          ORDER BY created_at DESC
          LIMIT 20`,
      [config.accountKey, config.productKey, contactKey],
    ),
    target.query(
      `SELECT event_key, event_type, metadata, created_at
           FROM onetime.audit_events
          WHERE account_key = $1
            AND product_key = $2
            AND contact_key = $3
          ORDER BY created_at DESC
          LIMIT 20`,
      [config.accountKey, config.productKey, contactKey],
    ),
    target.query(
      `SELECT links.household_key, households.display_name
           FROM onetime.adult_household_contact_links AS links
           JOIN onetime.portal_households AS households
             ON households.account_key = links.account_key
            AND households.product_key = links.product_key
            AND households.household_key = links.household_key
          WHERE links.account_key = $1
            AND links.product_key = $2
            AND links.contact_key = $3
            AND households.status = 'active'
          LIMIT 2`,
      [config.accountKey, config.productKey, contactKey],
    ),
  ]);

  const relationships = relationshipRows.rows.map((item) => ({
    relationship_id: String(item.relationship_key),
    contact_id: String(item.public_contact_id),
    display_name: String(item.display_name),
    type: String(item.relationship_type),
    label: item.label ? String(item.label) : null,
  }));
  const notes = noteRows.rows.map((item) => ({
    note_id: String(item.note_key),
    body: String(item.body),
    author_label: item.author_name ? String(item.author_name) : 'System',
    source: String(item.source),
    created_at: toIso(item.created_at),
  }));
  const tasks = taskRows.rows.map((item) => ({
    task_id: String(item.task_key),
    title: String(item.title),
    detail: item.detail ? String(item.detail) : null,
    status: String(item.status),
    owner_label: item.owner_name ? String(item.owner_name) : 'Unassigned',
    due_at: toIso(item.due_at),
  }));
  const support_tickets = supportRows.rows.map((item) => ({
    receipt_id: String(item.receipt_id),
    status: String(item.status),
    delivery_state: String(item.delivery_state),
    public_summary: String(item.public_summary),
    updated_at: toIso(item.updated_at),
  }));
  const enrollment_summary = [
    userKey
      ? {
          label: 'Account access',
          value: `${readableState(String(user.rows[0]?.role ?? 'user'))} ${readableState(
            String(user.rows[0]?.status ?? 'active'),
          )}`,
        }
      : { label: 'Account access', value: 'No activated account matched' },
    {
      label: 'Support tickets',
      value: support_tickets.length ? `${support_tickets.length} ticket(s)` : 'None',
    },
  ];
  const managed_household =
    managedHouseholdRows.rows.length === 1
      ? {
          household_key: String(managedHouseholdRows.rows[0]?.household_key),
          display_name: String(managedHouseholdRows.rows[0]?.display_name),
        }
      : null;
  const timeline = [
    ...outboxRows.rows.map((item) => ({
      timeline_id: String(item.delivery_key),
      occurred_at: toIso(item.created_at),
      kind: 'communication' as const,
      label: communicationLabel(String(item.event_type)),
      status_label: communicationStatusLabel(String(item.status)),
      channel: String(item.channel),
      detail: communicationDetail(item),
    })),
    ...notes.map((item) => ({
      timeline_id: item.note_id,
      occurred_at: item.created_at,
      kind: 'note' as const,
      label: 'Internal note',
      status_label: readableState(item.source),
      channel: null,
      detail: item.body,
    })),
    ...support_tickets.map((item) => ({
      timeline_id: item.receipt_id,
      occurred_at: item.updated_at,
      kind: 'support' as const,
      label: 'Support ticket',
      status_label: readableState(item.delivery_state),
      channel: null,
      detail: item.public_summary,
    })),
    ...tasks.map((item) => ({
      timeline_id: item.task_id,
      occurred_at: item.due_at,
      kind: 'task' as const,
      label: item.title,
      status_label: readableState(item.status),
      channel: null,
      detail: item.detail ?? '',
    })),
    ...auditRows.rows.map((item) => ({
      timeline_id: String(item.event_key),
      occurred_at: toIso(item.created_at),
      kind: 'audit' as const,
      label: readableState(String(item.event_type)),
      status_label: 'Recorded',
      channel: null,
      detail: '',
    })),
  ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  return {
    enrollment_summary,
    managed_household,
    relationships,
    notes,
    tasks,
    support_tickets,
    timeline,
  };
}

async function insertContactNote(
  client: Queryable,
  config: AppConfig,
  note: {
    contactKey: string;
    actorUserKey: string;
    body: string;
    source: 'manual_crm' | 'legacy_scalar_backfill';
  },
): Promise<ContactNote> {
  const noteKey = `note_${randomUUID()}`;
  const result = await client.query(
    `INSERT INTO onetime.crm_contact_notes
     (note_key, account_key, product_key, contact_key, body, author_user_key, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING note_key, body, source, created_at`,
    [
      noteKey,
      config.accountKey,
      config.productKey,
      note.contactKey,
      note.body,
      note.actorUserKey,
      note.source,
    ],
  );
  const row = result.rows[0];
  return {
    note_id: String(row.note_key),
    body: String(row.body),
    author_label: 'You',
    source: String(row.source),
    created_at: toIso(row.created_at),
  };
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

function rowToListItem(
  row: Record<string, unknown>,
  tags: ContactTag[],
  systemFacts: ContactSystemFact[],
): ContactListItem {
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
    tags,
    system_facts: systemFacts,
    last_activity_at: toIso(row.last_activity_at ?? row.updated_at),
    updated_at: toIso(row.updated_at),
    version: Number(row.version),
  };
}

function rowToDetail(
  row: Record<string, unknown>,
  tags: ContactTag[],
  systemFacts: ContactSystemFact[],
  detail: Partial<
    Pick<
      ContactDetail,
      | 'enrollment_summary'
      | 'managed_household'
      | 'relationships'
      | 'notes'
      | 'tasks'
      | 'support_tickets'
      | 'timeline'
    >
  > = {},
): ContactDetail {
  return {
    ...rowToListItem(row, tags, systemFacts),
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
    enrollment_summary: detail.enrollment_summary ?? [],
    managed_household: detail.managed_household ?? null,
    relationships: detail.relationships ?? [],
    notes: detail.notes ?? [],
    tasks: detail.tasks ?? [],
    support_tickets: detail.support_tickets ?? [],
    timeline: detail.timeline ?? [],
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

function systemFactsForContact(row: Record<string, unknown>, roles: string[]): ContactSystemFact[] {
  const facts = [
    systemFact('lead', String(row.lead_status ?? 'new'), 'crm_contact'),
    systemFact('source', String(row.source ?? 'unknown'), 'crm_contact'),
  ];
  if (row.signup_key) facts.push(systemFact('signup', 'captured', 'signup_leads'));
  if (row.family_school_classification === 'school') {
    facts.push(systemFact('school_lead', 'true', 'crm_contact'));
  }
  if (roles.includes('parent')) facts.push(systemFact('parent_relationship', 'active', 'auth'));
  if (roles.includes('student')) facts.push(systemFact('student_relationship', 'active', 'auth'));
  if (roles.length > 0) facts.push(systemFact('activated', 'true', 'auth'));
  return facts;
}

function systemFact(dimension: string, value: string, source: string): ContactSystemFact {
  return {
    dimension,
    value,
    source,
    label: `${readableState(dimension)}: ${readableState(value)}`,
  };
}

function normalizeTagName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 60);
}

function replyBlockers(row: Record<string, unknown>, channel: 'email' | 'whatsapp') {
  const blockers: string[] = [];
  const suppression = String(row.suppression_state ?? 'unknown');
  if (suppression !== 'active')
    blockers.push(`Suppression state is ${readableState(suppression)}.`);
  if (channel === 'email' && !row.email_normalized) blockers.push('Email destination is missing.');
  if (channel === 'whatsapp' && !row.phone_normalized) {
    blockers.push('WhatsApp destination is missing.');
  }
  const preference = String(row.reminder_preference ?? 'none');
  if (channel === 'email' && !['email', 'both'].includes(preference)) {
    blockers.push('Email is not the recorded reply preference.');
  }
  if (channel === 'whatsapp' && !['whatsapp', 'both'].includes(preference)) {
    blockers.push('WhatsApp is not the recorded reply preference.');
  }
  if (!row.consent_recorded_at) blockers.push('Consent is not recorded.');
  return blockers;
}

function maskedReplyDestination(row: Record<string, unknown>, channel: 'email' | 'whatsapp') {
  if (channel === 'whatsapp') {
    const phone = String(row.phone_normalized ?? '');
    return phone ? `WhatsApp ending ${phone.slice(-4)}` : 'WhatsApp destination unavailable';
  }
  const email = String(row.email_normalized ?? '');
  if (!email || !email.includes('@')) return 'Email destination unavailable';
  const [local, domain] = email.split('@');
  const domainParts = String(domain).split('.');
  const domainSuffix = domainParts.at(-1) ?? 'email';
  return `${String(local).slice(0, 1)}***@***.${domainSuffix}`;
}

function replyConfirmationBody(row: Record<string, unknown>) {
  return {
    success: true,
    reply: {
      draft_id: String(row.draft_key),
      destination_masked: String(row.destination_masked),
      body_revision: String(row.body_revision),
      outbox_delivery_key: String(row.outbox_delivery_key),
      external_send_attempted: false,
      delivery_state: 'draft_saved_provider_off',
      message: 'Reply draft saved. It was not externally sent.',
    },
  };
}

function communicationLabel(eventType: string) {
  if (eventType === 'crm_single_recipient_reply_draft.v1') return 'Single-recipient reply draft';
  if (eventType.includes('whatsapp')) return 'WhatsApp lifecycle message';
  if (eventType.includes('email')) return 'Email lifecycle message';
  if (eventType.includes('support')) return 'Support message';
  return readableState(eventType.replace(/\.v\d+$/u, ''));
}

function communicationStatusLabel(status: string) {
  if (status === 'pending') return 'Queued';
  if (status === 'provider_accepted') return 'Provider accepted';
  if (status === 'delivered') return 'Delivered';
  if (status === 'failed') return 'Failed';
  if (status === 'bounced') return 'Bounced';
  if (status === 'complained') return 'Complained';
  if (status === 'suppressed') return 'Suppressed';
  if (status === 'sink_delivered') return 'Processed in test mode, not delivery';
  return 'Unknown';
}

function communicationDetail(item: Record<string, unknown>) {
  const payload = item.payload as Record<string, unknown> | undefined;
  if (payload?.external_send_attempted === false) return 'Provider-off draft; no external send.';
  return '';
}

function readableState(value: string) {
  return value
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/^\w/u, (letter) => letter.toUpperCase());
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(',')}}`;
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
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
